# trade.md — Pump.fun Trading Agent Skill
> Generated: 2026-03-24T19:55:11Z
> Input data: pump.md (pump.fun/board top 100 Movers)
> Use this file alongside pump.md to drive trade decisions.

## Overview

This skill tells trading agents how to interpret pump.md data and execute
trades on Solana pump.fun tokens using Jupiter aggregator or direct AMM routes.
All trades go through the NanoSolana-Go trading system.

## Data Schema (pump.md columns)

| Column | Meaning | Trading Relevance |
|--------|---------|-------------------|
| Name | Token display name | Context only |
| Symbol | Ticker symbol | Use for display/logging |
| Mint Address | Solana SPL token mint (base58) | **Required for all trades** |
| Market Cap | USD market cap (K/M suffix) | Position sizing |
| Age | Time since token creation | Recency filter |
| Bonding % | % of bonding curve filled | Graduation risk signal |

## Token Classification

### Tier 1 — Fresh Snipers (age ≤ 15m, any MC)
**Strategy:** Small size, fast flip. Enter within 2 min of detection, exit at 2–5× or 10min TTL.

**Currently fresh (from this scan):**

| Name | Symbol | Mint | MC | Age | Bonding% |
|------|--------|------|----|-----|----------|
| The 7 Pepes | 7 | `3anvzJ5L2bNtiPx1PTokRkFRaCf79z97vAe7kMckpump` | $2.5K | 1m ago | 43.04% |
| The Desk Is All I Know | DESK | `4M7aMg77SK6dJB97NpCX3q7duwUmUZAeMbMDY6aMpump` | $2.7K | 7m ago | 27.14% |
| must have been the wind | wind | `F6FGBCrN1Rute6joSJiUgkGdrK5cXuXaXZZvAqtNpump` | $7.9K | 4m ago | 89.91% |
| Jesus Dog | JESDOG | `AqkrcPDYBdLRKSUTJEKTAwDAjLvWHViRL22Zwuk7pump` | $4.2K | 14m ago | 51.36% |
| Loki-Wen | WEN | `EVhfzrn7aeHPEgCPdQgE3eqHJStRE76WQgZ7RR3kpump` | $5.0K | 8m ago | 69.12% |
| Make Bagworking Great Again | MBGA | `AoqBt8Sq6CK7ehRV7ewcL9UNqtqBKRUucgixbuHAbonk` | $9.3K | 2m ago | 241.68% |
| Sunshine Rainbows and Lolipops | Whimsical | `hf64UGSLuqKEq1vVJXgYGyRrCHRBwdDS7CkUfP7pump` | $2.6K | 2m ago | 8.91% |
| MECHMILL | MECHMILL | `HkkWpRR6wAVK56CT9wmq83HkQMc9BYCQbx6WMvifpump` | $11.6K | 12m ago | 36.80% |
| OpenShell | OpenShell | `5Y3BVLrZfywBPxPFAFNAMrtwdgrDLmBzwZic1eVgQX8j` | $2.5K | 2m ago | 25.24% |
| Meek Language Model | MLM | `4tbdYHhpxfR7bprLreC17Gd3dBQMph3CxujdhAXzpump` | $3.6K | 59s ago | 23.63% |

### Tier 2 — Near-Graduation (bonding ≥ 75%)
**Strategy:** Medium size, ride the graduation pump. Exit before/at bonding completion (100%).
**Warning:** Token graduates to Raydium at 100% — liquidity migrates, slippage spikes.

**Currently near graduation (from this scan):**

| Name | Symbol | Mint | MC | Bonding% |
|------|--------|------|----|----------|
| Make Bagworking Great Again | MBGA | `AoqBt8Sq6CK7ehRV7ewcL9UNqtqBKRUucgixbuHAbonk` | $9.3K | 241.68% |
| Wen Lambo | Lambo | `FVk9Hz1nJjBQMTZtRKZ2RmNL5ZUhiZrLvRm1XESUbonk` | $7.6K | 228.58% |
| The Vaping Squirrel | VNUT | `CR8w8WPtu1eeHj3UTTNYXVe8WX81iT1JexvLemTrpump` | $292.4K | 93.78% |
| must have been the wind | wind | `F6FGBCrN1Rute6joSJiUgkGdrK5cXuXaXZZvAqtNpump` | $7.9K | 89.91% |

### Tier 3 — Micro-Cap Movers (MC < $10K)
**Count this scan:** 48 tokens
**Strategy:** Speculative. Use <0.05 SOL per trade. High risk, high reward.

### Tier 4 — Mid-Cap Established (MC $10K–$100K)
**Count this scan:** 36 tokens
**Strategy:** Trend-follow. Enter on momentum, use 1–2% trailing stop.

### Tier 5 — Large-Cap (MC > $100K)
**Count this scan:** 16 tokens
**Strategy:** Safer entries, smaller upside. Good for scalps on dips.

## Trade Execution Workflow

```
1. Load pump.md → parse all 100 rows
2. Filter by criteria (see decision table below)
3. For each candidate token:
   a. Verify mint is valid (44-char base58, ends in "pump" or "bonk")
   b. Check current price via Jupiter Price API
      GET https://price.jup.ag/v6/price?ids={MINT}
   c. Estimate slippage: if bonding% > 90, expect high slippage
   d. Build swap transaction via Jupiter Quote API
      GET https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112
         &outputMint={MINT}&amount={LAMPORTS}&slippageBps=500
   e. Execute swap via NanoSolana send_transaction()
   f. Log result to trade journal
4. Monitor open positions every 30s
5. Exit on: target hit | stop hit | TTL expired | bonding=100%
```

## Decision Table

| Condition | Action |
|-----------|--------|
Age ≤ 5m AND MC < $5K | **SNIPE** — 0.05 SOL entry |
Age ≤ 15m AND bonding ≥ 50% | **BUY** — 0.1 SOL, exit at 3× or bonding=95% |
bonding ≥ 90% | **AVOID** — graduation imminent, liquidity migration risk |
bonding = 0% AND age > 1d | **SKIP** — no traction |
MC > $500K AND age < 2h | **SCALP** — tight stops, 0.2 SOL max |
MC > $1M | **SKIP** — pump.fun tokens rarely sustain; exit any existing |

## Position Sizing Rules

| MC Range | Max Entry Size | Stop Loss | Take Profit |
|----------|---------------|-----------|-------------|
| < $5K | 0.05 SOL | -50% | +300% |
| $5K–$50K | 0.1 SOL | -30% | +200% |
| $50K–$200K | 0.2 SOL | -20% | +100% |
| > $200K | 0.3 SOL | -15% | +50% |

## Mint Address Validation

```python
# Valid pump.fun mint: 32–44 base58 chars
# Most end in "pump" (pump.fun native) or "bonk" (bonk.fun)
# Exceptions exist (e.g. Raydium-graduated tokens)
import re
BASE58 = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
def is_valid_mint(mint: str) -> bool:
    return bool(BASE58.match(mint))
```

## Guardrails — NEVER Do These

- **Never** trade a token with bonding% = 100% (already graduated, different AMM)
- **Never** use more than 1 SOL total exposure on pump.fun tokens simultaneously
- **Never** enter a token where age > 7 days unless MC > $100K (dead token)
- **Never** retry a failed swap more than 2 times (indicates bad liquidity)
- **Never** ignore slippage errors — they indicate low liquidity

## Integration Points

| Task | Tool/API |
|------|----------|
| Get token price | `GET https://price.jup.ag/v6/price?ids={mint}` |
| Build swap tx | Jupiter Quote + Swap API v6 |
| Send transaction | `NanoSolana.send_transaction(tx)` |
| Monitor bonding | `GET https://frontend-api.pump.fun/coins/{mint}` |
| Refresh token list | Re-run pump.fun scanner skill (updates pump.md) |

## Refresh Cadence

pump.md should be refreshed every **5 minutes** for active trading sessions.
The scanner skill (this codebase) is scheduled to run automatically.
After each refresh, re-run classification and update open-position watchlist.

## Notes on This Scan

- Scan captured 100 tokens from pump.fun/board (Movers tab)
- 23 tokens are fresh (≤15m old) — highest priority
- 4 tokens near bonding completion (≥75%)
- Largest token by MC: SwissBorg Token (BORG) at $188.8M
- Data reflects state as of: 2026-03-24T19:55:11Z
