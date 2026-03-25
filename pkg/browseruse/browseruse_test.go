package browseruse

import (
	"strings"
	"testing"

	"github.com/x402agent/Solana-Os-Go/pkg/config"
)

func TestInspectPrefersExplicitBrowserbaseProvider(t *testing.T) {
	cfg := config.DefaultConfig().Tools.BrowserUse
	cfg.APIKey = "browseruse-key"
	cfg.CloudProvider = "browserbase"
	cfg.BrowserbaseAPIKey = "browserbase-key"
	cfg.BrowserbaseProjectID = "proj_123"

	status := Inspect(cfg)
	if got := status.CloudProvider; got != "Browserbase" {
		t.Fatalf("CloudProvider = %q, want %q", got, "Browserbase")
	}
	if !status.ProviderReady {
		t.Fatalf("ProviderReady = false, want true")
	}
}

func TestCommandEnvIncludesBrowserbaseCredentials(t *testing.T) {
	cfg := config.DefaultConfig().Tools.BrowserUse
	cfg.APIKey = "browseruse-key"
	cfg.BrowserbaseAPIKey = "browserbase-key"
	cfg.BrowserbaseProjectID = "proj_123"

	env := strings.Join(commandEnv(cfg), "\n")
	if !strings.Contains(env, "BROWSERUSE_API_KEY=browseruse-key") {
		t.Fatalf("commandEnv missing BROWSERUSE_API_KEY")
	}
	if !strings.Contains(env, "BROWSERBASE_API_KEY=browserbase-key") {
		t.Fatalf("commandEnv missing BROWSERBASE_API_KEY")
	}
	if !strings.Contains(env, "BROWSERBASE_PROJECT_ID=proj_123") {
		t.Fatalf("commandEnv missing BROWSERBASE_PROJECT_ID")
	}
}

func TestManagedSessionRoundTrip(t *testing.T) {
	cfg := config.DefaultConfig().Tools.BrowserUse
	cfg.Home = t.TempDir()

	err := upsertManagedSession(cfg, managedSession{
		SessionName:       "default",
		Provider:          providerKeyBrowserbase,
		ProviderSessionID: "sess_123",
		CDPURL:            "wss://example.invalid/devtools/browser/1",
	})
	if err != nil {
		t.Fatalf("upsertManagedSession: %v", err)
	}

	got, found, err := getManagedSession(cfg, "default")
	if err != nil {
		t.Fatalf("getManagedSession: %v", err)
	}
	if !found {
		t.Fatalf("getManagedSession found = false, want true")
	}
	if got.ProviderSessionID != "sess_123" {
		t.Fatalf("ProviderSessionID = %q, want %q", got.ProviderSessionID, "sess_123")
	}

	if err := deleteManagedSession(cfg, "default"); err != nil {
		t.Fatalf("deleteManagedSession: %v", err)
	}
	_, found, err = getManagedSession(cfg, "default")
	if err != nil {
		t.Fatalf("getManagedSession after delete: %v", err)
	}
	if found {
		t.Fatalf("getManagedSession found = true after delete, want false")
	}
}
