# SolanaOS Daemon

**The first agentic operating system for on-chain finance.**

SolanaOS is not a trading bot. It is an autonomous, multi-modal AI agent runtime that operates across Telegram, X/Twitter, iMessage, voice calls, browser automation, hardware miners, and mobile phones — all from a single compiled Go binary under 10MB that boots in under one second.

It trades perpetuals on Hyperliquid, swaps tokens on Jupiter, launches coins on pump.fun, controls your Chrome browser, runs cloud sandboxes, speaks and listens through Twilio calls, mines Bitcoin on a Bitaxe, raises a virtual pet whose mood reflects your P&L, remembers everything you tell it, and reasons about its own decisions using a persistent memory graph — all while running on a Raspberry Pi, an NVIDIA Orin Nano, a Solana Seeker phone, or your MacBook.

No Python. No Node.js. No Docker. One binary. Zero cloud dependency.

```
┌──────────────────────────────────────────────────────────────────────┐
│  SolanaOS Computer · Operator-Grade Solana Runtime                   │
│  Powered by SolanaOS · Go Runtime · x402 Protocol                    │
│  Autonomous Trading Intelligence · <10MB · Boots in <1s              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Architecture

```
          📱 Telegram / X / iMessage / Voice
                      │
                      ▼
              ┌───────────────┐
              │   Message Bus  │  ← channels publish inbound messages
              └───────┬───────┘
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
    ┌─────────┐  ┌─────────┐  ┌─────────┐
    │ Command │  │   NLP   │  │  OODA   │
    │ Router  │  │  Router │  │  Loop   │
    └────┬────┘  └────┬────┘  └────┬────┘
         │            │            │
         ▼            ▼            ▼
    ┌─────────────────────────────────────┐
    │           LLM Provider Layer        │
    │  Anthropic │ OpenRouter │ xAI │ Ollama │
    └────────────────────┬────────────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    ▼                    ▼                    ▼
┌────────┐        ┌───────────┐        ┌──────────┐
│ Solana │        │Hyperliquid│        │  Memory  │
│ On-chain│       │  Perps    │        │ClawVault │
│ Engine  │       │  Client   │        │ + Honcho │
└────────┘        └───────────┘        └──────────┘
```

### What runs inside the daemon

| Subsystem | Purpose |
|-----------|---------|
| **OODA Loop** | Observe-Orient-Decide-Act trading cycle on configurable interval |
| **Strategy Engine** | RSI (Wilder's smoothing) + EMA crossover + ATR-based stop/take |
| **Channel Manager** | Telegram, X/Twitter, BlueBubbles (iMessage), voice |
| **LLM Client** | Multi-provider: Anthropic, OpenRouter, xAI/Grok, Ollama (local) |
| **Memory Vault** | Auto-routed markdown knowledge graph with 7 categories |
| **Honcho** | Persistent multi-turn conversation memory with dialectic reasoning |
| **Skills Manager** | 83 dynamically loaded skills across 7 categories |
| **TamaGOchi** | Virtual pet companion whose mood reflects trading performance |
| **On-Chain Engine** | Jupiter swaps, Solana Tracker data, Helius RPC, token metadata |
| **Hyperliquid** | Full perps trading: market/limit orders, leverage, WebSocket streaming |
| **Aster DEX** | Perpetuals on Solana-native AMM |
| **Pump.fun Launcher** | Token creation, bonding curve buys/sells |
| **Browser Automation** | Page Agent (Chrome extension), E2B sandbox, Steel scraping |
| **Remote Control** | Claude Code sessions spawned and managed from Telegram |
| **Voice** | Whisper transcription, Mistral TTS/STT, Twilio phone calls |
| **Bitaxe Miner** | Hardware monitoring, auto-tuning, temperature alerts, pet integration |
| **Gateway** | TCP bridge with Tailscale mesh, headless node orchestration |
| **Cron Scheduler** | Automated tasks on hourly/daily/custom intervals |
| **Agent Registry** | IPFS-pinned agent identity and capability advertisement |
| **x402 Protocol** | On-chain payment gateway for agent-to-agent commerce |

---

## Active Model

The daemon supports hot-swappable LLM providers. The current configuration:

| Layer | Provider | Model |
|-------|----------|-------|
| **Chat / NLP** | Ollama (local) | `gemma4:latest` — 9.6 GB, running on port 11434 |
| **Browser Agent** | Ollama (local) | Same Gemma 4 model via OpenAI-compat API |
| **Fallback** | OpenRouter | `minimax/minimax-m2.5:free` |

Switch models live with `/model` from Telegram. No restart needed.

---

## Every Command

### Core

| Command | Aliases | What it does |
|---------|---------|--------------|
| `/start` | — | Welcome message with wallet, model, and runtime status |
| `/status` | — | Full system dashboard: wallet balance, OODA state, channels, pet mood |
| `/help` | `/menu` | Command reference |
| `/new` | `/reset` | Clear conversation history, fresh LLM session |
| `/model` | — | Show or switch active LLM provider/model (anthropic, openrouter, xai, ollama) |
| `/apikey` | `/key`, `/setkey` | Configure API keys at runtime |
| `/backends` | — | Show all configured LLM backends and their status |
| `/restart` | `/update`, `/rebuild` | Trigger daemon rebuild and restart from Telegram |

### Wallet & Trading

| Command | Aliases | What it does |
|---------|---------|--------------|
| `/wallet` | — | Agent wallet address, SOL balance, token holdings |
| `/buy` | `/token_buy` | Buy a token via Jupiter swap: `/buy <mint> <amount_sol>` |
| `/sell` | `/token_sell` | Sell a token via Jupiter swap: `/sell <mint> <pct>` |
| `/positions` | — | All open positions across all venues |
| `/trades` | — | Recent trade history |
| `/pnl` | — | Wallet profit & loss breakdown |
| `/launch` | `/pump` | Configure pump.fun token launch parameters |
| `/launch_now` | — | Execute the configured pump.fun launch |
| `/launch_status` | `/token` | Check launched token status |
| `/launch_buy` | — | Buy on the bonding curve |
| `/launch_sell` | — | Sell on the bonding curve |

### OODA & Strategy

| Command | Aliases | What it does |
|---------|---------|--------------|
| `/ooda` | — | OODA loop status: cycle count, mode (live/sim), watchlist |
| `/strategy` | `/strat` | Current strategy parameters: RSI thresholds, EMA periods, SL/TP |
| `/set` | — | Modify strategy params: `/set rsi_buy 25` |
| `/sim` | — | Switch to simulated trading mode |
| `/live` | — | Switch to live trading mode |
| `/automations` | — | Show all active cron jobs and scheduled tasks |

### Market Data (Solana Tracker)

| Command | What it does |
|---------|--------------|
| `/trending` | Top trending tokens right now |
| `/trending_tf` | Trending by timeframe (1h, 6h, 24h) |
| `/price <mint>` | Live price for any token |
| `/price_history` | Historical price data |
| `/token_search` | Search tokens by name or symbol |
| `/token_info` | Full token metadata and stats |
| `/token_overview` | Comprehensive token dashboard |
| `/token_pool` | Pool info for a token |
| `/token_trades` | Recent trades for a token |
| `/holders` | Holder distribution |
| `/holders_all` | Complete holder list |
| `/holders_top` | Top holders ranked |
| `/holders_chart` | Holder count over time |
| `/ath` | All-time high data |
| `/bundlers` | Detect bundled transactions (snipers) |
| `/deployer` | Token deployer wallet analysis |
| `/first_buyers` | First buyers of a token |
| `/latest_tokens` | Newest token launches |
| `/graduating` | Tokens about to graduate from pump.fun |
| `/graduated` | Recently graduated tokens |
| `/volume_tokens` | Tokens ranked by volume |
| `/volume_tf` | Volume by timeframe |
| `/top_performers` | Best performing tokens |
| `/stats` | Token statistics dashboard |
| `/pool_stats` | Pool-level statistics |
| `/pool_trades` | Trades within a pool |
| `/top_traders` | Top traders for a token |
| `/top_traders_page` | Paginated top traders |
| `/top_traders_token` | Top traders by token |
| `/tokens_multi` | Multi-token comparison |

### Wallet Analysis

| Command | What it does |
|---------|--------------|
| `/wallet_basic` | Basic wallet overview |
| `/wallet_page` | Paginated wallet token list |
| `/wallet_trades` | Trade history for any wallet |
| `/wallet_chart` | Wallet performance chart |
| `/wallet_token_trades` | Trades for a specific token in a wallet |
| `/token_pnl` | P&L for a specific token |

### Charts & Visualization

| Command | Aliases | What it does |
|---------|---------|--------------|
| `/chart` | — | Enhanced token chart with indicators |
| `/chart_pool` | — | Pool-level chart |
| `/be_chart` | `/birdeye_chart` | Birdeye charting integration |
| `/be_price` | `/birdeye_price` | Birdeye price data |
| `/be_prices` | `/birdeye_prices` | Multi-token Birdeye prices |
| `/be_token` | `/birdeye_token` | Birdeye token overview |
| `/be_stream` | `/birdeye_stream` | Birdeye real-time stream |

### DEX Pairs

| Command | What it does |
|---------|--------------|
| `/pair_new` | Newest trading pairs |
| `/pair_price` | Pair price data |
| `/pair_txs` | Pair transaction history |
| `/pair_list_price` | Batch pair prices |
| `/pair_list_txs` | Batch pair transactions |

### Safety & Research

| Command | Aliases | What it does |
|---------|---------|--------------|
| `/rug` | `/rugcheck`, `/safety` | Rug pull risk analysis for any token |
| `/scope` | `/memescope` | Memecoin scope analysis |
| `/research` | — | Deep research on any topic using web + on-chain data |
| `/web` | — | Web search via xAI |
| `/xsearch` | — | X/Twitter search |

### Hyperliquid Perpetuals

| Command | What it does |
|---------|--------------|
| `/hl` | `/hl_account` — Account overview |
| `/hl_balance` | Margin balance, available funds |
| `/hl_positions` | Open perps positions with P&L |
| `/hl_orders` | Open order book |
| `/hl_mid <coin>` | Mid/mark/oracle prices |
| `/hl_fills` | Recent execution fills |
| `/hl_candles <coin>` | OHLCV candle data |
| `/hl_open <coin> <size>` | Market order (add `long`/`short`, `5x` leverage) |
| `/hl_order <coin> <size> <price>` | Limit order |
| `/hl_close <coin>` | Close position |
| `/hl_cancel <oid>` | Cancel order |
| `/hl_leverage <coin> <value>` | Set leverage |
| `/hl_stream` | WebSocket stream status |

### Aster DEX

| Command | Aliases | What it does |
|---------|---------|--------------|
| `/perps` | `/aster` | Aster overview |
| `/aster_account` | `/aacct` | Aster account info |
| `/aster_positions` | `/apos` | Open Aster positions |
| `/aster_orders` | `/aord` | Open Aster orders |
| `/aster_trades` | `/atrades` | Aster trade history |
| `/aster_income` | `/aincome` | Aster income/fees |
| `/aster_open` | `/along`, `/ashort` | Open Aster position |
| `/aster_close` | `/aclose` | Close Aster position |

### Memory & Intelligence

| Command | What it does |
|---------|--------------|
| `/memory` | Memory vault overview or recall if given a query |
| `/memory_search` | Search memory by keyword |
| `/recall` | Query Honcho conversation memory |
| `/remember` | Save something to long-term memory |
| `/forget` | Remove a memory entry |
| `/ask_memory` | Ask a question against your memory graph |
| `/dream` | Agent reflects on recent activity and generates insights |
| `/profile` | Your user model — what the agent knows about you |
| `/card` | Agent identity card |
| `/user_model` | Detailed user preference model |
| `/learn_status` | Learning system status |
| `/honcho_status` | Honcho memory backend status |
| `/honcho_context` | Current conversation context from Honcho |
| `/honcho_sessions` | List all memory sessions |
| `/honcho_summaries` | Session summaries |
| `/honcho_search` | Search across all sessions |
| `/honcho_messages` | Raw messages in a session |
| `/honcho_conclusions` | Agent conclusions from reasoning |
| `/memory_sessions` | Session listing |
| `/trajectories` | Decision trajectory history |

### Pet Companion

| Command | What it does |
|---------|--------------|
| `/pet` | TamaGOchi status: stage, mood, energy, level, XP, streak |

The pet evolves through 6 stages based on trading performance:

| Stage | Condition |
|-------|-----------|
| Egg | First boot, pre-wallet |
| Larva | Wallet exists, 0 trades |
| Juvenile | 10-50 trades |
| Adult | 50+ trades, >40% win rate |
| Alpha | 200+ trades, >55% win rate, profitable P&L |
| Ghost | Offline >24h or balance depleted |

7 mood states map to RGB LED colors on hardware:
- **Ecstatic** (gold) — 5+ win streak
- **Happy** (green) — positive P&L
- **Neutral** (blue) — idle
- **Anxious** (orange) — losing streak building
- **Sad** (red) — 3+ consecutive losses
- **Hungry** (amber) — low balance
- **Sleeping** (purple) — idle >1 hour

### Skills

| Command | What it does |
|---------|--------------|
| `/skills` | List all 83 loaded skills across 7 categories |
| `/skill <name>` | View a skill's definition and usage |
| `/skill_find <query>` | Semantic search for relevant skills |
| `/skill_use <name>` | Execute a skill directly |
| `/skill_create` | Create a new skill definition |
| `/skills_count` | Total skill count |
| `/skills_auto` | Auto-discover applicable skills for current context |

### Browser & Computer Control

| Command | Aliases | What it does |
|---------|---------|--------------|
| `/pageagent` | `/pa` | Send a task to Chrome browser via Page Agent extension |
| `/browseruse` | `/browser` | Cloud browser sessions (activate, connect, named sessions) |
| `/computer` | `/cmd` | Direct computer control |
| `/cua` | `/computeruse`, `/steel` | Computer Use Agent / Steel web scraping |
| `/desktop` | `/dsk` | Cloud desktop environment (E2B Desktop) |
| `/sandbox` | `/sbx` | Cloud code execution sandbox (E2B) |
| `/run` | `/exec` | Run code in sandbox |
| `/shell` | — | Execute shell commands in sandbox |
| `/sandbox_kill` | `/sbx_kill` | Kill sandbox |
| `/sandbox_list` | `/sbx_list` | List active sandboxes |

### Media & Vision

| Command | Aliases | What it does |
|---------|---------|--------------|
| `/vision` | — | Analyze an image (send photo + /vision) |
| `/generate` | `/art`, `/image`, `/img` | Generate images via xAI |
| `/edit` | — | Edit an image with AI |
| `/video` | — | Generate video via xAI |

### Voice & Phone

| Command | Aliases | What it does |
|---------|---------|--------------|
| `/speak` | `/tts` | Text-to-speech via Mistral |
| `/say` | — | Quick voice message |
| `/transcribe` | `/stt` | Speech-to-text via Mistral |
| `/call` | `/phone` | Make a phone call via Twilio |

### AI Modes

| Command | Aliases | What it does |
|---------|---------|--------------|
| `/godmode` | `/gm` | Godmode: multi-model race — all providers answer simultaneously |
| `/ultraplinian` | `/ultra` | Ultra Plinian: maximum reasoning depth mode |
| `/multi` | — | Multi-agent collaboration (4 agents) |
| `/multi16` | — | Multi-agent collaboration (16 agents) |
| `/deepsolana` | — | Deep Solana analysis mode |
| `/mimo` | — | Mimo model for specific tasks |
| `/local` | `/mlx` | Switch to local MLX model |

### Remote Development

| Command | Aliases | What it does |
|---------|---------|--------------|
| `/remote` | `/remotecontrol`, `/rc` | Spawn and manage Claude Code remote-control sessions |
| `/claude` | — | Claude Code integration commands |
| `/github` | — | GitHub operations (PRs, issues, repos) |

### Mining

| Command | Aliases | What it does |
|---------|---------|--------------|
| `/miner` | `/hashrate`, `/btc`, `/mining` | Bitaxe miner status, hashrate, temperature, auto-tune |

### Social

| Command | Aliases | What it does |
|---------|---------|--------------|
| `/twitter` | `/xdaemon` | X/Twitter posting and monitoring |
| `/grok` | `/xai` | xAI/Grok model status |
| `/personality` | `/persona` | Set the agent's personality and tone |

### System

| Command | What it does |
|---------|--------------|
| `/x402` | x402 payment protocol status |
| `/registry` | Agent registry status (IPFS-pinned identity) |
| `/registry_sync` | Sync agent identity to IPFS |
| `/delegates` | Task delegation status |
| `/readfile` | Read a file from the filesystem |
| `/writefile` | Write a file to the filesystem |
| `/lsdir` | List directory contents |

### Natural Language (no command needed)

The daemon also handles free-text messages without any slash command:

- **Token queries** — "what is TRUMP", "price of BONK" → auto-detected, fetches token data
- **Contract addresses** — paste any Solana address → auto-fetches token info
- **Trading intent** — "buy 0.1 SOL of BONK" → parsed and executed
- **Model switching** — "switch to grok" → hot-swaps LLM provider
- **Coding requests** — "write a script that..." → routes to sandbox
- **Desktop control** — "open a browser and..." → routes to computer use
- **Image generation** — "generate an image of..." → routes to xAI
- **Chart requests** — "show me the chart for SOL" → auto-generates chart
- **Rug checks** — "is this token safe?" → auto-runs safety analysis
- **General chat** — anything else → full LLM conversation with context

---

## What Makes SolanaOS Different

### 1. Single Binary, Zero Dependencies
No Docker. No Python. No Node.js runtime. The daemon compiles to a single Go binary under 10MB. It boots in under one second on ARM64 hardware. It runs on a Raspberry Pi, an NVIDIA Orin Nano, a Solana Seeker phone, or an M-series Mac.

### 2. The Pet Feels Your P&L
The TamaGOchi companion is not a gimmick. It maps real trading metrics to emotional states in real time. When you are on a 5-win streak, the pet is ecstatic and the hardware LED glows gold. When you hit 3 consecutive losses, it turns sad and the LED goes red. The pet evolves through 6 life stages based on cumulative trade count and win rate. It is the only trading system where your agent has feelings about its own performance.

### 3. Memory That Organizes Itself
ClawVault auto-routes every memory entry into one of 7 categories (decisions, lessons, trades, research, tasks, backlog, inbox) based on linguistic patterns. Say "I decided to avoid low-cap tokens" and it files under `decisions`. Say "learned that RSI divergence works on 4h" and it files under `lessons`. The agent builds a knowledge graph without manual taxonomy.

### 4. Skills Are First-Class Citizens
83 skills loaded at boot. The LLM can discover, invoke, and create new skills by mentioning them in conversation. This is not a plugin system — it is dynamic capability loading where new features emerge from reasoning itself.

### 5. Multi-Exchange Unified Syntax
One command syntax trades across Hyperliquid perpetuals (`/hl_open`), Aster AMM (`/aster_open`), and Solana on-chain Jupiter swaps (`/buy`). The agent abstracts away protocol differences and handles slippage, priority fees, and margin calculations natively.

### 6. The Agent Can Modify Itself
The daemon spawns Claude Code sessions from Telegram (`/remote`). This means the agent can debug its own code, write new features, and push updates — all commanded from a chat message. Meta-programming in production.

### 7. Hardware in the Loop
The Bitaxe miner integration is bidirectional. The daemon monitors hashrate, temperature, and power. The OODA agent auto-tunes frequency and voltage. Mining alerts flow to Telegram. The pet's mood accounts for mining revenue. The RGB LED on the hardware reflects the agent's emotional state.

### 8. Voice-First When You Want It
Send a voice message on Telegram — Whisper transcribes it. The agent responds. Ask it to `/call` your phone — Twilio dials out, the agent speaks through Mistral TTS. This is not text-only.

### 9. Runs on Your Local Model
Set `LLM_PROVIDER=anthropic` and `ANTHROPIC_BASE_URL=http://localhost:4000` to route all intelligence through a local model running on Ollama. Zero API fees. Zero data leaving your machine. The current setup uses Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled — a 16 GB model that runs on any M-series Mac.

### 10. Browser Control From Chat
Type `/pa go to coingecko and find the top 5 trending tokens` in Telegram. The Page Agent Chrome extension opens Coingecko, navigates the page, extracts the data, and sends it back. The browser agent uses the same local model for its reasoning.

---

## Running the Daemon

```bash
# Build
go build -o solanaos .

# Start (loads .env.local automatically)
./solanaos daemon
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_PROVIDER` | Yes | `anthropic`, `openrouter`, `xai`, or `ollama` |
| `ANTHROPIC_API_KEY` | For anthropic | API key (or `sk-local` for local proxy) |
| `ANTHROPIC_BASE_URL` | For local | `http://localhost:4000` for local model |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token |
| `TELEGRAM_ID` | Yes | Your Telegram user ID (access control) |
| `HELIUS_RPC_URL` | Yes | Solana RPC endpoint |
| `SOLANA_PRIVATE_KEY` | Yes | Agent wallet private key |
| `OPENROUTER_API_KEY` | Optional | OpenRouter fallback |
| `XAI_API_KEY` | Optional | xAI/Grok for vision, image gen, web search |
| `OLLAMA_MODEL` | Optional | Ollama model name for direct Ollama provider |
| `HYPERLIQUID_PRIVATE_KEY` | Optional | Hyperliquid perps trading |
| `E2B_API_KEY` | Optional | Cloud sandbox execution |
| `BROWSERUSE_API_KEY` | Optional | Cloud browser sessions |
| `HONCHO_API_KEY` | Optional | Persistent memory backend |
| `CF_AIG_DISABLE` | Optional | Set to `true` to bypass Cloudflare AI Gateway |

### Local Model Setup (Gemma 4 via Ollama)

The daemon uses Ollama for local inference with Gemma 4:

```bash
# 1. Ensure Ollama is running with the Gemma 4 model
ollama run gemma4:latest

# 2. Start the daemon
./solanaos daemon
```

The daemon reads `OLLAMA_BASE_URL=http://127.0.0.1:11434/v1` from `.env.local` and routes all LLM calls through the local Gemma 4 model via OpenAI-compatible API. No API fees. No data leaves your machine.

#### Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434/v1` | Ollama OpenAI-compatible endpoint |
| `OLLAMA_MODEL` | `gemma4:latest` | Model name in Ollama |
| `LLM_PROVIDER` | `ollama` | Provider selection |

#### Pull the Model

If you need to download the Gemma 4 model:

```bash
# Pull from Ollama registry
ollama pull gemma4:latest
```

---

## License

MIT — 8BIT Labs, 2026.
