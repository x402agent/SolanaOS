package daemon

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/bus"
	e2bpkg "github.com/x402agent/Solana-Os-Go/pkg/e2b"
)

// ─── /desktop ────────────────────────────────────────────────────────────────

func (d *Daemon) desktopResponse(msg bus.InboundMessage, args []string) string {
	if d.e2bDesktop == nil || !d.e2bDesktop.IsConfigured() {
		return "❌ E2B Desktop is not configured. Set `E2B_API_KEY` in your .env file."
	}

	chatID := d.e2bChatID(msg)

	if len(args) == 0 {
		desktop := d.e2bDesktop.GetDesktop(chatID)
		if desktop == nil {
			return "🖥️ **E2B Desktop Sandbox**\n\nNo active desktop for this chat.\n\n" +
				"Commands:\n" +
				"• `/desktop new` — spin up a desktop sandbox\n" +
				"• `/desktop browse <url>` — open browser in desktop\n" +
				"• `/desktop screenshot` — capture screen\n" +
				"• `/desktop click <x> <y>` — click at coordinates\n" +
				"• `/desktop type <text>` — type text\n" +
				"• `/desktop key <key>` — send key (e.g. Return, ctrl+c)\n" +
				"• `/desktop shell <cmd>` — run shell command\n" +
				"• `/desktop kill` — terminate desktop"
		}
		age := time.Since(desktop.CreatedAt).Round(time.Second)
		stream := desktop.StreamURL
		if stream == "" {
			stream = "(no stream)"
		}
		return fmt.Sprintf("🖥️ **Desktop Sandbox Active**\n\n"+
			"ID: `%s`\n"+
			"Screen: %dx%d\n"+
			"Stream: %s\n"+
			"Uptime: %s",
			desktop.SandboxID, desktop.ScreenW, desktop.ScreenH, stream, age)
	}

	sub := strings.ToLower(args[0])
	switch sub {
	case "new", "create", "start":
		return d.desktopNewResponse(chatID)

	case "kill", "stop", "destroy":
		return d.desktopKillResponse(chatID)

	case "screenshot", "ss", "snap":
		return d.desktopScreenshotResponse(chatID)

	case "click":
		if len(args) < 3 {
			return "Usage: `/desktop click <x> <y>`"
		}
		return d.desktopClickResponse(chatID, args[1], args[2])

	case "double_click", "dblclick":
		if len(args) < 3 {
			return "Usage: `/desktop double_click <x> <y>`"
		}
		return d.desktopDoubleClickResponse(chatID, args[1], args[2])

	case "right_click", "rclick":
		if len(args) < 3 {
			return "Usage: `/desktop right_click <x> <y>`"
		}
		return d.desktopRightClickResponse(chatID, args[1], args[2])

	case "type", "text":
		if len(args) < 2 {
			return "Usage: `/desktop type <text>`"
		}
		text := strings.Join(args[1:], " ")
		return d.desktopTypeResponse(chatID, text)

	case "key", "press":
		if len(args) < 2 {
			return "Usage: `/desktop key <key>` (e.g. Return, ctrl+c, alt+F4)"
		}
		return d.desktopKeyResponse(chatID, args[1])

	case "browse", "browser", "open":
		if len(args) < 2 {
			return "Usage: `/desktop browse <url>`"
		}
		return d.desktopBrowseResponse(chatID, args[1])

	case "shell", "cmd", "exec":
		if len(args) < 2 {
			return "Usage: `/desktop shell <command>`"
		}
		command := strings.Join(args[1:], " ")
		return d.desktopShellResponse(chatID, command)

	case "scroll":
		if len(args) < 4 {
			return "Usage: `/desktop scroll <x> <y> <clicks>` (positive=down, negative=up)"
		}
		return d.desktopScrollResponse(chatID, args[1], args[2], args[3])

	case "agent":
		if len(args) < 2 {
			return "Usage: `/desktop agent <objective>` — start autonomous browser agent"
		}
		objective := strings.Join(args[1:], " ")
		return d.desktopAgentResponse(msg, chatID, objective)

	default:
		// Treat as shell command
		command := strings.Join(args, " ")
		return d.desktopShellResponse(chatID, command)
	}
}

func (d *Daemon) desktopNewResponse(chatID string) string {
	ctx, cancel := context.WithTimeout(d.ctx, 60*time.Second)
	defer cancel()

	desktop, created, err := d.e2bDesktop.GetOrCreateDesktop(ctx, chatID)
	if err != nil {
		log.Printf("[E2B-DESKTOP] create error: %v", err)
		return fmt.Sprintf("❌ Failed to create desktop: %v", err)
	}
	if !created {
		return fmt.Sprintf("🖥️ Desktop already running: `%s`\nUse `/desktop kill` first to create a new one.", desktop.SandboxID)
	}
	stream := desktop.StreamURL
	if stream == "" {
		stream = "(stream not available)"
	}
	return fmt.Sprintf("🚀 **Desktop Sandbox Created**\n\n"+
		"ID: `%s`\n"+
		"Screen: %dx%d\n"+
		"Stream: %s\n\n"+
		"Ready for `/desktop browse`, `/desktop screenshot`, `/desktop click`, etc.",
		desktop.SandboxID, desktop.ScreenW, desktop.ScreenH, stream)
}

func (d *Daemon) desktopKillResponse(chatID string) string {
	ctx, cancel := context.WithTimeout(d.ctx, 15*time.Second)
	defer cancel()

	if err := d.e2bDesktop.CloseDesktop(ctx, chatID); err != nil {
		return fmt.Sprintf("⚠️ %v", err)
	}
	// Also close any browser agent session
	if d.browserAgent != nil {
		d.browserAgent.StopSession(chatID)
	}
	return "🗑️ Desktop sandbox terminated."
}

func (d *Daemon) desktopScreenshotResponse(chatID string) string {
	desktop := d.e2bDesktop.GetDesktop(chatID)
	if desktop == nil {
		return "❌ No active desktop. Use `/desktop new` first."
	}

	ctx, cancel := context.WithTimeout(d.ctx, 30*time.Second)
	defer cancel()

	ss, err := d.e2bDesktop.Screenshot(ctx, desktop.SandboxID)
	if err != nil {
		return fmt.Sprintf("❌ Screenshot failed: %v", err)
	}

	return fmt.Sprintf("📸 **Screenshot Captured**\n\n"+
		"Size: %d bytes\n"+
		"Format: %s\n"+
		"Timestamp: %d\n\n"+
		"_Screenshot data available (base64, %d chars)_",
		len(ss.Data), ss.Format, ss.Timestamp, len(ss.Base64))
}

func (d *Daemon) desktopClickResponse(chatID, xStr, yStr string) string {
	desktop := d.e2bDesktop.GetDesktop(chatID)
	if desktop == nil {
		return "❌ No active desktop. Use `/desktop new` first."
	}

	x, y := parseIntPair(xStr, yStr)
	ctx, cancel := context.WithTimeout(d.ctx, 10*time.Second)
	defer cancel()

	if err := d.e2bDesktop.Click(ctx, desktop.SandboxID, x, y); err != nil {
		return fmt.Sprintf("❌ Click failed: %v", err)
	}
	return fmt.Sprintf("🖱️ Clicked at (%d, %d)", x, y)
}

func (d *Daemon) desktopDoubleClickResponse(chatID, xStr, yStr string) string {
	desktop := d.e2bDesktop.GetDesktop(chatID)
	if desktop == nil {
		return "❌ No active desktop. Use `/desktop new` first."
	}

	x, y := parseIntPair(xStr, yStr)
	ctx, cancel := context.WithTimeout(d.ctx, 10*time.Second)
	defer cancel()

	if err := d.e2bDesktop.DoubleClick(ctx, desktop.SandboxID, x, y); err != nil {
		return fmt.Sprintf("❌ Double-click failed: %v", err)
	}
	return fmt.Sprintf("🖱️ Double-clicked at (%d, %d)", x, y)
}

func (d *Daemon) desktopRightClickResponse(chatID, xStr, yStr string) string {
	desktop := d.e2bDesktop.GetDesktop(chatID)
	if desktop == nil {
		return "❌ No active desktop. Use `/desktop new` first."
	}

	x, y := parseIntPair(xStr, yStr)
	ctx, cancel := context.WithTimeout(d.ctx, 10*time.Second)
	defer cancel()

	if err := d.e2bDesktop.RightClick(ctx, desktop.SandboxID, x, y); err != nil {
		return fmt.Sprintf("❌ Right-click failed: %v", err)
	}
	return fmt.Sprintf("🖱️ Right-clicked at (%d, %d)", x, y)
}

func (d *Daemon) desktopTypeResponse(chatID, text string) string {
	desktop := d.e2bDesktop.GetDesktop(chatID)
	if desktop == nil {
		return "❌ No active desktop. Use `/desktop new` first."
	}

	ctx, cancel := context.WithTimeout(d.ctx, 30*time.Second)
	defer cancel()

	if err := d.e2bDesktop.TypeText(ctx, desktop.SandboxID, text); err != nil {
		return fmt.Sprintf("❌ Typing failed: %v", err)
	}
	preview := text
	if len(preview) > 80 {
		preview = preview[:77] + "..."
	}
	return fmt.Sprintf("⌨️ Typed: %q", preview)
}

func (d *Daemon) desktopKeyResponse(chatID, key string) string {
	desktop := d.e2bDesktop.GetDesktop(chatID)
	if desktop == nil {
		return "❌ No active desktop. Use `/desktop new` first."
	}

	ctx, cancel := context.WithTimeout(d.ctx, 10*time.Second)
	defer cancel()

	if err := d.e2bDesktop.SendKey(ctx, desktop.SandboxID, key); err != nil {
		return fmt.Sprintf("❌ Key press failed: %v", err)
	}
	return fmt.Sprintf("⌨️ Sent key: `%s`", key)
}

func (d *Daemon) desktopBrowseResponse(chatID, url string) string {
	ctx, cancel := context.WithTimeout(d.ctx, 30*time.Second)
	defer cancel()

	desktop, created, err := d.e2bDesktop.GetOrCreateDesktop(ctx, chatID)
	if err != nil {
		return fmt.Sprintf("❌ Desktop error: %v", err)
	}

	prefix := ""
	if created {
		prefix = "🚀 New desktop created.\n\n"
	}

	if err := d.e2bDesktop.OpenBrowser(ctx, desktop.SandboxID, url); err != nil {
		return fmt.Sprintf("%s❌ Failed to open browser: %v", prefix, err)
	}

	return fmt.Sprintf("%s🌐 Browser opened: %s\n\nUse `/desktop screenshot` to see the page.", prefix, url)
}

func (d *Daemon) desktopShellResponse(chatID, command string) string {
	ctx, cancel := context.WithTimeout(d.ctx, 60*time.Second)
	defer cancel()

	desktop, created, err := d.e2bDesktop.GetOrCreateDesktop(ctx, chatID)
	if err != nil {
		return fmt.Sprintf("❌ Desktop error: %v", err)
	}

	prefix := ""
	if created {
		prefix = "🚀 New desktop created.\n\n"
	}

	result, err := d.e2bDesktop.RunShell(ctx, desktop.SandboxID, command)
	if err != nil {
		return fmt.Sprintf("%s❌ Command failed: %v", prefix, err)
	}

	output := e2bpkg.FormatResult(result)
	cmdPreview := command
	if len(cmdPreview) > 60 {
		cmdPreview = cmdPreview[:57] + "..."
	}
	return fmt.Sprintf("%s🖥️ **Shell** `%s`\n\n```\n%s\n```", prefix, cmdPreview, output)
}

func (d *Daemon) desktopScrollResponse(chatID, xStr, yStr, clicksStr string) string {
	desktop := d.e2bDesktop.GetDesktop(chatID)
	if desktop == nil {
		return "❌ No active desktop. Use `/desktop new` first."
	}

	x, y := parseIntPair(xStr, yStr)
	clicks := e2bpkg.ParseIntDefault(clicksStr, 3)

	ctx, cancel := context.WithTimeout(d.ctx, 10*time.Second)
	defer cancel()

	if err := d.e2bDesktop.Scroll(ctx, desktop.SandboxID, x, y, clicks); err != nil {
		return fmt.Sprintf("❌ Scroll failed: %v", err)
	}
	return fmt.Sprintf("🖱️ Scrolled at (%d, %d) by %d", x, y, clicks)
}

func (d *Daemon) desktopAgentResponse(msg bus.InboundMessage, chatID, objective string) string {
	if d.browserAgent == nil {
		return "❌ Browser agent is not initialized. Ensure E2B_API_KEY is configured."
	}

	// Check for existing session
	existing := d.browserAgent.GetSession(chatID)
	if existing != nil && existing.Status == "running" {
		return e2bpkg.FormatSessionStatus(existing) + "\n\n⚠️ Agent already running. Use `/desktop kill` to stop."
	}

	ctx, cancel := context.WithTimeout(d.ctx, 120*time.Second)
	defer cancel()

	session, err := d.browserAgent.StartSession(ctx, chatID, objective, 30)
	if err != nil {
		return fmt.Sprintf("❌ Agent start failed: %v", err)
	}

	return fmt.Sprintf("🤖 **Browser Agent Started**\n\n"+
		"Objective: %s\n"+
		"Desktop: `%s`\n"+
		"Stream: %s\n"+
		"Max Steps: %d\n\n"+
		"The agent will autonomously work toward the objective. Use `/desktop screenshot` to check progress.",
		session.Objective, session.Desktop.SandboxID, session.Desktop.StreamURL, session.MaxSteps)
}

// ─── Natural language desktop detection ───────────────────────────────────────

var desktopNLPatterns = []string{
	"open a browser",
	"open browser",
	"browse to",
	"navigate to",
	"take a screenshot",
	"screenshot the desktop",
	"click on",
	"spin up a desktop",
	"create a desktop",
	"start a desktop",
	"launch a desktop",
}

// maybeHandleDesktopText detects natural language desktop requests.
func (d *Daemon) maybeHandleDesktopText(msg bus.InboundMessage, content string) (string, bool) {
	if d.e2bDesktop == nil || !d.e2bDesktop.IsConfigured() {
		return "", false
	}
	lower := strings.ToLower(content)

	for _, pat := range desktopNLPatterns {
		if strings.Contains(lower, pat) {
			chatID := d.e2bChatID(msg)

			if strings.Contains(lower, "screenshot") {
				return d.desktopScreenshotResponse(chatID), true
			}
			if strings.Contains(lower, "browser") || strings.Contains(lower, "browse") || strings.Contains(lower, "navigate") {
				// Extract URL if present
				words := strings.Fields(content)
				for _, w := range words {
					if strings.HasPrefix(w, "http://") || strings.HasPrefix(w, "https://") {
						return d.desktopBrowseResponse(chatID, w), true
					}
				}
				return d.desktopNewResponse(chatID), true
			}
			if strings.Contains(lower, "desktop") || strings.Contains(lower, "spin up") || strings.Contains(lower, "create") || strings.Contains(lower, "launch") {
				return d.desktopNewResponse(chatID), true
			}
		}
	}

	return "", false
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func parseIntPair(xStr, yStr string) (int, int) {
	return e2bpkg.ParseIntDefault(xStr, 0), e2bpkg.ParseIntDefault(yStr, 0)
}
