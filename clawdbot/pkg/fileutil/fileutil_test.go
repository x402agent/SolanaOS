package fileutil

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSafeJoin(t *testing.T) {
	t.Parallel()

	parent := t.TempDir()
	root := filepath.Join(parent, "workspace")
	if err := os.Mkdir(root, 0o755); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name    string
		relPath string
		wantErr bool
	}{
		{name: "nested local path", relPath: filepath.Join("notes", "today.md")},
		{name: "current directory", relPath: "."},
		{name: "parent traversal", relPath: filepath.Join("..", "secret.txt"), wantErr: true},
		{name: "sibling prefix escape", relPath: filepath.Join("..", "workspace-evil", "secret.txt"), wantErr: true},
		{name: "absolute path", relPath: filepath.Join(parent, "outside.txt"), wantErr: true},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := SafeJoin(root, tt.relPath)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("SafeJoin(%q) returned %q, want error", tt.relPath, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("SafeJoin(%q): %v", tt.relPath, err)
			}
			rel, err := filepath.Rel(root, got)
			if err != nil {
				t.Fatal(err)
			}
			if rel == ".." || rel == "."+string(os.PathSeparator) || filepath.IsAbs(rel) {
				t.Fatalf("SafeJoin(%q) returned path outside root: %q", tt.relPath, got)
			}
		})
	}
}

func TestWriteFileSafeRejectsSiblingPrefixEscape(t *testing.T) {
	t.Parallel()

	parent := t.TempDir()
	root := filepath.Join(parent, "workspace")
	sibling := filepath.Join(parent, "workspace-evil")
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(sibling, 0o755); err != nil {
		t.Fatal(err)
	}

	err := WriteFileSafe(root, filepath.Join("..", "workspace-evil", "owned.txt"), []byte("owned"))
	if err == nil {
		t.Fatal("WriteFileSafe accepted sibling-prefix traversal")
	}
	if _, statErr := os.Stat(filepath.Join(sibling, "owned.txt")); !os.IsNotExist(statErr) {
		t.Fatalf("unexpected file outside workspace, stat err: %v", statErr)
	}
}
