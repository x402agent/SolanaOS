#!/bin/bash
# SolanaOS macOS Menu Bar Agent
# Builds and runs a tiny native Swift status bar app.

set -euo pipefail

BINARY="${0%/*}/solanaos"
if [ ! -f "$BINARY" ]; then
  BINARY="$(which solanaos 2>/dev/null || echo './build/solanaos')"
fi

PORT="${NANOBOT_PORT:-7777}"
PIDFILE="/tmp/nanobot-server.pid"
LOGFILE="/tmp/nanobot-server.log"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SWIFT_BIN="${TMPDIR:-/tmp}/SolanaOSMenuBar"

SWIFT_SOURCE=""
for candidate in \
  "$ROOT_DIR/apps/macos/SolanaOSMenuBar.swift" \
  "$(cd "$(dirname "$0")/../.." && pwd)/apps/macos/SolanaOSMenuBar.swift"
do
  if [ -f "$candidate" ]; then
    SWIFT_SOURCE="$candidate"
    break
  fi
done

is_nanobot_healthy() {
  curl -fsS "http://127.0.0.1:$PORT/api/status" >/dev/null 2>&1
}

port_listener() {
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | awk 'NR==2 {print $1 " (PID " $2 ")"}'
}

# ── Start SolanaOS Control in background ──────────────────────────
start_server() {
  if is_nanobot_healthy; then
    echo "SolanaOS Control already running on http://127.0.0.1:$PORT"
    return 0
  fi

  if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo "SolanaOS Control already running (PID: $(cat "$PIDFILE"))"
    return 0
  fi

  listener="$(port_listener || true)"
  if [ -n "$listener" ]; then
    echo "Port $PORT is already in use by $listener" >&2
    echo "Start/stop the existing SolanaOS or run menubar with a different port." >&2
    exit 1
  fi

  "$BINARY" nanobot --no-browser --port "$PORT" >"$LOGFILE" 2>&1 &
  pid=$!
  echo "$pid" > "$PIDFILE"
  sleep 1

  if is_nanobot_healthy || kill -0 "$pid" 2>/dev/null; then
    echo "SolanaOS Control started on http://127.0.0.1:$PORT"
  else
    echo "SolanaOS Control failed to start" >&2
    [ -f "$LOGFILE" ] && tail -n 40 "$LOGFILE" >&2
    rm -f "$PIDFILE"
    exit 1
  fi
}

# ── Stop server ─────────────────────────────────────────────────
stop_server() {
  if [ -f "$PIDFILE" ]; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE"
    echo "SolanaOS Control stopped"
  fi
}

# ── Get wallet address ──────────────────────────────────────────
get_wallet() {
  curl -s "http://127.0.0.1:$PORT/api/wallet" 2>/dev/null | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('short','??'))" 2>/dev/null || echo "??"
}

# ── Get status ──────────────────────────────────────────────────
get_status() {
  curl -s "http://127.0.0.1:$PORT/api/status" 2>/dev/null | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('daemon','stopped'))" 2>/dev/null || echo "offline"
}

build_menubar() {
  if [ -z "$SWIFT_SOURCE" ] || [ ! -f "$SWIFT_SOURCE" ]; then
    echo "Missing Swift menubar source" >&2
    exit 1
  fi

  if [ ! -x "$SWIFT_BIN" ] || [ "$SWIFT_SOURCE" -nt "$SWIFT_BIN" ]; then
    xcrun swiftc -parse-as-library -O -o "$SWIFT_BIN" "$SWIFT_SOURCE"
  fi
}

# ── Native Swift menu bar app ────────────────────────────────────
start_server
build_menubar

export NANOBOT_PORT="$PORT"
export NANOBOT_PIDFILE="$PIDFILE"
exec "$SWIFT_BIN"
