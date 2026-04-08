# SolanaOS

The Solana computer for trading, research, wallets, memory, automation, and operator control.

## One-line pitch

SolanaOS is a local-first Go runtime that turns one binary into a Solana trading terminal, Telegram bot, wallet console, memory layer, hardware controller, and agent surface.

## Core idea

You run one daemon. That daemon can:

- observe Solana through SolanaTracker RPC, WSS, and Datastream
- reason with OpenRouter, Grok, Anthropic, or Ollama
- remember sessions and operator behavior with local vault memory and Honcho v3
- trade through Jupiter, Hyperliquid, and Aster
- accept operator commands through Telegram, web, Chrome, macOS, or Android
- expose paid APIs through x402

## Why it matters

Most Solana tools are fragmented:

- one bot for Telegram
- another for research
- another for charts
- another for execution
- another for memory

SolanaOS collapses that stack into one runtime with one identity, one wallet surface, and one operator loop.

## What ships today

- SolanaTracker as default Solana RPC and websocket layer
- SolanaTracker Datastream feeds for live token, price, holder, wallet, sniper, and insider events
- Honcho v3 memory with session summaries and queryable conclusions
- OpenRouter Mimo support via `xiaomi/mimo-v2-pro`
- Grok image and video generation from Telegram
- Hyperliquid perp support
- Aster perp support
- x402 payment gateway
- Arduino Modulino hardware integration

## Fastest install

```bash
npx solanaos-computer@latest install --with-web
cd ~/solanaos
$EDITOR .env
~/.solanaos/bin/solanaos daemon
```

## Minimum env

```bash
SOLANA_TRACKER_API_KEY=...
SOLANA_TRACKER_RPC_URL=https://rpc-mainnet.solanatracker.io/?api_key=...
SOLANA_TRACKER_WSS_URL=wss://rpc-mainnet.solanatracker.io/?api_key=...
SOLANA_TRACKER_DATA_API_KEY=...

OPENROUTER_API_KEY=...
OPENROUTER_MODEL=minimax/minimax-m2.7
OPENROUTER_MIMO_MODEL=xiaomi/mimo-v2-pro
LLM_PROVIDER=openrouter

TELEGRAM_BOT_TOKEN=...
TELEGRAM_ID=123456789

HONCHO_ENABLED=true
HONCHO_API_KEY=hch-v3-...
```

## Main surfaces

- Telegram for operator control
- SolanaOS Control for wallet/chat/tools
- Chrome extension
- macOS menu bar app
- Android Seeker app
- SolanaOS Hub at `https://seeker.solanaos.net`

## Read next

- Main README: [../README.md](../README.md)
- Release notes: [RELEASE-2026-03-v2.md](RELEASE-2026-03-v2.md)
- Hardware guide: [HARDWARE.md](HARDWARE.md)
- Troubleshooting: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
