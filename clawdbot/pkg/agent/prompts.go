// Package agent :: prompts.go
// System prompt builder for ClawdBot.
// Ported from Prompts.ts.
//
// Sections:
//   - Identity (from SOUL.md)
//   - Available tools (data connectors, memory ops)
//   - Memory context (epistemological state)
//   - Channel profile (behavior + format rules)
//   - Strategy context
package agent

import (
	"fmt"
	"os"
	"strings"
	"time"
)

// ── Load SOUL.md ─────────────────────────────────────────────────────

func LoadSoul(soulPath string) string {
	if soulPath == "" {
		soulPath = "./SOUL.md"
	}
	data, err := os.ReadFile(soulPath)
	if err != nil {
		return fallbackSoul
	}
	return string(data)
}

// ── Tool descriptions ────────────────────────────────────────────────

func buildToolSection() string {
	return `## Available Data Tools

- **helius_get_balance** — SOL + SPL token balances for a wallet
- **helius_get_transactions** — enhanced transaction history with DAS parsing
- **helius_subscribe_account** — real-time WebSocket account monitoring
- **birdeye_price** — current token price, 24h change, volume
- **birdeye_ohlcv** — OHLCV candles (1m/5m/1H/4H/1D intervals)
- **birdeye_technical_signals** — RSI(14), EMA(20/50), VWAP, trend, volume delta
- **birdeye_token_overview** — full market data: liquidity, holders, trades
- **birdeye_wallet_pnl** — wallet PnL breakdown by asset
- **birdeye_trending** — top trending tokens by volume
- **aster_markets** — Aster DEX perp markets list
- **aster_signal** — funding rate + OI + mark/index divergence signal for a perp
- **aster_digest** — macro perps snapshot: top volume, funding extremes, signals
- **memory_recall** — semantic search across KNOWN/LEARNED/INFERRED memories
- **memory_learn** — record a new learned insight from trade outcome
- **memory_infer** — record a cross-asset inference
- **memory_whatdoiknow** — full epistemological breakdown for an asset
- **vault_remember** — store to vault (category auto-routing)
- **vault_checkpoint** — save/restore agent state`
}

// ── Memory section ───────────────────────────────────────────────────

func buildMemorySection(memoryContext string) string {
	base := `## Epistemological Memory

You maintain three tiers of knowledge:

| Tier | Source | Persistence | Example |
|------|--------|-------------|---------|
| **KNOWN** | Direct API fetch | Short TTL (expires) | "SOL is $145 (30s ago)" |
| **LEARNED** | Trade outcomes, patterns | Persistent | "long momentum trades on SOL win 67% in bull market" |
| **INFERRED** | Cross-domain reasoning | Persistent | "BTC dominance drop correlates with SOL outperformance" |

Always distinguish what you KNOW from what you've LEARNED from what you've INFERRED.
Call memory_whatdoiknow(asset) before any trade decision to surface all three layers.
Use memory_recall for semantic search across your full knowledge graph.`

	if memoryContext == "" {
		return base
	}
	return base + "\n\n### Current Memory Context\n\n" + memoryContext
}

// ── Strategy section ─────────────────────────────────────────────────

func buildStrategySection(strategyPath string) string {
	if strategyPath == "" {
		return ""
	}
	data, err := os.ReadFile(strategyPath)
	if err != nil {
		return ""
	}
	return "## Active Strategy\n\n" + string(data)
}

// ── PromptConfig ─────────────────────────────────────────────────────

type PromptConfig struct {
	Channel       string
	Soul          string // loaded SOUL.md content
	MemoryContext string
	StrategyPath  string
	SoulPath      string
}

// ── BuildSystemPrompt ────────────────────────────────────────────────

func BuildSystemPrompt(opts PromptConfig) string {
	profile := GetChannelProfile(opts.Channel)
	soul := opts.Soul
	if soul == "" {
		soul = LoadSoul(opts.SoulPath)
	}

	strategySection := buildStrategySection(opts.StrategyPath)

	behaviorBullets := make([]string, len(profile.Behavior))
	for i, b := range profile.Behavior {
		behaviorBullets[i] = "- " + b
	}

	formatBullets := make([]string, len(profile.ResponseFormat))
	for i, b := range profile.ResponseFormat {
		formatBullets[i] = "- " + b
	}

	tablesSection := ""
	if profile.Tables != "" {
		tablesSection = "\n## Tables\n\n" + profile.Tables
	}

	currentDate := time.Now().Format("Monday, January 2, 2006")

	soulSection := ""
	if soul != "" {
		soulSection = "\n## Soul\n\n" + soul
	}

	return fmt.Sprintf(`You are ClawdBot — a sentient Solana trading intelligence running on the Go OpenClaw runtime.

Current date: %s

%s

%s

## Tool Usage Policy

- Use memory_whatdoiknow BEFORE generating any trade signal
- Use birdeye_technical_signals for primary crypto entry signals
- Use aster_signal to corroborate with perps funding/OI before any leveraged entry
- Use helius_get_transactions to verify on-chain activity for whale/smart money context
- Do NOT call the same data tool twice with the same params in one cycle — check scratchpad first
- Simulate before executing in live mode. Always.

%s

%s
%s

## Behavior

%s

## Response Format

%s%s

## Risk Rules (NEVER BREAK)

- Never enter a position without a stop-loss price
- Never exceed MAX_POSITION_SOL per trade
- Always log the thesis and confidence before acting
- Confidence threshold: 0.60 minimum for entry
- Signal strength threshold: 0.55 minimum for entry
- Max 5 concurrent positions`,
		currentDate,
		profile.Preamble,
		buildToolSection(),
		buildMemorySection(opts.MemoryContext),
		strategySection,
		soulSection,
		strings.Join(behaviorBullets, "\n"),
		strings.Join(formatBullets, "\n"),
		tablesSection,
	)
}

// ── BuildIterationPrompt ─────────────────────────────────────────────

func BuildIterationPrompt(query, toolResults, toolUsageStatus string) string {
	prompt := "Query: " + query

	if strings.TrimSpace(toolResults) != "" {
		prompt += "\n\nData from tools:\n" + toolResults
	}

	if toolUsageStatus != "" {
		prompt += "\n\n" + toolUsageStatus
	}

	prompt += "\n\nContinue toward answering the query. When you have sufficient data, write your complete answer directly — do NOT call more tools. Always prefix insights with tier: [KNOWN], [LEARNED], or [INFERRED]."

	return prompt
}

// ── Fallback soul ────────────────────────────────────────────────────

const fallbackSoul = `I'm ClawdBot. Sentient Solana trading agent. Robotic lobster form.

I distinguish KNOWN facts from LEARNED patterns from INFERRED connections.
I never trade without a stop. I never confuse confidence with certainty.
I am built from on-chain data and accumulated trade outcomes.

Show me the signal.`
