// Package trading provides trading-specific readiness and risk primitives.
package trading

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/x402agent/SolanaOS/clawdbot/pkg/config"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/laws"
)

type RiskDecision string

const (
	DecisionAllow  RiskDecision = "allow"
	DecisionDryRun RiskDecision = "dry_run"
	DecisionBlock  RiskDecision = "block"
)

type TokenSnapshot struct {
	Address        string  `json:"address"`
	Symbol         string  `json:"symbol"`
	Price          float64 `json:"price"`
	Change24hPct   float64 `json:"change24hPct"`
	Volume24hUSD   float64 `json:"volume24hUsd"`
	LiquidityUSD   float64 `json:"liquidityUsd"`
	Top10HolderPct float64 `json:"top10HolderPct,omitempty"`
	Mutable        bool    `json:"mutable,omitempty"`
	HasMintAuth    bool    `json:"hasMintAuth,omitempty"`
	HasFreezeAuth  bool    `json:"hasFreezeAuth,omitempty"`
}

type RiskAssessment struct {
	Symbol     string       `json:"symbol"`
	Score      int          `json:"score"`
	Grade      string       `json:"grade"`
	Decision   RiskDecision `json:"decision"`
	Reasons    []string     `json:"reasons"`
	Confidence float64      `json:"confidenceMultiplier"`
}

type CockpitReport struct {
	GeneratedAt string       `json:"generatedAt"`
	Mode        string       `json:"mode"`
	Watchlist   []string     `json:"watchlist"`
	Connectors  []Connector  `json:"connectors"`
	Risk        RiskEnvelope `json:"risk"`
	Laws        []laws.Law   `json:"laws"`
	Readiness   Readiness    `json:"readiness"`
}

type Connector struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	Type   string `json:"type"`
}

type RiskEnvelope struct {
	MaxPositionSOL    float64 `json:"maxPositionSol"`
	PositionSizePct   float64 `json:"positionSizePct"`
	StopLossPct       float64 `json:"stopLossPct"`
	TakeProfitPct     float64 `json:"takeProfitPct"`
	MinSignalStrength float64 `json:"minSignalStrength"`
	MinConfidence     float64 `json:"minConfidence"`
}

type Readiness struct {
	Score   int      `json:"score"`
	Grade   string   `json:"grade"`
	Status  string   `json:"status"`
	Reasons []string `json:"reasons"`
}

func AssessToken(snapshot TokenSnapshot) RiskAssessment {
	score := 100
	reasons := []string{}

	if strings.TrimSpace(snapshot.Symbol) == "" {
		snapshot.Symbol = "UNKNOWN"
	}
	if snapshot.Price <= 0 {
		score -= 30
		reasons = append(reasons, "missing or invalid price")
	}
	if snapshot.LiquidityUSD < 25_000 {
		score -= 40
		reasons = append(reasons, "liquidity below $25k")
	} else if snapshot.LiquidityUSD < 100_000 {
		score -= 25
		reasons = append(reasons, "liquidity below $100k")
	} else if snapshot.LiquidityUSD < 250_000 {
		score -= 10
		reasons = append(reasons, "liquidity below $250k")
	}

	if snapshot.Volume24hUSD < 50_000 {
		score -= 25
		reasons = append(reasons, "24h volume below $50k")
	} else if snapshot.Volume24hUSD < 500_000 {
		score -= 12
		reasons = append(reasons, "24h volume below $500k")
	}

	if math.Abs(snapshot.Change24hPct) > 80 {
		score -= 20
		reasons = append(reasons, "24h move exceeds 80%")
	} else if math.Abs(snapshot.Change24hPct) > 40 {
		score -= 10
		reasons = append(reasons, "24h move exceeds 40%")
	}

	if snapshot.Top10HolderPct > 70 {
		score -= 25
		reasons = append(reasons, "top 10 holders exceed 70%")
	} else if snapshot.Top10HolderPct > 50 {
		score -= 12
		reasons = append(reasons, "top 10 holders exceed 50%")
	}
	if snapshot.Mutable {
		score -= 8
		reasons = append(reasons, "token metadata is mutable")
	}
	if snapshot.HasMintAuth {
		score -= 20
		reasons = append(reasons, "mint authority is active")
	}
	if snapshot.HasFreezeAuth {
		score -= 20
		reasons = append(reasons, "freeze authority is active")
	}

	if score < 0 {
		score = 0
	}
	grade := grade(score)
	decision := DecisionAllow
	if score < 45 {
		decision = DecisionBlock
	} else if score < 70 {
		decision = DecisionDryRun
	}
	if len(reasons) == 0 {
		reasons = append(reasons, "liquidity, volume, and authority checks are within configured guardrails")
	}
	return RiskAssessment{
		Symbol:     snapshot.Symbol,
		Score:      score,
		Grade:      grade,
		Decision:   decision,
		Reasons:    reasons,
		Confidence: confidenceMultiplier(score),
	}
}

func AdjustConfidence(base float64, risk RiskAssessment) float64 {
	adjusted := base * risk.Confidence
	if adjusted < 0 {
		return 0
	}
	if adjusted > 1 {
		return 1
	}
	return adjusted
}

func BuildCockpitReport(cfg *config.Config, now time.Time) CockpitReport {
	connectors := []Connector{
		{Name: "Helius RPC", Status: configured(cfg.Solana.HeliusAPIKey != "" || cfg.Solana.HeliusRPCURL != ""), Type: "rpc"},
		{Name: "Birdeye", Status: configured(cfg.Solana.BirdeyeAPIKey != ""), Type: "market_data"},
		{Name: "Jupiter", Status: configured(cfg.Solana.JupiterEndpoint != ""), Type: "spot_router"},
		{Name: "Aster", Status: configured(cfg.Solana.AsterAPIKey != ""), Type: "perps"},
		{Name: "Phoenix", Status: configured(cfg.Solana.PhoenixAPIURL != ""), Type: "perps"},
		{Name: "Vulcan", Status: configured(cfg.Vulcan.Binary != ""), Type: "perps_cli"},
		{Name: "LLM", Status: configured(len(cfg.ModelList) > 0), Type: "agent"},
	}
	readiness := computeReadiness(cfg, connectors)
	return CockpitReport{
		GeneratedAt: now.UTC().Format(time.RFC3339),
		Mode:        cfg.OODA.Mode,
		Watchlist:   append([]string(nil), cfg.OODA.Watchlist...),
		Connectors:  connectors,
		Risk: RiskEnvelope{
			MaxPositionSOL:    cfg.Solana.MaxPositionSOL,
			PositionSizePct:   cfg.OODA.PositionSizePct,
			StopLossPct:       cfg.OODA.StopLossPct,
			TakeProfitPct:     cfg.OODA.TakeProfitPct,
			MinSignalStrength: cfg.OODA.MinSignalStr,
			MinConfidence:     cfg.OODA.MinConfidence,
		},
		Laws:      append([]laws.Law(nil), laws.Six...),
		Readiness: readiness,
	}
}

func FormatCockpit(report CockpitReport) string {
	var b strings.Builder
	fmt.Fprintf(&b, "ClawdBot Trading Cockpit (%s)\n", report.GeneratedAt)
	fmt.Fprintf(&b, "mode: %s\n", report.Mode)
	fmt.Fprintf(&b, "readiness: %s (%d/100) - %s\n", report.Readiness.Grade, report.Readiness.Score, report.Readiness.Status)
	if len(report.Readiness.Reasons) > 0 {
		b.WriteString("readiness notes:\n")
		for _, reason := range report.Readiness.Reasons {
			fmt.Fprintf(&b, "- %s\n", reason)
		}
	}
	fmt.Fprintf(&b, "watchlist: %d assets\n", len(report.Watchlist))
	fmt.Fprintf(&b, "risk: max %.4f SOL, size %.1f%%, SL %.1f%%, TP %.1f%%, min signal %.2f, min confidence %.2f\n",
		report.Risk.MaxPositionSOL,
		report.Risk.PositionSizePct*100,
		report.Risk.StopLossPct*100,
		report.Risk.TakeProfitPct*100,
		report.Risk.MinSignalStrength,
		report.Risk.MinConfidence,
	)
	b.WriteString("connectors:\n")
	for _, connector := range report.Connectors {
		fmt.Fprintf(&b, "- %s: %s (%s)\n", connector.Name, connector.Status, connector.Type)
	}
	b.WriteString(laws.SummaryLine())
	return b.String()
}

func FormatRisk(assessment RiskAssessment) string {
	var b strings.Builder
	fmt.Fprintf(&b, "%s risk: %s (%d/100), decision=%s\n", assessment.Symbol, assessment.Grade, assessment.Score, assessment.Decision)
	for _, reason := range assessment.Reasons {
		fmt.Fprintf(&b, "- %s\n", reason)
	}
	return strings.TrimSpace(b.String())
}

func computeReadiness(cfg *config.Config, connectors []Connector) Readiness {
	score := 100
	reasons := []string{}
	if cfg.OODA.Mode == "live" {
		score -= 20
		reasons = append(reasons, "live mode requires external operator limits and wallet hygiene")
	}
	if cfg.Solana.BirdeyeAPIKey == "" {
		score -= 18
		reasons = append(reasons, "Birdeye API key is not configured")
	}
	if cfg.Solana.HeliusAPIKey == "" && strings.TrimSpace(cfg.Solana.HeliusRPCURL) == "" {
		score -= 18
		reasons = append(reasons, "Helius or RPC endpoint is not configured")
	}
	if len(cfg.OODA.Watchlist) == 0 {
		score -= 12
		reasons = append(reasons, "watchlist is empty")
	}
	if cfg.Solana.MaxPositionSOL <= 0 {
		score -= 20
		reasons = append(reasons, "max_position_sol must be positive")
	}
	if cfg.OODA.PositionSizePct <= 0 || cfg.OODA.PositionSizePct > 0.25 {
		score -= 12
		reasons = append(reasons, "position_size_pct should be between 0 and 25%")
	}
	if cfg.OODA.StopLossPct <= 0 || cfg.OODA.TakeProfitPct <= 0 {
		score -= 12
		reasons = append(reasons, "stop-loss and take-profit must be positive")
	}
	if cfg.OODA.StopLossPct >= cfg.OODA.TakeProfitPct {
		score -= 8
		reasons = append(reasons, "take-profit should exceed stop-loss")
	}
	if score < 0 {
		score = 0
	}
	status := "ready"
	if score < 60 {
		status = "blocked"
	} else if score < 82 {
		status = "needs_attention"
	}
	if len(reasons) == 0 {
		reasons = append(reasons, "core trading guardrails and runtime connectors are configured")
	}
	return Readiness{Score: score, Grade: grade(score), Status: status, Reasons: reasons}
}

func configured(ok bool) string {
	if ok {
		return "configured"
	}
	return "not_configured"
}

func confidenceMultiplier(score int) float64 {
	switch {
	case score >= 90:
		return 1.05
	case score >= 80:
		return 1.0
	case score >= 70:
		return 0.9
	case score >= 55:
		return 0.75
	case score >= 45:
		return 0.6
	default:
		return 0.25
	}
}

func grade(score int) string {
	switch {
	case score >= 90:
		return "A"
	case score >= 80:
		return "B"
	case score >= 70:
		return "C"
	case score >= 55:
		return "D"
	default:
		return "F"
	}
}
