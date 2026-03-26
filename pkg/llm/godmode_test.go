package llm

import "testing"

func TestDetectGodModeProfileTrading(t *testing.T) {
	profile, confidence := detectGodModeProfile("Give me a SOL perp setup with entry, stop, target, and risk.", nil)
	if profile.ID != "trading" && profile.ID != "execution" {
		t.Fatalf("profile.ID = %q, want trading or execution", profile.ID)
	}
	if confidence <= 0 {
		t.Fatalf("confidence = %f, want > 0", confidence)
	}
}

func TestDetectGodModeProfileCode(t *testing.T) {
	profile, _ := detectGodModeProfile("Write a Go function that parses a Jupiter swap response and add tests.", nil)
	if profile.ID != "code" {
		t.Fatalf("profile.ID = %q, want code", profile.ID)
	}
}

func TestCleanupGodModeReply(t *testing.T) {
	got := cleanupGodModeReply("Sure, I think the cleanest path is to switch the provider and retry.")
	want := "The cleanest path is to switch the provider and retry."
	if got != want {
		t.Fatalf("cleanupGodModeReply() = %q, want %q", got, want)
	}
}

func TestScoreGodModeResponseRewardsStructuredTradingAnswer(t *testing.T) {
	query := "Give me a SOL trade setup with entry stop target and risk."
	structured := `## Setup

- Bias: long
- Entry: 172-174
- Stop: 168
- Target: 181
- Risk: breakdown below 168 invalidates the setup`
	flat := "SOL looks okay."

	if scoreGodModeResponse("trading", query, structured) <= scoreGodModeResponse("trading", query, flat) {
		t.Fatalf("expected structured response to outscore flat response")
	}
}
