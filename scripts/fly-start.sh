#!/usr/bin/env bash
set -euo pipefail

export SOLANAOS_HOME="${SOLANAOS_HOME:-/data/solanaos}"
export SOLANAOS_CONFIG="${SOLANAOS_CONFIG:-$SOLANAOS_HOME/config.json}"
export SOLANA_WALLET_KEY_PATH="${SOLANA_WALLET_KEY_PATH:-$SOLANAOS_HOME/wallet/agent-wallet.json}"
export SOLANAOS_SOUL_PATH="${SOLANAOS_SOUL_PATH:-/app/SOUL.md}"
export SOLANAOS_SKILLS_DIR="${SOLANAOS_SKILLS_DIR:-/app/skills}"

PORT="${PORT:-18800}"
WEB_FLAGS=(${SOLANAOS_WEB_FLAGS:-})
DAEMON_FLAGS=(${SOLANAOS_DAEMON_FLAGS:-})
SOLANAOS_BIN="/app/solanaos"
SOLANAOS_WEB_BIN="/app/solanaos-web"

mkdir -p \
  /data \
  "$SOLANAOS_HOME" \
  "$SOLANAOS_HOME/wallet" \
  "$SOLANAOS_HOME/registry" \
  "$SOLANAOS_HOME/workspace/vault/decisions" \
  "$SOLANAOS_HOME/workspace/vault/lessons" \
  "$SOLANAOS_HOME/workspace/vault/trades" \
  "$SOLANAOS_HOME/workspace/vault/research" \
  "$SOLANAOS_HOME/workspace/vault/inbox" \
  /root/.config/solana

if [[ ! -f "$SOLANAOS_CONFIG" ]]; then
  "$SOLANAOS_BIN" onboard >/dev/null 2>&1 || true
fi

pids=()

cleanup() {
  for pid in "${pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait || true
}

trap cleanup EXIT INT TERM

if [[ "${SOLANAOS_FLY_START_DAEMON:-true}" == "true" ]]; then
  echo "[fly-start] starting SolanaOS daemon"
  "$SOLANAOS_BIN" daemon "${DAEMON_FLAGS[@]}" &
  pids+=("$!")
fi

if [[ "${SOLANAOS_FLY_START_GATEWAY:-false}" == "true" ]]; then
  echo "[fly-start] starting native TCP gateway on ${SOLANAOS_FLY_GATEWAY_BIND:-0.0.0.0}:${SOLANAOS_FLY_GATEWAY_PORT:-18790}"
  "$SOLANAOS_BIN" gateway start \
    --no-tailscale \
    --bind "${SOLANAOS_FLY_GATEWAY_BIND:-0.0.0.0}" \
    --port "${SOLANAOS_FLY_GATEWAY_PORT:-18790}" &
  pids+=("$!")
fi

echo "[fly-start] starting SolanaOS web console on 0.0.0.0:${PORT}"
"$SOLANAOS_WEB_BIN" --public --no-browser --port "${PORT}" "${WEB_FLAGS[@]}" "$SOLANAOS_CONFIG" &
pids+=("$!")

wait -n "${pids[@]}"
