package delegation

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/x402agent/Solana-Os-Go/pkg/config"
	"github.com/x402agent/Solana-Os-Go/pkg/runtimeenv"
)

type WorkerSpec struct {
	Name          string   `json:"name"`
	Role          string   `json:"role"`
	Backend       string   `json:"backend"`
	Task          string   `json:"task"`
	Capabilities  []string `json:"capabilities"`
	PythonRPCPath string   `json:"python_rpc_path,omitempty"`
}

type Planner struct {
	root           string
	maxParallel    int
	scaffoldPython bool
	runtimes       *runtimeenv.Registry
}

func NewPlanner(cfg config.DelegationConfig, workspace string, runtimes *runtimeenv.Registry) *Planner {
	root := filepath.Join(workspace, strings.TrimSpace(cfg.WorkspaceSubdir))
	if root == workspace || strings.TrimSpace(cfg.WorkspaceSubdir) == "" {
		root = filepath.Join(workspace, "delegates")
	}
	maxParallel := cfg.MaxParallel
	if maxParallel <= 0 {
		maxParallel = 3
	}
	return &Planner{
		root:           root,
		maxParallel:    maxParallel,
		scaffoldPython: cfg.ScaffoldPythonRPC,
		runtimes:       runtimes,
	}
}

func (p *Planner) Init() error {
	if p == nil {
		return nil
	}
	if err := os.MkdirAll(p.root, 0o755); err != nil {
		return err
	}
	if !p.scaffoldPython {
		return nil
	}
	templatePath := filepath.Join(p.root, "rpc_worker_template.py")
	if _, err := os.Stat(templatePath); err == nil {
		return nil
	}
	return os.WriteFile(templatePath, []byte(defaultPythonTemplate()), 0o644)
}

func (p *Planner) MaxParallel() int {
	if p == nil {
		return 0
	}
	return p.maxParallel
}

func (p *Planner) List() ([]WorkerSpec, error) {
	if p == nil {
		return nil, nil
	}
	entries, err := os.ReadDir(p.root)
	if err != nil {
		if os.IsNotExist(err) {
			return []WorkerSpec{}, nil
		}
		return nil, err
	}
	items := make([]WorkerSpec, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(p.root, entry.Name()))
		if err != nil {
			continue
		}
		var spec WorkerSpec
		if err := json.Unmarshal(data, &spec); err == nil && strings.TrimSpace(spec.Name) != "" {
			items = append(items, spec)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Name < items[j].Name })
	return items, nil
}

func (p *Planner) ScaffoldWorker(name, task string) (*WorkerSpec, error) {
	if p == nil {
		return nil, nil
	}
	name = safeSlug(name)
	if name == "" {
		name = "worker"
	}
	task = strings.TrimSpace(task)
	if task == "" {
		task = "Execute delegated work over RPC tool calls."
	}
	backend := "local"
	if p.runtimes != nil && strings.TrimSpace(p.runtimes.Default()) != "" {
		backend = p.runtimes.Default()
	}

	spec := WorkerSpec{
		Name:         name,
		Role:         inferRole(task),
		Backend:      backend,
		Task:         task,
		Capabilities: inferCapabilities(task),
	}
	if p.scaffoldPython {
		spec.PythonRPCPath = filepath.Join(p.root, name+".py")
		if err := os.WriteFile(spec.PythonRPCPath, []byte(renderPythonWorker(spec)), 0o755); err != nil {
			return nil, err
		}
	}

	data, err := json.MarshalIndent(spec, "", "  ")
	if err != nil {
		return nil, err
	}
	if err := os.WriteFile(filepath.Join(p.root, name+".json"), data, 0o644); err != nil {
		return nil, err
	}
	return &spec, nil
}

func (p *Planner) Suggestions(query string) []WorkerSpec {
	query = strings.TrimSpace(query)
	if query == "" {
		return nil
	}
	base := WorkerSpec{
		Backend:      "local",
		Capabilities: inferCapabilities(query),
	}
	if p != nil && p.runtimes != nil && strings.TrimSpace(p.runtimes.Default()) != "" {
		base.Backend = p.runtimes.Default()
	}
	return []WorkerSpec{
		{
			Name:         "research-worker",
			Role:         "research",
			Backend:      base.Backend,
			Task:         "Investigate and summarize: " + query,
			Capabilities: append([]string{}, base.Capabilities...),
		},
		{
			Name:         "execution-worker",
			Role:         "execution",
			Backend:      base.Backend,
			Task:         "Implement or operate on: " + query,
			Capabilities: append([]string{}, base.Capabilities...),
		},
	}
}

func inferRole(task string) string {
	lower := strings.ToLower(task)
	switch {
	case strings.Contains(lower, "research"), strings.Contains(lower, "investigate"), strings.Contains(lower, "analyze"):
		return "research"
	case strings.Contains(lower, "build"), strings.Contains(lower, "implement"), strings.Contains(lower, "fix"):
		return "execution"
	default:
		return "general"
	}
}

func inferCapabilities(task string) []string {
	lower := strings.ToLower(task)
	var caps []string
	if strings.Contains(lower, "rpc") || strings.Contains(lower, "python") {
		caps = append(caps, "python-rpc")
	}
	if strings.Contains(lower, "parallel") || strings.Contains(lower, "batch") {
		caps = append(caps, "parallelizable")
	}
	if strings.Contains(lower, "tool") || strings.Contains(lower, "trade") || strings.Contains(lower, "wallet") {
		caps = append(caps, "tool-calling")
	}
	if len(caps) == 0 {
		caps = append(caps, "general")
	}
	return caps
}

func safeSlug(input string) string {
	input = strings.ToLower(strings.TrimSpace(input))
	if input == "" {
		return ""
	}
	var b strings.Builder
	lastDash := false
	for _, r := range input {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash {
			b.WriteByte('-')
			lastDash = true
		}
	}
	return strings.Trim(b.String(), "-")
}

func defaultPythonTemplate() string {
	return `#!/usr/bin/env python3
"""
SolanaOS delegate worker template.
Implement your RPC bridge in execute_tool() and keep the worker stateless.
"""

from __future__ import annotations

import json
import sys
from typing import Any


def execute_tool(name: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {"tool": name, "payload": payload, "status": "stub"}


def main() -> int:
    raw = sys.stdin.read().strip()
    request = json.loads(raw or "{}")
    result = execute_tool(request.get("tool", "unknown"), request.get("payload", {}))
    sys.stdout.write(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
`
}

func renderPythonWorker(spec WorkerSpec) string {
	return fmt.Sprintf(`#!/usr/bin/env python3
"""
Auto-scaffolded SolanaOS delegate worker.
Role: %s
Task: %s
Backend: %s
"""

from __future__ import annotations

import json
import sys
from typing import Any


WORKER_SPEC = %q


def execute_tool(name: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "worker": WORKER_SPEC,
        "tool": name,
        "payload": payload,
        "status": "not-implemented",
    }


def main() -> int:
    request = json.loads(sys.stdin.read().strip() or "{}")
    result = execute_tool(request.get("tool", "unknown"), request.get("payload", {}))
    sys.stdout.write(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
`, spec.Role, spec.Task, spec.Backend, spec.Name)
}
