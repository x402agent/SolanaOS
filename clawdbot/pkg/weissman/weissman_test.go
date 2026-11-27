package weissman

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestAnalyzeCompressibleCorpus(t *testing.T) {
	// Highly repetitive data compresses well and is under budget.
	corpus := bytes.Repeat([]byte("clawdbot pied piper middle out compression\n"), 5000)
	r := Analyze(corpus, 3)
	if r.RawBytes != int64(len(corpus)) {
		t.Fatalf("RawBytes = %d, want %d", r.RawBytes, len(corpus))
	}
	if !r.UnderTarget {
		t.Fatalf("expected under %d-byte target, raw=%d", TargetBytes, r.RawBytes)
	}
	if r.GzipRatio <= 1 || r.ZstdRatio <= 1 {
		t.Fatalf("expected compression ratios > 1, gzip=%.2f zstd=%.2f", r.GzipRatio, r.ZstdRatio)
	}
	if r.WeissmanScore <= 0 {
		t.Fatalf("expected positive Weissman score, got %.4f", r.WeissmanScore)
	}
	if r.Verdict == "" {
		t.Fatal("expected a verdict")
	}
}

func TestAnalyzeEmpty(t *testing.T) {
	r := Analyze(nil, 0)
	if r.WeissmanScore != 0 || r.Verdict != "no source found" {
		t.Fatalf("empty corpus mishandled: score=%.4f verdict=%q", r.WeissmanScore, r.Verdict)
	}
}

func TestPctOfTargetAndOverBudget(t *testing.T) {
	// Random-ish incompressible data larger than the target trips over-budget.
	big := make([]byte, TargetBytes+100)
	for i := range big {
		big[i] = byte((i*2654435761 + 1013904223) >> 16)
	}
	r := Analyze(big, 1)
	if r.UnderTarget {
		t.Fatal("expected over-budget for a corpus larger than target")
	}
	if r.PctOfTarget <= 100 {
		t.Fatalf("PctOfTarget = %.1f, want > 100", r.PctOfTarget)
	}
	if r.Verdict != "over budget — trim the tree" {
		t.Fatalf("verdict = %q, want over-budget", r.Verdict)
	}
}

func TestWeissmanStandardScoresOne(t *testing.T) {
	// Comparing the standard compressor to itself (same ratio, same time) yields
	// exactly 1.0 — the defining property of the score's alpha scaling.
	if got := weissman(2.5, 2.5, 1000, 1000); got != 1.0 {
		t.Fatalf("weissman(self) = %.6f, want 1.0", got)
	}
	// A better ratio at equal time must exceed 1.0.
	if got := weissman(3.0, 2.5, 1000, 1000); got <= 1.0 {
		t.Fatalf("better ratio scored %.4f, want > 1.0", got)
	}
}

func TestScanSourceSkipsAndCounts(t *testing.T) {
	dir := t.TempDir()
	mustWrite(t, filepath.Join(dir, "a.go"), "package a\n")
	mustWrite(t, filepath.Join(dir, "b.md"), "# doc\n")
	mustWrite(t, filepath.Join(dir, "bin.png"), "not source")
	mustWrite(t, filepath.Join(dir, "node_modules", "junk.js"), "should be skipped")

	corpus, files, err := ScanSource(dir)
	if err != nil {
		t.Fatal(err)
	}
	if files != 2 {
		t.Fatalf("counted %d source files, want 2 (.go + .md)", files)
	}
	if len(corpus) == 0 {
		t.Fatal("expected non-empty corpus")
	}
}

func mustWrite(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}
