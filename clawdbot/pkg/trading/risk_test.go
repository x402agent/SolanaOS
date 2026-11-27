package trading

import "testing"

func TestAssessTokenBlocksThinLiquidity(t *testing.T) {
	got := AssessToken(TokenSnapshot{
		Symbol:       "THIN",
		Price:        0.01,
		Volume24hUSD: 10_000,
		LiquidityUSD: 8_000,
	})
	if got.Decision != DecisionBlock {
		t.Fatalf("Decision = %s, want %s", got.Decision, DecisionBlock)
	}
	if got.Score >= 45 {
		t.Fatalf("Score = %d, want < 45", got.Score)
	}
}

func TestAssessTokenAllowsLiquidMarket(t *testing.T) {
	got := AssessToken(TokenSnapshot{
		Symbol:       "SOL",
		Price:        150,
		Change24hPct: 3.2,
		Volume24hUSD: 25_000_000,
		LiquidityUSD: 15_000_000,
	})
	if got.Decision != DecisionAllow {
		t.Fatalf("Decision = %s, want %s", got.Decision, DecisionAllow)
	}
	if got.Confidence < 1 {
		t.Fatalf("Confidence = %.2f, want >= 1", got.Confidence)
	}
}
