// Package gateway :: spawn.go
// SolanaOS Gateway tmux session management.
// Orchestrates spawning the native Go bridge in tmux with Tailscale mesh networking.
//
// Native SolanaOS bridge server.
package gateway

import (
	"fmt"
	"os"
	"os/exec"
)

// SpawnConfig holds configuration for auto-spawning the gateway.
type SpawnConfig struct {
	Port         int    // Gateway bridge port (default 18790)
	TMUXSession  string // tmux session name (default "nanoclaw-gw")
	UseTailscale bool   // Bind to Tailscale IP
	LegacyBin    string // DEPRECATED — ignored, uses native bridge
	GatewayFlags string // Extra flags for native gateway
	ForceBind    bool   // Force kill existing listeners
}

// DefaultSpawnConfig returns sensible defaults for gateway spawning.
func DefaultSpawnConfig() SpawnConfig {
	return SpawnConfig{
		Port:         18790,
		TMUXSession:  "nano-gw",
		UseTailscale: true,
		ForceBind:    false,
	}
}

// SpawnResult holds the result of a gateway spawn operation.
type SpawnResult struct {
	TailscaleIP   string
	BridgeAddr    string
	TMUXSession   string
	TermiusString string
	AlreadyExists bool
}

// CheckPrerequisites verifies that required tools are available.
func CheckPrerequisites(cfg SpawnConfig) error {
	// Check tmux
	if _, err := exec.LookPath("tmux"); err != nil {
		return fmt.Errorf("tmux not found — install with: brew install tmux (or apt install tmux)")
	}

	// Check tailscale (optional)
	if cfg.UseTailscale {
		if _, err := exec.LookPath("tailscale"); err != nil {
			return fmt.Errorf("tailscale not found — install from https://tailscale.com/download")
		}
	}

	return nil
}

// TMUXSessionExists checks if a named tmux session already exists.
func TMUXSessionExists(name string) bool {
	err := exec.Command("tmux", "has-session", "-t", name).Run()
	return err == nil
}

// SpawnGateway launches the SolanaOS native gateway in a tmux session.
func SpawnGateway(cfg SpawnConfig) (*SpawnResult, error) {
	if err := CheckPrerequisites(cfg); err != nil {
		return nil, err
	}

	result := &SpawnResult{
		TMUXSession: cfg.TMUXSession,
	}

	// Check existing session
	if TMUXSessionExists(cfg.TMUXSession) {
		result.AlreadyExists = true
		if cfg.UseTailscale {
			if ip, err := DetectTailscaleIP(); err == nil {
				result.TailscaleIP = ip
				result.BridgeAddr = fmt.Sprintf("%s:%d", ip, cfg.Port)
			}
		}
		if result.BridgeAddr == "" {
			result.BridgeAddr = fmt.Sprintf("127.0.0.1:%d", cfg.Port)
		}
		result.TermiusString = buildTermiusString(result)
		return result, nil
	}

	// Get Tailscale IP
	if cfg.UseTailscale {
		ip, err := DetectTailscaleIP()
		if err != nil {
			return nil, err
		}
		result.TailscaleIP = ip
		result.BridgeAddr = fmt.Sprintf("%s:%d", ip, cfg.Port)
	} else {
		result.BridgeAddr = fmt.Sprintf("127.0.0.1:%d", cfg.Port)
	}

	// Build the native gateway command (uses `nano gateway start`)
	// If the nano binary is available, use it; otherwise use `go run`
	nanoBin := "nano"
	if _, err := exec.LookPath(nanoBin); err != nil {
		// Fallback: find the binary in common locations
		for _, path := range []string{"./build/nano", "./nano", "/usr/local/bin/nano-solana"} {
			if _, err := os.Stat(path); err == nil {
				nanoBin = path
				break
			}
		}
	}

	gwCmd := fmt.Sprintf("%s gateway start --port %d", nanoBin, cfg.Port)
	if cfg.UseTailscale && result.TailscaleIP != "" {
		gwCmd += " --bind " + result.TailscaleIP
	}

	// Spawn in tmux
	tmuxArgs := []string{
		"new-session", "-d",
		"-s", cfg.TMUXSession,
		"-n", "gateway",
		gwCmd,
	}

	cmd := exec.Command("tmux", tmuxArgs...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("tmux new-session failed: %w", err)
	}

	result.TermiusString = buildTermiusString(result)
	return result, nil
}

// KillGateway stops the tmux session running the gateway.
func KillGateway(sessionName string) error {
	if sessionName == "" {
		sessionName = "nano-gw"
	}
	if !TMUXSessionExists(sessionName) {
		return fmt.Errorf("tmux session '%s' not found", sessionName)
	}
	return exec.Command("tmux", "kill-session", "-t", sessionName).Run()
}

func buildTermiusString(r *SpawnResult) string {
	if r.TailscaleIP != "" {
		return fmt.Sprintf("ssh user@%s  # then: nano node run --bridge %s", r.TailscaleIP, r.BridgeAddr)
	}
	return fmt.Sprintf("nano node run --bridge %s", r.BridgeAddr)
}
