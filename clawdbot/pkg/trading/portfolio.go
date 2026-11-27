package trading

import (
	"fmt"
	"strings"
)

// ── Portfolio risk guard ──────────────────────────────────────────────
// Position-level risk (AssessToken) is necessary but not sufficient: an agent
// can pass every single-token check and still blow up by holding too many
// correlated positions, over-deploying equity, or trading through a drawdown.
// PortfolioGuard is the account-level gate the OODA loop consults before every
// new entry.

// PortfolioLimits are the account-level guardrails. A zero field means "no
// limit" for that dimension, except MaxConcurrent where zero blocks all trading.
type PortfolioLimits struct {
	MaxConcurrent     int     `json:"maxConcurrent"`     // max simultaneous open positions
	MaxTotalExposure  float64 `json:"maxTotalExposure"`  // max sum of position sizes (SOL)
	MaxPerAsset       float64 `json:"maxPerAsset"`       // max exposure to a single asset (SOL)
	MaxDrawdownPct    float64 `json:"maxDrawdownPct"`    // halt new entries past this equity drawdown (fraction)
	DailyLossLimitPct float64 `json:"dailyLossLimitPct"` // halt if realized session loss exceeds this (fraction)
}

// OpenExposure is the current book the guard evaluates against.
type OpenExposure struct {
	Count              int                // number of open positions
	TotalSOL           float64            // total notional currently deployed
	PerAssetSOL        map[string]float64 // notional per asset
	PeakEquity         float64            // highest equity watermark this session (SOL)
	Equity             float64            // current equity (SOL)
	SessionPnLSOL      float64            // realized P&L since session start (SOL, negative = loss)
	SessionStartEquity float64            // equity at session start (SOL)
}

// GuardResult is the verdict for one candidate entry.
type GuardResult struct {
	Allowed bool     `json:"allowed"`
	Reasons []string `json:"reasons"`
}

// Drawdown returns the current peak-to-current equity drawdown as a positive
// fraction (0.15 = down 15% from the session high).
func (e OpenExposure) Drawdown() float64 {
	if e.PeakEquity <= 0 || e.Equity >= e.PeakEquity {
		return 0
	}
	return (e.PeakEquity - e.Equity) / e.PeakEquity
}

// SessionLoss returns realized session loss as a positive fraction of the
// session's starting equity (0 when flat or up).
func (e OpenExposure) SessionLoss() float64 {
	if e.SessionStartEquity <= 0 || e.SessionPnLSOL >= 0 {
		return 0
	}
	return -e.SessionPnLSOL / e.SessionStartEquity
}

// CheckEntry decides whether a new position of sizeSOL in asset may open given
// current exposure and limits. It is the single account-level gate; all reasons
// that would block are collected so the caller can report every violation, not
// just the first.
func (l PortfolioLimits) CheckEntry(asset string, sizeSOL float64, exposure OpenExposure) GuardResult {
	reasons := []string{}
	asset = strings.TrimSpace(asset)

	// Circuit breakers first — these halt all new entries regardless of size.
	if l.MaxDrawdownPct > 0 {
		if dd := exposure.Drawdown(); dd >= l.MaxDrawdownPct {
			reasons = append(reasons, fmt.Sprintf("drawdown circuit breaker: %.1f%% >= %.1f%% limit",
				dd*100, l.MaxDrawdownPct*100))
		}
	}
	if l.DailyLossLimitPct > 0 {
		if loss := exposure.SessionLoss(); loss >= l.DailyLossLimitPct {
			reasons = append(reasons, fmt.Sprintf("daily loss limit: %.1f%% >= %.1f%% limit",
				loss*100, l.DailyLossLimitPct*100))
		}
	}

	if sizeSOL <= 0 {
		reasons = append(reasons, "position size must be positive")
	}

	if l.MaxConcurrent <= 0 {
		reasons = append(reasons, "max concurrent positions is zero (trading halted)")
	} else if exposure.Count >= l.MaxConcurrent {
		reasons = append(reasons, fmt.Sprintf("max concurrent positions reached (%d/%d)",
			exposure.Count, l.MaxConcurrent))
	}

	if l.MaxTotalExposure > 0 && exposure.TotalSOL+sizeSOL > l.MaxTotalExposure {
		reasons = append(reasons, fmt.Sprintf("total exposure %.4f + %.4f exceeds cap %.4f SOL",
			exposure.TotalSOL, sizeSOL, l.MaxTotalExposure))
	}

	if l.MaxPerAsset > 0 && asset != "" {
		current := exposure.PerAssetSOL[asset]
		if current+sizeSOL > l.MaxPerAsset {
			reasons = append(reasons, fmt.Sprintf("%s exposure %.4f + %.4f exceeds per-asset cap %.4f SOL",
				asset, current, sizeSOL, l.MaxPerAsset))
		}
	}

	return GuardResult{Allowed: len(reasons) == 0, Reasons: reasons}
}
