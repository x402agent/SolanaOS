# @clawd/clawdbot

**The Clawd Bot** CLI — sovereign Solana trading intelligence with zero-knowledge zk primitives.

```bash
curl -fsSL https://musebook.trade/clawdbot | bash
```

Or from npm:

```bash
npm i -g @clawd/clawdbot
clawdbot version
clawdbot agent -m "What is SOL price?"
clawdbot ooda --sim
clawdbot solana trending
clawdbot catalog zk
```

Without a global install:

```bash
npx @clawd/clawdbot version
```

This package wraps the same Go `clawdbot` binary the repo builds with `make build`.
The packed tarball from `make npm-pack` vendors the current-platform binary so a
fresh consumer can run `npx @clawd/clawdbot` with no extra toolchain.

Companion packages:

- `@clawd/clawd-bot` — same CLI, friendlier package name
- `@clawd/zk-primitives` — zero-knowledge primitive metadata and catalog

The unscoped npm name `clawdbot` is already owned by another project. The
`clawdbot` bin name stays the same.

macOS desktop install: download `Clawd Bot.dmg` and drag **Clawd Bot** into
Applications — same studio layout as Grok Bot.
