package llm

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestResolveActiveProviderPrefersRequestedProvider(t *testing.T) {
	got := resolveActiveProvider("ollama", "sk-or", "sk-ant", "sk-xai", "minimax-m2.7:cloud")
	if got != "ollama" {
		t.Fatalf("resolveActiveProvider() = %q, want %q", got, "ollama")
	}

	got = resolveActiveProvider("openrouter", "sk-or", "sk-ant", "sk-xai", "minimax-m2.7:cloud")
	if got != "openrouter" {
		t.Fatalf("resolveActiveProvider() = %q, want %q", got, "openrouter")
	}
}

func TestResolveActiveProviderDefaultsToOpenRouterWhenConfigured(t *testing.T) {
	got := resolveActiveProvider("", "sk-or", "", "", "minimax-m2.7:cloud")
	if got != "openrouter" {
		t.Fatalf("resolveActiveProvider() = %q, want %q", got, "openrouter")
	}

	got = resolveActiveProvider("", "", "sk-ant", "", "minimax-m2.7:cloud")
	if got != "anthropic" {
		t.Fatalf("resolveActiveProvider() = %q, want %q", got, "anthropic")
	}
}

func TestNewUsesMinimaxOpenRouterDefault(t *testing.T) {
	t.Setenv("OPENROUTER_API_KEY", "sk-or")
	t.Setenv("OPENROUTER_MODEL", "")
	t.Setenv("OPENROUTER_MIMO_MODEL", "")
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("XAI_API_KEY", "")
	t.Setenv("LLM_PROVIDER", "")
	t.Setenv("OLLAMA_MODEL", "minimax-m2.7:cloud")

	client := New()
	if client.model != DefaultModel {
		t.Fatalf("client.model = %q, want %q", client.model, DefaultModel)
	}
	if client.activeProvider != "openrouter" {
		t.Fatalf("client.activeProvider = %q, want %q", client.activeProvider, "openrouter")
	}
	if client.mimoModel != DefaultMimoModel {
		t.Fatalf("client.mimoModel = %q, want %q", client.mimoModel, DefaultMimoModel)
	}
}

func TestNewUsesConfiguredMimoModel(t *testing.T) {
	t.Setenv("OPENROUTER_API_KEY", "sk-or")
	t.Setenv("OPENROUTER_MODEL", "")
	t.Setenv("OPENROUTER_MIMO_MODEL", "xiaomi/mimo-v2-pro")
	t.Setenv("ANTHROPIC_API_KEY", "")
	t.Setenv("XAI_API_KEY", "")
	t.Setenv("LLM_PROVIDER", "")
	t.Setenv("OLLAMA_MODEL", "minimax-m2.7:cloud")

	client := New()
	if client.mimoModel != "xiaomi/mimo-v2-pro" {
		t.Fatalf("client.mimoModel = %q, want %q", client.mimoModel, "xiaomi/mimo-v2-pro")
	}
}

func TestBuildSystemPromptUsesSoulFileOverride(t *testing.T) {
	dir := t.TempDir()
	soulPath := filepath.Join(dir, "SOUL.md")
	if err := os.WriteFile(soulPath, []byte("# SOUL.md\n\nI am the soul override."), 0o644); err != nil {
		t.Fatalf("write soul: %v", err)
	}
	t.Setenv(soulPathEnvKey, soulPath)

	got := buildSystemPrompt("context block")
	for _, want := range []string{"SOUL.md Source of Truth", "I am the soul override.", "context block"} {
		if !strings.Contains(got, want) {
			t.Fatalf("buildSystemPrompt() missing %q:\n%s", want, got)
		}
	}
}
