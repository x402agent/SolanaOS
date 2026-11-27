# Clawd Bot runtime (`clawdbot/`)

🦞 **Clawd** is the mascot; **Musebook** is the provider. This directory is the
Clawd Bot Go runtime: a small, self-hostable Solana agent CLI with an OODA
trading loop, Agent DNA, the six-law trading harness, Jupiter/Birdeye/Helius
clients, Vulcan/Phoenix perps, a ClawVault key vault, a skills catalog, and the
`zero` / `zkomni` zero-knowledge surfaces.

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
go run ./cmd/clawdbot zero zkomni ask "derive a nullifier for context foo"
```

Config and env: copy `.env.example` (safe placeholders only) and put real values
in `.env.local` or `~/.clawdbot/.env`. Never commit real keys. Live trading and
wallet paths stay opt-in.

## Where it came from

This code is from two MIT-licensed repos by Clawd Contributors (see `LICENSE`).
Both forked from the same `github.com/8bitlabs/clawdbot` codebase:

| Source | Commit | What was taken |
|---|---|---|
| [Solizardking/clawdb0t](https://github.com/Solizardking/clawdb0t) | `6a427f8` | **Base:** all of `cmd/` and `pkg/`, `go.mod`/`go.sum`, `npm/clawdbot` wrapper, `.env.example`, `LICENSE` |
| [Solizardking/clawd-bot-zero](https://github.com/Solizardking/clawd-bot-zero) | `1f64fc0` | `pkg/zkomni` (zk-shark-agent + RH↔Solana msgType-4 Ed25519 PoK), the `clawdbot zero zkomni …` subcommands, and the `zero` intent router update |

Changes made during the import:

- Module path `github.com/8bitlabs/clawdbot` became
  `github.com/x402agent/SolanaOS/clawdbot`. The old path never resolved; the new
  one is go-gettable from this repo.
- Public URLs updated: the runtime repo now points here, the skills repo points to
  `themusebook/skills` (where GitHub redirects the old `Solizardking/skills`), and
  the terminal URL is `https://musebook.trade`.
- `pkg/zkomni`'s repo-surface test skips when the optional TypeScript
  `zk-primitives/` sidecar isn't checked out. That sidecar isn't vendored here.

### Not imported (yet)

From clawd-bot-zero: `pkg/webconsole` and `web/` (these need a built frontend
`dist/`), `pkg/bundled` (a 16 MB skills pack), `pkg/rh`, `pkg/e2bcomputer`,
`pkg/release`, the Blockscout MCP tools, and the broader `config`/`catalog`/
`providers`/`mcp` deltas.

From both repos: `agent/` and `.agents/` skill trees, `docs/`, `ui/`, `web/`,
`zk-primitives/`, `cloudflare/`, `mobile/`, `backend/`, packaging scripts and
release assets.
