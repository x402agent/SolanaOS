# SolanaOS Control API

This is a small Go control server that mirrors the controller/service split from the Solana App Kit backend without pulling in its full dependency tree.

The source of truth lives in:

- `cmd/solanaos-control-api`
- `pkg/controlapi`

The root-level `solanaos-control-api` file some local worktrees may contain is just a compiled binary artifact, not the source package.

## Purpose

It gives the Android app and future tools one HTTP surface for:

- status and feature discovery
- chat rooms and messages
- thread feed reads and writes
- Jupiter quote lookup and trade staging
- Pump.fun launch/buy/sell staging
- Token Mill market staging
- OpenRouter/Grok vision analysis

## Run

```bash
go run ./cmd/solanaos-control-api --addr :18789
```

Or use the Makefile helpers:

```bash
make build-control-api
make run-control-api
make test-control-api
```

## Endpoints

- `GET /health`
- `GET /api/control/status`
- `GET /api/control/intents`
- `GET /api/control/chat/users/{userId}/rooms`
- `POST /api/control/chat/direct`
- `POST /api/control/chat/group`
- `GET /api/control/chat/rooms/{chatId}/messages`
- `POST /api/control/chat/messages`
- `PUT /api/control/chat/messages/{messageId}`
- `DELETE /api/control/chat/messages/{messageId}?userId=...`
- `GET /api/control/chat/users`
- `GET /api/control/threads`
- `POST /api/control/threads`
- `POST /api/control/trade/quote`
- `POST /api/control/trade/stage`
- `POST /api/control/pumpfun/launch`
- `POST /api/control/pumpfun/buy`
- `POST /api/control/pumpfun/sell`
- `POST /api/control/tokenmill/market`
- `GET /api/control/openrouter/config`
- `POST /api/control/openrouter/vision`

## Notes

- Trade quotes call Jupiter's public quote API.
- Pump.fun and Token Mill routes currently stage intents in memory instead of executing on-chain operations.
- OpenRouter vision is live if `OPENROUTER_API_KEY` is set. It uses `OPENROUTER_GROK_MODEL` or defaults to `x-ai/grok-4.20-beta`.
