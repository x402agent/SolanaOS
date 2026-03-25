#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SRC="$REPO_ROOT/apps/super-mario-bros.-remastered-android-main"
DST="$REPO_ROOT/apps/android/app/src/main/assets/arcade/platformer/remaster"

if [[ ! -d "$SRC" ]]; then
  echo "missing source project: $SRC" >&2
  exit 1
fi

mkdir -p "$DST"

sync_dir() {
  local name="$1"
  if [[ -d "$SRC/$name" ]]; then
    mkdir -p "$DST/$name"
    rsync -a "$SRC/$name/" "$DST/$name/"
  fi
}

sync_file() {
  local name="$1"
  if [[ -f "$SRC/$name" ]]; then
    mkdir -p "$(dirname "$DST/$name")"
    cp "$SRC/$name" "$DST/$name"
  fi
}

for dir_name in .godot Assets Resources Scenes Scripts addons godotgif; do
  sync_dir "$dir_name"
done

for file_name in \
  project.godot \
  project.binary \
  default_bus_layout.tres \
  EntityIDMap.json \
  SelectorKeyMap.json \
  version.txt \
  credits.txt \
  export_presets.cfg \
  README.md \
  LICENSE \
  icon.png \
  icon.png.import \
  icon32.png \
  icon32.png.import
do
  sync_file "$file_name"
done

echo "synced SMB remaster bundle into $DST"
