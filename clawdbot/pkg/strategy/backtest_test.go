package strategy

import (
	"math"
	"testing"
)

// syntheticBars builds a deterministic wave series with intrabar high/low so the
// backtest has something to trade against.
func syntheticBars(n int) []Bar {
	bars := make([]Bar, n)
	for i := 0; i < n; i++ {
		base := 100.0 + 15*math.Sin(float64(i)/6.0) + 0.05*float64(i)
		bars[i] = Bar{
			Close: base,
			High:  base * 1.02,
			Low:   base * 0.98,
		}
	}
	return bars
}

func TestBacktestInsufficientData(t *testing.T) {
	res := Backtest(syntheticBars(10), DefaultParams(), 60)
	if res.Trades != 0 {
		t.Fatalf("Trades = %d, want 0 for insufficient data", res.Trades)
	}
	if len(res.EquityCurve) != 1 || res.EquityCurve[0] != 1.0 {
		t.Fatalf("EquityCurve = %v, want seed [1.0]", res.EquityCurve)
	}
}

func TestBacktestRunsAndIsConsistent(t *testing.T) {
	res := Backtest(syntheticBars(400), DefaultParams(), 60)
	if res.Trades != res.Wins+res.Losses {
		t.Fatalf("Trades %d != Wins %d + Losses %d", res.Trades, res.Wins, res.Losses)
	}
	if res.Trades > 0 {
		wantWinRate := float64(res.Wins) / float64(res.Trades)
		if math.Abs(res.WinRate-wantWinRate) > 1e-9 {
			t.Fatalf("WinRate = %.4f, want %.4f", res.WinRate, wantWinRate)
		}
	}
	// Equity curve is seeded at 1.0 plus one point per trade.
	if len(res.EquityCurve) != res.Trades+1 {
		t.Fatalf("EquityCurve len = %d, want %d", len(res.EquityCurve), res.Trades+1)
	}
	// TotalReturn must agree with the final equity point.
	final := res.EquityCurve[len(res.EquityCurve)-1]
	if math.Abs(res.TotalReturn-(final-1)) > 1e-9 {
		t.Fatalf("TotalReturn %.6f inconsistent with equity curve %.6f", res.TotalReturn, final-1)
	}
	if res.MaxDrawdown < 0 || res.MaxDrawdown > 1 {
		t.Fatalf("MaxDrawdown = %.4f, want in [0,1]", res.MaxDrawdown)
	}
}

func TestMaxDrawdown(t *testing.T) {
	// Peak 1.5 then trough 0.9 → drawdown (1.5-0.9)/1.5 = 0.4.
	curve := []float64{1.0, 1.5, 1.2, 0.9, 1.1}
	if got := maxDrawdown(curve); math.Abs(got-0.4) > 1e-9 {
		t.Fatalf("maxDrawdown = %.4f, want 0.4", got)
	}
	if got := maxDrawdown([]float64{1, 2, 3}); got != 0 {
		t.Fatalf("monotonic-up drawdown = %.4f, want 0", got)
	}
}

func TestSharpeZeroVariance(t *testing.T) {
	if got := sharpe([]float64{0.01, 0.01, 0.01}); got != 0 {
		t.Fatalf("sharpe of constant returns = %.4f, want 0", got)
	}
}
