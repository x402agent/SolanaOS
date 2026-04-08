#!/usr/bin/env python3
"""
scanner_cron.py — Automated pump.fun token scanner (no browser needed)

Fetches token data from GeckoTerminal + Solana Tracker APIs,
classifies signals, pushes to Convex, ingests into Honcho memory,
and sends a Telegram digest.

Runs on Railway as a cron job every 30 minutes.

Environment variables (set in Railway dashboard):
  CONVEX_SITE_URL          - Convex HTTP endpoint
  SOLANA_TRACKER_API_KEY   - Solana Tracker data API key
  HONCHO_API_KEY           - Honcho v3 API key
  TELEGRAM_BOT_TOKEN       - Telegram bot token (optional)
  TELEGRAM_CHAT_ID         - Telegram chat ID (optional)
"""
import json
import os
import sys
import time
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import URLError

# ══════════════════════════════════════════════════════════════
# CONFIG
# ══════════════════════════════════════════════════════════════

CONVEX_SITE_URL = os.environ.get("CONVEX_SITE_URL", "https://artful-frog-940.convex.site")
ST_API_KEY = os.environ.get("SOLANA_TRACKER_API_KEY", "")
HONCHO_API_KEY = os.environ.get("HONCHO_API_KEY", "")
HONCHO_WORKSPACE = os.environ.get("HONCHO_PUMPFUN_WORKSPACE_ID", "pumpfun-trading")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
GECKO_PAGES = int(os.environ.get("GECKO_PAGES", "3"))
SOURCE_TAG = "railway-cron"


def log(msg, level="INFO"):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    icons = {"INFO": "ℹ️", "OK": "✅", "WARN": "⚠️", "ERR": "❌", "SKIP": "⏭️"}
    print(f"[{ts}] {icons.get(level, '•')} {msg}", flush=True)


def http_json(url, headers=None, method="GET", body=None, timeout=15):
    req = Request(url, method=method)
    req.add_header("User-Agent", "SolanaOS-Scanner/5.0 (+https://solanaos.net)")
    req.add_header("Accept", "application/json")
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    if body:
        data = json.dumps(body).encode() if isinstance(body, dict) else body
        req.data = data
        if not headers or "Content-Type" not in headers:
            req.add_header("Content-Type", "application/json")
    resp = urlopen(req, timeout=timeout)
    return json.loads(resp.read())


# ══════════════════════════════════════════════════════════════
# STEP 1: FETCH TOKENS FROM GECKOTERMINAL
# ══════════════════════════════════════════════════════════════

def fetch_geckoterminal(pages=3):
    """Fetch PumpSwap pools from GeckoTerminal (free, no key needed)."""
    log(f"Fetching {pages} pages from GeckoTerminal...")
    tokens = []
    seen = set()

    for page in range(1, pages + 1):
        try:
            url = (
                f"https://api.geckoterminal.com/api/v2/networks/solana/dexes/pumpswap/pools"
                f"?sort=h24_tx_count_desc&page={page}&include=base_token"
            )
            data = http_json(url, timeout=20)

            # Build token name/symbol map from included
            token_map = {}
            for inc in data.get("included", []):
                if inc.get("type") == "token":
                    addr = inc.get("id", "").replace("solana_", "")
                    token_map[addr] = {
                        "name": inc.get("attributes", {}).get("name", ""),
                        "symbol": inc.get("attributes", {}).get("symbol", ""),
                    }

            for pool in data.get("data", []):
                attrs = pool.get("attributes", {})
                base_id = pool.get("relationships", {}).get("base_token", {}).get("data", {}).get("id", "")
                mint = base_id.replace("solana_", "")
                if not mint or mint in seen:
                    continue
                seen.add(mint)

                mc_raw = attrs.get("market_cap_usd") or attrs.get("fdv_usd")
                mc = float(mc_raw) if mc_raw else None
                vol_raw = (attrs.get("volume_usd") or {}).get("h24")
                vol = float(vol_raw) if vol_raw else None
                change_raw = (attrs.get("price_change_percentage") or {}).get("h24")
                change = float(change_raw) if change_raw else None
                liq_raw = attrs.get("reserve_in_usd")
                liq = float(liq_raw) if liq_raw else None

                created = attrs.get("pool_created_at")
                age_min = None
                if created:
                    try:
                        created_ts = datetime.fromisoformat(created.replace("Z", "+00:00")).timestamp()
                        age_min = round((time.time() - created_ts) / 60)
                    except (ValueError, TypeError):
                        pass

                info = token_map.get(mint, {"name": "", "symbol": ""})
                tokens.append({
                    "rank": len(tokens) + 1,
                    "name": info["name"],
                    "symbol": info["symbol"],
                    "mint": mint,
                    "marketCap": mc,
                    "fdv": None,
                    "volume24h": vol,
                    "priceChange24h": change,
                    "liquidity": liq,
                    "ageMinutes": age_min,
                    "bondingPct": None,
                    "tier": "",
                    "action": "",
                })

            if page < pages:
                time.sleep(2.2)  # GeckoTerminal rate limit

        except Exception as e:
            log(f"GeckoTerminal page {page} error: {e}", "WARN")
            break

    log(f"GeckoTerminal: {len(tokens)} tokens fetched", "OK")
    return tokens


# ══════════════════════════════════════════════════════════════
# STEP 2: ENRICH WITH SOLANA TRACKER
# ══════════════════════════════════════════════════════════════

def enrich_solana_tracker(tokens):
    """Enrich with Solana Tracker trending + token data."""
    if not ST_API_KEY:
        log("No SOLANA_TRACKER_API_KEY — skipping enrichment", "SKIP")
        return tokens

    headers = {"x-api-key": ST_API_KEY}
    trending_mints = set()

    # Fetch trending
    try:
        data = http_json("https://data.solanatracker.io/tokens/trending", headers=headers, timeout=8)
        for t in data or []:
            mint = t.get("token", {}).get("mint") or t.get("mint", "")
            if mint:
                trending_mints.add(mint)
        log(f"Solana Tracker: {len(trending_mints)} trending tokens", "OK")
    except Exception as e:
        log(f"Solana Tracker trending error: {e}", "WARN")

    # Enrich top 20 with detailed data
    top_mints = [t["mint"] for t in tokens[:20] if t["mint"]]
    enriched = 0
    for mint in top_mints:
        try:
            data = http_json(
                f"https://data.solanatracker.io/tokens/{mint}",
                headers=headers, timeout=6
            )
            pool = (data.get("pools") or [{}])[0] if data else {}
            t = next((tok for tok in tokens if tok["mint"] == mint), None)
            if t and pool:
                vol = pool.get("volume", {}).get("h24")
                if vol and not t["volume24h"]:
                    t["volume24h"] = float(vol)
                chg = pool.get("priceChange", {}).get("h24")
                if chg is not None and t["priceChange24h"] is None:
                    t["priceChange24h"] = float(chg)
                liq = pool.get("liquidity", {}).get("usd")
                if liq and not t["liquidity"]:
                    t["liquidity"] = float(liq)
                enriched += 1
            time.sleep(0.3)  # Rate limit
        except Exception:
            pass

    # Mark trending
    for t in tokens:
        if t["mint"] in trending_mints:
            t["trending"] = True

    log(f"Solana Tracker: enriched {enriched} tokens, {len(trending_mints)} marked trending", "OK")
    return tokens


# ══════════════════════════════════════════════════════════════
# STEP 3: CLASSIFY SIGNALS (TRADE.md decision table)
# ══════════════════════════════════════════════════════════════

def classify_tokens(tokens):
    """Apply TRADE.md decision table to classify signals and tiers."""
    for t in tokens:
        mc = t["marketCap"] or 0
        age = t["ageMinutes"] if t["ageMinutes"] is not None else 9999
        bond = t.get("bondingPct") or 0

        # Signal classification
        if bond >= 90:
            t["tier"], t["action"] = "near-graduation", "AVOID"
        elif age <= 5 and mc < 5000:
            t["tier"], t["action"] = "fresh-sniper", "SNIPE"
        elif age <= 15 and bond >= 50:
            t["tier"], t["action"] = "fresh-sniper", "BUY"
        elif mc > 500000 and age < 120:
            t["tier"], t["action"] = "large-cap", "SCALP"
        elif mc > 1000000:
            t["tier"], t["action"] = "large-cap", "SKIP"
        elif mc > 100000:
            t["tier"], t["action"] = "large-cap", "HOLD"
        elif mc > 10000:
            t["tier"], t["action"] = "mid-cap", "WATCH"
        elif age <= 15:
            t["tier"], t["action"] = "fresh-sniper", "SNIPE"
        else:
            t["tier"], t["action"] = "micro-cap", "SPECULATIVE"

    return tokens


# ══════════════════════════════════════════════════════════════
# STEP 4: PUSH TO CONVEX
# ══════════════════════════════════════════════════════════════

def push_to_convex(tokens):
    """Push classified tokens to Convex for the frontend terminal."""
    log("Pushing to Convex...")
    url = f"{CONVEX_SITE_URL}/solanaos/tracker/pump-ingest"

    # Build pipe-delimited rows (same format push_to_convex.py uses)
    rows = []
    for t in tokens[:100]:
        age_str = ""
        if t["ageMinutes"] is not None:
            m = t["ageMinutes"]
            if m < 60:
                age_str = f"{m}m ago"
            elif m < 1440:
                age_str = f"{m // 60}h ago"
            else:
                age_str = f"{m // 1440}d ago"

        mc_str = ""
        mc = t["marketCap"] or 0
        if mc >= 1e6:
            mc_str = f"${mc / 1e6:.1f}M"
        elif mc >= 1e3:
            mc_str = f"${mc / 1e3:.1f}K"
        else:
            mc_str = f"${mc:.0f}"

        bond = t.get("bondingPct")
        bond_str = f"{bond:.2f}%" if bond is not None else "0.00%"

        row = f"{t['rank']}|{t['name']}|{t['symbol']}|{t['mint']}|{mc_str}|{age_str}|{bond_str}"
        rows.append(row)

    payload = {
        "source": SOURCE_TAG,
        "raw": "\n".join(rows),
        "scannedAt": int(time.time() * 1000),
    }

    try:
        result = http_json(url, method="POST", body=payload, timeout=15)
        count = result.get("tokenCount", 0)
        tiers = result.get("tiers", {})
        log(f"Convex: {count} tokens pushed | fresh={tiers.get('freshSniper', 0)} grad={tiers.get('nearGraduation', 0)} micro={tiers.get('microCap', 0)} mid={tiers.get('midCap', 0)} large={tiers.get('largeCap', 0)}", "OK")
        return True
    except Exception as e:
        log(f"Convex push failed: {e}", "ERR")
        return False


# ══════════════════════════════════════════════════════════════
# STEP 5: INGEST INTO HONCHO MEMORY
# ══════════════════════════════════════════════════════════════

def ingest_honcho(tokens):
    """Feed scan data into Honcho epistemological memory."""
    if not HONCHO_API_KEY:
        log("No HONCHO_API_KEY — skipping memory ingest", "SKIP")
        return False

    try:
        from honcho import Honcho

        honcho = Honcho(workspace_id=HONCHO_WORKSPACE, api_key=HONCHO_API_KEY)
        scanner = honcho.peer("scanner")
        analyst = honcho.peer("analyst")

        now = datetime.now(timezone.utc)
        session_id = f"cron-{now.strftime('%Y%m%d-%H%M')}"
        session = honcho.session(session_id)
        session.add_peers([scanner, analyst])

        # Build messages
        messages = []
        total_mc = sum(t["marketCap"] or 0 for t in tokens)
        fresh = [t for t in tokens if (t["ageMinutes"] or 999) <= 15]
        graduating = [t for t in tokens if (t.get("bondingPct") or 0) >= 90]
        snipes = [t for t in tokens if t["action"] in ("SNIPE", "BUY")]
        scalps = [t for t in tokens if t["action"] == "SCALP"]

        overview = (
            f"AUTOMATED SCAN {now.strftime('%Y-%m-%d %H:%M UTC')} (source: {SOURCE_TAG})\n"
            f"Tokens: {len(tokens)} | Total MC: ${total_mc:,.0f}\n"
            f"Fresh: {len(fresh)} | Graduating: {len(graduating)} | Snipe targets: {len(snipes)} | Scalp targets: {len(scalps)}\n"
            f"Top by MC: {tokens[0]['name']} ({tokens[0]['symbol']}) ${tokens[0]['marketCap'] or 0:,.0f}"
        )
        messages.append(scanner.message(overview))

        if snipes:
            msg = "ACTIVE SIGNALS:\n"
            for t in snipes[:8]:
                msg += f"  {t['action']} {t['symbol']} | MC ${t['marketCap'] or 0:,.0f} | Age {t['ageMinutes'] or '?'}m | Bond {t.get('bondingPct', 0):.1f}%\n"
            messages.append(scanner.message(msg))

        if graduating:
            msg = "AVOID — GRADUATING:\n"
            for t in graduating:
                msg += f"  {t['symbol']} | Bond {t.get('bondingPct', 0):.1f}% — liquidity migration risk\n"
            messages.append(scanner.message(msg))

        # Compressed data dump
        lines = [f"{t['rank']}|{t['symbol']}|${t['marketCap'] or 0:,.0f}|{t['action']}" for t in tokens]
        for i in range(0, len(lines), 25):
            chunk = "\n".join(lines[i:i + 25])
            messages.append(scanner.message(f"DATA {i + 1}-{min(i + 25, len(tokens))}:\n{chunk}"))

        messages.append(analyst.message(
            f"Automated scan ingested: {len(tokens)} tokens, {len(snipes)} actionable signals. Updating market model."
        ))

        session.add_messages(messages)
        log(f"Honcho: {len(messages)} messages → session '{session_id}'", "OK")
        return True
    except ImportError:
        log("honcho-ai not installed — pip install honcho-ai", "WARN")
        return False
    except Exception as e:
        log(f"Honcho ingest failed: {e}", "ERR")
        return False


# ══════════════════════════════════════════════════════════════
# STEP 6: TELEGRAM DIGEST
# ══════════════════════════════════════════════════════════════

def send_telegram(tokens):
    """Send a compact digest to Telegram."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        log("No Telegram creds — skipping", "SKIP")
        return False

    now = datetime.now(timezone.utc).strftime("%H:%M UTC")
    snipes = [t for t in tokens if t["action"] in ("SNIPE", "BUY")]
    scalps = [t for t in tokens if t["action"] == "SCALP"]
    top = sorted(tokens, key=lambda t: t["marketCap"] or 0, reverse=True)[:3]

    lines = [f"🔫 *Pump Scanner* — {now}", f"Tokens: {len(tokens)} | Signals: {len(snipes)} snipe, {len(scalps)} scalp", ""]

    if snipes:
        lines.append("*Snipe/Buy Targets:*")
        for t in snipes[:5]:
            mc = t["marketCap"] or 0
            mc_s = f"${mc / 1e3:.1f}K" if mc < 1e6 else f"${mc / 1e6:.1f}M"
            lines.append(f"  `{t['symbol']}` {mc_s} — {t['action']}")
        lines.append("")

    lines.append("*Top 3 by MC:*")
    for t in top:
        mc = t["marketCap"] or 0
        mc_s = f"${mc / 1e3:.1f}K" if mc < 1e6 else f"${mc / 1e6:.1f}M"
        lines.append(f"  `{t['symbol']}` {mc_s}")

    text = "\n".join(lines)

    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {"chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode": "Markdown"}
        http_json(url, method="POST", body=payload, timeout=10)
        log("Telegram digest sent", "OK")
        return True
    except Exception as e:
        log(f"Telegram failed: {e}", "WARN")
        return False


# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════

def main():
    start = time.time()
    log("═══ PUMP SCANNER CRON ═══")
    log(f"Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    log(f"Source: {SOURCE_TAG}")
    print()

    # 1. Fetch
    tokens = fetch_geckoterminal(GECKO_PAGES)
    if not tokens:
        log("No tokens fetched — aborting", "ERR")
        sys.exit(1)

    # 2. Enrich
    tokens = enrich_solana_tracker(tokens)

    # 3. Classify
    tokens = classify_tokens(tokens)

    # 4. Push to Convex (site goes live immediately)
    convex_ok = push_to_convex(tokens)

    # 5. Honcho memory
    honcho_ok = ingest_honcho(tokens)

    # 6. Telegram
    telegram_ok = send_telegram(tokens)

    # Summary
    elapsed = time.time() - start
    print()
    log("═══ SUMMARY ═══")
    log(f"  Tokens: {len(tokens)}")
    log(f"  Convex: {'✅' if convex_ok else '❌'}")
    log(f"  Honcho: {'✅' if honcho_ok else '⏭️'}")
    log(f"  Telegram: {'✅' if telegram_ok else '⏭️'}")
    log(f"  Time: {elapsed:.1f}s")
    log("═══ DONE ═══")


if __name__ == "__main__":
    main()
