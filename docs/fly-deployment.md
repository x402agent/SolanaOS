# Fly.io Deployment

This is the recommended Fly.io deployment shape for SolanaOS.

## Recommended Topology

Do not try to force every component into one public Fly machine.

Use this split:

1. **Deploy the main SolanaOS daemon to Fly**
   - runs 24/7
   - handles Telegram, trading, memory, registry sync, and the web console
2. **Keep MawdAxe next to the Bitaxe**
   - on the same LAN
   - or on a Tailscale-reachable host
3. **Point the Fly daemon at MawdAxe**
   - using `MAWDAXE_API_BASE`
   - protected by `MAWDAXE_API_KEY`
4. **Keep NanoHub on Netlify/Convex**
   - that part is already a separate web surface

Why:

- Fly cannot directly reach a home `192.168.x.x` Bitaxe
- Bitaxe control belongs as close to the miner as possible
- Telegram, OODA, memory, and agent automation are good 24/7 hosted workloads

## What Already Exists In This Repo

- Main SolanaOS Fly config: [fly.toml](/Users/8bit/Downloads/nanosolana-go/fly.toml)
- Main image: [Dockerfile.fly](/Users/8bit/Downloads/nanosolana-go/Dockerfile.fly)
- Main entrypoint: [scripts/fly-start.sh](/Users/8bit/Downloads/nanosolana-go/scripts/fly-start.sh)
- Standalone MawdAxe Fly config: [mawdbot-bitaxe/fly.toml](/Users/8bit/Downloads/nanosolana-go/mawdbot-bitaxe/fly.toml)
- Standalone MawdAxe image: [mawdbot-bitaxe/Dockerfile.fly](/Users/8bit/Downloads/nanosolana-go/mawdbot-bitaxe/Dockerfile.fly)
- Deploy helper: [scripts/fly-deploy.sh](/Users/8bit/Downloads/nanosolana-go/scripts/fly-deploy.sh)

## Required Token

Fly uses `FLY_API_TOKEN`.

If you currently have a value in `FLY_ORG_TOKEN`, export it as `FLY_API_TOKEN` locally before deploying:

```bash
export FLY_API_TOKEN="$FLY_ORG_TOKEN"
```

Do not commit this token to the repo or bake it into config files.

## Deploy The Main SolanaOS Daemon

This is the 24/7 machine that should run:

- Telegram bot
- OODA runtime
- memory / Honcho sync
- wallet / registry tasks
- local web console on Fly

Recommended command:

```bash
bash scripts/fly-deploy.sh daemon --app solanaos-daemon
```

The script will:

- reuse `FLY_ORG_TOKEN` as `FLY_API_TOKEN` if needed
- create the Fly app if missing
- create the `solanaos_data` volume if missing
- set supported secrets from your local `.env`
- deploy with [fly.toml](/Users/8bit/Downloads/nanosolana-go/fly.toml)

### Secrets it can push

Examples include:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ID`
- `SOLANA_TRACKER_API_KEY`
- `SOLANA_TRACKER_RPC_URL`
- `HONCHO_API_KEY`
- `TOGETHER_API_KEY`
- `OPENROUTER_API_KEY`
- `XAI_API_KEY`
- `HYPERLIQUID_*`
- `ASTER_*`
- `MAWDAXE_API_BASE`
- `MAWDAXE_API_KEY`

## Connect The Fly Daemon To Local MawdAxe

This is the preferred mining setup.

Run MawdAxe on the LAN or Tailscale host that can actually reach the Bitaxe, then set:

```bash
MAWDAXE_API_BASE=http://mawdaxe-host.tailnet-name.ts.net:8420
MAWDAXE_API_KEY=your-secret-key
```

or, if you are intentionally using a locked-down public URL:

```bash
MAWDAXE_API_BASE=https://mawdaxe.example.com
MAWDAXE_API_KEY=your-secret-key
```

Then redeploy the main daemon:

```bash
bash scripts/fly-deploy.sh daemon --app solanaos-daemon
```

The daemon already knows how to proxy mining commands through `MAWDAXE_API_BASE`.

## Optional: Deploy Standalone MawdAxe To Fly

Only do this if the miner is reachable from Fly.

Good cases:

- the Bitaxe network is exposed through a private tunnel you control
- the target is not a home-only `192.168.x.x` host
- you deliberately understand the security tradeoffs

Command:

```bash
bash scripts/fly-deploy.sh mawdaxe --app solanaos-mawdaxe
```

The script refuses to deploy by default if `BITAXE_IP` or `MAWDAXE_DEVICES` points at a private RFC1918 address. That guard exists on purpose.

If you truly have private connectivity from Fly to the miner and want to bypass the guard:

```bash
bash scripts/fly-deploy.sh mawdaxe --app solanaos-mawdaxe --force-private-miner
```

## Suggested Production Shape

Best overall:

- **Fly app 1:** `solanaos-daemon`
- **Local or Tailscale host:** `mawdaxe`
- **Netlify + Convex:** `nanohub`

This gives you:

- 24/7 Telegram and trading runtime on Fly
- local miner safety and low-latency hardware control
- clean separation between public web and private hardware

## Basic Commands

```bash
# Main hosted daemon
bash scripts/fly-deploy.sh daemon --app solanaos-daemon

# Optional standalone hosted MawdAxe
bash scripts/fly-deploy.sh mawdaxe --app solanaos-mawdaxe

# Inspect app status
flyctl status -a solanaos-daemon

# Stream logs
flyctl logs -a solanaos-daemon
```

## Safety Notes

- Do not paste Fly API tokens into tracked files
- Do not expose a home Bitaxe directly to Fly without a deliberate private networking plan
- Do not run standalone MawdAxe on Fly just because it is possible; run it there only if the miner is actually reachable
- Prefer `MAWDAXE_API_BASE` from the hosted daemon to a LAN or Tailscale MawdAxe host
