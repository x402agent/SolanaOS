package packaging

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildInfoPlistIsAPPL(t *testing.T) {
	t.Parallel()
	plist := BuildInfoPlist(AppOptions{Version: "1.2.3"})
	if err := ValidateInfoPlist([]byte(plist)); err != nil {
		t.Fatal(err)
	}
	for _, need := range []string{
		"CFBundlePackageType",
		"APPL",
		"Clawd Bot",
		"ai.clawd.ClawdBot",
		"icon.icns",
		"1.2.3",
	} {
		if !strings.Contains(plist, need) {
			t.Fatalf("plist missing %q", need)
		}
	}
}

func TestValidateIconRejectsTinyStub(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	stub := filepath.Join(dir, "icon.icns")
	if err := os.WriteFile(stub, []byte("icns"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := ValidateIcon(stub); err == nil {
		t.Fatal("expected tiny icon to fail")
	}
}

func TestStageDMGRootStudioLayout(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	bin := filepath.Join(dir, "clawdbot-bin")
	if err := os.WriteFile(bin, []byte("#!/bin/sh\necho clawdbot\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	icon := filepath.Join(dir, "icon.icns")
	if err := os.WriteFile(icon, bytesOf(4096), 0o644); err != nil {
		t.Fatal(err)
	}
	root := filepath.Join(dir, "dmg")
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := StageDMGRoot(root, AppOptions{
		Version:    "test",
		BinaryPath: bin,
		IconPath:   icon,
	}); err != nil {
		t.Fatal(err)
	}
	if err := ValidateDMGRoot(root); err != nil {
		t.Fatal(err)
	}
	app := AppBundlePath(root, DefaultAppName)
	if _, err := os.Stat(filepath.Join(app, "Contents", "MacOS", DefaultExecutable)); err != nil {
		t.Fatal(err)
	}
}

func bytesOf(n int) []byte {
	b := make([]byte, n)
	for i := range b {
		b[i] = byte('A' + i%26)
	}
	return b
}
