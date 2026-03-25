package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/bus"
	"github.com/x402agent/Solana-Os-Go/pkg/config"
)

// ─── Remote Control (Claude Code remote-control from Telegram) ────────────────
//
// Launches a `claude remote-control` server process on the local machine,
// then routes Telegram natural-language messages into it. This lets the
// operator drive the entire Mac from Telegram via Claude Code.

// remoteSession tracks a single `claude remote-control` server process.
type remoteSession struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Workdir   string    `json:"workdir"`
	PID       int       `json:"pid"`
	SessionURL string   `json:"session_url,omitempty"`
	Status    string    `json:"status"`
	StartedAt time.Time `json:"started_at"`
	ChatKey   string    `json:"chat_key"`
}

// remoteControlStore manages active remote-control sessions per chat.
type remoteControlStore struct {
	path     string
	mu       sync.RWMutex
	Sessions map[string]*remoteSession `json:"sessions"`
	procs    map[string]*exec.Cmd      // keyed by chat key, not persisted
}

func newRemoteControlStore(path string) *remoteControlStore {
	s := &remoteControlStore{
		path:     path,
		Sessions: make(map[string]*remoteSession),
		procs:    make(map[string]*exec.Cmd),
	}
	_ = s.load()
	return s
}

func (s *remoteControlStore) load() error {
	data, err := os.ReadFile(s.path)
	if err != nil {
		return nil // file doesn't exist yet
	}
	return json.Unmarshal(data, s)
}

func (s *remoteControlStore) save() error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, data, 0o600)
}

func (s *remoteControlStore) Get(chatKey string) *remoteSession {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Sessions[chatKey]
}

func (s *remoteControlStore) Set(chatKey string, sess *remoteSession, cmd *exec.Cmd) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Sessions[chatKey] = sess
	if cmd != nil {
		s.procs[chatKey] = cmd
	}
	_ = s.save()
}

func (s *remoteControlStore) Remove(chatKey string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if proc, ok := s.procs[chatKey]; ok {
		if proc.Process != nil {
			_ = proc.Process.Kill()
		}
		delete(s.procs, chatKey)
	}
	delete(s.Sessions, chatKey)
	_ = s.save()
}

func (s *remoteControlStore) GetProc(chatKey string) *exec.Cmd {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.procs[chatKey]
}

func (s *remoteControlStore) List() []*remoteSession {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var result []*remoteSession
	for _, sess := range s.Sessions {
		result = append(result, sess)
	}
	return result
}

// ─── /remote command handler ──────────────────────────────────────────────────

func (d *Daemon) remoteControlResponse(msg bus.InboundMessage, args []string) string {
	if d.remoteControl == nil {
		d.remoteControl = newRemoteControlStore(
			filepath.Join(config.DefaultWorkspacePath(), "state", "remote-control.json"),
		)
	}

	if len(args) == 0 {
		return d.remoteControlUsage()
	}

	sub := strings.ToLower(strings.TrimSpace(args[0]))
	switch sub {
	case "help":
		return d.remoteControlUsage()
	case "start", "new":
		return d.remoteControlStartResponse(msg, args[1:])
	case "status", "info":
		return d.remoteControlStatusResponse(msg)
	case "stop", "kill":
		return d.remoteControlStopResponse(msg)
	case "list", "sessions":
		return d.remoteControlListResponse()
	case "send", "do", "run":
		if len(args) < 2 {
			return "Usage: `/remote send <natural language instruction>`"
		}
		prompt := strings.Join(args[1:], " ")
		return d.remoteControlSendResponse(msg, prompt)
	default:
		// Treat the entire args as a prompt to send to the active session
		prompt := strings.Join(args, " ")
		return d.remoteControlSendResponse(msg, prompt)
	}
}

func (d *Daemon) remoteControlUsage() string {
	return "🖥️ **Remote Control** — Drive your Mac from Telegram via Claude Code\n\n" +
		"**Commands:**\n" +
		"• `/remote start [--name <name>] [--workdir <path>]` — start a Claude remote-control server\n" +
		"• `/remote status` — show active session info\n" +
		"• `/remote send <instruction>` — send a natural language command to Claude\n" +
		"• `/remote list` — list all active remote sessions\n" +
		"• `/remote stop` — stop the active remote-control session\n\n" +
		"**Examples:**\n" +
		"• `/remote start` — start in home directory\n" +
		"• `/remote start --name my-project --workdir ~/code/myapp`\n" +
		"• `/remote open Safari and go to github.com`\n" +
		"• `/remote check my disk usage and clean up temp files`\n" +
		"• `/remote find all Python files modified today`\n" +
		"• `/remote open Terminal and run brew update`\n"
}

func (d *Daemon) remoteControlStartResponse(msg bus.InboundMessage, args []string) string {
	chatKey := d.messageSessionKey(msg)

	// Check for existing session
	if existing := d.remoteControl.Get(chatKey); existing != nil {
		if existing.Status == "running" {
			return fmt.Sprintf("🖥️ Remote session already active: `%s`\n"+
				"Workdir: `%s`\nPID: %d\nUptime: %s\n\n"+
				"Use `/remote stop` to end it, or just send commands directly.",
				existing.Name, existing.Workdir, existing.PID,
				time.Since(existing.StartedAt).Round(time.Second))
		}
	}

	// Parse flags
	name := fmt.Sprintf("telegram-%s", time.Now().Format("0102-150405"))
	workdir := os.Getenv("HOME")
	if workdir == "" {
		workdir = "/Users/" + os.Getenv("USER")
	}

	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--name", "-n":
			if i+1 < len(args) {
				name = args[i+1]
				i++
			}
		case "--workdir", "-w", "--dir":
			if i+1 < len(args) {
				workdir = args[i+1]
				i++
			}
		}
	}

	// Resolve workdir
	if strings.HasPrefix(workdir, "~") {
		home := os.Getenv("HOME")
		workdir = filepath.Join(home, workdir[1:])
	}
	workdir = filepath.Clean(workdir)

	// Verify workdir exists
	if info, err := os.Stat(workdir); err != nil || !info.IsDir() {
		return fmt.Sprintf("❌ Workdir `%s` does not exist or is not a directory.", workdir)
	}

	// Find claude binary
	claudeBin := findClaudeBinary()
	if claudeBin == "" {
		return "❌ `claude` CLI not found. Install Claude Code: `npm install -g @anthropic-ai/claude-code`"
	}

	// Start claude remote-control process
	cmd := exec.CommandContext(d.ctx, claudeBin, "remote-control", "--name", name)
	cmd.Dir = workdir
	cmd.Env = append(os.Environ(),
		"CLAUDE_CODE_ENABLE_REMOTE_CONTROL=1",
	)

	// Capture output for session URL
	outputBuf := &strings.Builder{}
	cmd.Stdout = outputBuf
	cmd.Stderr = outputBuf

	if err := cmd.Start(); err != nil {
		return fmt.Sprintf("❌ Failed to start remote-control: %v", err)
	}

	sess := &remoteSession{
		ID:        fmt.Sprintf("rc-%d", time.Now().UnixMilli()),
		Name:      name,
		Workdir:   workdir,
		PID:       cmd.Process.Pid,
		Status:    "running",
		StartedAt: time.Now(),
		ChatKey:   chatKey,
	}
	d.remoteControl.Set(chatKey, sess, cmd)

	// Wait briefly for the session URL to appear
	go func() {
		time.Sleep(3 * time.Second)
		output := outputBuf.String()
		if url := extractSessionURL(output); url != "" {
			sess.SessionURL = url
			d.remoteControl.Set(chatKey, sess, nil)
			log.Printf("[REMOTE-CONTROL] Session URL: %s", url)
		}

		// Monitor process exit
		if err := cmd.Wait(); err != nil {
			log.Printf("[REMOTE-CONTROL] Process exited: %v", err)
		}
		sess.Status = "stopped"
		d.remoteControl.Set(chatKey, sess, nil)
	}()

	return fmt.Sprintf("🚀 **Remote Control Started**\n\n"+
		"Name: `%s`\n"+
		"Workdir: `%s`\n"+
		"PID: %d\n\n"+
		"Claude Code is now running as a remote-control server on this Mac.\n"+
		"You can connect from claude.ai/code or the Claude mobile app.\n\n"+
		"Send commands directly:\n"+
		"• `/remote open Finder and navigate to Downloads`\n"+
		"• `/remote check what processes are using the most CPU`\n"+
		"• `/remote list all git repos in ~/code`\n\n"+
		"Or just type naturally after `/remote` and Claude will execute it on your Mac.",
		name, workdir, cmd.Process.Pid)
}

func (d *Daemon) remoteControlStatusResponse(msg bus.InboundMessage) string {
	chatKey := d.messageSessionKey(msg)
	sess := d.remoteControl.Get(chatKey)
	if sess == nil {
		return "🖥️ No active remote-control session. Use `/remote start` to begin."
	}

	// Check if process is still alive
	proc := d.remoteControl.GetProc(chatKey)
	alive := proc != nil && proc.Process != nil
	if alive {
		if err := proc.Process.Signal(os.Signal(nil)); err != nil {
			alive = false
			sess.Status = "stopped"
		}
	}

	var sb strings.Builder
	sb.WriteString("🖥️ **Remote Control Session**\n\n")
	sb.WriteString(fmt.Sprintf("Name: `%s`\n", sess.Name))
	sb.WriteString(fmt.Sprintf("Workdir: `%s`\n", sess.Workdir))
	sb.WriteString(fmt.Sprintf("PID: %d\n", sess.PID))
	sb.WriteString(fmt.Sprintf("Status: %s\n", sess.Status))
	sb.WriteString(fmt.Sprintf("Uptime: %s\n", time.Since(sess.StartedAt).Round(time.Second)))
	if sess.SessionURL != "" {
		sb.WriteString(fmt.Sprintf("Session URL: %s\n", sess.SessionURL))
	}
	if !alive {
		sb.WriteString("\n⚠️ Process appears to have exited. Use `/remote start` to restart.")
	}
	return sb.String()
}

func (d *Daemon) remoteControlStopResponse(msg bus.InboundMessage) string {
	chatKey := d.messageSessionKey(msg)
	sess := d.remoteControl.Get(chatKey)
	if sess == nil {
		return "⚠️ No active remote-control session to stop."
	}

	d.remoteControl.Remove(chatKey)
	return fmt.Sprintf("🗑️ Remote-control session `%s` stopped (PID %d).", sess.Name, sess.PID)
}

func (d *Daemon) remoteControlListResponse() string {
	sessions := d.remoteControl.List()
	if len(sessions) == 0 {
		return "🖥️ No active remote-control sessions."
	}

	var sb strings.Builder
	sb.WriteString("🖥️ **Active Remote Control Sessions**\n\n")
	for _, sess := range sessions {
		age := time.Since(sess.StartedAt).Round(time.Second)
		sb.WriteString(fmt.Sprintf("• `%s` — %s (PID %d, %s)\n  Workdir: `%s`\n",
			sess.Name, sess.Status, sess.PID, age, sess.Workdir))
		if sess.SessionURL != "" {
			sb.WriteString(fmt.Sprintf("  URL: %s\n", sess.SessionURL))
		}
	}
	return sb.String()
}

func (d *Daemon) remoteControlSendResponse(msg bus.InboundMessage, prompt string) string {
	prompt = strings.TrimSpace(prompt)
	if prompt == "" {
		return "Usage: `/remote <instruction>` — tell Claude what to do on your Mac."
	}

	// Check for active remote-control session
	chatKey := d.messageSessionKey(msg)
	sess := d.remoteControl.Get(chatKey)

	// If no remote session exists, auto-start one
	if sess == nil || sess.Status != "running" {
		autoResult := d.remoteControlStartResponse(msg, nil)
		sess = d.remoteControl.Get(chatKey)
		if sess == nil || sess.Status != "running" {
			return autoResult + "\n\n⚠️ Could not auto-start remote session. Try `/remote start` manually."
		}
	}

	// Execute the command via a separate claude --resume or claude -p invocation
	// that connects to the same working directory
	claudeBin := findClaudeBinary()
	if claudeBin == "" {
		return "❌ `claude` CLI not found."
	}

	ctx, cancel := context.WithTimeout(d.ctx, 120*time.Second)
	defer cancel()

	// Use claude -p (print mode) to send a one-shot prompt in the workdir
	cmd := exec.CommandContext(ctx, claudeBin, "-p", prompt, "--allowedTools", "Bash,Read,Write,Edit,Glob,Grep")
	cmd.Dir = sess.Workdir
	cmd.Env = os.Environ()

	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("[REMOTE-CONTROL] Command error: %v", err)
		outputStr := strings.TrimSpace(string(output))
		if outputStr != "" {
			return fmt.Sprintf("⚠️ Claude returned an error:\n```\n%s\n```", truncateOutput(outputStr, 3000))
		}
		return fmt.Sprintf("❌ Command failed: %v", err)
	}

	result := strings.TrimSpace(string(output))
	if result == "" {
		return "✅ Command executed (no output)."
	}

	return truncateOutput(result, 3800)
}

// ─── Natural language remote control detection ────────────────────────────────

var remoteNLPatterns = []string{
	"remote control",
	"control my mac",
	"control my computer",
	"control this computer",
	"use my computer",
	"use this computer",
	"use the mac",
	"run on my mac",
	"execute on my mac",
	"open on my mac",
	"dispatch to my computer",
	"remote session",
}

func (d *Daemon) maybeHandleRemoteControlText(msg bus.InboundMessage, content string) (string, bool) {
	if d.remoteControl == nil {
		return "", false
	}

	lower := strings.ToLower(content)
	for _, pat := range remoteNLPatterns {
		if strings.Contains(lower, pat) {
			chatKey := d.messageSessionKey(msg)
			sess := d.remoteControl.Get(chatKey)

			if strings.Contains(lower, "start") || strings.Contains(lower, "launch") || strings.Contains(lower, "begin") {
				return d.remoteControlStartResponse(msg, nil), true
			}
			if strings.Contains(lower, "stop") || strings.Contains(lower, "kill") || strings.Contains(lower, "end") {
				return d.remoteControlStopResponse(msg), true
			}
			if strings.Contains(lower, "status") || strings.Contains(lower, "check") {
				return d.remoteControlStatusResponse(msg), true
			}
			if sess != nil && sess.Status == "running" {
				// Extract the instruction part after the trigger phrase
				return d.remoteControlSendResponse(msg, content), true
			}
			return d.remoteControlStartResponse(msg, nil), true
		}
	}

	return "", false
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func findClaudeBinary() string {
	// Check common locations
	candidates := []string{
		"claude",
	}

	// Check PATH first
	for _, name := range candidates {
		if path, err := exec.LookPath(name); err == nil {
			return path
		}
	}

	// Check common install locations on macOS
	homeDir := os.Getenv("HOME")
	knownPaths := []string{
		filepath.Join(homeDir, ".npm-global", "bin", "claude"),
		filepath.Join(homeDir, ".local", "bin", "claude"),
		"/usr/local/bin/claude",
		"/opt/homebrew/bin/claude",
		filepath.Join(homeDir, ".nvm", "versions", "node"),
	}

	for _, p := range knownPaths {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}

	// Try finding via npm root
	if out, err := exec.Command("npm", "root", "-g").Output(); err == nil {
		npmGlobal := strings.TrimSpace(string(out))
		claudePath := filepath.Join(filepath.Dir(npmGlobal), "bin", "claude")
		if _, err := os.Stat(claudePath); err == nil {
			return claudePath
		}
	}

	return ""
}

func extractSessionURL(output string) string {
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.Contains(line, "claude.ai/code") || strings.Contains(line, "session") {
			// Extract URL
			for _, word := range strings.Fields(line) {
				if strings.HasPrefix(word, "https://") {
					return word
				}
			}
		}
	}
	return ""
}

func truncateOutput(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-20] + "\n\n... (truncated)"
}
