package zkomni

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const (
	EnvPrimitivesDir = "CLAWDBOT_ZK_PRIMITIVES_DIR"
	RelPrimitivesDir = "zk-primitives"

	AgentID          = "zk-shark-agent"
	AgentPackageName = "@clawd/zk-shark-agent"
	AgentBinaryName  = "zk-shark-agent"
)

var (
	agentSourceFiles = []string{
		"agent.json",
		"package.json",
		"SKILL.md",
		filepath.Join("src", "agent.ts"),
		filepath.Join("src", "cli.ts"),
		filepath.Join("src", "config.ts"),
		filepath.Join("src", "index.ts"),
		filepath.Join("src", "intents.ts"),
	}
	requiredRelPaths = []string{
		"MANIFEST.json",
		filepath.Join("agent", "agent.json"),
		filepath.Join("agent", "package.json"),
		filepath.Join("agent", "SKILL.md"),
		filepath.Join("agent", "src", "agent.ts"),
		filepath.Join("agent", "src", "cli.ts"),
		filepath.Join("agent", "src", "config.ts"),
		filepath.Join("agent", "src", "index.ts"),
		filepath.Join("agent", "src", "intents.ts"),
		filepath.Join("client", "package.json"),
		filepath.Join("programs", "clawd-zk"),
	}
)

// Surface is the discovered zk-primitives tree plus zk-shark-agent metadata.
type Surface struct {
	Root             string            `json:"root"`
	AgentDir         string            `json:"agentDir"`
	AgentID          string            `json:"agentId,omitempty"`
	AgentTitle       string            `json:"agentTitle,omitempty"`
	AgentPackageName string            `json:"agentPackageName,omitempty"`
	AgentBinary      string            `json:"agentBinary,omitempty"`
	AgentAliases     []string          `json:"agentAliases,omitempty"`
	SkillFile        string            `json:"skillFile,omitempty"`
	ManifestFile     string            `json:"manifestFile,omitempty"`
	ManifestName     string            `json:"manifestName,omitempty"`
	ManifestSlug     string            `json:"manifestSlug,omitempty"`
	ProgramID        string            `json:"programId,omitempty"`
	Operations       []string          `json:"operations,omitempty"`
	SourceFiles      []string          `json:"sourceFiles,omitempty"`
	Missing          []string          `json:"missing,omitempty"`
	TrustGate        map[string]string `json:"trustGate,omitempty"`
}

type agentManifestFile struct {
	Identifier string `json:"identifier"`
	Meta       struct {
		Title string `json:"title"`
	} `json:"meta"`
}

type agentPackageFile struct {
	Name string          `json:"name"`
	Bin  json.RawMessage `json:"bin"`
}

type primitivesManifestFile struct {
	Name       string            `json:"name"`
	Slug       string            `json:"slug"`
	Operations []string          `json:"operations"`
	TrustGate  map[string]string `json:"trustGate"`
	Packages   struct {
		Agent struct {
			Binary        string   `json:"binary"`
			BinaryAliases []string `json:"binaryAliases"`
		} `json:"agent"`
		Program struct {
			ProgramID string `json:"programId"`
		} `json:"program"`
	} `json:"packages"`
}

// DefaultDir resolves the go-bot-owned zk-primitives root.
// CLAWD_CLOUD_ROOT is intentionally ignored — Cloud's copy is a sidecar.
func DefaultDir() string {
	if override := strings.TrimSpace(os.Getenv(EnvPrimitivesDir)); override != "" {
		return expandPath(override)
	}
	cwd, err := os.Getwd()
	if err != nil {
		return RelPrimitivesDir
	}
	for {
		candidate := filepath.Join(cwd, RelPrimitivesDir)
		if dirExists(candidate) {
			return candidate
		}
		parent := filepath.Dir(cwd)
		if parent == cwd {
			break
		}
		cwd = parent
	}
	return RelPrimitivesDir
}

// AgentDir is DefaultDir()/agent unless root is supplied.
func AgentDir(root string) string {
	if strings.TrimSpace(root) == "" {
		root = DefaultDir()
	}
	return filepath.Join(filepath.Clean(root), "agent")
}

// LoadSurface reads MANIFEST.json, agent.json, package.json, and SKILL.md.
func LoadSurface(root string) (Surface, error) {
	if strings.TrimSpace(root) == "" {
		return Surface{}, errors.New("empty zk-primitives root")
	}
	root = filepath.Clean(root)
	info, err := os.Stat(root)
	if err != nil {
		return Surface{}, err
	}
	if !info.IsDir() {
		return Surface{}, fmt.Errorf("zkomni: %q is not a directory", root)
	}

	surface := Surface{
		Root:        root,
		AgentDir:    filepath.Join(root, "agent"),
		Operations:  []string{},
		SourceFiles: []string{},
		Missing:     []string{},
		TrustGate:   map[string]string{},
	}

	for _, rel := range requiredRelPaths {
		path := filepath.Join(root, rel)
		if !pathExists(path) {
			surface.Missing = append(surface.Missing, rel)
		}
	}

	skillFile := filepath.Join(root, "agent", "SKILL.md")
	if pathExists(skillFile) {
		surface.SkillFile = skillFile
	}

	manifestFile := filepath.Join(root, "MANIFEST.json")
	if pathExists(manifestFile) {
		surface.ManifestFile = manifestFile
		manifest, err := readPrimitivesManifest(manifestFile)
		if err != nil {
			return Surface{}, err
		}
		surface.ManifestName = manifest.Name
		surface.ManifestSlug = manifest.Slug
		surface.ProgramID = manifest.Packages.Program.ProgramID
		surface.AgentAliases = append([]string{}, manifest.Packages.Agent.BinaryAliases...)
		if bin := strings.TrimSpace(manifest.Packages.Agent.Binary); bin != "" {
			surface.AgentBinary = bin
		}
		if len(manifest.Operations) > 0 {
			surface.Operations = append([]string{}, manifest.Operations...)
		}
		for k, v := range manifest.TrustGate {
			surface.TrustGate[k] = v
		}
	}

	agentJSON := filepath.Join(root, "agent", "agent.json")
	if pathExists(agentJSON) {
		manifest, err := readAgentManifest(agentJSON)
		if err != nil {
			return Surface{}, err
		}
		surface.AgentID = firstNonEmpty(manifest.Identifier, AgentID)
		surface.AgentTitle = firstNonEmpty(manifest.Meta.Title, "ZK Shark Agent")
	}

	pkgFile := filepath.Join(root, "agent", "package.json")
	if pathExists(pkgFile) {
		pkg, err := readAgentPackage(pkgFile)
		if err != nil {
			return Surface{}, err
		}
		surface.AgentPackageName = firstNonEmpty(pkg.Name, AgentPackageName)
		if bin := firstPackageBin(pkg.Bin); bin != "" && surface.AgentBinary == "" {
			surface.AgentBinary = bin
		}
	}

	if surface.AgentBinary == "" {
		surface.AgentBinary = AgentBinaryName
	}

	for _, name := range agentSourceFiles {
		path := filepath.Join(surface.AgentDir, name)
		if pathExists(path) {
			surface.SourceFiles = append(surface.SourceFiles, path)
		}
	}
	sort.Strings(surface.SourceFiles)
	sort.Strings(surface.Missing)
	return surface, nil
}

// Complete reports whether the required zk-primitives agent tree is on disk.
func (s Surface) Complete() bool {
	return len(s.Missing) == 0
}

func readPrimitivesManifest(path string) (primitivesManifestFile, error) {
	var out primitivesManifestFile
	data, err := os.ReadFile(path)
	if err != nil {
		return out, err
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return out, fmt.Errorf("zkomni manifest: %w", err)
	}
	return out, nil
}

func readAgentManifest(path string) (agentManifestFile, error) {
	var out agentManifestFile
	data, err := os.ReadFile(path)
	if err != nil {
		return out, err
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return out, fmt.Errorf("zkomni agent.json: %w", err)
	}
	return out, nil
}

func readAgentPackage(path string) (agentPackageFile, error) {
	var out agentPackageFile
	data, err := os.ReadFile(path)
	if err != nil {
		return out, err
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return out, fmt.Errorf("zkomni package.json: %w", err)
	}
	return out, nil
}

func firstPackageBin(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var asString string
	if err := json.Unmarshal(raw, &asString); err == nil {
		return strings.TrimSpace(asString)
	}
	var asMap map[string]string
	if err := json.Unmarshal(raw, &asMap); err != nil || len(asMap) == 0 {
		return ""
	}
	if _, ok := asMap[AgentBinaryName]; ok {
		return AgentBinaryName
	}
	keys := make([]string, 0, len(asMap))
	for key := range asMap {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys[0]
}

func pathExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}
