// Package ooda wraps the local TypeScript OODA paper/devnet harness.
package ooda

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

const (
	DefaultDirName = "ooda"
	DefaultTimeout = 0
)

var requiredHarnessFiles = []string{
	"package.json",
	"package-lock.json",
	"tsconfig.json",
	"loop.ts",
	"tui.ts",
	"CLAWD.md",
	"journal.ts",
	"state.ts",
	"observe.ts",
	"validate.ts",
	"clawd-decision.ts",
}

type Config struct {
	Dir     string
	TSX     string
	Timeout time.Duration
}

type Runner struct {
	cfg Config
}

type LoopOptions struct {
	Ticks           int
	SleepSeconds    float64
	SleepSet        bool
	Seed            int
	SeedSet         bool
	CommitEvery     int
	TUI             bool
	LLM             bool
	Goblin          bool
	PerpsOI         bool
	PerpsSymbol     string
	PerpsSignalMode string
	PerpsOIMock     bool
}

type LaunchPlan struct {
	Dir       string   `json:"dir"`
	Loop      []string `json:"loop"`
	TUI       []string `json:"tui,omitempty"`
	Journal   string   `json:"journal"`
	NeedsPipe bool     `json:"needs_pipe"`
}

func New(cfg Config) *Runner {
	return &Runner{cfg: normalize(cfg)}
}

func (r *Runner) Config() Config {
	return r.cfg
}

func (r *Runner) Plan(opts LoopOptions) LaunchPlan {
	loop := append([]string{r.cfg.TSXCommand()}, opts.LoopArgs()...)
	var tui []string
	if opts.TUI {
		tui = []string{r.cfg.TSXCommand(), "tui.ts"}
	}
	return LaunchPlan{
		Dir:       r.cfg.Dir,
		Loop:      loop,
		TUI:       tui,
		Journal:   r.JournalPath(),
		NeedsPipe: opts.TUI,
	}
}

func (r *Runner) Validate() error {
	info, err := os.Stat(r.cfg.Dir)
	if err != nil {
		return fmt.Errorf("OODA harness dir %q not found; set CLAWDBOT_OODA_DIR or run from the repo root", r.cfg.Dir)
	}
	if !info.IsDir() {
		return fmt.Errorf("OODA harness dir %q is not a directory", r.cfg.Dir)
	}
	for _, name := range requiredHarnessFiles {
		path := filepath.Join(r.cfg.Dir, name)
		if stat, err := os.Stat(path); err != nil {
			return fmt.Errorf("OODA harness file %q missing", path)
		} else if stat.IsDir() {
			return fmt.Errorf("OODA harness file %q is a directory", path)
		}
	}
	if _, err := resolveExecutable(r.cfg.TSXCommand()); err != nil {
		return fmt.Errorf("OODA TypeScript runner %q not available; run `npm --prefix %s ci` or set CLAWDBOT_OODA_TSX: %w", r.cfg.TSXCommand(), r.cfg.Dir, err)
	}
	return nil
}

func (r *Runner) RunAttached(ctx context.Context, opts LoopOptions) error {
	if err := r.Validate(); err != nil {
		return err
	}

	runCtx := ctx
	cancel := func() {}
	if r.cfg.Timeout > 0 {
		runCtx, cancel = context.WithTimeout(ctx, r.cfg.Timeout)
	}
	defer cancel()

	plan := r.Plan(opts)
	if !opts.TUI {
		err := runCommand(runCtx, plan.Dir, plan.Loop, os.Stdin, os.Stdout, os.Stderr)
		if err != nil && runCtx.Err() != nil {
			return runCtx.Err()
		}
		return err
	}

	err := runPiped(runCtx, plan.Dir, plan.Loop, plan.TUI)
	if err != nil && runCtx.Err() != nil {
		return runCtx.Err()
	}
	return err
}

func (r *Runner) JournalPath() string {
	return filepath.Join(r.cfg.Dir, "journal", "ticks.jsonl")
}

func (r *Runner) ReadJournalTail(n int) ([]string, error) {
	if n <= 0 {
		n = 20
	}
	data, err := os.ReadFile(r.JournalPath())
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	lines := strings.Split(strings.TrimRight(string(data), "\n"), "\n")
	if len(lines) == 1 && lines[0] == "" {
		return nil, nil
	}
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}
	return lines, nil
}

func (o LoopOptions) LoopArgs() []string {
	args := []string{"loop.ts"}
	if o.Ticks > 0 {
		args = append(args, "--ticks", strconv.Itoa(o.Ticks))
	}
	if o.SleepSet {
		args = append(args, "--sleep", strconv.FormatFloat(o.SleepSeconds, 'f', -1, 64))
	}
	if o.SeedSet {
		args = append(args, "--seed", strconv.Itoa(o.Seed))
	}
	if o.CommitEvery > 0 {
		args = append(args, "--commit-every", strconv.Itoa(o.CommitEvery))
	}
	if o.TUI {
		args = append(args, "--tui")
	}
	if o.LLM {
		args = append(args, "--llm")
	}
	if o.Goblin {
		args = append(args, "--goblin")
	}
	if o.PerpsOI {
		args = append(args, "--perps-oi")
	}
	if strings.TrimSpace(o.PerpsSymbol) != "" {
		args = append(args, "--perps-symbol", strings.TrimSpace(o.PerpsSymbol))
	}
	if strings.TrimSpace(o.PerpsSignalMode) != "" {
		args = append(args, "--perps-signal-mode", strings.TrimSpace(o.PerpsSignalMode))
	}
	if o.PerpsOIMock {
		args = append(args, "--perps-oi-mock")
	}
	return args
}

func (c Config) TSXCommand() string {
	if strings.TrimSpace(c.TSX) != "" {
		return strings.TrimSpace(c.TSX)
	}
	name := "tsx"
	if runtime.GOOS == "windows" {
		name = "tsx.cmd"
	}
	return filepath.Join(c.Dir, "node_modules", ".bin", name)
}

func FindDir(start string) (string, error) {
	if strings.TrimSpace(start) == "" {
		start = "."
	}
	dir, err := filepath.Abs(expandPath(start))
	if err != nil {
		return "", err
	}
	for {
		candidate := filepath.Join(dir, DefaultDirName)
		if _, err := os.Stat(filepath.Join(candidate, "package.json")); err == nil {
			return candidate, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("could not find %s/package.json from %s", DefaultDirName, start)
		}
		dir = parent
	}
}

func normalize(c Config) Config {
	if strings.TrimSpace(c.Dir) == "" {
		c.Dir = os.Getenv("CLAWDBOT_OODA_DIR")
	}
	if strings.TrimSpace(c.Dir) == "" {
		if found, err := FindDir("."); err == nil {
			c.Dir = found
		} else {
			c.Dir = DefaultDirName
		}
	}
	c.Dir = expandPath(c.Dir)
	if abs, err := filepath.Abs(c.Dir); err == nil {
		c.Dir = abs
	}
	if strings.TrimSpace(c.TSX) == "" {
		c.TSX = os.Getenv("CLAWDBOT_OODA_TSX")
	}
	if c.Timeout < 0 {
		c.Timeout = DefaultTimeout
	}
	return c
}

func runCommand(ctx context.Context, dir string, argv []string, stdin io.Reader, stdout, stderr io.Writer) error {
	if len(argv) == 0 {
		return fmt.Errorf("empty command")
	}
	cmd := exec.CommandContext(ctx, argv[0], argv[1:]...)
	cmd.Dir = dir
	cmd.Env = os.Environ()
	cmd.Stdin = stdin
	cmd.Stdout = stdout
	cmd.Stderr = stderr
	return cmd.Run()
}

func runPiped(ctx context.Context, dir string, loopArgv, tuiArgv []string) error {
	if len(loopArgv) == 0 || len(tuiArgv) == 0 {
		return fmt.Errorf("empty OODA pipe command")
	}

	reader, writer := io.Pipe()
	tuiCmd := exec.CommandContext(ctx, tuiArgv[0], tuiArgv[1:]...)
	tuiCmd.Dir = dir
	tuiCmd.Env = os.Environ()
	tuiCmd.Stdin = reader
	tuiCmd.Stdout = os.Stdout
	tuiCmd.Stderr = os.Stderr

	loopCmd := exec.CommandContext(ctx, loopArgv[0], loopArgv[1:]...)
	loopCmd.Dir = dir
	loopCmd.Env = os.Environ()
	loopCmd.Stdin = os.Stdin
	loopCmd.Stdout = writer
	loopCmd.Stderr = os.Stderr

	if err := tuiCmd.Start(); err != nil {
		_ = reader.CloseWithError(err)
		_ = writer.CloseWithError(err)
		return err
	}
	if err := loopCmd.Start(); err != nil {
		_ = writer.CloseWithError(err)
		_ = reader.CloseWithError(err)
		if tuiCmd.Process != nil {
			_ = tuiCmd.Process.Kill()
		}
		_ = tuiCmd.Wait()
		return err
	}

	loopErr := loopCmd.Wait()
	_ = writer.CloseWithError(loopErr)
	tuiErr := tuiCmd.Wait()
	_ = reader.Close()
	if loopErr != nil {
		return loopErr
	}
	return tuiErr
}

func resolveExecutable(command string) (string, error) {
	command = strings.TrimSpace(command)
	if command == "" {
		return "", fmt.Errorf("empty executable")
	}
	if filepath.IsAbs(command) || strings.Contains(command, string(os.PathSeparator)) {
		info, err := os.Stat(command)
		if err != nil {
			return "", err
		}
		if info.IsDir() {
			return "", fmt.Errorf("%s is a directory", command)
		}
		return command, nil
	}
	return exec.LookPath(command)
}

func expandPath(path string) string {
	path = strings.TrimSpace(path)
	if path == "~" {
		if home, err := os.UserHomeDir(); err == nil {
			return home
		}
	}
	if strings.HasPrefix(path, "~/") {
		if home, err := os.UserHomeDir(); err == nil {
			return filepath.Join(home, strings.TrimPrefix(path, "~/"))
		}
	}
	return path
}
