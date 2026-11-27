package main

import (
	"bytes"
	"strings"
	"testing"

	"github.com/x402agent/SolanaOS/clawdbot/pkg/ooda"
)

func TestVersionCommandPrintsClawdbot(t *testing.T) {
	cmd := NewClawdBotCommand()
	buf := &bytes.Buffer{}
	cmd.SetOut(buf)
	cmd.SetErr(buf)
	cmd.SetArgs([]string{"version"})
	if err := cmd.Execute(); err != nil {
		t.Fatalf("version: %v\n%s", err, buf.String())
	}
	got := buf.String()
	if !strings.Contains(got, "clawdbot") {
		t.Fatalf("version output missing clawdbot identity:\n%s", got)
	}
}

func TestQuickStartCommandsRegistered(t *testing.T) {
	cmd := NewClawdBotCommand()
	need := []string{"version", "agent", "ooda", "solana"}
	for _, name := range need {
		found := false
		for _, c := range cmd.Commands() {
			if c.Name() == name {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("missing subcommand %s", name)
		}
	}
	solanaCmd, _, err := cmd.Find([]string{"solana", "trending"})
	if err != nil {
		t.Fatalf("find solana trending: %v", err)
	}
	if solanaCmd.Name() != "trending" {
		t.Fatalf("got %s, want trending", solanaCmd.Name())
	}
}

func TestSimFlagDefaultsToOneTick(t *testing.T) {
	if got := ooda.ResolveTickCount(true, 0, false); got != 1 {
		t.Fatalf("README ooda --sim should run 1 tick, got %d", got)
	}
}
