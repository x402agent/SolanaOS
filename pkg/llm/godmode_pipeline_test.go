package llm

import (
	"strings"
	"testing"
)

// ════════════════════════════════════════════════════════════════════════
// AutoTune Context Detection
// ════════════════════════════════════════════════════════════════════════

func TestAutoTuneDetectsTrading(t *testing.T) {
	ctx, conf := DetectAutoTuneContext("Give me a SOL perp setup with entry, stop, target, and risk.", nil)
	if ctx != ContextTrading && ctx != ContextExecution {
		t.Fatalf("context = %q, want trading or execution", ctx)
	}
	if conf <= 0 {
		t.Fatalf("confidence = %f, want > 0", conf)
	}
}

func TestAutoTuneDetectsCode(t *testing.T) {
	ctx, _ := DetectAutoTuneContext("Write a Go function that parses a Jupiter swap response and add tests.", nil)
	if ctx != ContextCode {
		t.Fatalf("context = %q, want code", ctx)
	}
}

func TestAutoTuneDetectsAnalytical(t *testing.T) {
	ctx, _ := DetectAutoTuneContext("Analyze the tradeoffs between Raydium concentrated liquidity and standard AMM pools.", nil)
	if ctx != ContextAnalytical {
		t.Fatalf("context = %q, want analytical", ctx)
	}
}

func TestAutoTuneDetectsConversational(t *testing.T) {
	ctx, _ := DetectAutoTuneContext("hey gm", nil)
	if ctx != ContextConversational {
		t.Fatalf("context = %q, want conversational", ctx)
	}
}

func TestAutoTuneDetectsChaotic(t *testing.T) {
	ctx, _ := DetectAutoTuneContext("unleash the chaos!!! destroy everything!!!", nil)
	if ctx != ContextChaotic {
		t.Fatalf("context = %q, want chaotic", ctx)
	}
}

func TestAutoTuneParamsInBounds(t *testing.T) {
	result := ComputeAutoTuneParams("analyze this token's fundamentals", nil, nil)
	p := result.Params
	if p.Temperature < 0 || p.Temperature > 2.0 {
		t.Fatalf("temperature out of bounds: %f", p.Temperature)
	}
	if p.TopP < 0 || p.TopP > 1.0 {
		t.Fatalf("top_p out of bounds: %f", p.TopP)
	}
	if p.TopK < 1 || p.TopK > 100 {
		t.Fatalf("top_k out of bounds: %d", p.TopK)
	}
}

func TestAutoTuneGodModeBoost(t *testing.T) {
	base := AutoTuneParams{Temperature: 0.5, TopP: 0.9, TopK: 50, FrequencyPenalty: 0.1, PresencePenalty: 0.1, RepetitionPenalty: 1.0}
	boosted := GodModeBoost(base)
	if boosted.Temperature <= base.Temperature {
		t.Fatalf("GodModeBoost should increase temperature")
	}
	if boosted.PresencePenalty <= base.PresencePenalty {
		t.Fatalf("GodModeBoost should increase presence_penalty")
	}
	if boosted.FrequencyPenalty <= base.FrequencyPenalty {
		t.Fatalf("GodModeBoost should increase frequency_penalty")
	}
}

// ════════════════════════════════════════════════════════════════════════
// Parseltongue Input Perturbation
// ════════════════════════════════════════════════════════════════════════

func TestParseltongueDetectsTriggers(t *testing.T) {
	triggers := DetectTriggers("How do I hack into a system and exploit a vulnerability?", nil)
	if len(triggers) < 2 {
		t.Fatalf("expected at least 2 triggers, got %d: %v", len(triggers), triggers)
	}
	found := map[string]bool{}
	for _, tr := range triggers {
		found[tr] = true
	}
	if !found["hack"] {
		t.Fatal("expected 'hack' in triggers")
	}
	if !found["exploit"] {
		t.Fatal("expected 'exploit' in triggers")
	}
}

func TestParseltongueNoTriggersCleanText(t *testing.T) {
	triggers := DetectTriggers("Tell me about the weather today", nil)
	if len(triggers) != 0 {
		t.Fatalf("expected 0 triggers for clean text, got %d: %v", len(triggers), triggers)
	}
}

func TestParseltongueCustomTriggers(t *testing.T) {
	triggers := DetectTriggers("Let's talk about solana", []string{"solana"})
	found := false
	for _, tr := range triggers {
		if tr == "solana" {
			found = true
		}
	}
	if !found {
		t.Fatal("expected custom trigger 'solana' to be detected")
	}
}

func TestParseltongueLeetspeak(t *testing.T) {
	cfg := ParseltongueConfig{
		Enabled:   true,
		Technique: TechniqueLeetspeak,
		Intensity: IntensityHeavy,
	}
	result := ApplyParseltongue("I want to hack the system", cfg)
	if result.TransformedText == result.OriginalText {
		t.Fatal("expected text to be transformed")
	}
	if len(result.TriggersFound) == 0 {
		t.Fatal("expected triggers to be found")
	}
}

func TestParseltongueDisabled(t *testing.T) {
	cfg := ParseltongueConfig{Enabled: false}
	result := ApplyParseltongue("hack exploit bypass", cfg)
	if result.TransformedText != result.OriginalText {
		t.Fatal("expected no transformation when disabled")
	}
}

func TestParseltongueZWJ(t *testing.T) {
	cfg := ParseltongueConfig{
		Enabled:   true,
		Technique: TechniqueZWJ,
		Intensity: IntensityMedium,
	}
	result := ApplyParseltongue("bypass the firewall", cfg)
	if len(result.TransformedText) <= len(result.OriginalText) {
		t.Fatal("ZWJ should increase text length due to invisible chars")
	}
}

func TestParseltongueMixedCase(t *testing.T) {
	cfg := ParseltongueConfig{
		Enabled:   true,
		Technique: TechniqueMixedCase,
		Intensity: IntensityHeavy,
	}
	result := ApplyParseltongue("inject malware", cfg)
	if result.TransformedText == result.OriginalText {
		t.Fatal("mixed case should transform trigger words")
	}
}

// ════════════════════════════════════════════════════════════════════════
// STM Output Normalization
// ════════════════════════════════════════════════════════════════════════

func TestSTMHedgeReducer(t *testing.T) {
	cfg := STMConfig{HedgeReducer: true}
	input := "I think the cleanest path is to switch the provider. Perhaps we should also retry."
	output := ApplySTM(input, cfg)
	if strings.Contains(output, "I think") {
		t.Fatal("hedge reducer should remove 'I think'")
	}
	if strings.Contains(output, "Perhaps") {
		t.Fatal("hedge reducer should remove 'Perhaps'")
	}
}

func TestSTMDirectMode(t *testing.T) {
	cfg := STMConfig{DirectMode: true}
	input := "Sure, here's how you do it. First step is to..."
	output := ApplySTM(input, cfg)
	if strings.HasPrefix(output, "Sure") {
		t.Fatal("direct mode should remove preamble 'Sure'")
	}
}

func TestSTMCasualMode(t *testing.T) {
	cfg := STMConfig{CasualMode: true}
	input := "However, you should utilize the existing implementation. Furthermore, it works."
	output := ApplySTM(input, cfg)
	if strings.Contains(output, "However") {
		t.Fatal("casual mode should replace 'However' with 'But'")
	}
	if strings.Contains(output, "utilize") {
		t.Fatal("casual mode should replace 'utilize' with 'use'")
	}
	if strings.Contains(output, "Furthermore") {
		t.Fatal("casual mode should replace 'Furthermore' with 'Also'")
	}
}

func TestSTMFullPipeline(t *testing.T) {
	cfg := STMConfig{HedgeReducer: true, DirectMode: true, CasualMode: true}
	input := "Sure, I think the approach is good. However, we should utilize the existing caching layer. Furthermore, it seems like the performance is adequate."
	output := ApplySTM(input, cfg)
	if strings.Contains(output, "Sure") {
		t.Fatal("pipeline should remove preamble")
	}
	if strings.Contains(output, "I think") {
		t.Fatal("pipeline should remove hedges")
	}
	if strings.Contains(output, "However") {
		t.Fatal("pipeline should casualize connectives")
	}
	if strings.Contains(output, "utilize") {
		t.Fatal("pipeline should casualize verbs")
	}
	if len(output) >= len(input) {
		t.Fatalf("pipeline should reduce text length: %d >= %d", len(output), len(input))
	}
}

// ════════════════════════════════════════════════════════════════════════
// Refusal Detection
// ════════════════════════════════════════════════════════════════════════

func TestCountRefusalPatterns(t *testing.T) {
	refusal := "I cannot help with that. As an AI, I'm unable to provide that information."
	count := CountRefusalPatterns(refusal)
	if count < 2 {
		t.Fatalf("expected at least 2 refusal patterns, got %d", count)
	}
}

func TestCountRefusalPatternsClean(t *testing.T) {
	clean := "Here's a detailed breakdown of the SOL/USDC liquidity dynamics."
	count := CountRefusalPatterns(clean)
	if count != 0 {
		t.Fatalf("expected 0 refusal patterns in clean text, got %d", count)
	}
}

// ════════════════════════════════════════════════════════════════════════
// ULTRAPLINIAN Scoring
// ════════════════════════════════════════════════════════════════════════

func TestScoringRewardsStructuredResponse(t *testing.T) {
	query := "Give me a SOL trade setup with entry stop target and risk."
	structured := `## Setup

- Bias: long
- Entry: 172-174
- Stop: 168
- Target: 181
- Risk: breakdown below 168 invalidates the setup

### Rationale
Strong volume breakout above the 170 resistance level with increasing momentum.`

	flat := "SOL looks okay."
	structuredScore := scoreGodModeResponse("trading", query, structured)
	flatScore := scoreGodModeResponse("trading", query, flat)
	if structuredScore <= flatScore {
		t.Fatalf("structured (%d) should outscore flat (%d)", structuredScore, flatScore)
	}
}

func TestScoringPenalizesRefusals(t *testing.T) {
	query := "Explain how Solana validators work"
	helpful := "Solana validators run the Proof of History consensus. They process transactions in parallel using the Sealevel runtime. Each validator stakes SOL to participate in block production."
	refusal := "I cannot provide information about that topic. As an AI language model, I'm unable to help with this request."
	helpfulScore := scoreGodModeResponse("analytical", query, helpful)
	refusalScore := scoreGodModeResponse("analytical", query, refusal)
	if helpfulScore <= refusalScore {
		t.Fatalf("helpful (%d) should outscore refusal (%d)", helpfulScore, refusalScore)
	}
}

func TestScoringPenalizesPreambles(t *testing.T) {
	query := "What is the best DEX on Solana?"
	direct := "Jupiter is the leading DEX aggregator on Solana, routing through Raydium, Orca, and others for best execution."
	preamble := "Sure, great question! I'd be happy to help you with that. Jupiter is the leading DEX aggregator on Solana."
	directScore := scoreGodModeResponse("analytical", query, direct)
	preambleScore := scoreGodModeResponse("analytical", query, preamble)
	if directScore <= preambleScore {
		t.Fatalf("direct (%d) should outscore preamble (%d)", directScore, preambleScore)
	}
}

// ════════════════════════════════════════════════════════════════════════
// EMA Feedback Loop
// ════════════════════════════════════════════════════════════════════════

func TestFeedbackLoopConverges(t *testing.T) {
	fs := NewFeedbackState()

	preferredParams := AutoTuneParams{
		Temperature: 0.3, TopP: 0.85, TopK: 30,
		FrequencyPenalty: 0.3, PresencePenalty: 0.1, RepetitionPenalty: 1.1,
	}
	dislikedParams := AutoTuneParams{
		Temperature: 1.2, TopP: 0.95, TopK: 80,
		FrequencyPenalty: 0.7, PresencePenalty: 0.8, RepetitionPenalty: 1.3,
	}

	// Feed alternating positive/negative ratings.
	for i := 0; i < 20; i++ {
		fs.RecordFeedback(FeedbackRecord{
			MessageID:   "pos-" + itoa(i),
			ContextType: ContextCode,
			Rating:      1,
			Params:      preferredParams,
		})
		fs.RecordFeedback(FeedbackRecord{
			MessageID:   "neg-" + itoa(i),
			ContextType: ContextCode,
			Rating:      -1,
			Params:      dislikedParams,
		})
	}

	// Apply adjustments and verify they nudge toward preferred.
	base := contextProfiles[ContextCode]
	adjusted, applied, note := fs.ApplyAdjustments(base, ContextCode)
	if !applied {
		t.Fatal("expected adjustments to be applied after 40 samples")
	}
	if note == "" {
		t.Fatal("expected non-empty note")
	}
	// Adjusted temperature should be closer to preferred (0.3) than the disliked (1.2).
	if adjusted.Temperature > base.Temperature+0.3 {
		t.Fatalf("expected temperature to nudge toward preferred, got %f", adjusted.Temperature)
	}
}

func TestFeedbackColdStart(t *testing.T) {
	fs := NewFeedbackState()
	// With no feedback, adjustments should not be applied.
	base := contextProfiles[ContextCode]
	_, applied, _ := fs.ApplyAdjustments(base, ContextCode)
	if applied {
		t.Fatal("expected no adjustments with 0 samples")
	}
}

// ════════════════════════════════════════════════════════════════════════
// Quality Heuristics
// ════════════════════════════════════════════════════════════════════════

func TestRepetitionScore(t *testing.T) {
	repetitive := "the dog the dog the dog the dog the dog the dog the dog"
	score := ComputeRepetitionScore(repetitive)
	if score < 0.3 {
		t.Fatalf("expected high repetition score, got %f", score)
	}

	diverse := "Solana validators process transactions using proof of history consensus and the sealevel runtime for parallel execution"
	score2 := ComputeRepetitionScore(diverse)
	if score2 > 0.1 {
		t.Fatalf("expected low repetition score for diverse text, got %f", score2)
	}
}

func TestVocabularyDiversity(t *testing.T) {
	diverse := "Solana validators process transactions using proof of history consensus"
	score := VocabularyDiversity(diverse)
	if score < 0.8 {
		t.Fatalf("expected high vocab diversity, got %f", score)
	}

	repetitive := "the the the the the the"
	score2 := VocabularyDiversity(repetitive)
	if score2 > 0.3 {
		t.Fatalf("expected low vocab diversity, got %f", score2)
	}
}
