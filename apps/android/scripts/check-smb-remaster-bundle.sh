#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BUNDLE_ROOT="$REPO_ROOT/apps/android/app/src/main/assets/arcade/platformer/remaster"

required_dirs=(
  ".godot/exported"
  "Assets/Audio"
  "Assets/Sprites"
  "Resources"
  "Scenes"
  "Scenes/Levels"
  "Scripts"
  "addons"
)

required_files=(
  "project.godot"
  "project.binary"
  ".godot/uid_cache.bin"
  "default_bus_layout.tres"
  "EntityIDMap.json"
  "SelectorKeyMap.json"
  "icon.png"
  "version.txt"
)

missing=0

for dir_name in "${required_dirs[@]}"; do
  if [[ -d "$BUNDLE_ROOT/$dir_name" ]]; then
    echo "ok dir  $dir_name"
  else
    echo "miss dir $dir_name"
    missing=1
  fi
done

for file_name in "${required_files[@]}"; do
  if [[ -f "$BUNDLE_ROOT/$file_name" ]]; then
    echo "ok file $file_name"
  else
    echo "miss file $file_name"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "SMB remaster bundle is incomplete" >&2
  exit 1
fi

echo "SMB remaster bundle is ready"
