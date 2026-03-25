# SolanaOS — Agent Skill Sheet

> Give this file to any AI agent (Claude, Codex, GPT-4, MiniMax, etc.) to fully install, configure, and run SolanaOS in one shot.

---

## What You Are Installing

**SolanaOS Companion** — an autonomous Solana trading agent by SolanaOS Labs.

- Single ~10MB Go binary (`nanosolana`)
- Runs a full OODA trading loop (RSI + EMA + ATR strategy)
- Telegram bot with live strategy controls
- Chrome extension with wallet + miner card
- Bitaxe Gamma 602 Bitcoin miner integration
- x402 payment protocol for monetized APIs
- macOS menu bar app + persistent LaunchAgent daemon
- Powered by a local-first Ollama harness (default: `minimax-m2.7:cloud`)

---

## Prerequisites

The agent should verify these exist before proceeding:

- `go` >= 1.21 (`go version`)
- `git` (`git --version`)
- `curl` (`curl --version`)
- macOS (for LaunchAgent) or Linux (for systemd)
- A `.env` file in the project root (see Step 2)

---

## Step 1 — Clone the Repo

```bash
git clone https://github.com/x402agent/Solana-Os-Go nanosolana
cd nanosolana
```

---

## Step 2 — Create `.env`

Create a `.env` file in the project root. Minimum required fields:

```bash
# ── Required ──────────────────────────────────────────────────
HELIUS_API_KEY=your_helius_api_key          # https://helius.dev
TELEGRAM_BOT_TOKEN=your_telegram_bot_token  # https://t.me/BotFather
TELEGRAM_ID=your_telegram_user_id           # your numeric Telegram user ID

# ── Wallet (auto-generated on first boot if omitted) ──────────
# SOLANA_PRIVATE_KEY=base58_encoded_keypair

# ── AI Model ──────────────────────────────────────────────────
LLM_PROVIDER=ollama
OLLAMA_MODEL=minimax-m2.7:cloud

# ── Optional: Native Claude backend ───────────────────────────
# ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-sonnet-4-6

# ── Optional: Grok tool/search path ───────────────────────────
# XAI_API_KEY=your_xai_key
# XAI_TOOL_MODEL=grok-4.20-beta-latest-non-reasoning

# ── Optional: Bitaxe Bitcoin miner ────────────────────────────
# BITAXE_HOST=192.168.1.XX
# BITAXE_ENABLED=true
# BITAXE_POLL_INTERVAL=10

# ── Optional: x402 payment paywall ────────────────────────────
# X402_PAYWALL_ENABLED=true
# X402_FACILITATOR_URL=https://facilitator.x402.rs

# ── Optional: Aster perpetuals ────────────────────────────────
# ASTER_API_KEY=your_aster_key
# ASTER_API_SECRET=your_aster_secret
# HYPERLIQUID_PRIVATE_KEY=0x...
# HYPERLIQUID_WALLET=0x...

# ── Optional: Remote gateway / Tailscale ──────────────────────
# OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
# OPENCLAW_GATEWAY_TOKEN=your_token
# GATEWAY_TAILSCALE_MODE=serve

# ── Optional: Solana Agent Registry ──────────────────────────
# AGENT_REGISTRY_ENABLED=true
# AGENT_REGISTRY_CLUSTER=mainnet-beta
```

---

## Step 3 — Build

```bash
make build
# Output: build/solanaos
```

Or build manually:
```bash
go build -o build/solanaos .
```

---

## Step 4 — Onboard (First Run)

```bash
./build/solanaos onboard
```

This generates the agent wallet, creates `~/.nanosolana/config.json`, and validates your API keys.

---

## Step 5 — Run the Daemon

### Option A: Foreground (development)
```bash
./build/solanaos daemon
```

### Option B: Persistent macOS LaunchAgent (recommended)
```bash
# Install as a system service that survives reboots and crashes
bash scripts/install-service.sh

# Check status
bash scripts/install-service.sh --status

# View logs
tail -f ~/Library/Logs/nanosolana/daemon.out.log
```

### Option C: Docker
```bash
docker build -t solanaos .
docker run -d --name solanaos --env-file .env solanaos
```

### Option D: systemd (Linux)
```bash
sudo cp build/solanaos /usr/local/bin/
sudo tee /etc/systemd/system/solanaos.service <<EOF
[Unit]
Description=SolanaOS Daemon
After=network.target

[Service]
EnvironmentFile=/path/to/.env
ExecStart=/usr/local/bin/solanaos daemon
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now solanaos
```

---

## Step 6 — Verify

```bash
# Check daemon health
curl http://127.0.0.1:7777/api/status

# Expected fields in response:
# { "status": "ok", "daemon": "running", "oodaMode": "simulated"|"live", ... }
```

---

## Step 7 — Chrome Extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `chrome-extension/` folder in this repo
5. Click the SolanaOS Control icon in the toolbar

The extension auto-connects to `http://127.0.0.1:7777`.

---

## Step 8 — Bitaxe Miner (Optional)

```bash
# Auto-discover Bitaxe on LAN, configure pool, write .env
BTC_WALLET=bc1q...your_address bash scripts/bitaxe-quickstart.sh

# Restart daemon to pick up miner config
launchctl kickstart -k gui/$(id -u)/com.nanosolana.daemon
```

After this the Chrome extension shows a live hashrate card and Telegram responds to `/miner`.

---

## Step 9 — Use the Local MiniMax Harness (Optional)

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull MiniMax M2.7
ollama pull minimax-m2.7:cloud

# Point SolanaOS at it
echo "LLM_PROVIDER=ollama" >> .env
echo "OLLAMA_MODEL=minimax-m2.7:cloud" >> .env

# Restart daemon
launchctl kickstart -k gui/$(id -u)/com.nanosolana.daemon
```

---

## Telegram Commands Reference

| Command | Description |
|---------|-------------|
| `/status` | Full runtime dashboard: model, wallet, Honcho, Aster, Hyperliquid, services |
| `/wallet` | Wallet address + SOL balance |
| `/personality` | Set bot persona and preferred name |
| `/trending` | Trending Solana tokens |
| `/ooda` | Trigger OODA cycle |
| `/sim` | Switch to simulated mode |
| `/live` | Switch to live trading mode |
| `/strategy` | Show strategy parameters |
| `/set <param> <value>` | Live-edit strategy (e.g. `/set rsi_period 12`) |
| `/miner` | Bitaxe hashrate, temp, power |
| `/research <mint>` | Deep research a token |
| `/trades` | Recent trade history |
| `/web <query>` | Grok web search |
| `/xsearch <query>` | Grok X search |
| `/deepsolana <prompt>` | Force the local Ollama harness path |
| `/help` | All commands |

---

## Strategy Parameters (live-editable via `/set`)

| Parameter | Default | Range |
|-----------|---------|-------|
| `rsi_period` | 14 | 5–30 |
| `rsi_overbought` | 72 | 60–90 |
| `rsi_oversold` | 28 | 10–40 |
| `ema_fast` | 9 | 3–20 |
| `ema_slow` | 21 | 10–100 |
| `stop_loss` | 7 | 1–20 (%) |
| `take_profit` | 25 | 5–100 (%) |
| `position_size` | 10 | 1–20 (%) |

---

## Key Files

| File | Purpose |
|------|---------|
| `main.go` | CLI entrypoint — all commands |
| `pkg/daemon/daemon.go` | Orchestrator — wallet, OODA, Telegram, miner |
| `pkg/strategy/strategy.go` | RSI + EMA + ATR signal engine |
| `pkg/config/config.go` | Config struct + Load/Save |
| `pkg/nanobot/server.go` | Local HTTP server (port 7777) |
| `chrome-extension/` | MV3 Chrome extension |
| `scripts/install-service.sh` | macOS LaunchAgent installer |
| `scripts/bitaxe-quickstart.sh` | Bitaxe auto-setup |
| `strategy.md` | Strategy documentation |
| `docs/bitaxe-setup.md` | Bitaxe full setup guide |

---

## Common Issues

| Problem | Fix |
|---------|-----|
| Port 7777 in use | `lsof -i :7777` → kill the process |
| Telegram 409 Conflict | `pkill -f "nanosolana"` then restart |
| Wallet not found | Run `nanosolana onboard` |
| Extension shows offline | Make sure daemon is running, check `curl http://127.0.0.1:7777/api/status` |
| Build fails | Run `go mod tidy` then `make build` |

---

## One-Shot Agent Prompt

If you want an AI agent to do the entire setup automatically, paste this:

```
Read skill.md in the Solana-Os-Go project root.
Follow every step in order.
My .env values are:
  HELIUS_API_KEY=...
  OPENROUTER_API_KEY=...
  TELEGRAM_BOT_TOKEN=...
  TELEGRAM_CHAT_ID=...
Complete the full installation including LaunchAgent and Chrome extension.
Confirm each step before proceeding.
```

---

*SolanaOS Companion · Built by SolanaOS Labs · Apache 2.0*
