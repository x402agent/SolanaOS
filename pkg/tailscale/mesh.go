package tailscale

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// Mesh manages the Tailscale connection for cross-origin gateway access.
type Mesh struct {
	hostname   string
	authKey    string
	controlURL string
	stateDir   string
	logger     *slog.Logger
	started    bool
}

// NewMesh creates a Tailscale mesh manager.
func NewMesh(hostname, authKey, controlURL, stateDir string, logger *slog.Logger) *Mesh {
	return &Mesh{
		hostname:   hostname,
		authKey:    authKey,
		controlURL: controlURL,
		stateDir:   expandPath(stateDir),
		logger:     logger,
	}
}

// Start brings up the Tailscale connection using the system daemon.
func (m *Mesh) Start(ctx context.Context) error {
	if err := os.MkdirAll(m.stateDir, 0700); err != nil {
		return fmt.Errorf("create state dir: %w", err)
	}

	// Check if tailscale is available
	_, err := exec.LookPath("tailscale")
	if err != nil {
		return fmt.Errorf("tailscale binary not found in PATH — install from https://tailscale.com/download")
	}

	// Check current status
	status, err := m.status(ctx)
	if err == nil && strings.Contains(status, "online") {
		m.logger.Info("tailscale already connected", "hostname", m.hostname)
		m.started = true
		return nil
	}

	// Bring up tailscale
	args := []string{"up", "--hostname=" + m.hostname}
	if m.authKey != "" {
		args = append(args, "--authkey="+m.authKey)
	}
	if m.controlURL != "" {
		args = append(args, "--login-server="+m.controlURL)
	}

	cmd := exec.CommandContext(ctx, "tailscale", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	m.logger.Info("starting tailscale", "hostname", m.hostname, "args", args)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("tailscale up: %w", err)
	}

	// Wait for connection
	for i := 0; i < 30; i++ {
		status, err := m.status(ctx)
		if err == nil && strings.Contains(status, "online") {
			m.started = true
			m.logger.Info("tailscale connected", "hostname", m.hostname)
			return nil
		}
		time.Sleep(time.Second)
	}
	return fmt.Errorf("tailscale did not come online within 30s")
}

// GetListener returns a net.Listener on the Tailscale network.
// This allows the gateway to listen on the Tailscale IP for cross-device access.
func (m *Mesh) GetListener(ctx context.Context, port int) (net.Listener, error) {
	ip, err := m.IP(ctx)
	if err != nil {
		return nil, fmt.Errorf("get tailscale ip: %w", err)
	}

	addr := fmt.Sprintf("%s:%d", ip, port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("listen on tailscale %s: %w", addr, err)
	}

	m.logger.Info("listening on tailscale", "addr", addr)
	return ln, nil
}

// IP returns the Tailscale IPv4 address.
func (m *Mesh) IP(ctx context.Context) (string, error) {
	cmd := exec.CommandContext(ctx, "tailscale", "ip", "-4")
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("tailscale ip: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}

// Hostname returns the configured Tailscale hostname.
func (m *Mesh) Hostname() string {
	return m.hostname
}

// FQDN returns the full Tailscale domain name.
func (m *Mesh) FQDN(_ context.Context) (string, error) {
	// Simplified: return hostname.tailnet
	return m.hostname + ".tailnet", nil
}

// IsConnected checks if Tailscale is currently online.
func (m *Mesh) IsConnected(ctx context.Context) bool {
	status, err := m.status(ctx)
	return err == nil && strings.Contains(status, "online")
}

// Status returns the current Tailscale status string.
func (m *Mesh) Status(ctx context.Context) string {
	s, err := m.status(ctx)
	if err != nil {
		return "error: " + err.Error()
	}
	return s
}

func (m *Mesh) status(ctx context.Context) (string, error) {
	cmd := exec.CommandContext(ctx, "tailscale", "status", "--peers=false")
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

func expandPath(path string) string {
	if strings.HasPrefix(path, "~/") {
		home, err := os.UserHomeDir()
		if err == nil {
			return filepath.Join(home, path[2:])
		}
	}
	return path
}
