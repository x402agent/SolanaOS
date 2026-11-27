package catalog

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadSkillsFromCatalogJSON(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "catalog.json"), `[
  {"slug":"alpha","name":"Alpha","description":"First skill","category":"Test"}
]`)
	mkdirAll(t, filepath.Join(root, "alpha"))
	writeFile(t, filepath.Join(root, "alpha", "SKILL.md"), `---
name: alpha
description: Alpha from frontmatter.
---
# Alpha
`)

	skills, err := LoadSkills(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(skills) != 1 {
		t.Fatalf("expected 1 skill, got %d", len(skills))
	}
	if skills[0].Slug != "alpha" || skills[0].Name != "Alpha" {
		t.Fatalf("unexpected skill: %#v", skills[0])
	}
	if skills[0].FilePath == "" {
		t.Fatalf("expected skill file path")
	}
}

func TestLoadAgents(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "solana-example.json"), `{
  "identifier": "solana-example",
  "author": "tester",
  "homepage": "https://example.test",
  "pluginCount": 2,
  "meta": {
    "title": "Solana Example",
    "description": "Example agent",
    "category": "analytics",
    "riskLevel": "low",
    "variant": "test",
    "avatar": "EX",
    "tags": ["solana", "example"]
  }
}`)
	writeFile(t, filepath.Join(root, "package.json"), `{"name":"not-an-agent"}`)

	agents, err := LoadAgents(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(agents) != 1 {
		t.Fatalf("expected 1 agent, got %d", len(agents))
	}
	agent := agents[0]
	if agent.ID != "solana-example" || agent.Name != "Solana Example" {
		t.Fatalf("unexpected agent: %#v", agent)
	}
	if agent.Category != "analytics" || agent.PluginCount != 2 {
		t.Fatalf("unexpected agent metadata: %#v", agent)
	}
}

func TestLoadZKSurface(t *testing.T) {
	root := t.TempDir()
	mkdirAll(t, filepath.Join(root, "agent"))
	mkdirAll(t, filepath.Join(root, "client"))
	mkdirAll(t, filepath.Join(root, "programs", "clawd-zk"))
	mkdirAll(t, filepath.Join(root, "configs"))
	mkdirAll(t, filepath.Join(root, "docs"))

	writeFile(t, filepath.Join(root, "agent", "SKILL.md"), "---\nname: clawd-zk-agent\n---\n")
	writeFile(t, filepath.Join(root, "agent", "agent.json"), `{"identifier":"clawd-zk-agent"}`)
	writeFile(t, filepath.Join(root, "agent", "package.json"), `{"name":"@clawd/zk-agent","bin":{"clawd-zk-agent":"./dist/cli.js"}}`)
	writeFile(t, filepath.Join(root, "client", "package.json"), `{"name":"@clawd/zk-client"}`)
	writeFile(t, filepath.Join(root, "MANIFEST.json"), `{
  "name":"Clawd ZK Primitives",
  "slug":"clawd-zk-primitives",
  "status":"scaffold-production-facing",
  "description":"ZK surface for tests",
  "packageManager":"pnpm",
  "packages":{
    "agent":{"binaryAliases":["shark-of-all-streets","clawd-zk-agent"]},
    "program":{"programId":"CLAWDzk11111111111111111111111111111111111"}
  },
  "operations":["publish_attestation","verify_proof"],
  "trustGate":{"default":"observer","signAndSendTransaction":"delegated"}
}`)
	writeFile(t, filepath.Join(root, "pnpm-workspace.yaml"), "packages:\n  - agent\n  - client\n")
	writeFile(t, filepath.Join(root, "programs", "clawd-zk", "Cargo.toml"), "[package]\nname = \"clawd-zk\"\n")
	writeFile(t, filepath.Join(root, "configs", "light-trees.yaml"), "trees: []\n")
	writeFile(t, filepath.Join(root, "README.md"), "# ZK\n")
	writeFile(t, filepath.Join(root, "docs", "ARCHITECTURE.md"), "# Architecture\n")
	writeFile(t, filepath.Join(root, "docs", "INTEGRATION.md"), "# Integration\n")

	surface, err := LoadZKSurface(root)
	if err != nil {
		t.Fatal(err)
	}
	if surface.AgentPackageName != "@clawd/zk-agent" || surface.AgentBinary != "clawd-zk-agent" {
		t.Fatalf("unexpected agent package metadata: %#v", surface)
	}
	if surface.ClientPackage != "@clawd/zk-client" || surface.ProgramName != "clawd-zk" {
		t.Fatalf("unexpected zk package metadata: %#v", surface)
	}
	if surface.Status != "scaffold-production-facing" || surface.PackageManager != "pnpm" {
		t.Fatalf("unexpected manifest metadata: %#v", surface)
	}
	if surface.ProgramID != "CLAWDzk11111111111111111111111111111111111" {
		t.Fatalf("unexpected program id: %#v", surface)
	}
	if len(surface.AgentAliases) != 2 || surface.AgentAliases[0] != "shark-of-all-streets" {
		t.Fatalf("unexpected agent aliases: %#v", surface)
	}
	if surface.ManifestFile == "" || surface.AgentManifest == "" || surface.WorkspaceFile == "" {
		t.Fatalf("expected manifest/workspace metadata: %#v", surface)
	}
	if len(surface.Operations) != 2 || len(surface.Docs) != 3 {
		t.Fatalf("unexpected zk docs/ops: %#v", surface)
	}
	if surface.TrustGate["default"] != "observer" {
		t.Fatalf("unexpected trust gate: %#v", surface)
	}
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func mkdirAll(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(path, 0o755); err != nil {
		t.Fatal(err)
	}
}
