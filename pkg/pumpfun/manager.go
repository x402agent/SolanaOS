// Package pumpfun manages the two pump.fun TypeScript trading bots
// (mayhem-sniper and ai-trading-bot) as supervised subprocesses inside
// the SolanaOS runtime.  Each bot is started with ts-node (or node for a
// compiled build) in its own directory; stdout/stderr are captured to a
// ring-buffer so the operator can inspect recent logs via Telegram.
package pumpfun

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// BotKind identifies one of the two managed bots.
type BotKind string

const (
	KindSniper BotKind = "sniper"
	KindAIBot  BotKind = "aibot"
)

// BotConfig holds startup parameters for one bot instance.
type BotConfig struct {
	// Extra environment variables injected at launch (KEY=VALUE format).
	Env map[string]string
}

// BotStatus is a JSON-serialisable snapshot returned to Telegram.
type BotStatus struct {
	Kind      BotKind   `json:"kind"`
	Running   bool      `json:"running"`
	PID       int       `json:"pid,omitempty"`
	StartedAt time.Time `json:"started_at,omitempty"`
	Uptime    string    `json:"uptime,omitempty"`
	RecentLog []string  `json:"recent_log,omitempty"`
}

const logRingSize = 40 // lines kept per bot

// botState tracks a single running bot.
type botState struct {
	kind      BotKind
	dir       string // absolute path to the bot directory
	entryFile string // relative path inside dir, e.g. "src/index.ts"
	cmd       *exec.Cmd
	startedAt time.Time
	logRing   []string // circular, newest last
	mu        sync.RWMutex
}

func (s *botState) appendLog(line string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.logRing = append(s.logRing, line)
	if len(s.logRing) > logRingSize {
		s.logRing = s.logRing[len(s.logRing)-logRingSize:]
	}
}

func (s *botState) recentLines(n int) []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if n <= 0 || n > len(s.logRing) {
		n = len(s.logRing)
	}
	out := make([]string, n)
	copy(out, s.logRing[len(s.logRing)-n:])
	return out
}

func (s *botState) isRunning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cmd != nil && (s.cmd.ProcessState == nil || !s.cmd.ProcessState.Exited())
}

// Manager supervises both pump.fun bots.
type Manager struct {
	repoRoot string // absolute path to the SolanaOS repo root
	mu       sync.Mutex
	bots     map[BotKind]*botState
}

// NewManager creates a Manager whose bot directories are resolved relative to
// repoRoot.  It does not start any processes.
func NewManager(repoRoot string) *Manager {
	return &Manager{
		repoRoot: repoRoot,
		bots:     make(map[BotKind]*botState),
	}
}

// botDir returns the absolute directory for a bot.
func (m *Manager) botDir(kind BotKind) string {
	switch kind {
	case KindSniper:
		return filepath.Join(m.repoRoot, "bots", "pumpfun-mayhem-sniper-main")
	case KindAIBot:
		return filepath.Join(m.repoRoot, "bots", "pumpfun-mayhem-ai-trading-bot-main")
	}
	return ""
}

func (m *Manager) entryFile(kind BotKind) string {
	switch kind {
	case KindSniper:
		return "src/index.ts"
	case KindAIBot:
		return "src/index.ts"
	}
	return "src/index.ts"
}

// ensureDeps runs `npm install` in the bot directory if node_modules is absent.
func (m *Manager) ensureDeps(dir string) error {
	nm := filepath.Join(dir, "node_modules")
	if _, err := os.Stat(nm); err == nil {
		return nil // already installed
	}
	log.Printf("[PUMPFUN] installing npm deps in %s", dir)
	cmd := exec.Command("npm", "install", "--prefer-offline")
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("npm install failed: %w\n%s", err, out)
	}
	return nil
}

// Start launches a bot subprocess.  If it is already running, Start is a no-op.
// cfg.Env values are merged on top of the current process environment.
func (m *Manager) Start(kind BotKind, cfg BotConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if s, ok := m.bots[kind]; ok && s.isRunning() {
		return fmt.Errorf("%s is already running (PID %d)", kind, s.cmd.Process.Pid)
	}

	dir := m.botDir(kind)
	if dir == "" {
		return fmt.Errorf("unknown bot kind %q", kind)
	}
	if _, err := os.Stat(dir); err != nil {
		return fmt.Errorf("bot directory not found: %s", dir)
	}

	if err := m.ensureDeps(dir); err != nil {
		return err
	}

	// Resolve ts-node binary
	tsNode, err := exec.LookPath("ts-node")
	if err != nil {
		// Fall back to local node_modules/.bin/ts-node
		tsNode = filepath.Join(dir, "node_modules", ".bin", "ts-node")
		if _, statErr := os.Stat(tsNode); statErr != nil {
			return fmt.Errorf("ts-node not found in PATH or node_modules: %w", err)
		}
	}

	entry := m.entryFile(kind)
	cmd := exec.Command(tsNode, entry)
	cmd.Dir = dir

	// Build env: inherit everything, then layer on cfg.Env
	env := os.Environ()
	for k, v := range cfg.Env {
		env = append(env, k+"="+v)
	}
	// Also source a .env file in the bot dir if present
	dotEnvPath := filepath.Join(dir, ".env")
	if dotEnvBytes, readErr := os.ReadFile(dotEnvPath); readErr == nil {
		for _, line := range strings.Split(string(dotEnvBytes), "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			if strings.Contains(line, "=") {
				env = append(env, line)
			}
		}
	}
	cmd.Env = env

	state := &botState{
		kind:      kind,
		dir:       dir,
		entryFile: entry,
		cmd:       cmd,
		startedAt: time.Now(),
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start %s: %w", kind, err)
	}

	m.bots[kind] = state
	log.Printf("[PUMPFUN] started %s (PID %d)", kind, cmd.Process.Pid)

	// Fan stdout + stderr into the ring buffer
	go pipeToRing(state, stdout, string(kind)+" stdout")
	go pipeToRing(state, stderr, string(kind)+" stderr")

	// Reap the process to avoid zombies
	go func() {
		_ = cmd.Wait()
		log.Printf("[PUMPFUN] %s process exited", kind)
	}()

	return nil
}

// Stop sends SIGTERM (then SIGKILL) to the bot process.
func (m *Manager) Stop(kind BotKind) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	s, ok := m.bots[kind]
	if !ok || s.cmd == nil || s.cmd.Process == nil {
		return fmt.Errorf("%s is not running", kind)
	}
	if err := s.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("kill %s: %w", kind, err)
	}
	delete(m.bots, kind)
	log.Printf("[PUMPFUN] stopped %s", kind)
	return nil
}

// Status returns a snapshot of the bot's runtime state.
func (m *Manager) Status(kind BotKind) BotStatus {
	m.mu.Lock()
	s, ok := m.bots[kind]
	m.mu.Unlock()

	if !ok || !s.isRunning() {
		return BotStatus{Kind: kind, Running: false}
	}

	uptime := time.Since(s.startedAt).Round(time.Second).String()
	return BotStatus{
		Kind:      kind,
		Running:   true,
		PID:       s.cmd.Process.Pid,
		StartedAt: s.startedAt,
		Uptime:    uptime,
		RecentLog: s.recentLines(10),
	}
}

// StatusAll returns a summary of both bots.
func (m *Manager) StatusAll() []BotStatus {
	return []BotStatus{
		m.Status(KindSniper),
		m.Status(KindAIBot),
	}
}

// Logs returns the last n log lines for a bot.
func (m *Manager) Logs(kind BotKind, n int) []string {
	m.mu.Lock()
	s, ok := m.bots[kind]
	m.mu.Unlock()
	if !ok {
		return nil
	}
	return s.recentLines(n)
}

// ConfigJSON returns the current .env file contents for a bot as a map,
// redacting values that look like private keys.
func (m *Manager) ConfigJSON(kind BotKind) (map[string]string, error) {
	dir := m.botDir(kind)
	data, err := os.ReadFile(filepath.Join(dir, ".env"))
	if err != nil {
		return nil, fmt.Errorf("no .env found for %s (create %s/.env)", kind, dir)
	}
	out := map[string]string{}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key, val := parts[0], parts[1]
		if looksLikeSecret(key) {
			val = redact(val)
		}
		out[key] = val
	}
	return out, nil
}

// SetConfig writes key=value pairs to the bot's .env file.
// Existing keys are updated in-place; new keys are appended.
func (m *Manager) SetConfig(kind BotKind, updates map[string]string) error {
	dir := m.botDir(kind)
	envPath := filepath.Join(dir, ".env")

	// Read existing
	var lines []string
	if data, err := os.ReadFile(envPath); err == nil {
		lines = strings.Split(string(data), "\n")
	}

	// Apply updates
	updated := map[string]bool{}
	for i, line := range lines {
		parts := strings.SplitN(strings.TrimSpace(line), "=", 2)
		if len(parts) == 2 {
			if val, ok := updates[parts[0]]; ok {
				lines[i] = parts[0] + "=" + val
				updated[parts[0]] = true
			}
		}
	}
	// Append new keys
	for k, v := range updates {
		if !updated[k] {
			lines = append(lines, k+"="+v)
		}
	}

	content := strings.Join(lines, "\n")
	return os.WriteFile(envPath, []byte(content), 0o600)
}

// MarshalStatus returns a formatted Telegram-friendly status string.
func MarshalStatus(s BotStatus) string {
	if !s.Running {
		return fmt.Sprintf("⛔ *%s* — not running", s.Kind)
	}
	var b strings.Builder
	b.WriteString(fmt.Sprintf("✅ *%s* — running (PID %d)\n", s.Kind, s.PID))
	b.WriteString(fmt.Sprintf("⏱ Uptime: %s\n", s.Uptime))
	if len(s.RecentLog) > 0 {
		b.WriteString("```\n")
		for _, l := range s.RecentLog {
			b.WriteString(l + "\n")
		}
		b.WriteString("```")
	}
	return b.String()
}

// ── helpers ──────────────────────────────────────────────────────────────────

func pipeToRing(s *botState, r io.Reader, label string) {
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		line := scanner.Text()
		log.Printf("[PUMPFUN/%s] %s", label, line)
		s.appendLog(line)
	}
}

func looksLikeSecret(key string) bool {
	up := strings.ToUpper(key)
	for _, kw := range []string{"KEY", "SECRET", "PRIVATE", "TOKEN", "PASSWORD", "PASS"} {
		if strings.Contains(up, kw) {
			return true
		}
	}
	return false
}

func redact(val string) string {
	if len(val) <= 8 {
		return "****"
	}
	return val[:4] + "..." + val[len(val)-4:]
}

// statusJSON is a helper used in tests.
func statusJSON(s BotStatus) string {
	b, _ := json.MarshalIndent(s, "", "  ")
	return string(b)
}
