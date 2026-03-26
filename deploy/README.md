# Deploy SolanaOS on Fly.io

One-command deployment of SolanaOS to Fly.io. Handles app creation, volumes, secrets, and deployment.

## Quick Start

```bash
unzip SolanaOS-Fly-Deploy.zip
cd SolanaOS-Fly-Deploy
bash deploy.sh
```

## Prerequisites

- [flyctl](https://fly.io/docs/flyctl/install/) installed
- A Fly.io account (free trial works)
- An LLM API key (OpenRouter, Anthropic, xAI, OpenAI, or Ollama)

## What `deploy.sh` does

1. Prompts for app name, region, LLM provider, and optional channel tokens
2. Creates a Fly app and provisions a 1 GB persistent volume
3. Sets credentials as encrypted Fly secrets
4. Builds and deploys the Docker image on Fly's remote builders
5. Prints your app URL, gateway token, and connection instructions

## Architecture

```
Internet --> Fly.io proxy --> SolanaOS Web Console (:18800)
                                 |
                                 +--> SolanaOS Daemon
                                 +--> Gateway (:18790)
                                 +--> Skills Engine
                                 +--> Channel Bridges (Telegram, Discord, iMessage, etc.)
```

All state lives on a persistent volume at `/data`, so configuration, wallet, conversation history, and installed skills survive restarts.

## Post-Deploy

### Setup wizard

Visit `https://your-app.fly.dev/setup` to configure LLM, channels, and more.

### Connect local CLI

```bash
solanaos config set gateway.mode remote
solanaos config set gateway.remote.url wss://your-app.fly.dev
solanaos config set gateway.remote.token <your-gateway-token>
solanaos health
```

### Connect Claude Code channel

```bash
claude --channels bluebubbles,plugin:telegram@claude-plugins-official
```

## Configuration

### Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `SETUP_PASSWORD` | Yes | Protects the /setup wizard |
| `GATEWAY_AUTH_TOKEN` | Yes | Auth token for gateway connections (auto-generated) |
| `LLM_PROVIDER` | Yes | Provider identifier |
| `OPENROUTER_API_KEY` | Varies | Your LLM provider API key |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token |
| `DISCORD_BOT_TOKEN` | No | Discord bot token |
| `HELIUS_API_KEY` | No | Solana RPC via Helius |
| `SOLANA_TRACKER_API_KEY` | No | Solana RPC via SolanaTracker |
| `BIRDEYE_API_KEY` | No | Token data from Birdeye |

Update a secret:

```bash
fly secrets set OPENROUTER_API_KEY=sk-new-key -a your-app
```

### VM Sizing

Default: `shared-cpu-2x` with 2 GB RAM (~$15-20/month).

```bash
fly scale memory 4096 -a your-app    # More RAM
fly scale vm shared-cpu-4x -a your-app  # More CPU
```

### Persistent Storage

Default: 1 GB volume. Extend:

```bash
fly volumes list -a your-app
fly volumes extend <vol-id> -s 3 -a your-app
```

## Useful Commands

| Command | Description |
|---------|-------------|
| `fly logs -a your-app` | Stream live logs |
| `fly ssh console -a your-app` | SSH into the Machine |
| `fly apps restart your-app` | Restart |
| `fly scale memory 4096 -a your-app` | Increase memory |
| `fly status -a your-app` | Check status |
| `fly volumes list -a your-app` | List volumes |

## Troubleshooting

**Gateway won't start**: Check `/setup` debug console. Common: invalid API key or missing config.

**Out of memory**: `fly scale memory 4096 -a your-app`

**Stale lock files**:
```bash
fly ssh console -a your-app
rm -f /data/solanaos/*.lock
exit
fly apps restart your-app
```

**Start fresh**:
```bash
fly ssh console -a your-app
rm /data/solanaos/config.json
exit
fly apps restart your-app
```

## Supported LLM Providers

| Provider | What you need |
|----------|---------------|
| OpenRouter | API key from openrouter.ai |
| Anthropic | API key from console.anthropic.com |
| xAI | API key from x.ai |
| OpenAI | API key from platform.openai.com |
| Ollama | Self-hosted Ollama instance |
| MiniMax | API key from MiniMax portal |

Switch providers any time via the setup wizard or by updating secrets.
