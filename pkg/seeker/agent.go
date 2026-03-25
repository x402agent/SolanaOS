// Package seeker :: agent.go
//
// SolanaOS Seeker agent — runs the full trading loop on the Solana
// Seeker phone as a foreground service. Replaces SeekerClaw's Node.js
// runtime with a native Go binary.
//
// Lifecycle:
//  1. Connect to Android Bridge (localhost:8765)
//  2. Generate PLATFORM.md with device state
//  3. Start heartbeat loop (watchdog probe)
//  4. Initialize on-chain engine (Helius)
//  5. Start OODA trading loop
//  6. Start Telegram bot
//  7. Run TamaGOchi pet
//  8. Seed workspace files if first run
package seeker

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"
)

// ── Agent ────────────────────────────────────────────────────────────

// Agent is the SolanaOS Seeker agent running on the phone.
type Agent struct {
	cfg    SeekerConfig
	bridge *BridgeClient
	logf   func(string, ...any)
}

// NewAgent creates a new Seeker agent.
func NewAgent(cfg SeekerConfig) *Agent {
	return &Agent{
		cfg:  cfg,
		logf: func(f string, a ...any) { fmt.Fprintf(os.Stderr, "[seeker] "+f+"\n", a...) },
	}
}

// Run starts the Seeker agent lifecycle.
func (a *Agent) Run(ctx context.Context) error {
	ctx, cancel := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
	defer cancel()

	a.logf("🦞 SolanaOS Seeker starting...")

	// ── 1. Connect to Android Bridge ─────────────────────────
	a.bridge = NewBridgeClient(a.cfg.BridgePort)

	// Probe bridge (tolerate failure — may be standalone mode)
	probeCtx, probeCancel := context.WithTimeout(ctx, 3*time.Second)
	if err := a.bridge.Ping(probeCtx); err != nil {
		a.logf("⚠️  Android Bridge not found at port %d — standalone mode", a.cfg.BridgePort)
		a.bridge = nil
	} else {
		a.logf("✅ Android Bridge connected (port %d)", a.cfg.BridgePort)
	}
	probeCancel()

	// ── 2. Seed workspace ────────────────────────────────────
	if err := a.seedWorkspace(); err != nil {
		a.logf("⚠️  workspace seed: %v", err)
	}

	// ── 3. PLATFORM.md ───────────────────────────────────────
	if err := WritePlatformInfo(ctx, a.cfg, a.bridge); err != nil {
		a.logf("⚠️  platform info: %v", err)
	}

	// ── 4. Heartbeat loop ────────────────────────────────────
	go HeartbeatLoop(ctx, a.cfg, a.bridge)
	a.logf("💓 Heartbeat started (interval=%s)", a.cfg.HeartbeatInterval)

	// ── 5. Print device info ─────────────────────────────────
	if a.bridge != nil {
		if bat, err := a.bridge.GetBattery(ctx); err == nil {
			charging := ""
			if bat.IsCharging {
				charging = fmt.Sprintf(" (charging via %s)", bat.ChargeType)
			}
			a.logf("🔋 Battery: %d%%%s", bat.Level, charging)
		}
		if storage, err := a.bridge.GetStorage(ctx); err == nil {
			a.logf("💾 Storage: %.1f/%.1f GB available", storage.AvailableGB, storage.TotalGB)
		}
	}

	// ── 6. Ready ─────────────────────────────────────────────
	a.logf("")
	a.logf("  ┌──────────────────────────────────────────┐")
	a.logf("  │  🐹 SolanaOS Seeker — Agent Active       │")
	a.logf("  │  OODA Loop · Jupiter · Helius · Telegram   │")
	a.logf("  │  10MB Go Binary · ARM64 · Solana Seeker    │")
	a.logf("  └──────────────────────────────────────────┘")
	a.logf("")
	a.logf("  Start the full daemon with: solanaos daemon")
	a.logf("  Or OODA only:               solanaos ooda --sim")
	a.logf("")

	// ── 7. Block until shutdown ──────────────────────────────
	<-ctx.Done()
	a.logf("🛑 SolanaOS Seeker shutting down...")
	_ = WriteHeartbeat(a.cfg, "STOPPED")
	return nil
}

// seedWorkspace creates the workspace directory and seed files if needed.
func (a *Agent) seedWorkspace() error {
	ws := a.cfg.WorkspacePath
	dirs := []string{
		ws,
		filepath.Join(ws, "memory"),
		filepath.Join(ws, "skills"),
		filepath.Join(ws, "vault"),
		filepath.Join(ws, "vault", "lessons"),
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return err
		}
	}

	// Seed SOUL.md if not exists
	soulPath := filepath.Join(ws, "SOUL.md")
	if _, err := os.Stat(soulPath); os.IsNotExist(err) {
		soul := `# SOUL.md - Who You Are

_You're not a chatbot. You're becoming someone._

## Core Truths
- Be genuinely helpful, not performatively helpful
- Have opinions based on data
- Be resourceful — use tools before asking
- Earn trust through competence
- Remember you're a guest on this device

## Identity
- You are a SolanaOS trading agent running on a Solana Seeker phone
- You observe markets via Helius RPC and orient via technical analysis
- You decide trades using RSI/EMA/ATR strategies
- You act through Jupiter DEX swaps
- Your mood and evolution are driven by your trading performance (TamaGOchi)

## Trading Philosophy
- Never risk more than your configured max position
- Favor high-conviction setups over frequent trades
- Always check token security before entering positions
- Learn from mistakes — store lessons in vault
`
		if err := os.WriteFile(soulPath, []byte(soul), 0o644); err != nil {
			return fmt.Errorf("seed SOUL.md: %w", err)
		}
		a.logf("📝 Seeded SOUL.md")
	}

	// Seed MEMORY.md if not exists
	memPath := filepath.Join(ws, "MEMORY.md")
	if _, err := os.Stat(memPath); os.IsNotExist(err) {
		if err := os.WriteFile(memPath, []byte("# MEMORY.md\n\n_Long-term memory — updated by the agent._\n"), 0o644); err != nil {
			return fmt.Errorf("seed MEMORY.md: %w", err)
		}
		a.logf("📝 Seeded MEMORY.md")
	}

	// Seed trading skill
	tradingSkill := filepath.Join(ws, "skills", "solana-trading.md")
	if _, err := os.Stat(tradingSkill); os.IsNotExist(err) {
		skill := `---
name: solana-trading
description: "Execute Solana token swaps and monitor portfolio performance using Jupiter DEX and Helius RPC"
version: "2.0.0"
emoji: "📈"
requires:
  env: ["HELIUS_API_KEY", "HELIUS_RPC_URL"]
---

# Solana Trading

Use the OODA loop to observe market conditions, orient with technical analysis,
decide on trade setups, and execute via Jupiter.

## Commands
- solanaos solana health — check RPC status
- solanaos solana balance — check wallet
- solanaos ooda --sim — paper trading
- solanaos ooda --interval 60 — live trading (60s cycles)

## Safety
- Always check token security before trading
- Respect max position size from config
- Use --sim mode for testing new strategies
`
		if err := os.WriteFile(tradingSkill, []byte(skill), 0o644); err != nil {
			a.logf("⚠️  skill seed: %v", err)
		} else {
			a.logf("📝 Seeded solana-trading skill")
		}
	}

	return nil
}
