// Package zero :: types.go
// Zero Engine — the ClawdBot coding-agent core where "zero" is earned twice:
//
//	Zero recursion  — one flat task scheduler; subtasks are enqueued, never
//	                  nested. Enforced statically by norecursion_test.go.
//	Zero knowledge  — every run produces a hash-chained transcript whose
//	                  commitment + nullifier feed clawd-zk publish_attestation
//	                  (zk-primitives/), proving a run happened exactly once
//	                  without revealing prompts, tools, or outputs.
package zero

import (
	"time"

	"github.com/x402agent/SolanaOS/clawdbot/pkg/providers"
)

// ── Budgets ──────────────────────────────────────────────────────────

const (
	defaultMaxTurns  = 24 // global LLM-call budget across ALL tasks
	defaultMaxDepth  = 2  // spawn lineage cap (root = 0)
	defaultMaxTasks  = 16 // total tasks per run
	defaultMaxTokens = 2048
)

// ── Task ─────────────────────────────────────────────────────────────

type taskState int

const (
	taskReady taskState = iota
	taskWaiting
	taskDone
	taskFailed
)

// task is one unit of agent work. The root task carries the user prompt;
// children are spawned via the spawn_task tool and run on the same flat
// queue as everything else — depth is a counter, not a call stack.
type task struct {
	id       int
	parentID int // -1 for root
	depth    int
	prompt   string

	messages []providers.Message
	state    taskState
	pending  int // children still running
	result   string
}

// ── Events ───────────────────────────────────────────────────────────

type EventType string

const (
	EventTaskStart  EventType = "task_start"
	EventThinking   EventType = "thinking"
	EventToolStart  EventType = "tool_start"
	EventToolResult EventType = "tool_result"
	EventToolError  EventType = "tool_error"
	EventSpawn      EventType = "spawn"
	EventTaskDone   EventType = "task_done"
	EventRunDone    EventType = "run_done"
)

// Event is emitted to Config.OnEvent as the run progresses.
type Event struct {
	Type    EventType
	TaskID  int
	Depth   int
	Tool    string
	Message string
}

// ── Result ───────────────────────────────────────────────────────────

// Result is the outcome of an Engine.Run.
type Result struct {
	Answer       string
	Turns        int
	Tasks        int
	InputTokens  int
	OutputTokens int
	Duration     time.Duration

	// Commitment is the transcript hash-chain head (hex, 32 bytes) —
	// the payloadCommitment for clawd-zk publish_attestation.
	Commitment string
	Transcript *Transcript

	// WinnerModels lists every model that won at least one turn.
	// Single-provider runs contain just Config.Model; ZK God Mode runs
	// contain each race winner. Feed ModelSetID(WinnerModels) to
	// Transcript.Attest so the attestation commits to the winner set.
	WinnerModels []string
}
