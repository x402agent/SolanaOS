# SolanaOS v2.0

March 2026 release summary.

## Headline

SolanaOS v2.0 tightens the runtime around current operator workflows: SolanaTracker is the default Solana backbone, Honcho v3 memory is live, Mimo reasoning is wired in, and Grok media generation is reachable from Telegram.

## Highlights

### SolanaTracker became the default chain provider

- `SOLANA_TRACKER_RPC_URL` is now the primary RPC endpoint
- `SOLANA_TRACKER_WSS_URL` is the preferred websocket path
- Helius stays available as fallback and DAS data provider

### Datastream support is live

SolanaOS now supports SolanaTracker Datastream feeds for:

- latest tokens
- graduating and graduated tokens
- token and pool transactions
- wallet balance and wallet transactions
- price feeds
- sniper and insider tracking
- token and pool statistics
- holder and metadata updates

### Honcho v3 memory is in the runtime

- session summaries
- peer context
- durable conclusions
- Telegram recall commands
- prompt enrichment across sessions

### OpenRouter Mimo support was added

`/mimo` now uses:

```bash
OPENROUTER_MIMO_MODEL=xiaomi/mimo-v2-pro
```

The runtime preserves multi-turn reasoning state for the Mimo path instead of treating every turn as stateless.

### Grok media generation is operator-ready

- `/image`
- `/video`
- natural-language routing from Telegram into the Grok media paths

This lets the operator ask for media in plain English instead of only through explicit slash commands.

### Docs and UI cleanup

- SolanaOS branding normalized across the runtime and public docs
- Hub production URL standardized to `https://seeker.solanaos.net`
- current docs entrypoint is `https://solanaos.net`

## Operator impact

This release reduces friction in four places:

1. better default chain performance and real-time coverage
2. stronger session memory and recall
3. more deliberate model routing with a dedicated Mimo path
4. cleaner multi-surface operator control

## Recommended env block

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
HONCHO_BASE_URL=https://api.honcho.dev
```

## Quick verification

```bash
./build/solanaos status
./build/solanaos solana wallet
./build/solanaos daemon
```

In Telegram:

```text
/status
/mimo compare 3 SOL entries with invalidation
/memory
/video cinematic shot of a Solana trading terminal in neon rain
```

## Read next

- Main README: [../README.md](../README.md)
- Landing page copy: [LANDING.md](LANDING.md)
- Hardware: [HARDWARE.md](HARDWARE.md)
