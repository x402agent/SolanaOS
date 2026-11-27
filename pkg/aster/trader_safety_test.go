package aster

import (
	"context"
	"math"
	"math/rand"
	"strings"
	"testing"
)

func TestValidateSignalNumbersRejectsNonFinite(t *testing.T) {
	bad := []TradeSignal{
		{Confidence: math.NaN()},
		{Confidence: math.Inf(1)},
		{Confidence: math.Inf(-1)},
		{Confidence: 0.9, SizePct: math.NaN()},
		{Confidence: 0.9, StopLoss: math.Inf(1)},
		{Confidence: 0.9, TakeProfit: math.NaN()},
		{Confidence: 0.9, EntryPrice: math.NaN()},
		{Confidence: 1.5},
		{Confidence: -0.1},
	}
	for i, s := range bad {
		if err := validateSignalNumbers(s); err == nil {
			t.Errorf("case %d: %+v accepted, want rejection", i, s)
		}
	}
	if err := validateSignalNumbers(TradeSignal{Confidence: 0.7, SizePct: 0.05}); err != nil {
		t.Fatalf("valid signal rejected: %v", err)
	}
}

// Regression: NaN < 0.60 is false, so a NaN confidence used to pass the gate.
// It must now be rejected before any exchange call (client is nil here, so
// reaching the network would panic).
func TestExecuteSignalRejectsNaNConfidenceBeforeExchange(t *testing.T) {
	tr := NewPerpTrader(TraderConfig{DryRun: true})
	for _, c := range []float64{math.NaN(), math.Inf(1)} {
		res := tr.ExecuteSignal(context.Background(), TradeSignal{Symbol: "SOLUSDT", Side: SideBuy, Confidence: c})
		if res.Success || !strings.Contains(res.Error, "confidence") {
			t.Fatalf("confidence %v: got success=%v err=%q, want confidence rejection", c, res.Success, res.Error)
		}
	}
}

func TestNewPerpTraderLeverageConfig(t *testing.T) {
	cases := []struct {
		name             string
		def, max         int
		wantDef, wantMax int
	}{
		{"unset max falls back to default", 5, 0, 5, 5},
		{"explicit max", 5, 10, 5, 10},
		{"default above max is lowered", 20, 10, 10, 10},
		{"max above exchange ceiling is clamped", 5, 500, 5, ExchangeMaxLeverage},
		{"all unset", 0, 0, 5, 5},
	}
	for _, c := range cases {
		tr := NewPerpTrader(TraderConfig{DefaultLeverage: c.def, MaxLeverage: c.max})
		if tr.defaultLeverage != c.wantDef || tr.maxLeverage != c.wantMax {
			t.Errorf("%s: got def=%d max=%d, want def=%d max=%d", c.name, tr.defaultLeverage, tr.maxLeverage, c.wantDef, c.wantMax)
		}
	}
}

// Regression: signal leverage used to be accepted up to a hard-coded 125x.
func TestResolveLeverageClampsToOperatorMax(t *testing.T) {
	tr := NewPerpTrader(TraderConfig{DefaultLeverage: 3, MaxLeverage: 10})
	cases := map[int]int{0: 3, -4: 3, 1: 1, 10: 10, 11: 10, 125: 10, 1000: 10}
	for in, want := range cases {
		if got := tr.resolveLeverage(TradeSignal{Leverage: in}); got != want {
			t.Errorf("leverage %d -> %d, want %d", in, got, want)
		}
	}
}

// Mirrors the Lean theorem `accepted_exposure_bounded` (see PR description):
// for ANY signal, notional = balance * sizePct * leverage never exceeds
// balance * maxPositionPct * maxLeverage.
func TestExposureBoundedForArbitrarySignals(t *testing.T) {
	r := rand.New(rand.NewSource(42))
	for i := 0; i < 20000; i++ {
		cfg := TraderConfig{
			DefaultLeverage: 1 + r.Intn(20),
			MaxLeverage:     r.Intn(200),
			MaxPositionPct:  r.Float64(),
		}
		tr := NewPerpTrader(cfg)
		sig := TradeSignal{
			Leverage: r.Intn(2000) - 100,
			SizePct:  r.Float64()*3 - 1,
		}
		balance := r.Float64() * 1e7
		notional := balance * tr.resolveSizePct(sig) * float64(tr.resolveLeverage(sig))
		bound := balance * tr.maxPositionPct * float64(tr.maxLeverage)
		if notional > bound*(1+1e-12) {
			t.Fatalf("exposure %.4f exceeds bound %.4f (cfg=%+v sig=%+v)", notional, bound, cfg, sig)
		}
		if tr.resolveLeverage(sig) > tr.maxLeverage || tr.resolveLeverage(sig) < 1 {
			t.Fatalf("leverage %d outside [1,%d]", tr.resolveLeverage(sig), tr.maxLeverage)
		}
	}
}
