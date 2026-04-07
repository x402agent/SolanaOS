// Package agent :: scratchpad.go
// Per-query state: scratchpad, token counter, run context.
// Ported from RunContext.ts, Scratchpad.ts, and TokenCounter.ts.
//
// The scratchpad tracks tool calls, results, and usage for
// context management and soft tool limits.
package agent

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"
)

// ── Token Usage ──────────────────────────────────────────────────────

type TokenUsage struct {
	InputTokens  int `json:"inputTokens"`
	OutputTokens int `json:"outputTokens"`
	TotalTokens  int `json:"totalTokens"`
}

type TokenCounter struct {
	mu    sync.Mutex
	usage TokenUsage
}

func NewTokenCounter() *TokenCounter {
	return &TokenCounter{}
}

func (tc *TokenCounter) Add(usage TokenUsage) {
	tc.mu.Lock()
	defer tc.mu.Unlock()
	tc.usage.InputTokens += usage.InputTokens
	tc.usage.OutputTokens += usage.OutputTokens
	tc.usage.TotalTokens += usage.TotalTokens
}

func (tc *TokenCounter) GetUsage() *TokenUsage {
	tc.mu.Lock()
	defer tc.mu.Unlock()
	if tc.usage.TotalTokens == 0 {
		return nil
	}
	return &TokenUsage{
		InputTokens:  tc.usage.InputTokens,
		OutputTokens: tc.usage.OutputTokens,
		TotalTokens:  tc.usage.TotalTokens,
	}
}

func (tc *TokenCounter) GetTokensPerSecond(elapsedMs int64) float64 {
	tc.mu.Lock()
	defer tc.mu.Unlock()
	if tc.usage.TotalTokens == 0 || elapsedMs <= 0 {
		return 0
	}
	return float64(tc.usage.TotalTokens) / (float64(elapsedMs) / 1000.0)
}

// ── Tool Call Record ─────────────────────────────────────────────────

type ToolCallRecord struct {
	Tool     string                 `json:"tool"`
	Args     map[string]interface{} `json:"args"`
	Result   string                 `json:"result"`
	Duration time.Duration          `json:"duration"`
	Error    string                 `json:"error,omitempty"`
}

type ToolUsageEntry struct {
	tool     string
	query    string
	calledAt time.Time
}

// ── Scratchpad ───────────────────────────────────────────────────────
// Dexter-pattern JSONL work log with soft tool limits.

// Soft limits per tool (warn only, never block)
var defaultToolLimits = map[string]int{
	"solana_tracker_price":    3,
	"solana_tracker_chart":    2,
	"solana_tracker_stats":    3,
	"solana_tracker_trending": 2,
	"solana_tracker_token":    3,
	"aster_signal":            3,
	"aster_digest":            2,
	"helius_get_balance":      2,
	"helius_get_transactions": 2,
	"memory_recall":           5,
	"memory_whatdoiknow":      3,
	"memory_learn":            5,
	"vault_remember":          10,
}

type Scratchpad struct {
	mu         sync.Mutex
	query      string
	toolCalls  []ToolCallRecord
	thinkings  []string
	toolUsage  []ToolUsageEntry
	toolLimits map[string]int
}

func NewScratchpad(query string) *Scratchpad {
	limits := make(map[string]int)
	for k, v := range defaultToolLimits {
		limits[k] = v
	}
	return &Scratchpad{
		query:      query,
		toolLimits: limits,
	}
}

// RecordToolCall records a tool invocation for limits tracking.
func (s *Scratchpad) RecordToolCall(tool, query string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.toolUsage = append(s.toolUsage, ToolUsageEntry{
		tool:     tool,
		query:    query,
		calledAt: time.Now(),
	})
}

// AddToolResult appends a tool result to the scratchpad.
func (s *Scratchpad) AddToolResult(tool string, args map[string]interface{}, result string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.toolCalls = append(s.toolCalls, ToolCallRecord{
		Tool:   tool,
		Args:   args,
		Result: result,
	})
}

// AddThinking records an intermediate reasoning text.
func (s *Scratchpad) AddThinking(text string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.thinkings = append(s.thinkings, text)
}

// CanCallTool checks the soft limit for a tool.
// Returns warning message if approaching/exceeding limit.
type ToolLimitCheck struct {
	Warning string
}

func (s *Scratchpad) CanCallTool(tool, query string) ToolLimitCheck {
	s.mu.Lock()
	defer s.mu.Unlock()

	limit, hasLimit := s.toolLimits[tool]
	if !hasLimit {
		return ToolLimitCheck{}
	}

	// Count calls to same tool (optionally same query)
	count := 0
	for _, u := range s.toolUsage {
		if u.tool == tool {
			count++
		}
	}

	if count >= limit {
		return ToolLimitCheck{
			Warning: fmt.Sprintf("%s called %d times (soft limit: %d). Consider using cached data.", tool, count, limit),
		}
	}
	if count >= limit-1 {
		return ToolLimitCheck{
			Warning: fmt.Sprintf("%s approaching limit (%d/%d)", tool, count+1, limit),
		}
	}
	return ToolLimitCheck{}
}

// GetToolResults formats all tool results as a string for prompt injection.
func (s *Scratchpad) GetToolResults() string {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.toolCalls) == 0 {
		return ""
	}

	var sb strings.Builder
	for i, call := range s.toolCalls {
		argsJSON, _ := json.Marshal(call.Args)
		sb.WriteString(fmt.Sprintf("--- Tool %d: %s(%s) ---\n%s\n\n",
			i+1, call.Tool, string(argsJSON), call.Result))
	}
	return sb.String()
}

// GetToolCallRecords returns all recorded tool calls.
func (s *Scratchpad) GetToolCallRecords() []ToolCallRecord {
	s.mu.Lock()
	defer s.mu.Unlock()
	result := make([]ToolCallRecord, len(s.toolCalls))
	copy(result, s.toolCalls)
	return result
}

// ClearOldestToolResults removes the oldest tool results, keeping the
// most recent `keep` entries. Returns number cleared.
func (s *Scratchpad) ClearOldestToolResults(keep int) int {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.toolCalls) <= keep {
		return 0
	}

	cleared := len(s.toolCalls) - keep
	s.toolCalls = s.toolCalls[cleared:]
	return cleared
}

// FormatToolUsageForPrompt creates a summary of tool usage for context injection.
func (s *Scratchpad) FormatToolUsageForPrompt() string {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(s.toolUsage) == 0 {
		return ""
	}

	// Group by tool
	counts := make(map[string]int)
	for _, u := range s.toolUsage {
		counts[u.tool]++
	}

	var sb strings.Builder
	sb.WriteString("Tool usage this session:\n")
	for tool, count := range counts {
		limit, hasLimit := s.toolLimits[tool]
		if hasLimit {
			sb.WriteString(fmt.Sprintf("  %s: %d/%d\n", tool, count, limit))
		} else {
			sb.WriteString(fmt.Sprintf("  %s: %d\n", tool, count))
		}
	}
	return sb.String()
}

// ── RunContext ────────────────────────────────────────────────────────
// Per-query state container.

type RunContext struct {
	Query        string
	Iteration    int
	StartTime    time.Time
	Scratchpad   *Scratchpad
	TokenCounter *TokenCounter
}

func NewRunContext(query string) *RunContext {
	return &RunContext{
		Query:        query,
		Iteration:    0,
		StartTime:    time.Now(),
		Scratchpad:   NewScratchpad(query),
		TokenCounter: NewTokenCounter(),
	}
}

func (rc *RunContext) ElapsedMs() int64 {
	return time.Since(rc.StartTime).Milliseconds()
}
