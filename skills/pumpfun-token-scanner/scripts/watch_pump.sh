#!/usr/bin/env bash
# watch_pump.sh — Watches pump.md for changes and triggers the deploy pipeline
# Usage: ./watch_pump.sh [--poll-interval 30] [--once]
#
# Requires: deploy_pipeline.py, push_to_convex.py, send_telegram.py in same dir
# Env: reads .env from /Users/8bit/solanaos/.env

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PUMP_MD="$PROJECT_DIR/pump.md"
POLL_INTERVAL="${POLL_INTERVAL:-30}"
RUN_ONCE=false
LAST_HASH=""

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --poll-interval) POLL_INTERVAL="$2"; shift 2 ;;
    --once) RUN_ONCE=true; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

log() { echo "[$(date '+%H:%M:%S')] $*"; }

get_hash() {
  if [[ -f "$PUMP_MD" ]]; then
    md5 -q "$PUMP_MD" 2>/dev/null || md5sum "$PUMP_MD" | cut -d' ' -f1
  else
    echo "no-file"
  fi
}

run_pipeline() {
  log "🚀 pump.md changed — running deploy pipeline..."

  # Step 1: Push to Convex
  log "  → Pushing to Convex..."
  if python3 "$SCRIPT_DIR/push_to_convex.py" --source watcher; then
    log "  ✅ Convex push complete"
  else
    log "  ❌ Convex push failed (continuing...)"
  fi

  # Step 2: Full deploy pipeline (Convex + Netlify + git)
  log "  → Running deploy pipeline..."
  if python3 "$SCRIPT_DIR/deploy_pipeline.py" --source watcher --skip-convex; then
    log "  ✅ Deploy pipeline complete"
  else
    log "  ❌ Deploy pipeline had errors"
  fi

  # Step 3: Telegram digest
  log "  → Sending Telegram digest..."
  if python3 "$SCRIPT_DIR/send_telegram.py"; then
    log "  ✅ Telegram digest sent"
  else
    log "  ❌ Telegram send failed"
  fi

  log "✅ Pipeline finished at $(date '+%Y-%m-%d %H:%M:%S')"
}

# --- Main loop ---

log "👁️  Watching $PUMP_MD (poll: ${POLL_INTERVAL}s)"
LAST_HASH=$(get_hash)
log "  Initial hash: $LAST_HASH"

if $RUN_ONCE; then
  # Just run the pipeline once and exit (useful for cron/launchd)
  run_pipeline
  exit 0
fi

# Try fswatch first (macOS), fall back to polling
if command -v fswatch &>/dev/null; then
  log "  Using fswatch for native file events"
  fswatch -1 "$PUMP_MD" | while read -r _; do
    NEW_HASH=$(get_hash)
    if [[ "$NEW_HASH" != "$LAST_HASH" ]]; then
      LAST_HASH="$NEW_HASH"
      run_pipeline
    fi
    log "👁️  Resuming watch..."
  done
else
  log "  fswatch not found — using ${POLL_INTERVAL}s polling"
  while true; do
    sleep "$POLL_INTERVAL"
    NEW_HASH=$(get_hash)
    if [[ "$NEW_HASH" != "$LAST_HASH" ]]; then
      LAST_HASH="$NEW_HASH"
      run_pipeline
    fi
  done
fi
