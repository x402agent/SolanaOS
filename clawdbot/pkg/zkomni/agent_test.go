package zkomni

import (
	"path/filepath"
	"reflect"
	"testing"
)

func TestPlanDefaultsToInspect(t *testing.T) {
	r := New(Config{Dir: "/tmp/zk-primitives"})
	plan := r.Plan(nil)
	wantEntry := filepath.Join("/tmp/zk-primitives", "agent", "dist", "cli.js")
	if plan.Entry != wantEntry {
		t.Fatalf("Entry = %q, want %q", plan.Entry, wantEntry)
	}
	want := []string{"node", wantEntry, "inspect"}
	if !reflect.DeepEqual(plan.Command, want) {
		t.Fatalf("Command = %#v, want %#v", plan.Command, want)
	}
	if plan.Agent != AgentID {
		t.Fatalf("Agent = %q", plan.Agent)
	}
	if plan.Dir != filepath.Join("/tmp/zk-primitives", "agent") {
		t.Fatalf("Dir = %q", plan.Dir)
	}
}

func TestPlanPassesDirectCommands(t *testing.T) {
	r := New(Config{Dir: "/tmp/zk-primitives"})
	got := r.Config().SidecarArgs([]string{"nullifier", "model-attest:v1"})
	want := []string{"nullifier", "model-attest:v1"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("SidecarArgs() = %#v, want %#v", got, want)
	}
}

func TestPlanWrapsNaturalLanguageAsAsk(t *testing.T) {
	r := New(Config{Dir: "/tmp/zk-primitives"})
	got := r.Config().SidecarArgs([]string{"attest this model 0xab"})
	want := []string{"ask", "attest this model 0xab"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("SidecarArgs() = %#v, want %#v", got, want)
	}
}

func TestValidateMissingEntry(t *testing.T) {
	r := New(Config{Dir: t.TempDir()})
	if err := r.Validate(); err == nil {
		t.Fatal("expected missing entry error")
	}
}
