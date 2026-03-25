# Adding a New Messaging Platform

Checklist for integrating a new messaging platform into the SolanaOS Go runtime.

This is the SolanaOS equivalent of the Hermes gateway checklist, adapted to the actual integration points in this repo. The architecture here is simpler:

- channels publish `bus.InboundMessage`
- the daemon handles routing, commands, LLM calls, Honcho, and local memory
- outbound replies go back through `bus.OutboundMessage`

You are not wiring a full Python adapter stack. You are adding a Go channel implementation that fits the existing `pkg/channels` + `pkg/bus` + `pkg/daemon` flow.

---

## 1. Core Channel Package

Create a new package under:

```text
pkg/channels/<platform>/
```

Reference implementations:

- `pkg/channels/telegram/telegram.go`
- `pkg/channels/x/x.go`

Your channel must implement the `channels.Channel` interface from `pkg/channels/channels.go`.

### Required methods

| Method | Purpose |
| --- | --- |
| `Name() string` | Stable channel name used in routing and daemon dispatch |
| `Start(ctx context.Context) error` | Connect, start polling/streaming/webhooks |
| `Stop(ctx context.Context) error` | Stop listeners, cancel goroutines, flush state |
| `Send(ctx context.Context, msg bus.OutboundMessage) error` | Send assistant text replies back to the platform |
| `IsRunning() bool` | Channel liveness |
| `IsAllowed(senderID string) bool` | Authorization via allowlist |

In practice, embed `*channels.BaseChannel` and implement the rest.

### Expected constructor pattern

```go
func New(cfg *config.Config, msgBus *bus.MessageBus) (*Channel, error)
```

or platform-specific naming like:

```go
func NewTelegramChannel(cfg *config.Config, msgBus *bus.MessageBus) (*TelegramChannel, error)
```

### Strongly recommended internal helpers

| Helper | Purpose |
| --- | --- |
| `handleMessage(...)` | Parse raw inbound platform events |
| `publishInbound...(...)` | Build and publish `bus.InboundMessage` |
| `loadState()` / `saveState()` | Persist cursors or last-seen IDs for polling platforms |
| `parseChatID(...)` | If the platform has thread/sub-chat concepts |

---

## 2. Config Schema (`pkg/config/config.go`)

Add the platform to `ChannelsConfig` and define a config struct.

Current pattern:

```go
type ChannelsConfig struct {
    Telegram TelegramChannel `json:"telegram"`
    Discord  DiscordChannel  `json:"discord"`
    X        XChannel        `json:"x"`
}
```

You need all of these integration points:

### Add channel config type

Example:

```go
type SlackChannel struct {
    Enabled   bool     `json:"enabled"`
    Token     string   `json:"token"`
    AllowFrom []string `json:"allow_from"`
    BaseURL   string   `json:"base_url,omitempty"`
}
```

### Add to `ChannelsConfig`

```go
Slack SlackChannel `json:"slack"`
```

### Add defaults in `DefaultConfig()`

```go
Channels: ChannelsConfig{
    Telegram: TelegramChannel{Enabled: false},
    Discord:  DiscordChannel{Enabled: false},
    X:        XChannel{...},
    Slack:    SlackChannel{Enabled: false},
},
```

### Add env loading in `applyEnvOverrides()`

Follow the Telegram/X pattern:

- token / API key
- allowlist
- base URL / API endpoint
- polling interval or transport-specific knobs

If your platform should auto-enable when credentials exist, mirror the X behavior.

---

## 3. Environment Variables

Add the platform to:

- `.env.example`
- `README.md`
- any setup docs that enumerate supported surfaces

Current config conventions:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ALLOW_FROM`
- `TWITTER_CONSUMER_KEY`
- `TWITTER_ALLOW_FROM`

Use one consistent prefix for your platform and keep raw env parsing in `applyEnvOverrides()`.

---

## 4. Daemon Registration (`pkg/daemon/daemon.go`)

Register the channel during daemon startup inside `Run()`.

Current pattern:

```go
if d.cfg.Channels.Telegram.Enabled || os.Getenv("TELEGRAM_BOT_TOKEN") != "" {
    tg, err := telegram.NewTelegramChannel(d.cfg, d.bus)
    ...
    d.chanMgr.Register(tg)
}
```

Add the same for your platform:

1. init condition
2. constructor call
3. register with `d.chanMgr`
4. useful startup log line

Without this, the channel exists on disk but never starts.

---

## 5. Inbound Message Shape (`pkg/bus/bus.go`)

This is the most important SolanaOS-specific step.

Your channel must publish a fully shaped `bus.InboundMessage` so the daemon, learning, Honcho, and command routing all work without platform-specific branching.

### Required fields

| Field | Why it matters |
| --- | --- |
| `Channel` | Routing and outbound dispatch |
| `SenderID` | Base identity fallback |
| `Sender.CanonicalID` | Cross-surface identity continuity |
| `Sender.PlatformID` | Raw platform-specific ID |
| `Sender.Username` | UX and logs |
| `Sender.DisplayName` | Prompt context and memory labels |
| `ChatID` | Reply target and session fallback |
| `Content` | Actual user text |
| `MessageID` | Traceability |
| `Peer.Kind` | User vs group/channel context |
| `Peer.ID` | Group/channel identifier |
| `Peer.Name` | Human-readable context |
| `Metadata` | Platform-specific extras |

### Session keys

If you do nothing, `BaseChannel.PublishInbound()` will derive:

```go
msg.SessionKey = routing.BuildSessionKey("", msg.Channel, msg.ChatID)
```

That is usually correct. Override `SessionKey` only if the platform has more complex threading semantics and you are certain the daemon should treat them as separate sessions.

### Media scope

If your platform supports attachments, set `Media` and let `BaseChannel.PublishInbound()` create a `MediaScope` unless you need custom grouping.

---

## 6. Use `BaseChannel` Correctly

`BaseChannel` already gives you:

- allowlist checks
- default session key generation
- content sanitization via `autoreply.SanitizeInboundUserText`
- message bus publish logic

Use:

```go
c.PublishInbound(ctx, bus.InboundMessage{...})
```

or:

```go
c.HandleMessage(ctx, senderID, chatID, content, media)
```

Prefer `PublishInbound` when you need to populate `Sender`, `Peer`, `MessageID`, and metadata properly.

---

## 7. Authorization / Allowlist

Each channel is responsible for applying sender allowlists before publishing inbound messages.

Current pattern:

- `BaseChannel.IsAllowed(senderID string)`
- platform-specific env parsing into `AllowFrom`

At minimum:

1. parse allowlist from config/env
2. reject unauthorized messages early
3. support both raw IDs and friendly aliases if the platform needs it

If the platform supports multiple identifiers, normalize them consistently before checking.

---

## 8. Outbound Delivery

Minimal support is one method:

```go
Send(ctx context.Context, msg bus.OutboundMessage) error
```

This is enough for:

- daemon replies
- automation delivery
- any future generic outbound routing

### Platform formatting

Format the outbound assistant text inside the channel package, not in the daemon.

Examples already in repo:

- Telegram converts markdown-ish output to HTML and chunks at ~4000 chars
- X strips formatting and splits threads to fit tweet limits

If your platform has message-size limits, implement chunking in the channel package.

---

## 9. Platform UX Extras

These are not required for a basic channel, but you should decide explicitly whether you need them.

### Telegram-only today

The daemon has direct Telegram helpers:

- typing indicator via `SendTyping`
- in-progress placeholder message via `SendPlaceholderText`
- final response edit via `EditMessage`

That flow is hard-coded in `pkg/daemon/daemon.go` through `getTelegramCh()`.

If your new platform needs the same UX:

1. add platform-specific helper methods
2. add a `get<Platform>Ch()` accessor in the daemon
3. branch the daemon's pre-send and post-send flow the same way Telegram does

If you do not add this, the platform still works. It just gets normal outbound messages without typing/edit behavior.

---

## 10. Polling / Streaming / Webhook Reliability

SolanaOS does not have a shared reconnect framework for channels. Each channel owns its own lifecycle.

If your platform uses:

- polling: persist cursors or last-seen IDs
- streaming/websocket: reconnect with backoff
- webhooks: handle lifecycle and shutdown cleanly

Follow the X channel pattern for:

- background goroutine ownership
- cancelable context
- wait groups
- persisted last-seen state

Do not rely on daemon restart as your only recovery mechanism.

---

## 11. Routing and Command Compatibility

The daemon expects inbound content to look like one of:

- slash commands such as `/status`
- X-style bang commands such as `!help`
- plain natural language

For a new platform, decide:

1. whether slash commands pass through unchanged
2. whether you need a platform-native quick-action normalization layer
3. whether mentions or reply-only semantics should gate bot responses

Telegram already does mention filtering in groups and quick-action normalization in private chats. Your platform may need equivalent pre-processing before publishing inbound text.

---

## 12. Automation Delivery

`deliverAutomation()` publishes:

```go
bus.OutboundMessage{
    Channel: job.Channel,
    ChatID:  job.ChatID,
    Content: content,
}
```

That means a new platform automatically supports automation delivery if:

1. the channel is registered
2. `Send()` works for that `Channel` + `ChatID`

No extra cron wiring is needed beyond getting outbound dispatch correct.

---

## 13. Media Support

Inbound media support exists structurally through:

- `InboundMessage.Media`
- `InboundMessage.MediaScope`
- `bus.OutboundMediaMessage`

But the current generic outbound path only dispatches `OutboundMessage`. If your platform needs outbound media:

1. implement the platform API client support
2. decide whether to add media dispatch support to `channels.Manager` and the daemon
3. document the exact supported media types

For inbound media, you can still publish attachment URLs/paths in `Media` today without changing the manager.

---

## 14. Tests

At minimum, add tests for:

- env/config loading in `pkg/config/config_test.go`
- channel-specific parsing or chunking helpers under `pkg/channels/<platform>/`
- session or identity normalization if you add custom logic

Recommended coverage:

- allowlist handling
- message splitting at platform size limits
- state persistence for polling cursors
- inbound message shaping into `bus.InboundMessage`

---

## 15. Documentation

Update:

| File | What to update |
| --- | --- |
| `README.md` | Supported surfaces, env vars, setup snippets |
| `.env.example` | Platform credentials and allowlist vars |
| `docs/` | Setup guide if the platform is meant to be operator-facing |

If the platform has unusual session semantics, document the resulting `ChatID` and `SessionKey` shape explicitly.

---

## 16. SolanaOS Integration Checklist

Use this as the final pass:

- [ ] New `pkg/channels/<platform>/` package exists
- [ ] Implements `channels.Channel`
- [ ] Uses `BaseChannel` for allowlist + publish flow
- [ ] Config struct added to `ChannelsConfig`
- [ ] Defaults added in `DefaultConfig()`
- [ ] Env parsing added in `applyEnvOverrides()`
- [ ] `.env.example` updated
- [ ] `README.md` updated
- [ ] Daemon startup registers the channel
- [ ] `Send()` handles outbound text correctly
- [ ] Inbound messages populate `Sender`, `Peer`, `ChatID`, `MessageID`, and metadata
- [ ] Group/mention/reply filtering is correct for the platform
- [ ] Polling/stream reconnect logic is platform-owned and cancelable
- [ ] Tests cover config and core helpers

---

## Minimal Skeleton

```go
package myplatform

import (
    "context"
    "fmt"

    "github.com/x402agent/Solana-Os-Go/pkg/bus"
    "github.com/x402agent/Solana-Os-Go/pkg/channels"
    "github.com/x402agent/Solana-Os-Go/pkg/config"
)

type Channel struct {
    *channels.BaseChannel
    cfg *config.Config
}

func New(cfg *config.Config, msgBus *bus.MessageBus) (*Channel, error) {
    return &Channel{
        BaseChannel: channels.NewBaseChannel("myplatform", msgBus, nil),
        cfg:         cfg,
    }, nil
}

func (c *Channel) Start(ctx context.Context) error {
    c.SetRunning(true)
    return nil
}

func (c *Channel) Stop(ctx context.Context) error {
    c.SetRunning(false)
    return nil
}

func (c *Channel) Send(ctx context.Context, msg bus.OutboundMessage) error {
    if !c.IsRunning() {
        return fmt.Errorf("myplatform: not running")
    }
    return nil
}
```

From there, the real work is shaping inbound events into `bus.InboundMessage` correctly.

