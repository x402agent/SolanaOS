#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# SolanaOS Seeker — ARM64 Build for Android
#
# Cross-compiles the SolanaOS binary for Android ARM64 (Seeker phone).
# Output: build/solanaos-android-arm64
#
# Usage:
#   ./scripts/build-seeker.sh
#   ./scripts/build-seeker.sh --push     # also adb push to device
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

GREEN='\033[38;2;20;241;149m'
AMBER='\033[38;2;255;179;71m'
DIM='\033[38;2;85;102;128m'
RESET='\033[0m'
OUTPUT="build/solanaos-android-arm64"

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

HOST_GOMODCACHE="${HOME:-}/go/pkg/mod"
export GOCACHE="${GOCACHE:-$PWD/.cache/go-build}"
export GOTMPDIR="${GOTMPDIR:-$PWD/.cache/go-tmp}"
export GOMODCACHE="${GOMODCACHE:-$PWD/.cache/gomod}"
if [ -z "${GOPATH:-}" ]; then
  export GOPATH="$PWD/.cache/go"
fi
if [ -z "${GOPROXY:-}" ] && [ -d "${HOST_GOMODCACHE}/cache/download" ]; then
  export GOPROXY="file://${HOST_GOMODCACHE}/cache/download,https://proxy.golang.org,direct"
fi
mkdir -p "$GOCACHE" "$GOTMPDIR" "$GOMODCACHE"

echo -e "\n${GREEN}🦞 SolanaOS Seeker — ARM64 Build${RESET}\n"
echo -e "${DIM}  Go:       $GO_BIN${RESET}"
echo -e "${DIM}  GOCACHE:  $GOCACHE${RESET}"
echo -e "${DIM}  GOMODCACHE:$GOMODCACHE${RESET}"
echo -e "${DIM}  GOPROXY:  ${GOPROXY:-<default>}${RESET}\n"

# Cross-compile for Android ARM64
echo -e "${DIM}  Compiling for android/arm64...${RESET}"
CGO_ENABLED=0 GOOS=android GOARCH=arm64 \
  "$GO_BIN" build -ldflags="-s -w" -o "$OUTPUT" .

SIZE=$(du -sh "$OUTPUT" 2>/dev/null | awk '{print $1}')
echo -e "${GREEN}  ✅ Built: $OUTPUT ($SIZE)${RESET}"
echo ""

# Optionally push to connected device
if [[ "${1:-}" == "--push" ]]; then
  echo -e "${DIM}  Pushing to device via adb...${RESET}"

  # Create directory on device
  adb shell "mkdir -p /data/local/tmp/solanaos"

  # Push binary
  adb push "$OUTPUT" /data/local/tmp/solanaos/solanaos
  adb shell "chmod 755 /data/local/tmp/solanaos/solanaos"

  echo -e "${GREEN}  ✅ Pushed to /data/local/tmp/solanaos/solanaos${RESET}"
  echo ""

  # Verify
  echo -e "${DIM}  Verifying...${RESET}"
  adb shell "/data/local/tmp/solanaos/solanaos version"
  echo ""
fi

echo -e "${DIM}  To push manually:${RESET}"
echo -e "${DIM}    adb push $OUTPUT /data/local/tmp/solanaos/solanaos${RESET}"
echo -e "${DIM}    adb shell 'chmod 755 /data/local/tmp/solanaos/solanaos'${RESET}"
echo ""
echo -e "${DIM}  To run on device:${RESET}"
echo -e "${DIM}    adb shell '/data/local/tmp/solanaos/solanaos seeker'${RESET}"
echo ""
