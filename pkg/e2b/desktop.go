package e2b

import (
	"bytes"
	"context"
	"encoding/base64"
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
	desktopTemplate    = "desktop"
	desktopAPIBase     = "https://api.e2b.dev"
	defaultScreenW     = 1024
	defaultScreenH     = 768
	defaultTypingDelay = 12
)

// DesktopSandbox represents an E2B Desktop Sandbox with full computer-use capabilities:
// screenshots, mouse control, keyboard input, shell commands, and live streaming.
type DesktopSandbox struct {
	SandboxID string    `json:"sandboxID"`
	Template  string    `json:"templateID"`
	ClientID  string    `json:"clientID"`
	ChatID    string    `json:"-"`
	StreamURL string    `json:"streamURL,omitempty"`
	ScreenW   int       `json:"screenWidth"`
	ScreenH   int       `json:"screenHeight"`
	CreatedAt time.Time `json:"createdAt"`
}

// DesktopAction represents an action the agent can perform on the desktop.
type DesktopAction struct {
	Name       string            `json:"name"`
	Parameters map[string]string `json:"parameters,omitempty"`
}

// ScreenshotResult holds a screenshot from the desktop sandbox.
type ScreenshotResult struct {
	Data      []byte `json:"-"`
	Base64    string `json:"base64,omitempty"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	Format    string `json:"format"`
	Timestamp int64  `json:"timestamp"`
}

// DesktopClient extends Client with desktop sandbox capabilities.
type DesktopClient struct {
	apiKey     string
	httpClient *http.Client

	mu       sync.Mutex
	desktops map[string]*DesktopSandbox // chatID → desktop session
}

// NewDesktopClient creates a desktop-capable E2B client.
func NewDesktopClient() *DesktopClient {
	key := strings.TrimSpace(apiKeyFromEnv())
	if key == "" {
		return nil
	}
	log.Printf("[E2B-DESKTOP] 🖥️  Desktop sandbox client initialized")
	return &DesktopClient{
		apiKey:     key,
		httpClient: &http.Client{Timeout: 120 * time.Second},
		desktops:   make(map[string]*DesktopSandbox),
	}
}

// IsConfigured returns true if the API key is present.
func (dc *DesktopClient) IsConfigured() bool {
	return dc != nil && dc.apiKey != ""
}

// CreateDesktop spins up a new E2B Desktop Sandbox with VNC streaming.
func (dc *DesktopClient) CreateDesktop(ctx context.Context, template string, screenW, screenH int) (*DesktopSandbox, error) {
	if template == "" {
		template = desktopTemplate
	}
	if screenW <= 0 {
		screenW = defaultScreenW
	}
	if screenH <= 0 {
		screenH = defaultScreenH
	}

	body := map[string]interface{}{
		"templateID": template,
		"timeout":    defaultTimeout,
	}
	data, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "POST", desktopAPIBase+"/sandboxes", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", dc.apiKey)

	resp, err := dc.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("e2b desktop create: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 201 && resp.StatusCode != 200 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("e2b desktop create: HTTP %d: %s", resp.StatusCode, string(b))
	}

	var result struct {
		SandboxID string `json:"sandboxID"`
		ClientID  string `json:"clientID"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("e2b desktop decode: %w", err)
	}

	desktop := &DesktopSandbox{
		SandboxID: result.SandboxID,
		Template:  template,
		ClientID:  result.ClientID,
		ScreenW:   screenW,
		ScreenH:   screenH,
		CreatedAt: time.Now(),
	}

	// Start VNC streaming in the sandbox
	streamURL, err := dc.startStream(ctx, desktop)
	if err != nil {
		log.Printf("[E2B-DESKTOP] ⚠️ Stream start failed (non-fatal): %v", err)
	} else {
		desktop.StreamURL = streamURL
	}

	log.Printf("[E2B-DESKTOP] 🚀 Desktop sandbox created: %s (template: %s, stream: %s)", desktop.SandboxID, template, desktop.StreamURL)
	return desktop, nil
}

// startStream starts ffmpeg x11grab streaming inside the sandbox.
func (dc *DesktopClient) startStream(ctx context.Context, desktop *DesktopSandbox) (string, error) {
	cmd := fmt.Sprintf(
		"ffmpeg -f x11grab -s %dx%d -framerate 30 -i :0 -vcodec libx264 -preset ultrafast -tune zerolatency -f mpegts -listen 1 http://localhost:8080",
		desktop.ScreenW, desktop.ScreenH,
	)
	_, err := dc.RunShell(ctx, desktop.SandboxID, cmd+" &")
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("https://%s-8080.e2b.dev", desktop.SandboxID), nil
}

// Screenshot captures the current desktop display.
func (dc *DesktopClient) Screenshot(ctx context.Context, sandboxID string) (*ScreenshotResult, error) {
	url := fmt.Sprintf("%s/sandboxes/%s/screenshot", desktopAPIBase, sandboxID)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-API-Key", dc.apiKey)

	resp, err := dc.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("e2b screenshot: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		// Fallback: use scrot via shell
		return dc.screenshotViaShell(ctx, sandboxID)
	}

	var result struct {
		Base64 string `json:"base64"`
		Width  int    `json:"width"`
		Height int    `json:"height"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return dc.screenshotViaShell(ctx, sandboxID)
	}

	imgData, err := base64.StdEncoding.DecodeString(result.Base64)
	if err != nil {
		return nil, fmt.Errorf("e2b screenshot decode: %w", err)
	}

	return &ScreenshotResult{
		Data:      imgData,
		Base64:    result.Base64,
		Width:     result.Width,
		Height:    result.Height,
		Format:    "png",
		Timestamp: time.Now().Unix(),
	}, nil
}

// screenshotViaShell falls back to capturing via scrot/import command.
func (dc *DesktopClient) screenshotViaShell(ctx context.Context, sandboxID string) (*ScreenshotResult, error) {
	// Use import (ImageMagick) to capture the screen
	_, err := dc.RunShell(ctx, sandboxID, "import -window root /tmp/screenshot.png")
	if err != nil {
		// Try scrot as alternative
		_, err = dc.RunShell(ctx, sandboxID, "scrot /tmp/screenshot.png --overwrite")
		if err != nil {
			return nil, fmt.Errorf("screenshot capture failed: %w", err)
		}
	}

	// Read the file via base64
	result, err := dc.RunShell(ctx, sandboxID, "base64 -w0 /tmp/screenshot.png")
	if err != nil {
		return nil, fmt.Errorf("screenshot read failed: %w", err)
	}

	imgData, err := base64.StdEncoding.DecodeString(strings.TrimSpace(result.Stdout))
	if err != nil {
		return nil, fmt.Errorf("screenshot decode: %w", err)
	}

	return &ScreenshotResult{
		Data:      imgData,
		Base64:    strings.TrimSpace(result.Stdout),
		Format:    "png",
		Timestamp: time.Now().Unix(),
	}, nil
}

// Click performs a mouse click at screen coordinates.
func (dc *DesktopClient) Click(ctx context.Context, sandboxID string, x, y int) error {
	cmd := fmt.Sprintf("xdotool mousemove %d %d click 1", x, y)
	_, err := dc.RunShell(ctx, sandboxID, cmd)
	return err
}

// DoubleClick performs a double-click at screen coordinates.
func (dc *DesktopClient) DoubleClick(ctx context.Context, sandboxID string, x, y int) error {
	cmd := fmt.Sprintf("xdotool mousemove %d %d click --repeat 2 1", x, y)
	_, err := dc.RunShell(ctx, sandboxID, cmd)
	return err
}

// RightClick performs a right-click at screen coordinates.
func (dc *DesktopClient) RightClick(ctx context.Context, sandboxID string, x, y int) error {
	cmd := fmt.Sprintf("xdotool mousemove %d %d click 3", x, y)
	_, err := dc.RunShell(ctx, sandboxID, cmd)
	return err
}

// MoveMouse moves the cursor to screen coordinates.
func (dc *DesktopClient) MoveMouse(ctx context.Context, sandboxID string, x, y int) error {
	cmd := fmt.Sprintf("xdotool mousemove %d %d", x, y)
	_, err := dc.RunShell(ctx, sandboxID, cmd)
	return err
}

// TypeText types text into the active window.
func (dc *DesktopClient) TypeText(ctx context.Context, sandboxID, text string) error {
	// Use xdotool type with delay to simulate natural typing
	cmd := fmt.Sprintf("xdotool type --delay %d -- %q", defaultTypingDelay, text)
	_, err := dc.RunShell(ctx, sandboxID, cmd)
	return err
}

// SendKey sends a key or key combination (e.g. "Return", "ctrl+c", "alt+F4").
func (dc *DesktopClient) SendKey(ctx context.Context, sandboxID, key string) error {
	cmd := fmt.Sprintf("xdotool key %s", key)
	_, err := dc.RunShell(ctx, sandboxID, cmd)
	return err
}

// Scroll scrolls the mouse wheel at current position.
func (dc *DesktopClient) Scroll(ctx context.Context, sandboxID string, x, y, clicks int) error {
	dir := "5" // down
	if clicks < 0 {
		dir = "4" // up
		clicks = -clicks
	}
	cmd := fmt.Sprintf("xdotool mousemove %d %d && xdotool click --repeat %d %s", x, y, clicks, dir)
	_, err := dc.RunShell(ctx, sandboxID, cmd)
	return err
}

// RunShell executes a shell command in the desktop sandbox.
func (dc *DesktopClient) RunShell(ctx context.Context, sandboxID, command string) (*ExecResult, error) {
	body := map[string]interface{}{
		"cmd": command,
	}
	data, _ := json.Marshal(body)

	url := fmt.Sprintf("%s/sandboxes/%s/commands", desktopAPIBase, sandboxID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", dc.apiKey)

	resp, err := dc.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("e2b desktop shell: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("e2b desktop shell: HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Stdout   string `json:"stdout"`
		Stderr   string `json:"stderr"`
		ExitCode int    `json:"exitCode"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("e2b desktop decode: %w", err)
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

// OpenBrowser opens a browser in the desktop sandbox and navigates to a URL.
func (dc *DesktopClient) OpenBrowser(ctx context.Context, sandboxID, url string) error {
	cmd := fmt.Sprintf("DISPLAY=:0 firefox %q &", url)
	_, err := dc.RunShell(ctx, sandboxID, cmd)
	if err != nil {
		// Try chromium as fallback
		cmd = fmt.Sprintf("DISPLAY=:0 chromium-browser --no-sandbox %q &", url)
		_, err = dc.RunShell(ctx, sandboxID, cmd)
	}
	return err
}

// KillDesktop terminates a desktop sandbox.
func (dc *DesktopClient) KillDesktop(ctx context.Context, sandboxID string) error {
	url := fmt.Sprintf("%s/sandboxes/%s", desktopAPIBase, sandboxID)
	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("X-API-Key", dc.apiKey)

	resp, err := dc.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("e2b desktop kill: %w", err)
	}
	resp.Body.Close()
	log.Printf("[E2B-DESKTOP] 🗑️  Desktop sandbox killed: %s", sandboxID)
	return nil
}

// --- Session management per chat ---

// GetOrCreateDesktop returns the active desktop sandbox for a chat, creating one if needed.
func (dc *DesktopClient) GetOrCreateDesktop(ctx context.Context, chatID string) (*DesktopSandbox, bool, error) {
	dc.mu.Lock()
	if desktop, ok := dc.desktops[chatID]; ok {
		dc.mu.Unlock()
		return desktop, false, nil
	}
	dc.mu.Unlock()

	desktop, err := dc.CreateDesktop(ctx, "", 0, 0)
	if err != nil {
		return nil, false, err
	}
	desktop.ChatID = chatID

	dc.mu.Lock()
	dc.desktops[chatID] = desktop
	dc.mu.Unlock()

	return desktop, true, nil
}

// GetDesktop returns the active desktop sandbox for a chat, or nil.
func (dc *DesktopClient) GetDesktop(chatID string) *DesktopSandbox {
	dc.mu.Lock()
	defer dc.mu.Unlock()
	return dc.desktops[chatID]
}

// CloseDesktop kills and removes a chat's desktop sandbox.
func (dc *DesktopClient) CloseDesktop(ctx context.Context, chatID string) error {
	dc.mu.Lock()
	desktop, ok := dc.desktops[chatID]
	if ok {
		delete(dc.desktops, chatID)
	}
	dc.mu.Unlock()

	if !ok {
		return fmt.Errorf("no active desktop sandbox for this chat")
	}
	return dc.KillDesktop(ctx, desktop.SandboxID)
}

// KeepAlive extends the timeout for a desktop sandbox.
func (dc *DesktopClient) KeepAlive(ctx context.Context, sandboxID string, timeoutSec int) error {
	if timeoutSec <= 0 {
		timeoutSec = defaultTimeout
	}

	body := map[string]interface{}{
		"timeout": timeoutSec,
	}
	data, _ := json.Marshal(body)

	url := fmt.Sprintf("%s/sandboxes/%s/timeout", desktopAPIBase, sandboxID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", dc.apiKey)

	resp, err := dc.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("e2b keepalive: %w", err)
	}
	resp.Body.Close()
	return nil
}

// apiKeyFromEnv reads E2B_API_KEY from environment.
func apiKeyFromEnv() string {
	for _, key := range []string{"E2B_API_KEY", "E2B_DESKTOP_API_KEY"} {
		if v := strings.TrimSpace(os.Getenv(key)); v != "" {
			return v
		}
	}
	return ""
}
