// Package e2b provides a lightweight client for the E2B Code Interpreter
// REST API, allowing the SolanaOS daemon to spin up cloud sandboxes,
// execute code, upload/download files, and run shell commands.
package e2b

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	apiBase         = "https://api.e2b.dev"
	defaultTemplate = "code-interpreter-v1"
	defaultTimeout  = 300 // 5 minutes
)

// Client talks to the E2B REST API.
type Client struct {
	apiKey     string
	httpClient *http.Client

	mu       sync.Mutex
	sessions map[string]*Session // chatID → active session
}

// Session represents a running E2B sandbox instance.
type Session struct {
	SandboxID string    `json:"sandboxID"`
	Template  string    `json:"templateID"`
	ClientID  string    `json:"clientID"`
	ChatID    string    `json:"-"` // Telegram chat that owns this session
	CreatedAt time.Time `json:"createdAt"`
}

// ExecResult holds code execution output.
type ExecResult struct {
	Stdout string `json:"stdout"`
	Stderr string `json:"stderr"`
	Error  string `json:"error,omitempty"`
	Text   string `json:"text,omitempty"`
}

// NewClient creates an E2B client from environment.
func NewClient() *Client {
	key := os.Getenv("E2B_API_KEY")
	if key == "" {
		return nil
	}
	log.Printf("[E2B] ☁️  Sandbox client initialized")
	return &Client{
		apiKey:     key,
		httpClient: &http.Client{Timeout: 120 * time.Second},
		sessions:   make(map[string]*Session),
	}
}

// IsConfigured returns true if the API key is set.
func (c *Client) IsConfigured() bool {
	return c != nil && c.apiKey != ""
}

// CreateSandbox spins up a new sandbox, optionally with a custom template.
func (c *Client) CreateSandbox(ctx context.Context, template string) (*Session, error) {
	if template == "" {
		template = defaultTemplate
	}

	body := map[string]interface{}{
		"templateID": template,
		"timeout":    defaultTimeout,
	}
	data, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "POST", apiBase+"/sandboxes", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("e2b create sandbox: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 201 && resp.StatusCode != 200 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("e2b create sandbox: HTTP %d: %s", resp.StatusCode, string(b))
	}

	var result struct {
		SandboxID string `json:"sandboxID"`
		ClientID  string `json:"clientID"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("e2b decode: %w", err)
	}

	sess := &Session{
		SandboxID: result.SandboxID,
		Template:  template,
		ClientID:  result.ClientID,
		CreatedAt: time.Now(),
	}
	log.Printf("[E2B] 🚀 Sandbox created: %s (template: %s)", sess.SandboxID, template)
	return sess, nil
}

// RunCode executes code in a sandbox.
func (c *Client) RunCode(ctx context.Context, sandboxID, code, language string) (*ExecResult, error) {
	if language == "" {
		language = "python"
	}

	body := map[string]interface{}{
		"code": code,
	}
	data, _ := json.Marshal(body)

	url := fmt.Sprintf("%s/sandboxes/%s/code", apiBase, sandboxID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("e2b run code: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("e2b run code: HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Results []struct {
			Text string `json:"text"`
		} `json:"results"`
		Logs struct {
			Stdout []string `json:"stdout"`
			Stderr []string `json:"stderr"`
		} `json:"logs"`
		Error *struct {
			Name    string `json:"name"`
			Value   string `json:"value"`
			Traceback string `json:"traceback"`
		} `json:"error"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("e2b decode: %w", err)
	}

	exec := &ExecResult{
		Stdout: strings.Join(result.Logs.Stdout, ""),
		Stderr: strings.Join(result.Logs.Stderr, ""),
	}
	if len(result.Results) > 0 {
		exec.Text = result.Results[0].Text
	}
	if result.Error != nil {
		exec.Error = fmt.Sprintf("%s: %s", result.Error.Name, result.Error.Value)
	}

	return exec, nil
}

// RunCommand executes a shell command in a sandbox.
func (c *Client) RunCommand(ctx context.Context, sandboxID, command string) (*ExecResult, error) {
	body := map[string]interface{}{
		"cmd": command,
	}
	data, _ := json.Marshal(body)

	url := fmt.Sprintf("%s/sandboxes/%s/commands", apiBase, sandboxID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("e2b command: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("e2b command: HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Stdout   string `json:"stdout"`
		Stderr   string `json:"stderr"`
		ExitCode int    `json:"exitCode"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("e2b decode: %w", err)
	}

	exec := &ExecResult{
		Stdout: result.Stdout,
		Stderr: result.Stderr,
	}
	if result.ExitCode != 0 {
		exec.Error = fmt.Sprintf("exit code %d", result.ExitCode)
	}
	return exec, nil
}

// KillSandbox terminates a running sandbox.
func (c *Client) KillSandbox(ctx context.Context, sandboxID string) error {
	url := fmt.Sprintf("%s/sandboxes/%s", apiBase, sandboxID)
	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("X-API-Key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("e2b kill: %w", err)
	}
	resp.Body.Close()
	log.Printf("[E2B] 🗑️  Sandbox killed: %s", sandboxID)
	return nil
}

// ListSandboxes returns all active sandboxes.
func (c *Client) ListSandboxes(ctx context.Context) ([]Session, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", apiBase+"/sandboxes", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-API-Key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("e2b list: %w", err)
	}
	defer resp.Body.Close()

	var sandboxes []Session
	if err := json.NewDecoder(resp.Body).Decode(&sandboxes); err != nil {
		return nil, fmt.Errorf("e2b decode: %w", err)
	}
	return sandboxes, nil
}

// --- Session management per chat ---

// GetOrCreateSession returns the active sandbox for a chat, creating one if needed.
func (c *Client) GetOrCreateSession(ctx context.Context, chatID string) (*Session, bool, error) {
	c.mu.Lock()
	if sess, ok := c.sessions[chatID]; ok {
		c.mu.Unlock()
		return sess, false, nil
	}
	c.mu.Unlock()

	sess, err := c.CreateSandbox(ctx, "")
	if err != nil {
		return nil, false, err
	}
	sess.ChatID = chatID

	c.mu.Lock()
	c.sessions[chatID] = sess
	c.mu.Unlock()

	return sess, true, nil
}

// GetSession returns the active sandbox for a chat, or nil.
func (c *Client) GetSession(chatID string) *Session {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.sessions[chatID]
}

// CloseSession kills and removes a chat's sandbox.
func (c *Client) CloseSession(ctx context.Context, chatID string) error {
	c.mu.Lock()
	sess, ok := c.sessions[chatID]
	if ok {
		delete(c.sessions, chatID)
	}
	c.mu.Unlock()

	if !ok {
		return fmt.Errorf("no active sandbox for this chat")
	}
	return c.KillSandbox(ctx, sess.SandboxID)
}

// FormatResult formats an ExecResult for Telegram display.
func FormatResult(r *ExecResult) string {
	var parts []string
	if r.Text != "" {
		parts = append(parts, r.Text)
	}
	if r.Stdout != "" {
		out := r.Stdout
		if len(out) > 3000 {
			out = out[:3000] + "\n... (truncated)"
		}
		parts = append(parts, out)
	}
	if r.Stderr != "" {
		stderr := r.Stderr
		if len(stderr) > 1000 {
			stderr = stderr[:1000] + "\n... (truncated)"
		}
		parts = append(parts, "⚠️ "+stderr)
	}
	if r.Error != "" {
		parts = append(parts, "❌ "+r.Error)
	}
	if len(parts) == 0 {
		return "(no output)"
	}
	return strings.Join(parts, "\n")
}
