package agentwallet

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"os/exec"
	"sync"
	"time"
)

// LocalSandbox runs the wallet API as an isolated local process,
// mirroring the E2B sandbox interface without requiring an E2B API key.
// Useful for development and CI environments.
type LocalSandbox struct {
	mu          sync.Mutex
	processes   map[string]*localProcess // agentID → process
	basePort    int
	nextPort    int
}

type localProcess struct {
	AgentID   string    `json:"agent_id"`
	Port      int       `json:"port"`
	APIURL    string    `json:"api_url"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	cmd       *exec.Cmd
}

// NewLocalSandbox creates a local sandbox manager.
// Wallet API processes are spawned as child processes listening on sequential ports.
func NewLocalSandbox() *LocalSandbox {
	basePort := 8430
	if p := os.Getenv("LOCAL_SANDBOX_BASE_PORT"); p != "" {
		fmt.Sscanf(p, "%d", &basePort)
	}
	return &LocalSandbox{
		processes: make(map[string]*localProcess),
		basePort:  basePort,
		nextPort:  basePort,
	}
}

// Deploy starts a new local wallet API process for an agent.
// The binary must be the running executable itself (re-invoked as a sub-server).
func (ls *LocalSandbox) Deploy(ctx context.Context, agentID string, envVars map[string]string) (*Deployment, error) {
	ls.mu.Lock()
	defer ls.mu.Unlock()

	if existing, ok := ls.processes[agentID]; ok && existing.Status == "running" {
		return ls.toDeployment(existing), nil
	}

	port, err := ls.allocPort()
	if err != nil {
		return nil, fmt.Errorf("alloc port: %w", err)
	}

	// Build environment for the child process
	env := append(os.Environ(),
		fmt.Sprintf("WALLET_API_PORT=%d", port),
		"LOCAL_SANDBOX_MODE=1",
	)
	for k, v := range envVars {
		env = append(env, fmt.Sprintf("%s=%s", k, v))
	}

	self, err := os.Executable()
	if err != nil {
		return nil, fmt.Errorf("get executable path: %w", err)
	}

	cmd := exec.CommandContext(ctx, self)
	cmd.Env = env
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start process: %w", err)
	}

	proc := &localProcess{
		AgentID:   agentID,
		Port:      port,
		APIURL:    fmt.Sprintf("http://localhost:%d", port),
		Status:    "running",
		CreatedAt: time.Now(),
		cmd:       cmd,
	}
	ls.processes[agentID] = proc

	// Wait for the API to become ready (up to 5 seconds)
	if err := waitForPort(ctx, port, 5*time.Second); err != nil {
		cmd.Process.Kill()
		delete(ls.processes, agentID)
		return nil, fmt.Errorf("sandbox did not start: %w", err)
	}

	log.Printf("[LOCAL-SANDBOX] ✅ Sandbox started for %s → %s (pid %d)", agentID, proc.APIURL, cmd.Process.Pid)
	return ls.toDeployment(proc), nil
}

// Teardown stops the process for an agent.
func (ls *LocalSandbox) Teardown(_ context.Context, agentID string) error {
	ls.mu.Lock()
	defer ls.mu.Unlock()

	proc, ok := ls.processes[agentID]
	if !ok {
		return fmt.Errorf("no sandbox for agent %s", agentID)
	}
	delete(ls.processes, agentID)
	proc.Status = "stopped"

	if proc.cmd != nil && proc.cmd.Process != nil {
		if err := proc.cmd.Process.Kill(); err != nil {
			return fmt.Errorf("kill process: %w", err)
		}
	}
	log.Printf("[LOCAL-SANDBOX] 🗑️  Sandbox stopped: %s", agentID)
	return nil
}

// ListDeployments returns all active local sandbox deployments.
func (ls *LocalSandbox) ListDeployments() []*Deployment {
	ls.mu.Lock()
	defer ls.mu.Unlock()

	result := make([]*Deployment, 0, len(ls.processes))
	for _, p := range ls.processes {
		result = append(result, ls.toDeployment(p))
	}
	return result
}

func (ls *LocalSandbox) toDeployment(p *localProcess) *Deployment {
	return &Deployment{
		SandboxID: fmt.Sprintf("local-%s", p.AgentID),
		AgentID:   p.AgentID,
		APIURL:    p.APIURL,
		Status:    p.Status,
		CreatedAt: p.CreatedAt,
		ExpiresAt: p.CreatedAt.Add(24 * time.Hour),
	}
}

// allocPort finds the next available port starting from nextPort.
func (ls *LocalSandbox) allocPort() (int, error) {
	for i := 0; i < 100; i++ {
		port := ls.nextPort + i
		ln, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
		if err == nil {
			ln.Close()
			ls.nextPort = port + 1
			return port, nil
		}
	}
	return 0, fmt.Errorf("no free port in range %d-%d", ls.nextPort, ls.nextPort+100)
}

// waitForPort polls until a TCP port accepts connections or the deadline passes.
func waitForPort(ctx context.Context, port int, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	addr := fmt.Sprintf("localhost:%d", port)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", addr, 200*time.Millisecond)
		if err == nil {
			conn.Close()
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(200 * time.Millisecond):
		}
	}
	return fmt.Errorf("port %d not ready after %s", port, timeout)
}
