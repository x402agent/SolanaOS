#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/build/notebooklm"
BIN_PATH="${ROOT_DIR}/build/solanaos"
GO_BIN="${GO_BIN:-}"
REBUILD=true

usage() {
  cat <<'EOF'
Usage:
  bash scripts/notebooklm-pack.sh [--out DIR] [--no-build]

Options:
  --out DIR    Custom output directory (default: build/notebooklm)
  --no-build   Reuse existing build/solanaos instead of rebuilding it
  -h, --help   Show this help

What it does:
  - creates a NotebookLM-ready source pack
  - captures a sanitized CLI runtime snapshot
  - copies core project docs into flat Markdown files
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out)
      shift
      OUT_DIR="${1:-}"
      if [[ -z "${OUT_DIR}" ]]; then
        echo "missing value for --out" >&2
        exit 1
      fi
      ;;
    --no-build)
      REBUILD=false
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

if [[ -z "${GO_BIN}" ]]; then
  if [[ -x "/opt/homebrew/bin/go" ]]; then
    GO_BIN="/opt/homebrew/bin/go"
  else
    GO_BIN="$(command -v go || true)"
  fi
fi

strip_ansi() {
  sed -E $'s/\x1B\\[[0-9;]*[[:alpha:]]//g'
}

load_env_file() {
  local env_file="${1:-}"
  local line key value
  [[ -f "${env_file}" ]] || return 0

  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "${line}" || "${line}" == \#* ]] && continue
    [[ "${line}" == export\ * ]] && line="${line#export }"
    [[ "${line}" == *=* ]] || continue

    key="${line%%=*}"
    value="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"

    if [[ "${value}" == \"*\" && "${value}" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "${value}" == \'*\' ]]; then
      value="${value:1:${#value}-2}"
    fi

    if [[ -n "${key}" && -z "${!key:-}" ]]; then
      export "${key}=${value}"
    fi
  done < "${env_file}"
}

capture_cmd() {
  if [[ ! -x "${BIN_PATH}" ]]; then
    return 0
  fi
  "${BIN_PATH}" "$@" 2>/dev/null | strip_ansi || true
}

copy_if_exists() {
  local src="${1:-}"
  local dst="${2:-}"
  if [[ -f "${src}" ]]; then
    cp "${src}" "${dst}"
  fi
}

mkdir -p "${OUT_DIR}"

if [[ -f "${ROOT_DIR}/.env" ]]; then
  load_env_file "${ROOT_DIR}/.env"
fi

if [[ "${REBUILD}" == "true" ]]; then
  if [[ -z "${GO_BIN}" || ! -x "${GO_BIN}" ]]; then
    echo "go toolchain not found; rerun with --no-build or set GO_BIN" >&2
    exit 1
  fi
  export GOCACHE="${ROOT_DIR}/.cache/go-build"
  export GOTMPDIR="${ROOT_DIR}/.cache/go-tmp"
  export GOMODCACHE="${GOMODCACHE:-${ROOT_DIR}/.cache/gomod}"
  if [[ -z "${GOPROXY:-}" && -d "${HOME}/go/pkg/mod/cache/download" ]]; then
    export GOPROXY="file://${HOME}/go/pkg/mod/cache/download,https://proxy.golang.org,direct"
  fi
  mkdir -p "${GOCACHE}" "${GOTMPDIR}" "${GOMODCACHE}" "${ROOT_DIR}/build"
  (
    cd "${ROOT_DIR}"
    "${GO_BIN}" build -o "${BIN_PATH}" .
  )
fi

# Everything below is best-effort content generation. The packer should still
# succeed even if one runtime snapshot or optional source document is missing.
set +e

TIMESTAMP_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
set +e
STATUS_OUTPUT="$(capture_cmd status || true)"
VERSION_OUTPUT="$(capture_cmd version || true)"
HELP_OUTPUT="$(capture_cmd --help || true)"
SOLANA_HELP_OUTPUT="$(capture_cmd solana --help || true)"
set -e

cat > "${OUT_DIR}/00-notebooklm-index.md" <<EOF
# SolanaOS NotebookLM Pack

Generated: ${TIMESTAMP_UTC}

This pack gives NotebookLM a high-signal overview of SolanaOS as it exists on disk, plus a lightweight runtime snapshot from the local CLI.

## Included source files

- \`10-root-readme.md\`
- \`11-strategy.md\`
- \`12-soul.md\`
- \`13-security.md\`
- \`14-hardware.md\`
- \`15-nanohub-readme.md\`
- \`16-vision.md\`
- \`20-runtime-snapshot.md\`
- \`21-command-cheatsheet.md\`

## Runtime snapshot policy

- \`20-runtime-snapshot.md\` includes best-effort output from \`solanaos version\`, \`solanaos status\`, root help, and \`solanaos solana --help\`.
- The generated index intentionally avoids raw wallet addresses and secret-presence inventory.
- Review the runtime snapshot before sharing a generated pack outside your machine.

## Suggested NotebookLM prompt

Use this notebook to answer:

1. What SolanaOS is and how the daemon, Telegram bot, OODA loop, NanoBot UI, gateway, Honcho memory, Hyperliquid and Aster perps, x402 payments, and hardware layer fit together as one system.
2. What commands exist for live operation, debugging, trading, memory management, and fleet control across Telegram, CLI, and the gateway API.
3. What the current local runtime state implies about readiness, risk exposure, and next operational steps.
4. How NanoHub, the Souls library, the skills system, and the docs site relate to the core Go runtime.
5. How the epistemological model in \`SOUL.md\` and \`strategy.md\` maps to durable learning and trading decisions.
6. What the Tailscale mesh, gateway pairing, and Seeker app enable for cross-device operator control.
EOF

cat > "${OUT_DIR}/20-runtime-snapshot.md" <<EOF
# SolanaOS Runtime Snapshot

Generated: ${TIMESTAMP_UTC}

This snapshot is best-effort and intentionally omits raw wallet output from the pack summary.

## Version

\`\`\`text
${VERSION_OUTPUT:-version unavailable}
\`\`\`

## Wallet

\`\`\`text
${WALLET_OUTPUT:-wallet unavailable}
\`\`\`

## Status

\`\`\`text
${STATUS_OUTPUT:-status unavailable}
\`\`\`

## CLI Help

\`\`\`text
${HELP_OUTPUT:-help unavailable}
\`\`\`

## Solana Command Help

\`\`\`text
${SOLANA_HELP_OUTPUT:-solana help unavailable}
\`\`\`
EOF

cat > "${OUT_DIR}/21-command-cheatsheet.md" <<'EOF'
# SolanaOS Command Cheat Sheet

## Core Runtime

```bash
solanaos version
solanaos status
solanaos solana wallet
solanaos daemon
solanaos daemon --seeker --pet-name Seeker
solanaos daemon --no-telegram --no-ooda
solanaos ooda --interval 60
solanaos ooda --sim --interval 30
solanaos pet
solanaos nanobot
solanaos menubar
solanaos onboard
```

## Gateway And Mesh

```bash
solanaos gateway start
solanaos gateway start --port 19001
solanaos gateway start --no-tailscale
solanaos gateway stop
solanaos gateway setup-code
cat ~/.nanosolana/connect/setup-code.txt
solanaos node run --bridge <TAILSCALE_IP>:18790
solanaos node pair --bridge <TAILSCALE_IP>:18790 --display-name "Orin Nano"
```

## Solana Tools

```bash
solanaos solana health
solanaos solana wallet
solanaos solana balance <pubkey>
solanaos solana trending
solanaos solana research <mint>
solanaos solana swap
solanaos solana register
solanaos solana registry
```

## Hardware

```bash
solanaos hardware scan --bus 1
solanaos hardware test --bus 1
solanaos hardware monitor --bus 1 --interval 200
solanaos hardware demo --bus 1
solanaos ooda --hw-bus 1 --interval 30
```

## Web Console

```bash
solanaos-web --no-browser
```

## Telegram Commands: Memory

```text
/status
/wallet
/pet
/memory
/recall <query>
/memory_search <query>
/memory_sessions
/honcho_status
/honcho_context [query]
/honcho_sessions [page] [size]
/honcho_summaries
/honcho_search <query>
/honcho_messages [page] [size]
/honcho_conclusions [query]
/user_model
/learn_status
/model
/new
```

## Telegram Commands: Trading (Spot)

```text
/trending
/ooda
/sim
/live
/strategy
/set <param> <value>
/trades
/research <mint>
```

## Telegram Commands: Hyperliquid Perps

```text
/hl
/hl_balance
/hl_positions
/hl_orders
/hl_stream
/hl_mid <COIN>
/hl_fills [COIN]
/hl_candles <COIN> [interval] [hours]
/hl_open <COIN> <long|short> [size] [slippage%]
/hl_order <COIN> <long|short> <size> <price> [gtc|alo|ioc] [reduce]
/hl_close <COIN> [size]
/hl_cancel
/hl_leverage <COIN> <LEV> [cross|isolated]
```

## Telegram Commands: Aster Perps

```text
/perps
/aster
/aster_account
/aster_positions
/aster_orders [symbol]
/aster_trades <symbol>
/aster_income [symbol] [incomeType]
/along <symbol> [size_pct] [confidence] [thesis]
/ashort <symbol> [size_pct] [confidence] [thesis]
/aclose <symbol> [reason]
```

## Telegram Commands: Skills And Registry

```text
/skills
/skill <name>
/skill_find <query>
/skill_use <name>
/skill_create <name> <desc>
/skills_count
/registry
/registry_sync
```

## Telegram Commands: LLM And Media

```text
/model
/mimo <prompt>
/web <query>
/xsearch <query>
/vision <image_url> [question]
/image <prompt>
/video <prompt>
/multi <query>
/grok
```

## Natural language examples

```text
show my aster account
show my aster positions
what's trending on aster right now?
long btc on aster 10%
close sol on aster
show my hyperliquid balance
open a 0.01 btc long on hyperliquid
what risk preferences have I shown?
what did I trade last week?
```

## NanoHub CLI

```bash
npx @nanosolana/nanohub --help
npx @nanosolana/nanohub login
npx @nanosolana/nanohub search solana
npx @nanosolana/nanohub install <slug>
npx @nanosolana/nanohub publish ./my-skill \
  --slug my-skill \
  --name "My Skill" \
  --version 1.0.0 \
  --tags latest,solana
```
EOF

copy_if_exists "${ROOT_DIR}/README.md" "${OUT_DIR}/10-root-readme.md"
copy_if_exists "${ROOT_DIR}/strategy.md" "${OUT_DIR}/11-strategy.md"
copy_if_exists "${ROOT_DIR}/SOUL.md" "${OUT_DIR}/12-soul.md"
copy_if_exists "${ROOT_DIR}/SECURITY.md" "${OUT_DIR}/13-security.md"
copy_if_exists "${ROOT_DIR}/docs/HARDWARE.md" "${OUT_DIR}/14-hardware.md"
copy_if_exists "${ROOT_DIR}/nanohub/README.md" "${OUT_DIR}/15-nanohub-readme.md"
copy_if_exists "${ROOT_DIR}/docs/vision.md" "${OUT_DIR}/16-vision.md"

printf "NotebookLM pack created at %s\n" "${OUT_DIR}"
find "${OUT_DIR}" -maxdepth 1 -type f | sort || true
exit 0
