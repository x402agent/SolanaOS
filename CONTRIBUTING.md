# Contributing to SolanaOS

Thanks for contributing to SolanaOS. This repository is the public source for the runtime, gateway, app surfaces, and installer packages.

## 🚀 Quick Setup

```bash
# 1. Fork and clone
git clone https://github.com/x402agent/Solana-Os-Go.git
cd Solana-Os-Go

# 2. Set up your environment
cp .env.example .env
# Edit .env with your API keys (minimum: HELIUS_API_KEY for basic functionality)

# 3. Build
make build

# 4. Run in simulated mode (no real money)
./build/solanaos ooda --sim --interval 60

# 5. Run tests
make test
```

## 📁 Project Structure

```
Solana-Os-Go/
├── main.go                # CLI entry (cobra commands)
├── pkg/                   # Core packages — most contributions go here
│   ├── agent/             # OODA trading loop
│   ├── config/            # Configuration + env overrides
│   ├── daemon/            # Daemon orchestrator
│   ├── solana/            # Solana clients (Helius, Birdeye, Jupiter, Aster)
│   ├── strategy/          # RSI/EMA/ATR signal engine
│   ├── tamagochi/         # Companion runtime state engine
│   ├── x402/              # x402 payment protocol
│   ├── channels/          # Telegram, Discord channels
│   └── hardware/          # Arduino Modulino® I2C
├── internal/hal/          # Hardware abstraction (Linux I2C + stub)
├── .env.example           # Environment template (safe to commit)
└── .gitignore             # Excludes secrets, caches, binaries, and local state
```

## 🔒 Security Rules

**These are non-negotiable:**

1. **Never hardcode API keys, tokens, or secrets** in source code
2. **Never commit `.env` files** — they're gitignored for a reason
3. **All secrets must come from environment variables** (see `pkg/config/config.go`)
4. **Never log secrets** — only log public keys, truncated URLs, and boolean status
5. **Before every PR, verify** no secrets leaked:
   ```bash
   # Quick check
   grep -rn "sk-\|api_key.*=.*[A-Za-z0-9]\{20\}" --include="*.go" pkg/ cmd/ main.go
   ```

See [SECURITY.md](SECURITY.md) for the full security policy.

## 🧪 Testing

```bash
# Run all tests
make test

# Run specific package tests
go test -v ./pkg/config/...
go test -v ./pkg/strategy/...

# Run with race detector
go test -race ./...
```

## 📝 Code Style

- **Go standard formatting**: run `gofmt -s -w .` before committing
- **Meaningful package comments**: every package should have a doc comment
- **Error handling**: wrap errors with `fmt.Errorf("context: %w", err)`
- **Logging**: use component-tagged logs and keep secrets out of output
- **Naming**: follow Go conventions (exported = PascalCase, unexported = camelCase)

## 🔀 Pull Request Process

1. **Fork** the repo
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** with tests
4. **Run the full check**:
   ```bash
   make build && make test
   ```
5. **Commit** with a descriptive message:
   ```
   feat: add websocket streaming for real-time signals
   
   - Added pkg/ws/server.go with WebSocket endpoint
   - Integrated with OODA agent hooks for live updates
   - Added tests for connection handling and message routing
   ```
6. **Push** and submit a **PR** to `main`

## 💡 Good First Issues

Look for issues labeled `good first issue` — these are excellent starting points:

- **New CLI commands** — adding subcommands to `main.go`
- **Strategy improvements** — new indicators in `pkg/strategy/`
- **Companion runtime features** — new moods, animations, or evolution stages
- **Documentation** — improving README, adding examples
- **Testing** — increasing test coverage for existing packages

## ❓ Questions?

- Open a [Discussion](https://github.com/x402agent/Solana-Os-Go/discussions)
- Tag maintainers in your PR for review

**Build clean. Ship small. Stay operator-grade.**
