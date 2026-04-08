#!/usr/bin/env python3
"""Parse pump.md and POST tokens to Convex pump-ingest endpoint."""

import json, re, sys, urllib.request, os

CONVEX_SITE = os.environ.get("CONVEX_SITE_URL", "https://artful-frog-940.convex.site")
PUMP_MD = os.environ.get("PUMP_MD", os.path.join(os.path.dirname(__file__), "..", "pump.md"))
ENDPOINT = f"{CONVEX_SITE}/solanaos/tracker/pump-ingest"

def parse_mc(raw: str) -> float | None:
    raw = raw.strip().lstrip("$").replace(",", "")
    if not raw or raw == "N/A":
        return None
    if raw.endswith("M"):
        return float(raw[:-1]) * 1e6
    if raw.endswith("K"):
        return float(raw[:-1]) * 1e3
    if raw.endswith("B"):
        return float(raw[:-1]) * 1e9
    try:
        return float(raw)
    except ValueError:
        return None

def parse_age(raw: str) -> int | None:
    raw = raw.strip()
    if not raw or raw == "N/A":
        return None
    m = re.match(r"(\d+)([smhd])\s*ago", raw, re.I)
    if not m:
        return None
    val = int(m.group(1))
    unit = m.group(2).lower()
    return {"s": max(0, val // 60), "m": val, "h": val * 60, "d": val * 1440}[unit]

def classify(mc: float | None, age: int | None, bonding: float | None):
    mc = mc or 0
    age = age if age is not None else 9999
    bonding = bonding or 0
    if bonding >= 90:
        return "near-graduation", "AVOID"
    if age <= 5 and mc < 5000:
        return "fresh-sniper", "SNIPE"
    if age <= 15 and bonding >= 50:
        return "fresh-sniper", "BUY"
    if mc > 1_000_000:
        return "large-cap", "SKIP"
    if mc > 500_000 and age < 120:
        return "large-cap", "SCALP"
    if mc > 100_000:
        return "large-cap", "HOLD"
    if mc > 10_000:
        return "mid-cap", "WATCH"
    return "micro-cap", "SPECULATIVE"

def main():
    md_path = os.path.abspath(PUMP_MD)
    if not os.path.exists(md_path):
        print(f"pump.md not found at {md_path}")
        sys.exit(1)

    with open(md_path) as f:
        lines = f.readlines()

    tokens = []
    row_re = re.compile(r"^\|\s*(\d+)\s*\|")
    for line in lines:
        m = row_re.match(line)
        if not m:
            continue
        cols = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cols) < 7:
            continue
        rank = int(cols[0])
        name = cols[1]
        symbol = cols[2]
        mint = cols[3].strip("`")
        mc_raw = cols[4]
        age_raw = cols[5]
        bonding_raw = cols[6]

        mc = parse_mc(mc_raw)
        age_min = parse_age(age_raw)
        bonding = None
        try:
            bonding = float(bonding_raw.rstrip("%"))
        except (ValueError, AttributeError):
            pass

        tier, action = classify(mc, age_min, bonding)

        token = {
            "rank": rank,
            "name": name,
            "symbol": symbol,
            "mint": mint,
            "tier": tier,
            "action": action,
        }
        if mc is not None:
            token["marketCap"] = mc
        if age_min is not None:
            token["ageMinutes"] = age_min
            token["ageRaw"] = age_raw.strip()
        if bonding is not None:
            token["bondingPct"] = bonding

        tokens.append(token)

    if not tokens:
        print("No tokens parsed from pump.md")
        sys.exit(1)

    source = sys.argv[1] if len(sys.argv) > 1 else "browser"
    payload = json.dumps({
        "source": source,
        "tokens": tokens[:100],
        "scannerAgent": "claude-pump-scanner",
    }).encode()

    print(f"Pushing {len(tokens[:100])} tokens to {ENDPOINT} (source={source})...")

    req = urllib.request.Request(
        ENDPOINT,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read())
            print(f"OK: {json.dumps(body, indent=2)}")
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
