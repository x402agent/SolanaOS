package keyvault

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadParsesEnvLocalAndHidesControlKeys(t *testing.T) {
	t.Setenv(EnvVaultEnabled, "")
	t.Setenv(EnvVaultAllowedIPs, "")
	t.Setenv(EnvVaultToken, "")
	t.Setenv(EnvKeysToken, "")

	path := filepath.Join(t.TempDir(), ".env.local")
	writeFile(t, path, `
# comment
CLAWDBOT_VAULT_ENABLED=1
CLAWDBOT_VAULT_ALLOWED_IPS=203.0.113.7,10.0.0.0/8
CLAWDBOT_VAULT_TOKEN="vault-token"
HELIUS_API_KEY=helius-secret
QUOTED='quoted value'
BAD-NAME=ignored
`)

	vault, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if !vault.Enabled {
		t.Fatal("vault should be enabled from env file")
	}
	if !vault.ClientAllowed("203.0.113.7") || !vault.ClientAllowed("10.4.5.6") {
		t.Fatalf("allowlist not applied: %#v", vault.AllowedIPs)
	}
	if vault.ClientAllowed("198.51.100.9") {
		t.Fatal("unexpected IP allowed")
	}
	if got := vault.Token(); got != "vault-token" {
		t.Fatalf("Token() = %q", got)
	}
	if got, ok := vault.Get("HELIUS_API_KEY"); !ok || got != "helius-secret" {
		t.Fatalf("Get(HELIUS_API_KEY) = %q/%v", got, ok)
	}
	if _, ok := vault.Get(EnvVaultToken); ok {
		t.Fatal("control token should not be readable as a vault key")
	}
	keys := strings.Join(vault.Keys(), ",")
	if strings.Contains(keys, "CLAWDBOT_VAULT_TOKEN") || !strings.Contains(keys, "HELIUS_API_KEY") {
		t.Fatalf("unexpected key list: %s", keys)
	}
}

func TestExportShellQuotesValues(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env.local")
	writeFile(t, path, "A=one\nB='two words'\nC=\"has ' quote\"\n")
	vault, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	out := vault.Export([]string{"A", "B", "C", "MISSING"})
	for _, want := range []string{
		"export A='one'",
		"export B='two words'",
		"export C='has '\"'\"' quote'",
	} {
		if !strings.Contains(out, want) {
			t.Fatalf("export output missing %q in:\n%s", want, out)
		}
	}
}

func TestDefaultsToLoopbackOnlyAndDisabled(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env.local")
	writeFile(t, path, "API_KEY=value\n")
	vault, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if vault.Enabled {
		t.Fatal("vault should default disabled")
	}
	if !vault.ClientAllowed("127.0.0.1") || !vault.ClientAllowed("::1") {
		t.Fatalf("loopback should be allowed by default: %#v", vault.AllowedIPs)
	}
	if vault.ClientAllowed("203.0.113.7") {
		t.Fatal("public IP should not be allowed by default")
	}
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}
