#!/usr/bin/env python3
"""
honcho_memory.py — Pumpfun Trading Memory Bank (Honcho v3)

Epistemological memory system that:
- Ingests each scan as a session with structured market observations
- Builds persistent representations of token patterns, market regimes, and trade outcomes
- Learns from historical data to improve signal quality over time
- Provides recall via chat queries ("which tokens pumped after graduating?")

Peers:
  scanner  — The data source (pump.fun scraper). Sends market observations.
  trader   — The trading agent. Sends trade decisions, outcomes, and reflections.
  analyst  — Meta-peer that reasons about scanner+trader patterns.

Usage:
  # After scan — ingest pump.md data into Honcho
  python3 honcho_memory.py ingest

  # After trade — record a trade outcome
  python3 honcho_memory.py trade --mint <MINT> --action BUY --entry 0.10 --outcome +45%

  # Query memory — ask the analyst what it's learned
  python3 honcho_memory.py query "which token tiers have the best hit rate?"

  # Get context — retrieve formatted context for the trading agent
  python3 honcho_memory.py context

  # Reflect — force the analyst to synthesize learnings
  python3 honcho_memory.py reflect
"""
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SCRIPTS_DIR = Path(__file__).parent
PROJECT_ROOT = Path(os.path.expanduser("~/Downloads/nanosolana-go"))
PUMP_MD = PROJECT_ROOT / "pump.md"
ENV_FILE = PROJECT_ROOT / ".env"

def load_env():
    env = {}
    for f in [ENV_FILE, PROJECT_ROOT / "nanohub" / ".env.local"]:
        if f.is_file():
            with open(f) as fh:
                for line in fh:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        env[k.strip()] = v.strip().strip("\"'")
    return env

ENV = load_env()
HONCHO_API_KEY = ENV.get("HONCHO_API_KEY", os.environ.get("HONCHO_API_KEY", ""))
WORKSPACE_ID = ENV.get("HONCHO_PUMPFUN_WORKSPACE_ID", "pumpfun-trading")

if not HONCHO_API_KEY:
    print("ERROR: HONCHO_API_KEY not set in .env or environment")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Honcho client
# ---------------------------------------------------------------------------

from honcho import Honcho

honcho = Honcho(
    workspace_id=WORKSPACE_ID,
    api_key=HONCHO_API_KEY,
)

# Peers
scanner_peer = honcho.peer("scanner")
trader_peer = honcho.peer("trader")
analyst_peer = honcho.peer("analyst")

# ---------------------------------------------------------------------------
# Parse pump.md
# ---------------------------------------------------------------------------

def parse_pump_md():
    if not PUMP_MD.exists():
        print(f"ERROR: {PUMP_MD} not found")
        sys.exit(1)

    text = PUMP_MD.read_text()
    tokens = []
    for line in text.split("\n"):
        m = re.match(
            r"\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*`?([\w.]+)`?\s*\|\s*\$([\d.,]+[KMB]?)\s*\|\s*(.*?)\s*\|\s*([\d.]+)%\s*\|",
            line,
        )
        if not m:
            continue
        rank, name, symbol, mint, mc_str, age, bonding = m.groups()
        # Parse market cap
        mc_str = mc_str.replace(",", "")
        mc = float(mc_str.rstrip("KMB"))
        if mc_str.endswith("M"):
            mc *= 1_000_000
        elif mc_str.endswith("K"):
            mc *= 1_000
        elif mc_str.endswith("B"):
            mc *= 1_000_000_000

        tokens.append({
            "rank": int(rank),
            "name": name.strip(),
            "symbol": symbol.strip(),
            "mint": mint.strip(),
            "marketCap": mc,
            "age": age.strip(),
            "bondingPct": float(bonding),
        })
    return tokens

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_ingest():
    """Ingest pump.md scan data into Honcho as a scanner session."""
    tokens = parse_pump_md()
    if not tokens:
        print("No tokens found in pump.md")
        return

    now = datetime.now(timezone.utc)
    session_id = f"scan-{now.strftime('%Y%m%d-%H%M')}"
    session = honcho.session(session_id)
    session.add_peers([scanner_peer, analyst_peer])

    # Build structured market observation messages
    messages = []

    # Overview message
    total_mc = sum(t["marketCap"] for t in tokens)
    fresh = [t for t in tokens if "m ago" in t["age"] and int(re.search(r"(\d+)", t["age"]).group()) <= 15]
    graduating = [t for t in tokens if t["bondingPct"] >= 90]
    avg_bond = sum(t["bondingPct"] for t in tokens) / len(tokens)

    overview = (
        f"SCAN REPORT {now.strftime('%Y-%m-%d %H:%M UTC')}\n"
        f"Tokens: {len(tokens)} | Total MC: ${total_mc:,.0f}\n"
        f"Fresh (≤15m): {len(fresh)} | Graduating (≥90% bond): {len(graduating)}\n"
        f"Avg bonding: {avg_bond:.1f}%\n"
        f"Top token: {tokens[0]['name']} ({tokens[0]['symbol']}) at ${tokens[0]['marketCap']:,.0f}"
    )
    messages.append(scanner_peer.message(overview))

    # Fresh sniper targets
    if fresh:
        fresh_msg = "FRESH SNIPER TARGETS:\n"
        for t in fresh[:10]:
            fresh_msg += f"  {t['symbol']} | MC ${t['marketCap']:,.0f} | Age {t['age']} | Bond {t['bondingPct']:.1f}% | Mint: {t['mint'][:12]}...\n"
        messages.append(scanner_peer.message(fresh_msg))

    # Graduating tokens (risk alerts)
    if graduating:
        grad_msg = "GRADUATING / HIGH-RISK TOKENS:\n"
        for t in graduating:
            grad_msg += f"  {t['symbol']} | MC ${t['marketCap']:,.0f} | Bond {t['bondingPct']:.1f}% — AVOID (liquidity migration imminent)\n"
        messages.append(scanner_peer.message(grad_msg))

    # Large caps (potential scalps)
    large = [t for t in tokens if t["marketCap"] >= 100_000]
    if large:
        large_msg = "LARGE-CAP MOVERS (≥$100K):\n"
        for t in large[:10]:
            large_msg += f"  {t['symbol']} | MC ${t['marketCap']:,.0f} | Bond {t['bondingPct']:.1f}%\n"
        messages.append(scanner_peer.message(large_msg))

    # Full token dump (compressed)
    token_lines = [f"{t['rank']}|{t['symbol']}|${t['marketCap']:,.0f}|{t['age']}|{t['bondingPct']:.1f}%" for t in tokens]
    chunk_size = 25
    for i in range(0, len(token_lines), chunk_size):
        chunk = "\n".join(token_lines[i:i + chunk_size])
        messages.append(scanner_peer.message(f"TOKEN DATA (rows {i+1}-{min(i+chunk_size, len(tokens))}):\n{chunk}"))

    # Analyst reflection prompt
    messages.append(analyst_peer.message(
        f"Scan ingested: {len(tokens)} tokens, {len(fresh)} fresh, {len(graduating)} graduating. "
        f"Avg bonding {avg_bond:.1f}%. I'll reason about patterns and update my model."
    ))

    session.add_messages(messages)
    print(f"Ingested {len(tokens)} tokens into Honcho session '{session_id}' ({len(messages)} messages)")
    print(f"  Workspace: {WORKSPACE_ID}")
    print(f"  Fresh targets: {len(fresh)}")
    print(f"  Graduating: {len(graduating)}")
    print(f"  Large caps: {len(large)}")


def cmd_trade(mint, action, entry_sol, outcome, notes=""):
    """Record a trade outcome for learning."""
    now = datetime.now(timezone.utc)
    session_id = f"trade-{now.strftime('%Y%m%d-%H%M%S')}"
    session = honcho.session(session_id)
    session.add_peers([trader_peer, analyst_peer])

    trade_msg = (
        f"TRADE EXECUTED:\n"
        f"  Mint: {mint}\n"
        f"  Action: {action}\n"
        f"  Entry size: {entry_sol} SOL\n"
        f"  Outcome: {outcome}\n"
        f"  Time: {now.strftime('%Y-%m-%d %H:%M UTC')}"
    )
    if notes:
        trade_msg += f"\n  Notes: {notes}"

    messages = [
        trader_peer.message(trade_msg),
        analyst_peer.message(
            f"Recorded trade: {action} on {mint[:12]}... at {entry_sol} SOL → {outcome}. "
            "I'll incorporate this into my pattern analysis."
        ),
    ]
    session.add_messages(messages)
    print(f"Trade recorded in session '{session_id}'")


def cmd_query(question):
    """Query the analyst for insights from accumulated memory."""
    response = analyst_peer.chat(question)
    print(f"\n{'='*60}")
    print(f"HONCHO ANALYST — {WORKSPACE_ID}")
    print(f"{'='*60}")
    print(f"Q: {question}")
    print(f"{'─'*60}")
    print(response)
    print(f"{'='*60}\n")


def cmd_context():
    """Get formatted context for the trading agent's next decision."""
    context = analyst_peer.chat(
        "Summarize what you know about the pumpfun token market from all scans so far. "
        "Focus on: (1) which token tiers tend to perform best, (2) bonding curve patterns "
        "that predict graduation, (3) any recurring token names or themes, (4) risk patterns "
        "to avoid. Format as concise bullet points for a trading agent."
    )
    print(context)


def cmd_reflect():
    """Force a reflection session where the analyst synthesizes learnings."""
    session_id = f"reflect-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}"
    session = honcho.session(session_id)
    session.add_peers([analyst_peer])

    messages = [
        analyst_peer.message(
            "REFLECTION SESSION: Review all scanner data and trade outcomes. "
            "What patterns am I seeing? What's my current model of the pumpfun market? "
            "What signals are most predictive? What should I watch for next?"
        ),
    ]
    session.add_messages(messages)

    response = analyst_peer.chat(
        "Based on everything you've observed, what are the 5 most important things "
        "you've learned about trading pumpfun tokens? Be specific with data."
    )
    print(f"\n{'='*60}")
    print("ANALYST REFLECTION")
    print(f"{'='*60}")
    print(response)
    print(f"{'='*60}\n")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        print("Usage: honcho_memory.py <command> [args]")
        print("Commands: ingest, trade, query, context, reflect")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "ingest":
        cmd_ingest()

    elif cmd == "trade":
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("cmd")
        parser.add_argument("--mint", required=True)
        parser.add_argument("--action", required=True)
        parser.add_argument("--entry", type=float, required=True)
        parser.add_argument("--outcome", required=True)
        parser.add_argument("--notes", default="")
        args = parser.parse_args()
        cmd_trade(args.mint, args.action, args.entry, args.outcome, args.notes)

    elif cmd == "query":
        if len(sys.argv) < 3:
            print("Usage: honcho_memory.py query \"your question here\"")
            sys.exit(1)
        cmd_query(" ".join(sys.argv[2:]))

    elif cmd == "context":
        cmd_context()

    elif cmd == "reflect":
        cmd_reflect()

    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    main()
