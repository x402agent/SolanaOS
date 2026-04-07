#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# SolanaOS Seeker APK Build
#
# Builds the Android ARM64 SolanaOS binary, then assembles the
# Android debug APK for the Seeker host app.
#
# Usage:
#   ./scripts/build-seeker-apk.sh
#   ./scripts/build-seeker-apk.sh --install
#   ./scripts/build-seeker-apk.sh --install --launch
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

GREEN='\033[38;2;20;241;149m'
DIM='\033[38;2;85;102;128m'
RESET='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/apps/android"
GRADLE_USER_HOME_DIR="${GRADLE_USER_HOME_DIR:-$ANDROID_DIR/.gradle-user}"
APK_GLOB="$ANDROID_DIR/app/build/outputs/apk/debug/solanaos-mobile-*-debug.apk"

echo -e "\n${GREEN}📱 SolanaOS Seeker APK Build${RESET}\n"

echo -e "${DIM}  [1/2] Building Android ARM64 SolanaOS binary...${RESET}"
"$ROOT_DIR/scripts/build-seeker.sh"

echo -e "${DIM}  [2/2] Assembling Android debug APK...${RESET}"
(
  cd "$ANDROID_DIR"
  GRADLE_USER_HOME="$GRADLE_USER_HOME_DIR" ./gradlew :app:assembleDebug
)

APK_PATH="$(ls -1 $APK_GLOB 2>/dev/null | tail -n 1 || true)"
if [ -z "$APK_PATH" ]; then
  echo -e "${DIM}  APK output not found under:${RESET} $APK_GLOB"
  exit 1
fi

echo -e "\n${GREEN}  ✅ APK built:${RESET} $APK_PATH"

INSTALL_FLAG=0
LAUNCH_FLAG=0
for arg in "$@"; do
  case "$arg" in
    --install) INSTALL_FLAG=1 ;;
    --launch) LAUNCH_FLAG=1 ;;
  esac
done

if [[ "$INSTALL_FLAG" == "1" ]]; then
  echo -e "${DIM}  Installing on connected device...${RESET}"
  adb install -r "$APK_PATH"
  echo -e "${GREEN}  ✅ Installed${RESET}"
fi

if [[ "$LAUNCH_FLAG" == "1" ]]; then
  echo -e "${DIM}  Launching SolanaOS...${RESET}"
  adb shell am start -n com.solanaos.solanaos/ai.openclaw.app.MainActivity >/dev/null
  echo -e "${GREEN}  ✅ Launched${RESET}"
fi

echo ""
