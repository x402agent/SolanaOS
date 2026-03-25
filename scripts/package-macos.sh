#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# SolanaOS — macOS DMG Packaging Script
#
# Creates a self-contained SolanaOS.app bundle + .dmg installer
# for macOS. Wraps the Go binary + menu bar Swift UI.
#
# Usage:
#   ./scripts/package-macos.sh
#   ./scripts/package-macos.sh --sign        # code-sign for distribution
#   ./scripts/package-macos.sh --notarize    # notarize for Gatekeeper
#
# Output:
#   dist/SolanaOS.app
#   dist/SolanaOS-v2.0.0.dmg
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

GREEN='\033[38;2;20;241;149m'
DIM='\033[38;2;85;102;128m'
AMBER='\033[38;2;255;179;71m'
RESET='\033[0m'

VERSION="2.0.0"
APP_NAME="SolanaOS"
LAUNCHER_NAME="SolanaOSLauncher"
BUNDLE_ID="com.solanaos.app"
DIST_DIR="dist"
APP_DIR="$DIST_DIR/$APP_NAME.app"
CONTENTS="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"
SCRIPT_DIR="$MACOS_DIR/scripts"
APP_SUPPORT_DIR="$MACOS_DIR/apps/macos"
DMG_NAME="$APP_NAME-v$VERSION.dmg"

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

GO_BIN="${GO_BIN:-}"
if [ -z "$GO_BIN" ]; then
  if [ -x "/opt/homebrew/bin/go" ]; then
    GO_BIN="/opt/homebrew/bin/go"
  elif [ -x "/usr/local/go/bin/go" ]; then
    GO_BIN="/usr/local/go/bin/go"
  else
    GO_BIN="$(command -v go || true)"
  fi
fi

if [ -z "$GO_BIN" ] || [ ! -x "$GO_BIN" ]; then
  echo -e "${AMBER}  ❌ Go toolchain not found. Install Go or set GO_BIN.${RESET}"
  exit 1
fi

if [ -n "${GOROOT:-}" ] && [ ! -d "$GOROOT/src/fmt" ]; then
  echo -e "${AMBER}  ⚠️  Ignoring invalid GOROOT=$GOROOT${RESET}"
  unset GOROOT
fi

export GOCACHE="${GOCACHE:-$PWD/.cache/go-build}"
HOST_GOMODCACHE="${HOME:-}/go/pkg/mod"
export GOMODCACHE="${GOMODCACHE:-$PWD/.cache/gomod}"
if [ -z "${GOPATH:-}" ]; then
  export GOPATH="$PWD/.cache/go"
fi
export GOMODCACHE="${GOMODCACHE:-$GOPATH/pkg/mod}"
export GOTMPDIR="${GOTMPDIR:-$PWD/.cache/go-tmp}"
if [ -z "${GOPROXY:-}" ] && [ -d "${HOST_GOMODCACHE}/cache/download" ]; then
  export GOPROXY="file://${HOST_GOMODCACHE}/cache/download,https://proxy.golang.org,direct"
fi
mkdir -p "$GOCACHE"
if [ ! -d "$GOMODCACHE" ]; then
  mkdir -p "$GOMODCACHE"
fi
mkdir -p "$GOTMPDIR"
mkdir -p "$DIST_DIR"

SIGN_APP=false
NOTARIZE=false
for arg in "$@"; do
  case "$arg" in
    --sign) SIGN_APP=true ;;
    --notarize) NOTARIZE=true; SIGN_APP=true ;;
  esac
done

echo -e "\n${GREEN}🦞 SolanaOS macOS Packager${RESET}"
echo -e "${DIM}  Version: $VERSION${RESET}"
echo -e "${DIM}  Bundle:  $BUNDLE_ID${RESET}\n"
echo -e "${DIM}  Go:      $GO_BIN${RESET}"
echo -e "${DIM}  Cache:   $GOCACHE${RESET}\n"
echo -e "${DIM}  GOPATH:  $GOPATH${RESET}"
echo -e "${DIM}  ModCache:$GOMODCACHE${RESET}\n"
echo -e "${DIM}  GOPROXY: ${GOPROXY:-<default>}${RESET}\n"

# ── 1. Build Go binary for macOS ─────────────────────────────────
echo -e "${DIM}  [1/5] Building Go binary...${RESET}"
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 \
  "$GO_BIN" build -ldflags="-s -w" -o "$DIST_DIR/solanaos-darwin-arm64" .

# Also build amd64 for Intel Macs
CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 \
  "$GO_BIN" build -ldflags="-s -w" -o "$DIST_DIR/solanaos-darwin-amd64" .

# Create universal binary
lipo -create \
  "$DIST_DIR/solanaos-darwin-arm64" \
  "$DIST_DIR/solanaos-darwin-amd64" \
  -output "$DIST_DIR/solanaos-universal"
echo -e "${GREEN}  ✅ Universal binary built${RESET}"

# ── 2. Create .app bundle ────────────────────────────────────────
echo -e "${DIM}  [2/5] Creating app bundle...${RESET}"
rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES" "$SCRIPT_DIR" "$APP_SUPPORT_DIR"

# Copy universal CLI binary inside the bundle for direct terminal use.
cp "$DIST_DIR/solanaos-universal" "$MACOS_DIR/solanaos"
chmod 755 "$MACOS_DIR/solanaos"

# Bundle the menu bar launcher runtime so the installed app can launch the
# native status item without depending on the source checkout.
cp "scripts/menubar.sh" "$SCRIPT_DIR/menubar.sh"
chmod 755 "$SCRIPT_DIR/menubar.sh"
cp "apps/macos/SolanaOSMenuBar.swift" "$APP_SUPPORT_DIR/SolanaOSMenuBar.swift"

# Create Finder launcher as the actual bundle executable.
cat > "$MACOS_DIR/$LAUNCHER_NAME" << 'LAUNCHER_EOF'
#!/bin/bash
# SolanaOS Launcher — opens the native menu bar agent on Finder launch
DIR="$(cd "$(dirname "$0")" && pwd)"
BINARY="$DIR/solanaos"
MENU_SCRIPT="$DIR/scripts/menubar.sh"

# Detect Finder launch: no TERM_PROGRAM and stdin is NOT a tty
if [ -z "$TERM_PROGRAM" ] && ! [ -t 0 ] 2>/dev/null; then
  # Launched from Finder — start the native menu bar agent.
  if [ -x "$MENU_SCRIPT" ]; then
    "$MENU_SCRIPT" &
  else
    "$BINARY" nanobot &
  fi
  exit 0
fi

# Launched from terminal — pass through args
if [ $# -eq 0 ]; then
  exec "$BINARY" menubar
else
  exec "$BINARY" "$@"
fi
LAUNCHER_EOF
chmod 755 "$MACOS_DIR/$LAUNCHER_NAME"

# Info.plist
cat > "$CONTENTS/Info.plist" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundleDisplayName</key>
    <string>SolanaOS</string>
    <key>CFBundleIdentifier</key>
    <string>$BUNDLE_ID</string>
    <key>CFBundleVersion</key>
    <string>$VERSION</string>
    <key>CFBundleShortVersionString</key>
    <string>$VERSION</string>
    <key>CFBundleExecutable</key>
    <string>$LAUNCHER_NAME</string>
    <key>CFBundleIconFile</key>
    <string>SolanaOS</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSArchitecturePriority</key>
    <array>
        <string>arm64</string>
        <string>x86_64</string>
    </array>
    <key>NSHumanReadableCopyright</key>
    <string>© 2026 SolanaOS Labs. MIT License.</string>
</dict>
</plist>
PLIST_EOF

# Copy icon if exists
if [ -f "apps/macos/Icon.icon" ]; then
  cp "apps/macos/Icon.icon" "$RESOURCES/SolanaOS.icns"
fi

echo -e "${GREEN}  ✅ $APP_NAME.app created${RESET}"

# ── 3. Sign ──────────────────────────────────────────────────────
echo -e "${DIM}  [3/5] Code signing...${RESET}"
if [ "$SIGN_APP" = true ]; then
  IDENTITY="${SIGN_IDENTITY:-}"
  if [ -z "$IDENTITY" ]; then
    IDENTITY=$(security find-identity -v -p codesigning | head -1 | sed 's/.*"\(.*\)"/\1/' || true)
  fi

  if [ -n "$IDENTITY" ]; then
    codesign --force --deep --sign "$IDENTITY" \
      --options runtime \
      --timestamp \
      "$APP_DIR"
    echo -e "${GREEN}  ✅ Signed with: $IDENTITY${RESET}"
  else
    echo -e "${AMBER}  ⚠️  No signing identity found, falling back to ad-hoc signing${RESET}"
    codesign --force --deep --sign - "$APP_DIR"
  fi
else
  codesign --force --deep --sign - "$APP_DIR"
  echo -e "${GREEN}  ✅ Ad-hoc signed for local launch${RESET}"
fi

# Strip quarantine on locally built artifacts so Finder launch works immediately.
find "$APP_DIR" -exec xattr -c {} + 2>/dev/null || true

# ── 4. Create DMG ────────────────────────────────────────────────
echo -e "${DIM}  [4/5] Creating DMG...${RESET}"
TMP_DMG="$DIST_DIR/.${APP_NAME}-tmp.dmg"
LEGACY_TMP_DMG="$DIST_DIR/.${DMG_NAME}.tmp"
rm -f "$TMP_DMG" "${TMP_DMG}.dmg" "$LEGACY_TMP_DMG" "${LEGACY_TMP_DMG}.dmg"
DMG_CREATED=false

# Create DMG with drag-to-Applications layout
if hdiutil create -volname "$APP_NAME" \
  -srcfolder "$APP_DIR" \
  -ov -format UDBZ \
  "$TMP_DMG" 2>/dev/null; then
  CREATED_DMG=""
  for candidate in \
    "$TMP_DMG" \
    "${TMP_DMG}.dmg" \
    "$LEGACY_TMP_DMG" \
    "${LEGACY_TMP_DMG}.dmg"
  do
    if [ -f "$candidate" ]; then
      CREATED_DMG="$candidate"
      break
    fi
  done

  if [ -z "$CREATED_DMG" ]; then
    echo -e "${AMBER}  ⚠️  DMG was reported created, but no output file was found${RESET}"
  else
    mv -f "$CREATED_DMG" "$DIST_DIR/$DMG_NAME"
    xattr -d com.apple.quarantine "$DIST_DIR/$DMG_NAME" 2>/dev/null || true
    DMG_CREATED=true
    DMG_SIZE=$(du -sh "$DIST_DIR/$DMG_NAME" 2>/dev/null | awk '{print $1}')
    echo -e "${GREEN}  ✅ DMG: $DMG_NAME ($DMG_SIZE)${RESET}"
  fi
else
  rm -f "$TMP_DMG" "${TMP_DMG}.dmg" "$LEGACY_TMP_DMG" "${LEGACY_TMP_DMG}.dmg"
  echo -e "${AMBER}  ⚠️  DMG creation failed; .app bundle is still ready at $APP_DIR${RESET}"
fi

# ── 5. Notarize ──────────────────────────────────────────────────
if [ "$NOTARIZE" = true ]; then
  echo -e "${DIM}  [5/5] Notarizing...${RESET}"
  if [ "$DMG_CREATED" != true ]; then
    echo -e "${AMBER}  ⚠️  Skipping notarization because the DMG was not created${RESET}"
  elif [ -n "${APPLE_ID:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ]; then
    xcrun notarytool submit "$DIST_DIR/$DMG_NAME" \
      --apple-id "$APPLE_ID" \
      --team-id "$APPLE_TEAM_ID" \
      --password "$APPLE_APP_PASSWORD" \
      --wait
    xcrun stapler staple "$DIST_DIR/$DMG_NAME"
    echo -e "${GREEN}  ✅ Notarized and stapled${RESET}"
  else
    echo -e "${AMBER}  ⚠️  Set APPLE_ID + APPLE_TEAM_ID + APPLE_APP_PASSWORD to notarize${RESET}"
  fi
else
  echo -e "${DIM}  [5/5] Skipping notarization (use --notarize)${RESET}"
fi

# ── Summary ──────────────────────────────────────────────────────
BINARY_SIZE=$(du -sh "$MACOS_DIR/solanaos" 2>/dev/null | awk '{print $1}')
echo ""
echo -e "${GREEN}  ┌──────────────────────────────────────────┐${RESET}"
echo -e "${GREEN}  │  ✅ SolanaOS macOS package complete      │${RESET}"
echo -e "${GREEN}  └──────────────────────────────────────────┘${RESET}"
echo ""
echo -e "  ${DIM}App:${RESET}    $APP_DIR"
if [ "$DMG_CREATED" = true ]; then
  echo -e "  ${DIM}DMG:${RESET}    $DIST_DIR/$DMG_NAME"
else
  echo -e "  ${DIM}DMG:${RESET}    not created"
fi
echo -e "  ${DIM}Binary:${RESET} $BINARY_SIZE (universal arm64+x86_64)"
echo ""
echo -e "  ${DIM}Install:${RESET} Open DMG → drag SolanaOS to Applications"
echo -e "  ${DIM}CLI:${RESET}    ln -s /Applications/$APP_NAME.app/Contents/MacOS/solanaos /usr/local/bin/solanaos"
echo ""
