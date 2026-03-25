// Package tools provides the tool registry and built-in tools for MawdBot.
// Adapted from PicoClaw — web search, exec, file ops, message, spawn,
// plus MawdBot-specific Solana tools and hardware I2C tools.
package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
)

// ── Tool Interface ───────────────────────────────────────────────────

type Tool interface {
	Name() string
	Description() string
	InputSchema() json.RawMessage
	Execute(ctx context.Context, args map[string]any) (string, error)
}

// ── ToolDef — struct-based Tool implementation ───────────────────────
// Use this to register tools with a simple struct literal.

type ToolDef struct {
	ToolName         string                                                 `json:"name"`
	Desc             string                                                 `json:"description"`
	Schema           json.RawMessage                                        `json:"input_schema,omitempty"`
	RequiresApproval bool                                                   `json:"requires_approval"`
	ExecuteFn        func(ctx context.Context, args map[string]any) (string, error) `json:"-"`
}

// Ensure ToolDef satisfies the Tool interface compile-time.
var _ Tool = (*ToolDef)(nil)

func (t *ToolDef) Name() string             { return t.ToolName }
func (t *ToolDef) Description() string      { return t.Desc }
func (t *ToolDef) InputSchema() json.RawMessage {
	if t.Schema != nil {
		return t.Schema
	}
	return json.RawMessage(`{"type":"object","properties":{}}`)
}
func (t *ToolDef) Execute(ctx context.Context, args map[string]any) (string, error) {
	if t.ExecuteFn != nil {
		return t.ExecuteFn(ctx, args)
	}
	return "", fmt.Errorf("no execute function defined for tool %s", t.ToolName)
}
func (t *ToolDef) NeedsApproval() bool { return t.RequiresApproval }

// ── Registry ─────────────────────────────────────────────────────────

type Registry struct {
	mu      sync.RWMutex
	tools   map[string]Tool
	hidden  map[string]Tool
	order   []string
}

func NewRegistry() *Registry {
	return &Registry{
		tools:  make(map[string]Tool),
		hidden: make(map[string]Tool),
	}
}

func (r *Registry) Register(tool Tool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.tools[tool.Name()] = tool
	r.order = append(r.order, tool.Name())
}

func (r *Registry) RegisterHidden(tool Tool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.hidden[tool.Name()] = tool
}

func (r *Registry) Get(name string) (Tool, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if t, ok := r.tools[name]; ok {
		return t, true
	}
	if t, ok := r.hidden[name]; ok {
		return t, true
	}
	return nil, false
}

func (r *Registry) List() []Tool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]Tool, 0, len(r.tools))
	for _, name := range r.order {
		if t, ok := r.tools[name]; ok {
			result = append(result, t)
		}
	}
	return result
}

func (r *Registry) ListAll() []Tool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]Tool, 0, len(r.tools)+len(r.hidden))
	for _, t := range r.tools {
		result = append(result, t)
	}
	for _, t := range r.hidden {
		result = append(result, t)
	}
	return result
}

func (r *Registry) Names() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return append([]string{}, r.order...)
}

// ── Built-in: Web Search ─────────────────────────────────────────────

type WebSearchTool struct {
	maxResults int
}

func NewWebSearchTool(maxResults int) *WebSearchTool {
	return &WebSearchTool{maxResults: maxResults}
}

func (t *WebSearchTool) Name() string        { return "web_search" }
func (t *WebSearchTool) Description() string { return "Search the web using DuckDuckGo" }
func (t *WebSearchTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}`)
}
func (t *WebSearchTool) Execute(ctx context.Context, args map[string]any) (string, error) {
	query, _ := args["query"].(string)
	return fmt.Sprintf("[web_search] Results for: %s (implement HTTP search)", query), nil
}

// ── Built-in: Exec ───────────────────────────────────────────────────

type ExecTool struct {
	workspace string
}

func NewExecTool(workspace string) *ExecTool {
	return &ExecTool{workspace: workspace}
}

func (t *ExecTool) Name() string        { return "exec" }
func (t *ExecTool) Description() string { return "Execute a shell command in the workspace" }
func (t *ExecTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{"type":"object","properties":{"command":{"type":"string"}},"required":["command"]}`)
}
func (t *ExecTool) Execute(ctx context.Context, args map[string]any) (string, error) {
	cmd, _ := args["command"].(string)
	return fmt.Sprintf("[exec] Would run: %s in %s (sandboxed)", cmd, t.workspace), nil
}

// ── Built-in: Message ────────────────────────────────────────────────

type MessageTool struct {
	sendFn func(channel, chatID, content string) error
	mu     sync.Mutex
	sent   bool
}

func NewMessageTool() *MessageTool {
	return &MessageTool{}
}

func (t *MessageTool) SetSendCallback(fn func(channel, chatID, content string) error) {
	t.sendFn = fn
}

func (t *MessageTool) Name() string        { return "message" }
func (t *MessageTool) Description() string { return "Send a message to a channel" }
func (t *MessageTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{"type":"object","properties":{"channel":{"type":"string"},"chat_id":{"type":"string"},"content":{"type":"string"}},"required":["channel","chat_id","content"]}`)
}

func (t *MessageTool) Execute(ctx context.Context, args map[string]any) (string, error) {
	channel, _ := args["channel"].(string)
	chatID, _ := args["chat_id"].(string)
	content, _ := args["content"].(string)

	if t.sendFn != nil {
		if err := t.sendFn(channel, chatID, content); err != nil {
			return "", err
		}
		t.mu.Lock()
		t.sent = true
		t.mu.Unlock()
		return "Message sent", nil
	}
	return "No send callback configured", nil
}

func (t *MessageTool) HasSentInRound() bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.sent
}

func (t *MessageTool) ResetSentInRound() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.sent = false
}
