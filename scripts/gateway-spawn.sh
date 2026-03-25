#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# SolanaOS Gateway :: Spawn Script
#
# Orchestrates: Tailscale check → tmux session → OpenClaw gateway start
# Designed for remote access via Termius/SSH.
#
# Usage:
#   ./scripts/gateway-spawn.sh              # default port 18790
#   ./scripts/gateway-spawn.sh --port 19001 # custom port
#   ./scripts/gateway-spawn.sh --kill       # stop the gateway
#   ./scripts/gateway-spawn.sh --status     # check if running
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

GREEN='\033[1;38;2;20;241;149m'
PURPLE='\033[1;38;2;153;69;255m'
TEAL='\033[1;38;2;0;212;255m'
RED='\033[1;38;2;255;64;96m'
AMBER='\033[1;38;2;255;170;0m'
DIM='\033[38;2;85;102;128m'
RESET='\033[0m'

SESSION_NAME="nanoclaw-gw"
PORT=18790
FORCE=""
ACTION="spawn"

# ── Parse args ────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --port)   PORT="$2"; shift 2 ;;
    --force)  FORCE="--force"; shift ;;
    --kill)   ACTION="kill"; shift ;;
    --status) ACTION="status"; shift ;;
    --session) SESSION_NAME="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: gateway-spawn.sh [--port N] [--force] [--kill] [--status] [--session NAME]"
      exit 0 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

# ── Kill ──────────────────────────────────────────────────────────────
if [[ "$ACTION" == "kill" ]]; then
  if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    tmux kill-session -t "$SESSION_NAME"
    echo -e "${GREEN}  ✔${RESET} Gateway session '${SESSION_NAME}' killed"
  else
    echo -e "${DIM}  ⚠  No session '${SESSION_NAME}' found${RESET}"
  fi
  exit 0
fi

# ── Status ────────────────────────────────────────────────────────────
if [[ "$ACTION" == "status" ]]; then
  if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo -e "${GREEN}  ● Gateway running${RESET} in tmux session '${SESSION_NAME}'"
    TS_IP=$(tailscale ip -4 2>/dev/null || echo "")
    if [[ -n "$TS_IP" ]]; then
      echo -e "    ${TEAL}Bridge:${RESET} ${TS_IP}:${PORT}"
      echo -e "    ${DIM}Termius:${RESET} ssh user@${TS_IP}"
    fi
    echo -e "    ${DIM}Attach:${RESET} tmux attach -t ${SESSION_NAME}"
  else
    echo -e "${RED}  ○ Gateway not running${RESET}"
  fi
  exit 0
fi

# ── Spawn ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}    🦞 SolanaOS Gateway Spawn${RESET}"
echo -e "${DIM}    ────────────────────────────────${RESET}"
echo ""

# Pre-flight: tmux
if ! command -v tmux &>/dev/null; then
  echo -e "${RED}  ✗ tmux not found${RESET}"
  echo -e "${DIM}    Install: brew install tmux (macOS) or apt install tmux (Linux)${RESET}"
  exit 1
fi
echo -e "  ${GREEN}✔${RESET} tmux"

# Pre-flight: openclaw
if ! command -v openclaw &>/dev/null; then
  echo -e "${RED}  ✗ openclaw not found${RESET}"
  echo -e "${DIM}    Install: npm install -g openclaw${RESET}"
  exit 1
fi
OC_VERSION=$(openclaw --version 2>/dev/null | head -1 || echo "unknown")
echo -e "  ${GREEN}✔${RESET} openclaw (${OC_VERSION})"

# Pre-flight: tailscale
TS_IP=""
if command -v tailscale &>/dev/null; then
  TS_IP=$(tailscale ip -4 2>/dev/null || echo "")
  if [[ -n "$TS_IP" ]]; then
    echo -e "  ${GREEN}✔${RESET} tailscale (${TS_IP})"
  else
    echo -e "  ${AMBER}⚠${RESET} tailscale installed but no IP (not connected?)"
  fi
else
  echo -e "  ${DIM}⚠  tailscale not found — gateway will bind to localhost only${RESET}"
fi

echo ""

# Check existing session
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo -e "  ${AMBER}⚠${RESET} Gateway already running in tmux session '${SESSION_NAME}'"
  echo -e "    ${DIM}Attach:${RESET} tmux attach -t ${SESSION_NAME}"
  if [[ -n "$TS_IP" ]]; then
    echo -e "    ${TEAL}Bridge:${RESET} ${TS_IP}:${PORT}"
  fi
  exit 0
fi

# Build gateway command
GW_CMD="openclaw gateway --port ${PORT}"
if [[ -n "$FORCE" ]]; then
  GW_CMD="${GW_CMD} --force"
fi

# Spawn in tmux
echo -e "  ${TEAL}⏳${RESET} Spawning gateway on port ${PORT}..."
tmux new-session -d -s "$SESSION_NAME" -n gateway "$GW_CMD"

# Wait for gateway to start
sleep 2

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo -e "  ${GREEN}✔${RESET} Gateway running in tmux session '${SESSION_NAME}'"
else
  echo -e "  ${RED}✗${RESET} Gateway failed to start — check: tmux attach -t ${SESSION_NAME}"
  exit 1
fi

echo ""
echo -e "${GREEN}    ┌──────────────────────────────────────────────┐${RESET}"
echo -e "${GREEN}    │${RESET}  ${PURPLE}🦞 SolanaOS Gateway Ready${RESET}                     ${GREEN}│${RESET}"
echo -e "${GREEN}    │${RESET}                                              ${GREEN}│${RESET}"

if [[ -n "$TS_IP" ]]; then
  BRIDGE="${TS_IP}:${PORT}"
  printf "${GREEN}    │${RESET}  ${TEAL}Bridge:${RESET} %-37s ${GREEN}│${RESET}\n" "$BRIDGE"
  echo -e "${GREEN}    │${RESET}                                              ${GREEN}│${RESET}"
  echo -e "${GREEN}    │${RESET}  ${DIM}Connect from hardware node:${RESET}                   ${GREEN}│${RESET}"
  printf "${GREEN}    │${RESET}  ${AMBER}mawdbot node run -bridge %-20s${RESET} ${GREEN}│${RESET}\n" "$BRIDGE"
  echo -e "${GREEN}    │${RESET}                                              ${GREEN}│${RESET}"
  echo -e "${GREEN}    │${RESET}  ${DIM}Pair a new node:${RESET}                              ${GREEN}│${RESET}"
  printf "${GREEN}    │${RESET}  ${AMBER}mawdbot node pair -bridge %-19s${RESET} ${GREEN}│${RESET}\n" "$BRIDGE"
else
  BRIDGE="127.0.0.1:${PORT}"
  printf "${GREEN}    │${RESET}  ${TEAL}Bridge:${RESET} %-37s ${GREEN}│${RESET}\n" "$BRIDGE"
fi

echo -e "${GREEN}    │${RESET}                                              ${GREEN}│${RESET}"
echo -e "${GREEN}    │${RESET}  ${DIM}Attach:${RESET}  tmux attach -t ${SESSION_NAME}       ${GREEN}│${RESET}"
echo -e "${GREEN}    │${RESET}  ${DIM}Kill:${RESET}    ./scripts/gateway-spawn.sh --kill    ${GREEN}│${RESET}"
echo -e "${GREEN}    └──────────────────────────────────────────────┘${RESET}"
echo ""
