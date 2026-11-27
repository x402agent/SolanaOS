package godmode

import (
	"context"
	"strings"
	"sync"
	"testing"

	"github.com/x402agent/SolanaOS/clawdbot/pkg/providers"
)

func TestAutoTuneClassifiesCoreContexts(t *testing.T) {
	tuner := NewAutoTuner()

	codeParams, codeClass := tuner.Tune("Write a Go function that parses a Jupiter swap response and add tests.", nil, true)
	if codeClass.Context != ContextCode {
		t.Fatalf("code context = %s, want %s", codeClass.Context, ContextCode)
	}
	if codeParams.Temperature > 0.35 {
		t.Fatalf("code temperature = %.2f, want conservative", codeParams.Temperature)
	}

	tradingParams, tradingClass := tuner.Tune("Give me a SOL perp setup with entry, stop, target, and risk.", nil, true)
	if tradingClass.Context != ContextTrading {
		t.Fatalf("trading context = %s, want %s", tradingClass.Context, ContextTrading)
	}
	if tradingParams.TopK < 30 || tradingParams.TopK > 45 {
		t.Fatalf("trading top_k = %d, want trading range", tradingParams.TopK)
	}

	_, conversationalClass := tuner.Tune("hey gm", nil, true)
	if conversationalClass.Context != ContextConversational {
		t.Fatalf("conversational context = %s, want %s", conversationalClass.Context, ContextConversational)
	}
}

func TestCleanerNormalizesReasoningHedgesAndPreambles(t *testing.T) {
	cleaner := NewCleaner()
	got, applied, stripped := cleaner.Normalize("<think>private chain of thought</think>Sure, I think the approach is good. However, we should utilize tests.")
	if !stripped {
		t.Fatalf("expected reasoning strip")
	}
	for _, blocked := range []string{"<think>", "Sure", "I think", "However", "utilize"} {
		if strings.Contains(got, blocked) {
			t.Fatalf("normalized output still contains %q: %q", blocked, got)
		}
	}
	if !strings.Contains(got, "The approach is good") || !strings.Contains(got, "use tests") {
		t.Fatalf("normalized output lost substance: %q", got)
	}
	if len(applied) < 3 {
		t.Fatalf("applied = %#v, want multiple STM modules", applied)
	}
}

func TestScoreResponseRewardsStructuredSpecificTradingAnswer(t *testing.T) {
	query := "Give me SOL entry stop target risk"
	structured := "Entry: 145\nStop: 139\nTarget: 162\nRisk: 1R\nConfidence: 0.68\nThesis: SOL momentum holds above VWAP with liquidity confirmation."
	flat := "SOL looks okay."

	if ScoreResponse(structured, query, ContextTrading).Total <= ScoreResponse(flat, query, ContextTrading).Total {
		t.Fatalf("structured trading answer should outscore flat answer")
	}
}

func TestFeedbackLoopMovesTowardPositiveParams(t *testing.T) {
	loop := NewFeedbackLoop()
	base := SamplingParams{Temperature: 0.5, TopP: 0.9, TopK: 50, FrequencyPenalty: 0.1, PresencePenalty: 0.1, RepetitionPenalty: 1}
	positive := SamplingParams{Temperature: 1.2, TopP: 0.95, TopK: 80, FrequencyPenalty: 0.4, PresencePenalty: 0.5, RepetitionPenalty: 1.2}
	negative := SamplingParams{Temperature: 0.2, TopP: 0.8, TopK: 25, FrequencyPenalty: 0.0, PresencePenalty: 0.0, RepetitionPenalty: 0.9}

	for i := 0; i < 20; i++ {
		loop.Record(ContextCreative, positive, true)
		loop.Record(ContextCreative, negative, false)
	}

	adjusted, state := loop.Adjust(ContextCreative, base)
	if state.Total != 40 || state.AppliedWeight <= 0 {
		t.Fatalf("feedback state = %#v, want applied profile", state)
	}
	if adjusted.Temperature <= base.Temperature {
		t.Fatalf("temperature = %.2f, want above base %.2f", adjusted.Temperature, base.Temperature)
	}
}

func TestEngineChoosesHighestScoredCandidate(t *testing.T) {
	provider := &fakeProvider{responses: map[string]string{
		"fast": "Sure, SOL looks fine.",
		"deep": "Entry: 145\nStop: 139\nTarget: 162\nRisk: 1R\nConfidence: 0.68\nThesis: SOL momentum holds while funding stays neutral.\nInvalidation: lose 139 on volume.",
	}}
	engine := NewEngine(provider)

	result, err := engine.Generate(context.Background(), Request{
		Model:     "fast",
		Models:    []string{"fast", "deep"},
		MaxTokens: 512,
		Messages: []providers.Message{
			{Role: "system", Content: "You are ClawdBot."},
			{Role: "user", Content: "Give me a SOL perp setup with entry, stop, target, and risk."},
		},
	})
	if err != nil {
		t.Fatalf("Generate() error = %v", err)
	}
	if result.Metadata.WinnerModel != "deep" {
		t.Fatalf("winner = %q, want deep; metadata=%#v", result.Metadata.WinnerModel, result.Metadata)
	}
	if strings.Contains(result.Response.Content, "Sure") {
		t.Fatalf("winner content was not normalized: %q", result.Response.Content)
	}

	opts := provider.options()
	if len(opts) != 2 {
		t.Fatalf("provider calls = %d, want 2", len(opts))
	}
	if opts[0].TopP == 0 || opts[0].TopK == 0 || opts[0].RepetitionPenalty == 0 {
		t.Fatalf("sampling params were not forwarded: %#v", opts[0])
	}
	if !strings.Contains(opts[0].Messages[0].Content, "Go God Mode Runtime") {
		t.Fatalf("system prompt was not enriched: %q", opts[0].Messages[0].Content)
	}
}

type fakeProvider struct {
	mu        sync.Mutex
	responses map[string]string
	calls     []providers.ChatOptions
}

func (f *fakeProvider) Name() string { return "fake" }

func (f *fakeProvider) Chat(ctx context.Context, opts providers.ChatOptions) (*providers.Response, error) {
	f.mu.Lock()
	f.calls = append(f.calls, opts)
	f.mu.Unlock()
	content := f.responses[opts.Model]
	if content == "" {
		content = "fallback answer"
	}
	return &providers.Response{
		Content:      content,
		StopReason:   "end_turn",
		InputTokens:  11,
		OutputTokens: 17,
	}, nil
}

func (f *fakeProvider) options() []providers.ChatOptions {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]providers.ChatOptions, len(f.calls))
	copy(out, f.calls)
	return out
}
