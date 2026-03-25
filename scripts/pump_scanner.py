#!/usr/bin/env python3
"""
pump_scanner.py — Pump.fun real-time token scanner

Data sources:
  - GeckoTerminal pumpswap pools        (no auth — top 100 graduated tokens by 24h txns)
  - Solana Tracker /tokens/trending     (bonding-curve tokens with curvePercentage)
  - Solana Tracker /tokens/{mint}       (per-token enrichment for top tokens)
  - pump-bonding.mjs via subprocess     (on-chain BondingCurve state via Helius RPC)

Outputs:
  - pump.md in repo root
  - Telegram digest
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ─── Config ───────────────────────────────────────────────────────────────────

HELIUS_API_KEY    = os.environ.get("HELIUS_API_KEY", "")
HELIUS_RPC_URL    = os.environ.get("HELIUS_RPC_URL", "")
if not HELIUS_RPC_URL and HELIUS_API_KEY:
    HELIUS_RPC_URL = f"https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}"

ST_API_KEY  = os.environ.get("SOLANA_TRACKER_API_KEY", "")
ST_RPC_URL  = os.environ.get("SOLANA_TRACKER_RPC_URL", "")

TG_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8738647936:AAEfTT4Kc_GIWdBk_vhhB2GFHVQavNXcFis")
TG_CHAT  = os.environ.get("TELEGRAM_ID", "1740095485")

REPO_ROOT   = Path(os.environ.get("REPO_ROOT", Path(__file__).parent.parent))
SCRIPT_DIR  = Path(os.environ.get("SCRIPT_DIR", Path(__file__).parent))
PUMP_MD     = REPO_ROOT / "pump.md"
BONDING_MJS = SCRIPT_DIR / "pump-bonding.mjs"

NOW         = datetime.now(timezone.utc)
TIMESTAMP   = NOW.strftime("%Y-%m-%dT%H:%M:%SZ")
TIME_SHORT  = NOW.strftime("%H:%M")

Token = dict[str, Any]


# ─── HTTP helpers ─────────────────────────────────────────────────────────────

def fetch_json(url: str, headers: dict | None = None, timeout: int = 15) -> Any:
    req = urllib.request.Request(url, headers={
        "Accept": "application/json",
        "User-Agent": "pump-scanner/2.0",
        **(headers or {}),
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def st_headers() -> dict:
    return {"x-api-key": ST_API_KEY, "Accept": "application/json"}


# ─── Source 1: GeckoTerminal pumpswap pools ───────────────────────────────────

def fetch_geckoterminal() -> list[Token]:
    """Top 100 PumpSwap (graduated) tokens sorted by 24h transaction count."""
    tokens: dict[str, Token] = {}
    base = "https://api.geckoterminal.com/api/v2/networks/solana/dexes/pumpswap/pools"

    for page in range(1, 6):  # 5 pages × 20 = 100
        url = f"{base}?page={page}&sort=h24_tx_count_desc&include=base_token"
        try:
            data = fetch_json(url)
        except Exception as e:
            print(f"[gecko] page {page} error: {e}", file=sys.stderr)
            time.sleep(0.5)
            continue

        token_map = {
            inc["id"]: inc.get("attributes", {})
            for inc in data.get("included", [])
            if inc.get("type") == "token"
        }

        for item in data.get("data", []):
            attrs = item.get("attributes", {})
            rels  = item.get("relationships", {})
            base_id = rels.get("base_token", {}).get("data", {}).get("id", "")
            tok = token_map.get(base_id, {})
            mint = tok.get("address", "")
            if not mint or len(mint) < 32 or mint in tokens:
                continue

            txns_h24 = attrs.get("transactions", {}).get("h24", {})
            total_txns = (txns_h24.get("buys") or 0) + (txns_h24.get("sells") or 0)

            tokens[mint] = {
                "mint":          mint,
                "name":          tok.get("name", "Unknown"),
                "symbol":        tok.get("symbol", "?"),
                "fdv":           float(attrs.get("fdv_usd") or 0),
                "vol_24h":       float((attrs.get("volume_usd") or {}).get("h24") or 0),
                "txns_24h":      total_txns,
                "price_chg_24h": float((attrs.get("price_change_percentage") or {}).get("h24") or 0),
                "pool_created_at": attrs.get("pool_created_at", ""),
                "bonding_pct":   None,
                "graduated":     True,   # pumpswap = post-graduation AMM
                "source":        "geckoterminal_pumpswap",
            }

        time.sleep(0.35)  # ~3 req/s — stay inside free tier

    result = list(tokens.values())[:100]
    print(f"[gecko] {len(result)} graduated tokens", file=sys.stderr)
    return result


# ─── Source 2: Solana Tracker trending ────────────────────────────────────────

def fetch_st_trending() -> list[Token]:
    """Trending bonding-curve tokens from Solana Tracker (includes curvePercentage)."""
    if not ST_API_KEY:
        print("[st-trending] no API key — skipped", file=sys.stderr)
        return []

    for timeframe in ("1h", "6h"):
        url = f"https://data.solanatracker.io/tokens/trending?timeframe={timeframe}"
        try:
            data = fetch_json(url, st_headers(), timeout=12)
        except Exception as e:
            print(f"[st-trending] {timeframe}: {e}", file=sys.stderr)
            continue

        items = data if isinstance(data, list) else data.get("tokens", [])
        tokens: list[Token] = []

        for item in items[:100]:
            tok_info = item.get("token", item)
            pools    = item.get("pools", [])
            mint     = tok_info.get("mint") or tok_info.get("address", "")
            if not mint or len(mint) < 32:
                continue

            bonding_pct = None
            graduated   = False
            fdv = vol_24h = price_chg = 0.0
            created_at  = ""

            for pool in pools:
                ptype = (pool.get("market") or pool.get("type") or "").lower()
                if "pump" in ptype or pool.get("curve"):
                    bonding_pct = pool.get("curvePercentage")
                    graduated   = bool(pool.get("graduated"))
                    mc  = pool.get("marketCap", {})
                    fdv = float(mc.get("usd") or 0)
                    vol = pool.get("volume", {})
                    vol_24h = float((vol.get("h24") or vol.get("24h") or 0))
                    pc  = pool.get("priceChange", {})
                    price_chg = float((pc.get("h24") or pc.get("24h") or 0))
                    created_at = str(pool.get("createdAt", "") or "")
                    break

            if not created_at:
                created_at = str(tok_info.get("lastUpdated", "") or
                                  tok_info.get("creation", {}).get("created_time", "") or "")

            tokens.append({
                "mint":          mint,
                "name":          tok_info.get("name", "?"),
                "symbol":        tok_info.get("symbol", "?"),
                "fdv":           fdv,
                "vol_24h":       vol_24h,
                "txns_24h":      None,
                "price_chg_24h": price_chg,
                "pool_created_at": created_at,
                "bonding_pct":   bonding_pct,
                "graduated":     graduated,
                "source":        "solana_tracker_trending",
            })

        if tokens:
            print(f"[st-trending] {len(tokens)} tokens (timeframe={timeframe})", file=sys.stderr)
            return tokens

    return []


# ─── Source 3: Solana Tracker per-token enrichment ────────────────────────────

def enrich_with_st(tokens: list[Token], max_calls: int = 30) -> list[Token]:
    """Fetch curvePercentage for tokens that still lack it (non-graduated only)."""
    if not ST_API_KEY:
        return tokens

    to_enrich = [t for t in tokens if t.get("bonding_pct") is None and not t.get("graduated")]
    to_enrich = to_enrich[:max_calls]
    enriched = 0

    for tok in to_enrich:
        mint = tok["mint"]
        try:
            data = fetch_json(f"https://data.solanatracker.io/tokens/{mint}", st_headers(), timeout=8)
        except Exception as e:
            print(f"[st-enrich] {mint[:8]}: {e}", file=sys.stderr)
            time.sleep(0.15)
            continue

        for pool in data.get("pools", []):
            ptype = (pool.get("market") or pool.get("type") or "").lower()
            if "pump" in ptype or pool.get("curve"):
                tok["bonding_pct"] = pool.get("curvePercentage")
                tok["graduated"]   = bool(pool.get("graduated"))
                mc = pool.get("marketCap", {})
                if mc.get("usd"):
                    tok["fdv"] = float(mc["usd"])
                enriched += 1
                break

        time.sleep(0.15)  # ~6 req/s

    print(f"[st-enrich] enriched {enriched}/{len(to_enrich)}", file=sys.stderr)
    return tokens


# ─── Source 4: On-chain enrichment via pump-bonding.mjs + Helius RPC ──────────

def enrich_with_helius(tokens: list[Token]) -> list[Token]:
    """
    Pipe token list through pump-bonding.mjs which calls OnlinePumpSdk.fetchBondingCurveSummary
    for each token missing bonding_pct, using HELIUS_RPC_URL.
    """
    if not HELIUS_RPC_URL or not BONDING_MJS.exists():
        return tokens

    node_bin = "node"
    try:
        subprocess.run([node_bin, "--version"], capture_output=True, check=True, timeout=5)
    except Exception:
        print("[helius] node not found — skipping on-chain enrichment", file=sys.stderr)
        return tokens

    print("[helius] Running pump-bonding.mjs...", file=sys.stderr)
    try:
        env = os.environ.copy()
        env["HELIUS_RPC_URL"] = HELIUS_RPC_URL
        result = subprocess.run(
            [node_bin, str(BONDING_MJS)],
            input=json.dumps(tokens).encode(),
            capture_output=True,
            timeout=90,
            cwd=str(SCRIPT_DIR),
            env=env,
        )
        if result.returncode == 0 and result.stdout.strip():
            enriched = json.loads(result.stdout)
            if isinstance(enriched, list) and len(enriched) == len(tokens):
                print("[helius] on-chain enrichment complete", file=sys.stderr)
                if result.stderr:
                    print(result.stderr.decode(errors="replace"), file=sys.stderr)
                return enriched
        if result.stderr:
            print(result.stderr.decode(errors="replace"), file=sys.stderr)
    except Exception as e:
        print(f"[helius] pump-bonding.mjs error: {e}", file=sys.stderr)

    return tokens


# ─── Merge + deduplicate ──────────────────────────────────────────────────────

def merge_tokens(gt: list[Token], st: list[Token]) -> list[Token]:
    seen: dict[str, Token] = {}

    # Solana Tracker first — has bonding_pct
    for t in st:
        m = t["mint"]
        if m not in seen:
            seen[m] = t

    # GeckoTerminal second — graduated tokens
    for t in gt:
        m = t["mint"]
        if m not in seen:
            seen[m] = t
        else:
            # Merge: GT may have better vol/txns data for graduated tokens
            existing = seen[m]
            if t.get("txns_24h") and not existing.get("txns_24h"):
                existing["txns_24h"] = t["txns_24h"]
            if t.get("vol_24h", 0) > existing.get("vol_24h", 0):
                existing["vol_24h"] = t["vol_24h"]

    merged = list(seen.values())
    merged.sort(key=lambda t: float(t.get("fdv") or 0), reverse=True)
    return merged[:100]


# ─── Classify ─────────────────────────────────────────────────────────────────

def parse_age_minutes(created_at: Any) -> float:
    if not created_at:
        return 9999.0
    try:
        if isinstance(created_at, (int, float)):
            ts = float(created_at) / 1000 if float(created_at) > 1e10 else float(created_at)
            dt = datetime.fromtimestamp(ts, tz=timezone.utc)
        else:
            s = str(created_at).strip()
            if not s:
                return 9999.0
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return max(0.0, (NOW - dt).total_seconds() / 60)
    except Exception:
        return 9999.0


def age_str(minutes: float) -> str:
    if minutes >= 9000:
        return "unknown"
    if minutes < 1:
        return f"{int(minutes * 60)}s"
    if minutes < 60:
        return f"{int(minutes)}m"
    if minutes < 1440:
        return f"{minutes / 60:.1f}h"
    return f"{int(minutes / 1440)}d"


def classify(tok: Token) -> Token:
    mc      = float(tok.get("fdv") or 0)
    bonding = float(tok.get("bonding_pct") or 0)
    age_min = parse_age_minutes(tok.get("pool_created_at"))
    grad    = bool(tok.get("graduated"))

    tok["age_str"] = age_str(age_min)
    tok["age_min"] = age_min

    # Guardrails first
    if grad or bonding >= 100:
        tok["tier"]   = 5 if mc > 100_000 else 4 if mc > 10_000 else 3
        tok["action"] = "SCALP" if mc > 500_000 else "HOLD"
        return tok
    if mc > 1_000_000:
        tok["tier"], tok["action"] = 5, "SKIP"
        return tok
    if bonding >= 90:
        tok["tier"], tok["action"] = 2, "AVOID"
        return tok

    # Decision table (trade.md)
    if age_min <= 5 and mc < 5_000:
        tok["tier"], tok["action"] = 1, "SNIPE"
    elif age_min <= 15 and bonding >= 50:
        tok["tier"], tok["action"] = 1, "BUY"
    elif bonding >= 75:
        tok["tier"], tok["action"] = 2, "BUY"
    elif mc > 500_000 and age_min < 120:
        tok["tier"], tok["action"] = 5, "SCALP"
    elif bonding == 0 and age_min > 1440:
        tok["tier"], tok["action"] = 3, "SKIP"
    elif mc > 100_000:
        tok["tier"], tok["action"] = 5, "HOLD"
    elif mc > 10_000:
        tok["tier"], tok["action"] = 4, "TREND"
    else:
        tok["tier"], tok["action"] = 3, "SPEC"

    return tok


# ─── Format helpers ───────────────────────────────────────────────────────────

def fmt_mc(v: Any) -> str:
    if not v:
        return "N/A"
    v = float(v)
    if v >= 1_000_000:
        return f"${v / 1_000_000:.2f}M"
    if v >= 1_000:
        return f"${v / 1_000:.1f}K"
    return f"${v:.0f}"


def fmt_pct(v: Any) -> str:
    if v is None:
        return "N/A"
    return f"{float(v):.1f}%"


def fmt_chg(v: Any) -> str:
    if v is None:
        return "N/A"
    v = float(v)
    return f"+{v:.1f}%" if v >= 0 else f"{v:.1f}%"


def bonding_display(tok: Token) -> str:
    if tok.get("graduated"):
        return "Graduated ✓"
    if tok.get("bonding_pct") is not None:
        return fmt_pct(tok["bonding_pct"])
    return "N/A"


# ─── Write pump.md ────────────────────────────────────────────────────────────

def write_pump_md(tokens: list[Token]) -> None:
    sorted_tokens = sorted(tokens, key=lambda t: float(t.get("fdv") or 0), reverse=True)

    tiers    = {i: [t for t in tokens if t.get("tier") == i] for i in range(1, 6)}
    near_grad = [t for t in tokens if float(t.get("bonding_pct") or 0) >= 90 and not t.get("graduated")]
    fresh_10m = [t for t in tokens if (t.get("age_min") or 9999) <= 10]
    snipe_buy = [t for t in tokens if t.get("action") in ("SNIPE", "BUY")]
    top5      = sorted_tokens[:5]
    highest   = sorted_tokens[0] if sorted_tokens else {}

    lines: list[str] = [
        "# Pump.fun Token Scanner",
        f"> Last updated: {TIMESTAMP}",
        "> Source: GeckoTerminal pumpswap + Solana Tracker trending + Helius on-chain RPC",
        f"> Tokens found: {len(tokens)}",
        "",
        "## Token List",
        "",
        "| # | Name | Symbol | Mint Address | Market Cap | Age | Bonding% | 24h Vol | 24h Txns | Action |",
        "|---|------|--------|-------------|------------|-----|---------|---------|---------|--------|",
    ]

    for i, t in enumerate(sorted_tokens, 1):
        bp   = bonding_display(t)
        txns = str(t.get("txns_24h", "N/A"))
        lines.append(
            f"| {i} | {t.get('name','?')[:22]} | {t.get('symbol','?')[:10]} "
            f"| `{t.get('mint','?')}` "
            f"| {fmt_mc(t.get('fdv'))} | {t.get('age_str','?')} | {bp} "
            f"| {fmt_mc(t.get('vol_24h'))} | {txns} | **{t.get('action','?')}** |"
        )

    # ── Classification sections ──
    lines += ["", "## Token Classification", ""]

    def tier_block(num: int, title: str, strategy: str) -> None:
        tier_tokens = tiers[num]
        lines.append(f"### {title} — {len(tier_tokens)} tokens")
        lines.append(f"> {strategy}")
        lines.append("")
        if tier_tokens:
            lines += [
                "| Name | Symbol | Mint | MC | Age | Bonding% | Action |",
                "|------|--------|------|----|-----|---------|--------|",
            ]
            for t in sorted(tier_tokens, key=lambda x: float(x.get("fdv") or 0), reverse=True):
                lines.append(
                    f"| {t.get('name','?')[:22]} | {t.get('symbol','?')[:10]} "
                    f"| `{t.get('mint','?')}` "
                    f"| {fmt_mc(t.get('fdv'))} | {t.get('age_str','?')} "
                    f"| {bonding_display(t)} | **{t.get('action','?')}** |"
                )
        lines.append("")

    tier_block(1, "Tier 1 — Fresh Snipers (age ≤ 15m)",
               "Small size, fast flip. 0.05–0.1 SOL. Exit at 2–5× or 10m TTL.")
    tier_block(2, "Tier 2 — Near-Graduation (bonding ≥ 75%)",
               "Medium size, ride graduation pump. Exit before 100% bonding.")
    tier_block(3, "Tier 3 — Micro-Cap (MC < $10K)",
               "Speculative. <0.05 SOL per trade. High risk.")
    tier_block(4, "Tier 4 — Mid-Cap ($10K–$100K)",
               "Trend-follow. Enter on momentum, 1–2% trailing stop.")
    tier_block(5, "Tier 5 — Large-Cap (MC > $100K) / Graduated",
               "Safer entries. Scalps on dips. Tight stops.")

    # ── Trade signals ──
    lines += ["## Trade Signals", ""]
    active = [t for t in tokens if t.get("action") in ("SNIPE", "BUY", "SCALP")]
    if active:
        lines += [
            "| Token | Symbol | MC | Bonding% | Age | Signal | Size |",
            "|-------|--------|----|---------|-----|--------|------|",
        ]
        for t in sorted(active, key=lambda x: float(x.get("fdv") or 0), reverse=True):
            mc_val = float(t.get("fdv") or 0)
            size = "0.05 SOL" if mc_val < 5_000 else "0.1 SOL" if mc_val < 50_000 else "0.2 SOL"
            lines.append(
                f"| {t.get('name','?')[:20]} | {t.get('symbol','?')[:8]} "
                f"| {fmt_mc(t.get('fdv'))} | {bonding_display(t)} "
                f"| {t.get('age_str','?')} | **{t.get('action','?')}** | {size} |"
            )
    else:
        lines.append("> No SNIPE/BUY/SCALP signals this scan.")
    lines.append("")

    # ── Summary ──
    lines += [
        "## Summary",
        f"- Total tokens scanned: {len(tokens)}",
        f"- Timestamp: {TIMESTAMP}",
        f"- Highest market cap: {highest.get('name','?')} ({highest.get('symbol','?')}) — {fmt_mc(highest.get('fdv'))}",
        f"- Near bonding completion (≥90%): {len(near_grad)}",
        f"- Fresh tokens (≤10m old): {len(fresh_10m)}",
        f"- SNIPE/BUY signals: {len(snipe_buy)}",
        f"- Tier breakdown: {len(tiers[1])} T1 | {len(tiers[2])} T2 | {len(tiers[3])} T3 "
        f"| {len(tiers[4])} T4 | {len(tiers[5])} T5",
        "",
        "### Top 5 by Market Cap",
    ]
    for i, t in enumerate(top5, 1):
        lines.append(
            f"{i}. **{t.get('name','?')} ({t.get('symbol','?')})** — "
            f"{fmt_mc(t.get('fdv'))} · {t.get('age_str','?')} old · "
            f"{fmt_chg(t.get('price_chg_24h'))} 24h · {bonding_display(t)} bonding · "
            f"**{t.get('action','?')}**"
        )

    if near_grad:
        lines += ["", "### Near Graduation (≥90% bonding — AVOID)"]
        for t in sorted(near_grad, key=lambda x: float(x.get("bonding_pct") or 0), reverse=True)[:10]:
            lines.append(
                f"- **{t.get('name','?')} ({t.get('symbol','?')})** — "
                f"{fmt_pct(t.get('bonding_pct'))} bonding · {fmt_mc(t.get('fdv'))}"
            )

    if fresh_10m:
        lines += ["", "### Fresh Tokens (≤10m old)"]
        for t in sorted(fresh_10m, key=lambda x: float(x.get("fdv") or 0), reverse=True)[:10]:
            lines.append(
                f"- **{t.get('name','?')} ({t.get('symbol','?')})** — "
                f"{fmt_mc(t.get('fdv'))} · {t.get('age_str','?')} ago · "
                f"{bonding_display(t)} bonding · **{t.get('action','?')}**"
            )

    # ── Data source status ──
    lines += [
        "",
        "## Data Sources",
        "",
        "| Source | Endpoint | Status | Data |",
        "|--------|----------|--------|------|",
        f"| GeckoTerminal | `/networks/solana/dexes/pumpswap/pools` | ✅ no auth | Graduated tokens, MC, vol, txns |",
        f"| Solana Tracker trending | `data.solanatracker.io/tokens/trending` | {'✅ key set' if ST_API_KEY else '⚠️ no key'} | Bonding-curve tokens, curvePercentage |",
        f"| Solana Tracker enrich | `data.solanatracker.io/tokens/{{mint}}` | {'✅ key set' if ST_API_KEY else '⚠️ no key'} | Per-token curvePercentage enrichment |",
        f"| Helius on-chain | `mainnet.helius-rpc.com` (via pump-bonding.mjs) | {'✅ key set' if HELIUS_RPC_URL else '⚠️ no key'} | OnlinePumpSdk.fetchBondingCurveSummary |",
    ]

    PUMP_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[pump-scanner] pump.md written — {len(tokens)} tokens", file=sys.stderr)


# ─── Send Telegram ────────────────────────────────────────────────────────────

def _esc(s: str) -> str:
    """Escape MarkdownV2 special chars."""
    for c in r"\_*[]()~`>#+-=|{}.!":
        s = s.replace(c, f"\\{c}")
    return s


def send_telegram(tokens: list[Token]) -> None:
    sorted_tokens = sorted(tokens, key=lambda t: float(t.get("fdv") or 0), reverse=True)
    top5      = sorted_tokens[:5]
    near_grad = [t for t in tokens if float(t.get("bonding_pct") or 0) >= 90 and not t.get("graduated")]
    fresh_10m = [t for t in tokens if (t.get("age_min") or 9999) <= 10]
    signals   = [t for t in tokens if t.get("action") in ("SNIPE", "BUY", "SCALP")]

    lines = [
        f"🔍 *Pump\\.fun Scan* — {_esc(TIME_SHORT)} UTC",
        f"_{_esc(str(len(tokens)))} tokens scanned_",
        "",
        "📊 *Top 5 by Market Cap*",
    ]
    for i, t in enumerate(top5, 1):
        name   = _esc(f"{t.get('name','?')[:16]} ({t.get('symbol','?')[:8]})")
        mc_str = _esc(fmt_mc(t.get("fdv")))
        chg    = _esc(fmt_chg(t.get("price_chg_24h")))
        bp     = _esc(bonding_display(t))
        action = _esc(t.get("action", "?"))
        lines.append(f"{i}\\. {name} — {mc_str}  {chg}  {bp}  *{action}*")

    if near_grad:
        lines += ["", f"⚡ *Near Graduation \\(≥90% bonding\\)* — {_esc(str(len(near_grad)))} tokens"]
        for t in sorted(near_grad, key=lambda x: float(x.get("bonding_pct") or 0), reverse=True)[:5]:
            name = _esc(f"{t.get('name','?')[:16]} ({t.get('symbol','?')[:8]})")
            bp   = _esc(fmt_pct(t.get("bonding_pct")))
            lines.append(f"• {name} — {bp} — *AVOID*")
    else:
        lines += ["", "⚡ *Near Graduation*: none detected"]

    if fresh_10m:
        lines += ["", f"🆕 *Fresh Tokens \\(≤10m old\\)* — {_esc(str(len(fresh_10m)))} tokens"]
        for t in sorted(fresh_10m, key=lambda x: float(x.get("fdv") or 0), reverse=True)[:5]:
            name   = _esc(f"{t.get('name','?')[:16]} ({t.get('symbol','?')[:8]})")
            mc_str = _esc(fmt_mc(t.get("fdv")))
            age    = _esc(t.get("age_str", "?"))
            action = _esc(t.get("action", "?"))
            lines.append(f"• {name} — {mc_str} · {age} ago — *{action}*")

    if signals:
        lines += ["", f"🎯 *Trade Signals* \\({_esc(str(len(signals)))} active\\)"]
        for t in signals[:6]:
            name   = _esc(f"{t.get('name','?')[:14]} ({t.get('symbol','?')[:6]})")
            mc_str = _esc(fmt_mc(t.get("fdv")))
            action = _esc(t.get("action", "?"))
            lines.append(f"• {name} {mc_str} — *{action}*")

    helius_status = "✅" if HELIUS_RPC_URL else "⚠️"
    st_status     = "✅" if ST_API_KEY else "⚠️"
    lines += [
        "",
        f"🔗 Helius: {_esc(helius_status)}  ST: {_esc(st_status)}",
        f"📁 {_esc(str(len(tokens)))} tokens saved → pump\\.md",
    ]

    message = "\n".join(lines)
    if len(message) > 4000:
        message = message[:3990] + "\n\\.\\.\\."

    payload = json.dumps({
        "chat_id":    TG_CHAT,
        "text":       message,
        "parse_mode": "MarkdownV2",
    }).encode()

    try:
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            resp = json.loads(r.read())
        if resp.get("ok"):
            print(f"[telegram] sent (message_id={resp['result']['message_id']})", file=sys.stderr)
        else:
            print(f"[telegram] API error: {resp}", file=sys.stderr)
            _telegram_plain(tokens)
    except Exception as e:
        print(f"[telegram] MarkdownV2 failed ({e}) — retrying as plain text", file=sys.stderr)
        _telegram_plain(tokens)


def _telegram_plain(tokens: list[Token]) -> None:
    """Fallback plain-text Telegram message."""
    sorted_tokens = sorted(tokens, key=lambda t: float(t.get("fdv") or 0), reverse=True)
    top5 = sorted_tokens[:5]
    lines = [f"Pump.fun Scan — {TIME_SHORT} UTC", f"{len(tokens)} tokens scanned", "", "Top 5 by Market Cap:"]
    for i, t in enumerate(top5, 1):
        lines.append(f"{i}. {t.get('name','?')} ({t.get('symbol','?')}) — {fmt_mc(t.get('fdv'))} {fmt_chg(t.get('price_chg_24h'))} {bonding_display(t)} {t.get('action','?')}")
    lines.append(f"\n{len(tokens)} tokens saved → pump.md")

    payload = json.dumps({"chat_id": TG_CHAT, "text": "\n".join(lines)}).encode()
    try:
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            resp = json.loads(r.read())
        print(f"[telegram] plain fallback: ok={resp.get('ok')}", file=sys.stderr)
    except Exception as e:
        print(f"[telegram] plain fallback also failed: {e}", file=sys.stderr)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    print(f"[pump-scanner] {TIMESTAMP}", file=sys.stderr)

    # 1. Fetch data sources
    gt_tokens  = fetch_geckoterminal()
    st_tokens  = fetch_st_trending()

    # 2. Merge
    tokens = merge_tokens(gt_tokens, st_tokens)
    print(f"[pump-scanner] merged: {len(tokens)} unique tokens", file=sys.stderr)

    # 3. Enrich with Solana Tracker per-token (fills missing bonding_pct)
    tokens = enrich_with_st(tokens, max_calls=30)

    # 4. Enrich with Helius on-chain via pump-bonding.mjs (fills remaining bonding_pct)
    tokens = enrich_with_helius(tokens)

    # 5. Classify
    tokens = [classify(t) for t in tokens]
    has_bonding = sum(1 for t in tokens if t.get("bonding_pct") is not None)
    print(f"[pump-scanner] classified {len(tokens)} tokens, bonding_pct known: {has_bonding}", file=sys.stderr)

    # 6. Write pump.md
    write_pump_md(tokens)

    # 7. Send Telegram
    send_telegram(tokens)


if __name__ == "__main__":
    main()
