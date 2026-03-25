package daemon

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/autoreply"
	"github.com/x402agent/Solana-Os-Go/pkg/bus"
	e2bpkg "github.com/x402agent/Solana-Os-Go/pkg/e2b"
)

// ─── /sandbox, /sbx ─────────────────────────────────────────────────────────

func (d *Daemon) e2bSandboxResponse(msg bus.InboundMessage, args []string) string {
	if !d.e2b.IsConfigured() {
		return "❌ E2B is not configured. Set `E2B_API_KEY` in your .env file."
	}

	chatID := d.e2bChatID(msg)

	// If they just type /sandbox with no args, show status
	if len(args) == 0 {
		sess := d.e2b.GetSession(chatID)
		if sess == nil {
			return "☁️ **E2B Sandbox**\n\nNo active sandbox for this chat.\n\n" +
				"Commands:\n" +
				"• `/sandbox new` — spin up a fresh sandbox\n" +
				"• `/run <code>` — run Python code (auto-creates sandbox)\n" +
				"• `/shell <cmd>` — run a shell command\n" +
				"• `/sandbox kill` — terminate sandbox\n" +
				"• `/sandbox list` — show all active sandboxes"
		}
		age := time.Since(sess.CreatedAt).Round(time.Second)
		return fmt.Sprintf("☁️ **E2B Sandbox Active**\n\nID: `%s`\nTemplate: %s\nUptime: %s\n\nUse `/run` for Python, `/shell` for bash, or `/sandbox kill` to stop.", sess.SandboxID, sess.Template, age)
	}

	sub := strings.ToLower(args[0])
	switch sub {
	case "new", "create", "start":
		template := ""
		if len(args) > 1 {
			template = args[1]
		}
		ctx, cancel := context.WithTimeout(d.ctx, 30*time.Second)
		defer cancel()
		sess, created, err := d.e2b.GetOrCreateSession(ctx, chatID)
		if err != nil {
			log.Printf("[E2B] create error: %v", err)
			return fmt.Sprintf("❌ Failed to create sandbox: %v", err)
		}
		_ = template
		if !created {
			return fmt.Sprintf("☁️ Sandbox already running: `%s`\nUse `/sandbox kill` first to create a new one.", sess.SandboxID)
		}
		return fmt.Sprintf("🚀 **Sandbox Created**\n\nID: `%s`\nTemplate: %s\n\nReady for `/run` (Python) or `/shell` (bash).", sess.SandboxID, sess.Template)

	case "kill", "stop", "destroy":
		return d.e2bKillResponse(msg)

	case "list", "ls":
		return d.e2bListResponse()

	default:
		// Treat the rest as code to run
		code := strings.Join(args, " ")
		return d.e2bExecuteCode(msg, code, "python")
	}
}

// ─── /run, /exec ─────────────────────────────────────────────────────────────

func (d *Daemon) e2bRunCodeResponse(msg bus.InboundMessage, args []string) string {
	if !d.e2b.IsConfigured() {
		return "❌ E2B is not configured. Set `E2B_API_KEY`."
	}
	if len(args) == 0 {
		return "Usage: `/run <python code>`\n\nExample: `/run print('hello world')`\n\nOr send a code block:\n```\n/run\nimport math\nprint(math.pi)\n```"
	}

	code := strings.Join(args, " ")
	// Extract code blocks from markdown
	if extracted := extractCodeBlock(code); extracted != "" {
		code = extracted
	}
	return d.e2bExecuteCode(msg, code, "python")
}

// ─── /shell ──────────────────────────────────────────────────────────────────

func (d *Daemon) e2bShellResponse(msg bus.InboundMessage, args []string) string {
	if !d.e2b.IsConfigured() {
		return "❌ E2B is not configured. Set `E2B_API_KEY`."
	}
	if len(args) == 0 {
		return "Usage: `/shell <command>`\n\nExample: `/shell ls -la /home/user`"
	}

	command := strings.Join(args, " ")
	chatID := d.e2bChatID(msg)

	ctx, cancel := context.WithTimeout(d.ctx, 60*time.Second)
	defer cancel()

	sess, _, err := d.e2b.GetOrCreateSession(ctx, chatID)
	if err != nil {
		return fmt.Sprintf("❌ Sandbox error: %v", err)
	}

	result, err := d.e2b.RunCommand(ctx, sess.SandboxID, command)
	if err != nil {
		return fmt.Sprintf("❌ Command failed: %v", err)
	}

	output := e2bpkg.FormatResult(result)
	return fmt.Sprintf("🖥️ **Shell** `%s`\n\n```\n%s\n```", truncateCmd(command), output)
}

// ─── /sandbox_kill ───────────────────────────────────────────────────────────

func (d *Daemon) e2bKillResponse(msg bus.InboundMessage) string {
	if !d.e2b.IsConfigured() {
		return "❌ E2B is not configured."
	}

	chatID := d.e2bChatID(msg)
	ctx, cancel := context.WithTimeout(d.ctx, 15*time.Second)
	defer cancel()

	if err := d.e2b.CloseSession(ctx, chatID); err != nil {
		return fmt.Sprintf("⚠️ %v", err)
	}
	return "🗑️ Sandbox terminated."
}

// ─── /sandbox_list ───────────────────────────────────────────────────────────

func (d *Daemon) e2bListResponse() string {
	if !d.e2b.IsConfigured() {
		return "❌ E2B is not configured."
	}

	ctx, cancel := context.WithTimeout(d.ctx, 15*time.Second)
	defer cancel()

	sandboxes, err := d.e2b.ListSandboxes(ctx)
	if err != nil {
		return fmt.Sprintf("❌ Failed to list: %v", err)
	}
	if len(sandboxes) == 0 {
		return "☁️ No active sandboxes."
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("☁️ **Active Sandboxes** (%d)\n\n", len(sandboxes)))
	for i, s := range sandboxes {
		if i >= 10 {
			sb.WriteString(fmt.Sprintf("... and %d more", len(sandboxes)-10))
			break
		}
		sb.WriteString(fmt.Sprintf("• `%s` — %s\n", s.SandboxID, s.Template))
	}
	return sb.String()
}

// ─── Natural language sandbox detection ──────────────────────────────────────

var sandboxNLPatterns = []string{
	"spin up a sandbox",
	"create a sandbox",
	"start a sandbox",
	"launch a sandbox",
	"open a sandbox",
	"run this code",
	"execute this code",
	"run this python",
	"run this script",
	"execute python",
}

// maybeHandleSandboxText detects natural language sandbox requests.
func (d *Daemon) maybeHandleSandboxText(msg bus.InboundMessage, content string) (string, bool) {
	if !d.e2b.IsConfigured() {
		return "", false
	}
	lower := strings.ToLower(content)

	// Check for natural language sandbox creation
	for _, pat := range sandboxNLPatterns {
		if strings.Contains(lower, pat) {
			// If it's a "run code" intent, extract the code
			if strings.Contains(lower, "run") || strings.Contains(lower, "execute") {
				if code := extractCodeBlock(content); code != "" {
					return d.e2bExecuteCode(msg, code, "python"), true
				}
			}
			// Otherwise create sandbox
			chatID := d.e2bChatID(msg)
			ctx, cancel := context.WithTimeout(d.ctx, 30*time.Second)
			defer cancel()
			sess, created, err := d.e2b.GetOrCreateSession(ctx, chatID)
			if err != nil {
				return fmt.Sprintf("❌ Sandbox error: %v", err), true
			}
			if created {
				return fmt.Sprintf("🚀 Sandbox is live!\n\nID: `%s`\nSend code with `/run` or bash with `/shell`.", sess.SandboxID), true
			}
			return fmt.Sprintf("☁️ Sandbox already running: `%s`", sess.SandboxID), true
		}
	}

	// Detect inline code blocks with "run" intent
	if (strings.Contains(lower, "run") || strings.Contains(lower, "execute")) && strings.Contains(content, "```") {
		if code := extractCodeBlock(content); code != "" {
			// Use LLM to determine if they want sandbox execution
			return d.e2bExecuteCode(msg, code, "python"), true
		}
	}

	return "", false
}

// ─── Internal helpers ────────────────────────────────────────────────────────

func (d *Daemon) e2bExecuteCode(msg bus.InboundMessage, code, language string) string {
	chatID := d.e2bChatID(msg)

	ctx, cancel := context.WithTimeout(d.ctx, 90*time.Second)
	defer cancel()

	sess, created, err := d.e2b.GetOrCreateSession(ctx, chatID)
	if err != nil {
		return fmt.Sprintf("❌ Sandbox error: %v", err)
	}

	prefix := ""
	if created {
		prefix = "🚀 New sandbox created.\n\n"
	}

	result, err := d.e2b.RunCode(ctx, sess.SandboxID, code, language)
	if err != nil {
		// If sandbox expired, try once more with a fresh one
		if strings.Contains(err.Error(), "404") || strings.Contains(err.Error(), "not found") {
			log.Printf("[E2B] Sandbox expired, creating fresh one")
			_ = d.e2b.CloseSession(ctx, chatID)
			sess, _, err = d.e2b.GetOrCreateSession(ctx, chatID)
			if err != nil {
				return fmt.Sprintf("❌ Sandbox error: %v", err)
			}
			result, err = d.e2b.RunCode(ctx, sess.SandboxID, code, language)
			if err != nil {
				return fmt.Sprintf("❌ Execution failed: %v", err)
			}
			prefix = "🔄 Sandbox refreshed.\n\n"
		} else {
			return fmt.Sprintf("❌ Execution failed: %v", err)
		}
	}

	output := e2bpkg.FormatResult(result)
	codePreview := code
	if len(codePreview) > 200 {
		codePreview = codePreview[:200] + "..."
	}

	reply := fmt.Sprintf("%s🐍 **Python Output**\n\n```\n%s\n```", prefix, output)
	return autoreply.VisibleAssistantText(reply)
}

func (d *Daemon) e2bChatID(msg bus.InboundMessage) string {
	chatID := strings.TrimSpace(msg.ChatID)
	if chatID == "" {
		chatID = strings.TrimSpace(msg.SenderID)
	}
	if chatID == "" {
		chatID = "default"
	}
	return chatID
}

var codeBlockRe = regexp.MustCompile("(?s)```(?:python|py|bash|sh|javascript|js|go)?\\s*\\n?(.*?)```")

func extractCodeBlock(text string) string {
	matches := codeBlockRe.FindStringSubmatch(text)
	if len(matches) >= 2 {
		return strings.TrimSpace(matches[1])
	}
	return ""
}

func truncateCmd(cmd string) string {
	if len(cmd) > 60 {
		return cmd[:57] + "..."
	}
	return cmd
}
