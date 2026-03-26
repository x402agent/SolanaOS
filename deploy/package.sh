#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# SolanaOS :: Package deploy zip for distribution
#
# Creates SolanaOS-Fly-Deploy.zip containing everything needed to
# deploy SolanaOS on Fly.io with a single `bash deploy.sh`.
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="${REPO_ROOT}/dist"
PKG_NAME="SolanaOS-Fly-Deploy"
PKG_DIR="${OUT_DIR}/${PKG_NAME}"

echo "▸ Packaging SolanaOS deploy bundle..."

rm -rf "$PKG_DIR"
mkdir -p "$PKG_DIR"

# Core deploy files
cp "$SCRIPT_DIR/deploy.sh" "$PKG_DIR/"
cp "$SCRIPT_DIR/README.md" "$PKG_DIR/"

# Docker and Fly config
cp "$REPO_ROOT/Dockerfile.fly" "$PKG_DIR/"
cp "$REPO_ROOT/fly.toml" "$PKG_DIR/fly.toml.template"

# Source code needed for the build
rsync -a --exclude='.cache' --exclude='node_modules' --exclude='.next' \
  --exclude='Claw3D-main' --exclude='Claw3D-main copy' \
  --exclude='mawdbot-bitaxe' --exclude='page-agent-main' \
  --exclude='dist' --exclude='.git' --exclude='deploy' \
  --exclude='*.test.go' --exclude='services/' \
  "$REPO_ROOT/" "$PKG_DIR/src/"

# Make executable
chmod +x "$PKG_DIR/deploy.sh"

# Patch deploy.sh to work from the zip (REPO_ROOT = script dir)
sed -i '' 's|REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"|REPO_ROOT="$SCRIPT_DIR/src"|' "$PKG_DIR/deploy.sh"
sed -i '' 's|FLY_TOML="${REPO_ROOT}/fly.toml"|FLY_TOML="${SCRIPT_DIR}/src/fly.toml"|' "$PKG_DIR/deploy.sh"

# Create zip
cd "$OUT_DIR"
rm -f "${PKG_NAME}.zip"
zip -r "${PKG_NAME}.zip" "${PKG_NAME}/" -x "*.DS_Store" "*__MACOSX*"

SIZE=$(du -sh "${PKG_NAME}.zip" | cut -f1)
echo "✓ Created ${OUT_DIR}/${PKG_NAME}.zip (${SIZE})"
echo ""
echo "  Distribute this zip. Users run:"
echo "    unzip ${PKG_NAME}.zip"
echo "    cd ${PKG_NAME}"
echo "    bash deploy.sh"
