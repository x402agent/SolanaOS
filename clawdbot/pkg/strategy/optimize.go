package strategy

import "math"

// ── Walk-forward parameter optimization ───────────────────────────────
// A trading agent is only as good as its ability to validate a strategy before
// risking capital. Optimize searches a bounded grid of StrategyParams, scores
// each on the backtest via a risk-adjusted objective, and reports both the
// in-sample and out-of-sample score of the winner — so overfitting is visible
// rather than hidden. This is what lets the agent improve itself honestly:
// params that only look good in-sample are exposed by a weak out-of-sample score.

// Objective maps a backtest result to a scalar to maximize. Higher is better.
type Objective func(BacktestResult) float64

// CalmarScore rewards return per unit of drawdown and requires a minimum number
// of trades, so a degenerate "never trades, never loses" configuration cannot
// win. It is the default objective for Optimize.
func CalmarScore(r BacktestResult) float64 {
	if r.Trades < 3 {
		return -1e9
	}
	dd := r.MaxDrawdown
	if dd < 0.01 {
		dd = 0.01 // floor so a fluke low-drawdown run can't dominate
	}
	return r.TotalReturn / dd
}

// ParamGrid is the discrete search space. Empty axes fall back to sensible
// defaults so callers can vary only the dimensions they care about.
type ParamGrid struct {
	EMAFast       []int
	EMASlow       []int
	StopLossPct   []float64
	TakeProfitPct []float64
	RSIOverbought []int
	RSIOversold   []int
}

// DefaultGrid is a small, fast search space (a few dozen combinations) suitable
// for the web endpoint and periodic self-tuning.
func DefaultGrid() ParamGrid {
	return ParamGrid{
		EMAFast:       []int{8, 12, 20},
		EMASlow:       []int{30, 50},
		StopLossPct:   []float64{0.04, 0.08},
		TakeProfitPct: []float64{0.12, 0.20},
		RSIOverbought: []int{70},
		RSIOversold:   []int{30},
	}
}

// OptimizeResult reports the winning params and the evidence behind them.
type OptimizeResult struct {
	Best           StrategyParams `json:"best"`
	InSampleScore  float64        `json:"inSampleScore"`
	OutSampleScore float64        `json:"outSampleScore"`
	InSample       BacktestResult `json:"inSample"`
	OutSample      BacktestResult `json:"outSample"`
	Evaluated      int            `json:"evaluated"`
	SplitIndex     int            `json:"splitIndex"`
	// Overfit is InSampleScore - OutSampleScore; large positive values warn that
	// the winner does not generalize.
	Overfit float64 `json:"overfit"`
}

// Optimize runs a walk-forward search: it optimizes params on the first
// splitPct of bars (in-sample) and reports how the winner performs on the held-
// out remainder (out-of-sample). base supplies defaults for any dimension the
// grid leaves empty and for fields not searched (e.g. PositionSizePct, UsePerps).
func Optimize(bars []Bar, base StrategyParams, grid ParamGrid, obj Objective, splitPct float64) OptimizeResult {
	if obj == nil {
		obj = CalmarScore
	}
	if splitPct <= 0 || splitPct >= 1 {
		splitPct = 0.7
	}
	res := OptimizeResult{Best: base, InSampleScore: math.Inf(-1)}
	if len(bars) < 80 {
		return res // not enough data to split meaningfully
	}
	split := int(float64(len(bars)) * splitPct)
	res.SplitIndex = split
	inBars := bars[:split]
	outBars := bars[split:]

	combos := expandGrid(base, grid)
	res.Evaluated = len(combos)
	window := base.EMASlowPeriod + 5

	found := false
	for _, p := range combos {
		w := p.EMASlowPeriod + 5
		if w > window {
			window = w
		}
		in := Backtest(inBars, p, p.EMASlowPeriod+5)
		score := obj(in)
		if score > res.InSampleScore {
			res.InSampleScore = score
			res.Best = p
			res.InSample = in
			found = true
		}
	}
	if !found {
		res.InSampleScore = 0
		return res
	}

	// Validate the winner on the held-out tail.
	res.OutSample = Backtest(outBars, res.Best, res.Best.EMASlowPeriod+5)
	res.OutSampleScore = obj(res.OutSample)
	res.Overfit = res.InSampleScore - res.OutSampleScore
	return res
}

// expandGrid enumerates all valid parameter combinations, filling empty axes
// from base and skipping combinations where the fast EMA is not shorter than the
// slow EMA.
func expandGrid(base StrategyParams, grid ParamGrid) []StrategyParams {
	fast := grid.EMAFast
	if len(fast) == 0 {
		fast = []int{base.EMAFastPeriod}
	}
	slow := grid.EMASlow
	if len(slow) == 0 {
		slow = []int{base.EMASlowPeriod}
	}
	sl := grid.StopLossPct
	if len(sl) == 0 {
		sl = []float64{base.StopLossPct}
	}
	tp := grid.TakeProfitPct
	if len(tp) == 0 {
		tp = []float64{base.TakeProfitPct}
	}
	ob := grid.RSIOverbought
	if len(ob) == 0 {
		ob = []int{base.RSIOverbought}
	}
	os := grid.RSIOversold
	if len(os) == 0 {
		os = []int{base.RSIOversold}
	}

	var out []StrategyParams
	for _, f := range fast {
		for _, s := range slow {
			if f >= s {
				continue // fast must be strictly shorter than slow
			}
			for _, stop := range sl {
				for _, take := range tp {
					for _, o := range ob {
						for _, u := range os {
							if u >= o {
								continue // oversold must be below overbought
							}
							p := base
							p.EMAFastPeriod = f
							p.EMASlowPeriod = s
							p.StopLossPct = stop
							p.TakeProfitPct = take
							p.RSIOverbought = o
							p.RSIOversold = u
							out = append(out, p)
						}
					}
				}
			}
		}
	}
	return out
}
