package zkomni

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const (
	DefaultBinary  = "node"
	DefaultEntry   = "dist/cli.js"
	DefaultTimeout = 2 * time.Minute
)

// Config launches the @clawd/zk-shark-agent TypeScript CLI.
type Config struct {
	Dir     string
	Binary  string
	Entry   string
	Timeout time.Duration
}

// Runner wraps node zk-primitives/agent the same way clawdcode wraps clawd-code.
type Runner struct {
	cfg Config
}

// LaunchPlan is a dry-run command line for the sidecar (no exec).
type LaunchPlan struct {
	Command []string `json:"command"`
	Dir     string   `json:"dir"`
	Entry   string   `json:"entry"`
	Agent   string   `json:"agent"`
}

func New(cfg Config) *Runner {
	return &Runner{cfg: normalizeAgentConfig(cfg)}
}

func (r *Runner) Config() Config {
	return r.cfg
}

func (r *Runner) Plan(args []string) LaunchPlan {
	entry := r.cfg.EntryPath()
	command := append([]string{r.cfg.Binary, entry}, r.cfg.SidecarArgs(args)...)
	return LaunchPlan{
		Command: command,
		Dir:     r.cfg.AgentDir(),
		Entry:   entry,
		Agent:   AgentID,
	}
}

func (r *Runner) RunAttached(ctx context.Context, args []string) error {
	if err := r.Validate(); err != nil {
		return err
	}
	runCtx := ctx
	cancel := func() {}
	if r.cfg.Timeout > 0 {
		runCtx, cancel = context.WithTimeout(ctx, r.cfg.Timeout)
	}
	defer cancel()

	argv := append([]string{r.cfg.EntryPath()}, r.cfg.SidecarArgs(args)...)
	cmd := exec.CommandContext(runCtx, r.cfg.Binary, argv...)
	cmd.Dir = r.cfg.AgentDir()
	cmd.Env = os.Environ()
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		if runCtx.Err() != nil {
			return runCtx.Err()
		}
		return err
	}
	return nil
}

func (r *Runner) Validate() error {
	if _, err := exec.LookPath(r.cfg.Binary); err != nil {
		return fmt.Errorf("zkomni binary %q not found", r.cfg.Binary)
	}
	entry := r.cfg.EntryPath()
	info, err := os.Stat(entry)
	if err != nil {
		return fmt.Errorf("zkomni entry %q not found; build zk-primitives/agent or set CLAWDBOT_ZK_PRIMITIVES_DIR", entry)
	}
	if info.IsDir() {
		return fmt.Errorf("zkomni entry %q is a directory", entry)
	}
	return nil
}

func (c Config) AgentDir() string {
	return AgentDir(c.Dir)
}

func (c Config) EntryPath() string {
	entry := expandPath(strings.TrimSpace(c.Entry))
	if entry == "" {
		entry = DefaultEntry
	}
	if filepath.IsAbs(entry) {
		return filepath.Clean(entry)
	}
	return filepath.Join(c.AgentDir(), entry)
}

func (c Config) SidecarArgs(args []string) []string {
	clean := make([]string, 0, len(args)+1)
	for _, arg := range args {
		if strings.TrimSpace(arg) != "" {
			clean = append(clean, arg)
		}
	}
	if len(clean) == 0 {
		return []string{"inspect"}
	}
	first := strings.ToLower(strings.TrimSpace(clean[0]))
	if isAgentCommand(first) {
		return clean
	}
	return append([]string{"ask"}, clean...)
}

func normalizeAgentConfig(c Config) Config {
	c.Dir = expandPath(firstNonEmpty(c.Dir, DefaultDir()))
	c.Binary = firstNonEmpty(c.Binary, DefaultBinary)
	c.Entry = firstNonEmpty(c.Entry, DefaultEntry)
	if c.Timeout <= 0 {
		c.Timeout = DefaultTimeout
	}
	return c
}

func isAgentCommand(first string) bool {
	first = strings.TrimPrefix(first, "/")
	switch first {
	case "inspect", "attest", "commit", "verify", "nullifier", "ask", "help":
		return true
	default:
		return strings.HasPrefix(first, "-")
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func expandPath(path string) string {
	path = os.ExpandEnv(strings.TrimSpace(path))
	if path == "~" {
		if home, err := os.UserHomeDir(); err == nil {
			return home
		}
	}
	if strings.HasPrefix(path, "~/") {
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, path[2:])
		}
	}
	return filepath.Clean(path)
}
