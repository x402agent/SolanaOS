package clawdcode

import (
	"path/filepath"
	"reflect"
	"testing"
	"time"
)

func TestSidecarArgsPrependsCodeModeForPrompt(t *testing.T) {
	r := New(Config{Dir: "/tmp/clawd-code"})
	got := r.Config().SidecarArgs([]string{"Build an Anchor staking program"})
	want := []string{"code", "Build an Anchor staking program"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("SidecarArgs() = %#v, want %#v", got, want)
	}
}

func TestSidecarArgsPassesDirectMode(t *testing.T) {
	r := New(Config{Dir: "/tmp/clawd-code"})
	got := r.Config().SidecarArgs([]string{"research", "--agents", "16", "Solana perps funding arb"})
	want := []string{"research", "--agents", "16", "Solana perps funding arb"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("SidecarArgs() = %#v, want %#v", got, want)
	}
}

func TestPlanUsesGLM52Environment(t *testing.T) {
	r := New(Config{Dir: "/tmp/clawd-code", Stream: true, Timeout: time.Second})
	plan := r.Plan([]string{"inspect"})
	wantEntry := filepath.Join("/tmp/clawd-code", "dist", "cli.js")
	if plan.Entry != wantEntry {
		t.Fatalf("Entry = %q, want %q", plan.Entry, wantEntry)
	}
	if !reflect.DeepEqual(plan.Command, []string{"node", wantEntry, "inspect"}) {
		t.Fatalf("Command = %#v", plan.Command)
	}
	for key, want := range map[string]string{
		"CLAWD_PROVIDER":       "zai",
		"CLAWD_MODEL":          "glm-5.2",
		"ZAI_MODEL":            "glm-5.2",
		"ZAI_THINKING":         "enabled",
		"ZAI_REASONING_EFFORT": "max",
		"CLAWD_STREAM":         "true",
	} {
		if got := plan.Env[key]; got != want {
			t.Fatalf("Env[%s] = %q, want %q", key, got, want)
		}
	}
}
