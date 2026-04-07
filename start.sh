#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# SolanaOS — Unified Service Start/Stop/Status Script
#
# Usage:
#   bash start.sh              # build + start all services
#   bash start.sh --with-ui    # include web UI dev server
#   bash start.sh --stop       # stop all background services
#   bash start.sh --status     # show running service status
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

GREEN='\033[38;2;20;241;149m'
PURPLE='\033[38;2;153;69;255m'
AMBER='\033[38;2;255;170;0m'
DIM='\033[38;2;85;102;128m'
RESET='\033[0m'

info()  { echo -e "${GREEN}▸${RESET} $1"; }
warn()  { echo -e "${AMBER}▸${RESET} $1"; }
dim()   { echo -e "${DIM}  $1${RESET}"; }

# ── Config ───────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
PID_DIR="/tmp/solanaos-pids"
ENV_FILE="$SCRIPT_DIR/.env"

GO_BIN="${GO_BIN:-}"
if [ -z "$GO_BIN" ]; then
  for g in /opt/homebrew/bin/go /usr/local/go/bin/go; do
    [ -x "$g" ] && { GO_BIN="$g"; break; }
  done
  GO_BIN="${GO_BIN:-$(command -v go 2>/dev/null || echo go)}"
fi

export GOCACHE="${GOCACHE:-/tmp/go-build}"
export GOTMPDIR="${GOTMPDIR:-/tmp}"
GOENVVARS="GOCACHE=$GOCACHE GOTMPDIR=$GOTMPDIR"

# Load .env if present
if [ -f "$ENV_FILE" ]; then
  set -a; . "$ENV_FILE"; set +a
fi

# ── Mode flags ────────────────────────────────────────────────────────

WITH_UI=false
STOP_MODE=false
STATUS_MODE=false

for arg in "$@"; do
  case "$arg" in
    --with-ui)  WITH_UI=true ;;
    --stop)     STOP_MODE=true ;;
    --status)   STATUS_MODE=true ;;
  esac
done

mkdir -p "$PID_DIR"

# ── Helpers ──────────────────────────────────────────────────────────

pid_file() { echo "$PID_DIR/$1.pid"; }

start_service() {
  local name="$1"; shift
  local pf; pf="$(pid_file "$name")"

  if [ -f "$pf" ] && kill -0 "$(cat "$pf")" 2>/dev/null; then
    dim "$name already running (pid $(cat "$pf"))"
    return
  fi

  "$@" &
  echo $! > "$pf"
  info "$name started (pid $(cat "$pf"))"
}

stop_service() {
  local name="$1"
  local pf; pf="$(pid_file "$name")"

  if [ -f "$pf" ]; then
    local pid; pid="$(cat "$pf")"
    if kill "$pid" 2>/dev/null; then
      info "$name stopped (pid $pid)"
    else
      warn "$name was not running"
    fi
    rm -f "$pf"
  else
    dim "$name: no pid file"
  fi
}

service_status() {
  local name="$1"
  local pf; pf="$(pid_file "$name")"
  if [ -f "$pf" ] && kill -0 "$(cat "$pf")" 2>/dev/null; then
    echo -e "  ${GREEN}●${RESET} $name ${DIM}(pid $(cat "$pf"))${RESET}"
  else
    echo -e "  ${DIM}○${RESET} $name ${DIM}(stopped)${RESET}"
    [ -f "$pf" ] && rm -f "$pf"
  fi
}

# ── Build ─────────────────────────────────────────────────────────────

build_all() {
  info "Building SolanaOS binaries..."
  mkdir -p "$BUILD_DIR"

  $GOENVVARS "$GO_BIN" build -trimpath -ldflags="-s -w" -o "$BUILD_DIR/solanaos" "$SCRIPT_DIR" 2>&1
  info "✓ solanaos"

  $GOENVVARS "$GO_BIN" build -trimpath -ldflags="-s -w" \
    -o "$BUILD_DIR/agent-wallet" "$SCRIPT_DIR/services/agent-wallet/cmd" 2>&1
  info "✓ agent-wallet"

  $GOENVVARS "$GO_BIN" build -trimpath -ldflags="-s -w" \
    -o "$BUILD_DIR/gateway-api" "$SCRIPT_DIR/cmd/gateway-api" 2>&1
  info "✓ gateway-api"
}

# ── Stop ─────────────────────────────────────────────────────────────

if $STOP_MODE; then
  echo ""
  info "Stopping SolanaOS services..."
  stop_service "solanaos-daemon"
  stop_service "agent-wallet"
  stop_service "mcp-server"
  stop_service "ui-dev"
  echo ""
  exit 0
fi

# ── Status ────────────────────────────────────────────────────────────

if $STATUS_MODE; then
  echo ""
  echo -e "${PURPLE}SolanaOS Service Status${RESET}"
  service_status "agent-wallet"
  service_status "solanaos-daemon"
  service_status "mcp-server"
  $WITH_UI && service_status "ui-dev"
  echo ""
  exit 0
fi

# ── Start ─────────────────────────────────────────────────────────────

echo ""
echo -e "${PURPLE}╔═══════════════════════════════════════════════╗${RESET}"
echo -e "${PURPLE}║  SolanaOS · Starting Services                 ║${RESET}"
echo -e "${PURPLE}╚═══════════════════════════════════════════════╝${RESET}"
echo ""

build_all

# ── Agent Wallet (dev + trade local signers + API) ────────────────────

info "Starting Agent Wallet service..."
WALLET_PORT="${WALLET_API_PORT:-8421}"
start_service "agent-wallet" "$BUILD_DIR/agent-wallet"
dim "API:      http://localhost:$WALLET_PORT/v1/health"
dim "Dev key:  ~/.nanosolana/signers/dev.enc"
dim "Trade key:~/.nanosolana/signers/trade.enc"

# Short pause so the wallet API is up before the daemon queries it
sleep 1

# ── SolanaOS Daemon ───────────────────────────────────────────────────

info "Starting SolanaOS daemon..."
start_service "solanaos-daemon" "$BUILD_DIR/solanaos" daemon
dim "Gateway:  http://localhost:${GATEWAY_PORT:-8080}"
dim "Control:  http://localhost:${CONTROL_PORT:-7777}"

# ── MCP Server (optional — needs node + built dist) ──────────────────

MCP_PORT="${MCP_PORT:-3001}"
if command -v node >/dev/null 2>&1 && [ -f "$SCRIPT_DIR/mcp-server/dist/http.js" ]; then
  info "Starting SolanaOS MCP server..."
  start_service "mcp-server" node "$SCRIPT_DIR/mcp-server/dist/http.js"
  dim "MCP:      http://localhost:$MCP_PORT/mcp"
elif command -v npm >/dev/null 2>&1 && [ -f "$SCRIPT_DIR/mcp-server/package.json" ]; then
  info "Building + starting SolanaOS MCP server..."
  (cd "$SCRIPT_DIR/mcp-server" && npm install --silent && npm run build) 2>&1
  start_service "mcp-server" node "$SCRIPT_DIR/mcp-server/dist/http.js"
  dim "MCP:      http://localhost:$MCP_PORT/mcp"
else
  dim "MCP server skipped (run: make build-mcp && make start-mcp)"
fi

# ── UI Dev Server (optional) ──────────────────────────────────────────

if $WITH_UI; then
  if command -v npm >/dev/null 2>&1 && [ -f "$SCRIPT_DIR/web/frontend/package.json" ]; then
    info "Starting web UI dev server..."
    start_service "ui-dev" bash -c "cd '$SCRIPT_DIR/web/frontend' && npm run dev"
    dim "UI:       http://localhost:5173"
  else
    warn "npm / web/frontend not found — skipping UI dev server"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────

echo ""
echo -e "  ${GREEN}✓ SolanaOS running${RESET}"
echo -e "  ${DIM}Wallet API:${RESET}   http://localhost:$WALLET_PORT/v1/health"
echo -e "  ${DIM}Local keys:${RESET}   ~/.nanosolana/signers/{dev,trade}.enc"
echo -e "  ${DIM}Gateway:${RESET}      http://localhost:${GATEWAY_PORT:-18790}"
echo -e "  ${DIM}Control UI:${RESET}   http://localhost:${CONTROL_PORT:-7777}"
echo -e "  ${DIM}MCP:${RESET}          http://localhost:$MCP_PORT/mcp  ${DIM}(if built)${RESET}"
echo -e "  ${DIM}Logs:${RESET}         $BUILD_DIR/solanaos daemon --no-bg"
echo -e "  ${DIM}Stop:${RESET}        bash start.sh --stop"
echo -e "  ${DIM}Status:${RESET}      bash start.sh --status"
echo ""
