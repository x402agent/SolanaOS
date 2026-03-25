package config

import (
	"os"
	"path/filepath"
	"sync"
	"testing"
)

func TestBootstrapEnvLoadsDotEnvFromCWD(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	if err := os.WriteFile(path, []byte("CONSUMER_KEY=test-consumer\nTELEGRAM_BOT_TOKEN=test-telegram\n"), 0o644); err != nil {
		t.Fatalf("write .env: %v", err)
	}

	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	defer func() {
		_ = os.Chdir(wd)
	}()
	if err := os.Chdir(dir); err != nil {
		t.Fatalf("chdir: %v", err)
	}

	_ = os.Unsetenv("CONSUMER_KEY")
	_ = os.Unsetenv("TELEGRAM_BOT_TOKEN")
	bootstrapEnvOnce = sync.Once{}

	BootstrapEnv()

	if got := os.Getenv("CONSUMER_KEY"); got != "test-consumer" {
		t.Fatalf("CONSUMER_KEY = %q, want %q", got, "test-consumer")
	}
	if got := os.Getenv("TELEGRAM_BOT_TOKEN"); got != "test-telegram" {
		t.Fatalf("TELEGRAM_BOT_TOKEN = %q, want %q", got, "test-telegram")
	}
}

func TestApplyEnvOverridesHonchoKeyEnablesIntegrationAndBaseURLAlias(t *testing.T) {
	t.Setenv("HONCHO_ENABLED", "")
	t.Setenv("HONCHO_API_KEY", "hch-test-key")
	t.Setenv("HONCHO_BASE_URL", "https://api.honcho.dev")
	t.Setenv("HONCHO_URL", "")

	cfg := DefaultConfig()
	if cfg.Honcho.Enabled {
		t.Fatalf("default Honcho.Enabled = true, want false before env overrides")
	}

	applyEnvOverrides(cfg)

	if !cfg.Honcho.Enabled {
		t.Fatalf("Honcho.Enabled = false, want true when HONCHO_API_KEY is set")
	}
	if got := cfg.Honcho.APIKey; got != "hch-test-key" {
		t.Fatalf("Honcho.APIKey = %q, want %q", got, "hch-test-key")
	}
	if got := cfg.Honcho.BaseURL; got != "https://api.honcho.dev" {
		t.Fatalf("Honcho.BaseURL = %q, want %q", got, "https://api.honcho.dev")
	}
}

func TestPublicHubURLDefaultsAndOverrides(t *testing.T) {
	t.Setenv("SEEKER_SITE_URL", "")
	t.Setenv("NANOSOLANA_SITE_URL", "")
	t.Setenv("SOLANAOS_SITE_URL", "")
	if got := PublicHubURL(); got != "https://seeker.solanaos.net" {
		t.Fatalf("PublicHubURL() = %q, want %q", got, "https://seeker.solanaos.net")
	}

	t.Setenv("SEEKER_SITE_URL", "https://seeker.solanaos.net/")
	if got := PublicHubURL(); got != "https://seeker.solanaos.net" {
		t.Fatalf("PublicHubURL() override = %q, want %q", got, "https://seeker.solanaos.net")
	}
	if got := PublicDashboardURL(); got != "https://seeker.solanaos.net/dashboard" {
		t.Fatalf("PublicDashboardURL() = %q, want %q", got, "https://seeker.solanaos.net/dashboard")
	}
	if got := PublicPairURL(); got != "https://seeker.solanaos.net/pair" {
		t.Fatalf("PublicPairURL() = %q, want %q", got, "https://seeker.solanaos.net/pair")
	}
}

func TestDefaultConfigIncludesPublicRegistryDomains(t *testing.T) {
	cfg := DefaultConfig()
	if len(cfg.Registry.Domains) == 0 {
		t.Fatalf("DefaultConfig().Registry.Domains empty, want public domains")
	}

	foundHub := false
	foundSite := false
	for _, domain := range cfg.Registry.Domains {
		switch domain {
		case "seeker.solanaos.net":
			foundHub = true
		case "solanaos.net":
			foundSite = true
		}
	}
	if !foundHub || !foundSite {
		t.Fatalf("DefaultConfig().Registry.Domains = %v, want seeker.solanaos.net and solanaos.net", cfg.Registry.Domains)
	}
}

func TestApplyEnvOverridesBrowserUseAndBrowserbase(t *testing.T) {
	t.Setenv("BROWSERUSE_API_KEY", "browseruse-key")
	t.Setenv("BROWSERUSE_CLOUD_PROVIDER", "browserbase")
	t.Setenv("BROWSERBASE_API_KEY", "browserbase-key")
	t.Setenv("BROWSERBASE_PROJECT_ID", "proj_123")
	t.Setenv("BROWSERBASE_PROXIES", "true")
	t.Setenv("BROWSERBASE_ADVANCED_STEALTH", "true")
	t.Setenv("BROWSERBASE_KEEP_ALIVE", "false")
	t.Setenv("BROWSERBASE_SESSION_TIMEOUT", "600000")

	cfg := DefaultConfig()
	applyEnvOverrides(cfg)

	if got := cfg.Tools.BrowserUse.APIKey; got != "browseruse-key" {
		t.Fatalf("BrowserUse.APIKey = %q, want %q", got, "browseruse-key")
	}
	if got := cfg.Tools.BrowserUse.CloudProvider; got != "browserbase" {
		t.Fatalf("BrowserUse.CloudProvider = %q, want %q", got, "browserbase")
	}
	if got := cfg.Tools.BrowserUse.BrowserbaseAPIKey; got != "browserbase-key" {
		t.Fatalf("BrowserUse.BrowserbaseAPIKey = %q, want %q", got, "browserbase-key")
	}
	if got := cfg.Tools.BrowserUse.BrowserbaseProjectID; got != "proj_123" {
		t.Fatalf("BrowserUse.BrowserbaseProjectID = %q, want %q", got, "proj_123")
	}
	if !cfg.Tools.BrowserUse.BrowserbaseProxies {
		t.Fatalf("BrowserUse.BrowserbaseProxies = false, want true")
	}
	if !cfg.Tools.BrowserUse.BrowserbaseStealth {
		t.Fatalf("BrowserUse.BrowserbaseStealth = false, want true")
	}
	if cfg.Tools.BrowserUse.BrowserbaseKeepAlive {
		t.Fatalf("BrowserUse.BrowserbaseKeepAlive = true, want false")
	}
	if got := cfg.Tools.BrowserUse.BrowserbaseTimeoutMS; got != 600000 {
		t.Fatalf("BrowserUse.BrowserbaseTimeoutMS = %d, want %d", got, 600000)
	}
}
