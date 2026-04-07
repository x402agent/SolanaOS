# pumpfun-mcp-server

Remote MCP server for pump.fun token scanning, deployed as a Cloudflare Worker with Cron Triggers running every 15 minutes, 24/7.

## What it does

- Scans GeckoTerminal + Solana Tracker APIs for the top 100 trending Solana meme tokens
- Applies platform blocklist (RapidLaunch, 7Tracker filtered out)
- Stores results in Cloudflare KV (7-day history)
- Pushes to Convex backend for nanohub UI
- Sends Telegram digests automatically
- Generates tweet drafts (≤280 chars)
- Exposes all of this as MCP tools you can use from Claude

## Architecture

```
Cloudflare Worker (pumpfun-mcp-server)
├── POST /mcp          ← MCP Streamable HTTP endpoint (custom connector)
├── GET  /             ← Health check + status
├── GET  /scan         ← Manual trigger (for testing)
└── Cron */15 * * * *  ← Automated scan every 15 min
         │
         ├── GeckoTerminal API (PumpSwap pools, no auth)
         ├── Solana Tracker API (trending tokens, keyed)
         │
         ├── KV Storage (latest + 7-day history)
         ├── Convex Push (nanohub UI)
         └── Telegram Bot API (digest)
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `pumpfun_scan_tokens` | Run a fresh scan (fetches APIs, stores in KV, optional Telegram + Convex) |
| `pumpfun_get_latest_scan` | Get latest scan results (JSON or Markdown format) |
| `pumpfun_send_telegram` | Send Telegram digest of latest scan |
| `pumpfun_generate_tweet` | Generate tweet draft (≤280 chars) |
| `pumpfun_scan_history` | List recent scan timestamps |

## Quick Deploy

### Prerequisites

- Node.js ≥ 18
- Cloudflare account (free tier works)
- `wrangler` CLI: `npm install -g wrangler`

### 1. Install dependencies

```bash
cd pumpfun-mcp-worker
npm install
```

### 2. Create KV namespace

```bash
wrangler kv namespace create SCANS
wrangler kv namespace create SCANS --preview
```

Copy the IDs into `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "SCANS"
id = "abc123..."           # from first command
preview_id = "def456..."   # from second command
```

### 3. Set secrets

```bash
wrangler secret put SOLANA_TRACKER_API_KEY
wrangler secret put HELIUS_API_KEY
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
wrangler secret put CONVEX_SITE_URL
```

### 4. Deploy

```bash
wrangler deploy
```

Your server will be live at `https://pumpfun-mcp-server.<your-subdomain>.workers.dev`

The cron trigger starts automatically — every 15 minutes, 24/7.

### 5. Verify

```bash
# Health check
curl https://pumpfun-mcp-server.<your-subdomain>.workers.dev/

# Manual scan
curl https://pumpfun-mcp-server.<your-subdomain>.workers.dev/scan

# Check cron logs
wrangler tail
```

## Add as Custom Connector in Claude

1. Go to **Settings → Connectors** in Claude
2. Click **"+" → Add custom connector**
3. Enter your worker URL + `/mcp`:
   ```
   https://pumpfun-mcp-server.<your-subdomain>.workers.dev/mcp
   ```
4. Click **Add** — no OAuth needed (add auth if you want, see below)
5. Enable it in any conversation via **"+" → Connectors**

Now Claude can call `pumpfun_scan_tokens`, `pumpfun_get_latest_scan`, etc. directly.

## Using via the API

```python
import anthropic

client = anthropic.Anthropic()

response = client.beta.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=4096,
    messages=[{"role": "user", "content": "What are the top trending pump.fun tokens right now?"}],
    mcp_servers=[{
        "type": "url",
        "url": "https://pumpfun-mcp-server.<your-subdomain>.workers.dev/mcp",
        "name": "pumpfun-scanner",
    }],
    tools=[{
        "type": "mcp_toolset",
        "mcp_server_name": "pumpfun-scanner",
    }],
    betas=["mcp-client-2025-11-20"],
)
```

## Adding Authentication (optional)

For production, add Bearer token auth to the worker:

```typescript
// In index.ts fetch handler, before processing /mcp:
const authHeader = request.headers.get("Authorization");
if (authHeader !== `Bearer ${env.MCP_AUTH_TOKEN}`) {
  return new Response("Unauthorized", { status: 401 });
}
```

Then set the secret:
```bash
wrangler secret put MCP_AUTH_TOKEN
```

And in Claude's connector config, add the token in Advanced Settings → Authorization Token.

## Local Development

```bash
npm run dev
# Server runs at http://localhost:8787
# MCP endpoint at http://localhost:8787/mcp
```

## Cron Schedule

The `wrangler.toml` is configured for every 15 minutes:

```toml
[triggers]
crons = ["*/15 * * * *"]
```

Change to other intervals:
- Every 5 minutes: `"*/5 * * * *"`
- Every hour: `"0 * * * *"`
- Every 30 minutes: `"*/30 * * * *"`

Monitor cron executions: `wrangler tail` or Cloudflare Dashboard → Workers → Triggers.

## Data Sources

| Source | Auth | What it provides |
|--------|------|-----------------|
| GeckoTerminal | None (free) | PumpSwap graduated tokens, FDV, volume |
| Solana Tracker | API key | Trending tokens, bonding curve %, holders |

## Project Structure

```
pumpfun-mcp-worker/
├── wrangler.toml       # Cloudflare config + cron triggers
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts        # Worker entry: MCP server + cron handler + routes
    ├── types.ts        # TypeScript interfaces
    ├── scanner.ts      # Token scanner (GeckoTerminal + Solana Tracker)
    ├── blocklist.ts    # Platform blocklist filter
    ├── telegram.ts     # Telegram digest formatting + sending
    ├── convex.ts       # Convex backend push
    └── tweet.ts        # Tweet draft generator
```
