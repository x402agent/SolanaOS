// Package agent :: toolexec.go
// Tool executor for MawdBot agent loop.
// Ported from ToolExecutor.ts — executes tool calls with approval gate.
package agent

import (
	"context"
	"fmt"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/tools"
)

// ── Event Types ──────────────────────────────────────────────────────

type EventType string

const (
	EventToolStart    EventType = "tool_start"
	EventToolEnd      EventType = "tool_end"
	EventToolError    EventType = "tool_error"
	EventToolApproval EventType = "tool_approval"
	EventToolDenied   EventType = "tool_denied"
	EventToolLimit    EventType = "tool_limit"
	EventThinking     EventType = "thinking"
	EventContextClear EventType = "context_cleared"
	EventDone         EventType = "done"
)

type AgentEvent struct {
	Type     EventType              `json:"type"`
	Tool     string                 `json:"tool,omitempty"`
	Args     map[string]interface{} `json:"args,omitempty"`
	Result   string                 `json:"result,omitempty"`
	Duration time.Duration          `json:"duration,omitempty"`
	Message  string                 `json:"message,omitempty"`
	Warning  string                 `json:"warning,omitempty"`
	Error    string                 `json:"error,omitempty"`

	// Done event fields
	Answer     string       `json:"answer,omitempty"`
	ToolCalls  []ToolCallRecord `json:"tool_calls,omitempty"`
	Iterations int          `json:"iterations,omitempty"`
	TotalTime  time.Duration `json:"total_time,omitempty"`
	Tokens     *TokenUsage  `json:"token_usage,omitempty"`
}

// ── Approval ─────────────────────────────────────────────────────────

type ApprovalDecision string

const (
	ApprovalAllowOnce    ApprovalDecision = "allow-once"
	ApprovalAllowSession ApprovalDecision = "allow-session"
	ApprovalDeny         ApprovalDecision = "deny"
)

type ApprovalFunc func(tool string, args map[string]interface{}) ApprovalDecision

// Tools requiring approval before execution
var approvalRequired = map[string]bool{
	"swap":           true,
	"open_position":  true,
	"close_position": true,
}

// ── ToolExecutor ─────────────────────────────────────────────────────

type ToolExecutor struct {
	registry          *tools.Registry
	requestApproval   ApprovalFunc
	sessionApproved   map[string]bool
}

func NewToolExecutor(registry *tools.Registry, approvalFn ApprovalFunc) *ToolExecutor {
	return &ToolExecutor{
		registry:        registry,
		requestApproval: approvalFn,
		sessionApproved: make(map[string]bool),
	}
}

// ExecuteAll runs a batch of tool calls, emitting events via channel.
func (te *ToolExecutor) ExecuteAll(
	ctx context.Context,
	calls []struct{ Name string; Input map[string]interface{} },
	scratchpad *Scratchpad,
) []AgentEvent {
	var events []AgentEvent

	for _, call := range calls {
		evs := te.executeSingle(ctx, call.Name, call.Input, scratchpad)
		events = append(events, evs...)
	}
	return events
}

func (te *ToolExecutor) executeSingle(
	ctx context.Context,
	toolName string,
	args map[string]interface{},
	scratchpad *Scratchpad,
) []AgentEvent {
	var events []AgentEvent

	// Approval gate
	if approvalRequired[toolName] && !te.sessionApproved[toolName] {
		decision := ApprovalDeny
		if te.requestApproval != nil {
			decision = te.requestApproval(toolName, args)
		}
		events = append(events, AgentEvent{
			Type: EventToolApproval,
			Tool: toolName,
			Args: args,
		})
		if decision == ApprovalDeny {
			events = append(events, AgentEvent{Type: EventToolDenied, Tool: toolName, Args: args})
			return events
		}
		if decision == ApprovalAllowSession {
			for name := range approvalRequired {
				te.sessionApproved[name] = true
			}
		}
	}

	// Soft limit check
	query := extractQuery(args)
	check := scratchpad.CanCallTool(toolName, query)
	if check.Warning != "" {
		events = append(events, AgentEvent{Type: EventToolLimit, Tool: toolName, Warning: check.Warning})
	}

	events = append(events, AgentEvent{Type: EventToolStart, Tool: toolName, Args: args})
	t0 := time.Now()

	tool, ok := te.registry.Get(toolName)
	if !ok {
		events = append(events, AgentEvent{
			Type:  EventToolError,
			Tool:  toolName,
			Error: fmt.Sprintf("tool '%s' not registered", toolName),
		})
		return events
	}

	result, err := tool.Execute(ctx, args)
	duration := time.Since(t0)

	if err != nil {
		events = append(events, AgentEvent{
			Type:  EventToolError,
			Tool:  toolName,
			Error: err.Error(),
		})
		scratchpad.RecordToolCall(toolName, query)
		scratchpad.AddToolResult(toolName, args, "Error: "+err.Error())
		return events
	}

	events = append(events, AgentEvent{
		Type:     EventToolEnd,
		Tool:     toolName,
		Args:     args,
		Result:   result,
		Duration: duration,
	})

	scratchpad.RecordToolCall(toolName, query)
	scratchpad.AddToolResult(toolName, args, result)

	return events
}

func extractQuery(args map[string]interface{}) string {
	for _, key := range []string{"query", "address", "asset", "symbol", "mint", "ticker"} {
		if v, ok := args[key].(string); ok {
			return v
		}
	}
	return ""
}
