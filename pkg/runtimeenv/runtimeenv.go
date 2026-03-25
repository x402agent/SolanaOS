package runtimeenv

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/x402agent/Solana-Os-Go/pkg/config"
)

type BackendSpec struct {
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Persistence  string   `json:"persistence"`
	Serverless   bool     `json:"serverless"`
	Capabilities []string `json:"capabilities"`
}

type Registry struct {
	defaultBackend string
	specs          map[string]BackendSpec
	root           string
}

func NewRegistry(cfg config.RuntimeConfig, workspace string) *Registry {
	root := filepath.Join(workspace, "runtime")
	specs := map[string]BackendSpec{
		"local": {
			Name:         "local",
			Description:  "Runs directly on the host machine for lowest latency iteration.",
			Persistence:  "host filesystem",
			Capabilities: []string{"interactive", "persistent", "low-latency"},
		},
		"docker": {
			Name:         "docker",
			Description:  "Containerized runtime for reproducible builds and isolated services.",
			Persistence:  "container volumes",
			Capabilities: []string{"portable", "isolated", "reproducible"},
		},
		"ssh": {
			Name:         "ssh",
			Description:  "Remote terminal backend for VPS and bare-metal agents.",
			Persistence:  "remote host",
			Capabilities: []string{"remote", "persistent", "ops-friendly"},
		},
		"daytona": {
			Name:         "daytona",
			Description:  "Ephemeral cloud workspace backend with warm resume semantics.",
			Persistence:  "serverless workspace snapshot",
			Serverless:   true,
			Capabilities: []string{"serverless", "persistent-snapshot", "remote"},
		},
		"singularity": {
			Name:         "singularity",
			Description:  "HPC-friendly container backend for research and cluster jobs.",
			Persistence:  "cluster image + mounted volumes",
			Capabilities: []string{"hpc", "portable", "gpu-cluster"},
		},
		"modal": {
			Name:         "modal",
			Description:  "Serverless Python-heavy backend for bursty jobs and wake-on-demand agents.",
			Persistence:  "volume + function snapshot",
			Serverless:   true,
			Capabilities: []string{"serverless", "burst-compute", "python-rpc"},
		},
	}

	if len(cfg.Backends) > 0 {
		allowed := make(map[string]struct{}, len(cfg.Backends))
		for _, name := range cfg.Backends {
			name = strings.ToLower(strings.TrimSpace(name))
			if name != "" {
				allowed[name] = struct{}{}
			}
		}
		if len(allowed) > 0 {
			for name := range specs {
				if _, ok := allowed[name]; !ok {
					delete(specs, name)
				}
			}
		}
	}

	defaultBackend := strings.ToLower(strings.TrimSpace(cfg.DefaultBackend))
	if defaultBackend == "" {
		defaultBackend = "local"
	}
	if _, ok := specs[defaultBackend]; !ok {
		defaultBackend = "local"
	}

	return &Registry{
		defaultBackend: defaultBackend,
		specs:          specs,
		root:           root,
	}
}

func (r *Registry) Init() error {
	if r == nil {
		return nil
	}
	if err := os.MkdirAll(r.root, 0o755); err != nil {
		return err
	}
	return r.WriteManifest()
}

func (r *Registry) Default() string {
	if r == nil {
		return ""
	}
	return r.defaultBackend
}

func (r *Registry) List() []BackendSpec {
	if r == nil {
		return nil
	}
	out := make([]BackendSpec, 0, len(r.specs))
	for _, spec := range r.specs {
		out = append(out, spec)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (r *Registry) Summary() string {
	if r == nil {
		return ""
	}
	parts := make([]string, 0, len(r.specs))
	for _, spec := range r.List() {
		label := spec.Name
		if spec.Name == r.defaultBackend {
			label += " (default)"
		}
		if spec.Serverless {
			label += " [serverless]"
		}
		parts = append(parts, label)
	}
	return strings.Join(parts, ", ")
}

func (r *Registry) WriteManifest() error {
	if r == nil {
		return nil
	}
	payload := struct {
		Default  string        `json:"default"`
		Backends []BackendSpec `json:"backends"`
	}{
		Default:  r.defaultBackend,
		Backends: r.List(),
	}
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(r.root, "backends.json"), data, 0o644)
}
