// Package agent implements the ClawdBot OODA trading loop in Go.
// Ported from src/agent/TradingAgent.ts and src/agent/clawdbot.ts.
package agent

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/x402agent/SolanaOS/clawdbot/pkg/config"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/solana"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/strategy"
	"github.com/x402agent/SolanaOS/clawdbot/pkg/trading"
)

// ── OODA Agent ───────────────────────────────────────────────────────

type OODAAgent struct {
	mu    sync.RWMutex
	cfg   *config.Config
	hooks AgentHooks

	// Solana clients
	birdeye *solana.BirdeyeClient
	helius  *solana.HeliusClient
	jupiter *solana.JupiterClient
	aster   *solana.AsterClient

	// Memory
	vault *ClawVault

	// Strategy
	strategyParams strategy.StrategyParams

	// State
	running       bool
	cycleCount    int
	lastCycleAt   time.Time
	signals       []Signal
	openPositions map[string]*Position
	tradeHistory  []Trade

	stopCh chan struct{}
}

// ── Types ────────────────────────────────────────────────────────────

type Signal struct {
	Timestamp    time.Time `json:"timestamp"`
	Asset        string    `json:"asset"`
	Symbol       string    `json:"symbol"`
	Direction    string    `json:"direction"` // "long", "short", "hold"
	Strength     float64   `json:"strength"`
	Confidence   float64   `json:"confidence"`
	RSI          float64   `json:"rsi"`
	EMACross     string    `json:"emaCross"`
	ATR          float64   `json:"atr"`
	StopLoss     float64   `json:"stopLoss"`
	TakeProfit   float64   `json:"takeProfit"`
	RiskScore    int       `json:"riskScore"`
	RiskGrade    string    `json:"riskGrade"`
	RiskDecision string    `json:"riskDecision"`
	RiskReasons  []string  `json:"riskReasons,omitempty"`
	Reasoning    string    `json:"reasoning"`
	Sources      []string  `json:"sources"`
}

type Position struct {
	TradeID    string    `json:"tradeId"`
	Asset      string    `json:"asset"`
	Symbol     string    `json:"symbol"`
	Direction  string    `json:"direction"`
	EntryPrice float64   `json:"entryPrice"`
	SizeSOL    float64   `json:"sizeSOL"`
	StopLoss   float64   `json:"stopLoss"`
	TakeProfit float64   `json:"takeProfit"`
	OpenedAt   time.Time `json:"openedAt"`
	Mode       string    `json:"mode"` // "live", "simulated"
}

type Trade struct {
	ID         string    `json:"id"`
	Asset      string    `json:"asset"`
	Symbol     string    `json:"symbol"`
	Direction  string    `json:"direction"`
	EntryPrice float64   `json:"entryPrice"`
	ExitPrice  float64   `json:"exitPrice"`
	SizeSOL    float64   `json:"sizeSOL"`
	PnLPct     float64   `json:"pnlPct"`
	Outcome    string    `json:"outcome"` // "win", "loss", "open"
	Mode       string    `json:"mode"`
	OpenedAt   time.Time `json:"openedAt"`
	ClosedAt   time.Time `json:"closedAt"`
	Signature  string    `json:"signature"`
	Reason     string    `json:"reason"`
}

type Observation struct {
	Timestamp     time.Time              `json:"timestamp"`
	Slot          uint64                 `json:"slot"`
	SOLPrice      float64                `json:"solPrice"`
	WalletSOL     float64                `json:"walletSOL"`
	Trending      []solana.TrendingToken `json:"trending"`
	PerpsDigest   *solana.MarketDigest   `json:"perpsDigest"`
	WatchlistData []WatchlistEntry       `json:"watchlist"`
}

type WatchlistEntry struct {
	Address   string  `json:"address"`
	Symbol    string  `json:"symbol"`
	Price     float64 `json:"price"`
	Change24h float64 `json:"change24h"`
	Volume24h float64 `json:"volume24h"`
	Liquidity float64 `json:"liquidity"`
}

type Decision struct {
	Action     string  `json:"action"`
	Target     string  `json:"target"`
	Size       float64 `json:"size"`
	Rationale  string  `json:"rationale"`
	Confidence float64 `json:"confidence"`
	StopLoss   float64 `json:"stopLoss"`
	TakeProfit float64 `json:"takeProfit"`
}

// ── Constructor ──────────────────────────────────────────────────────

func NewOODAAgent(cfg *config.Config, hooks AgentHooks) *OODAAgent {
	if hooks == nil {
		hooks = NoopHooks{}
	}

	agent := &OODAAgent{
		cfg:           cfg,
		hooks:         hooks,
		openPositions: make(map[string]*Position),
		stopCh:        make(chan struct{}),
		strategyParams: strategy.StrategyParams{
			RSIOverbought:   cfg.Strategy.RSIOverbought,
			RSIOversold:     cfg.Strategy.RSIOversold,
			EMAFastPeriod:   cfg.Strategy.EMAFastPeriod,
			EMASlowPeriod:   cfg.Strategy.EMASlowPeriod,
			StopLossPct:     cfg.Strategy.StopLossPct,
			TakeProfitPct:   cfg.Strategy.TakeProfitPct,
			PositionSizePct: cfg.Strategy.PositionSizePct,
			UsePerps:        cfg.Strategy.UsePerps,
		},
	}

	if cfg.Solana.BirdeyeAPIKey != "" {
		agent.birdeye = solana.NewBirdeyeClient(cfg.Solana.BirdeyeAPIKey)
	}
	if cfg.Solana.HeliusAPIKey != "" {
		agent.helius = solana.NewHeliusClient(
			cfg.Solana.HeliusAPIKey,
			cfg.Solana.HeliusRPCURL,
			cfg.Solana.HeliusWSSURL,
		)
	}
	if cfg.Solana.JupiterEndpoint != "" {
		agent.jupiter = solana.NewJupiterClient(cfg.Solana.JupiterEndpoint, cfg.Solana.JupiterAPIKey)
	}
	if cfg.Solana.AsterAPIKey != "" {
		agent.aster = solana.NewAsterClient(cfg.Solana.AsterAPIKey, cfg.Solana.AsterAPISecret)
	}

	vaultPath := filepath.Join(config.DefaultWorkspacePath(), "vault")
	agent.vault = NewClawVault(vaultPath)

	return agent
}

// ── Lifecycle ────────────────────────────────────────────────────────

func (a *OODAAgent) Start() error {
	a.mu.Lock()
	if a.running {
		a.mu.Unlock()
		return fmt.Errorf("agent already running")
	}
	a.running = true
	a.mu.Unlock()

	log.Printf("[OODA] 🦞 ClawdBot starting (mode=%s interval=%ds)",
		a.cfg.OODA.Mode, a.cfg.OODA.IntervalSeconds)
	log.Printf("[OODA] Watchlist: %v", a.cfg.OODA.Watchlist)
	log.Printf("[OODA] Strategy: RSI(%d/%d) EMA(%d/%d) SL=%.0f%% TP=%.0f%%",
		a.strategyParams.RSIOversold, a.strategyParams.RSIOverbought,
		a.strategyParams.EMAFastPeriod, a.strategyParams.EMASlowPeriod,
		a.strategyParams.StopLossPct*100, a.strategyParams.TakeProfitPct*100)

	a.hooks.OnAgentStart(a.cfg.OODA.Mode, a.cfg.OODA.Watchlist)

	// Run initial cycle synchronously so caller sees results immediately
	a.runCycle()

	go func() {
		cycleTicker := time.NewTicker(time.Duration(a.cfg.OODA.IntervalSeconds) * time.Second)
		learnTicker := time.NewTicker(time.Duration(a.cfg.OODA.LearnIntervalMin) * time.Minute)
		heartbeatTicker := time.NewTicker(5 * time.Minute)
		defer cycleTicker.Stop()
		defer learnTicker.Stop()
		defer heartbeatTicker.Stop()

		for {
			select {
			case <-cycleTicker.C:
				a.runCycle()
			case <-learnTicker.C:
				a.runLearning()
			case <-heartbeatTicker.C:
				a.mu.RLock()
				cc := a.cycleCount
				np := len(a.openPositions)
				a.mu.RUnlock()
				a.hooks.OnHeartbeat(cc, np)
			case <-a.stopCh:
				log.Printf("[OODA] Agent stopped after %d cycles", a.cycleCount)
				a.hooks.OnAgentStop()
				return
			}
		}
	}()

	return nil
}

func (a *OODAAgent) Stop() {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.running {
		a.running = false
		close(a.stopCh)
	}
}

// RunTicks runs n Observe-Orient-Decide-Act cycles then stops. Used by
// `clawdbot ooda --sim` so the README one-shot prints a real tick and exits.
func (a *OODAAgent) RunTicks(n int) error {
	if n <= 0 {
		return fmt.Errorf("tick count must be positive")
	}
	a.mu.Lock()
	if a.running {
		a.mu.Unlock()
		return fmt.Errorf("agent already running")
	}
	a.running = true
	a.stopCh = make(chan struct{})
	a.mu.Unlock()

	a.hooks.OnAgentStart(a.cfg.OODA.Mode, a.cfg.OODA.Watchlist)
	for i := 0; i < n; i++ {
		a.runCycle()
	}
	a.mu.Lock()
	a.running = false
	a.mu.Unlock()
	a.hooks.OnAgentStop()
	return nil
}

func (a *OODAAgent) IsRunning() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.running
}

// TriggerCycle forces an immediate cycle outside the timer loop.
// Safe to call from hardware button handlers.
func (a *OODAAgent) TriggerCycle() {
	go a.runCycle()
}

// SetMode switches between "simulated" and "live" at runtime.
// Safe to call from hardware button handler.
func (a *OODAAgent) SetMode(mode string) {
	a.mu.Lock()
	a.cfg.OODA.Mode = mode
	a.mu.Unlock()
	log.Printf("[OODA] Mode → %s", mode)
}

// AdjustRSI nudges RSI overbought/oversold thresholds.
// delta=0 resets to config defaults.
// Called by knob hardware handler.
func (a *OODAAgent) AdjustRSI(delta int) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if delta == 0 {
		// Reset to config defaults
		a.strategyParams.RSIOverbought = a.cfg.Strategy.RSIOverbought
		a.strategyParams.RSIOversold = a.cfg.Strategy.RSIOversold
		log.Printf("[OODA] RSI reset to defaults (%d/%d)",
			a.strategyParams.RSIOversold, a.strategyParams.RSIOverbought)
		return
	}
	// Positive delta = more conservative (wider thresholds)
	a.strategyParams.RSIOverbought = clampInt(a.strategyParams.RSIOverbought+delta, 55, 90)
	a.strategyParams.RSIOversold = clampInt(a.strategyParams.RSIOversold-delta, 10, 45)
	log.Printf("[OODA] RSI adjusted → oversold=%d overbought=%d (delta=%+d)",
		a.strategyParams.RSIOversold, a.strategyParams.RSIOverbought, delta)
	a.hooks.OnParamsUpdated(fmt.Sprintf("knob: RSI=%d/%d",
		a.strategyParams.RSIOversold, a.strategyParams.RSIOverbought))
}

// AgentControls returns an AgentControls struct wired to this agent.
// Pass this to HardwareAdapter so physical inputs control the agent.
func (a *OODAAgent) AgentControls() interface{} {
	return struct {
		TriggerCycle  func()
		SetMode       func(string)
		EmergencyStop func()
		AdjustRSI     func(int)
	}{
		TriggerCycle:  a.TriggerCycle,
		SetMode:       a.SetMode,
		EmergencyStop: a.Stop,
		AdjustRSI:     a.AdjustRSI,
	}
}

// ── OODA Cycle ───────────────────────────────────────────────────────

func (a *OODAAgent) runCycle() {
	a.mu.Lock()
	a.cycleCount++
	cycle := a.cycleCount
	a.lastCycleAt = time.Now()
	solPrice := 0.0
	a.mu.Unlock()

	log.Printf("[OODA] ─── Cycle #%d ───", cycle)

	// 1. OBSERVE
	obs := a.observe()
	solPrice = obs.SOLPrice
	a.hooks.OnCycleStart(cycle, solPrice)

	// 2. ORIENT — check existing positions
	a.checkPositions(obs)

	// 3. DECIDE — evaluate watchlist for new signals
	a.mu.RLock()
	numOpen := len(a.openPositions)
	maxPos := a.cfg.OODA.MaxPositions
	a.mu.RUnlock()

	if numOpen < maxPos {
		a.evaluateWatchlist(obs)
	} else {
		log.Printf("[OODA] At max positions (%d), skipping scan", numOpen)
	}

	a.mu.RLock()
	numOpen = len(a.openPositions)
	a.mu.RUnlock()

	a.hooks.OnCycleEnd(cycle, numOpen)

	a.vault.Remember(fmt.Sprintf("## Cycle #%d | SOL=$%.2f | Slot=%d | Positions=%d",
		cycle, obs.SOLPrice, obs.Slot, numOpen),
		"decisions", 0.3)

	log.Printf("[OODA] ─── Cycle #%d complete (positions=%d) ───", cycle, numOpen)
}

func (a *OODAAgent) observe() *Observation {
	obs := &Observation{Timestamp: time.Now()}

	if a.helius != nil {
		if slot, err := a.helius.GetSlot(); err == nil {
			obs.Slot = slot
		}
	}

	if a.birdeye != nil {
		if price, err := a.birdeye.GetTokenPrice("So11111111111111111111111111111111111111112"); err == nil {
			obs.SOLPrice = price
		}
		if trending, err := a.birdeye.GetTrending(10); err == nil {
			obs.Trending = trending
		}
		for _, addr := range a.cfg.OODA.Watchlist {
			overview, err := a.birdeye.GetTokenOverview(addr)
			if err != nil {
				a.hooks.OnError("birdeye.GetTokenOverview", err)
				continue
			}
			obs.WatchlistData = append(obs.WatchlistData, WatchlistEntry{
				Address:   addr,
				Symbol:    overview.Symbol,
				Price:     overview.Price,
				Change24h: overview.PriceChange24hPct,
				Volume24h: overview.Volume24h,
				Liquidity: overview.Liquidity,
			})
		}
	}

	if a.helius != nil && a.cfg.Solana.WalletPubkey != "" {
		if bal, err := a.helius.GetBalance(a.cfg.Solana.WalletPubkey); err == nil {
			obs.WalletSOL = bal.SOL
		}
	}

	if a.aster != nil {
		if digest, err := a.aster.GetMarketDigest(); err == nil {
			obs.PerpsDigest = digest
		}
	}

	return obs
}

// ── Signal generation via ClawdBot Strategy ──────────────────────────

func (a *OODAAgent) evaluateWatchlist(obs *Observation) {
	for _, entry := range obs.WatchlistData {
		sig := a.evaluateToken(entry)
		if sig == nil {
			continue
		}

		a.mu.Lock()
		a.signals = append([]Signal{*sig}, a.signals...)
		if len(a.signals) > 200 {
			a.signals = a.signals[:200]
		}
		a.mu.Unlock()

		if sig.Direction != "hold" && sig.Direction != "neutral" &&
			sig.Strength >= a.cfg.OODA.MinSignalStr &&
			sig.Confidence >= a.cfg.OODA.MinConfidence {

			a.hooks.OnSignalDetected(sig.Symbol, sig.Direction, sig.Strength, sig.Confidence)

			if a.cfg.OODA.Mode == "live" && sig.RiskDecision != string(trading.DecisionAllow) {
				log.Printf("[OODA] Live trade skipped by risk gate: %s %s score=%d decision=%s",
					sig.Symbol, sig.Direction, sig.RiskScore, sig.RiskDecision)
				a.vault.Remember(fmt.Sprintf("RISK GATE: skipped live %s %s score=%d decision=%s reasons=%s",
					sig.Direction, sig.Symbol, sig.RiskScore, sig.RiskDecision, strings.Join(sig.RiskReasons, "; ")),
					"decisions", 0.8)
				continue
			}

			a.mu.RLock()
			_, alreadyOpen := a.openPositions[entry.Address]
			a.mu.RUnlock()

			if !alreadyOpen {
				a.openPosition(sig, entry, obs)
			}
		}
	}
}

// evaluateToken fetches OHLCV from Birdeye and runs the full strategy engine.
// Falls back to momentum-only signal if OHLCV is unavailable.
func (a *OODAAgent) evaluateToken(entry WatchlistEntry) *Signal {
	a.mu.RLock()
	params := a.strategyParams
	a.mu.RUnlock()

	base := &Signal{
		Timestamp:  time.Now(),
		Asset:      entry.Address,
		Symbol:     entry.Symbol,
		Direction:  "hold",
		Strength:   0,
		Confidence: 0.4,
		Sources:    []string{"birdeye_overview"},
	}
	risk := trading.AssessToken(trading.TokenSnapshot{
		Address:      entry.Address,
		Symbol:       entry.Symbol,
		Price:        entry.Price,
		Change24hPct: entry.Change24h,
		Volume24hUSD: entry.Volume24h,
		LiquidityUSD: entry.Liquidity,
	})
	base.RiskScore = risk.Score
	base.RiskGrade = risk.Grade
	base.RiskDecision = string(risk.Decision)
	base.RiskReasons = risk.Reasons
	if risk.Decision == trading.DecisionBlock {
		base.Reasoning = "Risk gate BLOCK: " + strings.Join(risk.Reasons, "; ")
		return base
	}

	// ── Full strategy path: requires OHLCV ──────────────────────────
	if a.birdeye != nil && entry.Volume24h >= 500_000 && entry.Liquidity >= 100_000 {
		bars, err := a.birdeye.GetOHLCV(entry.Address, "1H", 100)
		if err == nil && len(bars) >= params.EMASlowPeriod+5 {
			closes := make([]float64, len(bars))
			highs := make([]float64, len(bars))
			lows := make([]float64, len(bars))
			for i, b := range bars {
				closes[i] = b.Close
				highs[i] = b.High
				lows[i] = b.Low
			}

			sig := strategy.Evaluate(closes, highs, lows, params)

			if sig.Direction != "neutral" {
				confidence := trading.AdjustConfidence(0.7, risk)
				return &Signal{
					Timestamp:    time.Now(),
					Asset:        entry.Address,
					Symbol:       entry.Symbol,
					Direction:    sig.Direction,
					Strength:     sig.Strength,
					Confidence:   confidence,
					RSI:          sig.RSI,
					EMACross:     sig.EMACross,
					ATR:          sig.ATR,
					StopLoss:     sig.StopLoss,
					TakeProfit:   sig.TakeProfit,
					RiskScore:    risk.Score,
					RiskGrade:    risk.Grade,
					RiskDecision: string(risk.Decision),
					RiskReasons:  risk.Reasons,
					Reasoning:    fmt.Sprintf("%s | risk=%s/%d decision=%s", sig.Reasoning, risk.Grade, risk.Score, risk.Decision),
					Sources:      []string{"birdeye_ohlcv", "clawdbot_strategy"},
				}
			}

			// Strategy returned neutral — still populate indicators on base
			base.RSI = sig.RSI
			base.EMACross = sig.EMACross
			base.ATR = sig.ATR
			base.Sources = append(base.Sources, "clawdbot_strategy")
			return base
		}
	}

	// ── Fallback: momentum-only signal ──────────────────────────────
	// Used when OHLCV unavailable or token too low volume.
	if entry.Change24h > 8 && entry.Volume24h > 2_000_000 && entry.Liquidity > 200_000 {
		base.Direction = "long"
		base.Strength = clampFloat(entry.Change24h/30.0, 0, 1)
		base.Confidence = trading.AdjustConfidence(0.55, risk)
		base.Reasoning = fmt.Sprintf("Momentum LONG: %s +%.1f%% vol=$%.0fM",
			entry.Symbol, entry.Change24h, entry.Volume24h/1e6)
	} else if entry.Change24h < -10 && params.UsePerps {
		base.Direction = "short"
		base.Strength = clampFloat(-entry.Change24h/30.0, 0, 1)
		base.Confidence = trading.AdjustConfidence(0.45, risk)
		base.Reasoning = fmt.Sprintf("Momentum SHORT: %s %.1f%% (low vol guard)",
			entry.Symbol, entry.Change24h)
	}

	return base
}

// ── Position management ──────────────────────────────────────────────

func (a *OODAAgent) openPosition(sig *Signal, entry WatchlistEntry, obs *Observation) {
	tradeID := fmt.Sprintf("trade-%d-%s", time.Now().UnixMilli(), sig.Symbol)

	// Use signal's SL/TP if available (from strategy engine), else compute.
	sl := sig.StopLoss
	tp := sig.TakeProfit
	if sl == 0 {
		if sig.Direction == "long" {
			sl = entry.Price * (1 - a.cfg.OODA.StopLossPct)
			tp = entry.Price * (1 + a.cfg.OODA.TakeProfitPct)
		} else {
			sl = entry.Price * (1 + a.cfg.OODA.StopLossPct)
			tp = entry.Price * (1 - a.cfg.OODA.TakeProfitPct)
		}
	}

	// Risk-based sizing: when RiskPerTradePct is set and a stop is known, size the
	// position so a stop-out loses that fraction of equity (volatility-aware).
	// Falls back to fixed-fraction sizing when sizing inputs are unusable.
	sizeSOL := 0.0
	if a.cfg.OODA.RiskPerTradePct > 0 {
		sizeSOL = strategy.RiskAdjustedSize(strategy.SizingInput{
			EquitySOL:       obs.WalletSOL,
			RiskPerTradePct: a.cfg.OODA.RiskPerTradePct,
			EntryPrice:      entry.Price,
			StopLossPrice:   sl,
			Confidence:      sig.Confidence,
			MaxPositionSOL:  a.cfg.Solana.MaxPositionSOL,
			MaxPositionPct:  a.cfg.OODA.PositionSizePct,
		})
	}
	if sizeSOL <= 0 {
		sizeSOL = obs.WalletSOL * a.cfg.OODA.PositionSizePct
		if a.cfg.Solana.MaxPositionSOL > 0 && sizeSOL > a.cfg.Solana.MaxPositionSOL {
			sizeSOL = a.cfg.Solana.MaxPositionSOL
		}
	}
	if sizeSOL < 0.001 {
		sizeSOL = 0.01 // minimum sim size
	}

	pos := &Position{
		TradeID:    tradeID,
		Asset:      sig.Asset,
		Symbol:     sig.Symbol,
		Direction:  sig.Direction,
		EntryPrice: entry.Price,
		SizeSOL:    sizeSOL,
		StopLoss:   sl,
		TakeProfit: tp,
		OpenedAt:   time.Now(),
		Mode:       a.cfg.OODA.Mode,
	}

	a.mu.Lock()
	a.openPositions[sig.Asset] = pos
	a.tradeHistory = append(a.tradeHistory, Trade{
		ID:         tradeID,
		Asset:      sig.Asset,
		Symbol:     sig.Symbol,
		Direction:  sig.Direction,
		EntryPrice: entry.Price,
		SizeSOL:    sizeSOL,
		Outcome:    "open",
		Mode:       pos.Mode,
		OpenedAt:   pos.OpenedAt,
	})
	a.mu.Unlock()

	a.hooks.OnTradeOpen(sig.Symbol, sig.Direction, entry.Price, sizeSOL)

	log.Printf("[OODA] 📈 %s %s at $%.6f (%.4f SOL, SL=%.6f, TP=%.6f) [%s]",
		sig.Direction, sig.Symbol, entry.Price, sizeSOL, sl, tp, pos.Mode)

	a.vault.Remember(fmt.Sprintf("TRADE OPENED: %s %s at $%.6f — %s (conf: %.2f, str: %.2f)",
		sig.Direction, sig.Symbol, entry.Price, sig.Reasoning, sig.Confidence, sig.Strength),
		"trades", sig.Confidence)
}

func (a *OODAAgent) checkPositions(obs *Observation) {
	a.mu.Lock()
	defer a.mu.Unlock()

	priceMap := make(map[string]float64)
	for _, e := range obs.WatchlistData {
		priceMap[e.Address] = e.Price
	}

	for asset, pos := range a.openPositions {
		currentPrice := priceMap[asset]
		if currentPrice == 0 {
			continue
		}

		var pnlPct float64
		if pos.Direction == "long" {
			pnlPct = ((currentPrice - pos.EntryPrice) / pos.EntryPrice) * 100
		} else {
			pnlPct = ((pos.EntryPrice - currentPrice) / pos.EntryPrice) * 100
		}

		hitTP := (pos.Direction == "long" && currentPrice >= pos.TakeProfit) ||
			(pos.Direction == "short" && currentPrice <= pos.TakeProfit)
		hitSL := (pos.Direction == "long" && currentPrice <= pos.StopLoss) ||
			(pos.Direction == "short" && currentPrice >= pos.StopLoss)
		timedOut := time.Since(pos.OpenedAt) > 6*time.Hour

		var reason string
		if hitTP {
			reason = "take_profit"
		} else if hitSL {
			reason = "stop_loss"
		} else if timedOut {
			reason = "timeout"
		} else {
			continue
		}

		outcome := "loss"
		if pnlPct > 0 {
			outcome = "win"
		}

		log.Printf("[OODA] 📉 %s %s PnL=%.2f%% reason=%s [%s]",
			pos.Direction, pos.Symbol, pnlPct, reason, outcome)

		for i := range a.tradeHistory {
			if a.tradeHistory[i].ID == pos.TradeID {
				a.tradeHistory[i].ExitPrice = currentPrice
				a.tradeHistory[i].PnLPct = pnlPct
				a.tradeHistory[i].Outcome = outcome
				a.tradeHistory[i].ClosedAt = time.Now()
				a.tradeHistory[i].Reason = reason
				break
			}
		}

		a.vault.Remember(fmt.Sprintf("TRADE CLOSED: %s %s PnL=%.2f%% (%s) reason=%s",
			pos.Direction, pos.Symbol, pnlPct, outcome, reason),
			"lessons", 0.8)

		// Fire hook (must not hold lock during hook call — use goroutine)
		sym := pos.Symbol
		dir := pos.Direction
		go a.hooks.OnTradeClose(sym, dir, pnlPct, outcome, reason)

		delete(a.openPositions, asset)
	}
}

// ── Learning cycle ───────────────────────────────────────────────────

func (a *OODAAgent) runLearning() {
	log.Printf("[OODA] 🧠 Learning cycle...")

	a.mu.RLock()
	var closed, wins int
	var totalPnL float64
	for _, t := range a.tradeHistory {
		if t.Outcome == "win" || t.Outcome == "loss" {
			closed++
			totalPnL += t.PnLPct
			if t.Outcome == "win" {
				wins++
			}
		}
	}
	a.mu.RUnlock()

	if closed < 5 {
		log.Printf("[OODA] Not enough trades for learning (%d < 5)", closed)
		return
	}

	winRate := float64(wins) / float64(closed)
	avgPnL := totalPnL / float64(closed)

	log.Printf("[OODA] 📊 wr=%.1f%% pnl=%.2f%% trades=%d", winRate*100, avgPnL, closed)
	a.hooks.OnLearningCycle(winRate, avgPnL, closed)

	// Auto-optimize strategy params (hill climbing)
	if a.cfg.OODA.AutoOptimize {
		a.mu.Lock()
		stats := strategy.TradeStats{WinRate: winRate, AvgPnL: avgPnL, TradeCount: closed}
		changed, reason := strategy.AutoOptimize(&a.strategyParams, stats)
		a.mu.Unlock()

		if changed {
			log.Printf("[OODA] ⚡ AutoOptimize: %s", reason)
			a.hooks.OnParamsUpdated(reason)
			a.vault.Remember(fmt.Sprintf("STRATEGY UPDATE: %s (wr=%.1f%% pnl=%.2f%%)",
				reason, winRate*100, avgPnL), "lessons", 0.9)
		}
	}

	a.vault.Remember(fmt.Sprintf("LEARNING: wr=%.1f%% avgPnL=%.2f%% trades=%d",
		winRate*100, avgPnL, closed), "lessons", 0.85)
}

// ── Public getters ───────────────────────────────────────────────────

func (a *OODAAgent) GetCycleCount() int {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.cycleCount
}

func (a *OODAAgent) GetSignals(limit int) []Signal {
	a.mu.RLock()
	defer a.mu.RUnlock()
	n := limit
	if n > len(a.signals) {
		n = len(a.signals)
	}
	out := make([]Signal, n)
	copy(out, a.signals[:n])
	return out
}

func (a *OODAAgent) GetOpenPositions() []Position {
	a.mu.RLock()
	defer a.mu.RUnlock()
	out := make([]Position, 0, len(a.openPositions))
	for _, p := range a.openPositions {
		out = append(out, *p)
	}
	return out
}

func (a *OODAAgent) GetTradeHistory() []Trade {
	a.mu.RLock()
	defer a.mu.RUnlock()
	out := make([]Trade, len(a.tradeHistory))
	copy(out, a.tradeHistory)
	return out
}

func (a *OODAAgent) GetStrategyParams() strategy.StrategyParams {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.strategyParams
}

func (a *OODAAgent) GetStats() map[string]interface{} {
	a.mu.RLock()
	defer a.mu.RUnlock()
	var wins, closed int
	var totalPnL float64
	for _, t := range a.tradeHistory {
		if t.Outcome == "win" || t.Outcome == "loss" {
			closed++
			totalPnL += t.PnLPct
			if t.Outcome == "win" {
				wins++
			}
		}
	}
	winRate := 0.0
	if closed > 0 {
		winRate = float64(wins) / float64(closed)
	}
	return map[string]interface{}{
		"cycles":        a.cycleCount,
		"open":          len(a.openPositions),
		"closed_trades": closed,
		"win_rate":      math.Round(winRate*1000) / 10,
		"avg_pnl_pct":   math.Round(totalPnL/math.Max(float64(closed), 1)*100) / 100,
		"mode":          a.cfg.OODA.Mode,
		"last_cycle":    a.lastCycleAt,
	}
}

// ── ClawVault ────────────────────────────────────────────────────────

type ClawVault struct {
	basePath string
	mu       sync.Mutex
}

type VaultEntry struct {
	ID        string    `json:"id"`
	Category  string    `json:"category"`
	Content   string    `json:"content"`
	Score     float64   `json:"score"`
	CreatedAt time.Time `json:"createdAt"`
	Tags      []string  `json:"tags"`
}

func NewClawVault(basePath string) *ClawVault {
	return &ClawVault{basePath: basePath}
}

func (v *ClawVault) Remember(content, category string, score float64) {
	v.mu.Lock()
	defer v.mu.Unlock()
	if category == "" {
		category = "inbox"
	}
	dir := filepath.Join(v.basePath, category)
	os.MkdirAll(dir, 0o755)
	entry := VaultEntry{
		ID:        fmt.Sprintf("%d", time.Now().UnixNano()),
		Category:  category,
		Content:   content,
		Score:     score,
		CreatedAt: time.Now(),
	}
	data, _ := json.Marshal(entry)
	fname := fmt.Sprintf("%s_%s.json",
		time.Now().Format("20060102_150405"),
		strings.ReplaceAll(category, "/", "_"))
	os.WriteFile(filepath.Join(dir, fname), data, 0o644)
}

func (v *ClawVault) Recall(query string) []VaultEntry {
	v.mu.Lock()
	defer v.mu.Unlock()
	var results []VaultEntry
	for _, cat := range []string{"decisions", "lessons", "trades", "research", "inbox"} {
		dir := filepath.Join(v.basePath, cat)
		entries, _ := os.ReadDir(dir)
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			data, err := os.ReadFile(filepath.Join(dir, e.Name()))
			if err != nil {
				continue
			}
			var entry VaultEntry
			if json.Unmarshal(data, &entry) != nil {
				continue
			}
			if query == "" || strings.Contains(strings.ToLower(entry.Content), strings.ToLower(query)) {
				results = append(results, entry)
			}
		}
	}
	return results
}

// ── Helpers ──────────────────────────────────────────────────────────

func clampFloat(v, min, max float64) float64 {
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
