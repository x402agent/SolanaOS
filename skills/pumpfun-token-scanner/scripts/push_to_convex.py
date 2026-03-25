#!/usr/bin/env python3
"""
push_to_convex.py — Pushes pump.md scanner data to the nanohub Convex backend.

Reads pump.md, parses the pipe-delimited token table, and POSTs it to the
Convex HTTP endpoint at /solanaos/tracker/pump-ingest.

Usage:
    python3 push_to_convex.py [--source browser|cli|remote-trigger]

The CONVEX_SITE_URL is read from (in order):
    1. /Users/8bit/solanaos/nanohub/.env.local
    2. Environment variable CONVEX_SITE_URL
    3. Fallback: https://artful-frog-940.convex.site
"""
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError

PUMP_MD = os.path.expanduser("/Users/8bit/solanaos/pump.md")
ENV_LOCAL = os.path.expanduser("/Users/8bit/solanaos/nanohub/.env.local")
FALLBACK_URL = "https://artful-frog-940.convex.site"


def load_env_val(key: str) -> str | None:
    """Read a key=value from .env.local."""
    if not os.path.isfile(ENV_LOCAL):
        return None
    with open(ENV_LOCAL) as f:
        for line in f:
            line = line.strip()
            if line.startswith(f"{key}="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def get_convex_url() -> str:
    """Resolve the Convex site URL."""
    url = (
        load_env_val("CONVEX_SITE_URL")
        or load_env_val("VITE_CONVEX_SITE_URL")
        or os.environ.get("CONVEX_SITE_URL")
        or FALLBACK_URL
    )
    return url.rstrip("/")


def parse_pump_md(path: str) -> list[dict]:
    """Parse pump.md pipe-delimited rows into token dicts."""
    if not os.path.isfile(path):
        print(f"ERROR: {path} not found")
        sys.exit(1)

    tokens = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            # Match data rows: "| 1 | Name | SYM | `mint` | $5K | 3m ago | 45% |"
            m = re.match(r"^\|\s*(\d+)\s*\|", line)
            if not m:
                continue
            parts = [c.strip().strip("`") for c in line.strip().strip("|").split("|")]
            if len(parts) < 7:
                continue
            idx, name, sym, mint, mc_raw, age_raw, pct_raw = parts[:7]
            tokens.append(f"{idx}|{name}|{sym}|{mint}|{mc_raw}|{age_raw}|{pct_raw}")

    return tokens


def main():
    source = "browser"
    for arg in sys.argv[1:]:
        if arg.startswith("--source"):
            if "=" in arg:
                source = arg.split("=", 1)[1]
            else:
                idx = sys.argv.index(arg)
                if idx + 1 < len(sys.argv):
                    source = sys.argv[idx + 1]

    rows = parse_pump_md(PUMP_MD)
    if not rows:
        print("ERROR: No token rows found in pump.md")
        sys.exit(1)

    print(f"Parsed {len(rows)} tokens from pump.md")

    convex_url = get_convex_url()
    endpoint = f"{convex_url}/solanaos/tracker/pump-ingest"

    payload = json.dumps({
        "source": source,
        "raw": "\n".join(rows),
        "scannedAt": int(time.time() * 1000),
    }).encode("utf-8")

    req = Request(
        endpoint,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read())
            print(f"✅ Pushed to Convex: {body.get('tokenCount', '?')} tokens")
            if body.get("tiers"):
                t = body["tiers"]
                print(f"   Fresh: {t.get('freshSniper',0)} | Graduating: {t.get('nearGraduation',0)} | "
                      f"Micro: {t.get('microCap',0)} | Mid: {t.get('midCap',0)} | Large: {t.get('largeCap',0)}")
    except URLError as e:
        print(f"⚠️  Convex push failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
