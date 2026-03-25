package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/bus"
	"github.com/x402agent/Solana-Os-Go/pkg/config"
	gatewaypkg "github.com/x402agent/Solana-Os-Go/pkg/gateway"
)

type codingIntentBinding struct {
	SessionID string    `json:"session_id"`
	Kind      string    `json:"kind,omitempty"`
	Label     string    `json:"label,omitempty"`
	Workdir   string    `json:"workdir,omitempty"`
	UpdatedAt time.Time `json:"updated_at"`
}

type codingIntentStore struct {
	path     string
	mu       sync.RWMutex
	Sessions map[string]codingIntentBinding `json:"sessions"`
}

func newCodingIntentStore(path string) (*codingIntentStore, error) {
	store := &codingIntentStore{
		path:     path,
		Sessions: map[string]codingIntentBinding{},
	}
	if err := store.load(); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *codingIntentStore) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return err
	}
	data, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if len(data) == 0 {
		return nil
	}
	return json.Unmarshal(data, s)
}

func (s *codingIntentStore) Set(sessionKey string, session *gatewaypkg.CodingSession, kind string) error {
	if s == nil || session == nil {
		return nil
	}
	sessionKey = strings.TrimSpace(sessionKey)
	if sessionKey == "" {
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.Sessions[sessionKey] = codingIntentBinding{
		SessionID: strings.TrimSpace(session.ID),
		Kind:      strings.TrimSpace(kind),
		Label:     strings.TrimSpace(session.Label),
		Workdir:   strings.TrimSpace(session.Workdir),
		UpdatedAt: time.Now().UTC(),
	}
	return s.persistLocked()
}

func (s *codingIntentStore) Get(sessionKey string) (codingIntentBinding, bool) {
	if s == nil {
		return codingIntentBinding{}, false
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	binding, ok := s.Sessions[strings.TrimSpace(sessionKey)]
	return binding, ok
}

func (s *codingIntentStore) Clear(sessionKey string) error {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.Sessions, strings.TrimSpace(sessionKey))
	return s.persistLocked()
}

func (s *codingIntentStore) persistLocked() error {
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, data, 0o644)
}

func (d *Daemon) setActiveCodingSession(msg bus.InboundMessage, session *gatewaypkg.CodingSession, kind string) {
	if d == nil || d.codingState == nil || session == nil {
		return
	}
	if err := d.codingState.Set(d.messageSessionKey(msg), session, kind); err != nil {
		log.Printf("[CODING] ⚠️ active session persist failed: %v", err)
	}
}

func (d *Daemon) clearActiveCodingSession(msg bus.InboundMessage) {
	if d == nil || d.codingState == nil {
		return
	}
	if err := d.codingState.Clear(d.messageSessionKey(msg)); err != nil {
		log.Printf("[CODING] ⚠️ active session clear failed: %v", err)
	}
}

func (d *Daemon) activeCodingSession(msg bus.InboundMessage) (*gatewaypkg.CodingSession, codingIntentBinding, bool) {
	if d == nil || d.codingSessions == nil || d.codingState == nil {
		return nil, codingIntentBinding{}, false
	}
	binding, ok := d.codingState.Get(d.messageSessionKey(msg))
	if !ok || strings.TrimSpace(binding.SessionID) == "" {
		return nil, codingIntentBinding{}, false
	}
	session := d.codingSessions.Get(binding.SessionID)
	if session == nil {
		d.clearActiveCodingSession(msg)
		return nil, codingIntentBinding{}, false
	}
	return session, binding, true
}

func (d *Daemon) maybeHandleCodingText(msg bus.InboundMessage, content string) (string, bool) {
	lower := strings.ToLower(strings.TrimSpace(content))
	if lower == "" {
		return "", false
	}

	if reply, ok := d.maybeHandleGitHubNaturalText(msg, content, lower); ok {
		return reply, true
	}
	if reply, ok := d.maybeHandleClaudeNaturalText(msg, content, lower); ok {
		return reply, true
	}
	return "", false
}

func (d *Daemon) maybeHandleGitHubNaturalText(msg bus.InboundMessage, content, lower string) (string, bool) {
	if looksLikeGitHubSessionsIntent(lower) {
		return d.githubSessionsResponse(), true
	}
	if looksLikeGitHubCreateIntent(lower) {
		return d.githubCreateRepoResponse(msg, content), true
	}
	if looksLikeGitHubStatusIntent(lower) {
		return d.codingSessionStatusResponse(msg, lower, true), true
	}
	if looksLikeGitHubKillIntent(lower) {
		return d.killCodingSessionResponse(msg, true), true
	}
	if looksLikeGitHubContinueIntent(lower) {
		prompt := stripCodingContinuationPrefix(content)
		return d.continueActiveCodingSessionResponse(msg, prompt, true), true
	}
	return "", false
}

func (d *Daemon) maybeHandleClaudeNaturalText(msg bus.InboundMessage, content, lower string) (string, bool) {
	_, _, hasActive := d.activeCodingSession(msg)

	if looksLikeCodingSessionsIntent(lower) {
		return d.codingSessionsResponse(msg, false), true
	}
	if looksLikeCodingStatusIntent(lower) {
		return d.codingSessionStatusResponse(msg, lower, false), true
	}
	if looksLikeCodingKillIntent(lower) {
		return d.killCodingSessionResponse(msg, false), true
	}
	if looksLikeClaudeStartIntent(lower) {
		return d.startClaudeSessionResponse(msg, content), true
	}
	if looksLikeCodingContinueIntent(lower, hasActive) {
		prompt := stripCodingContinuationPrefix(content)
		return d.continueActiveCodingSessionResponse(msg, prompt, false), true
	}
	return "", false
}

func (d *Daemon) claudeResponse(msg bus.InboundMessage, args []string) string {
	if len(args) == 0 {
		return d.claudeUsage()
	}

	switch strings.ToLower(strings.TrimSpace(args[0])) {
	case "help":
		return d.claudeUsage()
	case "start", "new":
		return d.startClaudeSessionResponse(msg, strings.Join(args[1:], " "))
	case "sessions", "list":
		return d.codingSessionsResponse(msg, false)
	case "status", "active", "current":
		return d.claudeStatusResponse(msg, args[1:])
	case "log", "tail", "output":
		return d.claudeLogResponse(msg, args[1:])
	case "continue", "resume":
		return d.claudeContinueResponse(msg, args[1:])
	case "commit":
		return d.claudeCommitResponse(msg, args[1:])
	case "use", "attach", "select":
		return d.claudeUseResponse(msg, args[1:])
	case "stop", "kill", "cancel":
		return d.claudeStopResponse(msg, args[1:])
	default:
		return d.startClaudeSessionResponse(msg, strings.Join(args, " "))
	}
}

func (d *Daemon) claudeUsage() string {
	return "Usage:\n" +
		"`/claude start <prompt>` — start a Claude Code session\n" +
		"`/claude sessions` — list recent Claude Code sessions\n" +
		"`/claude status [session_id]` — show the active or named session\n" +
		"`/claude log [session_id]` — tail the latest Claude output\n" +
		"`/claude continue <prompt>` — continue the active session for this chat\n" +
		"`/claude continue <session_id> <prompt>` — continue a specific session\n" +
		"`/claude commit [session_id] [extra instruction]` — have Claude review staged changes and create a commit\n" +
		"`/claude use <session_id>` — make a session active for this chat\n" +
		"`/claude stop [session_id]` — stop the active or named session\n\n" +
		"Examples:\n" +
		"`/claude start in /tmp/app scaffold a Go API with auth and tests`\n" +
		"`/claude sessions`\n" +
		"`/claude use a1b2c3d4e5f6`\n" +
		"`/claude commit stage a clean commit for the Telegram control work`\n" +
		"`/claude continue add Telegram command handlers for deployments`\n"
}

func (d *Daemon) startClaudeSessionResponse(msg bus.InboundMessage, raw string) string {
	if d.codingSessions == nil {
		return "🤖 Claude session manager is not available in this daemon."
	}

	prompt := strings.TrimSpace(raw)
	if prompt == "" {
		return "🤖 Tell me what to build, for example: `start a Claude Code session in /tmp/app and scaffold a Next.js API`."
	}

	workdir, label, err := d.resolveClaudeSessionWorkdir(prompt)
	if err != nil {
		return "🤖 Claude session setup failed: " + err.Error()
	}

	session, err := d.codingSessions.Create(gatewaypkg.CreateCodingSessionRequest{
		Runtime:      "claude",
		Prompt:       prompt,
		Workdir:      workdir,
		Label:        label,
		AllowedTools: defaultClaudeAllowedTools(),
		SystemPrompt: defaultClaudeSystemPrompt("claude"),
	})
	if err != nil {
		return "🤖 Claude session start failed: " + err.Error()
	}
	d.setActiveCodingSession(msg, session, "claude")

	return fmt.Sprintf(
		"🤖 Started Claude Code session `%s`.\nWorkdir: `%s`\nStatus: %s\n\nYou can now say things like `continue and add auth`, `show my coding log`, or `stop the coding session`.",
		session.ID,
		session.Workdir,
		session.Status,
	)
}

func (d *Daemon) resolveClaudeSessionWorkdir(prompt string) (string, string, error) {
	if workdir, ok := extractCodingWorkdir(prompt); ok {
		workdir = filepath.Clean(workdir)
		if info, err := os.Stat(workdir); err == nil && info.IsDir() {
			return workdir, "telegram:" + filepath.Base(workdir), nil
		}
		if err := os.MkdirAll(workdir, 0o755); err != nil {
			return "", "", err
		}
		return workdir, "telegram:" + filepath.Base(workdir), nil
	}

	slug := normalizeRepoName(slugFromBrief(prompt))
	if slug == "" {
		slug = fmt.Sprintf("telegram-coding-%d", time.Now().Unix())
	}
	workdir := filepath.Join(config.DefaultWorkspacePath(), "coding", slug)
	if err := os.MkdirAll(workdir, 0o755); err != nil {
		return "", "", err
	}
	if _, err := os.Stat(filepath.Join(workdir, ".git")); os.IsNotExist(err) {
		_ = runGit(context.Background(), workdir, nil, "init", "-b", "main")
	}
	return workdir, "telegram:" + slug, nil
}

func extractCodingWorkdir(raw string) (string, bool) {
	re := regexp.MustCompile("(?i)(?:in|inside|at|under)\\s+[`'\"]?(/[^\\s`'\"]+)[`'\"]?")
	match := re.FindStringSubmatch(raw)
	if len(match) == 2 {
		return strings.TrimSpace(match[1]), true
	}
	re = regexp.MustCompile("[`'\"](/[^`'\"]+)[`'\"]")
	match = re.FindStringSubmatch(raw)
	if len(match) == 2 {
		return strings.TrimSpace(match[1]), true
	}
	return "", false
}

func (d *Daemon) continueActiveCodingSessionResponse(msg bus.InboundMessage, prompt string, requireGitHub bool) string {
	if d.codingSessions == nil {
		return "🤖 Claude session manager is not available in this daemon."
	}
	session, binding, ok := d.activeCodingSession(msg)
	if !ok {
		if requireGitHub {
			return "🐙 No active GitHub coding session for this chat yet. Say `create a GitHub repo for ...` first."
		}
		return "🤖 No active coding session for this chat yet. Say `start a Claude Code session ...` or `create a GitHub repo for ...` first."
	}
	if requireGitHub && binding.Kind != "github" {
		return "🐙 The current active coding session is not a GitHub repo session. Create a repo first or ask for `show my coding sessions`."
	}

	prompt = strings.TrimSpace(prompt)
	if prompt == "" {
		return "🤖 Tell me what to send to Claude, for example: `continue and add OAuth login`."
	}

	updated, err := d.codingSessions.Continue(session.ID, prompt)
	if err != nil {
		return "🤖 Claude session continue failed: " + err.Error()
	}
	d.setActiveCodingSession(msg, updated, binding.Kind)

	return fmt.Sprintf(
		"🤖 Continuing `%s` in `%s`.\nStatus: %s\nUse natural language like `show my coding log` to inspect progress.",
		updated.ID,
		updated.Workdir,
		updated.Status,
	)
}

func (d *Daemon) claudeStatusResponse(msg bus.InboundMessage, args []string) string {
	session, _, ok := d.lookupCodingSession(msg, firstCodingSessionID(args))
	if !ok || session == nil {
		return "🤖 No active Claude Code session for this chat. Use `/claude sessions` or `/claude start <prompt>`."
	}
	return d.renderCodingSessionStatus(session)
}

func (d *Daemon) claudeLogResponse(msg bus.InboundMessage, args []string) string {
	if d.codingSessions == nil {
		return "🤖 Claude session manager is not available in this daemon."
	}

	session, _, ok := d.lookupCodingSession(msg, firstCodingSessionID(args))
	if !ok || session == nil {
		return "🤖 No active Claude Code session for this chat. Use `/claude sessions` or `/claude start <prompt>`."
	}

	content, run, err := d.codingSessions.ReadLog(session.ID, "")
	if err != nil {
		return "🤖 Claude session log lookup failed: " + err.Error()
	}

	content = strings.TrimSpace(content)
	if content == "" {
		content = "(no log output yet)"
	}
	return fmt.Sprintf("🤖 **Claude Session Log** `%s`\nSession: `%s`\nStatus: %s\n\n```text\n%s\n```",
		run.ID,
		session.ID,
		run.Status,
		tailText(content, 2800),
	)
}

func (d *Daemon) claudeContinueResponse(msg bus.InboundMessage, args []string) string {
	if d.codingSessions == nil {
		return "🤖 Claude session manager is not available in this daemon."
	}
	sessionID, prompt := splitCodingSessionPromptArgs(args)
	if strings.TrimSpace(prompt) == "" {
		return "Usage: `/claude continue <prompt>` or `/claude continue <session_id> <prompt>`"
	}

	session, binding, ok := d.lookupCodingSession(msg, sessionID)
	if !ok || session == nil {
		return "🤖 No active Claude Code session for this chat. Use `/claude use <session_id>` or `/claude start <prompt>`."
	}

	updated, err := d.codingSessions.ContinueWithOptions(session.ID, gatewaypkg.ContinueCodingSessionRequest{
		Prompt:       prompt,
		AllowedTools: session.AllowedTools,
		SystemPrompt: session.SystemPrompt,
	})
	if err != nil {
		return "🤖 Claude session continue failed: " + err.Error()
	}
	d.setActiveCodingSession(msg, updated, binding.Kind)

	return fmt.Sprintf(
		"🤖 Continuing `%s` in `%s`.\nStatus: %s\nUse `/claude log` to inspect output.",
		updated.ID,
		updated.Workdir,
		updated.Status,
	)
}

func (d *Daemon) claudeCommitResponse(msg bus.InboundMessage, args []string) string {
	if d.codingSessions == nil {
		return "🤖 Claude session manager is not available in this daemon."
	}

	sessionID, extra := splitCodingSessionPromptArgs(args)
	session, binding, ok := d.lookupCodingSession(msg, sessionID)
	if !ok || session == nil {
		return "🤖 No active Claude Code session for this chat. Use `/claude use <session_id>` or `/claude start <prompt>`."
	}

	prompt := "Look at my staged changes and create an appropriate commit."
	if strings.TrimSpace(extra) != "" {
		prompt += " Extra instruction: " + strings.TrimSpace(extra)
	}

	updated, err := d.codingSessions.ContinueWithOptions(session.ID, gatewaypkg.ContinueCodingSessionRequest{
		Prompt:       prompt,
		AllowedTools: gitCommitAllowedTools(),
		SystemPrompt: defaultClaudeSystemPrompt(binding.Kind),
	})
	if err != nil {
		return "🤖 Claude commit request failed: " + err.Error()
	}
	d.setActiveCodingSession(msg, updated, binding.Kind)

	return fmt.Sprintf(
		"🤖 Commit pass queued in `%s`.\nSession: `%s`\nUse `/claude log` to watch Claude review the staged changes and write the commit.",
		updated.Workdir,
		updated.ID,
	)
}

func (d *Daemon) claudeUseResponse(msg bus.InboundMessage, args []string) string {
	if d.codingSessions == nil {
		return "🤖 Claude session manager is not available in this daemon."
	}
	sessionID := firstCodingSessionID(args)
	if sessionID == "" {
		return "Usage: `/claude use <session_id>`"
	}

	session, binding, ok := d.lookupCodingSession(msg, sessionID)
	if !ok || session == nil {
		return fmt.Sprintf("🤖 Claude session `%s` was not found.", sessionID)
	}
	d.setActiveCodingSession(msg, session, binding.Kind)
	return fmt.Sprintf("🤖 Active Claude Code session is now `%s` in `%s`.", session.ID, session.Workdir)
}

func (d *Daemon) claudeStopResponse(msg bus.InboundMessage, args []string) string {
	if d.codingSessions == nil {
		return "🤖 Claude session manager is not available in this daemon."
	}

	session, _, ok := d.lookupCodingSession(msg, firstCodingSessionID(args))
	if !ok || session == nil {
		return "🤖 No active Claude Code session for this chat."
	}
	if err := d.codingSessions.Kill(session.ID); err != nil {
		return "🤖 Failed to stop the Claude session: " + err.Error()
	}
	if active, _, activeOK := d.activeCodingSession(msg); activeOK && active != nil && active.ID == session.ID {
		d.clearActiveCodingSession(msg)
	}
	return fmt.Sprintf("🤖 Stopped Claude Code session `%s` in `%s`.", session.ID, session.Workdir)
}

func (d *Daemon) killCodingSessionResponse(msg bus.InboundMessage, requireGitHub bool) string {
	if d.codingSessions == nil {
		return "🤖 Claude session manager is not available in this daemon."
	}
	session, binding, ok := d.activeCodingSession(msg)
	if !ok {
		if requireGitHub {
			return "🐙 No active GitHub coding session for this chat."
		}
		return "🤖 No active coding session for this chat."
	}
	if requireGitHub && binding.Kind != "github" {
		return "🐙 The active session is not a GitHub repo session."
	}
	if err := d.codingSessions.Kill(session.ID); err != nil {
		return "🤖 Failed to stop the coding session: " + err.Error()
	}
	d.clearActiveCodingSession(msg)
	return fmt.Sprintf("🤖 Stopped coding session `%s` in `%s`.", session.ID, session.Workdir)
}

func (d *Daemon) codingSessionStatusResponse(msg bus.InboundMessage, lower string, requireGitHub bool) string {
	if d.codingSessions == nil {
		return "🤖 Claude session manager is not available in this daemon."
	}

	sessionID := extractCodingSessionID(lower)
	var (
		session *gatewaypkg.CodingSession
		binding codingIntentBinding
		ok      bool
	)
	if sessionID != "" {
		session = d.codingSessions.Get(sessionID)
		if session != nil {
			binding = codingIntentBinding{Kind: "claude"}
			ok = true
		}
	} else {
		session, binding, ok = d.activeCodingSession(msg)
	}
	if !ok || session == nil {
		if requireGitHub {
			return "🐙 No active GitHub coding session for this chat."
		}
		return "🤖 No active coding session for this chat."
	}
	if requireGitHub && binding.Kind != "github" {
		return "🐙 The active session is not a GitHub repo session."
	}
	return d.renderCodingSessionStatus(session)
}

func (d *Daemon) renderCodingSessionStatus(session *gatewaypkg.CodingSession) string {
	if d == nil || d.codingSessions == nil || session == nil {
		return "🤖 Claude session manager is not available in this daemon."
	}

	content, run, err := d.codingSessions.ReadLog(session.ID, "")
	if err != nil {
		content = ""
		run = nil
	}

	var b strings.Builder
	fmt.Fprintf(&b, "🤖 **Coding Session** `%s`\n", session.ID)
	if strings.TrimSpace(session.Label) != "" {
		fmt.Fprintf(&b, "Label: %s\n", session.Label)
	}
	fmt.Fprintf(&b, "Status: %s\n", session.Status)
	fmt.Fprintf(&b, "Workdir: `%s`\n", session.Workdir)
	if strings.TrimSpace(session.ClaudeSessionID) != "" {
		fmt.Fprintf(&b, "Claude session: `%s`\n", session.ClaudeSessionID)
	}
	if run != nil {
		fmt.Fprintf(&b, "Last run: `%s` · %s\n", run.ID, run.Status)
		if strings.TrimSpace(run.Prompt) != "" {
			fmt.Fprintf(&b, "Prompt: %s\n", truncate(strings.TrimSpace(run.Prompt), 160))
		}
	}
	if strings.TrimSpace(content) != "" {
		fmt.Fprintf(&b, "\n```text\n%s\n```", tailText(strings.TrimSpace(content), 2200))
	}
	return b.String()
}

func (d *Daemon) codingSessionsResponse(msg bus.InboundMessage, onlyGitHub bool) string {
	if d.codingSessions == nil {
		return "🤖 Claude session manager is not available in this daemon."
	}

	activeID := ""
	if session, _, ok := d.activeCodingSession(msg); ok {
		activeID = session.ID
	}

	sessions := d.codingSessions.List()
	filtered := make([]*gatewaypkg.CodingSession, 0, len(sessions))
	for _, session := range sessions {
		if onlyGitHub && !strings.HasPrefix(session.Label, "github:") {
			continue
		}
		filtered = append(filtered, session)
	}
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].UpdatedAt.After(filtered[j].UpdatedAt)
	})
	if len(filtered) == 0 {
		if onlyGitHub {
			return "🐙 No GitHub coding sessions yet."
		}
		return "🤖 No coding sessions yet."
	}

	var b strings.Builder
	if onlyGitHub {
		b.WriteString("🐙 **GitHub Coding Sessions**\n\n")
	} else {
		b.WriteString("🤖 **Coding Sessions**\n\n")
	}
	limit := len(filtered)
	if limit > 8 {
		limit = 8
	}
	for _, session := range filtered[:limit] {
		marker := "-"
		if session.ID == activeID {
			marker = "*"
		}
		line := session.Label
		if strings.TrimSpace(line) == "" {
			line = filepath.Base(session.Workdir)
		}
		fmt.Fprintf(&b, "%s `%s` · %s · %s\n", marker, session.ID, line, session.Status)
	}
	b.WriteString("\n`*` marks the active session for this chat.")
	return b.String()
}

func looksLikeGitHubCreateIntent(lower string) bool {
	if !containsAny(lower, "github", "repo", "repository", "project") {
		return false
	}
	if containsAny(lower, "show", "list", "log", "status", "kill", "stop", "cancel", "continue", "resume") &&
		containsAny(lower, "session", "sessions", "log") {
		return false
	}
	createVerb := containsAny(lower,
		"create", "make", "build", "spin up", "new", "start", "launch", "open",
		"bootstrap", "scaffold", "generate", "initialize", "init",
	)
	if !createVerb {
		return false
	}
	return containsAny(lower, "github") || containsAny(lower, "repo", "repository", "project")
}

func looksLikeGitHubSessionsIntent(lower string) bool {
	return containsAny(lower,
		"github sessions", "github session", "repo sessions", "repository sessions",
	) && containsAny(lower, "list", "show", "what", "which", "running", "active")
}

func looksLikeGitHubStatusIntent(lower string) bool {
	if containsAny(lower, "github log", "repo log", "github output", "repo output") {
		return true
	}
	return containsAny(lower, "github session", "repo session") &&
		containsAny(lower, "status", "log", "doing", "progress", "output", "running")
}

func looksLikeGitHubKillIntent(lower string) bool {
	return containsAny(lower, "github session", "repo session") &&
		containsAny(lower, "stop", "kill", "cancel")
}

func looksLikeGitHubContinueIntent(lower string) bool {
	return containsAny(lower,
		"continue the github session", "continue the repo", "continue the repository",
		"tell github claude", "continue the github repo",
	)
}

func looksLikeCodingSessionsIntent(lower string) bool {
	return containsAny(lower,
		"coding sessions", "coding session", "claude sessions", "claude session", "claude code sessions",
	) && containsAny(lower, "list", "show", "what", "which", "running", "active")
}

func looksLikeCodingStatusIntent(lower string) bool {
	if containsAny(lower,
		"show my coding log", "show the coding log", "show my claude log", "show the claude log",
		"what is claude doing", "what's claude doing", "coding log", "claude log",
	) {
		return true
	}
	return containsAny(lower,
		"coding session", "claude session", "claude code session", "active session", "current session",
	) && containsAny(lower, "status", "log", "doing", "progress", "output", "running")
}

func looksLikeCodingKillIntent(lower string) bool {
	return containsAny(lower,
		"stop the coding session", "kill the coding session", "cancel the coding session",
		"stop the claude session", "kill the claude session", "cancel the claude session",
		"stop my coding session", "stop my claude session",
	)
}

func looksLikeClaudeStartIntent(lower string) bool {
	if containsAny(lower,
		"start a claude code session", "start claude code", "open a claude code session",
		"launch a claude code session", "spin up a claude code session", "new claude code session",
		"start a coding session", "open a coding session", "launch a coding session",
		"use claude code to",
	) {
		return true
	}
	return containsAny(lower, "claude code", "coding session") &&
		containsAny(lower, "start", "open", "launch", "spin up", "new", "create", "build")
}

func looksLikeCodingContinueIntent(lower string, hasActive bool) bool {
	if containsAny(lower,
		"continue the coding session", "continue the claude session", "continue the session",
		"tell claude to", "ask claude to", "in claude code", "continue and",
	) {
		return true
	}
	if !hasActive {
		return false
	}
	if strings.HasPrefix(lower, "now ") || strings.HasPrefix(lower, "next ") || strings.HasPrefix(lower, "also ") {
		return true
	}
	if strings.HasPrefix(lower, "add ") || strings.HasPrefix(lower, "build ") || strings.HasPrefix(lower, "implement ") ||
		strings.HasPrefix(lower, "fix ") || strings.HasPrefix(lower, "refactor ") || strings.HasPrefix(lower, "review ") ||
		strings.HasPrefix(lower, "run ") || strings.HasPrefix(lower, "push ") || strings.HasPrefix(lower, "commit ") {
		return true
	}
	return false
}

func stripCodingContinuationPrefix(raw string) string {
	trimmed := strings.TrimSpace(raw)
	patterns := []string{
		"continue the github session and ",
		"continue the github repo and ",
		"continue the coding session and ",
		"continue the claude session and ",
		"continue the session and ",
		"continue and ",
		"tell claude to ",
		"ask claude to ",
		"in claude code ",
	}
	lower := strings.ToLower(trimmed)
	for _, pattern := range patterns {
		if strings.HasPrefix(lower, pattern) {
			return strings.TrimSpace(trimmed[len(pattern):])
		}
	}
	return trimmed
}

func extractCodingSessionID(raw string) string {
	re := regexp.MustCompile(`\b[0-9a-f]{12}\b`)
	return strings.TrimSpace(re.FindString(strings.ToLower(raw)))
}

func isCodingSessionID(raw string) bool {
	return extractCodingSessionID(raw) != ""
}

func firstCodingSessionID(args []string) string {
	if len(args) == 0 {
		return ""
	}
	return extractCodingSessionID(strings.TrimSpace(args[0]))
}

func splitCodingSessionPromptArgs(args []string) (string, string) {
	if len(args) == 0 {
		return "", ""
	}
	if sessionID := firstCodingSessionID(args); sessionID != "" {
		return sessionID, strings.TrimSpace(strings.Join(args[1:], " "))
	}
	return "", strings.TrimSpace(strings.Join(args, " "))
}

func (d *Daemon) lookupCodingSession(msg bus.InboundMessage, sessionID string) (*gatewaypkg.CodingSession, codingIntentBinding, bool) {
	if d == nil || d.codingSessions == nil {
		return nil, codingIntentBinding{}, false
	}

	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return d.activeCodingSession(msg)
	}

	session := d.codingSessions.Get(sessionID)
	if session == nil {
		return nil, codingIntentBinding{}, false
	}

	return session, codingIntentBinding{
		SessionID: session.ID,
		Kind:      inferCodingSessionKind(session),
		Label:     session.Label,
		Workdir:   session.Workdir,
		UpdatedAt: session.UpdatedAt,
	}, true
}

func inferCodingSessionKind(session *gatewaypkg.CodingSession) string {
	if session == nil {
		return "claude"
	}
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(session.Label)), "github:") {
		return "github"
	}
	return "claude"
}

func defaultClaudeAllowedTools() []string {
	return []string{
		"Read",
		"Edit",
		"Write",
		"MultiEdit",
		"Glob",
		"Grep",
		"LS",
		"Bash",
	}
}

func gitCommitAllowedTools() []string {
	return []string{
		"Bash(git diff *)",
		"Bash(git log *)",
		"Bash(git status *)",
		"Bash(git commit *)",
	}
}

func defaultClaudeSystemPrompt(kind string) string {
	base := "You are being operated through the SolanaOS Telegram control plane. Work autonomously, keep logs readable, and make practical engineering progress without filler."
	if strings.EqualFold(strings.TrimSpace(kind), "github") {
		return base + " When working in a GitHub repo session, prefer changes that are ready to inspect, test, and commit."
	}
	return base
}
