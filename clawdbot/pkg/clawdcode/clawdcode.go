// Package clawdcode wraps the local Clawd Code TypeScript harness.
package clawdcode

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	DefaultBinary          = "node"
	DefaultEntry           = "dist/cli.js"
	DefaultProvider        = "zai"
	DefaultModel           = "glm-5.2"
	DefaultMode            = "code"
	DefaultThinking        = "enabled"
	DefaultReasoningEffort = "max"
	DefaultTimeout         = 10 * time.Minute
)

type Config struct {
	Dir             string
	Binary          string
	Entry           string
	Provider        string
	Model           string
	Mode            string
	Stream          bool
	Thinking        string
	ReasoningEffort string
	Timeout         time.Duration
}

type Runner struct {
	cfg Config
}

type LaunchPlan struct {
	Command []string          `json:"command"`
	Env     map[string]string `json:"env"`
	Dir     string            `json:"dir"`
	Entry   string            `json:"entry"`
}

func DefaultDir() string {
	home, err := os.UserHomeDir()
	if err != nil || strings.TrimSpace(home) == "" {
		return "clawd-code"
	}
	return filepath.Join(home, "clawd-code")
}

func New(cfg Config) *Runner {
	return &Runner{cfg: normalize(cfg)}
}

func (r *Runner) Config() Config {
	return r.cfg
}

func (r *Runner) Plan(args []string) LaunchPlan {
	sidecarArgs := r.cfg.SidecarArgs(args)
	command := append([]string{r.cfg.Binary, r.cfg.EntryPath()}, sidecarArgs...)
	return LaunchPlan{
		Command: command,
		Env:     r.cfg.EnvOverrides(),
		Dir:     r.cfg.Dir,
		Entry:   r.cfg.EntryPath(),
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
	cmd.Env = r.cfg.Env(os.Environ())
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
		return fmt.Errorf("clawd code binary %q not found; set CLAWDBOT_CLAWD_CODE_BINARY", r.cfg.Binary)
	}
	entry := r.cfg.EntryPath()
	info, err := os.Stat(entry)
	if err != nil {
		return fmt.Errorf("clawd code entry %q not found; set CLAWDBOT_CLAWD_CODE_DIR or CLAWDBOT_CLAWD_CODE_ENTRY", entry)
	}
	if info.IsDir() {
		return fmt.Errorf("clawd code entry %q is a directory", entry)
	}
	return nil
}

func (c Config) EntryPath() string {
	entry := expandPath(strings.TrimSpace(c.Entry))
	if entry == "" {
		entry = DefaultEntry
	}
	if filepath.IsAbs(entry) {
		return filepath.Clean(entry)
	}
	return filepath.Join(c.Dir, entry)
}

func (c Config) SidecarArgs(args []string) []string {
	clean := make([]string, 0, len(args)+1)
	for _, arg := range args {
		if strings.TrimSpace(arg) != "" {
			clean = append(clean, arg)
		}
	}
	if len(clean) == 0 {
		return []string{"repl"}
	}
	first := strings.ToLower(strings.TrimSpace(clean[0]))
	if isDirectCommand(first) {
		return clean
	}
	mode := strings.ToLower(strings.TrimSpace(c.Mode))
	if mode == "" {
		mode = DefaultMode
	}
	return append([]string{mode}, clean...)
}

func (c Config) Env(base []string) []string {
	env := append([]string(nil), base...)
	for key, value := range c.EnvOverrides() {
		env = upsertEnv(env, key, value)
	}
	return env
}

func (c Config) EnvOverrides() map[string]string {
	stream := "false"
	if c.Stream {
		stream = "true"
	}
	return map[string]string{
		"CLAWD_PROVIDER":       c.Provider,
		"CLAWD_MODEL":          c.Model,
		"CLAWD_MODE":           strings.ToLower(c.Mode),
		"CLAWD_STREAM":         stream,
		"ZAI_MODEL":            c.Model,
		"ZAI_THINKING":         c.Thinking,
		"ZAI_REASONING_EFFORT": c.ReasoningEffort,
	}
}

func normalize(c Config) Config {
	c.Dir = expandPath(firstNonEmpty(c.Dir, DefaultDir()))
	c.Binary = firstNonEmpty(c.Binary, DefaultBinary)
	c.Entry = firstNonEmpty(c.Entry, DefaultEntry)
	c.Provider = strings.ToLower(firstNonEmpty(c.Provider, DefaultProvider))
	c.Model = firstNonEmpty(c.Model, DefaultModel)
	c.Mode = strings.ToLower(firstNonEmpty(c.Mode, DefaultMode))
	c.Thinking = strings.ToLower(firstNonEmpty(c.Thinking, DefaultThinking))
	c.ReasoningEffort = strings.ToLower(firstNonEmpty(c.ReasoningEffort, DefaultReasoningEffort))
	if c.Timeout <= 0 {
		c.Timeout = DefaultTimeout
	}
	return c
}

func isDirectCommand(first string) bool {
	first = strings.TrimPrefix(first, "/")
	switch first {
	case "inspect", "models", "provider", "verify", "repl", "code", "chain", "chart",
		"slides", "poster", "trade", "imperial", "research", "image", "voice",
		"wallet", "positions", "funding", "signals", "strategies", "arena", "agents",
		"spinner", "spinners", "goal", "help":
		return true
	default:
		return strings.HasPrefix(first, "-")
	}
}

func upsertEnv(env []string, key, value string) []string {
	prefix := key + "="
	for i, item := range env {
		if strings.HasPrefix(item, prefix) {
			env[i] = prefix + value
			return env
		}
	}
	return append(env, prefix+value)
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

func BoolString(value bool) string {
	return strconv.FormatBool(value)
}
