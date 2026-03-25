#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# SolanaOS — macOS LaunchAgent Installer
#
# Installs the SolanaOS daemon as a persistent macOS LaunchAgent.
# Auto-starts at login, auto-restarts on crash, survives reboots.
#
# Usage:
#   ./scripts/install-service.sh           # install
#   ./scripts/install-service.sh --with-mawdaxe  # install daemon + MawdAxe service
#   ./scripts/install-service.sh --unload  # stop + disable
#   ./scripts/install-service.sh --status  # check status
#
# Logs:
#   ~/Library/Logs/solanaos/daemon.out.log
#   ~/Library/Logs/solanaos/daemon.err.log
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

GREEN='\033[38;2;20;241;149m'
AMBER='\033[38;2;255;179;71m'
DIM='\033[38;2;85;102;128m'
RESET='\033[0m'

launchctl_pid() {
  local label="$1"
  launchctl list 2>/dev/null | awk -v target="$label" '$3 == target { print $1; found=1 } END { if (!found) exit 1 }'
}

LABEL="com.solanaos.daemon"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="$HOME/Library/Logs/solanaos"
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MAWDAXE_LABEL="com.8bitlabs.mawdaxe"
MAWDAXE_PLIST="$HOME/Library/LaunchAgents/${MAWDAXE_LABEL}.plist"
MAWDAXE_DIR="$PROJECT_ROOT/mawdbot-bitaxe"
MAWDAXE_BINARY="$MAWDAXE_DIR/bin/mawdaxe"
MAWDAXE_LOG_DIR="$HOME/Library/Logs/mawdaxe"
MAWDAXE_ENV_FILE="$MAWDAXE_DIR/.env"

# Prefer the local repo build so the LaunchAgent follows the current workspace binary.
BINARY="$PROJECT_ROOT/build/solanaos"
if [ ! -x "$BINARY" ]; then
  BINARY="$PROJECT_ROOT/dist/SolanaOS.app/Contents/MacOS/solanaos"
fi
if [ ! -x "$BINARY" ]; then
  BINARY="$PROJECT_ROOT/dist/solanaos-universal"
fi
if [ ! -x "$BINARY" ]; then
  # Fall back to CLI shims in PATH.
  BINARY="$(command -v solanaos 2>/dev/null || echo "")"
fi
if [ -z "$BINARY" ] || [ ! -x "$BINARY" ]; then
  echo -e "${AMBER}  ❌ SolanaOS binary not found. Run 'make build' first, or ensure solanaos is in PATH.${RESET}"
  exit 1
fi

# ── Flags ──────────────────────────────────────────────────────────
ACTION="install"
WITH_MAWDAXE=0
for arg in "$@"; do
  case "$arg" in
    --unload|--remove|--uninstall) ACTION="unload" ;;
    --status) ACTION="status" ;;
    --with-mawdaxe) WITH_MAWDAXE=1 ;;
  esac
done

# ── Status ─────────────────────────────────────────────────────────
if [ "$ACTION" = "status" ]; then
  echo -e "\n${GREEN}🤖 SolanaOS Daemon Status${RESET}"
  if PID="$(launchctl_pid "$LABEL" 2>/dev/null)"; then
    echo -e "${GREEN}  ✅ Running (PID: $PID)${RESET}"
  else
    echo -e "${AMBER}  ⚠️  Not running${RESET}"
  fi
  if [ -f "$PLIST" ]; then
    echo -e "${DIM}  Plist: $PLIST${RESET}"
  fi
  if [ -f "$LOG_DIR/daemon.err.log" ]; then
    echo -e "\n${DIM}  Last 5 error log lines:${RESET}"
    tail -5 "$LOG_DIR/daemon.err.log" | sed "s/^/  ${DIM}/" | sed "s/$/${RESET}/"
  fi
  if [ -f "$MAWDAXE_PLIST" ] || [ "$WITH_MAWDAXE" = "1" ]; then
    echo -e "\n${GREEN}⛏️ MawdAxe Service Status${RESET}"
    if PID="$(launchctl_pid "$MAWDAXE_LABEL" 2>/dev/null)"; then
      echo -e "${GREEN}  ✅ Running (PID: $PID)${RESET}"
    else
      echo -e "${AMBER}  ⚠️  Not running${RESET}"
    fi
    if [ -f "$MAWDAXE_PLIST" ]; then
      echo -e "${DIM}  Plist: $MAWDAXE_PLIST${RESET}"
    fi
    if [ -f "$MAWDAXE_LOG_DIR/mawdaxe-error.log" ]; then
      echo -e "\n${DIM}  Last 5 MawdAxe error log lines:${RESET}"
      tail -5 "$MAWDAXE_LOG_DIR/mawdaxe-error.log" | sed "s/^/  ${DIM}/" | sed "s/$/${RESET}/"
    fi
  fi
  exit 0
fi

# ── Unload ─────────────────────────────────────────────────────────
if [ "$ACTION" = "unload" ]; then
  echo -e "\n${GREEN}🛑 Unloading SolanaOS daemon...${RESET}"
  launchctl unload "$PLIST" 2>/dev/null && echo -e "${GREEN}  ✅ Daemon stopped${RESET}" || echo -e "${DIM}  (was not loaded)${RESET}"
  rm -f "$PLIST"
  echo -e "${GREEN}  ✅ Plist removed${RESET}"
  if [ -f "$MAWDAXE_PLIST" ] || [ "$WITH_MAWDAXE" = "1" ]; then
    echo -e "\n${GREEN}🛑 Unloading MawdAxe service...${RESET}"
    launchctl unload "$MAWDAXE_PLIST" 2>/dev/null && echo -e "${GREEN}  ✅ MawdAxe stopped${RESET}" || echo -e "${DIM}  (was not loaded)${RESET}"
    rm -f "$MAWDAXE_PLIST"
    echo -e "${GREEN}  ✅ MawdAxe plist removed${RESET}"
  fi
  exit 0
fi

# ── Install ────────────────────────────────────────────────────────
echo -e "\n${GREEN}🤖 Installing SolanaOS LaunchAgent${RESET}"
echo -e "${DIM}  Binary: $BINARY${RESET}"
echo -e "${DIM}  Plist:  $PLIST${RESET}"
echo -e "${DIM}  Logs:   $LOG_DIR${RESET}\n"
if [ "$WITH_MAWDAXE" = "1" ]; then
  echo -e "${DIM}  MawdAxe: $MAWDAXE_DIR${RESET}"
  echo -e "${DIM}  MawdAxe plist: $MAWDAXE_PLIST${RESET}\n"
fi

mkdir -p "$LOG_DIR"
mkdir -p "$HOME/Library/LaunchAgents"
if [ "$WITH_MAWDAXE" = "1" ]; then
  mkdir -p "$MAWDAXE_LOG_DIR"
fi

# Unload if already installed
launchctl unload "$PLIST" 2>/dev/null || true

# Build env dict from .env file
ENV_DICT=""
if [ -f "$ENV_FILE" ]; then
  while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ "$key" =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    key="$(echo "$key" | xargs)"
    value="$(echo "$value" | xargs)"
    [[ -z "$value" ]] && continue
    ENV_DICT="${ENV_DICT}
        <key>${key}</key>
        <string>${value}</string>"
  done < "$ENV_FILE"
fi

if [ "$WITH_MAWDAXE" = "1" ]; then
  ENV_DICT="${ENV_DICT}
        <key>MAWDAXE_API_BASE</key>
        <string>http://127.0.0.1:8420</string>"
  if [ -f "$MAWDAXE_ENV_FILE" ]; then
    MAWDAXE_API_KEY_VALUE="$(grep -E '^MAWDAXE_API_KEY=' "$MAWDAXE_ENV_FILE" | tail -1 | cut -d= -f2- | xargs || true)"
    if [ -n "$MAWDAXE_API_KEY_VALUE" ]; then
      ENV_DICT="${ENV_DICT}
        <key>MAWDAXE_API_KEY</key>
        <string>${MAWDAXE_API_KEY_VALUE}</string>"
    fi
  fi
fi

# Write plist
cat > "$PLIST" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${BINARY}</string>
        <string>daemon</string>
    </array>

    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>${HOME}</string>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>${ENV_DICT}
    </dict>

    <key>WorkingDirectory</key>
    <string>${HOME}</string>

    <!-- Start at login -->
    <key>RunAtLoad</key>
    <true/>

    <!-- Restart on crash (after 10s cooldown) -->
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>10</integer>

    <!-- Logs -->
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/daemon.out.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/daemon.err.log</string>

    <!-- Nice priority (don't starve other apps) -->
    <key>ProcessType</key>
    <string>Background</string>
    <key>Nice</key>
    <integer>5</integer>
</dict>
</plist>
PLIST_EOF

# Load it
launchctl load -w "$PLIST"
sleep 1

if [ "$WITH_MAWDAXE" = "1" ]; then
  if [ ! -d "$MAWDAXE_DIR" ]; then
    echo -e "${AMBER}  ❌ MawdAxe source directory not found at $MAWDAXE_DIR${RESET}"
    exit 1
  fi
  if [ ! -f "$MAWDAXE_ENV_FILE" ]; then
    echo -e "${AMBER}  ⚠️  No MawdAxe .env found at $MAWDAXE_ENV_FILE. The service will rely on exported env vars only.${RESET}"
  fi
  if [ ! -x "$MAWDAXE_BINARY" ]; then
    echo -e "${DIM}  Building MawdAxe binary...${RESET}"
    (
      cd "$MAWDAXE_DIR"
      go build -o "$MAWDAXE_BINARY" ./cmd/mawdaxe
    )
  fi

  launchctl unload "$MAWDAXE_PLIST" 2>/dev/null || true

  cat > "$MAWDAXE_PLIST" << MAWDAXE_PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${MAWDAXE_LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${MAWDAXE_BINARY}</string>
    </array>

    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>${HOME}</string>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>

    <key>WorkingDirectory</key>
    <string>${MAWDAXE_DIR}</string>

    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>10</integer>

    <key>StandardOutPath</key>
    <string>${MAWDAXE_LOG_DIR}/mawdaxe.log</string>
    <key>StandardErrorPath</key>
    <string>${MAWDAXE_LOG_DIR}/mawdaxe-error.log</string>

    <key>ProcessType</key>
    <string>Background</string>
    <key>Nice</key>
    <integer>5</integer>
</dict>
</plist>
MAWDAXE_PLIST_EOF

  launchctl load -w "$MAWDAXE_PLIST"
  sleep 1
fi

# Verify
if PID="$(launchctl_pid "$LABEL" 2>/dev/null)"; then
  echo -e "${GREEN}  ✅ Daemon loaded (PID: $PID)${RESET}"
  echo -e "${DIM}  Auto-starts at login · Restarts on crash${RESET}"
  echo ""
  echo -e "  ${DIM}Logs:${RESET}    tail -f $LOG_DIR/daemon.out.log"
  echo -e "  ${DIM}Errors:${RESET}  tail -f $LOG_DIR/daemon.err.log"
  echo -e "  ${DIM}Stop:${RESET}    launchctl unload $PLIST"
  echo -e "  ${DIM}Status:${RESET}  ./scripts/install-service.sh --status"
  if [ "$WITH_MAWDAXE" = "1" ]; then
    if MPID="$(launchctl_pid "$MAWDAXE_LABEL" 2>/dev/null)"; then
      echo ""
      echo -e "${GREEN}  ✅ MawdAxe loaded (PID: $MPID)${RESET}"
      echo -e "${DIM}  Auto-starts at login · Restarts on crash${RESET}"
      echo -e "  ${DIM}MawdAxe logs:${RESET}   tail -f $MAWDAXE_LOG_DIR/mawdaxe.log"
      echo -e "  ${DIM}MawdAxe errors:${RESET} tail -f $MAWDAXE_LOG_DIR/mawdaxe-error.log"
    else
      echo ""
      echo -e "${AMBER}  ⚠️  MawdAxe did not start. Check logs:${RESET}"
      echo -e "  tail -20 $MAWDAXE_LOG_DIR/mawdaxe-error.log"
      exit 1
    fi
  fi
else
  echo -e "${AMBER}  ⚠️  Daemon did not start. Check logs:${RESET}"
  echo -e "  tail -20 $LOG_DIR/daemon.err.log"
  exit 1
fi
