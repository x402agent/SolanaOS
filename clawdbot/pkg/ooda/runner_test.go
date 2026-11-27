package ooda

import (
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"testing"
)

func TestLoopArgsIncludesExplicitOptions(t *testing.T) {
	opts := LoopOptions{
		Ticks:           12,
		SleepSeconds:    0,
		SleepSet:        true,
		Seed:            7,
		SeedSet:         true,
		CommitEvery:     4,
		TUI:             true,
		LLM:             true,
		Goblin:          true,
		PerpsOI:         true,
		PerpsSymbol:     "BTC-PERP",
		PerpsSignalMode: "paper",
		PerpsOIMock:     true,
	}
	got := opts.LoopArgs()
	want := []string{
		"loop.ts",
		"--ticks", "12",
		"--sleep", "0",
		"--seed", "7",
		"--commit-every", "4",
		"--tui",
		"--llm",
		"--goblin",
		"--perps-oi",
		"--perps-symbol", "BTC-PERP",
		"--perps-signal-mode", "paper",
		"--perps-oi-mock",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("LoopArgs() = %#v, want %#v", got, want)
	}
}

func TestPlanAddsTUICommand(t *testing.T) {
	r := New(Config{Dir: "/tmp/clawdbot/ooda", TSX: "tsx"})
	got := r.Plan(LoopOptions{Ticks: 2, TUI: true})
	if !reflect.DeepEqual(got.Loop, []string{"tsx", "loop.ts", "--ticks", "2", "--tui"}) {
		t.Fatalf("Loop command = %#v", got.Loop)
	}
	if !reflect.DeepEqual(got.TUI, []string{"tsx", "tui.ts"}) {
		t.Fatalf("TUI command = %#v", got.TUI)
	}
	if !got.NeedsPipe {
		t.Fatal("expected NeedsPipe")
	}
}

func TestValidateAcceptsCompleteHarness(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "ooda")
	if err := os.MkdirAll(filepath.Join(dir, "node_modules", ".bin"), 0o755); err != nil {
		t.Fatal(err)
	}
	for _, name := range requiredHarnessFiles {
		writeTestFile(t, filepath.Join(dir, name), "{}")
	}
	tsxName := "tsx"
	if runtime.GOOS == "windows" {
		tsxName = "tsx.cmd"
	}
	writeTestFile(t, filepath.Join(dir, "node_modules", ".bin", tsxName), "#!/bin/sh\n")
	if err := os.Chmod(filepath.Join(dir, "node_modules", ".bin", tsxName), 0o755); err != nil {
		t.Fatal(err)
	}

	if err := New(Config{Dir: dir}).Validate(); err != nil {
		t.Fatalf("Validate(): %v", err)
	}
}

func TestValidateReportsMissingNodeDeps(t *testing.T) {
	dir := t.TempDir()
	for _, name := range requiredHarnessFiles {
		writeTestFile(t, filepath.Join(dir, name), "{}")
	}
	err := New(Config{Dir: dir}).Validate()
	if err == nil {
		t.Fatal("Validate() succeeded without tsx dependency")
	}
	if got := err.Error(); !containsAll(got, "npm --prefix", "ci") {
		t.Fatalf("Validate() error = %q", got)
	}
}

func TestFindDirWalksUpToHarness(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "ooda")
	nested := filepath.Join(root, "a", "b")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(nested, 0o755); err != nil {
		t.Fatal(err)
	}
	writeTestFile(t, filepath.Join(dir, "package.json"), "{}")

	got, err := FindDir(nested)
	if err != nil {
		t.Fatal(err)
	}
	if got != dir {
		t.Fatalf("FindDir() = %q, want %q", got, dir)
	}
}

func TestReadJournalTail(t *testing.T) {
	dir := t.TempDir()
	journalDir := filepath.Join(dir, "journal")
	if err := os.MkdirAll(journalDir, 0o755); err != nil {
		t.Fatal(err)
	}
	writeTestFile(t, filepath.Join(journalDir, "ticks.jsonl"), "a\nb\nc\n")

	lines, err := New(Config{Dir: dir, TSX: "tsx"}).ReadJournalTail(2)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(lines, []string{"b", "c"}) {
		t.Fatalf("ReadJournalTail() = %#v", lines)
	}
}

func writeTestFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func containsAll(s string, parts ...string) bool {
	for _, part := range parts {
		if !strings.Contains(s, part) {
			return false
		}
	}
	return true
}
