#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_ID="com.nanosolana.solanaos"
APK_GLOB="$ROOT_DIR/app/build/outputs/apk/debug/solanaos-mobile-*-debug.apk"
GRADLE_USER_HOME_DIR="${GRADLE_USER_HOME_DIR:-$ROOT_DIR/.gradle-user}"

echo "==> Building SolanaOS debug APK"
(
  cd "$ROOT_DIR"
  GRADLE_USER_HOME="$GRADLE_USER_HOME_DIR" ./gradlew :app:assembleDebug
)

APK_PATH="$(ls -1 $APK_GLOB 2>/dev/null | tail -n 1 || true)"
if [ -z "$APK_PATH" ]; then
  echo "Debug APK not found under: $APK_GLOB" >&2
  exit 1
fi

echo "==> Waiting for Android device"
adb wait-for-device

echo "==> Installing $APK_PATH"
adb install -r "$APK_PATH"

echo "==> Launching SolanaOS"
adb shell am start -n "$APP_ID/ai.openclaw.app.MainActivity" >/dev/null

echo ""
echo "Installed and launched:"
echo "  $APK_PATH"
echo ""
echo "Next:"
echo "  cd $ROOT_DIR && make seeker-logcat"
