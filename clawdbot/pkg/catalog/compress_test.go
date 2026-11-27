package catalog

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCompressReportCreatesDeterministicPack(t *testing.T) {
	root := t.TempDir()
	skillsRoot := filepath.Join(root, "skills")
	agentsRoot := filepath.Join(root, "agents")
	zkRoot := filepath.Join(root, "zk-primitives")

	mkdirAll(t, filepath.Join(skillsRoot, "alpha", "references"))
	mkdirAll(t, filepath.Join(skillsRoot, "alpha", "node_modules", "pkg"))
	writeFile(t, filepath.Join(skillsRoot, "alpha", "SKILL.md"), strings.Repeat("alpha skill compression payload\n", 200))
	writeFile(t, filepath.Join(skillsRoot, "alpha", "references", "notes.md"), strings.Repeat("reference payload\n", 200))
	writeFile(t, filepath.Join(skillsRoot, "alpha", "references", "token-reference.md"), "token docs are not secrets\n")
	writeFile(t, filepath.Join(skillsRoot, "alpha", "node_modules", "pkg", "index.js"), strings.Repeat("ignored\n", 200))
	writeFile(t, filepath.Join(skillsRoot, "alpha", ".env.local"), "SECRET=value\n")

	mkdirAll(t, agentsRoot)
	writeFile(t, filepath.Join(agentsRoot, "solana-example.json"), `{
  "identifier": "solana-example",
  "author": "tester",
  "pluginCount": 2,
  "meta": {
    "title": "Solana Example",
    "description": "Example agent",
    "category": "analytics",
    "tags": ["solana", "example"]
  }
}`)

	mkdirAll(t, filepath.Join(zkRoot, "agent", "src"))
	mkdirAll(t, filepath.Join(zkRoot, "agent", "dist"))
	mkdirAll(t, filepath.Join(zkRoot, "client", "src"))
	mkdirAll(t, filepath.Join(zkRoot, "node_modules", ".pnpm"))
	writeFile(t, filepath.Join(zkRoot, "MANIFEST.json"), `{"name":"Clawd ZK Primitives"}`)
	writeFile(t, filepath.Join(zkRoot, "agent", "SKILL.md"), strings.Repeat("zk skill payload\n", 200))
	writeFile(t, filepath.Join(zkRoot, "agent", "agent.json"), `{"identifier":"clawd-zk-agent"}`)
	writeFile(t, filepath.Join(zkRoot, "agent", "package.json"), `{"name":"@clawd/zk-agent","bin":{"clawd-zk-agent":"./dist/cli.js"}}`)
	writeFile(t, filepath.Join(zkRoot, "agent", "src", "index.ts"), strings.Repeat("export const z = 1;\n", 200))
	writeFile(t, filepath.Join(zkRoot, "agent", "dist", "index.js"), strings.Repeat("ignored\n", 200))
	writeFile(t, filepath.Join(zkRoot, "agent", ".env.local"), "SECRET=value\n")
	writeFile(t, filepath.Join(zkRoot, "client", "package.json"), `{"name":"@clawd/zk-client"}`)
	writeFile(t, filepath.Join(zkRoot, "client", "src", "index.ts"), strings.Repeat("export const c = 1;\n", 200))
	writeFile(t, filepath.Join(zkRoot, "pnpm-lock.yaml"), strings.Repeat("ignored\n", 200))
	writeFile(t, filepath.Join(zkRoot, "node_modules", ".pnpm", "lock.yaml"), strings.Repeat("ignored\n", 200))

	report := BuildReport(Roots{
		SkillsDir:       skillsRoot,
		AgentsDir:       agentsRoot,
		ZKPrimitivesDir: zkRoot,
	})
	if len(report.Warnings) != 0 {
		t.Fatalf("unexpected warnings: %v", report.Warnings)
	}

	out := filepath.Join(root, "pack.tar.gz")
	result, err := CompressReport(report, DefaultPackOptions(out))
	if err != nil {
		t.Fatal(err)
	}
	if result.SkillCount != 1 {
		t.Fatalf("skill count = %d, want 1 local skill", result.SkillCount)
	}
	if result.AgentCount != 1 {
		t.Fatalf("agent count = %d, want 1", result.AgentCount)
	}
	if result.ZKFileCount == 0 {
		t.Fatalf("expected zk files in pack")
	}
	if result.SavedBytes <= 0 || result.SavingsPercent <= 0 {
		t.Fatalf("expected positive compression savings: %#v", result)
	}

	names, contents := readTarGzip(t, out)
	requireTarEntry(t, names, "manifest.json")
	requireTarEntry(t, names, "agents/solana-example.json")
	requireTarEntry(t, names, "skills/alpha/SKILL.md")
	requireTarEntry(t, names, "skills/alpha/references/notes.md")
	requireTarEntry(t, names, "skills/alpha/references/token-reference.md")
	requireTarEntry(t, names, "zk-primitives/MANIFEST.json")
	requireTarEntry(t, names, "zk-primitives/agent/src/index.ts")
	requireNoTarEntryContaining(t, names, "node_modules")
	requireNoTarEntryContaining(t, names, ".env")
	requireNoTarEntryContaining(t, names, "/dist/")
	requireNoTarEntryContaining(t, names, "pnpm-lock.yaml")

	if strings.Contains(string(contents["manifest.json"]), root) {
		t.Fatalf("manifest leaked absolute root path")
	}
	if got := string(contents["agents/solana-example.json"]); !strings.HasPrefix(got, `{"identifier":"solana-example"`) {
		t.Fatalf("agent json was not compacted: %q", got[:min(len(got), 80)])
	}

	out2 := filepath.Join(root, "pack-again.tar.gz")
	if _, err := CompressReport(report, DefaultPackOptions(out2)); err != nil {
		t.Fatal(err)
	}
	first, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	second, err := os.ReadFile(out2)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(first, second) {
		t.Fatalf("pack output is not deterministic")
	}
}

func TestCompressReportDryRunDoesNotWriteOutput(t *testing.T) {
	root := t.TempDir()
	agentsRoot := filepath.Join(root, "agents")
	mkdirAll(t, agentsRoot)
	writeFile(t, filepath.Join(agentsRoot, "agent.json"), `{"identifier":"agent","meta":{"title":"Agent"}}`)

	report := Report{
		Roots: Roots{AgentsDir: agentsRoot},
		Agents: []AgentEntry{{
			ID:       "agent",
			Name:     "Agent",
			FilePath: filepath.Join(agentsRoot, "agent.json"),
			Source:   agentsRoot,
		}},
	}
	out := filepath.Join(root, "dry-run.tar.gz")
	result, err := CompressReport(report, PackOptions{
		OutputPath:    out,
		IncludeAgents: true,
		DryRun:        true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.PackedBytes <= 0 {
		t.Fatalf("expected dry-run packed byte estimate")
	}
	if _, err := os.Stat(out); !os.IsNotExist(err) {
		t.Fatalf("dry-run wrote output file: %v", err)
	}
}

func readTarGzip(t *testing.T, filePath string) ([]string, map[string][]byte) {
	t.Helper()
	file, err := os.Open(filePath)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()

	gz, err := gzip.NewReader(file)
	if err != nil {
		t.Fatal(err)
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	var names []string
	contents := map[string][]byte{}
	for {
		header, err := tr.Next()
		if errorsIsEOF(err) {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		names = append(names, header.Name)
		data, err := io.ReadAll(tr)
		if err != nil {
			t.Fatal(err)
		}
		contents[header.Name] = data
	}
	return names, contents
}

func requireTarEntry(t *testing.T, names []string, want string) {
	t.Helper()
	for _, name := range names {
		if name == want {
			return
		}
	}
	t.Fatalf("missing tar entry %q in %v", want, names)
}

func requireNoTarEntryContaining(t *testing.T, names []string, needle string) {
	t.Helper()
	for _, name := range names {
		if strings.Contains(name, needle) {
			t.Fatalf("unexpected tar entry containing %q: %s", needle, name)
		}
	}
}

func errorsIsEOF(err error) bool {
	return err == io.EOF
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
