#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET="${1:-daemon}"
shift || true

ENV_FILE="${PROJECT_ROOT}/.env"
APP_NAME=""
REGION="iad"
CONFIG_PATH=""
SKIP_SECRETS=false
FORCE_PRIVATE_MINER=false

usage() {
  cat <<'EOF'
Usage:
  bash scripts/fly-deploy.sh daemon [options]
  bash scripts/fly-deploy.sh mawdaxe [options]

Targets:
  daemon     Deploy the main SolanaOS Fly machine for 24/7 runtime, Telegram, web console, and memory
  mawdaxe    Deploy standalone MawdAxe only when the Bitaxe is reachable from Fly

Options:
  --app <name>           Fly app name override
  --region <code>        Fly region, default: iad
  --env-file <path>      Env file to read secrets from, default: ./.env
  --config <path>        Fly config file override
  --skip-secrets         Skip fly secrets set
  --force-private-miner  Allow mawdaxe deploy even if miner host looks private
  --help                 Show this help

Examples:
  bash scripts/fly-deploy.sh daemon --app solanaos-daemon
  bash scripts/fly-deploy.sh mawdaxe --app solanaos-mawdaxe

Notes:
  - Export FLY_API_TOKEN, or set FLY_ORG_TOKEN and this script will reuse it as FLY_API_TOKEN.
  - The recommended topology is daemon on Fly, MawdAxe on the LAN or Tailscale host next to the Bitaxe.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app)
      APP_NAME="${2:?missing value for --app}"
      shift 2
      ;;
    --region)
      REGION="${2:?missing value for --region}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:?missing value for --env-file}"
      shift 2
      ;;
    --config)
      CONFIG_PATH="${2:?missing value for --config}"
      shift 2
      ;;
    --skip-secrets)
      SKIP_SECRETS=true
      shift
      ;;
    --force-private-miner)
      FORCE_PRIVATE_MINER=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${FLY_API_TOKEN:-}" && -n "${FLY_ORG_TOKEN:-}" ]]; then
  export FLY_API_TOKEN="$FLY_ORG_TOKEN"
fi

require_bin() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required binary: $1" >&2
    exit 1
  }
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

read_env_file_value() {
  local key="$1"
  [[ -f "$ENV_FILE" ]] || return 1

  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 1

  local value="${line#*=}"
  value="$(trim "$value")"
  if [[ "${value#\"}" != "$value" && "${value%\"}" != "$value" ]]; then
    value="${value#\"}"
    value="${value%\"}"
  elif [[ "${value#\'}" != "$value" && "${value%\'}" != "$value" ]]; then
    value="${value#\'}"
    value="${value%\'}"
  fi
  printf '%s' "$value"
}

resolve_value() {
  local key="$1"
  local shell_value="${!key:-}"
  if [[ -n "$shell_value" ]]; then
    printf '%s' "$shell_value"
    return 0
  fi
  read_env_file_value "$key" || true
}

private_ip() {
  local host="$1"
  [[ "$host" =~ ^10\. ]] && return 0
  [[ "$host" =~ ^127\. ]] && return 0
  [[ "$host" =~ ^192\.168\. ]] && return 0
  [[ "$host" =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]] && return 0
  return 1
}

ensure_app_exists() {
  local app="$1"
  local create_args=("$app")
  if [[ -n "${FLY_ORG:-}" ]]; then
    create_args+=(--org "$FLY_ORG")
  fi
  flyctl status -a "$app" >/dev/null 2>&1 || flyctl apps create "${create_args[@]}"
}

ensure_volume() {
  local app="$1"
  local volume_name="$2"
  if ! flyctl volumes list -a "$app" | grep -q "$volume_name"; then
    flyctl volumes create "$volume_name" --app "$app" --region "$REGION" --size 10 -y
  fi
}

set_secrets() {
  local app="$1"
  shift
  local keys=("$@")
  local pairs=()
  local key value
  for key in "${keys[@]}"; do
    value="$(resolve_value "$key")"
    if [[ -n "$value" ]]; then
      pairs+=("${key}=${value}")
    fi
  done
  if [[ ${#pairs[@]} -gt 0 ]]; then
    flyctl secrets set -a "$app" "${pairs[@]}"
  fi
}

require_bin flyctl

if [[ -z "${FLY_API_TOKEN:-}" ]]; then
  if ! flyctl auth whoami >/dev/null 2>&1; then
    echo "Set FLY_API_TOKEN or FLY_ORG_TOKEN before deploying, or log in with flyctl auth login." >&2
    exit 1
  fi
fi

case "$TARGET" in
  daemon)
    APP_NAME="${APP_NAME:-my-solanaos}"
    CONFIG_PATH="${CONFIG_PATH:-${PROJECT_ROOT}/fly.toml}"

    ensure_app_exists "$APP_NAME"
    ensure_volume "$APP_NAME" "solanaos_data"

    if [[ "$SKIP_SECRETS" != true ]]; then
      set_secrets "$APP_NAME" \
        HELIUS_API_KEY HELIUS_RPC_URL HELIUS_WSS_URL \
        SOLANA_TRACKER_API_KEY SOLANA_TRACKER_RPC_URL SOLANA_TRACKER_DATA_API_KEY SOLANA_TRACKER_DATASTREAM_KEY \
        JUPITER_API_KEY JUPITER_ENDPOINT \
        TELEGRAM_BOT_TOKEN TELEGRAM_ID TELEGRAM_ALLOW_FROM TELEGRAM_PROXY TELEGRAM_API_BASE \
        OPENROUTER_API_KEY OPENROUTER_MODEL \
        TOGETHER_API_KEY TOGETHER_MODEL \
        XAI_API_KEY XAI_MODEL XAI_BASE_URL \
        HONCHO_ENABLED HONCHO_BASE_URL HONCHO_API_KEY HONCHO_WORKSPACE_ID HONCHO_AGENT_PEER_ID \
        HYPERLIQUID_ENABLED HYPERLIQUID_PRIVATE_KEY HYPERLIQUID_WALLET HYPERLIQUID_TESTNET \
        ASTER_API_KEY ASTER_API_SECRET ASTER_WALLET_ADDRESS ASTER_PRIVATE_KEY ASTER_USER_ADDRESS ASTER_SIGNER_ADDRESS \
        CONVEX_ENABLED CONVEX_URL CONVEX_DEPLOY_KEY \
        AGENT_REGISTRY_ENABLED AGENT_REGISTRY_RPC_URL AGENT_REGISTRY_INDEXER_API_KEY AGENT_REGISTRY_PINATA_JWT \
        MAWDAXE_API_BASE MAWDAXE_API_KEY MAWDAXE_DEVICE_ID
    fi

    flyctl deploy --remote-only --config "$CONFIG_PATH" --app "$APP_NAME"
    ;;
  mawdaxe)
    APP_NAME="${APP_NAME:-my-mawdaxe}"
    CONFIG_PATH="${CONFIG_PATH:-${PROJECT_ROOT}/mawdbot-bitaxe/fly.toml}"

    miner_host="$(resolve_value BITAXE_IP)"
    if [[ -z "$miner_host" ]]; then
      devices="$(resolve_value MAWDAXE_DEVICES)"
      miner_host="$(printf '%s' "$devices" | cut -d, -f1 | tr -d ' ')"
    fi

    if [[ -z "$miner_host" ]]; then
      echo "Set BITAXE_IP or MAWDAXE_DEVICES before deploying MawdAxe." >&2
      exit 1
    fi

    if private_ip "$miner_host" && [[ "$FORCE_PRIVATE_MINER" != true ]]; then
      cat >&2 <<EOF
Refusing to deploy MawdAxe to Fly because the miner host looks private: $miner_host

Fly cannot directly reach a home 192.168.x.x / 10.x.x.x / 172.16-31.x.x Bitaxe.
Recommended topology:
  1. Deploy the main SolanaOS daemon to Fly
  2. Run MawdAxe on the LAN or Tailscale host next to the Bitaxe
  3. Point the Fly daemon at MAWDAXE_API_BASE with an API key

If you already have private networking from Fly to the miner and know what you're doing,
rerun with --force-private-miner.
EOF
      exit 1
    fi

    ensure_app_exists "$APP_NAME"

    if [[ "$SKIP_SECRETS" != true ]]; then
      set_secrets "$APP_NAME" \
        BITAXE_IP MAWDAXE_DEVICES \
        POOL_PRESET POOL_URL POOL_PORT POOL_USER POOL_PASS \
        MAWDAXE_API_KEY MAWDAXE_TELEGRAM_BOT_TOKEN MAWDAXE_TELEGRAM_ID MAWDAXE_TELEGRAM_BOT_NAME \
        MAWDAXE_WEBHOOK_URL MAWDAXE_ALERT_COOLDOWN PARASITE_ENABLED PARASITE_API_URL
    fi

    flyctl deploy --remote-only --config "$CONFIG_PATH" --app "$APP_NAME"
    ;;
  *)
    echo "Unknown target: $TARGET" >&2
    usage
    exit 1
    ;;
esac
