# solanaos-cli

**SolanaOS — The Solana Computer.**

One command. Full autonomous Solana trading runtime. Connected to your Seeker.

```bash
npx solanaos-cli install
```

```
   _____       __                        ____  _____
  / ___/____  / /___ _____  ____ _     / __ \/ ___/
  \__ \/ __ \/ / __ `/ __ \/ __ `/    / / / /\__ \
 ___/ / /_/ / / /_/ / / / / /_/ /    / /_/ /___/ /
/____/\____/_/\__,_/_/ /_/\__,_/     \____//____/
                S O L A N A O S
```

## What happens when you run it

1. Animated terminal boot sequence with Unicode matrix frames
2. Clones the [SolanaOS repo](https://github.com/x402agent/SolanaOS)
3. Builds the <10MB Go binary
4. Creates `~/.nanosolana/` workspace + wallet
5. Installs `solanaos` CLI globally
6. Prints your gateway setup code + QR for Seeker pairing
7. Ready to connect to [seeker.solanaos.net](https://seeker.solanaos.net)

## Quick start

```bash
# Install everything
npx solanaos-cli install

# Or with the web console
npx solanaos-cli install --with-web

# Start the daemon
solanaos daemon

# Generate Seeker pairing QR
solanaos gateway setup-code

# Check wallet
solanaos solana wallet
```

## Connect your surfaces

```bash
# Telegram bot
solanaos daemon  # auto-registers commands

# Seeker pairing
solanaos gateway start
solanaos gateway setup-code

# Web console
solanaos-web --no-browser

# Paper trading
solanaos ooda --sim
```

## What you get

| Surface | How |
| --- | --- |
| **Terminal** | `solanaos daemon` — OODA loop, wallet, Telegram, gateway |
| **Seeker** | Scan QR from `gateway setup-code` or pair at [seeker.solanaos.net/dashboard](https://seeker.solanaos.net/dashboard) |
| **Telegram** | Auto-connected — 30+ commands (`/status`, `/trending`, `/ooda`, `/wallet`) |
| **Chrome** | Load `chrome-extension/` folder — wallet, chat, miner, tools |
| **Hub** | [seeker.solanaos.net](https://seeker.solanaos.net) — skills, agents, strategy, mining |
| **Mining** | [seeker.solanaos.net/mining](https://seeker.solanaos.net/mining) — BitAxe fleet dashboard |

## Requirements

- Node.js >= 18
- Go >= 1.21
- git, curl
- macOS or Linux

## Minimum `.env`

```bash
SOLANA_TRACKER_API_KEY=your-key
OPENROUTER_API_KEY=sk-or-v1-...
TELEGRAM_BOT_TOKEN=your-token
TELEGRAM_ID=your-chat-id
```

## Links

| | |
| --- | --- |
| **Launch** | [solanaos.net](https://solanaos.net) |
| **Hub** | [seeker.solanaos.net](https://seeker.solanaos.net) |
| **Souls** | [souls.solanaos.net](https://souls.solanaos.net) |
| **Docs** | [solanaos.net](https://solanaos.net) |
| **GitHub** | [x402agent/SolanaOS](https://github.com/x402agent/SolanaOS) |
| **Strategy** | [seeker.solanaos.net/strategy](https://seeker.solanaos.net/strategy) |
| **Mining** | [seeker.solanaos.net/mining](https://seeker.solanaos.net/mining) |
| **Skills** | [seeker.solanaos.net/skills](https://seeker.solanaos.net/skills) |

## Also available as

```bash
npx solanaos-computer@latest install    # Primary installer
npx nanosolana-cli install              # Legacy alias
```

MIT License · SolanaOS Labs · Built on Solana
