#!/usr/bin/env bash
# Safe Bitaxe -> SolanaOS -> Seeker quickstart.
# Local-first by design:
# - discovers a Bitaxe on the LAN
# - optionally configures its mining pool
# - writes only local SolanaOS Bitaxe env vars
# - generates a Seeker setup bundle that points at the local SolanaOS gateway
# - does not expose Bitaxe or MawdAxe ports publicly
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
ENV_TEMPLATE="$PROJECT_ROOT/.env.example"
CONNECT_BUNDLE_SCRIPT="$PROJECT_ROOT/scripts/write-connect-bundle.sh"

DEFAULT_POOL_URL="stratum+tcp://solo.ckpool.org:3333"
POLL_INTERVAL="${BITAXE_POLL_INTERVAL:-10}"
MAX_TEMP_C="${BITAXE_MAX_TEMP_C:-72}"
COOL_TEMP_C="${BITAXE_COOL_TEMP_C:-50}"
MAX_FREQ_MHZ="${BITAXE_MAX_FREQ_MHZ:-600}"
MIN_FREQ_MHZ="${BITAXE_MIN_FREQ_MHZ:-400}"
AUTO_TUNE="${BITAXE_AUTO_TUNE:-true}"
PET_NAME="${BITAXE_PET_NAME:-MawdPet}"
SCAN_TIMEOUT=1

BITAXE_HOST_INPUT="${BITAXE_HOST:-}"
BTC_WALLET_INPUT="${BTC_WALLET:-}"
POOL_URL_INPUT="${POOL_URL:-$DEFAULT_POOL_URL}"
SKIP_POOL_CONFIG=false
SKIP_CONNECT_BUNDLE=false

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}[bitaxe]${NC} $*"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $*"; }
error() { echo -e "${RED}[error]${NC} $*" >&2; }
step()  { echo -e "${CYAN}[step]${NC}  $*"; }

usage() {
  cat <<'EOF'
Usage:
  bash scripts/bitaxe-quickstart.sh [options]

Options:
  --host <ip>              Use a specific Bitaxe IP instead of scanning
  --wallet <btc-address>   Configure the miner with this BTC payout address
  --pool <stratum-url>     Pool URL, default: stratum+tcp://solo.ckpool.org:3333
  --skip-pool-config       Do not modify AxeOS pool settings
  --skip-connect-bundle    Do not generate the Seeker setup bundle
  --help                   Show this help

Examples:
  bash scripts/bitaxe-quickstart.sh --wallet bc1q...
  bash scripts/bitaxe-quickstart.sh --host 192.168.1.42 --wallet bc1q...
  bash scripts/bitaxe-quickstart.sh --skip-pool-config
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      BITAXE_HOST_INPUT="${2:?missing value for --host}"
      shift 2
      ;;
    --wallet)
      BTC_WALLET_INPUT="${2:?missing value for --wallet}"
      shift 2
      ;;
    --pool)
      POOL_URL_INPUT="${2:?missing value for --pool}"
      shift 2
      ;;
    --skip-pool-config)
      SKIP_POOL_CONFIG=true
      shift
      ;;
    --skip-connect-bundle)
      SKIP_CONNECT_BUNDLE=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      error "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

detect_default_iface() {
  if [[ "$(uname)" == "Darwin" ]]; then
    route -n get default 2>/dev/null | awk '/interface:/{print $2}' | head -1
  else
    ip route show default 2>/dev/null | awk '/default/{print $5}' | head -1
  fi
}

detect_local_ip() {
  local iface="$1"
  if [[ -z "$iface" ]]; then
    return 1
  fi
  if [[ "$(uname)" == "Darwin" ]]; then
    ipconfig getifaddr "$iface" 2>/dev/null || true
  else
    ip -4 addr show "$iface" 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1 | head -1
  fi
}

detect_subnet_prefix() {
  local ip="$1"
  [[ -n "$ip" ]] || return 1
  printf '%s.' "${ip%.*}"
}

scan_for_bitaxe() {
  local subnet="$1"
  step "Scanning ${subnet}0/24 for Bitaxe devices..."

  local found=()
  local host resp
  for i in $(seq 1 254); do
    host="${subnet}${i}"
    resp="$(curl -sf --max-time "$SCAN_TIMEOUT" "http://${host}/api/system/info" 2>/dev/null || true)"
    if printf '%s' "$resp" | grep -q "ASICModel"; then
      found+=("$host")
    fi
  done

  if [[ ${#found[@]} -eq 0 ]]; then
    return 1
  fi

  printf '%s\n' "${found[0]}"
}

verify_bitaxe() {
  local host="$1"
  local resp model hr
  resp="$(curl -sf --max-time 5 "http://${host}/api/system/info" 2>/dev/null || true)"
  if ! printf '%s' "$resp" | grep -q "ASICModel"; then
    return 1
  fi
  model="$(printf '%s' "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ASICModel','Unknown'))" 2>/dev/null || echo "Unknown")"
  hr="$(printf '%s' "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"{d.get('hashRate',0):.1f}\")" 2>/dev/null || echo "0")"
  info "Found Bitaxe: model=${model} hashrate=${hr} GH/s @ ${host}"
}

ensure_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    return 0
  fi
  if [[ -f "$ENV_TEMPLATE" ]]; then
    cp "$ENV_TEMPLATE" "$ENV_FILE"
    info "Created local .env from .env.example"
    return 0
  fi
  : > "$ENV_FILE"
  warn "Created empty .env at $ENV_FILE"
}

update_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

write_solanaos_bitaxe_config() {
  local host="$1"
  local pool_host="$2"
  local pool_port="$3"
  local wallet="$4"

  ensure_env_file

  update_env "BITAXE_HOST" "$host"
  update_env "BITAXE_ENABLED" "true"
  update_env "BITAXE_POLL_INTERVAL" "$POLL_INTERVAL"
  update_env "BITAXE_AUTO_TUNE" "$AUTO_TUNE"
  update_env "BITAXE_MAX_TEMP_C" "$MAX_TEMP_C"
  update_env "BITAXE_COOL_TEMP_C" "$COOL_TEMP_C"
  update_env "BITAXE_MAX_FREQ_MHZ" "$MAX_FREQ_MHZ"
  update_env "BITAXE_MIN_FREQ_MHZ" "$MIN_FREQ_MHZ"
  update_env "BITAXE_PET_NAME" "$PET_NAME"

  if [[ -n "$pool_host" ]]; then
    update_env "BITAXE_POOL_URL" "$pool_host"
  fi
  if [[ -n "$pool_port" ]]; then
    update_env "BITAXE_POOL_PORT" "$pool_port"
  fi
  if [[ -n "$wallet" ]]; then
    update_env "BITAXE_POOL_USER" "$wallet"
  fi

  rm -f "${ENV_FILE}.bak"
  info "Updated SolanaOS Bitaxe config in $ENV_FILE"
}

parse_pool_host() {
  local pool_url="$1"
  printf '%s' "$pool_url" | sed 's|^[a-zA-Z+]*://||' | cut -d: -f1
}

parse_pool_port() {
  local pool_url="$1"
  printf '%s' "$pool_url" | sed 's|^[a-zA-Z+]*://||' | cut -d: -f2
}

configure_pool() {
  local host="$1"
  local wallet="$2"
  local pool_url="$3"

  local pool_host port payload
  pool_host="$(parse_pool_host "$pool_url")"
  port="$(parse_pool_port "$pool_url")"

  if [[ -z "$wallet" ]]; then
    error "BTC wallet address is required to configure the miner pool."
    exit 1
  fi
  if [[ -z "$pool_host" || -z "$port" ]]; then
    error "Could not parse pool URL: $pool_url"
    exit 1
  fi

  step "Configuring AxeOS pool: ${pool_host}:${port}"
  payload="$(printf '{"stratumURL":"%s","stratumPort":%d,"stratumUser":"%s","stratumPassword":"x"}' "$pool_host" "$port" "$wallet")"

  curl -sf -X POST \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "http://${host}/api/system" >/dev/null

  curl -sf -X POST "http://${host}/api/system/restart" >/dev/null || true
  info "Pool updated and restart signal sent."
}

show_performance_snapshot() {
  local host="$1"
  local resp freq temp hr
  resp="$(curl -sf --max-time 5 "http://${host}/api/system/info" 2>/dev/null || true)"
  freq="$(printf '%s' "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('frequency',0))" 2>/dev/null || echo "0")"
  temp="$(printf '%s' "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('temp',0))" 2>/dev/null || echo "0")"
  hr="$(printf '%s' "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"{d.get('hashRate',0):.1f}\")" 2>/dev/null || echo "0")"

  info "Current miner state: ${hr} GH/s, ${temp}C, ${freq} MHz"
  if [[ "$temp" =~ ^[0-9.]+$ ]] && awk "BEGIN {exit !($temp > 65)}"; then
    warn "Temperature is high. Improve airflow before increasing frequency."
  fi
}

generate_seeker_bundle() {
  local local_ip="$1"
  if [[ "$SKIP_CONNECT_BUNDLE" == true ]]; then
    warn "Skipping Seeker connect bundle generation."
    return 0
  fi
  if [[ ! -x "$CONNECT_BUNDLE_SCRIPT" && ! -f "$CONNECT_BUNDLE_SCRIPT" ]]; then
    warn "Connect bundle script not found at $CONNECT_BUNDLE_SCRIPT"
    return 0
  fi
  if [[ -z "$local_ip" ]]; then
    warn "Could not determine a LAN IP for the SolanaOS gateway. Skipping setup-code generation."
    return 0
  fi

  local gateway_url="http://${local_ip}:18790"
  local bundle_path
  bundle_path="$(bash "$CONNECT_BUNDLE_SCRIPT" --env-file "$ENV_FILE" --gateway-url "$gateway_url")"
  info "Generated Seeker setup bundle at $bundle_path"
}

print_safety_notes() {
  cat <<EOF

Safety rules:
  1. Keep Bitaxe and SolanaOS on your LAN or Tailscale. Do not port-forward Bitaxe AxeOS or MawdAxe to the public internet.
  2. Pair Seeker through the SolanaOS gateway setup code, not by exposing the miner directly.
  3. Use your own BTC payout address. This script will not silently configure a default wallet.
EOF
}

main() {
  echo
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║      Bitaxe -> SolanaOS -> Seeker Safe Setup        ║"
  echo "╚══════════════════════════════════════════════════════╝"

  print_safety_notes
  echo

  local iface local_ip subnet bitaxe_host pool_host pool_port
  iface="$(detect_default_iface || true)"
  local_ip="$(detect_local_ip "$iface" || true)"
  subnet="$(detect_subnet_prefix "$local_ip" || true)"

  bitaxe_host="$(trim "$BITAXE_HOST_INPUT")"
  if [[ -z "$bitaxe_host" ]]; then
    if [[ -z "$subnet" ]]; then
      warn "Could not detect the local subnet automatically."
      read -r -p "Enter your Bitaxe IP manually: " bitaxe_host
    else
      bitaxe_host="$(scan_for_bitaxe "$subnet" || true)"
    fi
  fi

  if [[ -z "$bitaxe_host" ]]; then
    error "No Bitaxe found. Re-run with --host <ip> after the miner is on your WiFi."
    exit 1
  fi

  if ! verify_bitaxe "$bitaxe_host"; then
    error "Host $bitaxe_host does not look like a Bitaxe AxeOS device."
    exit 1
  fi

  if [[ "$SKIP_POOL_CONFIG" != true ]]; then
    if [[ -z "$(trim "$BTC_WALLET_INPUT")" ]]; then
      read -r -p "Enter your BTC payout address: " BTC_WALLET_INPUT
    fi
    BTC_WALLET_INPUT="$(trim "$BTC_WALLET_INPUT")"
    if [[ -z "$BTC_WALLET_INPUT" ]]; then
      error "A BTC payout address is required unless you use --skip-pool-config."
      exit 1
    fi
    configure_pool "$bitaxe_host" "$BTC_WALLET_INPUT" "$POOL_URL_INPUT"
  else
    warn "Leaving AxeOS pool settings unchanged."
  fi

  pool_host="$(parse_pool_host "$POOL_URL_INPUT")"
  pool_port="$(parse_pool_port "$POOL_URL_INPUT")"
  write_solanaos_bitaxe_config "$bitaxe_host" "$pool_host" "$pool_port" "$(trim "$BTC_WALLET_INPUT")"
  generate_seeker_bundle "$local_ip"

  echo
  step "Performance snapshot"
  show_performance_snapshot "$bitaxe_host"

  cat <<EOF

Next steps:
  1. Start the local SolanaOS daemon:
       solanaos daemon

  2. Start the local gateway for Seeker pairing:
       solanaos gateway start --no-tailscale

  3. Open the setup code for your Seeker app:
       cat ~/.solanaos/connect/setup-code.txt

  4. In the Android Seeker app:
       Connect -> Setup Code -> paste setup-code.txt

  5. Verify the miner inside SolanaOS:
       curl http://127.0.0.1:7777/api/miner

Local miner:
  AxeOS UI:      http://${bitaxe_host}
  AxeOS system:  http://${bitaxe_host}/api/system/info

Hub note:
  If you later run standalone MawdAxe, connect NanoHub to a LAN or Tailscale URL only.
  Do not expose port 8420 publicly.
EOF
}

main "$@"
