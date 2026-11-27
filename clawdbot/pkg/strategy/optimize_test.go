package strategy

import "testing"

func trendyBars(n int) []Bar {
	bars := make([]Bar, n)
	p := 100.0
	for i := 0; i < n; i++ {
		// Regime-switching trend so momentum entries have something to catch.
		if (i/40)%2 == 0 {
			p *= 1.004
		} else {
			p *= 0.997
		}
		bars[i] = Bar{Close: p, High: p * 1.008, Low: p * 0.992}
	}
	return bars
}

func TestOptimizeReturnsValidWinner(t *testing.T) {
	bars := trendyBars(400)
	res := Optimize(bars, DefaultParams(), DefaultGrid(), CalmarScore, 0.7)
	if res.Evaluated == 0 {
		t.Fatal("optimizer evaluated no parameter combinations")
	}
	if res.Best.EMAFastPeriod >= res.Best.EMASlowPeriod {
		t.Fatalf("winner has fast %d >= slow %d", res.Best.EMAFastPeriod, res.Best.EMASlowPeriod)
	}
	if res.Best.RSIOversold >= res.Best.RSIOverbought {
		t.Fatalf("winner has oversold %d >= overbought %d", res.Best.RSIOversold, res.Best.RSIOverbought)
	}
	if res.SplitIndex <= 0 || res.SplitIndex >= len(bars) {
		t.Fatalf("split index %d out of range", res.SplitIndex)
	}
	// Overfit must be the reported difference of the two scores.
	if diff := res.InSampleScore - res.OutSampleScore; diff != res.Overfit {
		t.Fatalf("Overfit %.6f != inSample-outSample %.6f", res.Overfit, diff)
	}
}

func TestOptimizeInsufficientData(t *testing.T) {
	res := Optimize(trendyBars(50), DefaultParams(), DefaultGrid(), CalmarScore, 0.7)
	if res.Evaluated != 0 {
		t.Fatalf("expected no evaluation on tiny series, got %d", res.Evaluated)
	}
}

func TestCalmarScoreRejectsDegenerate(t *testing.T) {
	// Fewer than 3 trades must score as unusable so a never-trading config can't win.
	if got := CalmarScore(BacktestResult{Trades: 1, TotalReturn: 100}); got > -1e8 {
		t.Fatalf("degenerate result scored %.2f, want deeply negative", got)
	}
	// Return per unit drawdown, with the drawdown floor applied.
	got := CalmarScore(BacktestResult{Trades: 10, TotalReturn: 0.2, MaxDrawdown: 0.1})
	if got <= 0 {
		t.Fatalf("healthy result scored %.4f, want positive", got)
	}
}

func TestExpandGridSkipsInvalid(t *testing.T) {
	grid := ParamGrid{
		EMAFast:       []int{20, 50}, // 50 is invalid against slow=30
		EMASlow:       []int{30},
		RSIOverbought: []int{70},
		RSIOversold:   []int{30, 80}, // 80 invalid against overbought 70
	}
	combos := expandGrid(DefaultParams(), grid)
	for _, p := range combos {
		if p.EMAFastPeriod >= p.EMASlowPeriod {
			t.Fatalf("invalid EMA combo survived: fast %d slow %d", p.EMAFastPeriod, p.EMASlowPeriod)
		}
		if p.RSIOversold >= p.RSIOverbought {
			t.Fatalf("invalid RSI combo survived: oversold %d overbought %d", p.RSIOversold, p.RSIOverbought)
		}
	}
	// fast=20/slow=30 with oversold=30/overbought=70 is the only valid combo.
	if len(combos) != 1 {
		t.Fatalf("expected 1 valid combo, got %d", len(combos))
	}
}
