package e2b

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"
)

// BrowserAgent orchestrates autonomous computer use within an E2B Desktop Sandbox.
// It combines vision LLM analysis of screenshots with tool execution (click, type,
// shell commands) to accomplish user objectives — modeled after open-computer-use.
type BrowserAgent struct {
	desktop *DesktopClient

	mu       sync.Mutex
	sessions map[string]*AgentSession // chatID → running agent
}

// AgentSession tracks an active browser agent controlling a desktop sandbox.
type AgentSession struct {
	Desktop    *DesktopSandbox `json:"desktop"`
	Objective  string          `json:"objective"`
	Status     string          `json:"status"` // "running", "paused", "completed", "failed"
	StepCount  int             `json:"stepCount"`
	MaxSteps   int             `json:"maxSteps"`
	Messages   []AgentMessage  `json:"messages"`
	StartedAt  time.Time       `json:"startedAt"`
	LastStepAt time.Time       `json:"lastStepAt"`
}

// AgentMessage represents a message in the agent's conversation history.
type AgentMessage struct {
	Role      string `json:"role"` // "user", "assistant", "observation", "action", "thought"
	Content   string `json:"content"`
	ImageB64  string `json:"image_b64,omitempty"`
	Timestamp int64  `json:"timestamp"`
}

// AgentStepResult represents the outcome of a single agent step.
type AgentStepResult struct {
	StepNumber int            `json:"stepNumber"`
	Thought    string         `json:"thought"`
	Action     *DesktopAction `json:"action,omitempty"`
	Result     string         `json:"result"`
	Screenshot string         `json:"screenshotB64,omitempty"`
	Done       bool           `json:"done"`
	Error      string         `json:"error,omitempty"`
}

// AgentTool defines an action the browser agent can take.
type AgentTool struct {
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Parameters  map[string]string `json:"parameters"`
}

// AvailableTools returns the set of tools the browser agent can invoke.
func AvailableTools() []AgentTool {
	return []AgentTool{
		{Name: "click", Description: "Click on a UI element at coordinates", Parameters: map[string]string{"x": "X coordinate", "y": "Y coordinate"}},
		{Name: "double_click", Description: "Double-click on a UI element", Parameters: map[string]string{"x": "X coordinate", "y": "Y coordinate"}},
		{Name: "right_click", Description: "Right-click on a UI element", Parameters: map[string]string{"x": "X coordinate", "y": "Y coordinate"}},
		{Name: "type_text", Description: "Type text into the active input", Parameters: map[string]string{"text": "Text to type"}},
		{Name: "send_key", Description: "Send a key or key combination", Parameters: map[string]string{"key": "Key name (e.g. Return, ctrl+c, alt+F4)"}},
		{Name: "run_command", Description: "Run a shell command", Parameters: map[string]string{"command": "Shell command to execute"}},
		{Name: "open_browser", Description: "Open a browser and navigate to URL", Parameters: map[string]string{"url": "URL to navigate to"}},
		{Name: "scroll", Description: "Scroll the mouse wheel", Parameters: map[string]string{"x": "X coordinate", "y": "Y coordinate", "clicks": "Scroll amount (positive=down, negative=up)"}},
		{Name: "screenshot", Description: "Take a screenshot of the current screen", Parameters: map[string]string{}},
		{Name: "stop", Description: "Indicate the task is complete", Parameters: map[string]string{}},
	}
}

// NewBrowserAgent creates a browser agent backed by a DesktopClient.
func NewBrowserAgent(desktop *DesktopClient) *BrowserAgent {
	if desktop == nil {
		return nil
	}
	return &BrowserAgent{
		desktop:  desktop,
		sessions: make(map[string]*AgentSession),
	}
}

// StartSession creates a new agent session for a chat with an objective.
func (ba *BrowserAgent) StartSession(ctx context.Context, chatID, objective string, maxSteps int) (*AgentSession, error) {
	if maxSteps <= 0 {
		maxSteps = 30
	}

	desktop, created, err := ba.desktop.GetOrCreateDesktop(ctx, chatID)
	if err != nil {
		return nil, fmt.Errorf("browser agent: desktop creation failed: %w", err)
	}

	if created {
		log.Printf("[BROWSER-AGENT] 🚀 New desktop sandbox for chat %s: %s", chatID, desktop.SandboxID)
	}

	session := &AgentSession{
		Desktop:   desktop,
		Objective: objective,
		Status:    "running",
		MaxSteps:  maxSteps,
		Messages: []AgentMessage{
			{Role: "user", Content: fmt.Sprintf("OBJECTIVE: %s", objective), Timestamp: time.Now().Unix()},
		},
		StartedAt:  time.Now(),
		LastStepAt: time.Now(),
	}

	ba.mu.Lock()
	ba.sessions[chatID] = session
	ba.mu.Unlock()

	return session, nil
}

// GetSession returns the active agent session for a chat.
func (ba *BrowserAgent) GetSession(chatID string) *AgentSession {
	ba.mu.Lock()
	defer ba.mu.Unlock()
	return ba.sessions[chatID]
}

// StopSession stops an active agent session.
func (ba *BrowserAgent) StopSession(chatID string) {
	ba.mu.Lock()
	if sess, ok := ba.sessions[chatID]; ok {
		sess.Status = "paused"
	}
	ba.mu.Unlock()
}

// CloseSession stops and removes an agent session, killing the desktop.
func (ba *BrowserAgent) CloseSession(ctx context.Context, chatID string) error {
	ba.mu.Lock()
	delete(ba.sessions, chatID)
	ba.mu.Unlock()
	return ba.desktop.CloseDesktop(ctx, chatID)
}

// ExecuteAction runs a single action on the desktop sandbox.
func (ba *BrowserAgent) ExecuteAction(ctx context.Context, session *AgentSession, action DesktopAction) (string, error) {
	sandboxID := session.Desktop.SandboxID
	params := action.Parameters

	switch action.Name {
	case "click":
		x, y := parseCoords(params["x"], params["y"])
		if err := ba.desktop.Click(ctx, sandboxID, x, y); err != nil {
			return "", err
		}
		return fmt.Sprintf("Clicked at (%d, %d)", x, y), nil

	case "double_click":
		x, y := parseCoords(params["x"], params["y"])
		if err := ba.desktop.DoubleClick(ctx, sandboxID, x, y); err != nil {
			return "", err
		}
		return fmt.Sprintf("Double-clicked at (%d, %d)", x, y), nil

	case "right_click":
		x, y := parseCoords(params["x"], params["y"])
		if err := ba.desktop.RightClick(ctx, sandboxID, x, y); err != nil {
			return "", err
		}
		return fmt.Sprintf("Right-clicked at (%d, %d)", x, y), nil

	case "type_text":
		text := params["text"]
		if err := ba.desktop.TypeText(ctx, sandboxID, text); err != nil {
			return "", err
		}
		return fmt.Sprintf("Typed: %q", truncate(text, 80)), nil

	case "send_key":
		key := params["key"]
		if err := ba.desktop.SendKey(ctx, sandboxID, key); err != nil {
			return "", err
		}
		return fmt.Sprintf("Sent key: %s", key), nil

	case "run_command":
		command := params["command"]
		result, err := ba.desktop.RunShell(ctx, sandboxID, command)
		if err != nil {
			return "", err
		}
		return FormatResult(result), nil

	case "open_browser":
		url := params["url"]
		if err := ba.desktop.OpenBrowser(ctx, sandboxID, url); err != nil {
			return "", err
		}
		return fmt.Sprintf("Opened browser: %s", url), nil

	case "scroll":
		x, y := parseCoords(params["x"], params["y"])
		clicks := parseInt(params["clicks"], 3)
		if err := ba.desktop.Scroll(ctx, sandboxID, x, y, clicks); err != nil {
			return "", err
		}
		return fmt.Sprintf("Scrolled at (%d, %d) by %d", x, y, clicks), nil

	case "screenshot":
		_, err := ba.desktop.Screenshot(ctx, sandboxID)
		if err != nil {
			return "", err
		}
		return "Screenshot captured", nil

	case "stop":
		session.Status = "completed"
		return "Task marked as complete", nil

	default:
		return "", fmt.Errorf("unknown action: %s", action.Name)
	}
}

// TakeScreenshot captures the current desktop state and returns it as base64.
func (ba *BrowserAgent) TakeScreenshot(ctx context.Context, session *AgentSession) (*ScreenshotResult, error) {
	return ba.desktop.Screenshot(ctx, session.Desktop.SandboxID)
}

// BuildVisionPrompt creates the prompt for the vision LLM to analyze a screenshot.
func BuildVisionPrompt(objective string, screenshotB64 string) string {
	return fmt.Sprintf(`You are an AI assistant with computer use abilities. You are controlling a Linux desktop.

OBJECTIVE: %s

This image shows the current display of the computer. Please respond in the following format:
The objective is: [put the objective here]
On the screen, I see: [an extensive list of everything relevant to the objective including windows, icons, menus, apps, and UI elements]
This means the objective is: [complete|not complete]

(Only continue if the objective is not complete.)
The next step is to [click|type|run the shell command] [put the next single step here] in order to [put what you expect to happen here].`, objective)
}

// BuildActionPrompt creates the prompt for the action LLM to select a tool call.
func BuildActionPrompt(thought string) string {
	var toolDesc strings.Builder
	for _, t := range AvailableTools() {
		paramStr := ""
		for k, v := range t.Parameters {
			if paramStr != "" {
				paramStr += ", "
			}
			paramStr += fmt.Sprintf("%s: %s", k, v)
		}
		toolDesc.WriteString(fmt.Sprintf("- %s(%s): %s\n", t.Name, paramStr, t.Description))
	}

	return fmt.Sprintf(`Based on this analysis, select the best action to take.

Available actions:
%s
Analysis:
%s

Respond with a JSON object: {"name": "<action_name>", "parameters": {"key": "value"}}
If the objective is complete, respond with: {"name": "stop", "parameters": {}}`, toolDesc.String(), thought)
}

// FormatSessionStatus formats an agent session for display.
func FormatSessionStatus(sess *AgentSession) string {
	if sess == nil {
		return "No active browser agent session."
	}
	duration := time.Since(sess.StartedAt).Round(time.Second)
	return fmt.Sprintf("🖥️ **Browser Agent**\n\n"+
		"Status: %s\n"+
		"Objective: %s\n"+
		"Steps: %d/%d\n"+
		"Desktop: `%s`\n"+
		"Stream: %s\n"+
		"Duration: %s",
		sess.Status, sess.Objective, sess.StepCount, sess.MaxSteps,
		sess.Desktop.SandboxID, sess.Desktop.StreamURL, duration)
}

// parseCoords parses x,y coordinate strings to ints.
func parseCoords(xStr, yStr string) (int, int) {
	return parseInt(xStr, 0), parseInt(yStr, 0)
}

// ParseIntDefault parses a string to int with a default fallback. Exported for daemon handlers.
func ParseIntDefault(s string, def int) int {
	return parseInt(s, def)
}

// parseInt parses a string to int with a default fallback.
func parseInt(s string, def int) int {
	s = strings.TrimSpace(s)
	if s == "" {
		return def
	}
	var v int
	if _, err := fmt.Sscanf(s, "%d", &v); err != nil {
		return def
	}
	return v
}

// truncate shortens a string to maxLen with ellipsis.
func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
