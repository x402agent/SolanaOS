# Contributing to SolanaOS

Thanks for contributing. This is the public source for the Go runtime, wallet service, gateway, MCP server, npm installers, and all app surfaces.

**Start here:** [FORK.md](FORK.md) — 15-minute guide from fork to running agent.

---

## Quick Setup

```bash
git clone https://github.com/YOUR_HANDLE/SolanaOS.git
cd SolanaOS
cp .env.example .env           # fill in API keys (see FORK.md section 2)

# Build all services
make build                     # solanaos binary
make build-agent-wallet        # wallet API + local signing keys (port 8421)
make build-gateway-api         # standalone gateway (port 18790)
make build-mcp                 # MCP server for Claude/Cursor (port 3001)

# Start everything
bash start.sh

# Simulate without real money
./build/solanaos ooda --sim --interval 60

# Run tests
make test
```

---

## Where to Contribute

| Area | Path | What |
| --- | --- | --- |
| **OODA loop** | `pkg/agent/` | Trading logic, signal processing |
| **Strategy signals** | `pkg/strategy/` | RSI, EMA, ATR, VWAP indicators |
| **Telegram bot** | `pkg/channels/telegram/` | Commands, handlers, UX |
| **Solana clients** | `pkg/solana/` | RPC, Birdeye, Jupiter, SolanaTracker |
| **LLM / God Mode** | `pkg/llm/` | Model routing, AutoTune, scoring |
| **Wallet vault** | `services/agent-wallet/` | AES-256 signing, REST API |
| **MCP server** | `mcp-server/` | Tools exposed to Claude/Cursor |
| **Skills** | `skills/` | New SKILL.md agent capabilities |
| **Hardware** | `pkg/hardware/` | Arduino Modulino I2C drivers |
| **Gateway** | `pkg/gateway/` | WebSocket + TCP bridge |
| **Memory** | `pkg/memory/` + `pkg/honcho/` | Agent memory and learning |
| **npm packages** | `npm/` | Installer and CLI packages |

---

## Project Structure

```text
solanaos/
├── main.go                    # root CLI entry (cobra commands)
├── start.sh                   # start/stop/status all services
├── install.sh                 # one-shot installer
├── Makefile                   # all build targets (run: make help)
│
├── pkg/                       # 55 Go library packages
│   ├── agent/                 # OODA loop + tool-calling
│   ├── daemon/                # 8,400-line orchestrator
│   ├── llm/                   # multi-provider LLM + God Mode
│   ├── solana/                # SolanaTracker RPC, Birdeye, Jupiter
│   ├── strategy/              # RSI/EMA/ATR/VWAP (pure Go)
│   ├── channels/telegram/     # Telegram bot (60+ commands)
│   ├── gateway/               # TCP + WebSocket gateway
│   ├── hardware/              # Modulino I2C drivers
│   ├── memory/ + honcho/      # vault + Honcho v3 memory
│   └── x402/                  # x402 payment protocol
│
├── services/agent-wallet/     # AES-256 wallet vault + REST API
│   ├── cmd/                   # standalone binary entrypoint
│   └── mcp/                   # MCP server for wallet ops
│
├── mcp-server/                # solanaos-mcp TypeScript server
├── cmd/gateway-api/           # standalone gateway binary
├── cmd/solanaos-control-api/  # control API binary
│
├── npm/                       # canonical npm packages (publish from here)
│   ├── solanaos/              # solanaos-computer
│   ├── solanaos-installer/    # solanaos-cli
│   └── mawdbot-installer/     # nanosolana-cli (legacy alias)
│
├── skills/                    # SKILL.md bundles
├── SOUL.md                    # agent identity / system prompt
├── strategy.md                # trading strategy config
└── .env.example               # all env vars documented
```

---

## Security Rules

Non-negotiable before any PR:

1. **Never hardcode secrets** — all credentials via environment variables (`pkg/config/`)
2. **Never commit `.env`** — gitignored; use `.env.example` for documentation
3. **Never log secrets** — log public keys, truncated URLs, boolean status only
4. **Verify before pushing:**

   ```bash
   grep -rn "sk-or-v1-\|hch-v3-\|AKIA" --include="*.go" --include="*.ts" pkg/ cmd/ services/ mcp-server/
   ```

5. **AES keys stay in vault** — wallet private keys must never appear in API responses

See [SECURITY.md](SECURITY.md) for the full policy.

---

## Code Style

- **Go**: `gofmt -s -w .` before committing; `go vet ./...` must pass
- **TypeScript**: `tsc` must pass; follow existing patterns in `mcp-server/`
- **Error handling**: `fmt.Errorf("context: %w", err)` — always wrap
- **Logging**: component-tagged (`[PKG-NAME]`) — no raw secrets in output
- **Naming**: Go conventions — PascalCase exported, camelCase unexported

---

## PR Process

1. Fork + create a feature branch: `git checkout -b feat/my-thing`
2. Make changes with tests
3. Run the full check:

   ```bash
   make build && make test
   gofmt -l . && go vet ./...
   ```

4. Commit clearly:

   ```text
   feat(agent): add momentum filter to OODA signal scoring

   - Added 5-candle EMA momentum check before entry
   - Filters low-conviction signals below 0.3 confidence
   - Tests in pkg/agent/momentum_test.go
   ```

5. Open PR to `main` — fill out the PR template

---

## Good First Issues

Look for `good first issue` labels:

- **New skills** — add a `SKILL.md` to `skills/` (zero Go required)
- **Strategy indicators** — new signals in `pkg/strategy/`
- **Telegram commands** — new slash commands in `pkg/channels/telegram/`
- **MCP tools** — new tools in `mcp-server/src/server.ts`
- **Tests** — improve coverage in any `pkg/` package
- **Docs** — improve `FORK.md`, `docs/`, or inline code comments

---

## Questions

- [GitHub Discussions](https://github.com/x402agent/SolanaOS/discussions) — design questions, ideas
- [Issues](https://github.com/x402agent/SolanaOS/issues) — bug reports
- Tag maintainers in your PR for review

**Build clean. Ship small. Stay operator-grade.**
