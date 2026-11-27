package packaging_test

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/x402agent/SolanaOS/clawdbot/pkg/packaging"
)

func repoRoot(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", ".."))
}

func TestRepoPackageJSONExposesClawdbotBin(t *testing.T) {
	t.Parallel()
	meta, err := packaging.LoadRepoPackageJSON(repoRoot(t))
	if err != nil {
		t.Fatalf("LoadRepoPackageJSON: %v", err)
	}
	if err := packaging.ValidateClawdbotPackage(meta); err != nil {
		t.Fatal(err)
	}
	if meta.Bin[packaging.NPMPackageName] != "bin/clawdbot.js" {
		t.Fatalf("bin path = %q, want bin/clawdbot.js", meta.Bin[packaging.NPMPackageName])
	}
}

func TestParsePackageJSONFallbackName(t *testing.T) {
	t.Parallel()
	meta, err := packaging.ParsePackageJSON([]byte(`{"name":"@clawd/clawdbot","bin":{"clawdbot":"bin/clawdbot.js"}}`))
	if err != nil {
		t.Fatal(err)
	}
	if err := packaging.ValidateClawdbotPackage(meta); err != nil {
		t.Fatal(err)
	}
}

func TestStageVendorBinary(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	src := filepath.Join(dir, "clawdbot")
	if err := os.WriteFile(src, []byte("fake-bin"), 0o755); err != nil {
		t.Fatal(err)
	}
	pkgDir := filepath.Join(dir, "npm-pkg")
	dest, err := packaging.StageVendorBinary(pkgDir, src, "darwin", "arm64")
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.Join(pkgDir, packaging.VendorBinaryRelPath("darwin", "arm64"))
	if dest != want {
		t.Fatalf("dest = %s, want %s", dest, want)
	}
	got, err := os.ReadFile(dest)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "fake-bin" {
		t.Fatalf("copied bytes = %q", got)
	}
}
