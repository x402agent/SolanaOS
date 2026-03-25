// Package strategy implements the MawdBot quantitative trading strategy.
// Ported from MawdBot OS StrategyRegistry.ts + MawdBotStrategy.ts.
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

// ── MawdBot Strategy ─────────────────────────────────────────────────
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

// DefaultParams returns the MawdBot strategy defaults.
// Tuned for Solana memecoin volatility: faster EMAs, wider TP, tighter SL.
func DefaultParams() StrategyParams {
	return StrategyParams{
		RSIOverbought:   72,
		RSIOversold:     28,
		EMAFastPeriod:   9,
		EMASlowPeriod:   21,
		StopLossPct:     0.07,
		TakeProfitPct:   0.25,
		PositionSizePct: 0.10,
		UsePerps:        true,
	}
}

// EMASlope returns the slope of an EMA series over the last `lookback` bars,
// as a fraction of the current value. Positive = uptrend, negative = downtrend.
func EMASlope(series []float64, lookback int) float64 {
	n := len(series)
	if n < lookback+1 || series[n-1] == 0 {
		return 0
	}
	return (series[n-1] - series[n-1-lookback]) / series[n-1]
}

// Evaluate generates a trading signal from OHLCV bars.
//
// Entry conditions:
//
//	LONG:  RSI in oversold recovery zone + bullish EMA cross + price > fast EMA + slow EMA trending up
//	SHORT: RSI in overbought rollover zone + bearish EMA cross + price < fast EMA + slow EMA trending down
//
// SL/TP are ATR-blended with param floors; strength reflects distance from neutral RSI.
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

	// Trend filter: slow EMA slope over last 3 bars (as % of price)
	slowSlope := EMASlope(slowEMA, 3)

	// ── LONG signal ──────────────
	// RSI recovery zone: just crossed up from oversold (oversold to oversold+12)
	rsiOversoldCross := rsi > float64(params.RSIOversold) && rsi < float64(params.RSIOversold+12)
	bullishCross := emaCross == "bullish"
	priceAboveFast := currentPrice > signal.EMAFast
	trendUp := slowSlope >= -0.005 // allow flat or rising slow EMA

	if rsiOversoldCross && bullishCross && priceAboveFast && trendUp {
		signal.Direction = "long"
		signal.Strength = normalizeStrength(rsi, float64(params.RSIOversold), 50)

		// ATR-blended SL/TP: ATR floor prevents stops too tight on low-vol bars
		sl := currentPrice - math.Max(currentPrice*params.StopLossPct, atr*1.8)
		tp := currentPrice + math.Max(currentPrice*params.TakeProfitPct, atr*3.5)
		signal.StopLoss = sl
		signal.TakeProfit = tp
		signal.Reasoning = fmt.Sprintf("LONG: RSI(%.0f) oversold recovery, bullish EMA%d/EMA%d cross, slow EMA slope %.3f%%",
			rsi, params.EMAFastPeriod, params.EMASlowPeriod, slowSlope*100)
	}

	// ── SHORT signal ─────────────
	// RSI rollover zone: just crossed down from overbought (overbought-12 to overbought)
	rsiOverboughtCross := rsi < float64(params.RSIOverbought) && rsi > float64(params.RSIOverbought-12)
	bearishCross := emaCross == "bearish"
	priceBelowFast := currentPrice < signal.EMAFast
	trendDown := slowSlope <= 0.005 // allow flat or falling slow EMA

	if rsiOverboughtCross && bearishCross && priceBelowFast && trendDown && params.UsePerps {
		signal.Direction = "short"
		signal.Strength = normalizeStrength(100-rsi, float64(100-params.RSIOverbought), 50)

		sl := currentPrice + math.Max(currentPrice*params.StopLossPct, atr*1.8)
		tp := currentPrice - math.Max(currentPrice*params.TakeProfitPct, atr*3.5)
		signal.StopLoss = sl
		signal.TakeProfit = tp
		signal.Reasoning = fmt.Sprintf("SHORT: RSI(%.0f) overbought rollover, bearish EMA%d/EMA%d cross, slow EMA slope %.3f%%",
			rsi, params.EMAFastPeriod, params.EMASlowPeriod, slowSlope*100)
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
// Uses tiered logic: worst → best, checking most severe condition first.
func AutoOptimize(params *StrategyParams, stats TradeStats) (changed bool, reason string) {
	if stats.TradeCount < 5 {
		return false, "insufficient trades"
	}

	// Severe underperformance: widen stop and tighten entries
	if stats.WinRate < 0.35 {
		params.StopLossPct = math.Min(params.StopLossPct*1.15, 0.15)
		params.RSIOverbought = min(params.RSIOverbought-3, 72)
		params.RSIOversold = max(params.RSIOversold+3, 25)
		return true, fmt.Sprintf("severe drawdown (winRate %.0f%%): widened SL + tightened RSI", stats.WinRate*100)
	}

	// Mild underperformance: tighten RSI thresholds only
	if stats.WinRate < 0.45 {
		params.RSIOverbought = min(params.RSIOverbought-2, 72)
		params.RSIOversold = max(params.RSIOversold+2, 25)
		return true, fmt.Sprintf("underperforming (winRate %.0f%%): tightened RSI thresholds", stats.WinRate*100)
	}

	// Strong performance: scale up position size (cap at 25%)
	if stats.WinRate > 0.65 && stats.AvgPnL > 0 {
		params.PositionSizePct = math.Min(params.PositionSizePct*1.1, 0.25)
		return true, fmt.Sprintf("strong performance (winRate %.0f%%): scaled position size to %.0f%%", stats.WinRate*100, params.PositionSizePct*100)
	}

	return false, "no changes needed"
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
