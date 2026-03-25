#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
DST="$REPO_ROOT/apps/android/app/src/main/assets/arcade/platformer/remaster"
APK_PATH="${1:-${SMB_REMASTER_ANDROID_APK:-/tmp/smb1r-android-arm64-7.apk}}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ ! -f "$APK_PATH" ]]; then
  echo "missing SMB Android export APK: $APK_PATH" >&2
  echo "usage: $0 /path/to/smb1r-android-arm64-*.apk" >&2
  exit 1
fi

mkdir -p "$DST"

unzip -oq "$APK_PATH" "assets/project.binary" "assets/.godot/*" -d "$TMP_DIR"

if [[ ! -f "$TMP_DIR/assets/project.binary" ]]; then
  echo "project.binary not found in $APK_PATH" >&2
  exit 1
fi

if [[ ! -d "$TMP_DIR/assets/.godot/exported" ]]; then
  echo ".godot/exported not found in $APK_PATH" >&2
  exit 1
fi

mkdir -p "$DST/.godot"
cp "$TMP_DIR/assets/project.binary" "$DST/project.binary"
rsync -a --delete "$TMP_DIR/assets/.godot/" "$DST/.godot/"

echo "hydrated SMB exported Godot payload into $DST from $APK_PATH"
