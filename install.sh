#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# SolanaOS — One-Shot Installer
#
# Usage:
#   bash install.sh
#   bash install.sh --with-web
#   SOLANAOS_REPO_URL=https://github.com/x402agent/SolanaOS.git bash install.sh
#
# What it does:
#   1. Uses the local checkout when run from the repo, otherwise clones or updates a repo
#   2. Builds the `solanaos` binary
#   3. Creates ~/.nanosolana/ workspace
#   4. Optionally builds and installs the web console
#   5. Generates an agentic wallet
#   6. Prints next steps
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
fail()  { echo -e "\033[31m✖ $1${RESET}" >&2; exit 1; }
check_cmd() { command -v "$1" >/dev/null 2>&1 || fail "$1 is required but not found. Install it first."; }

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

GO_BIN="${GO_BIN:-}"
if [ -z "$GO_BIN" ]; then
  if [ -x "/opt/homebrew/bin/go" ]; then
    GO_BIN="/opt/homebrew/bin/go"
  elif [ -x "/usr/local/go/bin/go" ]; then
    GO_BIN="/usr/local/go/bin/go"
  else
    GO_BIN="$(command -v go || true)"
  fi
fi

export GOCACHE="${GOCACHE:-/tmp/go-build}"
export GOTMPDIR="${GOTMPDIR:-/tmp}"
REAL_HOME="${REAL_HOME:-$(eval echo "~$(id -un)")}"
HOST_GOMODCACHE_DEFAULT="${REAL_HOME}/go/pkg/mod"
HOST_GOPROXY_DEFAULT="https://proxy.golang.org,direct"
if [ -d "${HOST_GOMODCACHE_DEFAULT}/cache/download" ]; then
  HOST_GOPROXY_DEFAULT="file://${HOST_GOMODCACHE_DEFAULT}/cache/download,${HOST_GOPROXY_DEFAULT}"
fi

echo ""
echo -e "${PURPLE}╔═══════════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${PURPLE}║${RESET}  ${GREEN}███████╗ ██████╗ ██╗      █████╗ ███╗   ██╗ █████╗  ██████╗ ███████╗${RESET}  ${PURPLE}║${RESET}"
echo -e "${PURPLE}║${RESET}  ${GREEN}██╔════╝██╔═══██╗██║     ██╔══██╗████╗  ██║██╔══██╗██╔═══██╗██╔════╝${RESET}  ${PURPLE}║${RESET}"
echo -e "${PURPLE}║${RESET}  ${GREEN}███████╗██║   ██║██║     ███████║██╔██╗ ██║███████║██║   ██║███████╗${RESET}  ${PURPLE}║${RESET}"
echo -e "${PURPLE}║${RESET}  ${GREEN}╚════██║██║   ██║██║     ██╔══██║██║╚██╗██║██╔══██║██║   ██║╚════██║${RESET}  ${PURPLE}║${RESET}"
echo -e "${PURPLE}║${RESET}  ${GREEN}███████║╚██████╔╝███████╗██║  ██║██║ ╚████║██║  ██║╚██████╔╝███████║${RESET}  ${PURPLE}║${RESET}"
echo -e "${PURPLE}║${RESET}  ${GREEN}╚══════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝${RESET}  ${PURPLE}║${RESET}"
echo -e "${PURPLE}║${RESET}                                                                   ${PURPLE}║${RESET}"
echo -e "${PURPLE}║${RESET}  ${AMBER}⚡ One-Shot Installer  ·  The Solana Computer  ·  Pure Go${RESET}          ${PURPLE}║${RESET}"
echo -e "${PURPLE}╚═══════════════════════════════════════════════════════════════════╝${RESET}"
echo ""

WITH_WEB=false
INSTALL_DIR="${SOLANAOS_DIR:-${NANOSOLANA_DIR:-$HOME/solanaos}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || pwd)"
LOCAL_SOURCE=false
REPO_URL="${SOLANAOS_REPO_URL:-${NANOSOLANA_REPO_URL:-https://github.com/x402agent/SolanaOS.git}}"

for arg in "$@"; do
  case "$arg" in
    --with-web) WITH_WEB=true ;;
    --dir=*)    INSTALL_DIR="${arg#--dir=}" ;;
  esac
done

if [ -f "$SCRIPT_DIR/go.mod" ] && [ -f "$SCRIPT_DIR/main.go" ]; then
  LOCAL_SOURCE=true
  INSTALL_DIR="$SCRIPT_DIR"
fi

if [ -z "$GO_BIN" ] || [ ! -x "$GO_BIN" ]; then
  fail "go is required but not found. Install it first."
fi
if ! $LOCAL_SOURCE; then
  check_cmd git
fi

LOCAL_GOMODCACHE_DEFAULT="${INSTALL_DIR}/.cache/gomod"
export GOMODCACHE="${GOMODCACHE:-$LOCAL_GOMODCACHE_DEFAULT}"
export GOPROXY="${GOPROXY:-$HOST_GOPROXY_DEFAULT}"

info "Go: $("$GO_BIN" version | awk '{print $3}')"
mkdir -p "$GOCACHE" "$GOTMPDIR" "$GOMODCACHE"
dim "Using GOCACHE=$GOCACHE"
dim "Using GOTMPDIR=$GOTMPDIR"
dim "Using GOMODCACHE=$GOMODCACHE"
dim "Using GOPROXY=$GOPROXY"

if $LOCAL_SOURCE; then
  info "Using local source tree at $INSTALL_DIR"
  cd "$INSTALL_DIR"
elif [ -d "$INSTALL_DIR/.git" ]; then
  info "Updating existing installation at $INSTALL_DIR"
  cd "$INSTALL_DIR"
  git pull --ff-only 2>/dev/null || warn "Git pull failed — using existing code"
else
  info "Cloning SolanaOS to $INSTALL_DIR"
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

info "Building SolanaOS binary..."
mkdir -p build
"$GO_BIN" build -ldflags="-s -w" -o build/solanaos . 2>&1
ln -sf solanaos build/nanosolana

BINARY="$INSTALL_DIR/build/solanaos"
SIZE=$(du -h "$BINARY" | awk '{print $1}')
info "Built: $BINARY ($SIZE)"

WORKSPACE="$HOME/.nanosolana"
BIN_DIR="$WORKSPACE/bin"
mkdir -p "$WORKSPACE/workspace/vault" "$WORKSPACE/wallet" "$BIN_DIR"
install -m 755 "$BINARY" "$BIN_DIR/solanaos"
ln -sf "$BIN_DIR/solanaos" "$BIN_DIR/nanosolana"
info "Installed CLI at $BIN_DIR/solanaos (also: nanosolana)"

if [ ! -f "$INSTALL_DIR/.env" ] && [ -f "$INSTALL_DIR/.env.example" ]; then
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  dim "Created .env from .env.example — add your API keys"
fi

CONNECT_BUNDLE="$WORKSPACE/connect/solanaos-connect.json"
SETUP_CODE_PATH="$WORKSPACE/connect/setup-code.txt"
if [ -f "$INSTALL_DIR/scripts/write-connect-bundle.sh" ]; then
  info "Generating SolanaOS connect bundle..."
  bash "$INSTALL_DIR/scripts/write-connect-bundle.sh" \
    --workspace "$WORKSPACE" \
    --install-dir "$INSTALL_DIR" \
    --env-file "$INSTALL_DIR/.env" >/dev/null
  dim "Connect bundle: $CONNECT_BUNDLE"
fi

if [ -x "$BIN_DIR/solanaos" ]; then
  "$BIN_DIR/solanaos" gateway setup-code >/dev/null 2>&1 || true
fi

info "Building Agent Wallet service..."
AGENT_WALLET_BINARY="$INSTALL_DIR/build/agent-wallet"
"$GO_BIN" build -ldflags="-s -w" -o "$AGENT_WALLET_BINARY" \
  "$INSTALL_DIR/services/agent-wallet/cmd" 2>&1 \
  && install -m 755 "$AGENT_WALLET_BINARY" "$BIN_DIR/agent-wallet" \
  && info "Installed agent-wallet at $BIN_DIR/agent-wallet" \
  || warn "agent-wallet build failed — run: make build-agent-wallet"

info "Initializing local signing keys (dev + trade)..."
SIGNERS_DIR="$HOME/.nanosolana/signers"
mkdir -p "$SIGNERS_DIR"
# Run with --help to trigger key init without starting the server
"$AGENT_WALLET_BINARY" >/dev/null 2>&1 &
INIT_PID=$!
sleep 2
kill $INIT_PID 2>/dev/null || true
if ls "$SIGNERS_DIR"/*.enc >/dev/null 2>&1; then
  for f in "$SIGNERS_DIR"/*.enc; do
    mode="$(basename "$f" .enc)"
    dim "  $mode key: $f"
  done
else
  dim "Keys will be generated on first start (run: agent-wallet)"
fi

info "Checking agentic wallet..."
"$BINARY" solana wallet >/dev/null 2>&1 || warn "Wallet check skipped (add HELIUS_RPC_URL to .env)"

if $WITH_WEB; then
  info "Building SolanaOS web backend..."
  "$GO_BIN" build -ldflags="-s -w" -o build/solanaos-web ./web/backend 2>&1
  ln -sf solanaos-web build/nanosolana-web
  WEB_BINARY="$INSTALL_DIR/build/solanaos-web"
  install -m 755 "$WEB_BINARY" "$BIN_DIR/solanaos-web"
  ln -sf "$BIN_DIR/solanaos-web" "$BIN_DIR/nanosolana-web"
  info "Installed web launcher at $BIN_DIR/solanaos-web (also: nanosolana-web)"

  if command -v npm >/dev/null 2>&1; then
    info "Building web console..."
    cd "$INSTALL_DIR/web/frontend"
    npm install --silent 2>/dev/null
    npm run build 2>/dev/null
    info "Web console built at web/frontend/dist/"
    dim "Run locally: $BIN_DIR/solanaos-web --no-browser"
    dim "Preview frontend only: cd web/frontend && npm run dev"
    cd "$INSTALL_DIR"
  else
    warn "npm not found — skipping frontend build"
  fi
fi

echo ""
echo -e "${PURPLE}╔═══════════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${PURPLE}║${RESET}  ${GREEN}⚡ SolanaOS installed successfully!${RESET}                                ${PURPLE}║${RESET}"
echo -e "${PURPLE}╚═══════════════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${DIM}Binary:${RESET}     $BINARY"
echo -e "  ${DIM}CLI:${RESET}        $BIN_DIR/solanaos ${DIM}(compat: nanosolana)${RESET}"
if $WITH_WEB; then
echo -e "  ${DIM}Web CLI:${RESET}    $BIN_DIR/solanaos-web ${DIM}(compat: nanosolana-web)${RESET}"
fi
echo -e "  ${DIM}Workspace:${RESET}  $WORKSPACE"
echo -e "  ${DIM}Config:${RESET}     $INSTALL_DIR/.env"
if [ -f "$CONNECT_BUNDLE" ]; then
echo -e "  ${DIM}Connect:${RESET}    $CONNECT_BUNDLE"
fi
echo ""
echo -e "  ${PURPLE}Quick Start:${RESET}"
echo -e "    ${GREEN}cd $INSTALL_DIR${RESET}"
echo -e "    ${GREEN}./build/solanaos version${RESET}              ${DIM}# Verify binary${RESET}"
echo -e "    ${GREEN}$BIN_DIR/solanaos version${RESET}            ${DIM}# Run from anywhere${RESET}"
echo -e "    ${GREEN}./build/solanaos solana health${RESET}        ${DIM}# Check mainnet${RESET}"
echo -e "    ${GREEN}./build/solanaos ooda --sim${RESET}           ${DIM}# Simulated trading${RESET}"
echo -e "    ${GREEN}./build/solanaos daemon${RESET}               ${DIM}# Full autonomous agent${RESET}"
echo -e "    ${GREEN}./build/agent-wallet${RESET}                  ${DIM}# Agent wallet API + local signing keys${RESET}"
echo -e "    ${GREEN}bash start.sh${RESET}                         ${DIM}# Start all services (daemon + wallet)${RESET}"
echo -e "    ${GREEN}$BIN_DIR/solanaos gateway start${RESET}      ${DIM}# Start the native gateway${RESET}"
echo -e "    ${GREEN}$BIN_DIR/solanaos gateway setup-code${RESET} ${DIM}# Print Seeker setup code${RESET}"
if $WITH_WEB; then
echo -e "    ${GREEN}$BIN_DIR/solanaos-web --no-browser${RESET}   ${DIM}# Web console${RESET}"
fi
if [ -f "$SETUP_CODE_PATH" ]; then
echo -e "    ${GREEN}cat $SETUP_CODE_PATH${RESET} ${DIM}# Paste into Android / extension setup${RESET}"
fi
echo ""
if [ -f "$SETUP_CODE_PATH" ]; then
SETUP_CODE_VALUE="$(tr -d '\r\n' < "$SETUP_CODE_PATH")"
echo -e "  ${PURPLE}Solana Seeker Setup Code:${RESET}"
echo -e "    ${GREEN}$SETUP_CODE_VALUE${RESET}"
echo -e "    ${DIM}Paste this into Solana Seeker onboarding or the Connect tab.${RESET}"
echo -e "    ${DIM}Saved at: $SETUP_CODE_PATH${RESET}"
echo ""
fi
echo -e "  ${DIM}Add API keys to .env for full features:${RESET}"
echo -e "    ${AMBER}HELIUS_API_KEY${RESET}=your-helius-key"
echo -e "    ${AMBER}HELIUS_RPC_URL${RESET}=https://mainnet.helius-rpc.com/?api-key=KEY"
echo -e "    ${AMBER}OPENROUTER_API_KEY${RESET}=sk-or-v1-..."
echo -e "    ${AMBER}OPENROUTER_MODEL${RESET}=minimax/minimax-m2.7"
echo -e "    ${AMBER}LLM_PROVIDER${RESET}=openrouter"
echo -e "    ${AMBER}TELEGRAM_BOT_TOKEN${RESET}=..."
echo -e "    ${AMBER}TWITTER_CONSUMER_KEY${RESET}=..."
echo ""
echo -e "  ${DIM}PATH:${RESET} add ${GREEN}$BIN_DIR${RESET} to your shell PATH to run ${GREEN}solanaos${RESET} ${DIM}(or the legacy nanosolana alias)${RESET}"
if $WITH_WEB; then
echo -e "        and ${GREEN}solanaos-web${RESET} ${DIM}(or the legacy nanosolana-web alias)${RESET}"
fi
echo ""
echo -e "  ${DIM}Docs:${RESET} https://go.solanaos.net"
echo ""
