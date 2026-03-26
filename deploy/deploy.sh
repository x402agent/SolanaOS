#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# SolanaOS :: Fly.io Deploy Script
#
# One-command deployment: creates app, volume, secrets, and deploys.
# Usage: bash deploy.sh
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Colors ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${CYAN}▸${NC} $*"; }
ok()    { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
fail()  { echo -e "${RED}✗${NC} $*" >&2; exit 1; }
header(){ echo -e "\n${BOLD}═══ $* ═══${NC}\n"; }

# ── Preflight ────────────────────────────────────────────────────────
header "SolanaOS Fly.io Deploy"

command -v flyctl >/dev/null 2>&1 || command -v fly >/dev/null 2>&1 || \
  fail "flyctl not found. Install: https://fly.io/docs/flyctl/install/"

FLY="$(command -v flyctl 2>/dev/null || command -v fly)"

# Check auth
if ! $FLY auth whoami &>/dev/null; then
  info "Not logged in to Fly.io — opening login..."
  $FLY auth login
fi
ok "Authenticated as $($FLY auth whoami 2>/dev/null)"

# ── App Name ─────────────────────────────────────────────────────────
header "App Configuration"

DEFAULT_APP="solanaos-$(head -c 4 /dev/urandom | xxd -p)"
read -rp "$(echo -e "${CYAN}▸${NC}") App name [${DEFAULT_APP}]: " APP_NAME
APP_NAME="${APP_NAME:-$DEFAULT_APP}"

# ── Region ───────────────────────────────────────────────────────────
echo ""
info "Popular regions: iad (Virginia), sjc (San Jose), lax (LA), ord (Chicago),"
info "                 ewr (Newark), lhr (London), ams (Amsterdam), nrt (Tokyo)"
read -rp "$(echo -e "${CYAN}▸${NC}") Region [iad]: " REGION
REGION="${REGION:-iad}"

# ── Setup Password ───────────────────────────────────────────────────
echo ""
read -srp "$(echo -e "${CYAN}▸${NC}") Setup password (protects /setup wizard): " SETUP_PASSWORD
echo ""
[[ -z "$SETUP_PASSWORD" ]] && fail "Setup password is required"

# ── LLM Provider ─────────────────────────────────────────────────────
header "LLM Provider"

echo "  1) OpenRouter (recommended — many models, free tier)"
echo "  2) Anthropic (Claude)"
echo "  3) xAI (Grok)"
echo "  4) OpenAI"
echo "  5) Ollama (self-hosted, requires separate Ollama server)"
echo "  6) MiniMax"
echo ""
read -rp "$(echo -e "${CYAN}▸${NC}") Provider [1]: " LLM_CHOICE
LLM_CHOICE="${LLM_CHOICE:-1}"

LLM_PROVIDER=""
LLM_KEY_NAME=""
LLM_KEY_VALUE=""

case "$LLM_CHOICE" in
  1) LLM_PROVIDER="openrouter"; LLM_KEY_NAME="OPENROUTER_API_KEY"
     read -srp "$(echo -e "${CYAN}▸${NC}") OpenRouter API key: " LLM_KEY_VALUE; echo "" ;;
  2) LLM_PROVIDER="anthropic"; LLM_KEY_NAME="ANTHROPIC_API_KEY"
     read -srp "$(echo -e "${CYAN}▸${NC}") Anthropic API key: " LLM_KEY_VALUE; echo "" ;;
  3) LLM_PROVIDER="xai"; LLM_KEY_NAME="XAI_API_KEY"
     read -srp "$(echo -e "${CYAN}▸${NC}") xAI API key: " LLM_KEY_VALUE; echo "" ;;
  4) LLM_PROVIDER="openai"; LLM_KEY_NAME="OPENAI_API_KEY"
     read -srp "$(echo -e "${CYAN}▸${NC}") OpenAI API key: " LLM_KEY_VALUE; echo "" ;;
  5) LLM_PROVIDER="ollama"; LLM_KEY_NAME="OLLAMA_MODEL"
     read -rp "$(echo -e "${CYAN}▸${NC}") Ollama model [minimax-m2.7:cloud]: " LLM_KEY_VALUE
     LLM_KEY_VALUE="${LLM_KEY_VALUE:-minimax-m2.7:cloud}"; echo "" ;;
  6) LLM_PROVIDER="minimax"; LLM_KEY_NAME="MINIMAX_API_KEY"
     read -srp "$(echo -e "${CYAN}▸${NC}") MiniMax API key: " LLM_KEY_VALUE; echo "" ;;
  *) fail "Invalid choice: $LLM_CHOICE" ;;
esac

[[ -z "$LLM_KEY_VALUE" ]] && fail "API key is required"

# ── Solana RPC ───────────────────────────────────────────────────────
header "Solana RPC (optional)"

read -rp "$(echo -e "${CYAN}▸${NC}") Helius API key (press Enter to skip): " HELIUS_KEY
read -rp "$(echo -e "${CYAN}▸${NC}") SolanaTracker API key (press Enter to skip): " SOLANA_TRACKER_KEY
read -rp "$(echo -e "${CYAN}▸${NC}") Birdeye API key (press Enter to skip): " BIRDEYE_KEY

# ── Channel Tokens (optional) ───────────────────────────────────────
header "Channel Tokens (optional)"

read -rp "$(echo -e "${CYAN}▸${NC}") Telegram bot token (press Enter to skip): " TELEGRAM_TOKEN
read -rp "$(echo -e "${CYAN}▸${NC}") Discord bot token (press Enter to skip): " DISCORD_TOKEN

# ── Gateway Auth ─────────────────────────────────────────────────────
header "Gateway"

GATEWAY_TOKEN="gw-$(head -c 16 /dev/urandom | xxd -p)"
info "Auto-generated gateway token: ${GATEWAY_TOKEN}"
echo ""

# ── Confirm ──────────────────────────────────────────────────────────
header "Deploy Summary"

echo -e "  App name:      ${BOLD}${APP_NAME}${NC}"
echo -e "  Region:        ${BOLD}${REGION}${NC}"
echo -e "  LLM provider:  ${BOLD}${LLM_PROVIDER}${NC}"
echo -e "  URL:           ${BOLD}https://${APP_NAME}.fly.dev${NC}"
echo -e "  Gateway:       ${BOLD}wss://${APP_NAME}.fly.dev${NC}"
echo ""
read -rp "$(echo -e "${CYAN}▸${NC}") Deploy now? [Y/n]: " CONFIRM
CONFIRM="${CONFIRM:-Y}"
[[ "$CONFIRM" =~ ^[Yy] ]] || { info "Aborted."; exit 0; }

# ── Create App ───────────────────────────────────────────────────────
header "Creating Fly App"

if $FLY apps list 2>/dev/null | grep -q "^${APP_NAME}"; then
  warn "App '${APP_NAME}' already exists — using existing app"
else
  $FLY apps create "$APP_NAME" --org personal 2>/dev/null || \
    $FLY apps create "$APP_NAME" 2>/dev/null || \
    warn "App creation returned non-zero (may already exist)"
  ok "App created: ${APP_NAME}"
fi

# ── Create Volume ────────────────────────────────────────────────────
header "Creating Persistent Volume"

if $FLY volumes list -a "$APP_NAME" 2>/dev/null | grep -q "solanaos_data"; then
  warn "Volume 'solanaos_data' already exists"
else
  $FLY volumes create solanaos_data \
    --app "$APP_NAME" \
    --region "$REGION" \
    --size 1 \
    --yes
  ok "Volume created: solanaos_data (1 GB)"
fi

# ── Set Secrets ──────────────────────────────────────────────────────
header "Setting Secrets"

SECRETS=(
  "SETUP_PASSWORD=${SETUP_PASSWORD}"
  "GATEWAY_AUTH_TOKEN=${GATEWAY_TOKEN}"
  "GATEWAY_AUTH_PASSWORD=${SETUP_PASSWORD}"
  "LLM_PROVIDER=${LLM_PROVIDER}"
  "${LLM_KEY_NAME}=${LLM_KEY_VALUE}"
)

[[ -n "${HELIUS_KEY:-}" ]] && SECRETS+=(
  "HELIUS_API_KEY=${HELIUS_KEY}"
  "HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}"
)
[[ -n "${SOLANA_TRACKER_KEY:-}" ]] && SECRETS+=(
  "SOLANA_TRACKER_API_KEY=${SOLANA_TRACKER_KEY}"
  "SOLANA_TRACKER_RPC_URL=https://rpc-mainnet.solanatracker.io/?api_key=${SOLANA_TRACKER_KEY}"
)
[[ -n "${BIRDEYE_KEY:-}" ]] && SECRETS+=("BIRDEYE_API_KEY=${BIRDEYE_KEY}")
[[ -n "${TELEGRAM_TOKEN:-}" ]] && SECRETS+=("TELEGRAM_BOT_TOKEN=${TELEGRAM_TOKEN}")
[[ -n "${DISCORD_TOKEN:-}" ]] && SECRETS+=("DISCORD_BOT_TOKEN=${DISCORD_TOKEN}")

$FLY secrets set "${SECRETS[@]}" --app "$APP_NAME" --stage
ok "Secrets staged (${#SECRETS[@]} values)"

# ── Write fly.toml ───────────────────────────────────────────────────
header "Writing fly.toml"

FLY_TOML="${REPO_ROOT}/fly.toml"
cat > "$FLY_TOML" <<TOML
app = "${APP_NAME}"
primary_region = "${REGION}"
kill_signal = "SIGINT"
kill_timeout = "30s"

[build]
  dockerfile = "Dockerfile.fly"

[env]
  PORT = "18800"
  SOLANAOS_HOME = "/data/solanaos"
  SOLANAOS_CONFIG = "/data/solanaos/config.json"
  SOLANA_WALLET_KEY_PATH = "/data/solanaos/wallet/agent-wallet.json"
  SOLANAOS_SOUL_PATH = "/app/SOUL.md"
  SOLANAOS_SKILLS_DIR = "/app/skills"
  SOLANAOS_FLY_START_DAEMON = "true"
  SOLANAOS_FLY_START_GATEWAY = "false"
  GATEWAY_BIND = "public"
  GATEWAY_AUTH_MODE = "password"
  GATEWAY_AUTH_ALLOW_TAILSCALE = "false"
  GATEWAY_TAILSCALE_MODE = "off"

[http_service]
  internal_port = 18800
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

[[vm]]
  size = "shared-cpu-2x"
  memory = "2048mb"

[mounts]
  source = "solanaos_data"
  destination = "/data"
TOML

ok "fly.toml written"

# ── Deploy ───────────────────────────────────────────────────────────
header "Deploying to Fly.io"

info "Building and deploying (this takes a few minutes on first deploy)..."
cd "$REPO_ROOT"
$FLY deploy --app "$APP_NAME" --region "$REGION" --yes

ok "Deployment complete!"

# ── Post-Deploy ──────────────────────────────────────────────────────
header "Deployment Complete"

echo ""
echo -e "  ${GREEN}App URL:${NC}       https://${APP_NAME}.fly.dev"
echo -e "  ${GREEN}Setup wizard:${NC}  https://${APP_NAME}.fly.dev/setup"
echo -e "  ${GREEN}Gateway URL:${NC}   wss://${APP_NAME}.fly.dev"
echo -e "  ${GREEN}Gateway token:${NC} ${GATEWAY_TOKEN}"
echo ""
echo -e "  ${BOLD}Connect your local CLI:${NC}"
echo ""
echo "    solanaos config set gateway.mode remote"
echo "    solanaos config set gateway.remote.url wss://${APP_NAME}.fly.dev"
echo "    solanaos config set gateway.remote.token ${GATEWAY_TOKEN}"
echo "    solanaos health"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo ""
echo "    fly logs -a ${APP_NAME}              # Stream logs"
echo "    fly ssh console -a ${APP_NAME}       # SSH in"
echo "    fly apps restart ${APP_NAME}         # Restart"
echo "    fly scale memory 4096 -a ${APP_NAME} # More RAM"
echo "    fly status -a ${APP_NAME}            # Check status"
echo ""
echo -e "  ${BOLD}Update a secret:${NC}"
echo ""
echo "    fly secrets set OPENROUTER_API_KEY=sk-new-key -a ${APP_NAME}"
echo ""
ok "SolanaOS is live at https://${APP_NAME}.fly.dev"
