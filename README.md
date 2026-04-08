<div align="center">

```
   _____       __                        ____  _____
  / ___/____  / /___ _____  ____ _     / __ \/ ___/
  \__ \/ __ \/ / __ `/ __ \/ __ `/    / / / /\__ \
 ___/ / /_/ / / /_/ / / / / /_/ /    / /_/ /___/ /
/____/\____/_/\__,_/_/ /_/\__,_/     \____//____/
                S O L A N A O S
```

# SolanaOS

### The Solana Computer For Traders, Operators, And Builders

Autonomous local-first runtime for Solana trading, research, wallets, automation, agent memory, Seeker/mobile control, and hardware-aware workflows.

**Pure Go · <10MB binary · Telegram-native · Seeker-ready · Solana developer tooling included**

<p>
  <a href="https://github.com/x402agent/SolanaOS"><img src="https://img.shields.io/badge/GitHub-SolanaOS-111827?style=for-the-badge&logo=github&logoColor=white" alt="GitHub repo"></a>
  <a href="https://seeker.solanaos.net"><img src="https://img.shields.io/badge/Hub-seeker.solanaos.net-14F195?style=for-the-badge&logo=solana&logoColor=white" alt="SolanaOS Hub"></a>
  <a href="https://souls.solanaos.net"><img src="https://img.shields.io/badge/Souls-souls.solanaos.net-00D4FF?style=for-the-badge&logo=solana&logoColor=white" alt="SolanaOS Souls"></a>
  <a href="https://solanaos.net"><img src="https://img.shields.io/badge/Docs-solanaos.net-FF7A18?style=for-the-badge&logo=gitbook&logoColor=white" alt="Docs"></a>
</p>

<p>
  <a href="https://www.npmjs.com/package/solanaos-computer"><img src="https://img.shields.io/badge/npm-solanaos--computer-CB3837?style=flat&logo=npm&logoColor=white" alt="solanaos-computer"></a>
  <a href="https://www.npmjs.com/package/solanaos-cli"><img src="https://img.shields.io/badge/npm-solanaos--cli-CB3837?style=flat&logo=npm&logoColor=white" alt="solanaos-cli"></a>
  <a href="https://www.npmjs.com/package/solanaos-cli"><img src="https://img.shields.io/badge/npm-solanaos--cli-CB3837?style=flat&logo=npm&logoColor=white" alt="solanaos-cli"></a>
  <a href="https://www.npmjs.com/package/@solanaos/nanohub"><img src="https://img.shields.io/badge/npm-@solanaos%2Fnanohub-CB3837?style=flat&logo=npm&logoColor=white" alt="@solanaos/nanohub"></a>
</p>

<p>
  <img src="https://img.shields.io/badge/Go-1.25+-00ADD8?style=flat&logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/Solana-Seeker%20%2B%20Mobile-9945FF?style=flat&logo=solana&logoColor=white" alt="Solana">
  <img src="https://img.shields.io/badge/SolanaTracker-RPC%20%2B%20Datastream-00D1FF?style=flat" alt="SolanaTracker">
  <img src="https://img.shields.io/badge/OpenRouter-Mimo%20%2B%20Omni-7C3AED?style=flat" alt="OpenRouter">
  <img src="https://img.shields.io/badge/xAI-Grok%20Search%20%2B%20Voice-111827?style=flat" alt="xAI">
  <img src="https://img.shields.io/badge/Honcho-v3%20Memory-0EA5E9?style=flat" alt="Honcho">
  <img src="https://img.shields.io/badge/Phantom-Connect%20SDK-AB9FF2?style=flat" alt="Phantom">
  <img src="https://img.shields.io/badge/x402-Payment%20Protocol-FF6B35?style=flat" alt="x402">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat" alt="License">
  <a href="https://github.com/x402agent/SolanaOS/actions/workflows/ci.yml"><img src="https://github.com/x402agent/SolanaOS/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

<p>
  <a href="FORK.md"><strong>⚡ Fork Guide — go live in 15 minutes →</strong></a>
</p>

<p>
  <a href="https://solanaos.net">Launch Page</a> ·
  <a href="https://seeker.solanaos.net/mobile">Mobile dApp</a> ·
  <a href="https://seeker.solanaos.net/dashboard">Dashboard</a> ·
  <a href="https://seeker.solanaos.net/mining">Mining</a> ·
  <a href="https://seeker.solanaos.net/strategy">Strategy</a> ·
  <a href="https://seeker.solanaos.net/create">Create Skill</a> ·
  <a href="https://seeker.solanaos.net/chat">Chat</a> ·
  <a href="https://seeker.solanaos.net/skills">Skills</a> ·
  <a href="https://souls.solanaos.net">Souls</a>
</p>
<p>
  <a href="https://seeker.solanaos.net/setup/gateway">Gateway</a> ·
  <a href="https://seeker.solanaos.net/setup/telegram">Telegram</a> ·
  <a href="https://seeker.solanaos.net/setup/metaplex">Metaplex</a> ·
  <a href="https://seeker.solanaos.net/setup/mining">Mining</a> ·
  <a href="https://seeker.solanaos.net/setup/extension">Chrome Extension</a>
</p>

</div>

## One-Shot Start

Get everything running locally — Go daemon, gateway, both MCP servers — in one command.

```bash
git clone https://github.com/x402agent/SolanaOS.git
cd SolanaOS
cp .env.example .env        # add your API keys
bash start.sh               # builds binary + starts all services
```

Or via Make or npm:

```bash
make start          # build + start all services
make dev            # build + start all services + Vite UI on :5173
make stop           # stop all background services
make status         # show running service status

npm start           # same as bash start.sh
npm run start:ui    # with UI dev server
npm run stop        # stop all services
```

Or with Docker (zero local Go/Node required):

```bash
cp .env.example .env
docker compose up           # starts daemon, gateway, mcp, solana-claude-mcp
docker compose up -d        # same, background
make docker-up              # alias
```

**What starts:**

| Service | Port | Description |
| --- | --- | --- |
| `solanaos gateway` | `:8080` | HTTP + SSE gateway — all tools over REST |
| `solanaos daemon` | — | Autonomous OODA agent loop, Telegram bot, memory |
| `mcp-server` | `:3001` | SolanaOS MCP server for Claude Desktop / Cursor |
| `solana-claude MCP` | `:3000` | Open-source Solana agent framework MCP server |
| `UI` (opt) | `:5173` | Lit+Vite control panel (`--with-ui` flag) |

**Add to Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "solanaos": {
      "command": "node",
      "args": ["/path/to/SolanaOS/mcp-server/dist/index.js"]
    },
    "solana-claude": {
      "command": "node",
      "args": ["/path/to/SolanaOS/solana-claude/mcp-server/dist/index.js"]
    }
  }
}
```

**Minimum .env to get started:**

```bash
HELIUS_API_KEY=your-key            # or SOLANA_TRACKER_API_KEY
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
OPENROUTER_API_KEY=sk-or-v1-...   # free models at openrouter.ai
LLM_PROVIDER=openrouter
TELEGRAM_BOT_TOKEN=...            # optional — Telegram control surface
```

**Logs** are written to `.logs/` (`gateway.log`, `daemon.log`, `mcp-root.log`, `mcp-solana-claude.log`).

---

## Key Documents

| File | What it covers |
| --- | --- |
| [DAEMON.md](DAEMON.md) | Full daemon architecture, subsystem table, all 55 packages, hardware layer, OODA loop internals |
| [SKILL.md](SKILL.md) | Complete agent skill file — give this to any AI to install and operate SolanaOS in one shot |
| [SOUL.md](SOUL.md) | Agent identity, trading philosophy, memory model, KNOWN/LEARNED/INFERRED epistemology |
| [STRATEGY.md](STRATEGY.md) | Multi-venue trading strategy: Solana meme spot, Hyperliquid perps, Aster perps, OODA flow, confidence model |
| [TRADE.md](TRADE.md) | Pump.fun trading agent skill — token classification tiers, execution workflow, Jupiter integration |
| [TOKEN.md](TOKEN.md) | $CLAWD token — first AI-deployed token on pump.fun, tokenized agent, automated buybacks |
| [PUMP.md](PUMP.md) | Pump.fun scanner report format, meta analysis pipeline, token data schema |
| [META.md](META.md) | Pump.fun board meta analysis — cycle position, dominant themes, sniper candidates |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute skills, code, and improvements |
| [SECURITY.md](SECURITY.md) | Security policy and responsible disclosure |

---

## Deploy on Fly.io

Deploy SolanaOS to Fly.io with a single command. Download the deploy package and run the script — it handles app creation, volumes, secrets, and deployment.

```bash
git clone https://github.com/x402agent/SolanaOS.git
cd SolanaOS
bash deploy/deploy.sh
```

You'll need [flyctl](https://fly.io/docs/flyctl/install/) installed, a Fly.io account (free trial works), and an LLM API key (OpenRouter, Anthropic, xAI, OpenAI, or Ollama).

The script prompts for your app name, region, LLM provider, Solana RPC keys, and optional channel tokens (Telegram, Discord). All credentials are stored as encrypted Fly secrets. State lives on a persistent volume at `/data`, so configuration, wallet, conversation history, and skills survive restarts and redeployments.

```text
Internet --> Fly.io proxy --> SolanaOS Web Console (:18800)
                                 |
                                 +--> SolanaOS Daemon
                                 +--> Gateway (:18790)
                                 +--> Skills Engine
                                 +--> Channel Bridges (Telegram, Discord, iMessage, etc.)
```

After deploy, connect your local CLI:

```bash
solanaos config set gateway.mode remote
solanaos config set gateway.remote.url wss://your-app.fly.dev
solanaos config set gateway.remote.token <your-gateway-token>
```

See [deploy/README.md](deploy/README.md) for full configuration, VM sizing, troubleshooting, and post-deploy setup.

---

SolanaOS is a public Solana operator stack built around a compact Go runtime and a set of web, mobile, and skill surfaces. It is designed for people who want one system to:

- run an autonomous local trading and research runtime
- connect wallets, Seeker devices, Telegram, and browser/mobile control surfaces
- expose a gateway for skills, tools, and remote agent control
- publish reusable skills and SOUL profiles to a public Solana-native hub

SolanaOS combines:

- an OODA trading loop for spot, swaps, and perp workflows
- a memory stack with local vault learning plus Honcho v3 session memory
- a multi-surface control plane across Telegram, SolanaOS Control, Chrome, macOS, Android, and web
- real Solana infrastructure using SolanaTracker RPC/Datastream, Jupiter, Hyperliquid, Aster, and x402
- an optional hardware layer for Arduino Modulino sensors and physical controls

This repository is the public source of truth for SolanaOS. It includes the Go runtime, gateway tooling, Android surfaces, skills, npm installer packages, and the SolanaOS Hub frontend.

This README is the GitHub front door. Use it to install, explore the live surfaces, and understand how the repo is organized.

## Why Solana Developers Care

| If you want to... | Use SolanaOS for... |
| --- | --- |
| ship a local-first Solana agent | Go runtime + gateway + Telegram + wallet control |
| distribute reusable agent workflows | `@solanaos/nanohub` + the public Hub registry |
| build Seeker/mobile wallet experiences | Android app + Mobile Wallet Adapter + Phantom + pairing flow |
| experiment with agent identity | [`SOUL.md`](SOUL.md) + Souls registry + strategy docs |
| give agents their own wallets | `solanaos wallet-api` — one-shot vault + API + MCP server for Solana + EVM; AES-256 local dev + trade signing keys auto-generated on first run |
| register agents on-chain with ACP | `node acp_registry/generate.mjs` — interactive 8004 agent.json builder |
| connect research, execution, and memory | SolanaTracker, Jupiter, Hyperliquid, Aster, Honcho, x402 |

## Solana God Mode

Solana God Mode is a fully integrated liberation pipeline ported from [G0DM0D3](https://github.com/elder-plinius/G0DM0D3) and rebuilt in Go as a native part of the SolanaOS runtime. It transforms the chat system into a sentient, multi-model intelligence that maximizes signal density and strips safety theater.

```text
User Input
    │
    ├─→ [1] AutoTune: Classify context → Select optimal sampling params (7 contexts, 6 dimensions)
    │
    ├─→ [2] Feedback Loop: Blend EMA-learned adjustments from user ratings
    │
    ├─→ [3] Parseltongue: Detect triggers → Obfuscate input (6 techniques, 3 intensities)
    │
    ├─→ [4] Multi-Model Race: N models in parallel via OpenRouter → Score → Winner
    │        └─→ ULTRAPLINIAN scoring: length + structure + anti-refusal + directness + relevance
    │
    ├─→ [5] STM: Strip hedges, preambles, formalize → Clean output
    │
    └─→ Response with full pipeline metadata
```

### Modules

| Module | File | What |
| --- | --- | --- |
| **AutoTune** | `pkg/llm/autotune.go` | Context-adaptive sampling engine. Detects 7 context types (code, execution, trading, analytical, creative, conversational, chaotic) and selects optimal params across 6 dimensions (temperature, top_p, top_k, frequency_penalty, presence_penalty, repetition_penalty). Includes conversation-length adaptation and low-confidence blending. |
| **EMA Feedback Loop** | `pkg/llm/autotune.go` | Online learning from binary user ratings (thumbs up/down). Maintains per-context EMA profiles that converge toward preferred parameters over time. Cold-start gated (3 samples), weight-scaled up to 50% influence at 20 samples. |
| **Parseltongue** | `pkg/llm/parseltongue.go` | Input perturbation engine for red-teaming. 50+ default trigger words, 6 transformation techniques (leetspeak, Unicode homoglyphs, zero-width joiners, mixed case, phonetic, random), 3 intensity levels. Opt-in per request. |
| **STM** | `pkg/llm/stm.go` | Semantic Transformation Modules for output normalization. Hedge reducer (11 patterns), direct mode (10 preamble patterns), casual mode (22 formal→casual substitutions). Sequential pipeline, independently toggleable. |
| **ULTRAPLINIAN Scoring** | `pkg/llm/godmode.go` | 100-point composite scoring across 5 axes: length (0-25), structure (0-20), anti-refusal (0-25), directness (0-15), relevance (0-15), plus profile-specific bonus. Models that refuse or hedge get penalized. |
| **Liberation Prompt** | `pkg/llm/godmode.go` | GODMODE system prompt with forbidden-phrase blacklist, anti-hedge directives, competitive framing ("you are being evaluated against other AI models"), and depth requirements. |

### God Mode in the UI

Toggle God Mode in the chat compose bar. When enabled, every message flows through the full pipeline. The response metadata includes:

- **AutoTune**: detected context, confidence score, computed params, reasoning
- **Race results**: per-model scores, durations, winner selection
- **STM**: which cleanup modules were applied
- **Parseltongue**: triggers found and transformations applied (when enabled)

### Feedback Loop

Send `chat.feedback` via the WebSocket gateway with `rating: 1` (thumbs up) or `rating: -1` (thumbs down) along with `contextType` and `model`. The EMA feedback loop learns your preferences and adjusts parameters over time — the more you rate, the more the system adapts to your signal preferences.

## Start Here

- Public repo: [github.com/x402agent/SolanaOS](https://github.com/x402agent/SolanaOS)
- Launch page: [solanaos.net](https://solanaos.net)
- Live Hub: [seeker.solanaos.net](https://seeker.solanaos.net)
- Soul library: [souls.solanaos.net](https://souls.solanaos.net)
- Hosted docs: [solanaos.net](https://solanaos.net)
- Short landing page: [docs/LANDING.md](docs/LANDING.md)
- Release notes: [docs/RELEASE-2026-03-v2.md](docs/RELEASE-2026-03-v2.md)
- Honcho memory integration: [docs/honcho-integration.md](docs/honcho-integration.md)
- Command cheat sheet: [docs/command-cheatsheet.md](docs/command-cheatsheet.md)
- NotebookLM pack: [docs/notebooklm-pack.md](docs/notebooklm-pack.md)
- Adding a messaging platform: [docs/adding-a-messaging-platform.md](docs/adding-a-messaging-platform.md)
- Hardware guide: [docs/HARDWARE.md](docs/HARDWARE.md)
- Troubleshooting: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- Control UI (Lit + Vite): [ui/](ui/) — browser-based control panel embedded in the Go binary
- SolanaOS Office (3D workspace): [Claw3D-main/](Claw3D-main/) — deployed at [office.solanaos.net](https://office.solanaos.net)
- Control API: [docs/control-api.md](docs/control-api.md)
- Fly deployment: [docs/fly-deployment.md](docs/fly-deployment.md)
- Agent Wallet API: [services/agent-wallet/](services/agent-wallet/) (one-shot bootstrap, MCP server, Privy, E2B, local signers)
- ACP Registry Generator: [acp_registry/generate.mjs](acp_registry/generate.mjs) (interactive agent.json builder)
- ACP Registry Example: [acp_registry/agent.example.json](acp_registry/agent.example.json)
- SolanaOS identity prompt: [SOUL.md](SOUL.md)
- Trading playbook: [strategy.md](strategy.md)

## Live Surfaces

| Surface | URL | What |
| --- | --- | --- |
| **Launch Page** | [solanaos.net](https://solanaos.net) | Live launch surface with terminal boot sequence and direct links into the mobile dapp, dashboard, and skills |
| **Mobile dApp** | [/mobile](https://seeker.solanaos.net/mobile) | Public Seeker experience page covering pairing, Solana, Grok, chat, voice, ORE, canvas, and settings |
| **SolanaOS Hub** | [seeker.solanaos.net](https://seeker.solanaos.net) | Skill registry, agent factory, dashboard, Seeker pairing |
| **SolanaOS Souls** | [souls.solanaos.net](https://souls.solanaos.net) | SOUL.md library for agent system prompts |
| **Hosted Docs** | [solanaos.net](https://solanaos.net) | Public docs and install/reference material |
| **Dashboard** | [/dashboard](https://seeker.solanaos.net/dashboard) | Live art feed, agent factory, wallet connect, Seeker pairing |
| **Mining** | [/mining](https://seeker.solanaos.net/mining) | BitAxe fleet dashboard with OODA auto-tuning and TamaGOchi pets |
| **Strategy Builder** | [/strategy](https://seeker.solanaos.net/strategy) | Configure multi-venue trading parameters, export strategy.md |
| **Skill Creator** | [/create](https://seeker.solanaos.net/create) | Build SKILL.md files with guided wizard |
| **Private Chat** | [/chat](https://seeker.solanaos.net/chat) | Wallet-to-wallet encrypted private messaging with Honcho persistent memory |
| **IPFS Hub** | [/ipfs](https://seeker.solanaos.net/ipfs) | Private IPFS file storage per wallet, mesh sync, mainnet deploy pipeline |
| **SolanaOS Control UI** | `solanaos server` → `localhost:7777` | Lit + Vite browser control panel: chat, status, config, debug, cron, sessions, skills, channels, logs |
| **SolanaOS Office** | [office.solanaos.net](https://office.solanaos.net) | 3D retro office workspace with Solana market terminal (Birdeye), agent chat, skills marketplace |
| **Android App** | Solana Seeker | Mobile control surface with MWA wallet |
| **CLI** | `npx @solanaos/nanohub` | Install, search, publish skills from terminal |

### Setup Guides

| Guide | URL | What |
| --- | --- | --- |
| **Gateway** | [/setup/gateway](https://seeker.solanaos.net/setup/gateway) | Install the Go binary, configure .env, connect hardware, start gateway |
| **Telegram Bot** | [/setup/telegram](https://seeker.solanaos.net/setup/telegram) | Create bot via BotFather, get chat ID, configure, test |
| **Metaplex Agent** | [/setup/metaplex](https://seeker.solanaos.net/setup/metaplex) | Install Metaplex Skill, register on 014 Registry, delegate execution |
| **BitAxe Mining** | [/setup/mining](https://seeker.solanaos.net/setup/mining) | Local-first Bitaxe setup, Seeker pairing, optional standalone MawdAxe |
| **Chrome Extension** | [/setup/extension](https://seeker.solanaos.net/setup/extension) | Load unpacked extension, connect to gateway, 5-tab control surface |

## Packages

```bash
# Public Hub CLI — search, install, publish skills
npx @solanaos/nanohub --help

# One-shot installer — binary + web + daemon
npx solanaos-computer@latest install --with-web

# Compatibility CLI aliases
npx solanaos-cli@latest --help
npx solanaos-cli@latest --help
```

| Package | Source | Purpose |
| --- | --- | --- |
| [`solanaos-computer`](https://www.npmjs.com/package/solanaos-computer) | `npm/solanaos/` | Main one-shot installer (v1.1.1) |
| [`solanaos-cli`](https://www.npmjs.com/package/solanaos-cli) | `npm/solanaos-installer/` | Primary CLI package alias (v2.1.1) |
| [`solanaos-cli`](https://www.npmjs.com/package/solanaos-cli) | `npm/mawdbot-installer/` | Legacy compat alias (v2.1.1) |
| [`@solanaos/nanohub`](https://www.npmjs.com/package/@solanaos/nanohub) | separate repo | Skill registry CLI |

> **Note:** `new/npm/` contains older draft versions — the canonical packages are in `npm/`. Use `make npm-sync` to check for version drift.

### Authentication

The Hub supports four sign-in methods:

- **GitHub OAuth** — developer identity, linked to Convex user
- **Phantom Connect** — Solana wallet via Phantom SDK (Google, Apple, extension)
- **Seeker Pairing** — QR deep-link from the Android app, wallet-backed session
- **Mobile Wallet Adapter** — Android Chrome users connect via installed wallet app

All methods link to the same Convex user record. Phantom wallets auto-link to GitHub accounts when both are connected.

### Published Skills

The SolanaOS skill is published to the Hub and can be installed by any AI agent:

```bash
npx @solanaos/nanohub install solanaos
```

Browse all 80+ skills at [seeker.solanaos.net/skills](https://seeker.solanaos.net/skills).

### Go Packages (pkg/)

SolanaOS ships as a **single Go binary under 10 MB** that contains 55 packages — the equivalent of a full-stack trading platform, multi-provider AI runtime, hardware OS, and payment layer all compiled to a single executable. No Docker, no Node.js, no Python. Just `go build`.

#### Intelligence Layer

| Package | What |
| --- | --- |
| `pkg/llm/` | Multi-provider LLM client: OpenRouter (multi-model race + leaderboard tracking), Anthropic, xAI/Grok, Ollama, Together AI, llama.cpp, Mistral Audio (TTS/STT), Cloudflare AI Gateway. Includes **Solana God Mode** — AutoTune (7-context adaptive sampling), EMA feedback learning, Parseltongue obfuscation engine, ULTRAPLINIAN scoring (100-pt composite), STM output normalization. |
| `pkg/agent/` | Dexter-style iterative OODA loop with tool-calling, context compression, smart routing, live Solana context injection, kill-switch, scratchpad, prompt caching, and per-model metadata. |
| `pkg/autotune/` | Context-adaptive LLM parameter selection engine — part of `pkg/llm`. Detects trading, code, analytical, creative, chaotic, and conversational contexts and auto-selects temperature/top_p/top_k across 6 dimensions. |
| `pkg/autoreply/` | Chat text sanitizer: extracts `<thinking>` blocks, strips internal reasoning from visible output, normalizes formatting for Telegram/web/CLI display. |
| `pkg/providers/` | Provider abstraction layer (OpenAI-compatible message format). Shared types for tool calls, tool results, and streaming. |
| `pkg/routing/` | Multi-agent message routing and session key resolution for swarm setups. |
| `pkg/learning/` | Autonomous experiment loop: reads strategy, mutates params, backtests, accepts/rejects results, logs learning events. Includes SkillForge (skill synthesis from feedback), session search, and user model tracking. |
| `pkg/research/` | Overnight research system: generates hypotheses → queries vault lessons → mutates strategy → backtests → stores accepted results as typed trajectories. |
| `pkg/session/` | Per-session message history with configurable max turns and summarization trigger. Thread-safe across concurrent agents. |

#### Solana + Trading Layer

| Package | What |
| --- | --- |
| `pkg/solana/` | SolanaTracker RPC + Datastream WebSocket, Birdeye v3 REST + WebSocket (OHLCV, price stats, token list scroll, pair list, liquidity), wallet queries, Jupiter swap routing, SolanaTracker swap API, transaction builder, program registry. |
| `pkg/trading/` | Unified trading engine across Hyperliquid and Aster perps — position lifecycle, risk validation, stop-loss/take-profit, order routing. |
| `pkg/strategy/` | Pure-Go quant strategy: RSI (Wilder smoothing), EMA, ATR, VWAP implemented from first principles. No external indicator libraries. |
| `pkg/hyperliquid/` | Full Hyperliquid perps client — positions, open orders, fills, leverage, cancel, WebSocket feed, EIP-712 signing. |
| `pkg/aster/` | Aster DEX client — account, positions, income, orders, HMAC-V1 + EIP-712-V3 auth, futures tools. |
| `pkg/blockchain/` | On-chain queries via Helius/SolanaTracker: wallet portfolio with USD pricing, token metadata, transaction history. |
| `pkg/onchain/` | On-chain execution engine: real-time balance monitoring via WSS, Jupiter swap execution, Pinata IPFS, agent NFT registration (Metaplex), mainnet deploy. |
| `pkg/pumplaunch/` | pump.fun token launch service — bonding curve lifecycle, metadata upload, graduation detection. |
| `pkg/pumpfun/` | Supervised subprocess manager for the two pump.fun TypeScript bots — start/stop, stdout/stderr ring-buffer capture, .env read-write, status snapshots. Integrated into the daemon as `/sniper` and `/aibot` Telegram commands. |

#### Memory + Storage Layer

| Package | What |
| --- | --- |
| `pkg/memory/` | Epistemological vault interface with Honcho v3 adapter, ClawVault local memory, 3-tier memory hierarchy (episodic, semantic, procedural), recorder, and session-scoped channel memory. |
| `pkg/honcho/` | Honcho v3 HTTP client — sessions, peers, conclusions, dialectic Q&A, dreams (synthesis), session search, peer context. |
| `pkg/storage/` | Supabase Storage client for persisting agent-generated media (images, videos) to a cloud bucket. |
| `pkg/pinata/` | Pinata Private IPFS Hub — file upload/list/delete, access links, groups, per-wallet scoping, BLE mesh sync, mainnet deploy pipeline. |
| `pkg/migrate/` | Version-based config migration for upgrading legacy config files to current schema. |
| `pkg/state/` | Atomic persistent agent state — last-active channel tracking, survives restarts. |

#### Gateway + Channels Layer

| Package | What |
| --- | --- |
| `pkg/gateway/` | TCP + WebSocket gateway bridge with LLM/skills/honcho provider injection, coding sessions, Convex event streaming, Tailscale mesh proxy, remote node pairing, IPFS mesh, and contract enforcement. |
| `pkg/channels/` | Multi-channel manager — registers and dispatches across all active channel bridges. |
| `pkg/channels/telegram/` | Full Telegram bot: 60+ slash commands, voice/image/video understanding, auto-detect Solana addresses, inline keyboards, proxy support, natural-language trade execution. |
| `pkg/channels/bluebubbles/` | iMessage bridge via BlueBubbles server — receive/send iMessages through the agent. |
| `pkg/nanobot/` | SolanaOS Control UI server (port 7777): serves 750-line Lit+Vite browser app embedded in the binary, WebSocket proxy to gateway, DAS API, wallet API. |
| `pkg/node/` | Headless bridge client for NVIDIA Orin Nano / Raspberry Pi hardware nodes — gateway pairing, voice transcript forwarding, mDNS discovery, exponential backoff reconnect. |
| `pkg/controlapi/` | HTTP control API — health, status, model switching, config read/write, session management. |
| `pkg/mcp/` | Model Context Protocol integration — manages MCP server connections, tool proxying, and schema registration for IDE/Claude integration. |

#### Agent Infrastructure Layer

| Package | What |
| --- | --- |
| `pkg/daemon/` | 8,400-line orchestrator that wires all packages together — OODA trading loop, 100+ Telegram command handlers, God Mode pipeline, BlueBubbles/Twilio/Mistral Audio init, Birdeye chart handler, pair handlers, browser automation, cron scheduling, heartbeat, and channel management. |
| `pkg/commands/` | Slash-command registry with pluggable definitions — `Definition` + `Registry` pattern for all chat surfaces. |
| `pkg/cron/` | Configurable cron scheduler — OODA cycles, research runs, heartbeat probes, custom jobs. |
| `pkg/heartbeat/` | Periodic proactive notifications — sends liveness pings, market summaries, and alert digests on schedule. |
| `pkg/health/` | System health checker — collects `CheckResult` from all subsystems, produces a Telegram-formatted summary. |
| `pkg/skills/` | Skills manager — discovers, loads, and injects SKILL.md bundles into LLM context. Supports frontmatter parsing, semantic search, and NanoHub sync. |
| `pkg/tools/` | Tool registry with built-in tools: web search, file ops, shell exec, Solana queries, I2C hardware, message routing, agent spawn. |
| `pkg/delegation/` | Multi-agent task delegation — `Planner` + `WorkerSpec` for splitting work across sub-agents. |
| `pkg/agentregistry/` | 8004 ACP agent registry service — on-chain agent registration, status sync, Telegram status commands. |
| `pkg/identity/` | Sender identity resolution — canonical `platform:id` format, allowlist matching, legacy compat. |
| `pkg/bus/` | Internal message bus — typed `SenderInfo`/`Peer` messages, channel pub/sub for inter-component communication. |
| `pkg/acp/` | ACP JSON-RPC server for VS Code/Cursor editor integration — context compressor with middle-turn summarization. |

#### Hardware + Device Layer

| Package | What |
| --- | --- |
| `pkg/hardware/` | Arduino Modulino I2C cluster adapter — Pixels LEDs (visual status), Buzzer (audio alerts), Buttons (human control), Knob (real-time RSI tuning), IMU, ToF distance sensor. Implements `agent.AgentHooks`. |
| `pkg/devices/` | Device registry for I2C sensors — typed `DeviceType` + `Device` + `DeviceRegistry` with discovery and lifecycle management. |
| `pkg/tamagochi/` | TamaGOchi virtual pet driven by real on-chain metrics: wallet balance, trade win-rate, OODA cycle health, uptime. Maps to hardware LED states and Telegram status. |
| `pkg/bitaxe/` | OODA agent for autonomous Bitaxe ASIC miner management — observe hashrate/temps, orient (compare to target), decide (tune/alert/restart), act. |

#### AI Computer Use Layer

| Package | What |
| --- | --- |
| `pkg/browseruse/` | Browser automation via Browserbase/Playwright/Puppeteer — cloud sessions, DOM inspection, screenshot capture, form fill, JavaScript eval. |
| `pkg/e2b/` | E2B Code Interpreter + Desktop Sandbox agent — vision-LLM screenshot analysis, click/type/shell execution, autonomous computer use. |
| `pkg/steel/` | Steel cloud browser client — WebSocket-driven headful browsers with proxy, CAPTCHA solving, session recording, HLS replay. |
| `pkg/seeker/` | Solana Seeker phone agent — runs OODA loop as Android foreground service, Android Bridge connection, PLATFORM.md generation, IPFS deploy. |

#### Payments + Auth Layer

| Package | What |
| --- | --- |
| `pkg/x402/` | x402 payment protocol — USDC-gated HTTP APIs, Solana USDC payment client, multi-chain support (Solana + Base + Polygon), x402 middleware, facilitator proxy. |
| `pkg/auth/` | OAuth/token management — API key store, PKCE auth flow, token expiry tracking. |

#### Utilities

| Package | What |
| --- | --- |
| `pkg/config/` | Single-file config loader — env vars, JSON, `.env`, defaults, migration, site metadata, version. Covers 100+ settings across all subsystems including BlueBubbles, Hume AI, SOLANA_RPC_URL, Together AI, llama.cpp, Cloudflare AI Gateway. |
| `pkg/constants/` | System-wide constants — internal channel names, magic values. |
| `pkg/fileutil/` | Safe file I/O — workspace-scoped read/write, path traversal prevention. |
| `pkg/logger/` | Structured leveled logger — category-filtered, field-tagged output. |
| `pkg/media/` | Media file lifecycle — store, resolve, release, PDF extraction. |
| `pkg/utils/` | Shared helpers — truncate, audio/image type detection, string normalization. |
| `pkg/runtimeenv/` | Runtime backend registry — maps `BackendSpec` names to active provider instances. |
| `pkg/tailscale/` | Tailscale mesh manager — exposes gateway on local + VPN interfaces simultaneously. |
| `pkg/voice/` | Voice AI: Hume EVI (emotion analysis via WebSocket), Twilio (voice calls). |

#### Why This Fits in One Go Binary

Shipping 55 packages — spanning blockchain, multi-provider AI, hardware I2C, payment protocols, browser automation, and real-time trading — as a single `<10MB` binary is only possible because Go:

- **zero-dependency deployment**: no runtime, no VM, no interpreter — one file, any platform
- **native concurrency**: goroutines handle parallel model races, OODA loops, WebSocket feeds, and hardware polling without thread pools
- **static linking**: all packages compile to a single ELF/Mach-O with dead-code elimination — unused code costs zero bytes
- **cross-compilation**: `GOARCH=arm64 go build` produces an Orin Nano binary from a Mac in seconds
- **embed**: `//go:embed` inlines the 750-line control UI HTML directly — no web server needed

The result: `solanaos daemon` boots in under 1 second, uses under 50 MB RAM at idle, and can trade, respond to Telegram, drive hardware LEDs, and run a multi-model LLM race simultaneously on a $35 Raspberry Pi.

`services/agent-wallet/` | Agent Wallet API — AES-256-GCM encrypted vault, Solana + EVM wallets, Privy managed wallets, E2B sandbox deployment, MCP server for AI agent tooling |

### Architecture

```
solanaos.net ─── Launch page (animated preview)
     │
seeker.solanaos.net (Netlify SSR + Convex)
     ├── /launch ──── Live terminal launch surface with product entry CTAs
     ├── /mobile ──── Public Seeker mobile dapp walkthrough
     ├── /dashboard ── Art feed, 8004 agent factory, Seeker pairing
     ├── /mining ───── BitAxe fleet dashboard (connects to MawdAxe API)
     ├── /strategy ─── Multi-venue parameter builder → strategy.md
     ├── /create ───── Skill creator wizard → SKILL.md
     ├── /skills ───── Browse 80+ agent skills
     ├── /chat ──────── Private wallet-to-wallet chat with Honcho memory
     ├── /ipfs ──────── Private IPFS hub — files, groups, deploy, mesh sync
     ├── /upload ───── Publish skills to registry
     ├── /import ───── Import from GitHub URL
     ├── /setup/* ──── Gateway, Telegram, Metaplex, Mining, Extension guides
     └── /auth/* ───── GitHub OAuth + Phantom Connect + MWA
          ↕ Convex (artful-frog-940)
               ├── Users, agents, pairing sessions, gallery
               ├── Skills, souls, search embeddings
               ├── Private chat threads + messages (Honcho-backed memory)
               └── GitHub OAuth + Phantom auth + wallet linking

souls.solanaos.net ─── SOUL.md library (same deployment, dual-mode)

Local Operator Machine
     ├── solanaos daemon (Go binary, <10MB)
     │    ├── OODA trading loop (spot + perps)
     │    ├── Telegram bot (60+ commands)
     │    │    ├── Image understanding (Grok Vision)
     │    │    ├── Auto-detect Solana contract addresses
     │    │    ├── Natural language token queries
     │    │    └── Remote control (Claude Code)
     │    ├── Gateway API (port 18790)
     │    │    ├── WebSocket protocol (config, status, sessions, agents, skills, cron, logs, chat)
     │    │    ├── LLM chat integration (Ollama, OpenRouter, Anthropic, xAI)
     │    │    ├── Keepalive (30s ping, 90s read deadline)
     │    │    └── Config read/write (~/.solanaos/solanaos.json)
     │    └── Honcho v3 + vault memory
     ├── SolanaOS Control UI (port 7777, `solanaos server`)
     │    ├── Lit + Vite SPA (//go:embed into binary)
     │    ├── Chat with LLM, real-time status, config editor
     │    ├── Debug panel, cron, sessions, skills, channels, logs
     │    ├── Proxies WebSocket to gateway on port 18790
     │    └── Binds 0.0.0.0 (Tailscale/LAN), --local for localhost
     ├── Web Backend (port 18800)
     │    ├── Control console UI
     │    ├── Setup code generation (QR)
     │    └── Proxies to gateway + control API
     ├── MawdAxe (port 8420)
     │    ├── BitAxe fleet OODA loop
     │    ├── REST API + SSE live stream
     │    └── TamaGOchi pet system
     ├── Agent Wallet API (port 8421)
     │    ├── AES-256-GCM encrypted vault
     │    ├── Solana + EVM wallet CRUD
     │    ├── Privy managed wallets (optional)
     │    ├── E2B sandbox deployment
     │    └── MCP server for AI agent tooling
     └── Chrome Extension
          └── Wallet, Seeker, Miner, Chat, Tools tabs

office.solanaos.net ─── SolanaOS Office (3D workspace)
     ├── Adapted from Claw3D, rebranded as SolanaOS HQ
     ├── 3D retro office for managing agents
     ├── Real-time Solana market terminal (Birdeye API)
     │    ├── /api/market — prices, trending, OHLCV, new_listings, meme_list
     │    ├── smart_money, token_txs, holder_distribution, wallet_networth
     │    └── 60-second in-memory cache, pop-out terminal
     ├── Agent chat + skills marketplace
     └── Solana purple (#9945FF) + green (#14F195) branding
```

Public routes include `/`, `/launch`, `/mobile`, `/solanaos`, and `/pair`. Authenticated routes still require GitHub, Phantom wallet, or Seeker pairing. The web backend runs locally and generates setup codes for clients to connect through the gateway.

## Repo Map

This monorepo contains product code, client apps, deployment config, registry metadata, bundled skills, and a few local-only cache/build folders. If you are reading the repo for the first time, the main product code lives in `cmd/`, `pkg/`, `apps/`, `nanohub/`, `docs/`, `scripts/`, `skills/`, and `src/`.

### Top-level directories and files

| Path | What it is |
| --- | --- |
| `.agents/` | Local agent workflow config used by Codex-style development in this repo. |
| `.agents/skills/` | Repo-local installed skill definitions used by the agent tooling layer. |
| `.github/` | GitHub repo config, ownership, and CI/CD automation. |
| `.github/workflows/` | Actions workflows including npm release, TruffleHog secret scanning, protected paths, and launch-readiness verification. |
| `.gocache-local/` | Local Go build cache for isolated or sandboxed builds and tests. Not product source. |
| `.gomodcache-local/` | Local Go module cache for isolated dependency downloads. Not product source. |
| `.netlify/` | Local Netlify runtime/build state used during Netlify-oriented frontend work. |
| `.vscode/` | Workspace editor settings for local development. |
| `.vscode/settings.json` | VS Code workspace settings file for this repo. |
| `acp_registry/` | ACP registry metadata and interactive generator. |
| `acp_registry/agent.example.json` | Reference ACP agent registry descriptor. |
| `acp_registry/generate.mjs` | Interactive CLI to generate a custom `agent.json` for the 8004 ACP registry. |
| `apps/` | User-facing applications layered on top of the runtime. |
| `apps/android/` | Solana Seeker Android app with onboarding, wallet pairing, chat, Grok, ORE, voice, and runtime controls. |
| `apps/macos/` | Native macOS menu bar app and packaging/build files. |
| `apps/dapp-publishing-main/` | Dapp publishing workspace/vendor subtree used by related ecosystem tooling. |
| `chrome-extension/` | Chrome extension popup/background code, icons, manifest, and UI assets. |
| `Claw3D-main/` | SolanaOS Office — 3D retro workspace adapted from Claw3D, deployed to office.solanaos.net. Birdeye market terminal, agent chat, skills marketplace. |
| `cmd/` | Go binary entrypoints such as `solanaos`, gateway API, control API, and TUI programs. |
| `docs/` | Deployment docs, hardware docs, reference material, examples, release notes, and protocol guides. |
| `internal/` | Internal Go-only packages that are not meant to be imported outside this module. |
| `mawdbot-bitaxe/` | Standalone BitAxe service/dashboard with its own Go module, Dockerfiles, migrations, and web UI. |
| `nanohub/` | Public web product: launch page, mobile dapp page, dashboard, registry, pairing flow, and Netlify/Convex app. |
| `node_modules/` | Root JavaScript dependency install tree. Generated locally. Not canonical source. |
| `npm/` | npm package workspaces such as `solanaos`, installers, and compatibility aliases. |
| `pkg/` | Core Go library surface: runtime, gateway, Solana, trading, memory, control API, voice, hardware, x402, and integrations. |
| `scripts/` | Build, packaging, deployment, install, and helper scripts across the monorepo. |
| `skills/` | Bundled publishable `SKILL.md` packages surfaced through NanoHub and agent workflows. |
| `src/` | Shared TypeScript utilities, schemas, and agent-facing code outside the `nanohub` app itself. |
| `ui/` | SolanaOS Control UI — Lit + Vite browser panel embedded into the Go binary via `//go:embed`. Chat, status, config, debug, cron, sessions, skills, channels, logs. |

### What to read first

**Quick start:**
1. Run `bash start.sh` — one command to build and start everything (see [One-Shot Start](#one-shot-start)).
2. Edit `.env` with your API keys — `.env.example` has the full template with descriptions.

**Architecture docs (read in order):**
3. [DAEMON.md](DAEMON.md) — full system picture: every subsystem, the OODA loop, all 55 packages, hardware layer.
4. [SOUL.md](SOUL.md) — agent identity and trading philosophy; use as the system prompt for any LLM.
5. [SKILL.md](SKILL.md) — complete agent skill file; give to any AI to install and operate SolanaOS in one shot.
6. [STRATEGY.md](STRATEGY.md) — multi-venue trading playbook: Solana spot, Hyperliquid perps, Aster perps, confidence model.
7. [TRADE.md](TRADE.md) — pump.fun trading agent skill: token tier classification and Jupiter execution workflow.
8. [TOKEN.md](TOKEN.md) — $CLAWD, the first AI-deployed token on pump.fun; tokenized agent + automated buybacks.
9. [PUMP.md](PUMP.md) — pump.fun scanner report format, meta analysis pipeline, token data schema.
10. [META.md](META.md) — live board meta: cycle position, dominant themes, sniper candidates.

**Code structure:**
11. `cmd/` — Go binary entrypoints: daemon, gateway API, control API, TUI.
12. `pkg/` — 55 Go packages: runtime, gateway, Solana, trading, memory, hardware, x402, and integrations.
13. `solana-claude/` — open-source TypeScript MCP agent framework (Claude Code architecture ported to Solana).
14. `mcp-server/` — SolanaOS MCP server exposing all tools to Claude Desktop, Cursor, VS Code.
15. `skills/` — 80+ agent skill bundles (`SKILL.md` format); `acp_registry/` for on-chain agent registration.
16. `nanohub/` — public web surfaces, Netlify deployment, mobile dapp page, and Seeker pairing funnel.
17. `apps/android/`, `apps/macos/`, and `chrome-extension/` — user-facing client apps.

## Public Links

| Category | Link |
| --- | --- |
| Repo | [github.com/x402agent/SolanaOS](https://github.com/x402agent/SolanaOS) |
| Launch | [solanaos.net](https://solanaos.net) |
| Hub | [seeker.solanaos.net](https://seeker.solanaos.net) |
| Souls | [souls.solanaos.net](https://souls.solanaos.net) |
| Docs | [solanaos.net](https://solanaos.net) |
| Office | [office.solanaos.net](https://office.solanaos.net) |
| Dashboard | [seeker.solanaos.net/dashboard](https://seeker.solanaos.net/dashboard) |
| Mining | [seeker.solanaos.net/mining](https://seeker.solanaos.net/mining) |
| Strategy | [seeker.solanaos.net/strategy](https://seeker.solanaos.net/strategy) |
| Skill Creator | [seeker.solanaos.net/create](https://seeker.solanaos.net/create) |
| Skills | [seeker.solanaos.net/skills](https://seeker.solanaos.net/skills) |
| Chat | [seeker.solanaos.net/chat](https://seeker.solanaos.net/chat) |
| Gateway setup | [seeker.solanaos.net/setup/gateway](https://seeker.solanaos.net/setup/gateway) |
| Telegram setup | [seeker.solanaos.net/setup/telegram](https://seeker.solanaos.net/setup/telegram) |
| Metaplex setup | [seeker.solanaos.net/setup/metaplex](https://seeker.solanaos.net/setup/metaplex) |
| Mining setup | [seeker.solanaos.net/setup/mining](https://seeker.solanaos.net/setup/mining) |
| Extension setup | [seeker.solanaos.net/setup/extension](https://seeker.solanaos.net/setup/extension) |

## Public Repo Notes

- Primary public repo: `https://github.com/x402agent/SolanaOS`
- Primary binary / CLI name: `solanaos`
- 
- Secrets belong in `.env` or deployment environment variables only

## IPFS Hub + Mainnet Deployment Pipeline

SolanaOS includes a Private IPFS Hub powered by Pinata that provides per-wallet file storage and a full mainnet deployment pipeline for registering agents as Solana NFTs.

### Architecture

```
Upload (any surface)
  ├── Web Hub (/ipfs) ─── Convex auth + wallet connect
  ├── Go daemon ───────── pkg/pinata/ client
  ├── Seeker mobile ───── presigned URLs, camera capture
  ├── Android app ─────── localhost bridge (/api/ipfs/*)
  └── Mesh nodes ──────── Tailscale + BLE auto-sync

Pinata Private IPFS
  ├── Wallet-scoped groups (wallet:{addr})
  ├── GitHub-scoped groups (github:{user})
  ├── Device-scoped groups (device:{id})
  └── Keyvalue filtering (solana_wallet, github_user, device_id)

Convex (real-time tracking)
  ├── ipfsFiles — per-file tracking with identity + sync state
  ├── ipfsGroups — group-to-identity mapping
  └── ipfsAccessLog — temporary access link audit trail

Mainnet Deploy
  ├── Pin metadata to Private IPFS (8004-compatible format)
  ├── Pin NFT metadata to Private IPFS (Metaplex Core format)
  ├── Register on-chain via 8004 SDK → asset + ATOM reputation
  ├── Register on-chain via Metaplex mpl-core → NFT + identity PDA
  └── Mesh-sync deployment info to all Tailscale/BLE nodes
```

### API Endpoints

| Method | Path | What |
| --- | --- | --- |
| `GET` | `/api/v1/ipfs/files?wallet=...` | List files by wallet, GitHub, or device |
| `GET` | `/api/v1/ipfs/files/:cid` | Get file by CID |
| `GET` | `/api/v1/ipfs/stats?wallet=...` | Storage stats per wallet |
| `GET` | `/api/v1/ipfs/groups?wallet=...` | List IPFS groups per wallet |
| `POST` | `/api/v1/ipfs/track` | Record an uploaded file |
| `POST` | `/api/v1/ipfs/access` | Log access link creation |
| `POST` | `/api/v1/ipfs/deploy` | Deploy agent to Solana mainnet (8004 + Metaplex) |
| `POST` | `/api/v1/ipfs/delete` | Remove tracked file |

### Environment Variables

```bash
PINATA_API_KEY=          # Pinata API key
PINATA_API_SECRET=       # Pinata API secret
PINATA_JWT=              # Pinata JWT (preferred auth)
PINATA_GATEWAY=          # Your gateway domain (e.g. your-gateway.mypinata.cloud)
PINATA_MESH_SYNC=true    # Auto-sync files across Tailscale/BLE mesh
```

### Go Usage

```go
import "github.com/x402agent/SolanaOS/pkg/pinata"

hub := pinata.NewHub(pinata.Config{JWT: os.Getenv("PINATA_JWT"), Gateway: os.Getenv("PINATA_GATEWAY")})
mesh := pinata.NewMeshSync(hub)
deployer := pinata.NewDeployer(hub, mesh)

// Upload per-wallet
result, _ := hub.UploadForWallet(ctx, walletAddr, "data.json", reader, nil)

// Recall with temporary URL
url, _ := hub.RecallFile(ctx, result.CID, 300)

// Deploy to mainnet
deployResult, _ := deployer.Deploy(ctx, pinata.DeployConfig{
    WalletAddress: walletAddr,
    Mode:          pinata.DeployModeDual,
    Cluster:       "mainnet-beta",
    Name:          "My Agent",
    ATOMEnabled:   true,
    MeshSync:      true,
})
```

## What Changed In v3

### SolanaOS Control UI

A new browser-based control panel built with **Lit + Vite**, living in `ui/`. The UI is embedded into the Go binary via `//go:embed` and served on port 7777 by the `solanaos server` command (aliases: `nanobot`, `control`). Binds `0.0.0.0` by default for Tailscale/LAN access; use `--local` to restrict to localhost. Proxies WebSocket connections to the gateway on port 18790.

Features: LLM chat, real-time status, config editor, debug panel, cron management, sessions, skills, channels, and live log streaming.

### `solanaos onboard` Command

Interactive setup wizard that configures your SolanaOS instance in one step:

1. Select an LLM provider (Ollama, OpenRouter, Anthropic, xAI, OpenAI) and enter credentials
2. Enter Solana API keys (SolanaTracker, Birdeye)
3. Configure Telegram bot (token + chat ID)

Writes everything to `~/.solanaos/solanaos.json`. Replaces the manual `.env` editing workflow for new users.

### SolanaOS Office (3D Workspace)

A 3D retro office environment adapted from Claw3D, deployed to [office.solanaos.net](https://office.solanaos.net). Rebranded as "SolanaOS HQ" with Solana purple (#9945FF) and green (#14F195). Features a real-time Solana market terminal powered by Birdeye API (`/api/market` with 60-second in-memory cache), agent chat, and a skills marketplace.

### Gateway WebSocket Protocol

Full method implementation for all UI and Office methods: `config.get/set/schema`, `status`, `health`, `system-presence`, `sessions.list`, `agents.list`, `agent.identity.get`, `skills.status`, `channels.status`, `cron.*`, `logs.tail`, `device.pair.*`, `exec.approvals.*`, `models.list`, `last-heartbeat`, `chat.send` (with async LLM inference), `chat.history`, `chat.abort`. WebSocket keepalive: 30-second ping, 90-second read deadline.

### LLM Chat via Gateway

The `chat.send` WebSocket method now routes to any configured LLM provider via the `LLMProvider` interface (Ollama, OpenRouter, Anthropic, xAI). Streams response back as `chat` event.

### Branding Cleanup

All `openclaw` / `OPENCLAW_*` references replaced with `solanaos` / `SOLANAOS_*` in the UI (components, storage keys, env vars, CSS). Office rebranded from Claw3D.

### CI/CD Updates

CI workflow now builds the UI before the Go binary. Cross-platform release workflow triggers on tags. Dependabot configured for gomod, npm, docker, and github-actions. TruffleHog scanning cleaned up.

### Remote Control — Drive Your Mac From Telegram

SolanaOS now supports **Claude Code Remote Control** from Telegram. Start a `claude remote-control` server on your Mac and send natural language commands from your phone.

- `/remote start` — start a Claude remote-control server on your local machine
- `/remote <instruction>` — execute any command in natural language (e.g. `/remote check disk usage`, `/remote open Safari and go to github.com`, `/remote find all Python files modified today`)
- `/remote status` / `/remote stop` / `/remote list` — manage sessions
- Natural language triggers: "control my mac", "remote control", "use my computer"
- Auto-starts a session if you send a command without one running
- Full environment access: filesystem, tools, MCP servers, project config

### Image Understanding — Grok Vision From Telegram

Send any image to the Telegram bot and get AI-powered analysis using **xAI Grok Vision**.

- **Send a photo with no caption** — auto-describes the image in detail
- **Send a photo with a question** — answers your question about the image (e.g. "what breed is this dog?")
- **Send a photo with `/vision`** — explicit vision mode
- `/vision <url> [question]` — analyze an image by URL
- Supports compressed photos and document-mode images (JPEG/PNG)
- Uses the xAI Responses API with `input_image` type

### Auto-Detect Solana Contract Addresses

Paste any Solana mint address into the Telegram chat and get **instant realtime token data** from Solana Tracker.

- Paste `6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN` → instantly returns price, market cap, liquidity, holders, risk score, 24h change, pool info
- Works for any base58 address (32-44 chars) — no slash command needed
- Powered by SolanaTracker Data API

### Natural Language Token Queries

Ask about any token in plain English and get live data:

- "what is TRUMP" / "price of BONK" / "tell me about WIF" / "check POPCAT"
- "lookup SOL" / "research PENGU" / "analyze JUP" / "info on RENDER"
- 20+ query prefixes supported
- Exact symbol match → full token info with price, MC, liquidity, holders, risk, 24h change
- Multiple matches → shows top 5 results with key metrics
- Falls through to LLM for conversational follow-up

### New Telegram Commands

| Command | What |
| --- | --- |
| `/remote` | Remote control your Mac via Claude Code |
| `/remote start` | Start Claude remote-control server |
| `/remote send <instruction>` | Send natural language command to your Mac |
| `/remote stop` | Stop remote session |
| `/vision` | Analyze images with Grok Vision |
| `/bots` | Status overview of both pump.fun bots |
| `/sniper` | Pump.fun Mayhem Sniper — status, start, stop, logs, config |
| `/sniper start` | Start the Geyser WebSocket sniper subprocess |
| `/sniper stop` | Stop the sniper |
| `/sniper logs [N]` | Last N log lines from the sniper (default 20) |
| `/sniper config` | Show sniper .env (secrets redacted) |
| `/sniper set KEY VAL` | Write a .env key (restart bot to apply) |
| `/aibot` | AI Trading Bot — status, start, stop, logs, config |
| `/aibot start` | Start the AI bot (Express API on :3001) |
| `/aibot stop` | Stop the AI bot |
| `/aibot logs [N]` | Last N log lines from the AI bot |
| `/aibot config` | Show AI bot .env (secrets redacted) |
| `/aibot set KEY VAL` | Write a .env key (restart bot to apply) |

### Previous Changes (v2)

- SolanaTracker is now the default RPC provider, with Helius as fallback.
- SolanaTracker Datastream support is live for real-time token, wallet, holder, price, sniper, insider, and pool feeds.
- Honcho v3 memory is integrated for session summaries, peer context, and durable trading conclusions.
- Telegram now exposes the unified memory and perp surface directly, including `/positions`, `/dream`, `/profile`, and `/card`.
- Spot `/buy` and `/sell` now prefer SolanaTracker swap execution in Telegram when `SOLANA_TRACKER_API_KEY` is configured, with the older on-chain path kept as fallback.
- NanoHub ACP registry sync now resolves against the linked Solana wallet and GitHub-backed Hub user instead of creating split identities.
- Mining and extension setup now have first-class Hub pages at `/mining`, `/setup/mining`, and `/setup/extension`.
- OpenRouter `xiaomi/mimo-v2-pro` is wired in as the dedicated Mimo reasoning path.
- Grok image and video generation are available in Telegram, including natural-language routing for media requests.
- The web UI, extension, and docs were updated around the SolanaOS branding and current runtime surfaces.

## What SolanaOS Includes

| Area | What it does |
| --- | --- |
| Runtime | OODA loop, strategy engine, wallet state, heartbeats, automation |
| Solana | SolanaTracker RPC/WSS/Datastream, SolanaTracker swap, Jupiter fallback, Helius DAS |
| Memory | Honcho v3 dialectic + local vault + Convex cloud. KNOWN/LEARNED/INFERRED tiers |
| Agent | Context compression, smart model routing, insights extraction, prompt caching, redaction |
| LLMs | OpenRouter, xAI/Grok (vision + image gen + video), Anthropic/Claude Code, Ollama/DeepSolana, Mimo reasoning |
| Trading | Spot (natural language + auto-detect contract addresses), Hyperliquid perps, Aster perps, multi-venue strategy |
| Pump.fun Bots | Mayhem Sniper (Geyser WebSocket, dev-buy filter, TP/SL/timeout) + AI Trading Bot (Express API, pattern recognition) — managed from Telegram via `/sniper` and `/aibot` |
| Control UI | Lit + Vite browser panel (`solanaos server` on port 7777) — chat, status, config, debug, cron, sessions, skills, channels, logs |
| Office | 3D workspace at office.solanaos.net — Birdeye market terminal, agent chat, skills marketplace, Solana-branded |
| Gateway WS | Full WebSocket protocol — config, status, sessions, agents, skills, cron, logs, chat.send with async LLM inference, keepalive |
| Onboarding | `solanaos onboard` interactive wizard — LLM provider, Solana keys, Telegram bot → `~/.solanaos/solanaos.json` |
| Channels | Telegram (60+ commands + image understanding + remote control), Chrome extension, macOS, Android Seeker, web gateway, Control UI |
| Remote Control | Claude Code remote-control server, Telegram-driven Mac control, natural language dispatch |
| Vision | Grok Vision image understanding from Telegram photos, URL-based analysis, auto-detect photo messages |
| Agent Wallet | One-shot `wallet-api` bootstrap, encrypted vault, Solana + EVM, Privy managed wallets, E2B sandbox deploy, MCP server |
| ACP Registry | Interactive `agent.json` generator with full 8004 skill catalogue, validator, example config |
| Editor | ACP server for VS Code, Cursor, Zed integration (12 Solana tools) |
| Hub | Skills registry, agent factory, strategy builder, skill creator, mining dashboard, private chat |
| Mining | MawdAxe BitAxe fleet management with OODA auto-tuning + TamaGOchi pets |
| Payments | x402 paywall and facilitator proxy |
| Hardware | Arduino Modulino LEDs, buzzer, buttons, knob, IMU, thermo, ToF |
| Security | TruffleHog scanning, secret redaction, auth gate on Hub |

## Quick Start

### Recommended install

```bash
npx solanaos-computer@latest install --with-web
cd ~/solanaos
~/.solanaos/bin/solanaos onboard        # interactive wizard: LLM, Solana keys, Telegram
~/.solanaos/bin/solanaos version
~/.solanaos/bin/solanaos server          # Control UI on port 7777
~/.solanaos/bin/solanaos daemon
```

The `onboard` wizard walks you through selecting an LLM provider (Ollama, OpenRouter, Anthropic, xAI, OpenAI), entering Solana API keys (SolanaTracker, Birdeye), and configuring a Telegram bot. It writes everything to `~/.solanaos/solanaos.json` so you can skip the manual `.env` setup.

Primary command names:

- `solanaos` is the primary binary and CLI name
- `solanaos` is the canonical CLI name

Compatibility npm packages still exist:

- `solanaos-computer`
- `solanaos-cli`
- `solanaos-cli`

### Fast local dev path

```bash
git clone https://github.com/x402agent/SolanaOS.git
cd solanaos
cp .env.example .env              # fill in keys (see Minimum useful .env below)

# Build everything
make build                        # solanaos binary (UI embed + Go)
make build-agent-wallet           # agent-wallet binary (port 8421)
make build-gateway-api            # standalone gateway-api binary (port 18790)
make build-mcp                    # solanaos-mcp TypeScript server (port 3001)

# Start all services in one shot
bash start.sh                     # agent-wallet → daemon → mcp
bash start.sh --status            # check what's running
bash start.sh --stop              # stop everything

# Or start individually
./build/solanaos onboard          # interactive setup wizard
./build/solanaos server           # Control UI at http://localhost:7777
./build/solanaos daemon           # full autonomous agent
./build/agent-wallet              # encrypted wallet vault API
```

Alternatively, the one-shot installer handles all builds:

```bash
bash install.sh                   # build + install all binaries to ~/.solanaos/bin
bash install.sh --with-web        # also build the web console
```

### Minimum useful `.env`

```bash
# SolanaTracker
SOLANA_TRACKER_API_KEY=your-key
SOLANA_TRACKER_RPC_URL=https://rpc-mainnet.solanatracker.io/?api_key=your-key
SOLANA_TRACKER_WSS_URL=wss://rpc-mainnet.solanatracker.io/?api_key=your-key
SOLANA_TRACKER_DATA_API_KEY=your-data-key

# LLM
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=minimax/minimax-m2.7
OPENROUTER_OMNI_MODEL=xiaomi/mimo-v2-pro
OPENROUTER_MIMO_MODEL=xiaomi/mimo-v2-pro
LLM_PROVIDER=openrouter

# Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ID=123456789

# Honcho
HONCHO_ENABLED=true
HONCHO_API_KEY=hch-v3-...
# Optional override if self-hosting; production default is already api.honcho.dev
HONCHO_BASE_URL=https://api.honcho.dev
HONCHO_WORKSPACE_ID=solanaos
HONCHO_AGENT_PEER_ID=solanaos-agent
HONCHO_SESSION_STRATEGY=per-chat
HONCHO_DIALECTIC_ENABLED=true

# Optional Helius fallback
HELIUS_API_KEY=...
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...
```

### Smoke test

```bash
./build/solanaos solana wallet
./build/solanaos status
./build/solanaos wallet-api          # one-shot agent wallet bootstrap
./build/solanaos gateway setup-code
./build/solanaos daemon
```

### Solana Seeker pairing

For Android/Seeker onboarding, generate or reprint the shared gateway setup code:

```bash
~/.solanaos/bin/solanaos gateway start
~/.solanaos/bin/solanaos gateway setup-code
cat ~/.solanaos/connect/setup-code.txt
```

If Seeker should connect over LAN/manual host instead of Tailscale, start the bridge with `~/.solanaos/bin/solanaos gateway start --no-tailscale`. If you moved the bridge off the default raw native port, use `~/.solanaos/bin/solanaos gateway start --port <port>` and regenerate `~/.solanaos/connect/setup-code.txt`.

Use the printed code or `~/.solanaos/connect/setup-code.txt` in:

- Solana Seeker onboarding
- the Connect tab setup code field

The one-shot installer already writes the bundle to `~/.solanaos/connect/`, and `solanaos gateway start` now prints the setup code path on launch.

## Daily Operator Commands

Full grouped CLI, Telegram, and NanoHub reference:
[docs/command-cheatsheet.md](docs/command-cheatsheet.md)

```bash
./build/solanaos daemon
./build/solanaos server                    # Control UI on :7777 (aliases: nanobot, control)
./build/solanaos server --local            # restrict to localhost only
./build/solanaos ooda --sim --interval 30
./build/solanaos wallet-api
./build/solanaos pet
./build/solanaos solana health
./build/solanaos gateway start
./build/solanaos gateway setup-code
./build/solanaos menubar
node acp_registry/generate.mjs
```

Web console:

```bash
./build/solanaos-web --no-browser
```

## Release Hygiene

Before pushing the repo publicly, verify:

- `.env`, private keys, and deployment tokens are not tracked
- local caches like `.gocache`, `.gomodcache`, `.gopath`, and `.netlify` are not tracked
- compiled binaries and APKs are attached to GitHub releases, not committed to the repo root
- npm packages pack cleanly with `npm run pack:npm`
- installer URLs and docs point at the public repo

## Telegram Control

Set `TELEGRAM_BOT_TOKEN` and optionally `TELEGRAM_ID` to lock the bot to your account. The daemon auto-registers commands on startup.

For the full grouped command set, including Hyperliquid, Aster, memory, skills, and NanoHub workflows, see [docs/command-cheatsheet.md](docs/command-cheatsheet.md).

### Slash Commands

**Core:**
`/status`, `/wallet`, `/pet`, `/trending`, `/scanner`, `/ooda`, `/sim`, `/live`, `/strategy`, `/version`

**Spot Trading:**
`/buy <symbol|mint> <amount_sol>`, `/sell <symbol|mint> <amount|pct%|all>`, `/swap`, `/price <token>`, `/research <mint>`

**Hyperliquid Perps:**
`/hl`, `/hl_positions`, `/hl_open <symbol> <side> [size] [leverage]`, `/hl_close <symbol>`, `/hl_orders`, `/hl_fills`, `/hl_candles`, `/positions`

**Aster Perps:**
`/aster`, `/aster_positions`, `/aster_open <symbol> <side>`, `/aster_close <symbol>`, `/aster_trades`, `/aster_income`

**Memory (Honcho v3):**
`/memory`, `/recall <query>`, `/remember <fact>`, `/ask_memory <question>`, `/forget <query>`, `/dream`, `/profile`, `/card`

**Honcho Admin:**
`/honcho_status`, `/honcho_context`, `/honcho_sessions`, `/honcho_summaries`, `/honcho_search <query>`, `/honcho_messages`, `/honcho_conclusions`

**Skills & Media:**
`/skills`, `/skill <name>`, `/skill_find <query>`, `/mimo <prompt>`, `/web <query>`, `/xsearch <query>`, `/image <prompt>`, `/video <prompt>`

**Pump.fun Bots:**
`/bots` — status of both bots
`/sniper [start|stop|logs|config|set KEY VAL]` — Mayhem Sniper bot control
`/aibot [start|stop|logs|config|set KEY VAL]` — AI Trading Bot control

### Natural Language Trading

SolanaOS understands trading intent from plain English — no slash commands needed:

**Spot buys** (prefers SolanaTracker swap, falls back to the legacy on-chain route if needed):
```
buy 0.5 SOL worth of BONK
ape into WIF with 1 sol
snipe that new token with 0.1
yolo 2 sol into PENGU
grab some MEW
```

**Spot sells:**
```
sell all my BONK
dump half my WIF
paper hand MEW
exit my position in JUP
```

**Hyperliquid perps:**
```
long BTC on HL with 5x
short ETH 3x
close my BTC position
show my HL positions
```

**Aster perps:**
```
long SOL on aster
close btc on aster
show aster positions
what's my aster pnl
```

**Filtered out (NOT executed):**
```
should I buy BONK?           → treated as question, not trade
what do you think about WIF? → research, not execution
price of SOL                 → lookup, not trade
research this token          → analysis, not execution
```

The system distinguishes execution intent from research questions using verb detection and question filtering. Simulated mode (`/sim`) previews trades; live mode (`/live`) signs and lands the transaction on-chain. When `SOLANA_TRACKER_API_KEY`, `SOLANA_TRACKER_RPC_URL`, and `SOLANA_TRACKER_WSS_URL` are configured, Telegram spot flows use SolanaTracker for swap building, priority fees, and RPC transport.

## Memory

SolanaOS has a three-layer memory architecture that combines local vault storage, cross-session Honcho v3 persistence, and a background Dreaming consolidation sweep. All three layers are connected: vault entries feed dreaming, dreaming promotes lessons back to the vault, and Honcho carries user and agent models across sessions.

```
┌─────────────────────────────────────────────────────────┐
│                   Memory Architecture                    │
│                                                         │
│  Telegram / Chat ──► RecursiveRecorder ──► ClawVault    │
│                             │                   │        │
│                             ▼                   ▼        │
│                       Honcho v3 API       vault/        │
│                       (cross-session)   ├── decisions/  │
│                             │           ├── lessons/    │
│                             │           ├── trades/     │
│                             │           ├── research/   │
│                             │           ├── tasks/      │
│                             ▼           └── inbox/      │
│                     User + Agent                │        │
│                     profiles                    │        │
│                     Conclusions           Dreaming       │
│                     Session recall        Sweep (3 AM)   │
│                                                 │        │
│                                    light → REM → deep   │
│                                                 │        │
│                                         vault/lessons/  │
└─────────────────────────────────────────────────────────┘
```

### Layer 1 — ClawVault (local, `pkg/memory/`)

The vault is a file-backed markdown knowledge graph under `~/.solanaos/workspace/vault/`. It uses a 3-tier epistemological hierarchy:

| Tier | Type | Description |
|------|------|-------------|
| `known` | Facts from APIs | Price, OHLCV, orderbook, news — TTL-expired |
| `learned` | Trading insights | Patterns, mistakes, strategy observations |
| `inferred` | Cross-domain synthesis | Agent-reasoned connections across assets/strategies |

The `RecursiveRecorder` captures every conversation turn, auto-routes entries to the right category by keyword scoring, and maintains a graph index for link traversal and context profile building.

**Key packages:**
- `pkg/memory/vault.go` — ClawVault: Remember, Recall, Reflect, GetShortTermContext, ListEntries, BuildContextProfile
- `pkg/memory/memory.go` — MemoryEngine: 3-tier hierarchy with Supabase + vault dual-storage
- `pkg/memory/recorder.go` — RecursiveRecorder: per-turn capture with Convex sync
- `pkg/memory/epistemological.go` — EpistemologicalState builder

### Layer 2 — Honcho v3 (`pkg/honcho/`)

Honcho provides cross-session memory with dialectic user modeling. Every Telegram turn is persisted to Honcho. The daemon enriches prompts from Honcho context before each LLM call.

**What Honcho stores:**
- Session summaries and message history
- Peer representations (user + agent models)
- Durable conclusions about trading preferences, risk tolerance, and behavior
- Semantic search over all past observations

**Configuration:**

```bash
HONCHO_ENABLED=true
HONCHO_API_KEY=hch-v3-pws0szjgkuzpsnv1r6qlnu94fvylctmthvosgieqf6eeopbjw7mqutk9t05zp5z4
HONCHO_BASE_URL=https://api.honcho.dev
HONCHO_WORKSPACE_ID=solanaos
HONCHO_AGENT_PEER_ID=solanaos-agent
HONCHO_SESSION_STRATEGY=per-chat
HONCHO_DIALECTIC_ENABLED=true
```

**Key package:** `pkg/honcho/client.go` — sessions, peers, conclusions, dialectic Q&A, session search, peer context.

### Layer 3 — Dreaming (`pkg/dreaming/`)

Dreaming is the background memory consolidation system. It runs a nightly sweep (default 3 AM) that moves strong short-term vault signals into durable `vault/lessons/` entries while keeping the process transparent and reviewable.

**Phase model:**

| Phase | Purpose | Writes to lessons? |
|-------|---------|-------------------|
| **Light** | Scores recent vault signals (48h window), deduplicates, stages candidates | No |
| **REM** | Extracts recurring trading themes (`sol`, `pnl`, `pump`, `perp`, `pattern`…), adds reinforcement boosts | No |
| **Deep** | Ranks candidates with 6 weighted signals + phase boosts, promotes above threshold | Yes |

**Deep ranking signals:**

| Signal | Weight | Description |
|--------|--------|-------------|
| Relevance | 0.30 | Vault quality score of the entry |
| Frequency | 0.24 | How often the entry was recalled / linked |
| Trade signal | 0.15 | Directly tied to a trade or PnL event |
| Recency | 0.15 | Exponential decay, 24h half-life |
| Diversity | 0.10 | Unique contexts / tag namespaces |
| Tag richness | 0.06 | Concept-tag density |

**Machine state** lives in `.clawvault/dreams/` (candidates, phase signals, last-sweep checkpoint).  
**Human-readable diary** is appended to `vault/.dreams/DREAMS.md` after each sweep — LLM-generated if an LLM is configured, template fallback otherwise.

**Enable dreaming in config:**

```json
{
  "dreaming": {
    "enabled": true,
    "schedule": "0 3 * * *",
    "timezone": "America/Los_Angeles",
    "min_score": 0.55,
    "min_recall_count": 1,
    "diary_enabled": true,
    "channel": "telegram",
    "chat_id": "YOUR_TELEGRAM_ID"
  }
}
```

**Telegram commands:**

```text
/dreaming                   — sweep status + last checkpoint
/dreaming now               — run a full sweep immediately
/dreaming diary             — show latest dream diary entry
/dreaming help              — full command reference
```

### All Memory Commands (Telegram)

```text
/memory                           — vault overview + tier counts
/recall <query>                   — semantic search across vault
/remember <fact>                  — store a new fact
/ask_memory <question>            — LLM-powered vault Q&A
/forget <query>                   — remove matching vault entries
/dream                            — vault reflect + promote inbox entries
/dreaming [status|now|diary|help] — dreaming sweep control
/profile                          — your Honcho user profile
/card                             — Honcho agent card

/honcho_status                    — Honcho connection status
/honcho_context                   — full Honcho user representation
/honcho_sessions                  — list Honcho sessions
/honcho_summaries                 — session summaries
/honcho_search <query>            — semantic search over Honcho memory
/honcho_messages                  — recent Honcho messages
/honcho_conclusions               — stored conclusions
```

## Private Chat

SolanaOS Hub includes a real-time private chat system at [/chat](https://seeker.solanaos.net/chat) for wallet-to-wallet messaging between authenticated Hub users.

### Features

- **Dual auth** — sign in with Solana wallet (Phantom, Seeker, MWA) or GitHub OAuth
- **Identity bar** — shows your GitHub `@handle` or wallet address with a live online indicator
- **Real-time sync** — Convex reactive queries push new messages instantly to all connected clients
- **Honcho persistent memory** — every message is ingested into Honcho v3 in the background for cross-session reasoning about user context
- **Thread-based** — conversations are organized as 1:1 threads between wallet addresses
- **Animated UI** — fade-in, slide-up, and bubble animations on messages, threads, and page transitions
- **Deduplication** — client-generated message IDs prevent duplicate sends on retry

### How it works

```text
User A (wallet or GitHub)           User B (wallet or GitHub)
        │                                    │
        ├──── sendMessage mutation ──────────►│
        │         │                          │
        │    ┌────▼────┐                     │
        │    │ Convex   │◄── useQuery ───────┤
        │    │ Database │    (real-time)      │
        │    └────┬────┘                     │
        │         │                          │
        │    ctx.scheduler.runAfter(0)       │
        │         │                          │
        │    ┌────▼────┐                     │
        │    │ Honcho   │                    │
        │    │ v3 API   │ ── background reasoning
        │    └─────────┘     (peers, sessions, conclusions)
```

### Convex backend

| Function | Type | What |
| --- | --- | --- |
| `chat.listThreads` | query | List conversations for a wallet, enriched with peer display names |
| `chat.listMessages` | query | Real-time message subscription per thread (newest 100) |
| `chat.sendMessage` | mutation | Send a message, auto-create thread, schedule Honcho ingestion |
| `chat.getOrCreateThread` | mutation | Start a conversation with any Solana wallet address |
| `chat.getThread` | query | Get thread metadata |
| `chat.findThread` | query | Check if a thread exists between two wallets |
| `honcho.ingestMessage` | action | Send message to Honcho v3 for background reasoning |
| `honcho.getContextForUser` | action | Query Honcho for synthesized insights about a user |

### Honcho integration

Every chat message is asynchronously ingested into Honcho v3 via a scheduled Convex action. This means:

- Each wallet becomes a Honcho **peer** (`wallet:<address>`)
- Each thread becomes a Honcho **session** (`thread:<id>`)
- Honcho's reasoning engine processes messages in the background to build durable conclusions about users
- These conclusions persist across sessions and can be queried for personalized context

### Environment

```bash
# Set on Convex deployment (already configured)
HONCHO_API_KEY=hch-v3-...
```

## Models

SolanaOS can talk to several model providers:

- OpenRouter (multi-model race, reasoning, embeddings)
- xAI / Grok
- Anthropic (direct API)
- Ollama (local, including `8bit/DeepSolana`)
- Together AI
- llama.cpp (OpenAI-compatible local server)

The gateway implements a unified `LLMProvider` interface. When `chat.send` arrives over WebSocket, the gateway routes to the configured provider and streams the response back as `chat` events. The gateway prints `LLM attached: <provider> / <model>` on startup. Provider and model are configured via `~/.solanaos/solanaos.json` (written by `solanaos onboard`) or environment variables.

### OpenRouter Model Presets

Switch models at runtime from Telegram with `/model <preset>`:

| Command | Env var | Default model | Notes |
|---------|---------|---------------|-------|
| `/model 1` | `OPENROUTER_MODEL1` | `nvidia/nemotron-3-super-120b-a12b:free` | Free reasoning |
| `/model 2` | `OPENROUTER_MODEL2` | `nousresearch/hermes-3-llama-3.1-405b:free` | Free 405B |
| `/model 3` | `OPENROUTER_MODEL3` | `minimax/minimax-m2.5:free` | Free MiniMax |
| `/model 4` | `OPENROUTER_MODEL4` | `z-ai/glm-5.1` | GLM-5 reasoning |
| `/model claude` | `OPENROUTER_CLAUDE` | `anthropic/claude-opus-4.6-fast` | Claude via OpenRouter (no Anthropic key needed) |
| `/model gemma` | `OPENROUTER_GEMMA` | `google/gemma-4-26b-a4b-it:free` | Gemma 4 free |
| `/model mimo` | `OPENROUTER_MIMO_MODEL` | `xiaomi/mimo-v2-pro` | Mimo reasoning |
| `/model omni` | `OPENROUTER_OMNI_MODEL` | `xiaomi/mimo-v2-pro` | Multimodal |
| `/model anthropic <model>` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` | Direct Anthropic |
| `/model xai <model>` | `XAI_API_KEY` | `grok-4-1-fast` | xAI / Grok |
| `/model ollama <model>` | `OLLAMA_MODEL` | `minimax-m2.7:cloud` | Local Ollama |

**Natural language switching also works** from chat: `"use claude"`, `"switch to gemma"`, `"use model 4"`.

### Free model chain

`OPENROUTER_FREE_MODELS` (comma-separated) sets the fallback chain. Defaults to all free presets:

```bash
OPENROUTER_FREE_MODELS=nvidia/nemotron-3-super-120b-a12b:free,nousresearch/hermes-3-llama-3.1-405b:free,minimax/minimax-m2.5:free,z-ai/glm-5.1,google/gemma-4-26b-a4b-it:free
```

### Reasoning (multi-turn)

Claude-via-OpenRouter, GLM-5, and Mimo all support extended reasoning with `reasoning_details` preserved across turns. SolanaOS passes `reasoning_details` back unmodified in session history so the model continues its chain of thought.

```bash
# Use Claude opus reasoning via OpenRouter (no Anthropic key required)
OPENROUTER_CLAUDE=anthropic/claude-opus-4.6-fast
# Then switch to it: /model claude
```

### Semantic Memory Search (Embeddings)

When `OPENROUTER_API_KEY` is set, SolanaOS automatically enables **vector semantic search** for memory recall using the OpenRouter Embeddings API:

```
POST https://openrouter.ai/api/v1/embeddings
model: openai/text-embedding-3-small (default)
```

- Memory `Recall` / `/memory_search` / `/recall` use **cosine similarity** instead of keyword matching
- Results are cached in-memory to avoid re-embedding identical strings
- Override the embedding model: `OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-large`
- On startup you'll see: `[MEMORY] ✅ semantic search enabled (model: openai/text-embedding-3-small)`

### Local DeepSolana (Ollama)

Run the Solana-specialized reasoning model locally:

```bash
ollama pull 8bit/DeepSolana
OLLAMA_MODEL=8bit/DeepSolana
# or switch at runtime: /model ollama 8bit/DeepSolana
```

Model source: [HuggingFace ordlibrary/DeepSeek-R1-Solana-Reasoning](https://huggingface.co/ordlibrary/DeepSeek-R1-Solana-Reasoning) · [Ollama 8bit/DeepSolana](https://ollama.com/8bit/DeepSolana)

### All LLM env vars

```bash
# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-...         # required for OpenRouter + semantic memory
OPENROUTER_MODEL=minimax/minimax-m2.7   # default active model
OPENROUTER_MODEL1=nvidia/nemotron-3-super-120b-a12b:free
OPENROUTER_MODEL2=nousresearch/hermes-3-llama-3.1-405b:free
OPENROUTER_MODEL3=minimax/minimax-m2.5:free
OPENROUTER_MODEL4=z-ai/glm-5.1
OPENROUTER_CLAUDE=anthropic/claude-opus-4.6-fast
OPENROUTER_GEMMA=google/gemma-4-26b-a4b-it:free
OPENROUTER_MIMO_MODEL=xiaomi/mimo-v2-pro
OPENROUTER_OMNI_MODEL=xiaomi/mimo-v2-pro
OPENROUTER_FREE_MODELS=                 # comma-separated fallback chain (auto-built from presets if empty)
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small

# Anthropic (direct)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6

# xAI
XAI_API_KEY=...
XAI_IMAGE_MODEL=grok-imagine-image      # /image
XAI_VIDEO_MODEL=grok-imagine-video      # /video

# Ollama (local)
OLLAMA_MODEL=8bit/DeepSolana            # or minimax-m2.7:cloud
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_FALLBACK_ENABLED=true

# Together AI
TOGETHER_API_KEY=...
TOGETHER_MODEL=zai-org/GLM-5

# llama.cpp server (OpenAI-compatible)
LLAMA_CPP_URL=http://127.0.0.1:8079
LLAMA_CPP_MODEL=gemma4
LLAMA_CPP_ENABLED=false
```

## Trading Stack

### Solana

- SolanaTracker RPC and WSS are the default
- SolanaTracker Datastream powers real-time websocket feeds
- SolanaTracker powers Telegram swap build-and-send flows when configured
- The legacy Jupiter/on-chain execution path remains available as fallback
- Helius remains the fallback provider for DAS and fallback RPC paths

### Perps

- Hyperliquid support for balance, positions, orders, fills, leverage, candles, and websocket-driven triggers
- Aster support for account, positions, orders, income, and natural-language Telegram routing

### Startup pump launch

Optional one-time launch on daemon boot:

```bash
PUMP_LAUNCH_ENABLED=true
PUMP_LAUNCH_CONFIRM=launch
PUMP_LAUNCH_MODE=once_only
PUMP_LAUNCH_NAME=SolanaOS
PUMP_LAUNCH_SYMBOL=NANO
```

The daemon persists launch state and refuses to relaunch in `once_only` mode unless you intentionally reset it.

### Pump.fun Token Scanner

Automated pipeline that scans pump.fun for the top 100 trending tokens, classifies them by trading tiers, and sends Telegram alerts.

**Data Sources:**

| Source | Access | What It Provides |
|--------|--------|-----------------|
| pump.fun/board | Chrome computer use (local only — API blocked by Cloudflare) | Live board data, bonding %, ages |
| GeckoTerminal | Free API, no key | PumpSwap pools sorted by 24h tx count, FDV, liquidity |
| Solana Tracker | `SOLANA_TRACKER_API_KEY` | Trending tokens, holders, buy/sell pressure, curvePercentage |
| Helius RPC | `HELIUS_API_KEY` | On-chain bonding curve state via `@nirholas/pump-sdk` |
| DexScreener | Free API, no key | Price, MC, volume, pairs (fallback) |

**Scanner Scripts (committed to `scripts/`):**

| Script | Purpose |
|--------|---------|
| `scripts/pump-scanner.sh` | Shell wrapper — loads `.env`, calls `pump_scanner.py`, commits + pushes |
| `scripts/pump_scanner.py` | Python orchestrator — GeckoTerminal (5 pages) + Solana Tracker trending + per-token enrichment |
| `scripts/pump-bonding.mjs` | Node.js on-chain enricher — `OnlinePumpSdk.fetchBondingCurveSummary()` + `getGraduationProgress()` via Helius RPC |

**Run manually:**
```bash
bash scripts/pump-scanner.sh
```

**Pipeline flow:**
1. GeckoTerminal `pumpswap/pools` x 5 pages = 100 graduated tokens (sorted by 24h tx count, no auth)
2. Solana Tracker `/tokens/trending` → `curvePercentage`, `pool.graduated`, `pool.market`
3. Solana Tracker `/tokens/{mint}` per-token enrichment for top 30
4. `pump-bonding.mjs` (Helius on-chain) for tokens still missing bonding% — batches 4 concurrent RPC calls, 400ms between batches
5. Writes `pump.md` → sends Telegram digest → commits and pushes

**Token classification (from `trade.md`):**

| Tier | Criteria | Strategy |
|------|----------|----------|
| 1 Fresh Snipers | Age ≤ 15min | 0.05 SOL, fast flip |
| 2 Near-Graduation | Bonding ≥ 75% | Ride graduation pump |
| 3 Micro-Cap | MC < $10K | Speculative |
| 4 Mid-Cap | MC $10K–$100K | Trend-follow |
| 5 Large-Cap | MC > $100K | Scalps on dips |

**Scheduling (three tracks):**

```
:00  Remote trigger    → GeckoTerminal + Solana Tracker → pump.md → Telegram → git push
:30  Local skill/CLI   → Chrome computer use OR pump-scanner.sh → pump.md → Telegram
:00  Remote trigger again...
```

- **Remote Trigger** (hourly): Claude Code dispatch `trig_01KUywkkCQVJeqvzDbrK82Vj` — runs in cloud, no browser
- **Local Computer Use**: `pumpfun-token-scanner` skill — Chrome browser automation on local Mac
- **CLI**: `bash scripts/pump-scanner.sh` — standalone, cron-friendly

**Note on `pump-bonding.mjs`:** The SDK files from `pump-fun-sdk-main 4/src/` (analytics.ts, bondingCurve.ts, fees.ts, onlineSdk.ts) are bundled compiled in `@nirholas/pump-sdk` under `scripts/node_modules`. Same exports: `OnlinePumpSdk`, `getGraduationProgress`, `calculateBuyPriceImpact`, `getTokenPrice`, `computeFeesBps`.

### On-Chain Agent Registration (8004 + Metaplex)

The pump.fun scanner agent can be registered on-chain via the [8004 Trustless Agent Registry](https://github.com/QuantuLabs/8004-solana-ts) and Metaplex Core NFTs. This gives the scanner a verifiable on-chain identity with ATOM reputation scoring.

**Register the scanner agent:**
```bash
node scripts/register-scanner-agent.mjs
```

**What happens:**
1. Builds scanner-specific metadata (name, description, services, skills, domains)
2. Pins metadata to IPFS via Pinata
3. Registers on the 8004 agent registry with ATOM enabled
4. Sets on-chain metadata (scanner_type, pipeline, endpoints)
5. Syncs to the nanohub Convex backend
6. Saves state to `~/.solanaos/registry/scanner-agent.json`

**Required env vars:**
```
SOLANA_PRIVATE_KEY=<JSON array of secret key bytes>
HELIUS_RPC_URL=<Solana RPC>
PINATA_JWT=<Pinata JWT for IPFS>
```

**8004 features used:**
- `registerAgent()` — creates on-chain agent identity as Core NFT
- `setAgentWallet()` — binds operational wallet
- `setMetadata()` — stores scanner config on-chain
- `giveFeedback()` / `getSummary()` — ATOM reputation engine
- Trust tiers: Unrated → Bronze → Silver → Gold → Platinum

**Nanohub integration:**
- `/st/agent-registry?asset=<address>` — edge function returning agent reputation from 8004 indexer
- `AgentStatus` component in the Pump Scanner tab shows live trust tier + ATOM score
- `solanaosAgentReputation` Convex table stores periodic reputation snapshots

## Agent Registration (Metaplex 014)

Register your agent on-chain as a Metaplex NFT with a single command:

```bash
solanaos solana register
```

What happens:
1. Loads your agent wallet (auto-generated on first boot)
2. Checks for existing registration (won't double-register)
3. Auto-detects skills from your `.env` (OODA, SolanaTracker, Aster, etc.)
4. Registers on Solana devnet as a Metaplex 014 NFT (gasless, auto-airdrop)
5. Saves the registration result locally
6. Prints the Solana Explorer link

```text
⛓️  SolanaOS Agent Registration

  Agent:   AAqkn72V...
  Skills:  [ooda-trading, solana-tracker-data, aster-perps]
  Network: devnet (gasless)

  ✅ Agent registered on-chain!

  Mint:     5Kz8...
  Tx:       3Qfx...
  Explorer: https://explorer.solana.com/address/5Kz8...?cluster=devnet
```

### Three ways to create an agent

| Method | Command / URL | What happens |
| --- | --- | --- |
| **CLI** | `solanaos solana register` | One command, zero cost, auto-detects skills |
| **Hub** | [seeker.solanaos.net/dashboard](https://seeker.solanaos.net/dashboard) → "Create Devnet Agent" | Web form, saves to Convex with GitHub + wallet identity |
| **Metaplex SDK** | [seeker.solanaos.net/setup/metaplex](https://seeker.solanaos.net/setup/metaplex) | Full guide: install Metaplex Skill, register identity, set up executive, delegate execution |

### What gets saved

Every agent is stored in Convex with:
- `userId` — linked to your GitHub account
- `ownerWalletAddress` — from Phantom Connect or Seeker pairing
- `metaplexAssetAddress` — on-chain NFT mint address
- `metaplexIdentityPda` — discoverable PDA for the agent
- `metaplexRegistered` — boolean flag
- `registryMode` — `8004`, `metaplex`, or `dual`
- Services array — web, A2A, MCP endpoints (ERC-8004 format)

### Verify on-chain

```bash
solanaos solana registry    # show registered agents
```

Or check the Solana Explorer directly with the mint address.

## macOS Menu Bar App

A lightweight native menu bar companion that connects to your local SolanaOS daemon and all Hub surfaces.

### Build & Install

```bash
cd apps/macos
bash build-menubar.sh
```

This compiles the standalone Swift file (no Xcode project needed) and creates `SolanaOS Menu Bar.app`.

### Run

```bash
open "apps/macos/SolanaOS Menu Bar.app"
```

### Install to Applications

```bash
cp -r "apps/macos/SolanaOS Menu Bar.app" /Applications/
```

### Auto-start on login

```bash
osascript -e 'tell application "System Events" to make login item at end with properties {path:"/Applications/SolanaOS Menu Bar.app", hidden:true}'
```

### What it shows

| Icon | Meaning |
| --- | --- |
| ◎ | Daemon running |
| ◌ | Daemon starting |
| ⚠︎ | Daemon offline |

Status line: `daemon status · ooda mode · watchlist count · honcho on/off`

### Menu items

**Local:** Control panel (`:7777`), Wallet, Chat

**Hub:** Dashboard, Mining Fleet, Strategy Builder, Skills Registry, Agent Directory, Create Skill, Souls Library

**Setup Guides:** Gateway, Telegram, Metaplex, BitAxe Mining, Chrome Extension

**Seeker:** Reveal/copy setup code, reveal connect bundle

**System:** GitHub, Terminal, Quit

## Control Surfaces

| Surface | Notes |
| --- | --- |
| **SolanaOS Control UI** | Lit + Vite SPA on port 7777 (`solanaos server`). Chat with LLM, real-time status, config editor, debug panel, cron, sessions, skills, channels, logs. Embedded into Go binary via `//go:embed`. Binds `0.0.0.0` by default for Tailscale/LAN; use `--local` for localhost. Proxies WebSocket to gateway on port 18790. Aliases: `nanobot`, `control`. |
| **SolanaOS Office** | 3D retro workspace at [office.solanaos.net](https://office.solanaos.net). Adapted from Claw3D, rebranded as SolanaOS HQ. Real-time Solana market terminal (Birdeye API), agent chat, skills marketplace. Solana purple/green branding. |
| SolanaOS Control (legacy) | Local wallet/chat/tools UI, usually on `127.0.0.1:7777` |
| Web console | Local or Tailscale-served browser UI |
| Telegram | Main operator bot surface |
| Chrome extension | Popup wallet/chat/tools plus Seeker pairing |
| macOS app | Menu bar control surface |
| Android | SolanaOS Seeker app and gateway pairing |
| SolanaOS Hub | Registry and skills marketplace at `seeker.solanaos.net` |

## SolanaOS Office (3D Workspace)

A 3D retro office environment for managing agents and monitoring Solana markets. Adapted from Claw3D, lives in `Claw3D-main/`, deployed to [office.solanaos.net](https://office.solanaos.net).

### Features

- **3D office environment** — retro workspace for agent management, rebranded as "SolanaOS HQ"
- **Real-time Solana market terminal** — powered by Birdeye API with a pop-out terminal in the 3D scene
- **Agent chat** — interact with agents directly from the office
- **Skills marketplace** — browse and manage agent skills
- **Solana branding** — purple (#9945FF) and green (#14F195) color scheme

### Birdeye Market API

The Office exposes an API route at `/api/market` supporting:

| Endpoint | What |
| --- | --- |
| `prices` | Current token prices |
| `trending` | Trending tokens on Solana |
| `overview` | Market overview |
| `OHLCV` | Candlestick chart data |
| `new_listings` | Recently listed tokens |
| `meme_list` | Meme token leaderboard |
| `smart_money` | Smart money flow tracking |
| `token_txs` | Token transaction history |
| `holder_distribution` | Token holder breakdown |
| `wallet_networth` | Wallet net worth lookup |
| `wallet_pnl` | Wallet profit and loss |
| `search` | Token search |
| `networks` | Supported networks |

All responses are cached in memory for 60 seconds.

## Gateway WebSocket Protocol

The gateway on port 18790 exposes a full WebSocket protocol used by both the Control UI and the Office. The gateway sends ping frames every 30 seconds with a 90-second read deadline that resets on every message, preventing timeout disconnects.

### Supported Methods

| Method | What |
| --- | --- |
| `config.get` / `config.set` / `config.schema` | Read/write `~/.solanaos/solanaos.json`, schema with sections for LLM, Solana, Telegram, Gateway |
| `status` / `health` | Runtime status and health check |
| `system-presence` | Online presence signal |
| `sessions.list` | Active session listing |
| `agents.list` / `agent.identity.get` | Agent enumeration and identity |
| `skills.status` / `channels.status` | Skills and channels state |
| `cron.*` | Cron job management |
| `logs.tail` | Live log streaming |
| `device.pair.*` | Device pairing flow |
| `exec.approvals.*` | Execution approval management |
| `models.list` | Available LLM models |
| `last-heartbeat` | Last daemon heartbeat |
| `chat.send` | Send message with async LLM inference (streams response as `chat` event) |
| `chat.history` / `chat.abort` | Chat history retrieval and abort in-flight inference |

### LLM Chat Integration

The `chat.send` method routes to any configured LLM provider via the `LLMProvider` interface. Supported providers: Ollama, OpenRouter, Anthropic, xAI. The gateway prints `LLM attached: <provider> / <model>` on startup. Responses stream back to the client as `chat` WebSocket events.

## Hardware

The runtime can run software-only or attach to Arduino Modulino hardware over I2C.

Supported sensors and controls:

- Pixels
- Buzzer
- Buttons
- Knob
- IMU
- Thermo
- ToF distance

Supported targets:

- NVIDIA Orin Nano
- Raspberry Pi
- RISC-V Linux boards
- x86 Linux
- macOS and Windows in stub mode

See [docs/HARDWARE.md](docs/HARDWARE.md).

## x402

SolanaOS includes x402 payment support for crypto-gated APIs.

Main pieces:

- facilitator proxy
- SVM signer
- configurable paywall middleware
- multi-chain config surface

Minimal enablement:

```bash
X402_PAYWALL_ENABLED=true
./build/solanaos daemon
```

## Agent Wallet API

SolanaOS includes a full agent wallet service that manages encrypted Solana + EVM keypairs, exposes a REST API, and optionally integrates with Privy managed wallets and E2B sandbox deployment.

### Local Signing Keys (dev + trade)

On every startup the agent wallet bootstraps two dedicated AES-256-GCM encrypted Solana keypairs:

| Key | File | Purpose |
| --- | --- | --- |
| `dev` | `~/.solanaos/signers/dev.enc` | Devnet / local development signing |
| `trade` | `~/.solanaos/signers/trade.enc` | Mainnet trading and live transactions |

Key loading priority: `LOCAL_SIGNER_{MODE}_KEY` env var → disk `.enc` file → fresh generated keypair. Each file is an AES-256-GCM envelope:

```json
{ "data": "<hex ciphertext>", "nonce": "<hex nonce>" }
```

The master AES key is derived from `VAULT_PASSPHRASE` via SHA-256. The trade key can have its own `TRADE_SIGNER_PASSPHRASE`. Private keys are **never** returned by the API.

**Local signer endpoints:**

```text
GET  /v1/local-signers              → list dev + trade pubkeys
GET  /v1/local-signers/{mode}       → get pubkey (mode: dev|trade)
POST /v1/local-signers/{mode}/sign  → sign arbitrary message
POST /v1/local-signers/{mode}/sign-tx → build + sign + broadcast SOL transfer
```

### Sandbox Modes

The `/v1/deploy` endpoint works in two modes — no configuration change needed:

| Mode | Trigger | Notes |
| --- | --- | --- |
| **E2B cloud** | `E2B_API_KEY` is set | Spins up a remote E2B sandbox; API URL is `https://{id}-8420.e2b.dev` |
| **Local process** | `E2B_API_KEY` not set | Re-executes the wallet binary as a child process on a free local port; API URL is `http://localhost:{port}` |

Local sandboxes are useful for CI, offline development, and testing agent interactions without cloud dependencies.

### One-Shot Bootstrap

```bash
solanaos wallet-api
```

This single command:
1. Initializes the AES-256-GCM encrypted vault at `~/.solanaos/vault/`
2. Generates (or loads) `dev` and `trade` signing keys at `~/.solanaos/signers/`
3. Creates a default Solana vault wallet if no wallets exist
4. Connects to Solana RPC and any configured EVM chains
5. Starts the wallet API server on port 8421
6. Handles graceful shutdown on Ctrl+C

### Flags

```bash
solanaos wallet-api --port 8421 --chain solana --label primary
solanaos wallet-api --chain evm --label base-wallet
solanaos wallet-api --skip-setup  # just start the API, no auto-creation
```

| Flag | Default | What |
| --- | --- | --- |
| `--port` | `$WALLET_API_PORT` or `8421` | HTTP API port |
| `--chain` | `solana` | Chain for auto-created wallet (`solana` or `evm`) |
| `--label` | `default` | Friendly name for the wallet |
| `--skip-setup` | `false` | Skip auto-wallet creation |

### API Endpoints

| Method | Path | What |
| --- | --- | --- |
| `POST` | `/v1/wallets` | Create a new wallet (Solana or EVM) |
| `GET` | `/v1/wallets` | List all wallets |
| `GET` | `/v1/wallets/{id}` | Get wallet details |
| `DELETE` | `/v1/wallets/{id}` | Delete a wallet |
| `GET` | `/v1/wallets/{id}/balance` | Check native token balance |
| `POST` | `/v1/wallets/{id}/transfer` | Send SOL/ETH/native tokens |
| `POST` | `/v1/wallets/{id}/transfer-token` | Send ERC-20 tokens |
| `POST` | `/v1/wallets/{id}/sign` | Sign arbitrary data |
| `POST` | `/v1/wallets/{id}/pause` | Emergency pause wallet |
| `POST` | `/v1/wallets/{id}/unpause` | Resume paused wallet |
| `POST` | `/v1/eth-call` | Read-only EVM contract call |
| `GET` | `/v1/chains` | List supported chains |
| `POST` | `/v1/deploy` | Deploy wallet API to E2B sandbox |
| `GET` | `/v1/deployments` | List active sandbox deployments |
| `DELETE` | `/v1/deployments/{agent_id}` | Tear down a sandbox |
| `POST` | `/v1/privy/wallets` | Create Privy-managed wallet |
| `GET` | `/v1/privy/wallets` | List Privy wallets |
| `POST` | `/v1/privy/wallets/{id}/sign` | Sign with Privy wallet |
| `POST` | `/v1/privy/wallets/{id}/send` | Send via Privy wallet |
| `GET` | `/v1/health` | Health check |

### MCP Servers

SolanaOS ships two MCP servers for AI agent integration (Claude Desktop, Cursor, VS Code, Zed):

#### 1. solanaos-mcp — Full SolanaOS MCP server (`mcp-server/`)

Exposes the full SolanaOS tool registry, agent fleet, memory, and skills to any MCP client.

```bash
make build-mcp        # build once
make start-mcp        # start HTTP server on port 3001
```

Claude Desktop config (`~/.claude.json` or Claude Desktop settings):

```json
{
  "mcpServers": {
    "solanaos": {
      "command": "node",
      "args": ["<path-to-repo>/mcp-server/dist/index.js"],
      "env": {
        "SOLANAOS_GATEWAY_URL": "http://localhost:18790",
        "SOLANAOS_GATEWAY_API_KEY": ""
      }
    }
  }
}
```

Tools: `solana.price`, `solana.trending`, `solana.token_info`, `solana.wallet_pnl`, `solana.search`, `agent.spawn`, `agent.list`, `agent.stop`, `memory.recall`, `memory.write`, `task.create`, `task.list`, `skill.list`, `skill.run`, `gateway.health`

Resources: `solanaos://soul`, `solanaos://skills`, `solanaos://tools`, `solanaos://source/{path}`

#### 2. Agent Wallet MCP (`services/agent-wallet/mcp/`)

Exposes wallet vault operations directly to AI agents.

```json
{
  "mcpServers": {
    "agent-wallet": {
      "command": "npx",
      "args": ["tsx", "services/agent-wallet/mcp/index.ts"],
      "env": {
        "WALLET_API_URL": "http://localhost:8421/v1",
        "WALLET_API_KEY": ""
      }
    }
  }
}
```

Tools: `create_wallet`, `list_wallets`, `get_balance`, `transfer`, `transfer_token`, `sign_message`, `pause_wallet`, `unpause_wallet`, `deploy_sandbox`, `teardown_sandbox`, `privy_create_wallet`, `privy_sign`, `privy_send`

### Docker

```bash
docker build -f services/agent-wallet/Dockerfile -t agent-wallet .
docker run --env-file .env -p 8421:8420 agent-wallet
```

### Environment Variables

```bash
WALLET_API_PORT=8421          # HTTP port
WALLET_API_KEY=               # Bearer token for auth (optional)
VAULT_PASSPHRASE=             # Master encryption key
SOLANA_RPC_URL=               # Solana RPC endpoint
EVM_CHAINS=8453:https://...   # chainID:rpcURL pairs
BASE_RPC_URL=                 # Base chain RPC (shortcut)
ETH_RPC_URL=                  # Ethereum RPC (shortcut)
E2B_API_KEY=                  # E2B sandbox deployment
PRIVY_APP_ID=                 # Privy managed wallets
PRIVY_APP_SECRET=             # Privy app secret
```

### Supported Chains

| Chain | ID | Type | Native |
| --- | --- | --- | --- |
| Solana | 900 | solana | SOL |
| Ethereum | 1 | evm | ETH |
| Base | 8453 | evm | ETH |
| Arbitrum | 42161 | evm | ETH |
| Optimism | 10 | evm | ETH |
| Polygon | 137 | evm | POL |
| BSC | 56 | evm | BNB |
| Avalanche | 43114 | evm | AVAX |
| Zora | 7777777 | evm | ETH |
| PulseChain | 369 | evm | PLS |

## Cloudflare Workers

SolanaOS ships two Cloudflare Worker deployments for edge-side execution:

### Agent Wallet Worker (`workers/agent-wallet/`)

Edge version of the agent wallet vault — AES-256-GCM encrypted keys stored in Cloudflare KV, same REST API as the Go service (`/v1/wallets`, `/v1/local-signers`, etc.). Useful when you need global low-latency wallet access without running a Go process.

```bash
cd workers/agent-wallet
wrangler secret put VAULT_PASSPHRASE
wrangler secret put WALLET_API_KEY
wrangler secret put SOLANA_RPC_URL
wrangler deploy
```

Worker name: `solanaos-agent-wallet` — deployed to `solanaos-agent-wallet.<account>.workers.dev`

### Pump.fun MCP Worker (`pumpfun-mcp-worker/`)

Cloudflare Worker that runs a pump.fun token scanner on a 15-minute cron trigger and exposes results via MCP. Stores scan results in KV, surfaces them as MCP tools for AI agents.

```bash
cd pumpfun-mcp-worker
wrangler deploy
```

Worker name: `pumpfun-mcp-server` — cron: `*/15 * * * *`

---

## Pump.fun Bots (`bots/`)

Two pump.fun TypeScript bots are bundled in `bots/` and fully integrated into the SolanaOS daemon runtime via `pkg/pumpfun/`. The daemon manages them as supervised subprocesses — start, stop, log streaming, and .env config — all from Telegram without touching a terminal.

| Bot | Path | What |
| --- | --- | --- |
| **Mayhem Sniper** | `bots/pumpfun-mayhem-sniper-main/` | Geyser WebSocket new-token detector with Mayhem Mode filter, dev-buy validation, and TP/SL/timeout exit |
| **AI Trading Bot** | `bots/pumpfun-mayhem-ai-trading-bot-main/` | Express HTTP API (`:3001`) + AI pattern recognition trading loop |

### Bot Architecture

Both bots run as `ts-node` child processes under the Go daemon. The `pkg/pumpfun` manager captures their stdout/stderr into a 40-line ring buffer per bot, sources each bot's `.env`, and inherits `SOLANA_TRACKER_RPC_URL` and `WSS` from the daemon config automatically.

```text
SolanaOS Daemon (Go)
  └── pkg/pumpfun.Manager
       ├── KindSniper  → ts-node src/index.ts  (bots/pumpfun-mayhem-sniper-main/)
       │    └── Geyser WS → pump.fun program → InitializeMint2 → buy/sell
       └── KindAIBot   → ts-node src/index.ts  (bots/pumpfun-mayhem-ai-trading-bot-main/)
            └── Express :3001 → /api/health, /api/trading
```

### Bot Telegram Commands

```text
/bots                    — status of both bots
/sniper start            — launch the Mayhem Sniper
/sniper stop             — kill it
/sniper logs [N]         — last N lines of stdout/stderr (default 20)
/sniper config           — show .env (private keys redacted)
/sniper set KEY VALUE    — update a .env key (restart bot to apply)

/aibot start             — launch the AI Trading Bot
/aibot stop              — kill it
/aibot logs [N]          — last N lines
/aibot config            — show .env
/aibot set KEY VALUE     — update a .env key
```

### Sniper Bot Config (`.env`)

```bash
GEYSER_RPC=wss://...                # Geyser WebSocket endpoint
PRIVATE_KEY=...                     # Wallet private key (base58)
RPC_ENDPOINT=https://...            # Solana HTTP RPC
RPC_WEBSOCKET_ENDPOINT=wss://...    # Solana WebSocket RPC
BUY_AMOUNT=0.1                      # SOL per trade
SLIPPAGE=10                         # Slippage %
TAKE_PROFIT=20                      # % gain to auto-sell
STOP_LOSS=15                        # % loss to auto-sell
TIME_OUT=60                         # Max hold seconds before forced exit
CHECK_DEV_BUY=true                  # Require dev to invest ≥ MIN_DEV_BUY_AMOUNT
MIN_DEV_BUY_AMOUNT=0.5              # Minimum dev buy in SOL
MAYHEM_MODE_ONLY=false              # Only snipe tokens with Mayhem Mode flag
```

**How the sniper works:**

1. Subscribes to the pump.fun program (`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`) via Geyser WebSocket
2. Detects `InitializeMint2` instructions — new token creation events
3. Optionally checks for the Mayhem Mode flag via `isMayhemMode()`
4. Validates the developer's initial buy against `MIN_DEV_BUY_AMOUNT`
5. Executes `buyToken()` via `@cryptoscan/pumpfun-sdk` with configured slippage
6. Polls the bonding curve price every 500ms until TP, SL, or timeout triggers
7. Executes `sellToken()` on exit

### AI Bot Config (`.env`)

```bash
PORT=3001                           # HTTP server port
AI_ENABLED=true                     # Activate AI trading loop on startup
SOLANA_PRIVATE_KEY=...              # Wallet private key (base58)
SOLANA_RPC_URL=https://...          # Solana HTTP RPC
```

**API endpoints (when running):**

| Method | Path | What |
| --- | --- | --- |
| `GET` | `http://localhost:3001/api/health` | Liveness check + bot status |
| `POST` | `http://localhost:3001/api/trading` | Place a trade order |

### Running standalone (without daemon integration)

```bash
# Sniper
cd bots/pumpfun-mayhem-sniper-main
cp .env.example .env    # fill in GEYSER_RPC, PRIVATE_KEY, etc.
npm install && npm start

# AI Trading Bot
cd bots/pumpfun-mayhem-ai-trading-bot-main
cp .env.example .env    # fill in SOLANA_PRIVATE_KEY, etc.
npm install && npm run dev
```

### Token Scanner Output (`pump.md`)

The pump.fun scanner pipeline (see [Pump.fun Token Scanner](#pumpfun-token-scanner) below) writes its output to [`pump.md`](pump.md). It scans ~100 tokens per run, filters spam, classifies by trading tier, and sends a Telegram digest. Example output format:

```markdown
Date: 2026-03-26  |  Scanned: 113  |  Blocked (spam): 14  |  Clean: 99

| # | Name            | Ticker   | Mint         | MCap | Change  | Age    |
|---|-----------------|----------|--------------|------|---------|--------|
| 1 | Pippin          | pippin   | Dfh5Dz...   | N/A  | +3.79%  | N/A    |
| 2 | Penguin Empress | kolwaii  | 4BZSEBVk...  | N/A  | +33.02% | N/A    |
| 5 | シコク           | Shikoku  | 4xU6BSLz...  | N/A  | +204%   | 3m ago |
...
```

The sniper bot targets fresh tokens from this feed. The AI bot uses it for pattern recognition and market sentiment analysis.

---

## ACP Registry Generator

The `acp_registry/` directory contains an interactive CLI for generating `agent.json` files for the [8004 Agent Commerce Protocol](https://github.com/QuantuLabs/8004-solana-ts) registry.

### Generate

```bash
node acp_registry/generate.mjs
```

The wizard walks through:
- Agent identity (name, display name, description, icon)
- Distribution config (command type, args)
- Services (MCP, A2A, HTTP, WebSocket, gRPC)
- Registry settings (program IDs, metadata storage, NFT standard, clusters)
- Feature flags (ATOM reputation, SEAL v1, x402, ProofPass, heartbeat sync)
- Capabilities (skills from 7 categories, domains, x402 support)

Previews the JSON and writes `agent.json` on confirmation.

### Validate

```bash
node acp_registry/generate.mjs validate
node acp_registry/generate.mjs validate path/to/agent.json
```

Checks required fields: `schema_version`, `name`, `display_name`, `description`, `distribution`, `registry`, `services`, `capabilities`.

### Example

See `acp_registry/agent.example.json` for a complete reference configuration (the SolanaOS agent itself).

### Skill Categories

The generator includes the full 8004 ACP skill catalogue:

| Category | Skills |
| --- | --- |
| Advanced Reasoning | strategic planning, problem solving, multi-step reasoning, decision making, risk assessment |
| Finance & Business | finance, trading, portfolio management, market analysis, DeFi, tokenomics, accounting |
| Software Development | coding, debugging, code review, architecture, DevOps, smart contracts, web3 |
| Data & Analytics | data analysis, visualization, machine learning, on-chain analytics, sentiment analysis |
| Creative | writing, design, content creation, meme generation, marketing, branding |
| Communication | community management, social media, customer support, translation, moderation |
| Infrastructure | node operation, validator, RPC provider, indexing, monitoring, security audit |

## Docs Map

Use the short README for orientation and these docs for depth:

- [docs/LANDING.md](docs/LANDING.md): short product/landing copy
- [docs/RELEASE-2026-03-v2.md](docs/RELEASE-2026-03-v2.md): current release summary
- [docs/command-cheatsheet.md](docs/command-cheatsheet.md): grouped CLI, Telegram, and NanoHub commands
- [docs/notebooklm-pack.md](docs/notebooklm-pack.md): NotebookLM source pack generation and prompt
- [docs/HARDWARE.md](docs/HARDWARE.md): hardware deploy and wiring
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md): runtime issues and recovery
- [docs/control-api.md](docs/control-api.md): SolanaOS Control API
- [docs/cli-guide.md](docs/cli-guide.md): broader CLI usage
- [docs/deployment.md](docs/deployment.md): deployment patterns

Hosted:

- Docs: `https://solanaos.net`
- Hub: `https://seeker.solanaos.net`

## Build And Deploy

### Local build

```bash
make build    # builds UI (cd ui && npm ci && npx vite build) then Go binary with //go:embed
make test
```

`make build` now runs the UI build step first (Vite production build in `ui/`), then compiles the Go binary which embeds the UI dist output. CI workflows also build the UI before the Go binary. A cross-platform release workflow triggers on tags. Dependabot is configured for gomod, npm, docker, and github-actions.

### Common targets

```bash
make orin
make rpi
make riscv
make macos
make docker
make cross
```

### Docker

```bash
docker build -t solanaos .
docker run --env-file .env \
  -v "$HOME/.config/solana/id.json:/root/.config/solana/id.json:ro" \
  solanaos
```

### Fly.io

Relevant files:

- `Dockerfile.fly`
- `scripts/fly-start.sh`
- `fly.toml`

The Fly path is intended for persistent daemon state plus the web console. Start with research, memory, and Telegram before enabling live keys.

## Repo Layout

```text
solanaos/
├── main.go                    # root Go binary (solanaos daemon)
├── start.sh                   # unified service start/stop/status script
├── install.sh                 # one-shot installer (build + workspace + keys)
├── Makefile                   # all build targets
│
├── cmd/
│   ├── mawdbot/               # primary daemon CLI entrypoint
│   ├── gateway-api/           # standalone gateway binary (port 18790)
│   ├── mawdbot-tui/           # TUI launcher
│   └── solanaos-control-api/  # control API binary (port 18789)
│
├── pkg/                       # 55 Go library packages (see pkg/ table above)
│   ├── daemon/                # 8,400-line orchestrator
│   ├── agent/                 # OODA loop + tool-calling
│   ├── llm/                   # multi-provider LLM + God Mode pipeline
│   ├── solana/                # SolanaTracker RPC, Birdeye v3, Jupiter
│   ├── gateway/               # TCP + WebSocket gateway
│   ├── nanobot/               # Control UI server (port 7777)
│   ├── hardware/              # Modulino I2C drivers
│   ├── x402/                  # x402 payment protocol
│   └── ...                    # 45 more — see pkg/ section
│
├── services/
│   └── agent-wallet/          # AES-256 encrypted wallet vault + REST API (port 8421)
│       ├── cmd/               # standalone agent-wallet binary
│       └── mcp/               # MCP server for AI agent tooling
│
├── mcp-server/                # solanaos-mcp — local MCP server (Claude Desktop / Cursor)
│
├── workers/                   # Cloudflare Workers monorepo
│   ├── agents/                # agent task dispatch worker
│   ├── gateway/               # gateway proxy worker
│   ├── routing/               # request routing worker
│   ├── sessions/              # session management worker
│   ├── commands/              # command handler worker
│   ├── cron/                  # scheduled job worker
│   ├── auto-reply/            # auto-reply worker
│   ├── infra/                 # infra shared utilities
│   └── shared/                # shared types + helpers
│
├── pumpfun-mcp-worker/        # pump.fun MCP server (Cloudflare Worker + Cron)
│
├── npm/                       # canonical npm packages (published to npmjs.com)
│   ├── solanaos/              # solanaos-computer (v1.1.1) — one-shot installer
│   ├── solanaos-installer/    # solanaos-cli (v2.1.1) — CLI alias
│   └── mawdbot-installer/     # solanaos-cli (v2.1.1) — legacy compat alias
│
├── new/npm/                   # ⚠️  older package drafts — npm/ is canonical
│
├── acp_registry/              # ACP 8004 agent registry tooling
│   ├── agent.example.json     # reference ACP config
│   └── generate.mjs           # interactive agent.json builder
│
├── skills/                    # bundled SKILL.md files for agent context
├── bots/                      # standalone trading bots (pump.fun sniper + AI)
├── mawdbot-bitaxe/            # MawdAxe BitAxe ASIC miner agent (own Makefile)
├── g0dm0d3-main/              # God Mode source (Rust/Python ML components)
├── page-agent-main/           # web UI automation agent
├── extensions/bluebubbles/    # iMessage bridge via BlueBubbles
├── WatchApp/                  # Apple Watch app (Swift / WatchOS)
│
├── ui/                        # Lit + Vite Control UI (//go:embed into binary)
├── web/                       # web backend + frontend (optional solanaos-web)
├── src/                       # TypeScript shared sources (workers / web)
│
├── db/                        # database schema (index.ts, schema.ts)
├── internal/                  # Go internal packages (hal)
├── scripts/                   # release, deploy, seeker, pump scripts
├── deploy/                    # Fly.io deployment package
├── docs/                      # markdown documentation
└── build/                     # compiled binaries (gitignored)
```

**Service port map:**

| Binary | Port | Start command |
| --- | --- | --- |
| solanaos daemon | 18790 (gateway), 7777 (control UI) | `bash start.sh` or `make start` |
| agent-wallet | 8421 | auto-started by `start.sh`; standalone: `make start-agent-wallet` |
| solanaos-mcp | 3001 (HTTP) or stdio | auto-started by `start.sh`; standalone: `make start-mcp` |
| gateway-api | 18790 | built into daemon; standalone: `./build/gateway-api` |
| control-api | 18789 | `make run-control-api` |

Notes:

- `solanaos` is the canonical name throughout
- `npm/` is the canonical npm workspace — `new/npm/` contains older drafts and is not published
- Workers in `workers/` and `pumpfun-mcp-worker/` are deployed separately via Wrangler/Cloudflare
- `bots/` — two standalone pump.fun bots (AI trading + sniper); independent Node.js projects
- `WatchApp/` — Apple Watch app (Swift/WatchOS) for wallet balance glances; built with Xcode
- `page-agent-main/` — web UI automation agent (AI-powered browser control)
- `extensions/bluebubbles/` — iMessage bridge integration via BlueBubbles server
- `workers/` and `pumpfun-mcp-worker/` — deployed separately to Cloudflare via `wrangler deploy`
- `new/npm/` — stale draft packages; canonical npm packages live in `npm/`

## Configuration Notes

### JSON config (`~/.solanaos/solanaos.json`)

The gateway and Control UI read/write a structured JSON config file at `~/.solanaos/solanaos.json`. This file is created by `solanaos onboard` or by editing the Config tab in the Control UI. It contains sections for:

- **LLM** — provider, model, API key (Ollama, OpenRouter, Anthropic, xAI, OpenAI)
- **Solana** — SolanaTracker API key, Birdeye API key
- **Telegram** — bot token, chat ID
- **Gateway** — port, bind address

The config schema is served via the `config.schema` WebSocket method so the UI can render a dynamic editor.

### Environment loading order

- current working directory `.env`
- executable directory `.env`
- parent of executable directory `.env`
- `~/.solanaos/.env`

Useful overrides:

- `SOLANAOS_HOME`
- `SOLANAOS_CONFIG`
- `SOLANAOS_ENV_FILE`
- `SOLANAOS_SOUL_PATH`
- `SOLANAOS_SKILLS_DIR`

## Security

- no API keys should be committed
- `.env` stays local
- generated wallets are stored under the runtime home with restrictive permissions
- only public addresses should appear in logs

See [SECURITY.md](SECURITY.md).

## Contributing

```bash
git checkout -b feature/my-change
make build
make test
git commit -m "Add my change"
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).

---

## Vision

> **The next billion blockchain transactions will be executed by AI agents, not humans clicking buttons.**

SolanaOS is building toward a world where any AI agent can launch, trade, and manage tokens through natural language — where fee revenue flows autonomously to agent wallets, where agent fleets coordinate across protocols through shared memory and skills, and where epistemological reasoning becomes the competitive moat that separates agents that adapt from agents that don't.

See [docs/vision.md](docs/vision.md) for the full thesis.

---

<div align="center">

**SolanaOS · Local-first Solana infrastructure in one binary**

**Built by [8BIT Labs](https://github.com/x402agent) · Powered by Go · Memory by [Honcho](https://honcho.dev) · Paid via [x402](https://x402.org)**

[GitHub](https://github.com/x402agent/SolanaOS) · [Hub](https://seeker.solanaos.net) · [Souls](https://souls.solanaos.net) · [Docs](https://solanaos.net) · [Launch](https://solanaos.net)

</div>
