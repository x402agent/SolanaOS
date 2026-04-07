# Fork Guide — Go Live in 15 Minutes

This is the fastest path from fork to a running Solana agent on your machine.

---

## 1. Fork + Clone

```bash
# Fork on GitHub, then:
git clone https://github.com/YOUR_HANDLE/SolanaOS.git
cd SolanaOS
```

---

## 2. Get API Keys (free tiers work)

You need exactly three things to start:

| Key | Where to get it | What for |
| --- | --- | --- |
| **SolanaTracker API key** | [solanatracker.io](https://solanatracker.io) | Solana RPC + token data |
| **OpenRouter API key** | [openrouter.ai](https://openrouter.ai) | LLM (free models available) |
| **Telegram bot token** | [@BotFather](https://t.me/botfather) on Telegram | Agent control channel |

---

## 3. Configure

```bash
cp .env.example .env
```

Minimum `.env` to get running:

```bash
# Solana RPC
SOLANA_TRACKER_RPC_URL=https://rpc-mainnet.solanatracker.io/?api_key=YOUR_KEY
SOLANA_TRACKER_WSS_URL=wss://rpc-mainnet.solanatracker.io/?api_key=YOUR_KEY
SOLANA_TRACKER_API_KEY=YOUR_KEY
SOLANA_TRACKER_DATA_API_KEY=YOUR_KEY

# LLM
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=minimax/minimax-m2.7
LLM_PROVIDER=openrouter

# Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ID=YOUR_TELEGRAM_USER_ID   # get from @userinfobot

# Wallet
VAULT_PASSPHRASE=change-me-to-something-strong
```

---

## 4. Build + Start

```bash
# One command — builds everything and starts all services
bash start.sh

# Check what's running
bash start.sh --status
```

This starts:
- **Agent Wallet** on `http://localhost:8421` — AES-256 encrypted dev + trade keys auto-generated
- **SolanaOS Daemon** — OODA loop, Telegram bot, gateway on port 18790
- **MCP Server** on `http://localhost:3001/mcp` (if Node.js is installed)

Or build and run individually:

```bash
make build                # main solanaos binary
make build-agent-wallet   # wallet API + local signing keys
./build/solanaos onboard  # interactive setup wizard
./build/solanaos server   # Control UI at http://localhost:7777
./build/solanaos daemon   # full agent
```

---

## 5. Test Without Real Money

```bash
./build/solanaos ooda --sim --interval 60
```

Runs the full OODA trading loop in simulation mode — no real transactions. Watch the Telegram bot start reporting signals.

---

## 6. What to Customize

### Agent personality (`SOUL.md`)
Edit [`SOUL.md`](SOUL.md) to change the agent's name, persona, and behavior. This is the system prompt.

### Trading strategy (`strategy.md`)
Edit [`strategy.md`](STRATEGY.md) for risk tolerance, position sizes, and trading rules.

### Add skills (`skills/`)
Drop a `SKILL.md` file in [`skills/`](skills/) to give the agent new capabilities. Format:

```markdown
---
name: my-skill
description: What this skill does
---
Instructions for the agent...
```

### Trading parameters
```bash
# In your .env:
OODA_INTERVAL_SECONDS=60      # how often to scan
MAX_POSITION_SOL=0.1          # max position size
STOP_LOSS_PCT=5               # stop loss %
TAKE_PROFIT_PCT=15            # take profit %
```

---

## 7. Deploy to Production

### Fly.io (recommended — free tier available)

```bash
bash deploy/deploy.sh
```

Prompts for app name, region, and secrets. Deploys the full stack with a persistent volume.

### Docker

```bash
docker build -t solanaos .
docker run --env-file .env -p 18790:18790 -p 7777:7777 solanaos
```

### One-shot installer (for others to use your fork)

Update the repo URL in `npm/solanaos/bin/install.mjs`, bump the version in `npm/solanaos/package.json`, then:

```bash
npm run publish:npm
```

Others can then install your fork with:

```bash
npx solanaos-computer@latest install
```

---

## 8. Connect to Solana Seeker (optional)

If you have a Solana Seeker phone:

```bash
./build/solanaos gateway start
./build/solanaos gateway setup-code   # prints pairing code
```

Paste the code in the Seeker app to pair your local agent with your phone.

---

## Repo Map (quick reference)

```
main.go                  # root CLI entry (cobra commands)
start.sh                 # start/stop/status all services
services/agent-wallet/   # AES-256 wallet vault + REST API (port 8421)
mcp-server/              # MCP server for Claude/Cursor/VS Code
pkg/daemon/              # 8,400-line orchestrator
pkg/agent/               # OODA loop
pkg/solana/              # Solana RPC + Birdeye + Jupiter
pkg/llm/                 # multi-model LLM + God Mode pipeline
pkg/channels/telegram/   # Telegram bot (60+ commands)
skills/                  # SKILL.md bundles
SOUL.md                  # agent identity / system prompt
strategy.md              # trading strategy config
.env.example             # all env vars documented
```

---

## Common Issues

**"wallet check skipped"** — add `HELIUS_RPC_URL` or `SOLANA_TRACKER_RPC_URL` to `.env`

**"no LLM provider"** — set `LLM_PROVIDER=openrouter` and `OPENROUTER_API_KEY`

**Telegram bot not responding** — make sure `TELEGRAM_ID` matches your Telegram user ID (get it from `@userinfobot`)

**MCP server not starting** — run `make build-mcp` first (requires Node.js 18+)

---

## Get Help

- [Docs](https://solanaos.net) — full reference
- [Discord / Telegram](https://seeker.solanaos.net) — community
- [Issues](https://github.com/x402agent/SolanaOS/issues) — bug reports
- [Discussions](https://github.com/x402agent/SolanaOS/discussions) — questions + ideas
