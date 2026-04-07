"""
blocklist_filter.py — Shared platform blocklist filter for all scanner scripts.

Loads blocklist.json and provides a single function to check if a token row
should be excluded. Used by push_to_convex.py, send_telegram.py, send_tweet.py,
and pump_scanner.py.
"""

import json
import os
from pathlib import Path

BLOCKLIST_PATH = Path(__file__).parent.parent / "blocklist.json"

# Fallback hardcoded domains in case blocklist.json is missing
_DEFAULT_BLOCKED = ["rapidlaunch.io", "7tracker.io", "j7tracker.io"]


def load_blocked_domains() -> list[str]:
    """Load all blocked platform domains from blocklist.json."""
    if BLOCKLIST_PATH.is_file():
        try:
            with open(BLOCKLIST_PATH) as f:
                data = json.load(f)
            domains = []
            for platform in data.get("blocked_platforms", []):
                domains.extend(platform.get("domains", []))
                # Also pull from signatures for broader matching
                for sig in platform.get("signatures", []):
                    # Extract domain-like strings from signatures
                    if "." in sig and "/" not in sig:
                        domains.append(sig)
            return list(set(d.lower() for d in domains)) if domains else _DEFAULT_BLOCKED
        except (json.JSONDecodeError, KeyError):
            pass
    return _DEFAULT_BLOCKED


def is_blocked(text: str, blocked_domains: list[str] | None = None) -> bool:
    """
    Check if a text string references any blocked platform.
    
    Args:
        text: Any string to check — token name, description, row text, etc.
        blocked_domains: Optional pre-loaded domain list (avoids re-reading JSON).
    
    Returns:
        True if the text references a blocked platform.
    """
    if blocked_domains is None:
        blocked_domains = load_blocked_domains()
    text_lower = text.lower()
    return any(domain in text_lower for domain in blocked_domains)


def filter_pump_md_rows(rows: list[str]) -> list[str]:
    """
    Filter a list of pipe-delimited pump.md rows, removing any that reference
    blocked platforms. Checks ALL fields in each row.
    
    Args:
        rows: List of strings like "1|Name|SYM|Mint|$5K|3m ago|45%"
    
    Returns:
        Filtered list with blocked tokens removed.
    """
    blocked = load_blocked_domains()
    clean = []
    removed = 0
    for row in rows:
        if is_blocked(row, blocked):
            removed += 1
        else:
            clean.append(row)
    if removed:
        print(f"🚫 Blocklist: removed {removed} tokens from blocked platforms")
    return clean
