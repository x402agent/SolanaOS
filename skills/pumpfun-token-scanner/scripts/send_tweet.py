#!/usr/bin/env python3
"""
Reads pump.md, picks 2 fresh snipers + 2 top movers + 1 highest MC,
formats a tweet (<= 280 chars), writes to tweet_draft.txt.
"""
import os, re, sys
from datetime import datetime, timezone

# Platform blocklist filter
try:
    from blocklist_filter import is_blocked, load_blocked_domains
except ImportError:
    import sys as _sys
    _sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from blocklist_filter import is_blocked, load_blocked_domains

PUMP_MD   = os.path.expanduser('~/Downloads/nanosolana-go/pump.md')
DRAFT_OUT = os.path.expanduser('~/Downloads/nanosolana-go/tweet_draft.txt')

def parse_mc(mc):
    s = mc.replace('$','').replace(',','')
    if s.endswith('M'): return float(s[:-1]) * 1e6
    if s.endswith('K'): return float(s[:-1]) * 1e3
    try:    return float(s)
    except: return 0.0

def parse_age_min(age):
    if not age or age == 'N/A': return None
    m = re.match(r'^(\d+)s ago$', age);  
    if m: return int(m.group(1)) / 60.0
    m = re.match(r'^(\d+)m ago$', age);  
    if m: return float(m.group(1))
    m = re.match(r'^(\d+)h ago$', age);  
    if m: return float(m.group(1)) * 60
    m = re.match(r'^(\d+)d ago$', age);  
    if m: return float(m.group(1)) * 1440
    return None

def parse_pct(pct):
    try:   return float(pct.replace('%',''))
    except: return 0.0

# ── Parse pump.md ──────────────────────────────────────────────────────────────
tokens = []
try:
    with open(PUMP_MD, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line.startswith('|') or '---' in line:
                continue
            parts = [p.strip() for p in line.split('|')]
            parts = [p for p in parts if p]
            if len(parts) < 7: continue
            try: int(parts[0])
            except ValueError: continue
            idx, name, sym, mint, mc, age, pct = parts[:7]
            tokens.append({
                'name':    name,
                'sym':     sym,
                'mint':    mint.strip('`').strip(),
                'mc':      mc,
                'mc_val':  parse_mc(mc),
                'age':     age,
                'age_min': parse_age_min(age),
                'pct_val': parse_pct(pct),
                'pct':     pct,
            })
except FileNotFoundError:
    print(f"ERROR: {PUMP_MD} not found", file=sys.stderr); sys.exit(1)

if not tokens:
    print("ERROR: no tokens parsed", file=sys.stderr); sys.exit(1)

# ── Platform blocklist filter ──────────────────────────────────────────────────
_blocked = load_blocked_domains()
_pre = len(tokens)
tokens = [t for t in tokens if not is_blocked(f"{t['name']} {t['sym']}", _blocked)]
if _pre != len(tokens):
    print(f"🚫 Blocklist: filtered {_pre - len(tokens)} tokens from blocked platforms")

# ── Pick tokens ────────────────────────────────────────────────────────────────
# 2 fresh snipers: age ≤ 10 min, youngest first
fresh = sorted(
    [t for t in tokens if t['age_min'] is not None and t['age_min'] <= 10],
    key=lambda t: t['age_min']
)[:2]

used = {t['mint'] for t in fresh}

# 2 top movers: highest % gain, not already selected
movers = sorted(
    [t for t in tokens if t['mint'] not in used],
    key=lambda t: -t['pct_val']
)[:2]
used |= {t['mint'] for t in movers}

# 1 top MC: highest market cap, not already selected
top_mc_list = sorted(
    [t for t in tokens if t['mint'] not in used],
    key=lambda t: -t['mc_val']
)[:1]

# ── Format helpers ─────────────────────────────────────────────────────────────
def label(t, maxlen=16):
    s = t['sym'] if len(t['sym']) <= 8 else t['sym'][:7]+'…'
    n = t['name']
    raw = f"{s} ({n})"
    return raw if len(raw) <= maxlen else raw[:maxlen-1]+'…'

def age_str(t):
    m = t['age_min']
    if m is None: return ''
    return f"{int(m*60)}s" if m < 1 else f"{int(m)}m"

def pct_short(t):
    v = t['pct_val']
    return f"{v:.0f}%" if v >= 10 else f"{v:.1f}%"

# ── Build tweet ────────────────────────────────────────────────────────────────
now_utc = datetime.now(timezone.utc).strftime('%H:%M UTC')
parts = [f"🔍 pump.fun — {now_utc}", ""]

if fresh:
    parts.append("⚡ Fresh")
    for t in fresh:
        a = age_str(t)
        parts.append(f"• {label(t)} {t['mc']}{' ·'+a if a else ''}")
    parts.append("")

if movers:
    parts.append("🚀 Movers")
    for t in movers:
        parts.append(f"• {label(t)} {t['mc']} +{pct_short(t)}")
    parts.append("")

if top_mc_list:
    t = top_mc_list[0]
    parts.append(f"👑 {label(t)} {t['mc']}")
    parts.append("")

parts.append("not financial advice, -claude")

tweet = '\n'.join(parts).rstrip()

# Safety net: if still over 280 drop the last non-footer line
while len(tweet) > 280:
    lines = tweet.split('\n')
    # find last data line before footer
    for i in range(len(lines)-2, 0, -1):
        if lines[i].startswith('•'):
            lines.pop(i)
            break
    tweet = '\n'.join(lines).rstrip()
    if len(tweet) <= 280:
        break

print(f"Tweet ({len(tweet)} chars):\n")
print(tweet)

with open(DRAFT_OUT, 'w', encoding='utf-8') as f:
    f.write(tweet)

print(f"\n→ {DRAFT_OUT}")
