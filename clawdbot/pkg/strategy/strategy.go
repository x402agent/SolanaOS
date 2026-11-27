// Package strategy implements the ClawdBot quantitative trading strategy.
// Ported from ClawdBot OS StrategyRegistry.ts + ClawdBotStrategy.ts.
// Pure Go math — no external indicator libraries.
package strategy

import (
	"fmt"
	"math"
)

// ── Indicators ───────────────────────────────────────────────────────
// All implemented from first principles (Wilder's smoothing for RSI).

// RSI computes Wilder's Relative Strength Index.
// Uses SMA seed for first `period` bars, then exponential smoothing.
func RSI(closes []float64, period int) float64 {
	if len(closes) < period+1 {
		return 50 // neutral if insufficient data
	}

	// Calculate gains and losses
	var avgGain, avgLoss float64

	// Seed with SMA
	for i := 1; i <= period; i++ {
		change := closes[i] - closes[i-1]
		if change > 0 {
			avgGain += change
		} else {
			avgLoss += -change
		}
	}
	avgGain /= float64(period)
	avgLoss /= float64(period)

	// Wilder's smoothing for remaining bars
	for i := period + 1; i < len(closes); i++ {
		change := closes[i] - closes[i-1]
		var gain, loss float64
		if change > 0 {
			gain = change
		} else {
			loss = -change
		}
		avgGain = (avgGain*float64(period-1) + gain) / float64(period)
		avgLoss = (avgLoss*float64(period-1) + loss) / float64(period)
	}

	if avgLoss == 0 {
		return 100
	}
	rs := avgGain / avgLoss
	return 100 - (100 / (1 + rs))
}

// EMA computes Exponential Moving Average with SMA warm-up.
func EMA(values []float64, period int) float64 {
	if len(values) == 0 {
		return 0
	}
	if len(values) < period {
		// Not enough data, return SMA
		sum := 0.0
		for _, v := range values {
			sum += v
		}
		return sum / float64(len(values))
	}

	// Seed with SMA of first `period` values
	sum := 0.0
	for i := 0; i < period; i++ {
		sum += values[i]
	}
	ema := sum / float64(period)

	// EMA multiplier
	k := 2.0 / float64(period+1)

	for i := period; i < len(values); i++ {
		ema = values[i]*k + ema*(1-k)
	}

	return ema
}

// EMASeries computes EMA for all points in the series.
func EMASeries(values []float64, period int) []float64 {
	if len(values) < period {
		return nil
	}

	result := make([]float64, len(values))

	// SMA seed
	sum := 0.0
	for i := 0; i < period; i++ {
		sum += values[i]
		result[i] = sum / float64(i+1)
	}

	k := 2.0 / float64(period+1)
	for i := period; i < len(values); i++ {
		result[i] = values[i]*k + result[i-1]*(1-k)
	}

	return result
}

// ATR computes Average True Range (volatility measure).
func ATR(highs, lows, closes []float64, period int) float64 {
	n := len(closes)
	if n < period+1 {
		return 0
	}

	// True Range for each bar
	trs := make([]float64, n-1)
	for i := 1; i < n; i++ {
		tr1 := highs[i] - lows[i]
		tr2 := math.Abs(highs[i] - closes[i-1])
		tr3 := math.Abs(lows[i] - closes[i-1])
		trs[i-1] = math.Max(tr1, math.Max(tr2, tr3))
	}

	// SMA of first period TRs
	sum := 0.0
	for i := 0; i < period; i++ {
		sum += trs[i]
	}
	atr := sum / float64(period)

	// Wilder's smoothing
	for i := period; i < len(trs); i++ {
		atr = (atr*float64(period-1) + trs[i]) / float64(period)
	}

	return atr
}

// DetectEMACross detects fresh crossovers between fast and slow EMA.
// Returns: "bullish", "bearish", or "none"
func DetectEMACross(fastEMA, slowEMA []float64) string {
	n := len(fastEMA)
	if n < 2 || len(slowEMA) < 2 {
		return "none"
	}

	prevFast := fastEMA[n-2]
	prevSlow := slowEMA[n-2]
	currFast := fastEMA[n-1]
	currSlow := slowEMA[n-1]

	if prevFast <= prevSlow && currFast > currSlow {
		return "bullish"
	}
	if prevFast >= prevSlow && currFast < currSlow {
		return "bearish"
	}
	return "none"
}

// ── ClawdBot Strategy ─────────────────────────────────────────────────
// Signal engine using RSI + EMA cross + price position confirmation.

type StrategyParams struct {
	RSIOverbought   int     `json:"rsiOverbought"`
	RSIOversold     int     `json:"rsiOversold"`
	EMAFastPeriod   int     `json:"emaFastPeriod"`
	EMASlowPeriod   int     `json:"emaSlowPeriod"`
	StopLossPct     float64 `json:"stopLossPct"`
	TakeProfitPct   float64 `json:"takeProfitPct"`
	PositionSizePct float64 `json:"positionSizePct"`
	UsePerps        bool    `json:"usePerps"`
}

type StrategySignal struct {
	Direction    string  `json:"direction"` // "long", "short", "neutral"
	Strength     float64 `json:"strength"`  // 0.0 - 1.0
	RSI          float64 `json:"rsi"`
	EMAFast      float64 `json:"emaFast"`
	EMASlow      float64 `json:"emaSlow"`
	EMACross     string  `json:"emaCross"`
	ATR          float64 `json:"atr"`
	StopLoss     float64 `json:"stopLoss"`
	TakeProfit   float64 `json:"takeProfit"`
	PositionSize float64 `json:"positionSize"`
	Reasoning    string  `json:"reasoning"`
}

// DefaultParams returns the ClawdBot strategy defaults.
func DefaultParams() StrategyParams {
	return StrategyParams{
		RSIOverbought:   70,
		RSIOversold:     30,
		EMAFastPeriod:   20,
		EMASlowPeriod:   50,
		StopLossPct:     0.08,
		TakeProfitPct:   0.20,
		PositionSizePct: 0.10,
		UsePerps:        true,
	}
}

// Evaluate generates a trading signal from OHLCV bars.
// Requires all three conditions to fire (same as ClawdBotStrategy.ts):
//
//	LONG:  RSI crosses above oversold + fresh bullish EMA cross + price > fast EMA
//	SHORT: RSI crosses below overbought + fresh bearish EMA cross + price < fast EMA
func Evaluate(closes, highs, lows []float64, params StrategyParams) StrategySignal {
	signal := StrategySignal{
		Direction:    "neutral",
		Strength:     0,
		PositionSize: params.PositionSizePct,
	}

	if len(closes) < params.EMASlowPeriod+5 {
		signal.Reasoning = "insufficient data"
		return signal
	}

	// Compute indicators
	currentPrice := closes[len(closes)-1]
	rsi := RSI(closes, 14)
	fastEMA := EMASeries(closes, params.EMAFastPeriod)
	slowEMA := EMASeries(closes, params.EMASlowPeriod)
	atr := ATR(highs, lows, closes, 14)
	emaCross := DetectEMACross(fastEMA, slowEMA)

	signal.RSI = rsi
	signal.EMAFast = fastEMA[len(fastEMA)-1]
	signal.EMASlow = slowEMA[len(slowEMA)-1]
	signal.EMACross = emaCross
	signal.ATR = atr

	// ── LONG signal ──────────────
	// A fresh bullish EMA cross confirmed by price reclaiming the fast EMA, with
	// RSI used as a filter — we go long on momentum turns but refuse to chase a
	// tape that is already overbought. (The prior rule additionally required RSI
	// to sit in a narrow oversold band on the same bar as a slow-EMA cross, a
	// near-impossible coincidence that made the strategy effectively never fire.)
	// A slow EMA cross lags price, so RSI is usually elevated by the time a
	// bullish cross confirms; filtering at RSIOverbought would reject essentially
	// every entry. Instead we veto only genuine blow-off tops — RSI beyond the
	// midpoint of [overbought, 100] — and let RSI scale strength below that.
	longBlowoff := (float64(params.RSIOverbought) + 100) / 2
	bullishCross := emaCross == "bullish"
	rsiLongOK := rsi < longBlowoff
	priceAboveFast := currentPrice > signal.EMAFast

	if bullishCross && rsiLongOK && priceAboveFast {
		signal.Direction = "long"
		signal.Strength = normalizeStrength(rsi, float64(params.RSIOversold), float64(params.RSIOverbought))

		// ATR-blended SL/TP
		sl := currentPrice - math.Max(currentPrice*params.StopLossPct, atr*1.5)
		tp := currentPrice + math.Max(currentPrice*params.TakeProfitPct, atr*3.0)
		signal.StopLoss = sl
		signal.TakeProfit = tp
		signal.Reasoning = fmt.Sprintf("LONG: bullish EMA%d/%d cross, price above EMA%d, RSI(%.0f) below overbought %d",
			params.EMAFastPeriod, params.EMASlowPeriod, params.EMAFastPeriod, rsi, params.RSIOverbought)
	}

	// ── SHORT signal ─────────────
	// Mirror of the long: a fresh bearish cross confirmed by price, with RSI
	// filtering out already-oversold tapes. Gated on UsePerps since spot cannot short.
	shortCapitulation := float64(params.RSIOversold) / 2
	bearishCross := emaCross == "bearish"
	rsiShortOK := rsi > shortCapitulation
	priceBelowFast := currentPrice < signal.EMAFast

	if bearishCross && rsiShortOK && priceBelowFast && params.UsePerps {
		signal.Direction = "short"
		signal.Strength = normalizeStrength(100-rsi, float64(100-params.RSIOverbought), float64(100-params.RSIOversold))

		sl := currentPrice + math.Max(currentPrice*params.StopLossPct, atr*1.5)
		tp := currentPrice - math.Max(currentPrice*params.TakeProfitPct, atr*3.0)
		signal.StopLoss = sl
		signal.TakeProfit = tp
		signal.Reasoning = fmt.Sprintf("SHORT: bearish EMA%d/%d cross, price below EMA%d, RSI(%.0f) above oversold %d",
			params.EMAFastPeriod, params.EMASlowPeriod, params.EMAFastPeriod, rsi, params.RSIOversold)
	}

	return signal
}

func normalizeStrength(value, min, max float64) float64 {
	if max == min {
		return 0.5
	}
	s := (value - min) / (max - min)
	if s < 0 {
		return 0
	}
	if s > 1 {
		return 1
	}
	return s
}

// ── Auto-Optimizer ───────────────────────────────────────────────────
// Hill-climbing param adjustment based on trade performance.
// Mirrors StrategyRegistry.autoOptimize() from TypeScript.

type TradeStats struct {
	WinRate    float64
	AvgPnL     float64
	TradeCount int
}

// AutoOptimize adjusts strategy params based on recent performance.
//
// Checks run from most-severe win rate to least so that a badly losing strategy
// widens its stop before the milder RSI adjustment can short-circuit the branch.
// Thresholds are clamped so repeated tuning can never invert overbought/oversold.
func AutoOptimize(params *StrategyParams, stats TradeStats) (changed bool, reason string) {
	if stats.TradeCount < 5 {
		return false, "insufficient trades"
	}

	if stats.WinRate < 0.35 {
		params.StopLossPct = math.Min(params.StopLossPct*1.1, 0.25)
		return true, "widened stop loss (winRate < 35%)"
	}

	if stats.WinRate < 0.45 {
		params.RSIOverbought = maxInt(params.RSIOverbought-2, 55)
		params.RSIOversold = minInt(params.RSIOversold+2, 45)
		return true, "tightened RSI thresholds (winRate < 45%)"
	}

	if stats.WinRate > 0.65 {
		params.PositionSizePct = math.Min(params.PositionSizePct*1.1, 0.25)
		return true, "scaled position size (winRate > 65%)"
	}

	return false, "no changes needed"
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ── Risk-based position sizing ────────────────────────────────────────
// Volatility-aware sizing: a trade is sized so that hitting its stop loses a
// fixed fraction of equity. Size therefore scales inversely with stop distance
// (wider stop → smaller position) and linearly with signal confidence. This is
// the core edge over naive fixed-fraction sizing, which risks wildly different
// dollar amounts depending on where the stop happens to sit.

// SizingInput describes one sizing decision. All monetary fields share one unit
// (SOL here), and prices share one unit (quote currency per token).
type SizingInput struct {
	EquitySOL       float64 // total account equity, in SOL
	RiskPerTradePct float64 // fraction of equity to lose if the stop is hit (e.g. 0.01 = 1%)
	EntryPrice      float64 // planned entry price
	StopLossPrice   float64 // planned stop price; must differ from entry
	Confidence      float64 // 0..1 signal confidence; scales the final size
	MaxPositionSOL  float64 // hard cap on notional (0 = no cap)
	MaxPositionPct  float64 // cap as fraction of equity (0 = no cap)
}

// RiskAdjustedSize returns the position notional in SOL such that a stop-out
// loses approximately RiskPerTradePct of equity, scaled by confidence and
// clamped by the configured caps. Returns 0 when inputs are unusable, so callers
// can fall back to a simpler sizing model.
func RiskAdjustedSize(in SizingInput) float64 {
	if in.EquitySOL <= 0 || in.EntryPrice <= 0 || in.RiskPerTradePct <= 0 {
		return 0
	}
	stopDist := math.Abs(in.EntryPrice - in.StopLossPrice)
	if stopDist <= 0 {
		return 0
	}
	// Fractional loss on the position if price travels from entry to stop.
	lossFrac := stopDist / in.EntryPrice
	// Notional whose lossFrac move equals RiskPerTradePct of equity.
	notional := (in.EquitySOL * in.RiskPerTradePct) / lossFrac

	conf := in.Confidence
	if conf <= 0 {
		conf = 1
	} else if conf > 1 {
		conf = 1
	}
	notional *= conf

	if in.MaxPositionPct > 0 {
		if cap := in.EquitySOL * in.MaxPositionPct; notional > cap {
			notional = cap
		}
	}
	if in.MaxPositionSOL > 0 && notional > in.MaxPositionSOL {
		notional = in.MaxPositionSOL
	}
	if notional < 0 {
		return 0
	}
	return notional
}
