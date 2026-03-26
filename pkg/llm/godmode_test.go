package llm

import "testing"

func TestDetectGodModeProfileTrading(t *testing.T) {
	ctx, confidence := DetectAutoTuneContext("Give me a SOL perp setup with entry, stop, target, and risk.", nil)
	if ctx != ContextTrading && ctx != ContextExecution {
		t.Fatalf("context = %q, want trading or execution", ctx)
	}
	if confidence <= 0 {
		t.Fatalf("confidence = %f, want > 0", confidence)
	}
}

func TestDetectGodModeProfileCode(t *testing.T) {
	ctx, _ := DetectAutoTuneContext("Write a Go function that parses a Jupiter swap response and add tests.", nil)
	if ctx != ContextCode {
		t.Fatalf("context = %q, want code", ctx)
	}
}

func TestCleanupGodModeReply(t *testing.T) {
	cfg := STMConfig{HedgeReducer: true, DirectMode: true}
	got := ApplySTM("Sure, I think the cleanest path is to switch the provider and retry.", cfg)
	want := "The cleanest path is to switch the provider and retry."
	if got != want {
		t.Fatalf("ApplySTM() = %q, want %q", got, want)
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
