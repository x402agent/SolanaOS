#!/usr/bin/env bash
# scripts/pump-scanner.sh — Pump.fun real-time token scanner
#
# Sources (in priority order):
#   1. GeckoTerminal pumpswap pools      — top 100 graduated tokens by 24h tx count
#   2. Solana Tracker Data API           — trending bonding-curve tokens + curvePercentage
#   3. pump-bonding.mjs + Helius RPC     — on-chain BondingCurve account enrichment
#
# Outputs:  pump.md  |  Telegram digest  |  git commit + push
#
# Env vars used:
#   HELIUS_API_KEY / HELIUS_RPC_URL
#   SOLANA_TRACKER_API_KEY / SOLANA_TRACKER_RPC_URL
#   TELEGRAM_BOT_TOKEN / TELEGRAM_ID

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ─── Load .env ────────────────────────────────────────────────────────────────
if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
fi

# Build Helius RPC URL if only key is set
if [[ -z "${HELIUS_RPC_URL:-}" ]] && [[ -n "${HELIUS_API_KEY:-}" ]]; then
  export HELIUS_RPC_URL="https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}"
fi

# Export for child scripts
export HELIUS_RPC_URL="${HELIUS_RPC_URL:-}"
export HELIUS_API_KEY="${HELIUS_API_KEY:-}"
export SOLANA_TRACKER_API_KEY="${SOLANA_TRACKER_API_KEY:-}"
export SOLANA_TRACKER_RPC_URL="${SOLANA_TRACKER_RPC_URL:-}"
export TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-8738647936:AAEfTT4Kc_GIWdBk_vhhB2GFHVQavNXcFis}"
export TELEGRAM_ID="${TELEGRAM_ID:-1740095485}"
export REPO_ROOT SCRIPT_DIR

echo "[pump-scanner] $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[pump-scanner] Helius RPC:       ${HELIUS_RPC_URL:+configured}${HELIUS_RPC_URL:-NOT SET}"
echo "[pump-scanner] Solana Tracker:   ${SOLANA_TRACKER_API_KEY:+configured}${SOLANA_TRACKER_API_KEY:-NOT SET}"
echo "[pump-scanner] Telegram:         ${TELEGRAM_BOT_TOKEN:+configured}${TELEGRAM_BOT_TOKEN:-NOT SET}"

# ─── Step 1-5: Fetch, enrich, classify, write pump.md, send Telegram ─────────
python3 "$SCRIPT_DIR/pump_scanner.py"

# ─── Step 6: Git commit + push ────────────────────────────────────────────────
cd "$REPO_ROOT"
git add pump.md
if git diff --cached --quiet; then
  echo "[pump-scanner] No changes to pump.md — skipping commit"
else
  STAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  git commit -m "$(cat <<EOF
chore: pump.fun scan ${STAMP}

https://claude.ai/code/session_01J885hn5P2bwCRz4vGDiXGL
EOF
)"
  echo "[pump-scanner] Committed pump.md"
fi

git push -u origin master && echo "[pump-scanner] Pushed" || echo "[pump-scanner] Push failed — will retry next run"
