package daemon

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/bus"
	"github.com/x402agent/Solana-Os-Go/pkg/steel"
)

// ─── /cua ─────────────────────────────────────────────────────────────────────

func (d *Daemon) cuaResponse(msg bus.InboundMessage, args []string) string {
	// Determine which provider is available
	steelReady := d.steel != nil && d.steel.IsConfigured()
	browserbaseReady := strings.TrimSpace(d.cfg.Tools.BrowserUse.BrowserbaseAPIKey) != ""
	browseruseReady := strings.TrimSpace(d.cfg.Tools.BrowserUse.APIKey) != ""

	if !steelReady && !browserbaseReady && !browseruseReady {
		return "❌ CUA is not configured. Set at least one of:\n" +
			"• `STEEL_API_KEY` — Steel cloud browser\n" +
			"• `BROWSERBASE_API_KEY` + `BROWSERBASE_PROJECT_ID` — Browserbase\n" +
			"• `BROWSERUSE_API_KEY` — Browser Use"
	}

	chatID := d.e2bChatID(msg)

	if len(args) == 0 {
		return d.cuaStatusResponse(chatID, steelReady, browserbaseReady, browseruseReady)
	}

	sub := strings.ToLower(args[0])
	switch sub {
	case "new", "create", "start":
		provider := "steel" // default
		for i, a := range args {
			if (a == "--provider" || a == "-p") && i+1 < len(args) {
				provider = strings.ToLower(args[i+1])
			}
		}
		return d.cuaNewResponse(chatID, provider)

	case "status", "info":
		return d.cuaStatusResponse(chatID, steelReady, browserbaseReady, browseruseReady)

	case "browse", "goto", "navigate", "open":
		if len(args) < 2 {
			return "Usage: `/cua browse <url>`"
		}
		return d.cuaBrowseResponse(msg, chatID, args[1])

	case "screenshot", "ss", "snap":
		return d.cuaScreenshotResponse(chatID)

	case "release", "kill", "stop", "close":
		all := false
		for _, a := range args {
			if a == "--all" {
				all = true
			}
		}
		if all {
			return d.cuaReleaseAllResponse()
		}
		return d.cuaReleaseResponse(chatID)

	case "list", "ls":
		return d.cuaListResponse()

	case "live", "view", "viewer":
		return d.cuaLiveViewResponse(chatID)

	case "replay":
		if len(args) < 2 {
			return "Usage: `/cua replay <session-id>`"
		}
		return d.cuaReplayResponse(args[1])

	case "agent":
		if len(args) < 2 {
			return "Usage: `/cua agent <objective>`"
		}
		objective := strings.Join(args[1:], " ")
		return d.cuaAgentResponse(msg, chatID, objective)

	default:
		return "Unknown CUA command. Use `/cua` to see available commands."
	}
}

func (d *Daemon) cuaStatusResponse(chatID string, steelReady, browserbaseReady, browseruseReady bool) string {
	var sb strings.Builder
	sb.WriteString("🤖 **Computer Use Agent**\n\n")

	sb.WriteString("**Providers:**\n")
	if steelReady {
		sb.WriteString("• ✅ Steel (STEEL_API_KEY)\n")
	} else {
		sb.WriteString("• ❌ Steel (missing STEEL_API_KEY)\n")
	}
	if browserbaseReady {
		sb.WriteString("• ✅ Browserbase (BROWSERBASE_API_KEY)\n")
	} else {
		sb.WriteString("• ❌ Browserbase\n")
	}
	if browseruseReady {
		sb.WriteString("• ✅ Browser Use (BROWSERUSE_API_KEY)\n")
	} else {
		sb.WriteString("• ❌ Browser Use\n")
	}

	// Show active Steel session for this chat
	if steelReady {
		sess := d.steel.GetSession(chatID)
		if sess != nil {
			sb.WriteString(fmt.Sprintf("\n**Active Session:** `%s`\n", sess.ID))
			if sess.SessionViewerURL != "" {
				sb.WriteString(fmt.Sprintf("Live View: %s\n", sess.SessionViewerURL))
			}
			if sess.DebugURL != "" {
				sb.WriteString(fmt.Sprintf("Debug: %s\n", sess.DebugURL))
			}
			age := time.Since(sess.CreatedAt).Round(time.Second)
			sb.WriteString(fmt.Sprintf("Uptime: %s\n", age))
		} else {
			sb.WriteString("\nNo active session for this chat.\n")
		}
	}

	sb.WriteString("\n**Commands:**\n")
	sb.WriteString("• `/cua new [--provider steel|browserbase|browseruse]`\n")
	sb.WriteString("• `/cua browse <url>`\n")
	sb.WriteString("• `/cua screenshot`\n")
	sb.WriteString("• `/cua live` — get live view URL\n")
	sb.WriteString("• `/cua release` — end session\n")
	sb.WriteString("• `/cua list` — list all sessions\n")
	sb.WriteString("• `/cua agent <objective>` — autonomous browsing\n")

	return sb.String()
}

func (d *Daemon) cuaNewResponse(chatID, provider string) string {
	switch provider {
	case "steel":
		if d.steel == nil || !d.steel.IsConfigured() {
			return "❌ Steel is not configured. Set `STEEL_API_KEY`."
		}
		ctx, cancel := context.WithTimeout(d.ctx, 30*time.Second)
		defer cancel()

		sess, created, err := d.steel.GetOrCreate(ctx, chatID, &steel.CreateOptions{
			UseProxy:     true,
			SolveCaptcha: true,
			Timeout:      600000, // 10 minutes
		})
		if err != nil {
			log.Printf("[CUA] Steel create error: %v", err)
			return fmt.Sprintf("❌ Steel session failed: %v", err)
		}
		if !created {
			return fmt.Sprintf("🔩 Steel session already active: `%s`\nUse `/cua release` to end it.", sess.ID)
		}

		var sb strings.Builder
		sb.WriteString("🚀 **Steel Session Created**\n\n")
		sb.WriteString(fmt.Sprintf("ID: `%s`\n", sess.ID))
		if sess.SessionViewerURL != "" {
			sb.WriteString(fmt.Sprintf("Live View: %s\n", sess.SessionViewerURL))
		}
		if sess.DebugURL != "" {
			sb.WriteString(fmt.Sprintf("Debug: %s?interactive=true\n", sess.DebugURL))
		}
		sb.WriteString(fmt.Sprintf("CDP: `%s`\n", sess.ConnectURL))
		sb.WriteString("\nFeatures: proxy ✅ captcha-solve ✅ recording ✅")
		return sb.String()

	case "browserbase", "bb":
		if strings.TrimSpace(d.cfg.Tools.BrowserUse.BrowserbaseAPIKey) == "" {
			return "❌ Browserbase is not configured. Set `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID`."
		}
		// Use existing browseruse provider infrastructure
		return d.desktopResponse(bus.InboundMessage{ChatID: chatID}, []string{"new"})

	case "browseruse", "bu":
		if strings.TrimSpace(d.cfg.Tools.BrowserUse.APIKey) == "" {
			return "❌ Browser Use is not configured. Set `BROWSERUSE_API_KEY`."
		}
		return d.desktopResponse(bus.InboundMessage{ChatID: chatID}, []string{"new"})

	default:
		return fmt.Sprintf("❌ Unknown provider: `%s`. Use `steel`, `browserbase`, or `browseruse`.", provider)
	}
}

func (d *Daemon) cuaBrowseResponse(msg bus.InboundMessage, chatID, targetURL string) string {
	// Prefer Steel if configured, fall back to desktop
	if d.steel != nil && d.steel.IsConfigured() {
		sess := d.steel.GetSession(chatID)
		if sess == nil {
			// Auto-create
			ctx, cancel := context.WithTimeout(d.ctx, 30*time.Second)
			defer cancel()
			var err error
			sess, _, err = d.steel.GetOrCreate(ctx, chatID, &steel.CreateOptions{
				UseProxy:     true,
				SolveCaptcha: true,
				Timeout:      600000,
			})
			if err != nil {
				return fmt.Sprintf("❌ Steel session failed: %v", err)
			}
		}

		return fmt.Sprintf("🌐 **Steel Browser Ready**\n\n"+
			"Session: `%s`\n"+
			"Navigate to: %s\n\n"+
			"Connect via Playwright:\n```\nconst browser = await chromium.connectOverCDP('%s');\nconst page = browser.contexts()[0].pages()[0];\nawait page.goto('%s');\n```\n\n"+
			"Live View: %s",
			sess.ID, targetURL, sess.ConnectURL, targetURL, sess.SessionViewerURL)
	}

	// Fall back to E2B desktop
	return d.desktopBrowseResponse(chatID, targetURL)
}

func (d *Daemon) cuaScreenshotResponse(chatID string) string {
	if d.steel != nil && d.steel.IsConfigured() {
		sess := d.steel.GetSession(chatID)
		if sess != nil {
			ctx, cancel := context.WithTimeout(d.ctx, 15*time.Second)
			defer cancel()
			data, err := d.steel.Screenshot(ctx, sess.ID)
			if err != nil {
				return fmt.Sprintf("❌ Screenshot failed: %v", err)
			}
			return fmt.Sprintf("📸 **Screenshot Captured** (%d bytes)\nSession: `%s`", len(data), sess.ID)
		}
	}

	// Fall back to desktop
	return d.desktopScreenshotResponse(chatID)
}

func (d *Daemon) cuaReleaseResponse(chatID string) string {
	if d.steel != nil && d.steel.IsConfigured() {
		sess := d.steel.GetSession(chatID)
		if sess != nil {
			ctx, cancel := context.WithTimeout(d.ctx, 15*time.Second)
			defer cancel()
			if err := d.steel.CloseSession(ctx, chatID); err != nil {
				return fmt.Sprintf("⚠️ Steel release failed: %v", err)
			}
			return fmt.Sprintf("🗑️ Steel session `%s` released.", sess.ID)
		}
	}

	// Try desktop too
	if d.e2bDesktop != nil && d.e2bDesktop.IsConfigured() {
		if desktop := d.e2bDesktop.GetDesktop(chatID); desktop != nil {
			return d.desktopKillResponse(chatID)
		}
	}

	return "⚠️ No active CUA session for this chat."
}

func (d *Daemon) cuaReleaseAllResponse() string {
	var results []string

	if d.steel != nil && d.steel.IsConfigured() {
		ctx, cancel := context.WithTimeout(d.ctx, 15*time.Second)
		defer cancel()
		if err := d.steel.ReleaseAll(ctx); err != nil {
			results = append(results, fmt.Sprintf("⚠️ Steel release-all failed: %v", err))
		} else {
			results = append(results, "✅ All Steel sessions released")
		}
	}

	if len(results) == 0 {
		return "⚠️ No providers configured to release."
	}
	return strings.Join(results, "\n")
}

func (d *Daemon) cuaListResponse() string {
	var sb strings.Builder
	sb.WriteString("🤖 **Active CUA Sessions**\n\n")

	if d.steel != nil && d.steel.IsConfigured() {
		ctx, cancel := context.WithTimeout(d.ctx, 15*time.Second)
		defer cancel()
		sessions, err := d.steel.List(ctx)
		if err != nil {
			sb.WriteString(fmt.Sprintf("⚠️ Steel list failed: %v\n", err))
		} else if len(sessions) == 0 {
			sb.WriteString("**Steel:** No active sessions\n")
		} else {
			sb.WriteString(fmt.Sprintf("**Steel** (%d):\n", len(sessions)))
			for i, s := range sessions {
				if i >= 10 {
					sb.WriteString(fmt.Sprintf("... and %d more\n", len(sessions)-10))
					break
				}
				sb.WriteString(fmt.Sprintf("• `%s` — %s (region: %s)\n", s.ID, s.Status, s.Region))
			}
		}
	}

	return sb.String()
}

func (d *Daemon) cuaLiveViewResponse(chatID string) string {
	if d.steel != nil && d.steel.IsConfigured() {
		sess := d.steel.GetSession(chatID)
		if sess != nil {
			var sb strings.Builder
			sb.WriteString("👁️ **Live View**\n\n")
			if sess.SessionViewerURL != "" {
				sb.WriteString(fmt.Sprintf("Viewer: %s\n", sess.SessionViewerURL))
			}
			if sess.DebugURL != "" {
				sb.WriteString(fmt.Sprintf("Debug (interactive): %s?interactive=true&showControls=true\n", sess.DebugURL))
				sb.WriteString(fmt.Sprintf("Debug (read-only): %s?interactive=false\n", sess.DebugURL))
			}
			sb.WriteString(fmt.Sprintf("\nEmbed:\n```html\n<iframe src=\"%s?interactive=true\" style=\"width:100%%;height:600px;border:none;\"></iframe>\n```", sess.DebugURL))
			return sb.String()
		}
	}
	return "❌ No active CUA session for this chat."
}

func (d *Daemon) cuaReplayResponse(sessionID string) string {
	if d.steel == nil || !d.steel.IsConfigured() {
		return "❌ Steel is not configured."
	}
	hlsURL := d.steel.HLSPlaylist(sessionID)
	return fmt.Sprintf("🎬 **Session Replay**\n\n"+
		"HLS Playlist: `%s`\n\n"+
		"Embed:\n```html\n<video id=\"player\" controls style=\"width:100%%;max-width:900px;\"></video>\n"+
		"<script type=\"module\">\nimport Hls from 'https://cdn.jsdelivr.net/npm/hls.js@^1.5.0/dist/hls.mjs';\n"+
		"const hls = new Hls({xhrSetup:(xhr)=>{xhr.setRequestHeader('steel-api-key','YOUR_KEY');}});\n"+
		"hls.loadSource('%s');\nhls.attachMedia(document.getElementById('player'));\n</script>\n```",
		hlsURL, hlsURL)
}

func (d *Daemon) cuaAgentResponse(msg bus.InboundMessage, chatID, objective string) string {
	// Create a Steel session for the CUA agent
	if d.steel == nil || !d.steel.IsConfigured() {
		// Fall back to E2B desktop agent
		if d.browserAgent != nil {
			return d.desktopAgentResponse(msg, chatID, objective)
		}
		return "❌ No CUA provider available. Set STEEL_API_KEY or E2B_API_KEY."
	}

	ctx, cancel := context.WithTimeout(d.ctx, 30*time.Second)
	defer cancel()

	sess, created, err := d.steel.GetOrCreate(ctx, chatID, &steel.CreateOptions{
		UseProxy:     true,
		SolveCaptcha: true,
		Timeout:      900000, // 15 minutes for agent work
	})
	if err != nil {
		return fmt.Sprintf("❌ Steel session failed: %v", err)
	}

	prefix := ""
	if created {
		prefix = "🚀 New Steel session created.\n\n"
	}

	return fmt.Sprintf("%s🤖 **CUA Agent Ready**\n\n"+
		"Objective: %s\n"+
		"Session: `%s`\n"+
		"CDP: `%s`\n"+
		"Live View: %s\n\n"+
		"Connect via Playwright and use vision LLM to drive the browser autonomously.\n\n"+
		"```typescript\nconst browser = await chromium.connectOverCDP('%s');\nconst page = browser.contexts()[0].pages()[0];\n// Agent OODA loop: screenshot → vision → action → repeat\n```",
		prefix, objective, sess.ID, sess.ConnectURL, sess.SessionViewerURL, sess.ConnectURL)
}

// ─── Natural language CUA detection ───────────────────────────────────────────

var cuaNLPatterns = []string{
	"computer use",
	"use the computer",
	"control the browser",
	"automate the browser",
	"browse the web",
	"web automation",
	"scrape the",
	"web scraping",
	"solve captcha",
	"steel session",
	"cloud browser",
}

// maybeHandleCUAText detects natural language CUA requests.
func (d *Daemon) maybeHandleCUAText(msg bus.InboundMessage, content string) (string, bool) {
	steelReady := d.steel != nil && d.steel.IsConfigured()
	if !steelReady {
		return "", false
	}

	lower := strings.ToLower(content)
	for _, pat := range cuaNLPatterns {
		if strings.Contains(lower, pat) {
			chatID := d.e2bChatID(msg)
			// Extract URL if present
			words := strings.Fields(content)
			for _, w := range words {
				if strings.HasPrefix(w, "http://") || strings.HasPrefix(w, "https://") {
					return d.cuaBrowseResponse(msg, chatID, w), true
				}
			}
			return d.cuaNewResponse(chatID, "steel"), true
		}
	}

	return "", false
}
