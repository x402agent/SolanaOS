// Package steel provides a client for the Steel cloud browser API.
// Steel sessions are WebSocket-driven headful browsers with proxy, CAPTCHA solving,
// live view, session recording, and HLS replay.
package steel

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
	apiBase    = "https://api.steel.dev/v1"
	connectWSS = "wss://connect.steel.dev"
)

// Client talks to the Steel REST API.
type Client struct {
	apiKey     string
	httpClient *http.Client

	mu       sync.Mutex
	sessions map[string]*Session // chatID → active session
}

// Session represents a running Steel browser session.
type Session struct {
	ID               string    `json:"id"`
	Status           string    `json:"status"` // "live", "released", "failed"
	ConnectURL       string    `json:"connectUrl,omitempty"`
	SessionViewerURL string    `json:"sessionViewerUrl,omitempty"`
	DebugURL         string    `json:"debugUrl,omitempty"`
	Region           string    `json:"region,omitempty"`
	Timeout          int       `json:"timeout,omitempty"`
	ChatID           string    `json:"-"` // internal routing
	CreatedAt        time.Time `json:"createdAt"`
}

// CreateOptions configures a new Steel session.
type CreateOptions struct {
	UseProxy     bool              `json:"useProxy,omitempty"`
	SolveCaptcha bool              `json:"solveCaptcha,omitempty"`
	Timeout      int               `json:"timeout,omitempty"`  // milliseconds
	Region       string            `json:"region,omitempty"`   // "lax", "ord", "iad"
	UserAgent    string            `json:"userAgent,omitempty"`
	DeviceConfig *DeviceConfig     `json:"deviceConfig,omitempty"`
	Metadata     map[string]string `json:"metadata,omitempty"`
}

// DeviceConfig for mobile/desktop mode.
type DeviceConfig struct {
	Device string `json:"device"` // "mobile" or "desktop"
}

// NewClient creates a Steel client from environment variables.
func NewClient() *Client {
	key := strings.TrimSpace(os.Getenv("STEEL_API_KEY"))
	if key == "" {
		return nil
	}
	log.Printf("[STEEL] 🔩 Steel browser client initialized")
	return &Client{
		apiKey:     key,
		httpClient: &http.Client{Timeout: 60 * time.Second},
		sessions:   make(map[string]*Session),
	}
}

// IsConfigured returns true if the API key is set.
func (c *Client) IsConfigured() bool {
	return c != nil && c.apiKey != ""
}

// Create starts a new Steel browser session.
func (c *Client) Create(ctx context.Context, opts *CreateOptions) (*Session, error) {
	if opts == nil {
		opts = &CreateOptions{}
	}
	if opts.Timeout <= 0 {
		opts.Timeout = 300000 // 5 minutes default
	}

	data, _ := json.Marshal(opts)
	req, err := http.NewRequestWithContext(ctx, "POST", apiBase+"/sessions", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("steel-api-key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("steel create: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("steel create: HTTP %d: %s", resp.StatusCode, string(body))
	}

	var sess Session
	if err := json.Unmarshal(body, &sess); err != nil {
		return nil, fmt.Errorf("steel decode: %w", err)
	}
	sess.CreatedAt = time.Now()

	// Build connect URL if not returned
	if sess.ConnectURL == "" && sess.ID != "" {
		sess.ConnectURL = fmt.Sprintf("%s?apiKey=%s&sessionId=%s", connectWSS, c.apiKey, sess.ID)
	}

	log.Printf("[STEEL] 🚀 Session created: %s (region: %s, viewer: %s)", sess.ID, sess.Region, sess.SessionViewerURL)
	return &sess, nil
}

// Release terminates a Steel session.
func (c *Client) Release(ctx context.Context, sessionID string) error {
	url := fmt.Sprintf("%s/sessions/%s/release", apiBase, sessionID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("steel-api-key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("steel release: %w", err)
	}
	resp.Body.Close()
	log.Printf("[STEEL] 🗑️  Session released: %s", sessionID)
	return nil
}

// ReleaseAll terminates all active Steel sessions.
func (c *Client) ReleaseAll(ctx context.Context) error {
	url := apiBase + "/sessions/release"
	req, err := http.NewRequestWithContext(ctx, "POST", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("steel-api-key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("steel release all: %w", err)
	}
	resp.Body.Close()
	log.Printf("[STEEL] 🗑️  All sessions released")
	return nil
}

// Retrieve gets details of a specific session.
func (c *Client) Retrieve(ctx context.Context, sessionID string) (*Session, error) {
	url := fmt.Sprintf("%s/sessions/%s", apiBase, sessionID)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("steel-api-key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("steel retrieve: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("steel retrieve: HTTP %d: %s", resp.StatusCode, string(body))
	}

	var sess Session
	if err := json.Unmarshal(body, &sess); err != nil {
		return nil, fmt.Errorf("steel decode: %w", err)
	}
	return &sess, nil
}

// List returns all active sessions.
func (c *Client) List(ctx context.Context) ([]Session, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", apiBase+"/sessions", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("steel-api-key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("steel list: %w", err)
	}
	defer resp.Body.Close()

	var sessions []Session
	if err := json.NewDecoder(resp.Body).Decode(&sessions); err != nil {
		return nil, fmt.Errorf("steel decode: %w", err)
	}
	return sessions, nil
}

// Screenshot captures a screenshot of a session.
func (c *Client) Screenshot(ctx context.Context, sessionID string) ([]byte, error) {
	url := fmt.Sprintf("%s/sessions/%s/screenshot", apiBase, sessionID)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("steel-api-key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("steel screenshot: %w", err)
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("steel screenshot: HTTP %d: %s", resp.StatusCode, string(data))
	}
	return data, nil
}

// Events retrieves recorded session events for replay.
func (c *Client) Events(ctx context.Context, sessionID string) (json.RawMessage, error) {
	url := fmt.Sprintf("%s/sessions/%s/events", apiBase, sessionID)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("steel-api-key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("steel events: %w", err)
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("steel events: HTTP %d: %s", resp.StatusCode, string(data))
	}
	return json.RawMessage(data), nil
}

// HLSPlaylist returns the HLS recording playlist URL for a session.
func (c *Client) HLSPlaylist(sessionID string) string {
	return fmt.Sprintf("%s/sessions/%s/hls", apiBase, sessionID)
}

// --- Per-chat session management ---

// GetOrCreate returns the active session for a chat, creating one if needed.
func (c *Client) GetOrCreate(ctx context.Context, chatID string, opts *CreateOptions) (*Session, bool, error) {
	c.mu.Lock()
	if sess, ok := c.sessions[chatID]; ok {
		c.mu.Unlock()
		return sess, false, nil
	}
	c.mu.Unlock()

	sess, err := c.Create(ctx, opts)
	if err != nil {
		return nil, false, err
	}
	sess.ChatID = chatID

	c.mu.Lock()
	c.sessions[chatID] = sess
	c.mu.Unlock()

	return sess, true, nil
}

// GetSession returns the active session for a chat, or nil.
func (c *Client) GetSession(chatID string) *Session {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.sessions[chatID]
}

// CloseSession releases and removes a chat's session.
func (c *Client) CloseSession(ctx context.Context, chatID string) error {
	c.mu.Lock()
	sess, ok := c.sessions[chatID]
	if ok {
		delete(c.sessions, chatID)
	}
	c.mu.Unlock()

	if !ok {
		return fmt.Errorf("no active Steel session for this chat")
	}
	return c.Release(ctx, sess.ID)
}

// ConnectURL returns the WebSocket CDP URL for a session.
func (c *Client) ConnectURL(sessionID string) string {
	return fmt.Sprintf("%s?apiKey=%s&sessionId=%s", connectWSS, c.apiKey, sessionID)
}

// FormatSession formats a session for display.
func FormatSession(sess *Session) string {
	if sess == nil {
		return "No active Steel session."
	}
	viewer := sess.SessionViewerURL
	if viewer == "" {
		viewer = "(not available)"
	}
	debug := sess.DebugURL
	if debug == "" {
		debug = "(not available)"
	}
	age := time.Since(sess.CreatedAt).Round(time.Second)
	return fmt.Sprintf("🔩 **Steel Session**\n\n"+
		"ID: `%s`\n"+
		"Status: %s\n"+
		"Region: %s\n"+
		"Live View: %s\n"+
		"Debug: %s\n"+
		"Uptime: %s",
		sess.ID, sess.Status, sess.Region, viewer, debug, age)
}
