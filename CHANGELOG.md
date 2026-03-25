# Changelog

All notable changes to SolanaOS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Fresh open-source repository at `github.com/x402agent/solanaos`
- GitHub issue templates (bug report, feature request)
- Pull request template with security checklist
- Code of Conduct (Contributor Covenant 2.1)
- Changelog

### Changed
- Repository reorganized for public open-source development
- Cleaned `.gitignore` of local absolute paths

### Security
- All `.env` and secret files excluded from repository
- TruffleHog scanning enabled via GitHub Actions
- Secret redaction enforced in all logging paths

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
