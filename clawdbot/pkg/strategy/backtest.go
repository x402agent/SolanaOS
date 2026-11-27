package strategy

import "math"

// ── Backtest harness ──────────────────────────────────────────────────
// Replays the strategy over a historical OHLCV series so a change can be
// validated against data before it ever touches live capital. Pure math, no
// I/O — the same Evaluate() the live OODA loop uses drives every bar, so a
// backtest and production agree by construction.

// Bar is one OHLCV candle. Volume is unused by the current indicators but kept
// so callers can pass full market data without reshaping it.
type Bar struct {
	High  float64 `json:"high"`
	Low   float64 `json:"low"`
	Close float64 `json:"close"`
}

// BacktestResult summarizes a replay. Returns are expressed as fractions
// (0.05 = 5%), not percentages.
type BacktestResult struct {
	Trades       int       `json:"trades"`
	Wins         int       `json:"wins"`
	Losses       int       `json:"losses"`
	WinRate      float64   `json:"winRate"`
	TotalReturn  float64   `json:"totalReturn"`  // cumulative return of the equity curve
	AvgReturn    float64   `json:"avgReturn"`    // mean per-trade return
	MaxDrawdown  float64   `json:"maxDrawdown"`  // largest peak-to-trough drop, as a positive fraction
	ProfitFactor float64   `json:"profitFactor"` // gross wins / gross losses (0 = no losses)
	Sharpe       float64   `json:"sharpe"`       // per-trade Sharpe (mean/stddev of returns)
	EquityCurve  []float64 `json:"equityCurve"`  // equity multiplier after each closed trade, seeded at 1.0
}

// Backtest replays params over bars using an event loop that mirrors the live
// agent: on each bar with no open position it asks Evaluate() for a signal; when
// one fires it opens a position and then exits on the first later bar whose high
// or low touches the take-profit or stop-loss. Position return is scaled by the
// signal's PositionSize so sizing changes show up in the equity curve.
//
// window is how many trailing bars are handed to Evaluate() each step; it must
// exceed the slow EMA period for signals to form. Bars must be chronological.
func Backtest(bars []Bar, params StrategyParams, window int) BacktestResult {
	res := BacktestResult{ProfitFactor: 0, EquityCurve: []float64{1.0}}
	if window < params.EMASlowPeriod+5 {
		window = params.EMASlowPeriod + 5
	}
	if len(bars) <= window {
		return res
	}

	equity := 1.0
	var grossWin, grossLoss float64
	returns := make([]float64, 0, len(bars))

	i := window
	for i < len(bars) {
		closes, highs, lows := seriesUpTo(bars, i, window)
		sig := Evaluate(closes, highs, lows, params)
		if sig.Direction != "long" && sig.Direction != "short" {
			i++
			continue
		}

		entry := bars[i].Close
		size := sig.PositionSize
		if size <= 0 {
			size = 1
		}

		// Walk forward until stop or target is touched; mark-to-market at the
		// last bar if neither triggers before the series ends.
		ret, exitIdx := simulateTrade(bars, i, sig, entry)
		tradeReturn := ret * size

		equity *= 1 + tradeReturn
		returns = append(returns, tradeReturn)
		res.EquityCurve = append(res.EquityCurve, equity)
		res.Trades++
		if tradeReturn >= 0 {
			res.Wins++
			grossWin += tradeReturn
		} else {
			res.Losses++
			grossLoss += -tradeReturn
		}

		// Resume scanning after the trade closed to avoid overlapping entries.
		if exitIdx > i {
			i = exitIdx
		} else {
			i++
		}
	}

	res.TotalReturn = equity - 1
	if res.Trades > 0 {
		res.WinRate = float64(res.Wins) / float64(res.Trades)
		res.AvgReturn = mean(returns)
	}
	if grossLoss > 0 {
		res.ProfitFactor = grossWin / grossLoss
	}
	res.MaxDrawdown = maxDrawdown(res.EquityCurve)
	res.Sharpe = sharpe(returns)
	return res
}

// simulateTrade returns the fractional P&L of a position opened at entry and the
// bar index at which it closed. Long stops below entry, short stops above.
func simulateTrade(bars []Bar, openIdx int, sig StrategySignal, entry float64) (float64, int) {
	long := sig.Direction == "long"
	for j := openIdx + 1; j < len(bars); j++ {
		hi, lo := bars[j].High, bars[j].Low
		if long {
			if sig.StopLoss > 0 && lo <= sig.StopLoss {
				return (sig.StopLoss - entry) / entry, j
			}
			if sig.TakeProfit > 0 && hi >= sig.TakeProfit {
				return (sig.TakeProfit - entry) / entry, j
			}
		} else {
			if sig.StopLoss > 0 && hi >= sig.StopLoss {
				return (entry - sig.StopLoss) / entry, j
			}
			if sig.TakeProfit > 0 && lo <= sig.TakeProfit {
				return (entry - sig.TakeProfit) / entry, j
			}
		}
	}
	// Never triggered: mark to the final close.
	last := bars[len(bars)-1].Close
	if long {
		return (last - entry) / entry, len(bars) - 1
	}
	return (entry - last) / entry, len(bars) - 1
}

func seriesUpTo(bars []Bar, idx, window int) (closes, highs, lows []float64) {
	start := idx - window + 1
	if start < 0 {
		start = 0
	}
	n := idx - start + 1
	closes = make([]float64, n)
	highs = make([]float64, n)
	lows = make([]float64, n)
	for k := 0; k < n; k++ {
		b := bars[start+k]
		closes[k] = b.Close
		highs[k] = b.High
		lows[k] = b.Low
	}
	return closes, highs, lows
}

func mean(xs []float64) float64 {
	if len(xs) == 0 {
		return 0
	}
	sum := 0.0
	for _, x := range xs {
		sum += x
	}
	return sum / float64(len(xs))
}

func sharpe(returns []float64) float64 {
	if len(returns) < 2 {
		return 0
	}
	m := mean(returns)
	var varSum float64
	for _, r := range returns {
		d := r - m
		varSum += d * d
	}
	std := math.Sqrt(varSum / float64(len(returns)-1))
	// When trades cluster on near-identical fixed stops, std approaches zero and
	// m/std explodes into a meaningless value. Require dispersion that is
	// non-trivial relative to the mean before reporting a ratio, and clamp to a
	// sane band so a degenerate run can't emit ±1e15.
	if std < 1e-9 || std < 1e-6*math.Abs(m) {
		return 0
	}
	s := m / std
	if s > 100 {
		return 100
	}
	if s < -100 {
		return -100
	}
	return s
}

// maxDrawdown returns the largest peak-to-trough decline of an equity curve as a
// positive fraction (0.2 = a 20% drop from a prior high).
func maxDrawdown(curve []float64) float64 {
	if len(curve) == 0 {
		return 0
	}
	peak := curve[0]
	maxDD := 0.0
	for _, v := range curve {
		if v > peak {
			peak = v
		}
		if peak > 0 {
			dd := (peak - v) / peak
			if dd > maxDD {
				maxDD = dd
			}
		}
	}
	return maxDD
}
