#!/usr/bin/env bash

set -euo pipefail

APP_ID="com.nanosolana.solanaos"
SHOW_STRICTMODE="${SHOW_STRICTMODE:-0}"

APP_TAG_SPECS=(
  "OpenClawGateway:V"
  "DeviceAuth:V"
  "OpenClawCanvas:V"
  "OpenClawWebView:V"
  "CameraCaptureManager:V"
  "MicCapture:V"
  "serviceDiscovery:I"
  "MdnsDiscoveryManager:I"
  "AndroidRuntime:E"
)

if [ "$SHOW_STRICTMODE" = "1" ]; then
  APP_TAG_SPECS+=("StrictMode:D")
fi

echo "==> Following focused gateway/app logcat for $APP_ID"
echo "==> Tags: ${APP_TAG_SPECS[*]}"
adb logcat -v time "${APP_TAG_SPECS[@]}" "*:S"
