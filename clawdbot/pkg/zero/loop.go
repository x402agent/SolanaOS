// Package zero :: loop.go
// The flat scheduler. One FIFO queue drives every task in the run —
// root and spawned subtasks alike. A spawn parks the parent (state
// waiting) and enqueues the child; a finishing child hands its result
// to the parent and re-enqueues it. Depth is a counter on the task,
// never a position in the Go call stack, so agent nesting can never
// blow the stack or hide work from the transcript.
//
// norecursion_test.go statically rejects any direct or mutual recursion
// inside this package, so the invariant is enforced, not aspirational.
package zero

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/x402agent/SolanaOS/clawdbot/pkg/godmode"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/providers"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/tools"
)

const spawnToolName = "spawn_task"

// ── Config ───────────────────────────────────────────────────────────

type Config struct {
	Model        string
	Provider     providers.LLMProvider
	Registry     *tools.Registry
	SystemPrompt string
	MaxTurns     int // global LLM-call budget across all tasks
	MaxDepth     int // spawn lineage cap; 0 disables spawning
	MaxTasks     int
	MaxTokens    int
	Temperature  float64
	OnEvent      func(Event)

	// ZK God Mode — when GodMode is set, every turn races GodModeModels
	// through pkg/godmode, and each turn's winning model is folded into
	// the transcript chain. The attestation then commits to the exact
	// winner set (see Result.WinnerModels + ModelSetID).
	GodMode       *godmode.Engine
	GodModeModels []string
}

// ── Engine ───────────────────────────────────────────────────────────

type Engine struct {
	cfg Config
}

func NewEngine(cfg Config) (*Engine, error) {
	if cfg.Provider == nil {
		return nil, fmt.Errorf("provider is required")
	}
	if cfg.Model == "" {
		return nil, fmt.Errorf("model is required")
	}
	if cfg.Registry == nil {
		cfg.Registry = tools.NewRegistry()
	}
	if cfg.MaxTurns <= 0 {
		cfg.MaxTurns = defaultMaxTurns
	}
	if cfg.MaxDepth < 0 {
		cfg.MaxDepth = defaultMaxDepth
	}
	if cfg.MaxTasks <= 0 {
		cfg.MaxTasks = defaultMaxTasks
	}
	if cfg.MaxTokens <= 0 {
		cfg.MaxTokens = defaultMaxTokens
	}
	if cfg.SystemPrompt == "" {
		cfg.SystemPrompt = defaultSystemPrompt
	}
	return &Engine{cfg: cfg}, nil
}

const defaultSystemPrompt = `You are Zero, ClawdBot's coding agent core.
Work iteratively: call tools to gather facts, then answer plainly.
Use spawn_task only for genuinely independent subtasks; results come back
to you as tool results. When you have the answer, reply without tool calls.`

// ── Run — the single flat loop ───────────────────────────────────────

// Run executes prompt to completion on one queue. It returns the final
// answer plus the transcript commitment for attestation.
func (e *Engine) Run(ctx context.Context, prompt string) (*Result, error) {
	start := time.Now()
	tr := NewTranscript()

	tasksByID := make(map[int]*task)
	queue := make([]int, 0, e.cfg.MaxTasks)
	head := 0
	nextID := 0
	turns := 0
	inTok, outTok := 0, 0

	winners := map[string]bool{}

	root := &task{id: nextID, parentID: -1, depth: 0, prompt: prompt, state: taskReady}
	root.messages = []providers.Message{
		{Role: "system", Content: e.cfg.SystemPrompt},
		{Role: "user", Content: prompt},
	}
	tasksByID[root.id] = root
	queue = append(queue, root.id)
	nextID++
	_ = tr.Append("task_start", root.id, map[string]any{"depth": 0, "prompt": prompt})

	for head < len(queue) {
		if err := ctx.Err(); err != nil {
			return e.finish(tr, root, winners, turns, len(tasksByID), inTok, outTok, start, "cancelled")
		}
		t := tasksByID[queue[head]]
		head++
		if t.state != taskReady {
			continue
		}
		if turns >= e.cfg.MaxTurns {
			t.state = taskFailed
			t.result = fmt.Sprintf("turn budget exhausted (%d)", e.cfg.MaxTurns)
			_ = tr.Append("task_failed", t.id, map[string]any{"reason": t.result})
			continue
		}
		turns++

		resp, winner, err := e.chatTurn(ctx, t.messages, e.toolDefs(t.depth))
		if err != nil {
			t.state = taskFailed
			t.result = fmt.Sprintf("provider error: %v", err)
			_ = tr.Append("task_failed", t.id, map[string]any{"reason": t.result})
			e.emit(Event{Type: EventToolError, TaskID: t.id, Depth: t.depth, Message: t.result})
			e.settle(tr, tasksByID, &queue, t)
			continue
		}
		inTok += resp.InputTokens
		outTok += resp.OutputTokens
		winners[winner] = true
		_ = tr.Append("llm_turn", t.id, map[string]any{
			"turn": turns, "model": winner, "content": resp.Content,
			"stop": resp.StopReason, "tool_calls": len(resp.ToolCalls),
		})

		if resp.Content != "" && len(resp.ToolCalls) > 0 {
			e.emit(Event{Type: EventThinking, TaskID: t.id, Depth: t.depth, Message: resp.Content})
		}

		// No tool calls → this task is finished.
		if len(resp.ToolCalls) == 0 || resp.StopReason == "end_turn" || resp.StopReason == "stop" {
			t.state = taskDone
			t.result = resp.Content
			_ = tr.Append("task_done", t.id, map[string]any{"result": resp.Content})
			e.emit(Event{Type: EventTaskDone, TaskID: t.id, Depth: t.depth, Message: resp.Content})
			e.settle(tr, tasksByID, &queue, t)
			continue
		}

		// Record the assistant turn, then handle tool calls.
		if resp.Content != "" {
			t.messages = append(t.messages, providers.Message{Role: "assistant", Content: resp.Content})
		}

		spawned := 0
		for _, tc := range resp.ToolCalls {
			if tc.Name == spawnToolName {
				childPrompt, _ := tc.Input["prompt"].(string)
				if strings.TrimSpace(childPrompt) == "" {
					t.messages = append(t.messages, toolMsg(spawnToolName, "error: spawn_task requires a non-empty prompt"))
					continue
				}
				if t.depth >= e.cfg.MaxDepth {
					t.messages = append(t.messages, toolMsg(spawnToolName,
						fmt.Sprintf("error: max spawn depth (%d) reached — do the work yourself", e.cfg.MaxDepth)))
					continue
				}
				if len(tasksByID) >= e.cfg.MaxTasks {
					t.messages = append(t.messages, toolMsg(spawnToolName,
						fmt.Sprintf("error: task budget (%d) exhausted — do the work yourself", e.cfg.MaxTasks)))
					continue
				}
				child := &task{id: nextID, parentID: t.id, depth: t.depth + 1, prompt: childPrompt, state: taskReady}
				child.messages = []providers.Message{
					{Role: "system", Content: e.cfg.SystemPrompt},
					{Role: "user", Content: childPrompt},
				}
				tasksByID[child.id] = child
				queue = append(queue, child.id)
				nextID++
				spawned++
				t.pending++
				_ = tr.Append("spawn", t.id, map[string]any{"child": child.id, "depth": child.depth, "prompt": childPrompt})
				e.emit(Event{Type: EventSpawn, TaskID: t.id, Depth: t.depth, Message: childPrompt})
				continue
			}

			// Ordinary tool — leaf work, executed inline on this same loop.
			e.emit(Event{Type: EventToolStart, TaskID: t.id, Depth: t.depth, Tool: tc.Name})
			_ = tr.Append("tool_call", t.id, map[string]any{"tool": tc.Name, "input": tc.Input})
			out, terr := e.execTool(ctx, tc)
			if terr != nil {
				out = fmt.Sprintf("error: %v", terr)
				e.emit(Event{Type: EventToolError, TaskID: t.id, Depth: t.depth, Tool: tc.Name, Message: out})
			} else {
				e.emit(Event{Type: EventToolResult, TaskID: t.id, Depth: t.depth, Tool: tc.Name, Message: out})
			}
			_ = tr.Append("tool_result", t.id, map[string]any{"tool": tc.Name, "result": out})
			t.messages = append(t.messages, toolMsg(tc.Name, out))
		}

		if spawned > 0 {
			// Park until children report back; they re-enqueue us.
			t.state = taskWaiting
		} else {
			queue = append(queue, t.id)
		}
	}

	return e.finish(tr, root, winners, turns, len(tasksByID), inTok, outTok, start, "")
}

// chatTurn routes one LLM turn either through ZK God Mode (multi-model
// race; winner recorded in the transcript) or straight to the provider.
func (e *Engine) chatTurn(ctx context.Context, messages []providers.Message, defs []providers.ToolDef) (*providers.Response, string, error) {
	if e.cfg.GodMode != nil && e.cfg.GodMode.Enabled {
		result, err := e.cfg.GodMode.Generate(ctx, godmode.Request{
			Model:       e.cfg.Model,
			Models:      e.cfg.GodModeModels,
			Messages:    messages,
			MaxTokens:   e.cfg.MaxTokens,
			Temperature: e.cfg.Temperature,
			Tools:       defs,
		})
		if err != nil {
			return nil, "", err
		}
		winner := result.Metadata.WinnerModel
		if winner == "" {
			winner = e.cfg.Model
		}
		return result.Response, winner, nil
	}
	resp, err := e.cfg.Provider.Chat(ctx, providers.ChatOptions{
		Model:       e.cfg.Model,
		Messages:    messages,
		MaxTokens:   e.cfg.MaxTokens,
		Temperature: e.cfg.Temperature,
		Tools:       defs,
	})
	return resp, e.cfg.Model, err
}

// settle propagates one finished (done or failed) task's result to its
// parent and re-enqueues the parent when its last child reports in.
// Single-step by construction: the parent only *runs* on a later queue
// iteration, so completion never cascades through the call stack.
func (e *Engine) settle(tr *Transcript, tasksByID map[int]*task, queue *[]int, t *task) {
	if t.parentID < 0 {
		return
	}
	parent, ok := tasksByID[t.parentID]
	if !ok || parent.state != taskWaiting {
		return
	}
	status := "done"
	if t.state == taskFailed {
		status = "failed"
	}
	parent.messages = append(parent.messages, toolMsg(spawnToolName,
		fmt.Sprintf("subtask %d (%s): %s", t.id, status, t.result)))
	parent.pending--
	if parent.pending <= 0 {
		parent.state = taskReady
		*queue = append(*queue, parent.id)
		_ = tr.Append("resume", parent.id, map[string]any{"after_child": t.id})
	}
}

func (e *Engine) finish(tr *Transcript, root *task, winners map[string]bool, turns, tasks, inTok, outTok int, start time.Time, note string) (*Result, error) {
	answer := root.result
	if note != "" && answer == "" {
		answer = note
	}
	winnerList := make([]string, 0, len(winners))
	for m := range winners {
		winnerList = append(winnerList, m)
	}
	_ = tr.Append("run_done", root.id, map[string]any{
		"answer": answer, "turns": turns, "tasks": tasks, "models": ModelSetID(winnerList),
	})
	res := &Result{
		Answer:       answer,
		Turns:        turns,
		Tasks:        tasks,
		InputTokens:  inTok,
		OutputTokens: outTok,
		Duration:     time.Since(start),
		Commitment:   tr.CommitmentHex(),
		Transcript:   tr,
		WinnerModels: winnerList,
	}
	e.emit(Event{Type: EventRunDone, TaskID: root.id, Message: answer})
	if root.state == taskFailed {
		return res, fmt.Errorf("root task failed: %s", root.result)
	}
	return res, nil
}

// ── Tool plumbing ────────────────────────────────────────────────────

func (e *Engine) toolDefs(depth int) []providers.ToolDef {
	list := e.cfg.Registry.List()
	defs := make([]providers.ToolDef, 0, len(list)+1)
	for _, t := range list {
		defs = append(defs, providers.ToolDef{
			Name:        t.Name(),
			Description: t.Description(),
			InputSchema: t.InputSchema(),
		})
	}
	if depth < e.cfg.MaxDepth {
		defs = append(defs, providers.ToolDef{
			Name:        spawnToolName,
			Description: "Delegate one focused, independent subtask to a fresh agent task. The result returns to you as a tool result. Never spawn for work you can do directly.",
			InputSchema: json.RawMessage(`{"type":"object","properties":{"prompt":{"type":"string","description":"Complete, self-contained instructions for the subtask"}},"required":["prompt"]}`),
		})
	}
	return defs
}

func (e *Engine) execTool(ctx context.Context, tc providers.ToolCall) (string, error) {
	tool, ok := e.cfg.Registry.Get(tc.Name)
	if !ok {
		return "", fmt.Errorf("unknown tool %q", tc.Name)
	}
	return tool.Execute(ctx, tc.Input)
}

func (e *Engine) emit(ev Event) {
	if e.cfg.OnEvent != nil {
		e.cfg.OnEvent(ev)
	}
}

func toolMsg(name, content string) providers.Message {
	return providers.Message{Role: "tool", Content: fmt.Sprintf("[%s] %s", name, content)}
}
