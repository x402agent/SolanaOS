// Package fileutil provides file operation helpers for MawdBot.
// Adapted from PicoClaw — restricted workspace file ops.
package fileutil

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// EnsureDir creates a directory and all parents if it doesn't exist.
func EnsureDir(path string) error {
	return os.MkdirAll(path, 0755)
}

// ReadFileSafe reads a file, rejecting paths outside the workspace.
func ReadFileSafe(workspace, relPath string) ([]byte, error) {
	abs, err := SafeJoin(workspace, relPath)
	if err != nil {
		return nil, err
	}
	return os.ReadFile(abs)
}

// WriteFileSafe writes a file, rejecting paths outside the workspace.
func WriteFileSafe(workspace, relPath string, data []byte) error {
	abs, err := SafeJoin(workspace, relPath)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0755); err != nil {
		return err
	}
	return os.WriteFile(abs, data, 0644)
}

// SafeJoin joins a workspace root with a relative path,
// rejecting directory traversal attempts.
func SafeJoin(root, relPath string) (string, error) {
	abs := filepath.Join(root, relPath)
	clean := filepath.Clean(abs)
	if !strings.HasPrefix(clean, filepath.Clean(root)) {
		return "", fmt.Errorf("path escapes workspace: %s", relPath)
	}
	return clean, nil
}

// Exists checks if a file or directory exists.
func Exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// AtomicWrite writes data to a file using a temp+rename pattern for crash safety.
func AtomicWrite(path string, data []byte) error {
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
