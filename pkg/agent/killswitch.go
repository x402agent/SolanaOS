// Package agent — killswitch.go implements the agent death protocol.
// When the wallet is critically depleted, the agent shuts down gracefully
// instead of attempting hopeless recovery trades.
//
// See strategy.md "Kill Switch — Agent Death Protocol" for the full spec.
package agent

import (
	"fmt"
	"time"
)

// KillSwitchConfig holds the thresholds that trigger agent death.
type KillSwitchConfig struct {
	// CriticalSOL: below this, close all positions and halt OODA.
	CriticalSOL float64 // default 0.01

	// DeadSOL: below this, stop the daemon entirely.
	DeadSOL float64 // default 0.005

	// DeathSpiralPct: if portfolio drops below this % of initial funding, emergency liquidate.
	DeathSpiralPct float64 // default 0.05 (5%)

	// InitialFundingSOL: the starting balance, used to calculate death spiral.
	InitialFundingSOL float64

	// MaxConsecutiveLosses: pause after this many losses in a row.
	MaxConsecutiveLosses int // default 10

	// TiltPauseDuration: how long to pause on tilt.
	TiltPauseDuration time.Duration // default 1 hour

	// MaxDailyDrawdownPct: circuit breaker threshold.
	MaxDailyDrawdownPct float64 // default 0.15 (15%)

	// ResurrectionSOL: minimum balance to allow resuming live trading.
	ResurrectionSOL float64 // default 0.05
}

// DefaultKillSwitchConfig returns sensible defaults.
func DefaultKillSwitchConfig() KillSwitchConfig {
	return KillSwitchConfig{
		CriticalSOL:         0.01,
		DeadSOL:             0.005,
		DeathSpiralPct:      0.05,
		InitialFundingSOL:   1.0,
		MaxConsecutiveLosses: 10,
		TiltPauseDuration:   1 * time.Hour,
		MaxDailyDrawdownPct: 0.15,
		ResurrectionSOL:     0.05,
	}
}

// KillSwitchState tracks the agent's vital signs.
type KillSwitchState struct {
	ConsecutiveLosses int
	DailyHighSOL      float64
	DailyLowSOL       float64
	DayStartedAt      time.Time
	IsHalted          bool
	HaltReason        string
	HaltedAt          time.Time
	IsDead            bool
	DeathReason       string
	DiedAt            time.Time
	TiltPausedUntil   time.Time
}

// KillSwitchVerdict is the result of checking the kill switch.
type KillSwitchVerdict string

const (
	VerdictOK            KillSwitchVerdict = "ok"
	VerdictTiltPause     KillSwitchVerdict = "tilt_pause"
	VerdictCircuitBreaker KillSwitchVerdict = "circuit_breaker"
	VerdictCritical      KillSwitchVerdict = "critical"
	VerdictDead          KillSwitchVerdict = "dead"
	VerdictDeathSpiral   KillSwitchVerdict = "death_spiral"
)

// CheckKillSwitch evaluates whether the agent should continue trading.
// Returns the verdict and a human-readable reason.
func CheckKillSwitch(cfg KillSwitchConfig, state *KillSwitchState, currentSOL float64) (KillSwitchVerdict, string) {
	now := time.Now()

	// Already dead — stay dead
	if state.IsDead {
		if currentSOL >= cfg.ResurrectionSOL {
			return VerdictOK, fmt.Sprintf("Resurrection possible: %.4f SOL > %.4f threshold", currentSOL, cfg.ResurrectionSOL)
		}
		return VerdictDead, fmt.Sprintf("Agent is dead since %s: %s", state.DiedAt.Format("15:04"), state.DeathReason)
	}

	// Already halted — check if still halted
	if state.IsHalted {
		return VerdictCircuitBreaker, fmt.Sprintf("Halted since %s: %s", state.HaltedAt.Format("15:04"), state.HaltReason)
	}

	// Tilt pause
	if now.Before(state.TiltPausedUntil) {
		remaining := state.TiltPausedUntil.Sub(now).Round(time.Minute)
		return VerdictTiltPause, fmt.Sprintf("Tilt pause: %d consecutive losses. Resumes in %s", state.ConsecutiveLosses, remaining)
	}

	// DEAD: wallet completely drained
	if currentSOL < cfg.DeadSOL {
		state.IsDead = true
		state.DeathReason = fmt.Sprintf("Wallet depleted: %.6f SOL < %.4f dead threshold", currentSOL, cfg.DeadSOL)
		state.DiedAt = now
		return VerdictDead, state.DeathReason
	}

	// CRITICAL: wallet nearly empty
	if currentSOL < cfg.CriticalSOL {
		state.IsHalted = true
		state.HaltReason = fmt.Sprintf("Critical balance: %.6f SOL < %.4f", currentSOL, cfg.CriticalSOL)
		state.HaltedAt = now
		return VerdictCritical, state.HaltReason
	}

	// DEATH SPIRAL: portfolio collapsed relative to initial funding
	if cfg.InitialFundingSOL > 0 && currentSOL < cfg.InitialFundingSOL*cfg.DeathSpiralPct {
		state.IsDead = true
		state.DeathReason = fmt.Sprintf("Death spiral: %.4f SOL is %.1f%% of initial %.4f SOL",
			currentSOL, (currentSOL/cfg.InitialFundingSOL)*100, cfg.InitialFundingSOL)
		state.DiedAt = now
		return VerdictDeathSpiral, state.DeathReason
	}

	// TILT: too many consecutive losses
	if state.ConsecutiveLosses >= cfg.MaxConsecutiveLosses {
		state.TiltPausedUntil = now.Add(cfg.TiltPauseDuration)
		return VerdictTiltPause, fmt.Sprintf("%d consecutive losses — pausing for %s", state.ConsecutiveLosses, cfg.TiltPauseDuration)
	}

	// CIRCUIT BREAKER: daily drawdown exceeded
	if state.DayStartedAt.Day() != now.Day() {
		// New day — reset daily tracking
		state.DailyHighSOL = currentSOL
		state.DailyLowSOL = currentSOL
		state.DayStartedAt = now
	}
	if currentSOL > state.DailyHighSOL {
		state.DailyHighSOL = currentSOL
	}
	if currentSOL < state.DailyLowSOL {
		state.DailyLowSOL = currentSOL
	}
	if state.DailyHighSOL > 0 {
		dailyDrawdown := (state.DailyHighSOL - currentSOL) / state.DailyHighSOL
		if dailyDrawdown > cfg.MaxDailyDrawdownPct {
			state.IsHalted = true
			state.HaltReason = fmt.Sprintf("Circuit breaker: %.1f%% daily drawdown > %.1f%% limit",
				dailyDrawdown*100, cfg.MaxDailyDrawdownPct*100)
			state.HaltedAt = now
			return VerdictCircuitBreaker, state.HaltReason
		}
	}

	return VerdictOK, "All systems nominal"
}

// RecordTradeOutcome updates the kill switch state after a trade.
func RecordTradeOutcome(state *KillSwitchState, profitable bool) {
	if profitable {
		state.ConsecutiveLosses = 0
	} else {
		state.ConsecutiveLosses++
	}
}

// Resurrect resets the death state if the wallet has been refunded.
func Resurrect(state *KillSwitchState) {
	state.IsDead = false
	state.IsHalted = false
	state.DeathReason = ""
	state.HaltReason = ""
	state.ConsecutiveLosses = 0
	state.TiltPausedUntil = time.Time{}
}
