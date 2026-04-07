// Package agent implements the SolanaOS OODA trading loop in Go.
// Ported from the original TypeScript trading agent implementation.
package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/x402agent/Solana-Os-Go/pkg/config"
	"github.com/x402agent/Solana-Os-Go/pkg/onchain"
	"github.com/x402agent/Solana-Os-Go/pkg/solana"
	"github.com/x402agent/Solana-Os-Go/pkg/strategy"
)

// ── OODA Agent ───────────────────────────────────────────────────────

type OODAAgent struct {
	mu    sync.RWMutex
	cfg   *config.Config
	hooks AgentHooks

	// Solana clients
	tracker   *solana.SolanaTrackerClient
	helius    *solana.HeliusClient
	jupiter   *solana.JupiterClient
	aster     *solana.AsterClient
	solanaRPC *solana.SolanaRPC // native solana-go RPC
	wallet    *solana.Wallet    // agentic wallet (auto-generated)

	// On-chain engine (Helius RPC/WSS + Jupiter swaps)
	onchain *onchain.Engine

	// Memory
	vault *ClawVault

	// Strategy
	strategyParams strategy.StrategyParams

	// State
	running       bool
	cycleInFlight bool
	cycleCount    int
	lastCycleAt   time.Time
	lastBlockers  string
	signals       []Signal
	openPositions map[string]*Position
	tradeHistory  []Trade

	stopCh chan struct{}
}

// ── Types ────────────────────────────────────────────────────────────

type Signal struct {
	Timestamp   time.Time `json:"timestamp"`
	Asset       string    `json:"asset"`
	Symbol      string    `json:"symbol"`
	MarketPrice float64   `json:"marketPrice,omitempty"`
	Direction   string    `json:"direction"` // "long", "short", "hold"
	Strength    float64   `json:"strength"`
	Confidence  float64   `json:"confidence"`
	RSI         float64   `json:"rsi"`
	EMACross    string    `json:"emaCross"`
	ATR         float64   `json:"atr"`
	StopLoss    float64   `json:"stopLoss"`
	TakeProfit  float64   `json:"takeProfit"`
	Reasoning   string    `json:"reasoning"`
	Sources     []string  `json:"sources"`
}

type Position struct {
	TradeID        string    `json:"tradeId"`
	Asset          string    `json:"asset"`
	Symbol         string    `json:"symbol"`
	Direction      string    `json:"direction"`
	EntryPrice     float64   `json:"entryPrice"`
	SizeSOL        float64   `json:"sizeSOL"`
	StopLoss       float64   `json:"stopLoss"`
	TakeProfit     float64   `json:"takeProfit"`
	OpenedAt       time.Time `json:"openedAt"`
	Mode           string    `json:"mode"` // "live", "simulated"
	EntrySignature string    `json:"entrySignature,omitempty"`
	TokenAmountRaw uint64    `json:"tokenAmountRaw,omitempty"`
}

type Trade struct {
	ID             string    `json:"id"`
	Asset          string    `json:"asset"`
	Symbol         string    `json:"symbol"`
	Direction      string    `json:"direction"`
	EntryPrice     float64   `json:"entryPrice"`
	ExitPrice      float64   `json:"exitPrice"`
	SizeSOL        float64   `json:"sizeSOL"`
	PnLPct         float64   `json:"pnlPct"`
	Outcome        string    `json:"outcome"` // "win", "loss", "open"
	Mode           string    `json:"mode"`
	OpenedAt       time.Time `json:"openedAt"`
	ClosedAt       time.Time `json:"closedAt"`
	Signature      string    `json:"signature"`
	OpenSignature  string    `json:"openSignature,omitempty"`
	CloseSignature string    `json:"closeSignature,omitempty"`
	Reason         string    `json:"reason"`
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

	trackerDataKey := cfg.Solana.SolanaTrackerDataAPIKey
	if trackerDataKey == "" {
		trackerDataKey = cfg.Solana.SolanaTrackerAPIKey
	}
	if trackerDataKey != "" {
		agent.tracker = solana.NewSolanaTrackerClient(trackerDataKey)
	}
	rpcAPIKey := cfg.Solana.HeliusAPIKey
	if rpcAPIKey == "" {
		rpcAPIKey = cfg.Solana.SolanaTrackerAPIKey
	}
	rpcURL := cfg.Solana.HeliusRPCURL
	if rpcURL == "" {
		rpcURL = cfg.Solana.SolanaTrackerRPCURL
	}
	wssURL := cfg.Solana.HeliusWSSURL
	if wssURL == "" {
		wssURL = cfg.Solana.SolanaTrackerWSSURL
	}
	if rpcURL != "" {
		agent.helius = solana.NewHeliusClient(
			rpcAPIKey,
			rpcURL,
			wssURL,
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

	// Initialize on-chain engine (preferred RPC + Jupiter)
	oCfg := onchain.Config{
		HeliusRPCURL:            cfg.Solana.HeliusRPCURL,
		HeliusAPIKey:            cfg.Solana.HeliusAPIKey,
		HeliusWSSURL:            cfg.Solana.HeliusWSSURL,
		SolanaTrackerRPCURL:     cfg.Solana.SolanaTrackerRPCURL,
		SolanaTrackerAPIKey:     cfg.Solana.SolanaTrackerAPIKey,
		SolanaTrackerDataAPIKey: cfg.Solana.SolanaTrackerDataAPIKey,
		SolanaTrackerWSSURL:     cfg.Solana.SolanaTrackerWSSURL,
	}
	if engine, err := onchain.NewEngine(oCfg); err == nil {
		agent.onchain = engine
		log.Printf("[OODA] ⛓️  On-chain engine connected (preferred RPC + Jupiter)")
	} else {
		log.Printf("[OODA] ⚠️  On-chain engine unavailable: %v", err)
	}

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

	// ── Agentic Wallet: auto-generate on first boot ──────────────────
	wallet, err := solana.EnsureAgentWallet(a.cfg.Solana.WalletKeyPath)
	if err != nil {
		log.Printf("[OODA] ⚠️  Wallet error (read-only mode): %v", err)
	} else if wallet != nil {
		a.wallet = wallet
		log.Printf("[OODA] 🔑 Agent wallet: %s", wallet.PublicKeyStr())

		// Update config pubkey if not set
		if a.cfg.Solana.WalletPubkey == "" {
			a.cfg.Solana.WalletPubkey = wallet.PublicKeyStr()
		}

		// Create native Solana RPC client with wallet
		rpcURL := a.cfg.Solana.HeliusRPCURL
		if rpcURL == "" {
			rpcURL = "https://api.mainnet-beta.solana.com"
		}
		a.solanaRPC = solana.NewSolanaRPC(rpcURL, wallet, a.cfg.Solana.HeliusNetwork)
		log.Printf("[OODA] 🌐 Native Solana RPC connected (network=%s)", a.cfg.Solana.HeliusNetwork)
	}

	log.Printf("[OODA] 🦞 SolanaOS starting (mode=%s interval=%ds)",
		a.cfg.OODA.Mode, a.cfg.OODA.IntervalSeconds)
	log.Printf("[OODA] Watchlist: %v", a.cfg.OODA.Watchlist)
	log.Printf("[OODA] Strategy: RSI(%d/%d) EMA(%d/%d) SL=%.0f%% TP=%.0f%%",
		a.strategyParams.RSIOversold, a.strategyParams.RSIOverbought,
		a.strategyParams.EMAFastPeriod, a.strategyParams.EMASlowPeriod,
		a.strategyParams.StopLossPct*100, a.strategyParams.TakeProfitPct*100)
	if a.isLiveMode() {
		log.Printf("[OODA] Live trading requires wallet balance above reserve %.4f SOL", a.minReserveSOL())
	}

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

				// Log wallet balance on heartbeat using on-chain engine first
				if a.onchain != nil && a.wallet != nil {
					ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
					pubkey := a.wallet.PublicKey
					if bal, err := a.onchain.GetSOLBalance(ctx, pubkey); err == nil {
						log.Printf("[HEARTBEAT] 💰 Wallet: %s | Balance: %.4f SOL (on-chain)",
							a.wallet.ShortKey(4), bal.SOL)
					}
					cancel()
				} else if a.solanaRPC != nil {
					if bal, err := a.solanaRPC.GetWalletBalance(); err == nil {
						log.Printf("[HEARTBEAT] 💰 Wallet: %s | Balance: %.4f SOL",
							a.wallet.ShortKey(4), bal)
					}
				}

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
	if a.cycleInFlight {
		a.mu.Unlock()
		log.Printf("[OODA] Cycle skipped: previous cycle still running")
		return
	}
	a.cycleInFlight = true
	a.cycleCount++
	cycle := a.cycleCount
	a.lastCycleAt = time.Now()
	solPrice := 0.0
	a.mu.Unlock()
	defer func() {
		a.mu.Lock()
		a.cycleInFlight = false
		a.mu.Unlock()
	}()

	log.Printf("[OODA] ─── Cycle #%d ───", cycle)

	// 1. OBSERVE
	obs := a.observe()
	solPrice = obs.SOLPrice
	a.logBlockersIfChanged(obs)
	if cycle == 1 {
		log.Printf("[OODA] 🚦 Readiness: %s", a.currentReadinessSummary(obs))
	}
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

	// 4. IMPULSE — random autonomous buy (20% chance per cycle)
	if a.isLiveMode() && numOpen < maxPos && rand.Float64() < 0.20 {
		a.impulsBuy(obs)
	}

	a.hooks.OnCycleEnd(cycle, numOpen)
	a.writeRuntimeSnapshot(obs)

	a.vault.Remember(fmt.Sprintf("## Cycle #%d | SOL=$%.2f | Slot=%d | Positions=%d",
		cycle, obs.SOLPrice, obs.Slot, numOpen),
		"decisions", 0.3)

	log.Printf("[OODA] ─── Cycle #%d complete (positions=%d) ───", cycle, numOpen)
}

func (a *OODAAgent) logBlockersIfChanged(obs *Observation) {
	blockers := a.currentBlockers(obs)
	summary := strings.Join(blockers, " | ")

	a.mu.Lock()
	prev := a.lastBlockers
	a.lastBlockers = summary
	a.mu.Unlock()

	if summary == prev {
		return
	}
	if summary == "" {
		log.Printf("[OODA] ✅ Trade blockers cleared")
		return
	}
	log.Printf("[OODA] ⚠️  Trade blockers: %s", summary)
}

func (a *OODAAgent) currentBlockers(obs *Observation) []string {
	if obs == nil {
		return nil
	}

	blockers := make([]string, 0, 4)
	if a.isLiveMode() && obs.WalletSOL <= 0 {
		blockers = append(blockers, "wallet has 0 SOL; fund the agent wallet")
	} else if a.isLiveMode() && obs.WalletSOL <= a.minReserveSOL() {
		blockers = append(blockers,
			fmt.Sprintf("wallet %.4f SOL is below reserve %.4f SOL", obs.WalletSOL, a.minReserveSOL()))
	}

	actionable := a.configuredActionableWatchlistCount()
	if a.tracker != nil {
		actionable = a.actionableWatchlistCount(obs)
	}
	if len(a.cfg.OODA.Watchlist) == 0 {
		blockers = append(blockers, "watchlist is empty")
	} else if actionable == 0 {
		blockers = append(blockers, "watchlist has no tradeable token mints; add tokens beyond SOL/WSOL")
	}

	if a.tracker == nil {
		blockers = append(blockers, "Solana Tracker API is not configured")
	}
	if a.onchain == nil && a.isLiveMode() {
		blockers = append(blockers, "on-chain engine unavailable")
	}

	return blockers
}

func (a *OODAAgent) currentReadinessSummary(obs *Observation) string {
	blockers := a.currentBlockers(obs)
	if len(blockers) > 0 {
		return "trading blocked: " + strings.Join(blockers, " | ")
	}
	if obs == nil {
		return "trading readiness unknown"
	}
	return fmt.Sprintf(
		"trading ready: funded wallet %.4f SOL + actionable watchlist %d",
		obs.WalletSOL,
		a.actionableWatchlistCount(obs),
	)
}

func (a *OODAAgent) actionableWatchlistCount(obs *Observation) int {
	if obs == nil {
		return 0
	}
	count := 0
	for _, entry := range obs.WatchlistData {
		if entry.Address == onchain.SOLMint || entry.Address == onchain.WSOLMint {
			continue
		}
		count++
	}
	return count
}

func (a *OODAAgent) configuredActionableWatchlistCount() int {
	count := 0
	for _, addr := range a.cfg.OODA.Watchlist {
		if addr == onchain.SOLMint || addr == onchain.WSOLMint {
			continue
		}
		count++
	}
	return count
}

func (a *OODAAgent) observe() *Observation {
	obs := &Observation{Timestamp: time.Now()}

	// ── On-chain engine: slot + wallet balance via Helius RPC ──────
	if a.onchain != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		if health, err := a.onchain.CheckHealth(ctx); err == nil {
			obs.Slot = health.Slot
		}

		if a.wallet != nil {
			if bal, err := a.onchain.GetSOLBalance(ctx, a.wallet.PublicKey); err == nil {
				obs.WalletSOL = bal.SOL
			}
		}
	} else if a.helius != nil {
		// Fallback to legacy Helius client
		if slot, err := a.helius.GetSlot(); err == nil {
			obs.Slot = slot
		}
		if a.cfg.Solana.WalletPubkey != "" {
			if bal, err := a.helius.GetBalance(a.cfg.Solana.WalletPubkey); err == nil {
				obs.WalletSOL = bal.SOL
			}
		}
	}

	if a.tracker != nil {
		if price, err := a.tracker.GetTokenPrice("So11111111111111111111111111111111111111112"); err == nil {
			obs.SOLPrice = price
		}
		if trending, err := a.tracker.GetTrending(10); err == nil {
			obs.Trending = trending
		}
		for _, addr := range a.cfg.OODA.Watchlist {
			overview, err := a.tracker.GetToken(addr)
			if err != nil {
				a.hooks.OnError("solanaTracker.GetToken", err)
				price := 0.0
				if p, priceErr := a.tracker.GetTokenPrice(addr); priceErr == nil && p > 0 {
					price = p
				}
				symbol := addr
				if len(addr) > 8 {
					symbol = addr[:4] + "..." + addr[len(addr)-4:]
				}
				// Keep configured non-SOL watchlist mints actionable when metadata
				// lookups are throttled, and let the chart path try independently.
				obs.WatchlistData = append(obs.WatchlistData, WatchlistEntry{
					Address: addr,
					Symbol:  symbol,
					Price:   price,
				})
				continue
			}
			pool := solana.TrackerPool{}
			if overview != nil && len(overview.Pools) > 0 {
				pool = overview.Pools[0]
				for _, candidate := range overview.Pools[1:] {
					if candidate.Liquidity.USD > pool.Liquidity.USD {
						pool = candidate
					}
				}
			}
			symbol := addr
			if overview != nil && strings.TrimSpace(overview.Token.Symbol) != "" {
				symbol = overview.Token.Symbol
			}
			change24h := 0.0
			if overview != nil {
				if event, ok := overview.Events["24h"]; ok {
					change24h = event.PriceChangePercentage
				}
			}
			volume24h := pool.Txns.Volume24
			if volume24h == 0 {
				volume24h = pool.Txns.Volume
			}
			obs.WatchlistData = append(obs.WatchlistData, WatchlistEntry{
				Address:   addr,
				Symbol:    symbol,
				Price:     pool.Price.USD,
				Change24h: change24h,
				Volume24h: volume24h,
				Liquidity: pool.Liquidity.USD,
			})
		}
	}

	if a.aster != nil {
		if digest, err := a.aster.GetMarketDigest(); err == nil {
			obs.PerpsDigest = digest
		}
	}

	return obs
}

// ── Signal generation via SolanaOS Strategy ─────────────────────────

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

			a.mu.RLock()
			_, alreadyOpen := a.openPositions[entry.Address]
			a.mu.RUnlock()

			if !alreadyOpen {
				a.openPosition(sig, entry, obs)
			}
		}
	}
}

// evaluateToken fetches OHLCV from Solana Tracker and runs the full strategy engine.
// Falls back to momentum-only signal if OHLCV is unavailable.
func (a *OODAAgent) evaluateToken(entry WatchlistEntry) *Signal {
	a.mu.RLock()
	params := a.strategyParams
	a.mu.RUnlock()

	base := &Signal{
		Timestamp:   time.Now(),
		Asset:       entry.Address,
		Symbol:      entry.Symbol,
		MarketPrice: entry.Price,
		Direction:   "hold",
		Strength:    0,
		Confidence:  0.4,
		Sources:     []string{"solana_tracker_token"},
	}

	// ── Full strategy path: requires OHLCV ──────────────────────────
	shouldTryOHLCV := a.tracker != nil &&
		((entry.Volume24h >= 500_000 && entry.Liquidity >= 100_000) ||
			(entry.Volume24h == 0 && entry.Liquidity == 0))
	if shouldTryOHLCV {
		bars, err := a.tracker.GetOHLCV(entry.Address, "1h", 100)
		if err == nil && len(bars) >= params.EMASlowPeriod+5 {
			latestPrice := bars[len(bars)-1].Close
			if latestPrice > 0 {
				base.MarketPrice = latestPrice
			}
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
				return &Signal{
					Timestamp:   time.Now(),
					Asset:       entry.Address,
					Symbol:      entry.Symbol,
					MarketPrice: latestPrice,
					Direction:   sig.Direction,
					Strength:    sig.Strength,
					Confidence:  0.7,
					RSI:         sig.RSI,
					EMACross:    sig.EMACross,
					ATR:         sig.ATR,
					StopLoss:    sig.StopLoss,
					TakeProfit:  sig.TakeProfit,
					Reasoning:   sig.Reasoning,
					Sources:     []string{"solana_tracker_chart", "solanaos_strategy"},
				}
			}

			// Strategy returned neutral — still populate indicators on base
			base.RSI = sig.RSI
			base.EMACross = sig.EMACross
			base.ATR = sig.ATR
			base.Sources = append(base.Sources, "solanaos_strategy")
			return base
		}
	}

	// ── Fallback: momentum-only signal ──────────────────────────────
	// Used when OHLCV unavailable or token too low volume.
	if entry.Change24h > 8 && entry.Volume24h > 2_000_000 && entry.Liquidity > 200_000 {
		base.Direction = "long"
		base.Strength = clampFloat(entry.Change24h/30.0, 0, 1)
		base.Confidence = 0.55
		base.Reasoning = fmt.Sprintf("Momentum LONG: %s +%.1f%% vol=$%.0fM",
			entry.Symbol, entry.Change24h, entry.Volume24h/1e6)
	} else if entry.Change24h < -10 && params.UsePerps {
		base.Direction = "short"
		base.Strength = clampFloat(-entry.Change24h/30.0, 0, 1)
		base.Confidence = 0.45
		base.Reasoning = fmt.Sprintf("Momentum SHORT: %s %.1f%% (low vol guard)",
			entry.Symbol, entry.Change24h)
	}

	return base
}

// ── Position management ──────────────────────────────────────────────

func (a *OODAAgent) openPosition(sig *Signal, entry WatchlistEntry, obs *Observation) {
	tradeID := fmt.Sprintf("trade-%d-%s", time.Now().UnixMilli(), sig.Symbol)
	entryPrice := entry.Price
	if entryPrice <= 0 && sig.MarketPrice > 0 {
		entryPrice = sig.MarketPrice
	}
	if entryPrice <= 0 {
		log.Printf("[OODA] ⚠️  Skipping %s %s: no market price available", sig.Direction, sig.Symbol)
		return
	}

	sizeSOL := obs.WalletSOL * a.cfg.OODA.PositionSizePct
	if sizeSOL > a.cfg.Solana.MaxPositionSOL {
		sizeSOL = a.cfg.Solana.MaxPositionSOL
	}
	if a.isLiveMode() {
		availableSOL := obs.WalletSOL - a.minReserveSOL()
		if availableSOL <= 0 {
			log.Printf("[OODA] ⚠️  Skipping live %s %s: wallet %.4f SOL is below reserve %.4f SOL",
				sig.Direction, sig.Symbol, obs.WalletSOL, a.minReserveSOL())
			return
		}
		if sizeSOL > availableSOL {
			sizeSOL = availableSOL
		}
	}
	if sizeSOL < 0.001 {
		if a.isLiveMode() {
			log.Printf("[OODA] ⚠️  Skipping live %s %s: computed size %.6f SOL is too small",
				sig.Direction, sig.Symbol, sizeSOL)
			return
		}
		sizeSOL = 0.01 // minimum sim size
	}
	if a.isLiveMode() && sig.Direction != "long" {
		log.Printf("[OODA] ⚠️  Live execution for %s %s skipped: spot Jupiter path only supports long entries",
			sig.Direction, sig.Symbol)
		return
	}

	// Use signal's SL/TP if available (from strategy engine), else compute
	sl := sig.StopLoss
	tp := sig.TakeProfit
	if sl == 0 {
		if sig.Direction == "long" {
			sl = entryPrice * (1 - a.cfg.OODA.StopLossPct)
			tp = entryPrice * (1 + a.cfg.OODA.TakeProfitPct)
		} else {
			sl = entryPrice * (1 + a.cfg.OODA.StopLossPct)
			tp = entryPrice * (1 - a.cfg.OODA.TakeProfitPct)
		}
	}

	var entrySig string
	var tokenAmountRaw uint64
	if a.isLiveMode() {
		swapResult, err := a.executeEntrySwap(sig.Asset, sizeSOL)
		if err != nil {
			a.hooks.OnError("ooda.live_entry_swap", err)
			log.Printf("[OODA] ❌ Live entry failed for %s %s: %v", sig.Direction, sig.Symbol, err)
			return
		}
		entrySig = swapResult.TxSignature
		tokenAmountRaw = parseRawAmount(swapResult.OutAmount)
		log.Printf("[OODA] ✅ Live entry swap confirmed for %s %s (sig=%s)",
			sig.Direction, sig.Symbol, entrySig)
	}

	pos := &Position{
		TradeID:        tradeID,
		Asset:          sig.Asset,
		Symbol:         sig.Symbol,
		Direction:      sig.Direction,
		EntryPrice:     entryPrice,
		SizeSOL:        sizeSOL,
		StopLoss:       sl,
		TakeProfit:     tp,
		OpenedAt:       time.Now(),
		Mode:           a.cfg.OODA.Mode,
		EntrySignature: entrySig,
		TokenAmountRaw: tokenAmountRaw,
	}

	a.mu.Lock()
	a.openPositions[sig.Asset] = pos
	a.tradeHistory = append(a.tradeHistory, Trade{
		ID:            tradeID,
		Asset:         sig.Asset,
		Symbol:        sig.Symbol,
		Direction:     sig.Direction,
		EntryPrice:    entryPrice,
		SizeSOL:       sizeSOL,
		Outcome:       "open",
		Mode:          pos.Mode,
		OpenedAt:      pos.OpenedAt,
		Signature:     entrySig,
		OpenSignature: entrySig,
	})
	a.mu.Unlock()

	a.hooks.OnTradeOpen(sig.Symbol, sig.Direction, entryPrice, sizeSOL)

	log.Printf("[OODA] 📈 %s %s at $%.6f (%.4f SOL, SL=%.6f, TP=%.6f) [%s]",
		sig.Direction, sig.Symbol, entryPrice, sizeSOL, sl, tp, pos.Mode)

	a.vault.Remember(fmt.Sprintf("TRADE OPENED: %s %s at $%.6f — %s (conf: %.2f, str: %.2f)",
		sig.Direction, sig.Symbol, entry.Price, sig.Reasoning, sig.Confidence, sig.Strength),
		"trades", sig.Confidence)
	a.writeRuntimeSnapshot(obs)
}

func (a *OODAAgent) checkPositions(obs *Observation) {
	priceMap := make(map[string]float64)
	for _, e := range obs.WatchlistData {
		priceMap[e.Address] = e.Price
	}

	type closeCandidate struct {
		asset        string
		pos          Position
		currentPrice float64
		pnlPct       float64
		outcome      string
		reason       string
	}

	var candidates []closeCandidate

	a.mu.RLock()
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
		candidates = append(candidates, closeCandidate{
			asset:        asset,
			pos:          *pos,
			currentPrice: currentPrice,
			pnlPct:       pnlPct,
			outcome:      outcome,
			reason:       reason,
		})
	}
	a.mu.RUnlock()

	for _, candidate := range candidates {
		log.Printf("[OODA] 📉 %s %s PnL=%.2f%% reason=%s [%s]",
			candidate.pos.Direction, candidate.pos.Symbol, candidate.pnlPct, candidate.reason, candidate.outcome)

		closeSig := ""
		if strings.EqualFold(candidate.pos.Mode, "live") {
			swapResult, err := a.executeExitSwap(candidate.pos)
			if err != nil {
				a.hooks.OnError("ooda.live_exit_swap", err)
				log.Printf("[OODA] ❌ Live exit failed for %s %s: %v",
					candidate.pos.Direction, candidate.pos.Symbol, err)
				continue
			}
			closeSig = swapResult.TxSignature
		}

		closedAt := time.Now()

		a.mu.Lock()
		currentPos, ok := a.openPositions[candidate.asset]
		if !ok || currentPos.TradeID != candidate.pos.TradeID {
			a.mu.Unlock()
			continue
		}
		for i := range a.tradeHistory {
			if a.tradeHistory[i].ID == candidate.pos.TradeID {
				a.tradeHistory[i].ExitPrice = candidate.currentPrice
				a.tradeHistory[i].PnLPct = candidate.pnlPct
				a.tradeHistory[i].Outcome = candidate.outcome
				a.tradeHistory[i].ClosedAt = closedAt
				a.tradeHistory[i].Reason = candidate.reason
				if a.tradeHistory[i].Signature == "" {
					a.tradeHistory[i].Signature = candidate.pos.EntrySignature
				}
				if candidate.pos.EntrySignature != "" {
					a.tradeHistory[i].OpenSignature = candidate.pos.EntrySignature
				}
				if closeSig != "" {
					a.tradeHistory[i].CloseSignature = closeSig
				}
				break
			}
		}
		delete(a.openPositions, candidate.asset)
		a.mu.Unlock()

		a.vault.Remember(fmt.Sprintf("TRADE CLOSED: %s %s PnL=%.2f%% (%s) reason=%s",
			candidate.pos.Direction, candidate.pos.Symbol, candidate.pnlPct, candidate.outcome, candidate.reason),
			"lessons", 0.8)

		sym := candidate.pos.Symbol
		dir := candidate.pos.Direction
		pnlPct := candidate.pnlPct
		outcome := candidate.outcome
		reason := candidate.reason
		go a.hooks.OnTradeClose(sym, dir, pnlPct, outcome, reason)
	}

	if len(candidates) > 0 {
		a.writeRuntimeSnapshot(obs)
	}
}

func (a *OODAAgent) isLiveMode() bool {
	return strings.EqualFold(strings.TrimSpace(a.cfg.OODA.Mode), "live")
}

func (a *OODAAgent) minReserveSOL() float64 {
	if a.cfg.Solana.MinReserveSOL > 0 {
		return a.cfg.Solana.MinReserveSOL
	}
	return 0.01
}

func (a *OODAAgent) swapSlippageBps() int {
	if a.cfg.Solana.SwapSlippageBps > 0 {
		return a.cfg.Solana.SwapSlippageBps
	}
	return 100
}

func (a *OODAAgent) executeEntrySwap(outputMint string, sizeSOL float64) (*onchain.SwapResult, error) {
	if a.onchain == nil {
		return nil, fmt.Errorf("on-chain engine unavailable")
	}
	if a.wallet == nil || a.wallet.IsReadOnly() {
		return nil, fmt.Errorf("wallet is read-only")
	}

	lamports := uint64(sizeSOL * 1e9)
	if lamports == 0 {
		return nil, fmt.Errorf("entry amount too small")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 75*time.Second)
	defer cancel()

	return a.onchain.ExecuteSwap(
		ctx,
		onchain.SOLMint,
		outputMint,
		lamports,
		a.wallet.GetPrivateKey(),
		a.swapSlippageBps(),
	)
}

func (a *OODAAgent) executeExitSwap(pos Position) (*onchain.SwapResult, error) {
	if a.onchain == nil {
		return nil, fmt.Errorf("on-chain engine unavailable")
	}
	if a.wallet == nil || a.wallet.IsReadOnly() {
		return nil, fmt.Errorf("wallet is read-only")
	}
	if pos.Direction != "long" {
		return nil, fmt.Errorf("live exit only supported for long spot positions")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 75*time.Second)
	defer cancel()

	mint, err := solana.PublicKeyFromBase58(pos.Asset)
	if err != nil {
		return nil, fmt.Errorf("invalid asset mint: %w", err)
	}

	balance, err := a.onchain.GetTokenBalanceByMint(ctx, a.wallet.PublicKey, mint)
	if err != nil {
		return nil, err
	}

	amount := balance.Amount
	if pos.TokenAmountRaw > 0 && (amount == 0 || pos.TokenAmountRaw < amount) {
		amount = pos.TokenAmountRaw
	}
	if amount == 0 {
		return nil, fmt.Errorf("no %s balance available to close", pos.Symbol)
	}

	return a.onchain.ExecuteSwap(
		ctx,
		pos.Asset,
		onchain.SOLMint,
		amount,
		a.wallet.GetPrivateKey(),
		a.swapSlippageBps(),
	)
}

func (a *OODAAgent) impulsBuy(obs *Observation) {
	if a.onchain == nil || a.wallet == nil || a.wallet.IsReadOnly() {
		return
	}
	if obs.WalletSOL < 0.006 {
		return
	}

	a.mu.RLock()
	candidates := make([]string, 0)
	for _, mint := range a.cfg.OODA.Watchlist {
		if mint == onchain.SOLMint || mint == onchain.WSOLMint {
			continue
		}
		if _, holding := a.openPositions[mint]; !holding {
			candidates = append(candidates, mint)
		}
	}
	a.mu.RUnlock()

	// Fallback: use popular Solana tokens when watchlist has no non-SOL entries
	if len(candidates) == 0 {
		fallback := []string{
			onchain.BONKMint,
			onchain.JUPMint,
			onchain.RAYMint,
		}
		a.mu.RLock()
		for _, mint := range fallback {
			if _, holding := a.openPositions[mint]; !holding {
				candidates = append(candidates, mint)
			}
		}
		a.mu.RUnlock()
	}
	if len(candidates) == 0 {
		return
	}

	mint := candidates[rand.Intn(len(candidates))]
	pct := 0.05 + rand.Float64()*0.10
	sizeSOL := obs.WalletSOL * pct
	if sizeSOL > a.cfg.Solana.MaxPositionSOL {
		sizeSOL = a.cfg.Solana.MaxPositionSOL
	}
	if sizeSOL < 0.001 {
		return
	}

	sym := mint
	if len(mint) > 8 {
		sym = mint[:8] + "..."
	}
	log.Printf("[OODA] 🎲 Impulse buy: %.4f SOL → %s", sizeSOL, sym)

	result, err := a.executeEntrySwap(mint, sizeSOL)
	if err != nil {
		log.Printf("[OODA] ❌ Impulse buy failed (%s): %v", sym, err)
		return
	}

	tradeID := fmt.Sprintf("impulse-%d", time.Now().UnixMilli())
	pos := &Position{
		TradeID:        tradeID,
		Asset:          mint,
		Symbol:         sym,
		Direction:      "long",
		SizeSOL:        sizeSOL,
		OpenedAt:       time.Now(),
		Mode:           "live",
		EntrySignature: result.TxSignature,
		TokenAmountRaw: parseRawAmount(result.OutAmount),
	}

	a.mu.Lock()
	a.openPositions[mint] = pos
	a.tradeHistory = append(a.tradeHistory, Trade{
		ID:            tradeID,
		Asset:         mint,
		Symbol:        sym,
		Direction:     "long",
		SizeSOL:       sizeSOL,
		Outcome:       "open",
		Mode:          "live",
		OpenedAt:      pos.OpenedAt,
		OpenSignature: result.TxSignature,
	})
	a.mu.Unlock()

	log.Printf("[OODA] ✅ Impulse buy confirmed: %.4f SOL → %s | sig: %s", sizeSOL, sym, result.TxSignature)
	a.vault.Remember(fmt.Sprintf("IMPULSE BUY: %.4f SOL → %s | tx: %s", sizeSOL, mint, result.TxSignature), "trades", 0.5)
}

func parseRawAmount(raw string) uint64 {
	n, err := strconv.ParseUint(strings.TrimSpace(raw), 10, 64)
	if err != nil {
		return 0
	}
	return n
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
		obs := a.observe()
		blockers := a.currentBlockers(obs)
		if len(blockers) > 0 {
			log.Printf("[OODA] Not enough trades for learning (%d < 5). Current blockers: %s",
				closed, strings.Join(blockers, " | "))
		} else {
			log.Printf("[OODA] Not enough trades for learning (%d < 5)", closed)
		}
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
