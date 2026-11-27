package zkomni

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDefaultDirIgnoresCloudRoot(t *testing.T) {
	t.Setenv(EnvPrimitivesDir, "")
	_ = os.Unsetenv(EnvPrimitivesDir)
	t.Setenv("CLAWD_CLOUD_ROOT", filepath.Join(t.TempDir(), "clawd-cloud"))

	got := DefaultDir()
	if filepath.Base(filepath.Clean(got)) != RelPrimitivesDir {
		t.Fatalf("DefaultDir basename = %q, want %s", got, RelPrimitivesDir)
	}
	if strings.Contains(got, "clawd-cloud") {
		t.Fatalf("CLAWD_CLOUD_ROOT must not become the ZK root, got %q", got)
	}
}

func TestDefaultDirHonorsEnv(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(EnvPrimitivesDir, dir)
	if got := DefaultDir(); got != dir {
		t.Fatalf("DefaultDir() = %q, want %q", got, dir)
	}
}

func TestLoadSurfaceFromRepo(t *testing.T) {
	t.Setenv(EnvPrimitivesDir, "")
	_ = os.Unsetenv(EnvPrimitivesDir)
	root := DefaultDir()
	if _, err := os.Stat(root); os.IsNotExist(err) {
		// SolanaOS vendors the Go runtime only; the TypeScript zk-shark-agent
		// sidecar (./zk-primitives) is optional and not checked in here.
		t.Skipf("zk-primitives sidecar not present at %s", root)
	}
	surface, err := LoadSurface(root)
	if err != nil {
		t.Fatal(err)
	}
	if !surface.Complete() {
		t.Fatalf("incomplete surface missing=%v root=%s", surface.Missing, surface.Root)
	}
	if surface.AgentID != AgentID {
		t.Fatalf("AgentID = %q", surface.AgentID)
	}
	if surface.AgentPackageName != AgentPackageName {
		t.Fatalf("AgentPackageName = %q", surface.AgentPackageName)
	}
	if surface.AgentBinary != AgentBinaryName {
		t.Fatalf("AgentBinary = %q", surface.AgentBinary)
	}
	if surface.ManifestSlug != "clawd-zk-primitives" {
		t.Fatalf("ManifestSlug = %q", surface.ManifestSlug)
	}
	if len(surface.SourceFiles) != len(agentSourceFiles) {
		t.Fatalf("SourceFiles = %d, want %d", len(surface.SourceFiles), len(agentSourceFiles))
	}
	if surface.SkillFile == "" || !strings.HasSuffix(surface.SkillFile, "SKILL.md") {
		t.Fatalf("SkillFile = %q", surface.SkillFile)
	}
}

func TestLoadSurfaceReportsMissing(t *testing.T) {
	root := t.TempDir()
	surface, err := LoadSurface(root)
	if err != nil {
		t.Fatal(err)
	}
	if surface.Complete() {
		t.Fatal("empty root should be incomplete")
	}
	if len(surface.Missing) == 0 {
		t.Fatal("expected missing paths")
	}
}

func TestLoadSurfaceReadsFixtures(t *testing.T) {
	root := t.TempDir()
	agentDir := filepath.Join(root, "agent")
	srcDir := filepath.Join(agentDir, "src")
	mkdirAll(t, srcDir)
	mkdirAll(t, filepath.Join(root, "client"))
	mkdirAll(t, filepath.Join(root, "programs", "clawd-zk"))

	writeFile(t, filepath.Join(root, "MANIFEST.json"), `{
  "name":"Clawd ZK Primitives",
  "slug":"clawd-zk-primitives",
  "operations":["publish_attestation","verify_proof"],
  "trustGate":{"default":"observer"},
  "packages":{
    "agent":{"binary":"zk-shark-agent","binaryAliases":["shark-of-all-streets"]},
    "program":{"programId":"CLAWDzk11111111111111111111111111111111111"}
  }
}`)
	writeFile(t, filepath.Join(agentDir, "agent.json"), `{"identifier":"zk-shark-agent","meta":{"title":"ZK Shark Agent"}}`)
	writeFile(t, filepath.Join(agentDir, "package.json"), `{"name":"@clawd/zk-shark-agent","bin":{"zk-shark-agent":"./dist/cli.js","shark-of-all-streets":"./dist/cli.js"}}`)
	writeFile(t, filepath.Join(agentDir, "SKILL.md"), "---\nname: zk-shark-agent\n---\n")
	for _, name := range []string{"agent.ts", "cli.ts", "config.ts", "index.ts", "intents.ts"} {
		writeFile(t, filepath.Join(srcDir, name), "// test\n")
	}
	writeFile(t, filepath.Join(root, "client", "package.json"), `{"name":"@clawd/zk-client"}`)

	surface, err := LoadSurface(root)
	if err != nil {
		t.Fatal(err)
	}
	if !surface.Complete() {
		t.Fatalf("missing=%v", surface.Missing)
	}
	if surface.AgentPackageName != AgentPackageName || surface.AgentBinary != AgentBinaryName {
		t.Fatalf("package metadata: %#v", surface)
	}
	if surface.ProgramID != "CLAWDzk11111111111111111111111111111111111" {
		t.Fatalf("ProgramID = %q", surface.ProgramID)
	}
	if len(surface.AgentAliases) != 1 || surface.AgentAliases[0] != "shark-of-all-streets" {
		t.Fatalf("aliases = %#v", surface.AgentAliases)
	}
	if surface.TrustGate["default"] != "observer" {
		t.Fatalf("trust gate = %#v", surface.TrustGate)
	}
}

func mkdirAll(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(path, 0o755); err != nil {
		t.Fatal(err)
	}
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}
