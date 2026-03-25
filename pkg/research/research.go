// Package research provides the autonomous experiment loop for SolanaOS.
// Ported from the overnight research system.
//
// Flow: Read program.md → Query vault lessons → Generate hypothesis →
//       Mutate strategy → Backtest → Accept/Reject → Store results
package research

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"os"
	"strings"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/logger"
	"github.com/x402agent/Solana-Os-Go/pkg/memory"
)

// ── Strategy Parameters ──────────────────────────────────────────────

type StrategyParams struct {
	RSIOverbought        float64 `json:"rsiOverbought"`
	RSIOversold          float64 `json:"rsiOversold"`
	EMAFastPeriod        int     `json:"emaFastPeriod"`
	EMASlowPeriod        int     `json:"emaSlowPeriod"`
	MinVolume24h         float64 `json:"minVolume24h"`
	MinLiquidity         float64 `json:"minLiquidity"`
	MaxSlippage          float64 `json:"maxSlippage"`
	StopLossPct          float64 `json:"stopLossPct"`
	TakeProfitPct        float64 `json:"takeProfitPct"`
	PositionSizePct      float64 `json:"positionSizePct"`
	FundingRateThreshold float64 `json:"fundingRateThreshold"`
	UsePerps             bool    `json:"usePerps"`
}

// DefaultParams returns baseline strategy parameters.
func DefaultParams() StrategyParams {
	return StrategyParams{
		RSIOverbought:        70,
		RSIOversold:          30,
		EMAFastPeriod:        20,
		EMASlowPeriod:        50,
		MinVolume24h:         100000,
		MinLiquidity:         50000,
		MaxSlippage:          0.02,
		StopLossPct:          0.08,
		TakeProfitPct:        0.20,
		PositionSizePct:      0.10,
		FundingRateThreshold: 0.0005,
		UsePerps:             true,
	}
}

// ── Experiment ───────────────────────────────────────────────────────

type ExperimentResult struct {
	ID             string         `json:"id"`
	Hypothesis     string         `json:"hypothesis"`
	MutatedParam   string         `json:"mutated_param"`
	OldValue       interface{}    `json:"old_value"`
	NewValue       interface{}    `json:"new_value"`
	Metric         float64        `json:"metric"` // Sharpe × WinRate
	Sharpe         float64        `json:"sharpe"`
	WinRate        float64        `json:"win_rate"`
	TradeCount     int            `json:"trade_count"`
	MaxDrawdown    float64        `json:"max_drawdown"`
	Accepted       bool           `json:"accepted"`
	Reason         string         `json:"reason"`
	Params         StrategyParams `json:"params"`
	Duration       time.Duration  `json:"duration"`
	Timestamp      string         `json:"timestamp"`
}

// ── ResearchLoop ─────────────────────────────────────────────────────

type ResearchLoop struct {
	vault         *memory.ClawVault
	memEngine     *memory.MemoryEngine
	bestMetric    float64
	currentParams StrategyParams
	programPath   string
	strategyPath  string
	maxExperiments int
}

type ResearchConfig struct {
	Vault          *memory.ClawVault
	MemEngine      *memory.MemoryEngine
	ProgramPath    string
	StrategyPath   string
	MaxExperiments int
}

func NewResearchLoop(cfg ResearchConfig) *ResearchLoop {
	if cfg.MaxExperiments <= 0 {
		cfg.MaxExperiments = 50
	}
	if cfg.ProgramPath == "" {
		cfg.ProgramPath = "./program.md"
	}
	if cfg.StrategyPath == "" {
		cfg.StrategyPath = "./strategy.md"
	}
	return &ResearchLoop{
		vault:          cfg.Vault,
		memEngine:      cfg.MemEngine,
		currentParams:  DefaultParams(),
		programPath:    cfg.ProgramPath,
		strategyPath:   cfg.StrategyPath,
		maxExperiments: cfg.MaxExperiments,
	}
}

// Run executes the research loop.
func (rl *ResearchLoop) Run(ctx context.Context) ([]ExperimentResult, error) {
	logger.InfoCF("research", "Starting research loop", map[string]any{
		"max_experiments": rl.maxExperiments,
	})

	// Load current strategy
	rl.loadCurrentStrategy()

	// Load program
	program := rl.loadProgram()
	logger.InfoCF("research", "Loaded research program", map[string]any{
		"program_len": len(program),
	})

	// Query vault for accumulated lessons
	lessons := rl.vault.Recall("strategy optimization lessons patterns", memory.RecallOpts{
		Category: memory.CatLessons,
		Limit:    10,
	})
	logger.InfoCF("research", "Loaded vault lessons", map[string]any{"count": len(lessons)})

	var results []ExperimentResult

	for i := 0; i < rl.maxExperiments; i++ {
		select {
		case <-ctx.Done():
			logger.InfoCF("research", "Research loop cancelled", map[string]any{"completed": i})
			return results, nil
		default:
		}

		result := rl.runExperiment(i + 1)
		results = append(results, result)

		// Store result to vault
		rl.storeResult(result)

		if result.Accepted {
			logger.InfoCF("research", "Experiment ACCEPTED", map[string]any{
				"id":     result.ID,
				"param":  result.MutatedParam,
				"metric": result.Metric,
			})
			rl.updateStrategy(result)
		} else {
			logger.DebugCF("research", "Experiment rejected", map[string]any{
				"id":     result.ID,
				"reason": result.Reason,
			})
		}
	}

	logger.InfoCF("research", "Research loop complete", map[string]any{
		"experiments":  len(results),
		"best_metric": rl.bestMetric,
	})

	return results, nil
}

// ── Individual Experiment ────────────────────────────────────────────

func (rl *ResearchLoop) runExperiment(num int) ExperimentResult {
	t0 := time.Now()
	id := fmt.Sprintf("exp-%s-%03d", time.Now().Format("20060102"), num)

	// Mutate one parameter
	mutated := rl.currentParams
	param, oldVal, newVal := rl.mutateParam(&mutated)

	// Simulate backtest (in production: use live Birdeye OHLCV)
	sharpe, winRate, trades, drawdown := rl.simulateBacktest(mutated)

	metric := sharpe * winRate

	// Accept/reject
	accepted := false
	reason := ""

	if trades < 10 {
		reason = fmt.Sprintf("insufficient trades (%d < 10)", trades)
	} else if drawdown > 0.15 {
		reason = fmt.Sprintf("max drawdown too high (%.1f%% > 15%%)", drawdown*100)
	} else if metric > rl.bestMetric {
		accepted = true
		reason = fmt.Sprintf("metric improved: %.4f → %.4f", rl.bestMetric, metric)
		rl.bestMetric = metric
		rl.currentParams = mutated
	} else {
		reason = fmt.Sprintf("no improvement: %.4f ≤ %.4f", metric, rl.bestMetric)
	}

	return ExperimentResult{
		ID:           id,
		Hypothesis:   fmt.Sprintf("Mutating %s from %v to %v may improve Sharpe×WinRate", param, oldVal, newVal),
		MutatedParam: param,
		OldValue:     oldVal,
		NewValue:     newVal,
		Metric:       metric,
		Sharpe:       sharpe,
		WinRate:      winRate,
		TradeCount:   trades,
		MaxDrawdown:  drawdown,
		Accepted:     accepted,
		Reason:       reason,
		Params:       mutated,
		Duration:     time.Since(t0),
		Timestamp:    time.Now().Format(time.RFC3339),
	}
}

// ── Parameter Mutation ───────────────────────────────────────────────

func (rl *ResearchLoop) mutateParam(p *StrategyParams) (string, interface{}, interface{}) {
	mutations := []struct {
		name   string
		mutate func()
		old    func() interface{}
		new    func() interface{}
	}{
		{"rsiOverbought", func() { p.RSIOverbought = clamp(p.RSIOverbought+float64(rand.Intn(11)-5), 60, 85) },
			func() interface{} { return rl.currentParams.RSIOverbought }, func() interface{} { return p.RSIOverbought }},
		{"rsiOversold", func() { p.RSIOversold = clamp(p.RSIOversold+float64(rand.Intn(11)-5), 15, 40) },
			func() interface{} { return rl.currentParams.RSIOversold }, func() interface{} { return p.RSIOversold }},
		{"emaFastPeriod", func() { p.EMAFastPeriod = clampInt(p.EMAFastPeriod+rand.Intn(7)-3, 5, 30) },
			func() interface{} { return rl.currentParams.EMAFastPeriod }, func() interface{} { return p.EMAFastPeriod }},
		{"emaSlowPeriod", func() { p.EMASlowPeriod = clampInt(p.EMASlowPeriod+rand.Intn(11)-5, 30, 100) },
			func() interface{} { return rl.currentParams.EMASlowPeriod }, func() interface{} { return p.EMASlowPeriod }},
		{"stopLossPct", func() { p.StopLossPct = clamp(p.StopLossPct+float64(rand.Intn(5)-2)*0.01, 0.03, 0.15) },
			func() interface{} { return rl.currentParams.StopLossPct }, func() interface{} { return p.StopLossPct }},
		{"takeProfitPct", func() { p.TakeProfitPct = clamp(p.TakeProfitPct+float64(rand.Intn(7)-3)*0.02, 0.10, 0.50) },
			func() interface{} { return rl.currentParams.TakeProfitPct }, func() interface{} { return p.TakeProfitPct }},
		{"positionSizePct", func() { p.PositionSizePct = clamp(p.PositionSizePct+float64(rand.Intn(5)-2)*0.02, 0.05, 0.25) },
			func() interface{} { return rl.currentParams.PositionSizePct }, func() interface{} { return p.PositionSizePct }},
		{"fundingRateThreshold", func() {
			p.FundingRateThreshold = clamp(p.FundingRateThreshold+float64(rand.Intn(5)-2)*0.0001, 0.0001, 0.002)
		}, func() interface{} { return rl.currentParams.FundingRateThreshold }, func() interface{} { return p.FundingRateThreshold }},
	}

	idx := rand.Intn(len(mutations))
	m := mutations[idx]
	old := m.old()
	m.mutate()
	return m.name, old, m.new()
}

// ── Simulated Backtest ───────────────────────────────────────────────
// In production: uses live Birdeye OHLCV data via the data connectors.

func (rl *ResearchLoop) simulateBacktest(params StrategyParams) (sharpe, winRate float64, trades int, maxDrawdown float64) {
	trades = 15 + rand.Intn(30)
	wins := 0

	var returns []float64
	equity := 1.0
	peak := 1.0
	maxDD := 0.0

	for i := 0; i < trades; i++ {
		// Simulate trade outcome
		win := rand.Float64() < 0.55
		var pnl float64
		if win {
			wins++
			pnl = params.TakeProfitPct * params.PositionSizePct * (0.5 + rand.Float64())
		} else {
			pnl = -params.StopLossPct * params.PositionSizePct * (0.5 + rand.Float64())
		}
		returns = append(returns, pnl)
		equity += pnl
		if equity > peak {
			peak = equity
		}
		dd := (peak - equity) / peak
		if dd > maxDD {
			maxDD = dd
		}
	}

	winRate = float64(wins) / float64(trades)

	// Compute Sharpe ratio
	if len(returns) > 1 {
		mean := 0.0
		for _, r := range returns {
			mean += r
		}
		mean /= float64(len(returns))

		variance := 0.0
		for _, r := range returns {
			variance += (r - mean) * (r - mean)
		}
		variance /= float64(len(returns) - 1)
		std := math.Sqrt(variance)

		if std > 0 {
			sharpe = mean / std * math.Sqrt(252)
		}
	}

	return sharpe, winRate, trades, maxDD
}

// ── Storage ──────────────────────────────────────────────────────────

func (rl *ResearchLoop) storeResult(result ExperimentResult) {
	content := fmt.Sprintf(`## Experiment: %s

**Hypothesis:** %s
**Mutated:** %s (%v → %v)

### Results
| Metric | Value |
|--------|-------|
| Sharpe×WinRate | %.4f |
| Sharpe | %.4f |
| Win Rate | %.2f%% |
| Trades | %d |
| Max Drawdown | %.2f%% |

**Verdict:** %s
**Reason:** %s
**Duration:** %s
`,
		result.ID, result.Hypothesis, result.MutatedParam,
		result.OldValue, result.NewValue,
		result.Metric, result.Sharpe, result.WinRate*100, result.TradeCount,
		result.MaxDrawdown*100,
		verdictStr(result.Accepted), result.Reason, result.Duration)

	if rl.vault != nil {
		rl.vault.Remember(content, memory.RememberOpts{
			Category: memory.CatResearch,
			Title:    fmt.Sprintf("%s: %s %v→%v", result.ID, result.MutatedParam, result.OldValue, result.NewValue),
			Tags:     []string{"experiment", result.MutatedParam, verdictStr(result.Accepted)},
			Score:    scoreFn(result),
		})

		// Store lesson if accepted
		if result.Accepted && rl.vault != nil {
			rl.vault.Remember(
				fmt.Sprintf("Learned: %s=%v improves metric to %.4f (was %v)", result.MutatedParam, result.NewValue, result.Metric, result.OldValue),
				memory.RememberOpts{
					Category: memory.CatLessons,
					Title:    fmt.Sprintf("Optimization: %s", result.MutatedParam),
					Tags:     []string{"optimization", result.MutatedParam},
					Score:    0.8,
				},
			)
		}
	}
}

func (rl *ResearchLoop) updateStrategy(result ExperimentResult) {
	paramsJSON, _ := json.MarshalIndent(result.Params, "", "  ")
	content := fmt.Sprintf(`# SolanaOS Strategy

Last updated: %s
Best metric: %.4f

## Active Parameters

`+"```json\n%s\n```"+`

## Change Log
- %s: %s %v → %v (metric: %.4f)
`,
		time.Now().Format(time.RFC3339), result.Metric,
		string(paramsJSON),
		result.Timestamp, result.MutatedParam, result.OldValue, result.NewValue, result.Metric)

	if err := os.WriteFile(rl.strategyPath, []byte(content), 0644); err != nil {
		logger.WarnCF("research", "Failed to write strategy", map[string]any{"path": rl.strategyPath, "error": err})
	}
}

func (rl *ResearchLoop) loadCurrentStrategy() {
	data, err := os.ReadFile(rl.strategyPath)
	if err != nil {
		return
	}

	content := string(data)
	// Extract JSON from ```json block
	start := strings.Index(content, "```json\n")
	if start < 0 {
		return
	}
	end := strings.Index(content[start+8:], "\n```")
	if end < 0 {
		return
	}
	jsonStr := content[start+8 : start+8+end]
	json.Unmarshal([]byte(jsonStr), &rl.currentParams)
}

func (rl *ResearchLoop) loadProgram() string {
	data, err := os.ReadFile(rl.programPath)
	if err != nil {
		return ""
	}
	return string(data)
}

// ── Helpers ──────────────────────────────────────────────────────────

func clamp(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func clampInt(v, min, max int) int {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func verdictStr(accepted bool) string {
	if accepted {
		return "ACCEPTED"
	}
	return "REJECTED"
}

func scoreFn(r ExperimentResult) float64 {
	if r.Accepted {
		return 0.9
	}
	return 0.4
}
