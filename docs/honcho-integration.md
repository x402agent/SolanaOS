# SolanaOS + Honcho Integration

Last updated: 2026-03-23

## Overview

This repo already has a native Honcho v3 integration in the Go runtime. The generic Hermes pattern maps onto SolanaOS like this:

- inbound turns arrive from Telegram, gateway clients, Android/Seeker, Chrome, or other daemon-backed surfaces
- the daemon fetches Honcho context before the LLM call
- the daemon writes user and assistant turns back to Honcho after the response
- Honcho stores durable conclusions about trading preferences, token interests, and execution style

The implementation lives in:

- `pkg/honcho/client.go` — Go client for the Honcho v3 API
- `pkg/daemon/daemon.go` — prompt enrichment and turn capture
- `pkg/daemon/honcho_handlers.go` — Telegram-facing Honcho commands

## What This Build Uses Honcho For

SolanaOS uses Honcho for four concrete jobs:

1. Prompt-time memory injection into the daemon prompt
2. Cross-session continuity across Telegram and other routed surfaces
3. Durable conclusions about trading behavior and preferences
4. Natural-language recall through `peer.chat()` from Telegram commands

This sits beside the local vault under `~/.solanaos/memory/`. Local memory captures raw history. Honcho adds cross-session reasoning and retrieval.

## Runtime Mapping

### Workspace

- Env: `HONCHO_WORKSPACE_ID`
- Default: `solanaos`

Use one workspace per SolanaOS deployment.

### Agent Peer

- Env: `HONCHO_AGENT_PEER_ID`
- Default: `solanaos-agent`

The daemon uses the agent peer as the observer when it asks Honcho questions about the operator.

### User Peer

User peers are derived from the inbound sender identity and sanitized for Honcho:

1. `msg.Sender.CanonicalID`
2. `msg.Sender.PlatformID`
3. `msg.SenderID`
4. `msg.ChatID`

That means the same operator can keep continuity if your upstream surface preserves a stable canonical or platform ID.

### Sessions

Session IDs come from `HONCHO_SESSION_STRATEGY` and the daemon's `messageSessionKey()` logic:

| Strategy | Raw session key | Honcho intent |
| --- | --- | --- |
| `per-chat` | `<channel>:<chat_id>` | Default. One memory thread per chat |
| `per-user` | `user:<sender_id>` | Cross-chat memory for the same operator |
| `global` | `global:main` | Shared memory across the whole daemon |

Before writing to Honcho, SolanaOS sanitizes the raw session key into a safe Honcho ID.

## Prompt Enrichment Path

Before the daemon generates a reply, `honchoPromptContext()` assembles context from four places:

1. `session.context()` — session summary, relevant messages, and the agent's view of the user in this session
2. `peer.context()` — the agent peer's broader representation of the user
3. `conclusions.query()` — durable trading conclusions filtered to the current user
4. optional `peer.chat()` dialectic — a synthesized user model when `HONCHO_DIALECTIC_ENABLED=true`

This is the concrete SolanaOS equivalent of the generic "prompt-time context injection" pattern from the Honcho docs.

## Observation Model In This Repo

This build is not a symmetric "user and assistant both model each other equally" setup.

Current session peer config:

- user peer: `observe_me=true`, `observe_others=false`
- agent peer: `observe_me=true`, `observe_others=true`

In practice, SolanaOS uses the agent peer's perspective of the operator for recall and prompt enrichment. That is why daemon calls such as `PeerChat`, `PeerContext`, and `SessionContext` use:

- perspective: `solanaos-agent`
- target: current user peer

## Session Configuration

Every Honcho-backed session is created with trading-specific defaults:

- reasoning enabled
- peer card read/write enabled
- short summary every 12 messages
- long summary every 48 messages
- dreams enabled
- custom instructions telling Honcho to prioritize risk tolerance, trade horizon, watched tokens, execution constraints, preferred data sources, and workflow patterns

This is defined in `pkg/daemon/honcho_handlers.go`.

## Auto-Created Trading Conclusions

When a user turn is synced, the daemon also creates explicit conclusions for high-signal trading patterns, including:

- token symbols and mint hints
- research-heavy behavior
- spot trading behavior
- perps interest
- conservative risk language
- aggressive or high-velocity trading language
- swing-trade time horizon

This makes future recall much more useful than raw transcript search alone.

## Configuration

### Environment Variables

```bash
HONCHO_ENABLED=true
HONCHO_API_KEY=hch-v3-...

# Production default is api.honcho.dev. Both names are accepted by config load.
HONCHO_BASE_URL=https://api.honcho.dev
# HONCHO_URL=https://api.honcho.dev

HONCHO_WORKSPACE_ID=solanaos
HONCHO_AGENT_PEER_ID=solanaos-agent
HONCHO_REASONING_LEVEL=low
HONCHO_SESSION_STRATEGY=per-chat
HONCHO_CONTEXT_TOKENS=4000
HONCHO_CONTEXT_SUMMARY=true
HONCHO_SYNC_MESSAGES=true
HONCHO_DIALECTIC_ENABLED=true
```

Notes:

- if `HONCHO_API_KEY` is set and `HONCHO_ENABLED` is unset, config loading enables Honcho automatically
- `HONCHO_SYNC_MESSAGES=true` controls whether turns are written back after replies
- `HONCHO_DIALECTIC_ENABLED=true` controls the extra synthesized user-model query in prompt enrichment

## Telegram Commands

The daemon exposes both friendly memory commands and lower-level Honcho inspection commands.

### Friendly memory commands

| Command | What it does |
| --- | --- |
| `/memory` | Show profile, representation, insights, and session count |
| `/recall <query>` | Ask Honcho a natural-language recall question |
| `/remember <fact>` | Create a durable Honcho conclusion immediately |
| `/ask_memory <question>` | Ask the agent peer what it knows about you |
| `/forget <query>` | Search matching conclusions and delete them |

### Honcho inspection commands

| Command | What it does |
| --- | --- |
| `/honcho_status` | Show bridge status and config |
| `/honcho_context [query]` | Show session context plus peer context |
| `/honcho_sessions [page] [size]` | List sessions in the workspace |
| `/honcho_summaries` | Show short and long summaries for the current session |
| `/honcho_search <query>` | Search current-session messages |
| `/honcho_messages [page] [size]` | List current-session messages |
| `/honcho_message <message_id>` | Fetch one Honcho message |
| `/honcho_conclusions [query]` | List or search stored user conclusions |

## End-To-End Flow

```text
Operator message
  -> bus.InboundMessage
  -> daemon builds Honcho prompt context
  -> LLM generates reply
  -> daemon captures user/assistant turns
  -> Honcho stores messages, summaries, peer context, and trading conclusions
```

Any surface that routes through the daemon inherits the same Honcho behavior. Telegram is just the most visible control surface because it exposes the debug and recall commands directly.

## Verification

### 1. Check bridge status

In Telegram:

```text
/honcho_status
```

### 2. Check session strategy behavior

With `HONCHO_SESSION_STRATEGY=per-chat`, ask for a memory in one chat, then open a different chat and verify that it does not leak unless you switch to `per-user` or `global`.

### 3. Check recall

In one session:

```text
/remember I prefer spot only unless I explicitly ask for perps.
```

In a later turn:

```text
/recall what is my default trading preference
```

### 4. Check dialectic

```text
/ask_memory what kind of trader am I becoming
```

That answer should come from Honcho's synthesized reasoning, not just exact-match retrieval.

## Self-Hosting Honcho

If you want SolanaOS to point at a local Honcho instance:

```bash
git clone https://github.com/plastic-labs/honcho.git
cd honcho
cp .env.template .env
cp docker-compose.yml.example docker-compose.yml
docker compose up -d
curl http://localhost:8000/health
```

Then point SolanaOS at it:

```bash
HONCHO_ENABLED=true
HONCHO_BASE_URL=http://localhost:8000
HONCHO_API_KEY=not-needed-with-auth-disabled
```

## Source References

- `pkg/honcho/client.go`
- `pkg/daemon/daemon.go`
- `pkg/daemon/honcho_handlers.go`
- `.env.example`
