package config

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

var bootstrapEnvOnce sync.Once

// BootstrapEnv loads local runtime env files without overriding already-set variables.
// Search order is highest-priority first.
func BootstrapEnv() {
	bootstrapEnvOnce.Do(func() {
		for _, candidate := range envCandidates() {
			if err := loadEnvFile(candidate); err != nil {
				fmt.Fprintf(os.Stderr, "[config] env bootstrap warning: %v\n", err)
			}
		}
	})
}

func envCandidates() []string {
	seen := map[string]struct{}{}
	candidates := make([]string, 0, 12)
	add := func(path string) {
		if path == "" {
			return
		}
		clean := filepath.Clean(path)
		if _, ok := seen[clean]; ok {
			return
		}
		seen[clean] = struct{}{}
		candidates = append(candidates, clean)
	}

	if p := firstNonEmptyEnv("SOLANAOS_ENV_FILE", "SOLANAOS_ENV_FILE", "MAWDBOT_ENV_FILE"); p != "" {
		add(p)
	}

	if cwd, err := os.Getwd(); err == nil {
		add(filepath.Join(cwd, ".env.local"))
		add(filepath.Join(cwd, ".env"))
	}

	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		add(filepath.Join(exeDir, ".env.local"))
		add(filepath.Join(exeDir, ".env"))
		add(filepath.Join(filepath.Dir(exeDir), ".env.local"))
		add(filepath.Join(filepath.Dir(exeDir), ".env"))
	}

	home := DefaultHome()
	add(filepath.Join(home, ".env.local"))
	add(filepath.Join(home, ".env"))

	return candidates
}

func loadEnvFile(path string) error {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("open %s: %w", path, err)
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "export ") {
			line = strings.TrimSpace(strings.TrimPrefix(line, "export "))
		}

		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		if key == "" || os.Getenv(key) != "" {
			continue
		}

		value = strings.TrimSpace(value)
		value = strings.Trim(value, "\"")
		value = strings.Trim(value, "'")
		_ = os.Setenv(key, value)
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read %s: %w", path, err)
	}
	return nil
}
