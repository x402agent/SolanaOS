#!/usr/bin/env python3
"""
send_telegram.py — Pump.fun Digest → Telegram

Parses ~/Downloads/nanosolana-go/pump.md and sends a formatted digest to Telegram.
Tries the SolanaOS gateway (localhost:18790) first; falls back to direct Bot API.

Credentials are read from (in order):
  1. ~/Downloads/nanosolana-go/.env
  2. ~/.nanosolana/.env
  3. Environment variables
"""

import os
import re
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
PUMP_MD = Path.home() / "Downloads" / "nanosolana-go" / "pump.md"
ENV_PATHS = [
    Path.home() / "Downloads" / "nanosolana-go" / ".env",
    Path.home() / ".nanosolana" / ".env",
]
GATEWAY_URL = "http://localhost:18790/api/v1/telegram/send"
GATEWAY_TIMEOUT = 3  # seconds — fast fail if gateway isn't running


# ---------------------------------------------------------------------------
# Credential loading
# ---------------------------------------------------------------------------
def load_env_file(path: Path) -> dict:
    env = {}
    try:
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return env


def get_credentials():
    combined = {}
    for p in ENV_PATHS:
        combined.update(load_env_file(p))
    # Shell env overrides file values
    for key in ("TELEGRAM_BOT_TOKEN", "TELEGRAM_ID"):
        if key in os.environ:
            combined[key] = os.environ[key]

    token = combined.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = combined.get("TELEGRAM_ID", "")

    if not token or not chat_id:
        print("ERROR: TELEGRAM_BOT_TOKEN and/or TELEGRAM_ID not found.")
        print("Set them in ~/Downloads/nanosolana-go/.env or export as env vars.")
        sys.exit(1)

    return token, chat_id


# ---------------------------------------------------------------------------
# Parse pump.md
# ---------------------------------------------------------------------------
def parse_pump_md(path: Path) -> dict:
    """Return a dict with keys: timestamp, total, top5, near_grad, fresh."""
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        print(f"ERROR: {path} not found. Run the pump.fun scanner first.")
        sys.exit(1)

    # Timestamp
    ts_match = re.search(r"Last updated:\s*(\S+)", text)
    timestamp = ts_match.group(1) if ts_match else "unknown"

    # Token rows — parse any pipe-delimited table row starting with a number.
    # Handles varying column counts and formats (with/without backticks).
    rows = []
    for line in text.splitlines():
        line_s = line.strip()
        if not line_s.startswith("|"):
            continue
        cells = [c.strip().strip("`") for c in line_s.split("|")]
        cells = [c for c in cells if c != ""]
        if len(cells) < 6:
            continue
        try:
            idx = int(cells[0])
        except ValueError:
            continue
        # Find bonding % — last cell ending with %
        pct = "0%"
        for c in reversed(cells[4:]):
            if c.endswith("%"):
                pct = c
                break
        # Find age — cell matching Xm ago / Xs ago / Xh ago / Xd ago
        age = "N/A"
        for c in cells[4:]:
            if re.match(r"^\d+[smhd]\s+ago$", c, re.I):
                age = c
                break
        rows.append({
            "idx":    idx,
            "name":   cells[1],
            "symbol": cells[2],
            "mint":   cells[3],
            "mc":     cells[4],
            "age":    age,
            "pct":    pct,
        })

    def parse_mc(mc: str) -> float:
        s = mc.replace("$", "").replace(",", "")
        if s.endswith("M"):
            return float(s[:-1]) * 1e6
        if s.endswith("K"):
            return float(s[:-1]) * 1e3
        try:
            return float(s)
        except ValueError:
            return 0.0

    def parse_pct(pct: str) -> float:
        try:
            return float(pct.replace("%", ""))
        except ValueError:
            return 0.0

    def parse_age_minutes(age: str) -> float:
        """Return age in minutes (approx). Returns 9999 if unknown."""
        m = re.match(r"(\d+)([smhd])\s+ago", age, re.I)
        if not m:
            return 9999
        val, unit = int(m.group(1)), m.group(2).lower()
        return {"s": val / 60, "m": val, "h": val * 60, "d": val * 1440}[unit]

    # Sort by MC descending for top 5
    sorted_by_mc = sorted(rows, key=lambda r: parse_mc(r["mc"]), reverse=True)
    top5 = sorted_by_mc[:5]

    # Near graduation: bonding ≥ 90%
    near_grad = [r for r in rows if parse_pct(r["pct"]) >= 90]
    near_grad.sort(key=lambda r: parse_pct(r["pct"]), reverse=True)

    # Fresh tokens: ≤ 10 minutes old
    fresh = [r for r in rows if parse_age_minutes(r["age"]) <= 10]
    fresh.sort(key=lambda r: parse_age_minutes(r["age"]))

    return {
        "timestamp": timestamp,
        "total":     len(rows),
        "top5":      top5,
        "near_grad": near_grad[:5],
        "fresh":     fresh[:5],
    }


# ---------------------------------------------------------------------------
# Format message
# ---------------------------------------------------------------------------
GRAD_EMOJI = {100: "🎓", 90: "🔥", 80: "⚡", 0: "🌱"}


def bonding_emoji(pct_str: str) -> str:
    try:
        v = float(pct_str.replace("%", ""))
    except ValueError:
        return ""
    for threshold, emoji in sorted(GRAD_EMOJI.items(), reverse=True):
        if v >= threshold:
            return emoji
    return ""


def escape_md(text: str) -> str:
    """Escape special chars for Telegram MarkdownV2."""
    for ch in r"\_*[]()~`>#+-=|{}.!":
        text = text.replace(ch, f"\\{ch}")
    return text


def format_message(data: dict) -> str:
    # Parse time for display
    try:
        dt = datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00"))
        time_str = dt.strftime("%H:%M UTC")
    except Exception:
        time_str = data["timestamp"]

    lines = [
        f"🔍 *Pump\\.fun Scan* — {escape_md(time_str)}",
        "",
        f"📊 *Top 5 by Market Cap*",
    ]

    for i, r in enumerate(data["top5"], 1):
        emoji = bonding_emoji(r["pct"])
        name = escape_md(r["name"])
        sym  = escape_md(r["symbol"])
        mc   = escape_md(r["mc"])
        pct  = escape_md(r["pct"])
        lines.append(f"{i}\\. {name} \\({sym}\\) — {mc}  {emoji} {pct}")

    if data["near_grad"]:
        lines += ["", "⚡ *Near Graduation \\(≥90% bonding\\)*"]
        for r in data["near_grad"]:
            name = escape_md(r["name"])
            sym  = escape_md(r["symbol"])
            pct  = escape_md(r["pct"])
            lines.append(f"• {name} \\({sym}\\) — {pct}")

    if data["fresh"]:
        lines += ["", "🆕 *Fresh Tokens \\(≤10m old\\)*"]
        for r in data["fresh"]:
            name = escape_md(r["name"])
            sym  = escape_md(r["symbol"])
            mc   = escape_md(r["mc"])
            age  = escape_md(r["age"])
            lines.append(f"• {name} \\({sym}\\) — {mc} · {age}")

    lines += [
        "",
        f"📁 {escape_md(str(data['total']))} tokens saved → pump\\.md",
    ]

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Send via SolanaOS gateway
# ---------------------------------------------------------------------------
def send_via_gateway(message: str) -> bool:
    """
    Try to POST to the SolanaOS gateway Telegram endpoint.
    Returns True on success, False if gateway is down or returns an error.
    """
    payload = json.dumps({"message": message, "parse_mode": "MarkdownV2"}).encode()
    req = urllib.request.Request(
        GATEWAY_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=GATEWAY_TIMEOUT) as resp:
            if resp.status < 300:
                print(f"✅ Sent via SolanaOS gateway (HTTP {resp.status})")
                return True
            print(f"Gateway returned HTTP {resp.status} — falling back to direct API")
            return False
    except (urllib.error.URLError, OSError) as e:
        print(f"Gateway not reachable ({e}) — using direct Telegram API")
        return False


# ---------------------------------------------------------------------------
# Send via direct Telegram Bot API
# ---------------------------------------------------------------------------
def send_via_telegram_api(token: str, chat_id: str, message: str) -> bool:
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = json.dumps({
        "chat_id":    chat_id,
        "text":       message,
        "parse_mode": "MarkdownV2",
    }).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read())
            if body.get("ok"):
                print("✅ Sent via Telegram Bot API")
                return True
            print(f"Telegram API error: {body}")
            return False
    except Exception as e:
        print(f"ERROR sending via Telegram API: {e}")
        return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    token, chat_id = get_credentials()
    data    = parse_pump_md(PUMP_MD)
    message = format_message(data)

    print(f"Parsed {data['total']} tokens from {PUMP_MD.name}")
    print(f"  Top token: {data['top5'][0]['name']} — {data['top5'][0]['mc']}" if data["top5"] else "")
    print(f"  Near graduation: {len(data['near_grad'])}")
    print(f"  Fresh (≤10m):    {len(data['fresh'])}")

    # Try gateway first, then fall back
    if not send_via_gateway(message):
        ok = send_via_telegram_api(token, chat_id, message)
        if not ok:
            print("❌ Failed to send digest via any route.")
            sys.exit(1)


if __name__ == "__main__":
    main()
