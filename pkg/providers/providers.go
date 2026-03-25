// Package providers abstracts LLM providers for MawdBot.
// Adapted from PicoClaw — supports OpenRouter, Anthropic, OpenAI, Ollama.
package providers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// ── Message Types ────────────────────────────────────────────────────

type Message struct {
	Role    string `json:"role"` // "system", "user", "assistant", "tool"
	Content string `json:"content"`
}

type ToolCall struct {
	Name  string         `json:"name"`
	Input map[string]any `json:"input"`
}

type ToolResult struct {
	Name   string `json:"name"`
	Result string `json:"result"`
}

type Response struct {
	Content    string     `json:"content"`
	ToolCalls  []ToolCall `json:"tool_calls"`
	StopReason string     `json:"stop_reason"` // "end_turn", "tool_use", "max_tokens"
	InputTokens  int      `json:"input_tokens"`
	OutputTokens int      `json:"output_tokens"`
	Thinking     string   `json:"thinking,omitempty"`
}

// ── Provider Interface ───────────────────────────────────────────────

type LLMProvider interface {
	Name() string
	Chat(ctx context.Context, opts ChatOptions) (*Response, error)
}

type ChatOptions struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	MaxTokens   int       `json:"max_tokens"`
	Temperature float64   `json:"temperature"`
	Tools       []ToolDef `json:"tools,omitempty"`
}

type ToolDef struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"input_schema"`
}

// ── OpenRouter Provider ──────────────────────────────────────────────
// Primary provider for MawdBot — GPT-5.4 via OpenRouter.

type OpenRouterProvider struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

func NewOpenRouterProvider(apiKey string) *OpenRouterProvider {
	return &OpenRouterProvider{
		apiKey:  apiKey,
		baseURL: "https://openrouter.ai/api/v1",
		client: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

func (p *OpenRouterProvider) Name() string { return "openrouter" }

func (p *OpenRouterProvider) Chat(ctx context.Context, opts ChatOptions) (*Response, error) {
	type orMessage struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}

	messages := make([]orMessage, len(opts.Messages))
	for i, m := range opts.Messages {
		messages[i] = orMessage{Role: m.Role, Content: m.Content}
	}

	payload := map[string]any{
		"model":       opts.Model,
		"messages":    messages,
		"max_tokens":  opts.MaxTokens,
		"temperature": opts.Temperature,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "https://solanaos.net")
	req.Header.Set("X-Title", "SolanaOS")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openrouter request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("openrouter HTTP %d: %s", resp.StatusCode, string(respBody[:min(300, len(respBody))]))
	}

	var orResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
		} `json:"usage"`
	}

	if err := json.Unmarshal(respBody, &orResp); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	result := &Response{
		StopReason:   "end_turn",
		InputTokens:  orResp.Usage.PromptTokens,
		OutputTokens: orResp.Usage.CompletionTokens,
	}
	if len(orResp.Choices) > 0 {
		result.Content = orResp.Choices[0].Message.Content
		result.StopReason = orResp.Choices[0].FinishReason
	}

	return result, nil
}

// ── Fallback Chain ───────────────────────────────────────────────────
// Tries providers in order until one succeeds.

type CooldownTracker struct {
	mu       sync.Mutex
	cooldown map[string]time.Time
}

func NewCooldownTracker() *CooldownTracker {
	return &CooldownTracker{cooldown: make(map[string]time.Time)}
}

func (ct *CooldownTracker) SetCooldown(provider string, d time.Duration) {
	ct.mu.Lock()
	defer ct.mu.Unlock()
	ct.cooldown[provider] = time.Now().Add(d)
}

func (ct *CooldownTracker) IsAvailable(provider string) bool {
	ct.mu.Lock()
	defer ct.mu.Unlock()
	deadline, ok := ct.cooldown[provider]
	if !ok {
		return true
	}
	return time.Now().After(deadline)
}

type FallbackChain struct {
	providers []LLMProvider
	cooldown  *CooldownTracker
}

func NewFallbackChain(cooldown *CooldownTracker) *FallbackChain {
	return &FallbackChain{cooldown: cooldown}
}

func (fc *FallbackChain) Add(p LLMProvider) {
	fc.providers = append(fc.providers, p)
}

func (fc *FallbackChain) Chat(ctx context.Context, opts ChatOptions) (*Response, error) {
	var lastErr error
	for _, p := range fc.providers {
		if !fc.cooldown.IsAvailable(p.Name()) {
			continue
		}
		resp, err := p.Chat(ctx, opts)
		if err == nil {
			return resp, nil
		}
		lastErr = err
		fc.cooldown.SetCooldown(p.Name(), 30*time.Second)
	}
	if lastErr != nil {
		return nil, fmt.Errorf("all providers failed: %w", lastErr)
	}
	return nil, fmt.Errorf("no providers available")
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
