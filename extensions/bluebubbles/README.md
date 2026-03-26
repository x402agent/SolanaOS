# BlueBubbles Channel Plugin

iMessage bridge for Claude Code via [BlueBubbles](https://bluebubbles.app/).

## Architecture

```
BlueBubbles Server (macOS)  <-->  Channel Plugin (Bun)  <-->  Claude Code Session
       |                              |
  iMessage/SMS                   MCP stdio (JSON-RPC)
  Private API                    polls BB every 3s
```

The plugin lives at `~/.claude/channels/bluebubbles/index.ts` and runs as an MCP server
over stdio. It polls the BlueBubbles REST API for new messages and emits them as
`<channel source="bluebubbles">` events into the Claude Code session.

## Setup

### 1. BlueBubbles Server

Install BlueBubbles on your Mac: https://bluebubbles.app/

Make sure:
- Private API is enabled (for send/react/edit)
- You know the server URL and password (shown in BlueBubbles settings)

### 2. Configure the plugin

Edit `~/.claude/channels/bluebubbles/.env`:

```env
BLUEBUBBLES_SERVER_URL=http://192.168.1.X:1234
BLUEBUBBLES_PASSWORD=your-password-here
```

### 3. Access control

Edit `~/.claude/channels/bluebubbles/access.json` to control who can push messages:

```json
{
  "dmPolicy": "allowlist",
  "allowFrom": ["+17324063563"],
  "groups": {},
  "pending": {}
}
```

### 4. Run with Claude Code

```bash
claude --channels bluebubbles
```

Or with multiple channels:

```bash
claude --channels bluebubbles,plugin:telegram@claude-plugins-official
```

## Tools

| Tool | Description |
|------|-------------|
| `reply` | Reply to an iMessage conversation (pass `chat_id` from inbound event) |
| `react` | Add a tapback reaction (love, like, laugh, etc.) |
| `send_message` | Send a new message to a phone number or Apple ID |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BLUEBUBBLES_SERVER_URL` | `http://localhost:1234` | BlueBubbles server URL |
| `BLUEBUBBLES_PASSWORD` | (empty) | Server password |
| `BB_POLL_INTERVAL_MS` | `3000` | Poll interval in milliseconds |

## Message Format

Inbound messages arrive as:

```xml
<channel source="bluebubbles" chat_guid="iMessage;-;+17324063563" message_id="<guid>" user="+17324063563" ts="2026-03-25T...">
  Message text here
</channel>
```

Claude replies using the `reply` tool with the `chat_id` set to the `chat_guid` from the event.
