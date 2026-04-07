#!/usr/bin/env bash

set -euo pipefail

WORKSPACE="${HOME}/.solanaos"
INSTALL_DIR=""
ENV_FILE=""
CONTROL_API_URL="${SOLANAOS_CONTROL_API_URL:-http://127.0.0.1:7777}"
WEB_URL="${SOLANAOS_WEB_URL:-http://127.0.0.1:18800}"
GATEWAY_URL=""

while [ $# -gt 0 ]; do
  case "$1" in
    --workspace)
      WORKSPACE="${2:?missing value for --workspace}"
      shift 2
      ;;
    --install-dir)
      INSTALL_DIR="${2:?missing value for --install-dir}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:?missing value for --env-file}"
      shift 2
      ;;
    --control-api-url)
      CONTROL_API_URL="${2:?missing value for --control-api-url}"
      shift 2
      ;;
    --web-url)
      WEB_URL="${2:?missing value for --web-url}"
      shift 2
      ;;
    --gateway-url)
      GATEWAY_URL="${2:?missing value for --gateway-url}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
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

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  value="${value//$'\t'/\\t}"
  printf '%s' "$value"
}

read_env_file_value() {
  local key="$1"
  [ -n "$ENV_FILE" ] || return 1
  [ -f "$ENV_FILE" ] || return 1

  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  [ -n "$line" ] || return 1

  local value="${line#*=}"
  value="$(trim "$value")"
  if [ "${value#\"}" != "$value" ] && [ "${value%\"}" != "$value" ]; then
    value="${value#\"}"
    value="${value%\"}"
  elif [ "${value#\'}" != "$value" ] && [ "${value%\'}" != "$value" ]; then
    value="${value#\'}"
    value="${value%\'}"
  fi
  printf '%s' "$value"
}

resolve_value() {
  local current="$1"
  local key="$2"
  if [ -n "$current" ]; then
    printf '%s' "$current"
    return 0
  fi
  read_env_file_value "$key" || true
}

gateway_port="$(resolve_value "${GATEWAY_PORT:-}" "GATEWAY_PORT")"
if [ -z "$gateway_port" ]; then
  node_bridge_addr="$(resolve_value "${NODE_BRIDGE_ADDR:-}" "NODE_BRIDGE_ADDR")"
  if [ -n "$node_bridge_addr" ]; then
    gateway_port="${node_bridge_addr##*:}"
  fi
fi
gateway_port="$(trim "${gateway_port:-18790}")"
case "$gateway_port" in
  ''|*[!0-9]*)
    gateway_port="18790"
    ;;
esac

if [ -z "$GATEWAY_URL" ]; then
  GATEWAY_URL="http://127.0.0.1:${gateway_port}"
fi

auth_mode="$(trim "$(resolve_value "${GATEWAY_AUTH_MODE:-}" "GATEWAY_AUTH_MODE")")"
auth_token="$(trim "$(resolve_value "${GATEWAY_AUTH_TOKEN:-}" "GATEWAY_AUTH_TOKEN")")"
auth_password="$(trim "$(resolve_value "${GATEWAY_AUTH_PASSWORD:-}" "GATEWAY_AUTH_PASSWORD")")"
legacy_secret="$(trim "$(resolve_value "${NANO_GATEWAY_SECRET:-}" "NANO_GATEWAY_SECRET")")"

setup_secret=""
setup_field=""
if [ "$auth_mode" = "password" ] && [ -n "$auth_password" ]; then
  setup_secret="$auth_password"
  setup_field="password"
elif [ -n "$auth_token" ]; then
  setup_secret="$auth_token"
  setup_field="token"
elif [ -n "$legacy_secret" ]; then
  setup_secret="$legacy_secret"
  setup_field="token"
  if [ -z "$auth_mode" ]; then
    auth_mode="token"
  fi
fi

connect_dir="${WORKSPACE}/connect"
bundle_path="${connect_dir}/solanaos-connect.json"
setup_code_path="${connect_dir}/setup-code.txt"
qr_payload_path="${connect_dir}/setup-qr.json"
readme_path="${connect_dir}/README.txt"
mkdir -p "$connect_dir"
chmod 700 "$connect_dir" 2>/dev/null || true
umask 077

setup_payload="{\"url\":\"$(json_escape "$GATEWAY_URL")\""
if [ -n "$setup_field" ] && [ -n "$setup_secret" ]; then
  setup_payload="${setup_payload},\"${setup_field}\":\"$(json_escape "$setup_secret")\""
fi
setup_payload="${setup_payload}}"

setup_code="$(
  printf '%s' "$setup_payload" \
    | base64 \
    | tr -d '\n' \
    | tr '+/' '-_' \
    | tr -d '='
)"

cli_binary="${WORKSPACE}/bin/solanaos"
compat_binary="${WORKSPACE}/bin/solanaos"

cat > "$bundle_path" <<EOF
{
  "version": 1,
  "product": "SolanaOS",
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "workspace": "$(json_escape "$WORKSPACE")",
  "installDir": "$(json_escape "$INSTALL_DIR")",
  "cliBinary": "$(json_escape "$cli_binary")",
  "compatBinary": "$(json_escape "$compat_binary")",
  "control": {
    "apiUrl": "$(json_escape "$CONTROL_API_URL")"
  },
  "web": {
    "url": "$(json_escape "$WEB_URL")"
  },
  "gateway": {
    "url": "$(json_escape "$GATEWAY_URL")",
    "authMode": "$(json_escape "$auth_mode")",
    "secret": "$(json_escape "$setup_secret")"
  },
  "android": {
    "setupCode": "$(json_escape "$setup_code")"
  },
  "extension": {
    "apiUrl": "$(json_escape "$CONTROL_API_URL")",
    "setupCode": "$(json_escape "$setup_code")",
    "secret": "$(json_escape "$setup_secret")"
  },
  "macos": {
    "gatewayUrl": "$(json_escape "$GATEWAY_URL")",
    "secret": "$(json_escape "$setup_secret")"
  }
}
EOF

printf '%s\n' "$setup_code" > "$setup_code_path"
cat > "$qr_payload_path" <<EOF
{"setupCode":"$(json_escape "$setup_code")"}
EOF

cat > "$readme_path" <<EOF
SolanaOS Connect Bundle

Files:
- solanaos-connect.json : shared install-time handoff for macOS, Android, and the Chrome extension
- setup-code.txt        : paste this into Android or the Chrome extension
- setup-qr.json         : QR-friendly wrapper if you want to render the setup code as JSON

Defaults:
- SolanaOS Control API : ${CONTROL_API_URL}
- Web console          : ${WEB_URL}
- Native gateway       : ${GATEWAY_URL}

Gateway notes:
- The native bridge defaults to port 18790.
- Use \`solanaos gateway start --port <port>\` if your bridge is not on 18790.
- Use \`solanaos gateway start --no-tailscale\` if Seeker should connect over LAN/manual host instead of a Tailscale IP.
- After changing bridge host or port, regenerate this bundle so setup-code.txt matches the live gateway.

If you change gateway auth in .env, regenerate this bundle:
  make connect-bundle
EOF

chmod 600 "$bundle_path" "$setup_code_path" "$qr_payload_path" "$readme_path" 2>/dev/null || true

echo "$bundle_path"
