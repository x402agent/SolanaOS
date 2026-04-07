// Package agent :: agent.go
// Agent — Dexter-style iterative tool-calling loop for MawdBot.
// Ported from Agent.ts.
//
// Features:
// - Context management with threshold-based clearing
// - Token usage tracking
// - Soft tool limits (warn, never block)
// - Memory context injection from MemoryEngine
// - Channel-aware formatting via channels.go
// - Approval gate for execution tools (swap, open_position)
package agent

import (
	"context"
	"fmt"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/logger"
	"github.com/x402agent/Solana-Os-Go/pkg/memory"
	"github.com/x402agent/Solana-Os-Go/pkg/providers"
	"github.com/x402agent/Solana-Os-Go/pkg/tools"
)

// Context clearing thresholds (char-based estimate, ~4 chars/token)
const (
	contextThresholdChars   = 80000
	keepToolResults         = 5
	overflowKeepToolResults = 3
	maxOverflowRetries      = 2
	defaultMaxIterations    = 12
)

// ── AgentConfig ──────────────────────────────────────────────────────

type AgentConfig struct {
	Model          string
	MaxIterations  int
	Channel        string
	MemoryEngine   *memory.MemoryEngine
	ToolRegistry   *tools.Registry
	Provider       providers.LLMProvider
	ApprovalFn     ApprovalFunc
	SoulPath       string
	StrategyPath   string
	MaxTokens      int
	Temperature    float64
}

// ── MawdAgent ────────────────────────────────────────────────────────

type MawdAgent struct {
	config       AgentConfig
	provider     providers.LLMProvider
	toolExecutor *ToolExecutor
	systemPrompt string
	memEngine    *memory.MemoryEngine
}

func NewMawdAgent(cfg AgentConfig) (*MawdAgent, error) {
	if cfg.Provider == nil {
		return nil, fmt.Errorf("provider is required")
	}
	if cfg.Model == "" {
		cfg.Model = "openai/gpt-4.1-2025-04-14"
	}
	if cfg.MaxIterations <= 0 {
		cfg.MaxIterations = defaultMaxIterations
	}
	if cfg.MaxTokens <= 0 {
		cfg.MaxTokens = 2048
	}
	if cfg.Temperature == 0 {
		cfg.Temperature = 0.7
	}

	registry := cfg.ToolRegistry
	if registry == nil {
		registry = tools.NewRegistry()
	}

	executor := NewToolExecutor(registry, cfg.ApprovalFn)

	// Build memory context
	var memoryContext string
	if cfg.MemoryEngine != nil {
		memoryContext = cfg.MemoryEngine.BuildContext("agent startup", "")
	}

	systemPrompt := BuildSystemPrompt(PromptConfig{
		Channel:       cfg.Channel,
		Soul:          LoadSoul(cfg.SoulPath),
		MemoryContext: memoryContext,
		StrategyPath:  cfg.StrategyPath,
	})

	return &MawdAgent{
		config:       cfg,
		provider:     cfg.Provider,
		toolExecutor: executor,
		systemPrompt: systemPrompt,
		memEngine:    cfg.MemoryEngine,
	}, nil
}

// ── Run — main iterative loop ────────────────────────────────────────

func (a *MawdAgent) Run(ctx context.Context, query string) <-chan AgentEvent {
	events := make(chan AgentEvent, 64)

	go func() {
		defer close(events)

		rc := NewRunContext(query)
		currentPrompt := query
		overflowRetries := 0

		for rc.Iteration < a.config.MaxIterations {
			rc.Iteration++

			// Check context cancellation
			select {
			case <-ctx.Done():
				events <- a.doneEvent(rc, "Cancelled")
				return
			default:
			}

			// ── LLM Call ─────────────────────────────────────────
			messages := []providers.Message{
				{Role: "system", Content: a.systemPrompt},
				{Role: "user", Content: currentPrompt},
			}

			resp, err := a.provider.Chat(ctx, providers.ChatOptions{
				Model:       a.config.Model,
				Messages:    messages,
				MaxTokens:   a.config.MaxTokens,
				Temperature: a.config.Temperature,
			})

			if err != nil {
				errMsg := err.Error()

				// Context overflow retry
				isOverflow := containsAny(errMsg, "context", "too long", "maximum")
				if isOverflow && overflowRetries < maxOverflowRetries {
					overflowRetries++
					cleared := rc.Scratchpad.ClearOldestToolResults(overflowKeepToolResults)
					if cleared > 0 {
						events <- AgentEvent{
							Type:    EventContextClear,
							Message: fmt.Sprintf("Cleared %d tool results (overflow retry %d)", cleared, overflowRetries),
						}
						currentPrompt = BuildIterationPrompt(
							query,
							rc.Scratchpad.GetToolResults(),
							rc.Scratchpad.FormatToolUsageForPrompt(),
						)
						continue
					}
				}

				events <- a.doneEvent(rc, fmt.Sprintf("Error: %s", errMsg))
				return
			}
			overflowRetries = 0

			// Track tokens
			if resp.InputTokens > 0 || resp.OutputTokens > 0 {
				rc.TokenCounter.Add(TokenUsage{
					InputTokens:  resp.InputTokens,
					OutputTokens: resp.OutputTokens,
					TotalTokens:  resp.InputTokens + resp.OutputTokens,
				})
			}

			// ── Parse response ───────────────────────────────────
			text := resp.Content

			// Emit thinking if both text and tool calls
			if text != "" && len(resp.ToolCalls) > 0 {
				rc.Scratchpad.AddThinking(text)
				events <- AgentEvent{Type: EventThinking, Message: text}
			}

			// No tool calls → final answer
			if resp.StopReason == "end_turn" || resp.StopReason == "stop" || len(resp.ToolCalls) == 0 {
				events <- a.doneEvent(rc, text)
				return
			}

			// ── Execute tools ────────────────────────────────────
			calls := make([]struct {
				Name  string
				Input map[string]interface{}
			}, len(resp.ToolCalls))

			for i, tc := range resp.ToolCalls {
				calls[i].Name = tc.Name
				calls[i].Input = tc.Input
			}

			toolEvents := a.toolExecutor.ExecuteAll(ctx, calls, rc.Scratchpad)
			for _, ev := range toolEvents {
				events <- ev
				if ev.Type == EventToolDenied {
					events <- a.doneEvent(rc, "")
					return
				}
			}

			// ── Context management ───────────────────────────────
			toolResults := rc.Scratchpad.GetToolResults()
			estimatedChars := len(a.systemPrompt) + len(query) + len(toolResults)

			if estimatedChars > contextThresholdChars {
				cleared := rc.Scratchpad.ClearOldestToolResults(keepToolResults)
				if cleared > 0 {
					events <- AgentEvent{
						Type:    EventContextClear,
						Message: fmt.Sprintf("Cleared %d old tool results", cleared),
					}
				}
			}

			// ── Build next iteration prompt ──────────────────────
			currentPrompt = BuildIterationPrompt(
				query,
				rc.Scratchpad.GetToolResults(),
				rc.Scratchpad.FormatToolUsageForPrompt(),
			)
		}

		events <- a.doneEvent(rc,
			fmt.Sprintf("Reached max iterations (%d). Partial result may be in tool results.",
				a.config.MaxIterations))
	}()

	return events
}

// ── Chat — single-shot without tool loop ─────────────────────────────

func (a *MawdAgent) Chat(ctx context.Context, prompt string) (string, *TokenUsage, error) {
	resp, err := a.provider.Chat(ctx, providers.ChatOptions{
		Model:       a.config.Model,
		Messages: []providers.Message{
			{Role: "system", Content: a.systemPrompt},
			{Role: "user", Content: prompt},
		},
		MaxTokens:   1024,
		Temperature: a.config.Temperature,
	})
	if err != nil {
		return "", nil, err
	}

	usage := &TokenUsage{
		InputTokens:  resp.InputTokens,
		OutputTokens: resp.OutputTokens,
		TotalTokens:  resp.InputTokens + resp.OutputTokens,
	}

	return resp.Content, usage, nil
}

// ── ProcessDirect — convenience for CLI/cron processing ──────────────

func (a *MawdAgent) ProcessDirect(ctx context.Context, query string) (string, error) {
	events := a.Run(ctx, query)
	var answer string
	for ev := range events {
		switch ev.Type {
		case EventDone:
			answer = ev.Answer
		case EventToolStart:
			logger.InfoCF("agent", fmt.Sprintf("Tool: %s", ev.Tool), nil)
		case EventToolError:
			logger.WarnCF("agent", fmt.Sprintf("Tool error: %s — %s", ev.Tool, ev.Error), nil)
		case EventThinking:
			logger.DebugCF("agent", fmt.Sprintf("Thinking: %s", truncateAgentStr(ev.Message, 80)), nil)
		}
	}
	return answer, nil
}

// ── Helpers ──────────────────────────────────────────────────────────

func (a *MawdAgent) doneEvent(rc *RunContext, answer string) AgentEvent {
	totalTime := time.Since(rc.StartTime)
	return AgentEvent{
		Type:       EventDone,
		Answer:     answer,
		ToolCalls:  rc.Scratchpad.GetToolCallRecords(),
		Iterations: rc.Iteration,
		TotalTime:  totalTime,
		Tokens:     rc.TokenCounter.GetUsage(),
	}
}

func containsAny(s string, substrs ...string) bool {
	for _, sub := range substrs {
		if len(s) >= len(sub) {
			for i := 0; i <= len(s)-len(sub); i++ {
				if s[i:i+len(sub)] == sub {
					return true
				}
			}
		}
	}
	return false
}

func truncateAgentStr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
