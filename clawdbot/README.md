# Clawd Bot runtime (`clawdbot/`)

🦞 **Clawd** is the mascot; **Musebook** is the provider. This directory is the
Clawd Bot Go runtime: a small, self-hostable Solana agent CLI with an OODA
trading loop, Agent DNA, the six-law trading harness, Jupiter/Birdeye/Helius
clients, Vulcan/Phoenix perps, a ClawVault key vault, a skills catalog, and the
`zero` zero-knowledge surface.

It is a **separate Go module** (`github.com/x402agent/SolanaOS/clawdbot`, Go
1.26.4+). The root SolanaOS module doesn't import it, and `go build ./...` at the
repo root skips it, so the two can be upgraded on their own.

## Build, vet, test

```bash
make clawdbot-build     # -> clawdbot/build/clawdbot, clawdbot/build/clawdbot-tui
make clawdbot-test      # go vet ./... && go test ./...

# or directly
cd clawdbot
go build ./... && go vet ./... && go test ./...
go run ./cmd/clawdbot version
go run ./cmd/clawdbot ooda --sim
```

Config and env: copy `.env.example` (safe placeholders only) and put real values
in `.env.local` or `~/.clawdbot/.env`. Never commit real keys. Live trading and
wallet paths stay opt-in.

## Where it came from

This code is from [Solizardking/clawdb0t](https://github.com/Solizardking/clawdb0t)
at commit `6a427f8`. It is MIT-licensed, © Clawd Contributors (see `LICENSE`).
Taken: all of `cmd/` and `pkg/`, `go.mod`/`go.sum`, the `npm/clawdbot` wrapper,
`.env.example` and `LICENSE`.

Changes made during the import:

- Module path `github.com/8bitlabs/clawdbot` became
  `github.com/x402agent/SolanaOS/clawdbot`. The old path never resolved; the new
  one is go-gettable from this repo.
- Public URLs updated: the runtime repo now points here, the skills repo points to
  `themusebook/skills` (where GitHub redirects the old `Solizardking/skills`), and
  the terminal URL is `https://musebook.trade`.

### Not imported

From clawdb0t: the `agent/` and `.agents/` skill trees, `docs/`, `ui/`, `web/`,
`zk-primitives/`, `cloudflare/`, `backend/`, and packaging scripts and release
assets.
