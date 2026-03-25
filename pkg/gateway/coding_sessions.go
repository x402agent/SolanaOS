package gateway

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	CodingRuntimeClaude = "claude"

	CodingSessionStatusIdle        = "idle"
	CodingSessionStatusRunning     = "running"
	CodingSessionStatusCompleted   = "completed"
	CodingSessionStatusFailed      = "failed"
	CodingSessionStatusKilled      = "killed"
	CodingSessionStatusInterrupted = "interrupted"
)

type CodingSession struct {
	ID              string             `json:"id"`
	Runtime         string             `json:"runtime"`
	Label           string             `json:"label,omitempty"`
	Workdir         string             `json:"workdir"`
	Model           string             `json:"model,omitempty"`
	PermissionMode  string             `json:"permission_mode,omitempty"`
	AllowedTools    []string           `json:"allowed_tools,omitempty"`
	SystemPrompt    string             `json:"system_prompt,omitempty"`
	ClaudeSessionID string             `json:"claude_session_id,omitempty"`
	Status          string             `json:"status"`
	CurrentRunID    string             `json:"current_run_id,omitempty"`
	LastRunID       string             `json:"last_run_id,omitempty"`
	LastError       string             `json:"last_error,omitempty"`
	LastResult      string             `json:"last_result,omitempty"`
	CreatedAt       time.Time          `json:"created_at"`
	UpdatedAt       time.Time          `json:"updated_at"`
	Runs            []CodingSessionRun `json:"runs,omitempty"`
}

type CodingSessionRun struct {
	ID              string    `json:"id"`
	Prompt          string    `json:"prompt"`
	Status          string    `json:"status"`
	StartedAt       time.Time `json:"started_at"`
	EndedAt         time.Time `json:"ended_at,omitempty"`
	ExitCode        int       `json:"exit_code,omitempty"`
	Result          string    `json:"result,omitempty"`
	Error           string    `json:"error,omitempty"`
	LogPath         string    `json:"log_path,omitempty"`
	ClaudeSessionID string    `json:"claude_session_id,omitempty"`
	DurationMS      int64     `json:"duration_ms,omitempty"`
	TotalCostUSD    float64   `json:"total_cost_usd,omitempty"`
	AllowedTools    []string  `json:"allowed_tools,omitempty"`
	SystemPrompt    string    `json:"system_prompt,omitempty"`
}

type CreateCodingSessionRequest struct {
	Runtime        string   `json:"runtime"`
	Prompt         string   `json:"prompt"`
	Workdir        string   `json:"workdir"`
	Label          string   `json:"label,omitempty"`
	Model          string   `json:"model,omitempty"`
	PermissionMode string   `json:"permission_mode,omitempty"`
	AllowedTools   []string `json:"allowed_tools,omitempty"`
	SystemPrompt   string   `json:"system_prompt,omitempty"`
}

type ContinueCodingSessionRequest struct {
	Prompt       string   `json:"prompt"`
	AllowedTools []string `json:"allowed_tools,omitempty"`
	SystemPrompt string   `json:"system_prompt,omitempty"`
}

type codingRunRequest struct {
	Prompt       string
	AllowedTools []string
	SystemPrompt string
}

type runningCodingSession struct {
	runID  string
	cancel context.CancelFunc
	cmd    *exec.Cmd
}

type CodingSessionManager struct {
	root         string
	anthropicKey string

	mu       sync.RWMutex
	sessions map[string]*CodingSession
	running  map[string]*runningCodingSession
}

func NewCodingSessionManager(root, anthropicKey string) (*CodingSessionManager, error) {
	root = strings.TrimSpace(root)
	if root == "" {
		return nil, fmt.Errorf("coding session root is required")
	}
	if err := os.MkdirAll(filepath.Join(root, "logs"), 0o755); err != nil {
		return nil, err
	}
	m := &CodingSessionManager{
		root:         root,
		anthropicKey: strings.TrimSpace(anthropicKey),
		sessions:     make(map[string]*CodingSession),
		running:      make(map[string]*runningCodingSession),
	}
	if err := m.load(); err != nil {
		return nil, err
	}
	return m, nil
}

func (m *CodingSessionManager) SetAnthropicKey(apiKey string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.anthropicKey = strings.TrimSpace(apiKey)
}

func (m *CodingSessionManager) ClaudeAvailable() bool {
	_, err := exec.LookPath("claude")
	return err == nil
}

func (m *CodingSessionManager) AnthropicConfigured() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if strings.TrimSpace(m.anthropicKey) != "" {
		return true
	}
	return strings.TrimSpace(os.Getenv("ANTHROPIC_API_KEY")) != ""
}

func (m *CodingSessionManager) SupportedRuntimes() []string {
	return []string{CodingRuntimeClaude}
}

func (m *CodingSessionManager) List() []*CodingSession {
	m.mu.RLock()
	defer m.mu.RUnlock()

	out := make([]*CodingSession, 0, len(m.sessions))
	for _, session := range m.sessions {
		out = append(out, cloneCodingSession(session))
	}
	return out
}

func (m *CodingSessionManager) Get(id string) *CodingSession {
	m.mu.RLock()
	defer m.mu.RUnlock()
	session, ok := m.sessions[strings.TrimSpace(id)]
	if !ok {
		return nil
	}
	return cloneCodingSession(session)
}

func (m *CodingSessionManager) Create(req CreateCodingSessionRequest) (*CodingSession, error) {
	runtimeName := strings.ToLower(strings.TrimSpace(req.Runtime))
	if runtimeName == "" {
		runtimeName = CodingRuntimeClaude
	}
	if runtimeName != CodingRuntimeClaude {
		return nil, fmt.Errorf("unsupported coding runtime %q", runtimeName)
	}
	workdir, err := filepath.Abs(strings.TrimSpace(req.Workdir))
	if err != nil {
		return nil, fmt.Errorf("resolve workdir: %w", err)
	}
	info, err := os.Stat(workdir)
	if err != nil {
		return nil, fmt.Errorf("workdir: %w", err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("workdir is not a directory")
	}
	prompt := strings.TrimSpace(req.Prompt)
	if prompt == "" {
		return nil, fmt.Errorf("prompt is required")
	}

	session := &CodingSession{
		ID:             generateShortID(),
		Runtime:        runtimeName,
		Label:          strings.TrimSpace(req.Label),
		Workdir:        workdir,
		Model:          strings.TrimSpace(req.Model),
		PermissionMode: normalizePermissionMode(req.PermissionMode),
		AllowedTools:   normalizeAllowedTools(req.AllowedTools),
		SystemPrompt:   strings.TrimSpace(req.SystemPrompt),
		Status:         CodingSessionStatusIdle,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}

	m.mu.Lock()
	m.sessions[session.ID] = session
	if err := m.persistLocked(session); err != nil {
		m.mu.Unlock()
		return nil, err
	}
	m.mu.Unlock()

	if err := m.startRun(session.ID, codingRunRequest{Prompt: prompt}); err != nil {
		return nil, err
	}
	return m.Get(session.ID), nil
}

func (m *CodingSessionManager) Continue(id, prompt string) (*CodingSession, error) {
	return m.ContinueWithOptions(id, ContinueCodingSessionRequest{Prompt: prompt})
}

func (m *CodingSessionManager) ContinueWithOptions(id string, req ContinueCodingSessionRequest) (*CodingSession, error) {
	if err := m.startRun(strings.TrimSpace(id), codingRunRequest{
		Prompt:       strings.TrimSpace(req.Prompt),
		AllowedTools: req.AllowedTools,
		SystemPrompt: req.SystemPrompt,
	}); err != nil {
		return nil, err
	}
	return m.Get(id), nil
}

func (m *CodingSessionManager) Kill(id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("session id is required")
	}

	m.mu.Lock()
	proc, ok := m.running[id]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("session %s is not running", id)
	}
	session := m.sessions[id]
	if session != nil {
		session.Status = CodingSessionStatusKilled
		session.UpdatedAt = time.Now().UTC()
		if run := findRunByID(session, proc.runID); run != nil {
			run.Status = CodingSessionStatusKilled
			run.Error = "killed by gateway request"
		}
		_ = m.persistLocked(session)
	}
	m.mu.Unlock()

	proc.cancel()
	return nil
}

func (m *CodingSessionManager) ReadLog(id, runID string) (string, *CodingSessionRun, error) {
	m.mu.RLock()
	session, ok := m.sessions[strings.TrimSpace(id)]
	if !ok {
		m.mu.RUnlock()
		return "", nil, fmt.Errorf("session %s not found", id)
	}
	run := findRunForLog(session, runID)
	if run == nil {
		m.mu.RUnlock()
		return "", nil, fmt.Errorf("no run available for session %s", id)
	}
	logPath := run.LogPath
	runCopy := *run
	m.mu.RUnlock()

	data, err := os.ReadFile(logPath)
	if err != nil {
		return "", nil, err
	}
	return string(data), &runCopy, nil
}

func (m *CodingSessionManager) startRun(id string, req codingRunRequest) error {
	req.Prompt = strings.TrimSpace(req.Prompt)
	if req.Prompt == "" {
		return fmt.Errorf("prompt is required")
	}

	m.mu.Lock()
	session, ok := m.sessions[id]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("session %s not found", id)
	}
	if session.Runtime == CodingRuntimeClaude {
		apiKey := strings.TrimSpace(m.anthropicKey)
		if apiKey == "" {
			apiKey = strings.TrimSpace(os.Getenv("ANTHROPIC_API_KEY"))
		}
		if _, err := exec.LookPath("claude"); err != nil {
			m.mu.Unlock()
			return fmt.Errorf("claude CLI not found in PATH")
		}
		if apiKey == "" {
			m.mu.Unlock()
			return fmt.Errorf("ANTHROPIC_API_KEY is not configured")
		}
	}
	if _, running := m.running[id]; running {
		m.mu.Unlock()
		return fmt.Errorf("session %s is already running", id)
	}

	runID := generateShortID()
	run := CodingSessionRun{
		ID:           runID,
		Prompt:       req.Prompt,
		Status:       CodingSessionStatusRunning,
		StartedAt:    time.Now().UTC(),
		LogPath:      filepath.Join(m.root, "logs", id, runID+".log"),
		AllowedTools: effectiveAllowedTools(req.AllowedTools, session.AllowedTools),
		SystemPrompt: effectiveSystemPrompt(req.SystemPrompt, session.SystemPrompt),
	}

	if err := os.MkdirAll(filepath.Dir(run.LogPath), 0o755); err != nil {
		m.mu.Unlock()
		return err
	}

	ctx, cancel := context.WithCancel(context.Background())
	session.Status = CodingSessionStatusRunning
	session.CurrentRunID = runID
	session.LastRunID = runID
	session.UpdatedAt = time.Now().UTC()
	session.LastError = ""
	session.Runs = append(session.Runs, run)
	if err := m.persistLocked(session); err != nil {
		m.mu.Unlock()
		cancel()
		return err
	}
	m.running[id] = &runningCodingSession{runID: runID, cancel: cancel}
	m.mu.Unlock()

	go m.runClaudeSession(ctx, id, runID)
	return nil
}

func (m *CodingSessionManager) runClaudeSession(ctx context.Context, sessionID, runID string) {
	m.mu.RLock()
	session, ok := m.sessions[sessionID]
	if !ok {
		m.mu.RUnlock()
		return
	}
	workdir := session.Workdir
	model := session.Model
	permissionMode := session.PermissionMode
	claudeSessionID := session.ClaudeSessionID
	run := findRunByID(session, runID)
	if run == nil {
		m.mu.RUnlock()
		return
	}
	prompt := run.Prompt
	allowedTools := append([]string(nil), run.AllowedTools...)
	systemPrompt := run.SystemPrompt
	logPath := run.LogPath
	apiKey := m.anthropicKey
	if apiKey == "" {
		apiKey = os.Getenv("ANTHROPIC_API_KEY")
	}
	m.mu.RUnlock()

	if _, err := exec.LookPath("claude"); err != nil {
		m.finishRunWithError(sessionID, runID, fmt.Errorf("claude CLI not found in PATH"))
		return
	}
	if strings.TrimSpace(apiKey) == "" {
		m.finishRunWithError(sessionID, runID, fmt.Errorf("ANTHROPIC_API_KEY is not configured"))
		return
	}

	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		m.finishRunWithError(sessionID, runID, err)
		return
	}
	defer logFile.Close()

	args := buildClaudeArgs(prompt, model, permissionMode, claudeSessionID, allowedTools, systemPrompt)

	cmd := exec.CommandContext(ctx, "claude", args...)
	cmd.Dir = workdir
	cmd.Env = buildClaudeEnv(apiKey)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		m.finishRunWithError(sessionID, runID, err)
		return
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		m.finishRunWithError(sessionID, runID, err)
		return
	}
	if err := cmd.Start(); err != nil {
		m.finishRunWithError(sessionID, runID, err)
		return
	}

	m.mu.Lock()
	if proc := m.running[sessionID]; proc != nil {
		proc.cmd = cmd
	}
	session = m.sessions[sessionID]
	if session != nil {
		session.UpdatedAt = time.Now().UTC()
		_ = m.persistLocked(session)
	}
	m.mu.Unlock()

	var wg sync.WaitGroup
	var writeMu sync.Mutex

	writeLine := func(line string) {
		writeMu.Lock()
		defer writeMu.Unlock()
		_, _ = logFile.WriteString(line + "\n")
	}

	scan := func(reader *bufio.Scanner, parseJSON bool, prefix string) {
		defer wg.Done()
		for reader.Scan() {
			line := reader.Text()
			if prefix != "" {
				writeLine(prefix + line)
			} else {
				writeLine(line)
			}
			if !parseJSON {
				continue
			}
			var frame map[string]any
			if err := json.Unmarshal([]byte(line), &frame); err != nil {
				continue
			}
			m.applyClaudeFrame(sessionID, runID, frame)
		}
		if err := reader.Err(); err != nil {
			writeLine(prefix + "scanner_error: " + err.Error())
		}
	}

	stdoutScanner := bufio.NewScanner(stdout)
	stdoutScanner.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)
	stderrScanner := bufio.NewScanner(stderr)
	stderrScanner.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)

	wg.Add(2)
	go scan(stdoutScanner, true, "")
	go scan(stderrScanner, false, "stderr: ")

	waitErr := cmd.Wait()
	wg.Wait()

	m.finishRun(sessionID, runID, waitErr)
}

func (m *CodingSessionManager) applyClaudeFrame(sessionID, runID string, frame map[string]any) {
	m.mu.Lock()
	defer m.mu.Unlock()

	session := m.sessions[sessionID]
	if session == nil {
		return
	}
	run := findRunByID(session, runID)
	if run == nil {
		return
	}

	if sid := stringField(frame["session_id"]); sid != "" {
		session.ClaudeSessionID = sid
		run.ClaudeSessionID = sid
	}
	if sid := stringField(frame["sessionId"]); sid != "" {
		session.ClaudeSessionID = sid
		run.ClaudeSessionID = sid
	}
	if result := stringField(frame["result"]); result != "" {
		run.Result = result
		session.LastResult = result
	}
	if errText := stringField(frame["error"]); errText != "" && run.Error == "" {
		run.Error = errText
		session.LastError = errText
	}
	if cost := numberField(frame["total_cost_usd"]); cost > 0 {
		run.TotalCostUSD = cost
	}
	if usage, ok := frame["usage"].(map[string]any); ok {
		if cost := numberField(usage["total_cost_usd"]); cost > 0 {
			run.TotalCostUSD = cost
		}
	}
	if cost, ok := frame["cost"].(map[string]any); ok {
		if total := numberField(cost["total_cost_usd"]); total > 0 {
			run.TotalCostUSD = total
		}
	}
	if subtype := stringField(frame["subtype"]); subtype == "success" {
		run.Status = CodingSessionStatusCompleted
		session.Status = CodingSessionStatusCompleted
	}

	session.UpdatedAt = time.Now().UTC()
	_ = m.persistLocked(session)
}

func (m *CodingSessionManager) finishRun(sessionID, runID string, waitErr error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	session := m.sessions[sessionID]
	if session == nil {
		delete(m.running, sessionID)
		return
	}
	run := findRunByID(session, runID)
	if run == nil {
		delete(m.running, sessionID)
		return
	}

	run.EndedAt = time.Now().UTC()
	run.DurationMS = run.EndedAt.Sub(run.StartedAt).Milliseconds()

	switch {
	case errors.Is(waitErr, context.Canceled):
		run.Status = CodingSessionStatusKilled
		if run.Error == "" {
			run.Error = "killed by gateway request"
		}
		session.Status = CodingSessionStatusKilled
		session.LastError = run.Error
	case waitErr != nil:
		run.Status = CodingSessionStatusFailed
		run.Error = waitErr.Error()
		if exitErr, ok := waitErr.(*exec.ExitError); ok {
			run.ExitCode = exitErr.ExitCode()
		}
		session.Status = CodingSessionStatusFailed
		session.LastError = run.Error
	default:
		run.Status = CodingSessionStatusCompleted
		session.Status = CodingSessionStatusCompleted
		session.LastResult = run.Result
	}

	session.CurrentRunID = ""
	session.LastRunID = runID
	session.UpdatedAt = time.Now().UTC()
	delete(m.running, sessionID)
	_ = m.persistLocked(session)
}

func (m *CodingSessionManager) finishRunWithError(sessionID, runID string, err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	session := m.sessions[sessionID]
	if session == nil {
		delete(m.running, sessionID)
		return
	}
	run := findRunByID(session, runID)
	if run != nil {
		run.Status = CodingSessionStatusFailed
		run.EndedAt = time.Now().UTC()
		run.DurationMS = run.EndedAt.Sub(run.StartedAt).Milliseconds()
		run.Error = err.Error()
	}
	session.Status = CodingSessionStatusFailed
	session.CurrentRunID = ""
	session.LastRunID = runID
	session.LastError = err.Error()
	session.UpdatedAt = time.Now().UTC()
	delete(m.running, sessionID)
	_ = m.persistLocked(session)
}

func (m *CodingSessionManager) load() error {
	entries, err := os.ReadDir(m.root)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		path := filepath.Join(m.root, entry.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		var session CodingSession
		if err := json.Unmarshal(data, &session); err != nil {
			continue
		}
		if session.ID == "" {
			continue
		}
		if session.Status == CodingSessionStatusRunning {
			session.Status = CodingSessionStatusInterrupted
			session.CurrentRunID = ""
		}
		session.AllowedTools = normalizeAllowedTools(session.AllowedTools)
		session.SystemPrompt = strings.TrimSpace(session.SystemPrompt)
		for i := range session.Runs {
			session.Runs[i].AllowedTools = normalizeAllowedTools(session.Runs[i].AllowedTools)
			session.Runs[i].SystemPrompt = strings.TrimSpace(session.Runs[i].SystemPrompt)
		}
		m.sessions[session.ID] = &session
	}
	return nil
}

func (m *CodingSessionManager) persistLocked(session *CodingSession) error {
	if session == nil {
		return nil
	}
	path := filepath.Join(m.root, session.ID+".json")
	data, err := json.MarshalIndent(session, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func cloneCodingSession(session *CodingSession) *CodingSession {
	if session == nil {
		return nil
	}
	copy := *session
	copy.AllowedTools = append([]string(nil), session.AllowedTools...)
	copy.Runs = append([]CodingSessionRun(nil), session.Runs...)
	for i := range copy.Runs {
		copy.Runs[i].AllowedTools = append([]string(nil), session.Runs[i].AllowedTools...)
	}
	return &copy
}

func findRunByID(session *CodingSession, runID string) *CodingSessionRun {
	if session == nil {
		return nil
	}
	for i := range session.Runs {
		if session.Runs[i].ID == runID {
			return &session.Runs[i]
		}
	}
	return nil
}

func findRunForLog(session *CodingSession, runID string) *CodingSessionRun {
	if session == nil || len(session.Runs) == 0 {
		return nil
	}
	if strings.TrimSpace(runID) != "" {
		return findRunByID(session, strings.TrimSpace(runID))
	}
	if session.CurrentRunID != "" {
		if run := findRunByID(session, session.CurrentRunID); run != nil {
			return run
		}
	}
	if session.LastRunID != "" {
		if run := findRunByID(session, session.LastRunID); run != nil {
			return run
		}
	}
	return &session.Runs[len(session.Runs)-1]
}

func normalizePermissionMode(mode string) string {
	mode = strings.TrimSpace(mode)
	if mode == "" {
		return "bypassPermissions"
	}
	return mode
}

func normalizeAllowedTools(tools []string) []string {
	if len(tools) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(tools))
	out := make([]string, 0, len(tools))
	for _, tool := range tools {
		tool = strings.TrimSpace(tool)
		if tool == "" {
			continue
		}
		if _, ok := seen[tool]; ok {
			continue
		}
		seen[tool] = struct{}{}
		out = append(out, tool)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func effectiveAllowedTools(runTools, sessionTools []string) []string {
	runTools = normalizeAllowedTools(runTools)
	if len(runTools) > 0 {
		return runTools
	}
	return normalizeAllowedTools(sessionTools)
}

func effectiveSystemPrompt(runPrompt, sessionPrompt string) string {
	runPrompt = strings.TrimSpace(runPrompt)
	if runPrompt != "" {
		return runPrompt
	}
	return strings.TrimSpace(sessionPrompt)
}

func buildClaudeArgs(prompt, model, permissionMode, claudeSessionID string, allowedTools []string, systemPrompt string) []string {
	args := []string{
		"-p",
		"--output-format", "stream-json",
		"--verbose",
		"--include-partial-messages",
	}
	if strings.TrimSpace(permissionMode) != "" {
		args = append(args, "--permission-mode", strings.TrimSpace(permissionMode))
	}
	if strings.TrimSpace(model) != "" {
		args = append(args, "--model", strings.TrimSpace(model))
	}
	if tools := normalizeAllowedTools(allowedTools); len(tools) > 0 {
		args = append(args, "--allowedTools", strings.Join(tools, ","))
	}
	if strings.TrimSpace(systemPrompt) != "" {
		args = append(args, "--append-system-prompt", strings.TrimSpace(systemPrompt))
	}
	if strings.TrimSpace(claudeSessionID) != "" {
		args = append(args, "--resume", strings.TrimSpace(claudeSessionID))
	}
	args = append(args, strings.TrimSpace(prompt))
	return args
}

func stringField(value any) string {
	v, _ := value.(string)
	return strings.TrimSpace(v)
}

func numberField(value any) float64 {
	switch v := value.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case int64:
		return float64(v)
	case json.Number:
		f, _ := v.Float64()
		return f
	default:
		return 0
	}
}

func buildClaudeEnv(anthropicKey string) []string {
	env := append([]string{}, os.Environ()...)
	env = append(env, "ANTHROPIC_API_KEY="+strings.TrimSpace(anthropicKey))
	ghToken := preferredGitHubToken()
	if ghToken != "" && os.Getenv("GH_TOKEN") == "" {
		env = append(env, "GH_TOKEN="+ghToken)
	}
	return env
}

func preferredGitHubToken() string {
	for _, key := range []string{"GH_TOKEN", "GITHUB_PAT", "Github_PAT", "GITHUB_TOKEN"} {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}
