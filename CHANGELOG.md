# Changelog

All notable changes to SolanaOS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Local signer service** — AES-256-GCM encrypted `dev` and `trade` Solana keypairs auto-generated on first run (`services/agent-wallet/local_signer.go`)
- **Local process sandbox** — E2B-compatible sandbox fallback using child processes, no API key required (`services/agent-wallet/local_sandbox.go`)
- **Local signer REST API** — `GET/POST /v1/local-signers/{mode}` endpoints for listing, signing, and broadcasting SOL transfers
- **Agent Wallet binary** — standalone `./build/agent-wallet` binary (`services/agent-wallet/cmd/`)
- **Gateway API binary** — standalone `./build/gateway-api` from `cmd/gateway-api/`
- **`start.sh`** — unified service start/stop/status script; starts agent-wallet → daemon → MCP server in order
- **`FORK.md`** — 15-minute developer onboarding guide from fork to running agent
- **Makefile targets**: `build-agent-wallet`, `build-gateway-api`, `build-mcp`, `start-agent-wallet`, `stop-agent-wallet`, `start-mcp`, `stop-mcp`, `npm-sync`, updated `install`, full `help`
- **Cloudflare Workers docs** — `workers/agent-wallet/` (edge KV vault) and `pumpfun-mcp-worker/` deployment instructions
- **Standalone bots docs** — `bots/pumpfun-mayhem-ai-trading-bot-main/` and `bots/pumpfun-mayhem-sniper-main/`
- **CI** — now builds all four binaries (solanaos, agent-wallet, gateway-api, control-api), MCP server, and verifies all three npm packages
- **`new/npm/README.md`** — warning that `new/npm/` is stale; canonical packages are in `npm/`
- **`services/agent-wallet/README.md`** — full service documentation

### Changed

- `.gitignore` cleaned of absolute local paths; `Claw3D-main/`, `g0dm0d3-main/`, `solana-keychain-main/`, `page-agent-main/` untracked from git index (still present locally, ignored going forward)
- Repo layout section updated with accurate directory map and service port table
- npm packages table now shows source directory and version
- Agent Wallet section expanded with local signer key lifecycle, sandbox modes, and MCP server configs
- `CONTRIBUTING.md` rewritten with accurate project structure, all four build targets, and contribution area table
- Signer/vault storage path normalized to `~/.solanaos/` across all docs and scripts

### Security

- Sub-repo directories (`Claw3D-main`, `g0dm0d3-main`, `solana-keychain-main`, `page-agent-main`) removed from git tracking
- CI secret scan now excludes `node_modules/` and `.git/`
- All `.env` and secret files excluded from repository
- TruffleHog scanning enabled via GitHub Actions

## [3.0.0] - 2026-03-25

### Added
- Claude Code remote control from Telegram (`/remote`)
- Grok Vision image understanding from Telegram photos
- Auto-detect Solana contract addresses (paste any mint → instant data)
- Natural language token queries (20+ query prefixes)
- Private IPFS Hub with Pinata (per-wallet storage, mesh sync, mainnet deploy)
- Private wallet-to-wallet chat with Honcho persistent memory
- x402 payment protocol integration
- Aster perps trading engine
- Arduino Modulino hardware support

### Changed
- SolanaTracker is now the default RPC provider (Helius is fallback)
- SolanaTracker Datastream for real-time feeds
- Honcho v3 memory integration (sessions, peers, conclusions, dialectic)
- Telegram spot trading prefers SolanaTracker swap execution
- OpenRouter Mimo v2 Pro wired as dedicated reasoning path

## [2.0.0] - 2026-03-15

### Added
- SolanaOS Hub (seeker.solanaos.net) with skill registry, dashboard, mining
- Solana Seeker Android app with MWA wallet
- Chrome extension (5-tab control surface)
- NanoHub CLI (`npx @nanosolana/nanohub`)
- Hyperliquid perps integration
- TamaGOchi companion system
- OODA trading loop

### Changed
- Rebranded from NanoSolana to SolanaOS
- Go module path: `github.com/x402agent/SolanaOS`
