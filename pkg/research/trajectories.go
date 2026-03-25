package research

import (
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type TrajectoryTurn struct {
	SessionID string            `json:"session_id"`
	UserID    string            `json:"user_id"`
	Channel   string            `json:"channel"`
	Role      string            `json:"role"`
	Content   string            `json:"content"`
	Intent    string            `json:"intent"`
	Metadata  map[string]string `json:"metadata,omitempty"`
	CreatedAt time.Time         `json:"created_at"`
}

type TrajectorySummary struct {
	Root              string `json:"root"`
	CurrentFile       string `json:"current_file"`
	TurnsCaptured     int    `json:"turns_captured"`
	CompressedBatches int    `json:"compressed_batches"`
}

type TrajectoryArchive struct {
	mu        sync.Mutex
	root      string
	atropos   string
	batchSize int
	compress  bool
	counter   int
}

func NewTrajectoryArchive(root, atroposDir string, batchSize int, compress bool) *TrajectoryArchive {
	if batchSize <= 0 {
		batchSize = 100
	}
	return &TrajectoryArchive{
		root:      root,
		atropos:   atroposDir,
		batchSize: batchSize,
		compress:  compress,
	}
}

func (a *TrajectoryArchive) Init() error {
	if a == nil {
		return nil
	}
	if err := os.MkdirAll(a.root, 0o755); err != nil {
		return err
	}
	if err := os.MkdirAll(a.atropos, 0o755); err != nil {
		return err
	}
	spec := map[string]any{
		"name":         "SolanaOS Atropos Environment",
		"observations": []string{"session", "role", "content", "intent", "channel"},
		"actions":      []string{"reply", "tool_call", "schedule", "delegate", "memory_write"},
		"reward_hints": []string{"task_completion", "user_alignment", "tool_efficiency", "durable_learning"},
	}
	data, err := json.MarshalIndent(spec, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(a.atropos, "env.json"), data, 0o644)
}

func (a *TrajectoryArchive) Capture(turn TrajectoryTurn) error {
	if a == nil {
		return nil
	}
	if turn.CreatedAt.IsZero() {
		turn.CreatedAt = time.Now().UTC()
	}
	a.mu.Lock()
	defer a.mu.Unlock()

	path := a.currentPath(turn.CreatedAt)
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return err
	}
	defer f.Close()

	enc, err := json.Marshal(turn)
	if err != nil {
		return err
	}
	if _, err := f.Write(append(enc, '\n')); err != nil {
		return err
	}
	a.counter++
	if a.compress && a.counter%a.batchSize == 0 {
		_, err := a.compressSnapshotLocked(path, turn.CreatedAt)
		return err
	}
	return nil
}

func (a *TrajectoryArchive) Summary() (TrajectorySummary, error) {
	if a == nil {
		return TrajectorySummary{}, nil
	}
	a.mu.Lock()
	defer a.mu.Unlock()

	files, err := filepath.Glob(filepath.Join(a.root, "*.jsonl"))
	if err != nil {
		return TrajectorySummary{}, err
	}
	gzFiles, err := filepath.Glob(filepath.Join(a.root, "*.jsonl.gz"))
	if err != nil {
		return TrajectorySummary{}, err
	}
	current := ""
	if len(files) > 0 {
		current = files[len(files)-1]
	}
	return TrajectorySummary{
		Root:              a.root,
		CurrentFile:       current,
		TurnsCaptured:     a.counter,
		CompressedBatches: len(gzFiles),
	}, nil
}

func (a *TrajectoryArchive) BackupNow() (string, error) {
	if a == nil {
		return "", nil
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	path := a.currentPath(time.Now().UTC())
	if !a.compress {
		return path, nil
	}
	return a.compressSnapshotLocked(path, time.Now().UTC())
}

func (a *TrajectoryArchive) currentPath(ts time.Time) string {
	if ts.IsZero() {
		ts = time.Now().UTC()
	}
	return filepath.Join(a.root, ts.Format("2006-01-02")+".jsonl")
}

func (a *TrajectoryArchive) compressSnapshotLocked(path string, ts time.Time) (string, error) {
	if _, err := os.Stat(path); err != nil {
		return "", err
	}
	dst := filepath.Join(a.root, fmt.Sprintf("%s-%d.jsonl.gz", ts.Format("20060102-150405"), a.counter))
	in, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return "", err
	}
	defer out.Close()

	gz := gzip.NewWriter(out)
	if _, err := io.Copy(gz, in); err != nil {
		_ = gz.Close()
		return "", err
	}
	if err := gz.Close(); err != nil {
		return "", err
	}
	return dst, nil
}

func IntentFromContent(content string) string {
	lower := strings.ToLower(strings.TrimSpace(content))
	switch {
	case strings.Contains(lower, "delegate"), strings.Contains(lower, "parallel"):
		return "delegation"
	case strings.Contains(lower, "schedule"), strings.Contains(lower, "daily"), strings.Contains(lower, "weekly"):
		return "automation"
	case strings.Contains(lower, "memory"), strings.Contains(lower, "learn"), strings.Contains(lower, "skill"):
		return "learning"
	default:
		return "general"
	}
}
