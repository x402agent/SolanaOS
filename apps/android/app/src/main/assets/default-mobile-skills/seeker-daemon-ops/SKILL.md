---
name: seeker-daemon-ops
description: Operate the SolanaOS Seeker daemon and validate the mobile Telegram/runtime flow.
homepage: https://seeker.solanaos.net/solanaos
---

# SolanaOS Seeker Daemon Ops

Use this bundled skill when the device needs a fast local runbook for daemon startup, status checks, and Telegram command validation.

## Standard run

```bash
go run ./cmd/mawdbot daemon --seeker --pet-name SolanaOS
```

## Safe modes

```bash
go run ./cmd/mawdbot daemon --seeker --no-telegram
go run ./cmd/mawdbot daemon --seeker --no-ooda
```

## Validate

1. `/status`
2. `/wallet`
3. `/research <mint>`
4. `/ooda`
5. `/sim`

For the full catalog and updated installs, open `https://seeker.solanaos.net/solanaos`.
