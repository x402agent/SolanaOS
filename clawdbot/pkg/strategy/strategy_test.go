package strategy

import (
	"math"
	"testing"
)

func TestRSIExtremes(t *testing.T) {
	// Monotonic rising series → RSI pinned at 100.
	up := []float64{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16}
	if got := RSI(up, 14); got != 100 {
		t.Fatalf("RSI(rising) = %.2f, want 100", got)
	}
	// Insufficient data → neutral 50.
	if got := RSI([]float64{1, 2, 3}, 14); got != 50 {
		t.Fatalf("RSI(short) = %.2f, want 50", got)
	}
}

func TestEvaluateIsTradeable(t *testing.T) {
	// On a realistic oscillating market (trend + cycles + noise) the strategy must
	// produce at least one valid directional entry. The old rule fired zero
	// signals even on ideal data; this guards against regressing to that.
	closes := make([]float64, 500)
	for i := range closes {
		drift := 0.05 * float64(i)
		cycle := 12*math.Sin(float64(i)/9.0) + 6*math.Sin(float64(i)/3.3)
		seed := uint64(i)*2862933555777941757 + 3037000493
		noise := (float64(seed>>33)/float64(1<<31))*6 - 3
		closes[i] = 100 + drift + cycle + noise
	}
	highs := make([]float64, len(closes))
	lows := make([]float64, len(closes))
	for i, c := range closes {
		highs[i] = c * 1.01
		lows[i] = c * 0.99
	}

	fired := 0
	params := DefaultParams()
	for i := params.EMASlowPeriod + 5; i <= len(closes); i++ {
		sig := Evaluate(closes[:i], highs[:i], lows[:i], params)
		if sig.Direction == "long" || sig.Direction == "short" {
			fired++
			if sig.StopLoss <= 0 || sig.TakeProfit <= 0 {
				t.Fatalf("entry fired with invalid SL/TP: dir=%s sl=%.4f tp=%.4f", sig.Direction, sig.StopLoss, sig.TakeProfit)
			}
			if sig.Direction == "long" && sig.TakeProfit <= sig.StopLoss {
				t.Fatalf("long TP %.4f must exceed SL %.4f", sig.TakeProfit, sig.StopLoss)
			}
			if sig.Direction == "short" && sig.TakeProfit >= sig.StopLoss {
				t.Fatalf("short TP %.4f must be below SL %.4f", sig.TakeProfit, sig.StopLoss)
			}
			if sig.Strength < 0 || sig.Strength > 1 {
				t.Fatalf("strength out of range: %.4f", sig.Strength)
			}
		}
	}
	if fired == 0 {
		t.Fatal("strategy produced zero entries on a realistic oscillating market (untradeable)")
	}
}

func TestBacktestProducesTradesOnRecoveries(t *testing.T) {
	// Repeated V-recoveries must yield a non-zero number of trades now that the
	// entry logic is tradeable.
	bars := []Bar{}
	p := 100.0
	for cycle := 0; cycle < 15; cycle++ {
		for k := 0; k < 25; k++ {
			p *= 0.99
			bars = append(bars, Bar{Close: p, High: p * 1.01, Low: p * 0.99})
		}
		for k := 0; k < 25; k++ {
			p *= 1.012
			bars = append(bars, Bar{Close: p, High: p * 1.01, Low: p * 0.99})
		}
	}
	res := Backtest(bars, DefaultParams(), 60)
	if res.Trades == 0 {
		t.Fatal("backtest produced zero trades on repeated recoveries")
	}
}

func TestAutoOptimizeSevereLossWidensStop(t *testing.T) {
	// The <0.35 branch must be reachable; the old ordering let <0.45 shadow it.
	p := DefaultParams()
	before := p.StopLossPct
	changed, reason := AutoOptimize(&p, TradeStats{WinRate: 0.30, AvgPnL: -0.1, TradeCount: 20})
	if !changed {
		t.Fatalf("expected change for winRate 0.30")
	}
	if p.StopLossPct <= before {
		t.Fatalf("StopLossPct = %.4f, want > %.4f (widened)", p.StopLossPct, before)
	}
	if reason == "" {
		t.Fatal("expected a non-empty reason")
	}
}

func TestAutoOptimizeThresholdsNeverInvert(t *testing.T) {
	p := DefaultParams()
	// Hammer the mild-loss branch many times; thresholds must stay ordered.
	for i := 0; i < 50; i++ {
		AutoOptimize(&p, TradeStats{WinRate: 0.40, TradeCount: 10})
	}
	if p.RSIOversold >= p.RSIOverbought {
		t.Fatalf("RSI thresholds inverted: oversold=%d overbought=%d", p.RSIOversold, p.RSIOverbought)
	}
	if p.RSIOversold > 45 || p.RSIOverbought < 55 {
		t.Fatalf("RSI thresholds out of clamp: oversold=%d overbought=%d", p.RSIOversold, p.RSIOverbought)
	}
}

func TestAutoOptimizeInsufficientTrades(t *testing.T) {
	p := DefaultParams()
	if changed, _ := AutoOptimize(&p, TradeStats{WinRate: 0.10, TradeCount: 3}); changed {
		t.Fatal("expected no change with fewer than 5 trades")
	}
}

func TestRiskAdjustedSizeRisksFixedFraction(t *testing.T) {
	// Equity 100 SOL, risk 1% (=1 SOL), 10% stop distance → notional 10 SOL,
	// whose 10% adverse move loses exactly the 1 SOL risk budget.
	in := SizingInput{
		EquitySOL:       100,
		RiskPerTradePct: 0.01,
		EntryPrice:      100,
		StopLossPrice:   90,
		Confidence:      1,
	}
	got := RiskAdjustedSize(in)
	if math.Abs(got-10) > 1e-9 {
		t.Fatalf("size = %.6f, want 10", got)
	}
	loss := got * (in.EntryPrice - in.StopLossPrice) / in.EntryPrice
	if math.Abs(loss-1) > 1e-9 {
		t.Fatalf("stop-out loss = %.6f SOL, want 1 (1%% of equity)", loss)
	}
}

func TestRiskAdjustedSizeScalesInverselyWithStop(t *testing.T) {
	base := SizingInput{EquitySOL: 100, RiskPerTradePct: 0.01, EntryPrice: 100, Confidence: 1}
	tight := base
	tight.StopLossPrice = 95 // 5% stop
	wide := base
	wide.StopLossPrice = 80 // 20% stop
	// Wider stop must yield a smaller position for the same risk budget.
	if RiskAdjustedSize(wide) >= RiskAdjustedSize(tight) {
		t.Fatalf("wide-stop size %.4f should be < tight-stop size %.4f",
			RiskAdjustedSize(wide), RiskAdjustedSize(tight))
	}
}

func TestRiskAdjustedSizeConfidenceAndCaps(t *testing.T) {
	in := SizingInput{
		EquitySOL:       100,
		RiskPerTradePct: 0.01,
		EntryPrice:      100,
		StopLossPrice:   90,
		Confidence:      0.5,
	}
	if got := RiskAdjustedSize(in); math.Abs(got-5) > 1e-9 {
		t.Fatalf("confidence-scaled size = %.6f, want 5", got)
	}

	capped := in
	capped.Confidence = 1
	capped.MaxPositionSOL = 3
	if got := RiskAdjustedSize(capped); got != 3 {
		t.Fatalf("MaxPositionSOL cap: size = %.6f, want 3", got)
	}

	pctCap := in
	pctCap.Confidence = 1
	pctCap.MaxPositionPct = 0.04 // 4% of 100 = 4
	if got := RiskAdjustedSize(pctCap); got != 4 {
		t.Fatalf("MaxPositionPct cap: size = %.6f, want 4", got)
	}
}

func TestRiskAdjustedSizeRejectsBadInputs(t *testing.T) {
	cases := []SizingInput{
		{EquitySOL: 0, RiskPerTradePct: 0.01, EntryPrice: 100, StopLossPrice: 90},
		{EquitySOL: 100, RiskPerTradePct: 0, EntryPrice: 100, StopLossPrice: 90},
		{EquitySOL: 100, RiskPerTradePct: 0.01, EntryPrice: 0, StopLossPrice: 90},
		{EquitySOL: 100, RiskPerTradePct: 0.01, EntryPrice: 100, StopLossPrice: 100}, // zero stop distance
	}
	for i, in := range cases {
		if got := RiskAdjustedSize(in); got != 0 {
			t.Fatalf("case %d: expected 0 for bad input, got %.6f", i, got)
		}
	}
}
