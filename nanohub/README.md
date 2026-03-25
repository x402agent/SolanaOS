<p align="center">
  <img src="public/clawd-logo.png" alt="NanoHub" width="120">
</p>

<h1 align="center">NanoHub</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Bun-required-14F195?style=for-the-badge" alt="Bun Required">
  <img src="https://img.shields.io/badge/Convex-Backend-7c3aed?style=for-the-badge" alt="Convex Backend">
  <img src="https://img.shields.io/badge/TanStack-Start-4b5563?style=for-the-badge" alt="TanStack Start">
</p>

NanoHub is the **registry and web hub for the NanoSolana ecosystem** (skills + soul packs). It is the UI/API layer used to publish, version, search, and install `SKILL.md` and `SOUL.md` bundles, with moderation controls and embedding-powered discovery.

> This package was previously ClawHub-branded and is now SolanaOS Hub. Tooling and some package names still use `clawhub` for compatibility.

Public routes now include the launch page, runtime catalog, pairing handoff, and the Seeker mobile dapp page at `/mobile`.

<p align="center">
  <a href="VISION.md">Vision</a> ·
  <a href="docs/README.md">Docs</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

## What NanoHub does

- Browse and render published `SKILL.md` bundles.
- Browse and render published `SOUL.md` bundles.
- Publish versioned updates with tags/changelogs.
- Search using vector embeddings (not just keyword match).
- Support moderation workflows (approve/curate/remove/restore).
- Power CLI workflows for discovery, install, publish, and sync.

## NanoSolana integration (headless node + gateway)

NanoHub docs and content are aligned with the native Go node/gateway workflow in this monorepo:

```bash
# spawn native gateway in tmux (Tailscale-aware)
./build/mawdbot node gateway-spawn

# pair a hardware node to the gateway
./build/mawdbot node pair --bridge <TAILSCALE_IP>:18790 --display-name "Orin Nano"

# run headless node client
./build/mawdbot node run --bridge <TAILSCALE_IP>:18790

# optional daemon launch-time gateway autospawn
GATEWAY_AUTO_SPAWN=true ./build/mawdbot daemon
```

Useful environment flags:

- `GATEWAY_AUTO_SPAWN=true`
- `GATEWAY_SPAWN_PORT=18790`
- `GATEWAY_USE_TAILSCALE=true`
- `NODE_BRIDGE_ADDR=127.0.0.1:18790`

## Stack (high-level)

- **Web app:** TanStack Start (React + Vite/Nitro)
- **Backend:** Convex + Convex Auth (GitHub OAuth)
- **Search:** OpenAI embeddings (`text-embedding-3-small`) + Convex vector search
- **Shared schema:** `packages/schema` (`solanaos-hub-schema`, legacy `clawhub-schema`)

## CLI workflows

Primary npm package:

- `@nanosolana/nanohub`

Quick start:

```bash
# one-off run
npx @nanosolana/nanohub --help

# login
npx @nanosolana/nanohub login

# publish a local skill folder
npx @nanosolana/nanohub publish ./my-skill \
  --slug my-skill \
  --name "My Skill" \
  --version 1.0.0 \
  --tags latest,solana
```

Global command aliases (primary + compatibility):

- `nanohub` (primary)
- `nanosolana-skill`
- `clawhub` (legacy)
- `clawdhub` (legacy)

Common commands:

- Auth: `nanohub login`, `nanohub whoami`
- Discover: `nanohub search ...`, `nanohub explore`
- Local installs: `nanohub install <slug>`, `nanohub uninstall <slug>`, `nanohub list`, `nanohub update --all`
- Inspect: `nanohub inspect <slug>`
- Publish/sync: `nanohub publish <path>`, `nanohub sync`

Docs: [`docs/quickstart.md`](docs/quickstart.md), [`docs/cli.md`](docs/cli.md).

## Local development

Prereqs: [Bun](https://bun.sh/)

```bash
bun install
cp .env.local.example .env.local

# terminal A: Convex backend
bunx convex dev

# terminal B: app (http://localhost:3000)
bun run dev

# optional seed
bunx convex run --no-push devSeed:seedNixSkills
```

For complete setup (OAuth, JWT/JWKS, env configuration), see [CONTRIBUTING.md](CONTRIBUTING.md).

## Environment

- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL`
- `VITE_SOULHUB_SITE_URL`
- `VITE_SOULHUB_HOST`
- `VITE_SITE_MODE` (`skills` or `souls`)
- `CONVEX_SITE_URL`
- `SITE_URL`
- `SENTRY_DSN` (optional, server only)
- `SENTRY_ENVIRONMENT` (optional, server only)
- `SENTRY_TRACES_SAMPLE_RATE` (optional, server only)
- `SENTRY_SEND_DEFAULT_PII` (optional, server only)
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`
- `JWT_PRIVATE_KEY` / `JWKS`
- `OPENAI_API_KEY`
- `VITE_SUPABASE_URL` (optional)
- `VITE_SUPABASE_ANON_KEY` (optional)
- `SUPABASE_URL` (optional)
- `SUPABASE_ANON_KEY` (optional)
- `SUPABASE_SERVICE_ROLE_KEY` (optional, server only)

Supabase is optional and can be used as an external persistence layer alongside Convex.

## Repo layout

- `src/` — TanStack Start app (routes/components/styles)
- `convex/` — schema + queries/mutations/actions + HTTP routes
- `packages/schema/` — shared API contract/types
- `docs/` — architecture, CLI, auth, deployment docs

## Telemetry

Install telemetry can be disabled with:

```bash
export NANOHUB_DISABLE_TELEMETRY=1
# legacy env vars also supported:
export CLAWHUB_DISABLE_TELEMETRY=1
```

See [`docs/telemetry.md`](docs/telemetry.md).

## Scripts

```bash
bun run dev
bun run build
bun run test
bun run coverage
bun run lint
```

## Production deploy (server + frontend)

NanoHub deploys in two parts: Convex backend and a Netlify-hosted frontend/runtime layer. The repo includes both the generic build flow and a Netlify-ready build target.

### 1) Prepare deploy env

```bash
cp .env.deploy.example .env.deploy
# edit .env.deploy with your production values
```

Required values:

- `CONVEX_DEPLOY_KEY`
- `CONVEX_SITE_URL`
- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL`
- `SITE_URL`

Optional:

- `VITE_APP_BUILD_SHA` (auto-inferred from git if omitted)
- `VERCEL_TOKEN` (only needed if you still use the legacy Vercel deploy helper)
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_TRACES_SAMPLE_RATE`
- `SENTRY_SEND_DEFAULT_PII`

### 2) Deploy

```bash
bun run deploy:prod
```

What this does:

1. Updates `vercel.json` API rewrite to your `CONVEX_SITE_URL`.
2. Stamps Convex deploy metadata (`APP_BUILD_SHA`, `APP_DEPLOYED_AT`).
3. Deploys Convex functions.
4. Verifies Convex contract compatibility.
5. Builds the frontend for production.

### Netlify frontend build

The current Netlify production build path is:

```bash
bun run build:netlify
```

That command:

1. Generates the SolanaOS runtime catalog.
2. Builds the TanStack/Nitro app.
3. Emits `dist/_redirects` so routes like `/mobile`, `/solanaos`, and `/pair` resolve through the Netlify server function.

If you only need to update the rewrite destination:

```bash
bun run deploy:prep -- https://<your-convex-deployment>.convex.site
```

---

## Netlify Deploy Notes

- **Lambda env var limit**: 4KB. Keep runtime vars minimal. `VITE_*` vars are scoped to builds context only — they are baked into client JS at build time and do not need to be in the Lambda runtime.
- **Edge Functions**: Used for `agent-chat` and `st-*` (Solana Tracker) endpoints. No env var limit.
- **Handler patch**: `scripts/patch-netlify-handler.mjs` buffers Nitro responses and removes streaming mode to prevent `\x00` byte issues in Netlify Functions.
- **Redirects**: All non-static paths route to `/.netlify/functions/server` (SSR).

### Env var scoping

Build-only vars (`--context builds`): `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, `VITE_SUPABASE_URL`, `VITE_PHANTOM_APP_ID`, `VITE_SOULHUB_HOST`, `VITE_SOULHUB_SITE_URL`, `VITE_SITE_MODE`, `VITE_WS_URL`, `VITE_SOLANA_TRACKER_WS_URL`, `CONVEX_DEPLOY_KEY`, `NODE_VERSION`.

Runtime vars (available in Functions): `JWT_PRIVATE_KEY`, `JWKS`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_URL`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `CONVEX_URL`, `CONVEX_SITE_URL`, `CONVEX_DEPLOYMENT`, `HELIUS_API_KEY`, `HELIUS_RPC_URL`, `XAI_API_KEY`, `OPENROUTER_API_KEY`, `SOLANA_TRACKER_API_KEY`, `TELEGRAM_BOT_TOKEN`, `SITE_URL`, `SOLANA_PRIVATE_KEY`.

---

## Pump.fun Token Scanner

Automated pipeline that scrapes pump.fun, classifies tokens by tier, stores results in Convex, and serves them to the frontend.

### Architecture

```
pump.fun/board  ──►  Scanner (Chrome MCP)  ──►  pump.md
                                                    │
                                          push_pump_to_convex.py
                                                    │
                                                    ▼
                                        Convex (pumpTokenScans table)
                                                    │
                          ┌─────────────────────────┤
                          ▼                         ▼
               Edge Function                  PumpScanner.tsx
            /st/pump-scan (Netlify)          (frontend component)
            tries Convex first,
            falls back to GeckoTerminal
```

### Data flow

1. **Scan** — Browser-based scraper collects ~100 tokens from pump.fun/board (Movers tab, 3 pages)
2. **Write** — Results saved to `pump.md` as a markdown table
3. **Push** — `scripts/push_pump_to_convex.py` parses pump.md and POSTs to the Convex ingest endpoint
4. **Serve** — Edge function at `/st/pump-scan` reads from Convex (fast, ~50ms) or falls back to GeckoTerminal (slow, ~8s)
5. **Display** — `PumpScanner.tsx` renders the data with tier-based color coding

### Token classification tiers

| Tier | Criteria | Action |
|------|----------|--------|
| `fresh-sniper` | Age ≤5m & MC <$5K, or age ≤15m & bonding ≥50% | SNIPE / BUY |
| `near-graduation` | Bonding ≥90% | AVOID |
| `large-cap` | MC >$100K | HOLD / SCALP / SKIP |
| `mid-cap` | MC $10K–$100K | WATCH |
| `micro-cap` | MC <$10K | SPECULATIVE |

### Usage

```bash
# After running the scanner and generating pump.md:
python3 scripts/push_pump_to_convex.py browser

# Force GeckoTerminal fallback (bypass Convex):
curl "https://solanaos.net/st/pump-scan?source=gecko"

# Query scan history:
# Via Convex dashboard or frontend using pumpTokens.scanHistory query
```

### API endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/nanosolana/tracker/pump-ingest` | POST | Ingest a scan batch (raw pipe-delimited or pre-classified JSON) |
| `/nanosolana/tracker/pump-scan` | GET | Latest scan from Convex (supports `?maxAge=` in ms) |
| `/st/pump-scan` | GET | Edge function — Convex-first, GeckoTerminal fallback. `?source=gecko` to force fallback |

### Key files

| File | Purpose |
|------|---------|
| `convex/pumpTokens.ts` | Mutations, queries, and HTTP handlers for scan ingestion/retrieval |
| `convex/schema.ts` | `pumpTokenScans` table definition with `by_scanned_at` and `by_source` indexes |
| `netlify/edge-functions/st-pump-scan.ts` | Edge function serving scanner data (Convex-first) |
| `src/components/tracker/PumpScanner.tsx` | Frontend component rendering the token table |
| `scripts/push_pump_to_convex.py` | Post-scan script to push pump.md data into Convex |

### Environment variables

- `CONVEX_SITE_URL` / `VITE_CONVEX_SITE_URL` — Used by the edge function to reach Convex
- `SOLANA_TRACKER_API_KEY` — Optional, enriches GeckoTerminal fallback with trending data

---

## Skills Catalog

The catalog is auto-generated from the monorepo's `skills/` and `pkg/` directories.

```bash
bun run generate:solanaos-catalog
```

This scans the source directories and produces:
- `src/lib/generated/solanaosCatalog.ts` — TypeScript catalog with 59 packages and 86 skills
- `public/downloads/skills/*.zip` — Compressed skill archives for download

The catalog includes metadata, download URLs, install commands (`npx`/`pnpm dlx`/`bunx`), source links, and file counts for each skill.

---

## Skill NFT Minting (Metaplex Core + 8004 Agent Registry)

Each SolanaOS skill can be minted as an NFT on Solana mainnet using Metaplex Core, with optional registration in the 8004 Trustless Agent Registry.

### Architecture

```
User connects Phantom wallet (mainnet)
    |
    v
Creates "SolanaOS Skills" collection (Metaplex Core Collection)
    |
    v
For each of the 86 skills:
  1. Client builds Metaplex Core NFT transaction
     - Name: "SolanaOS: {skill-name}"
     - URI:  https://solanaos.net/api/skills/nft-metadata/{skill-name}
     - Collection: the created collection
  2. Phantom wallet signs + sends (~0.003 SOL per mint)
  3. Server registers in 8004 Agent Registry (~0.006 SOL, factory wallet)
     - POST /api/skills/register-8004
     - Uses buildRegistrationFileJson() with ServiceType.MCP, WALLET, A2A
     - Enables ATOM reputation engine
     - Transfers 8004 asset ownership to user wallet
```

### Minting page

Navigate to `/setup/mint-skills` to access the minting UI. Features:

- **Wallet connection** — Uses the connected Phantom wallet as the minting authority and payer
- **Collection management** — Create a new Metaplex Core collection or use an existing address
- **8004 toggle** — Enable/disable 8004 Agent Registry registration (on by default)
- **Batch minting** — "Mint All" with abort capability and rate-limit delays
- **Per-skill controls** — Individual Mint/Retry buttons with real-time status
- **Progress tracking** — Shows minting/registering/done/error state per skill
- **Explorer links** — Click through to Solana Explorer for each minted NFT and 8004 asset

### Cost estimate

| Operation | Per Skill | Total (86 skills) |
|-----------|-----------|-------------------|
| Metaplex Core NFT mint | ~0.003 SOL | ~0.26 SOL |
| 8004 Agent Registry | ~0.006 SOL | ~0.52 SOL |
| **Total** | **~0.009 SOL** | **~0.78 SOL** |

### NFT Metadata API

Each skill's NFT metadata is served as standard Metaplex JSON from the server:

```
GET /api/skills/nft-metadata/{skill-name}
GET /api/skills/nft-metadata/collection
```

Example response for `/api/skills/nft-metadata/browse`:

```json
{
  "name": "SolanaOS: browse",
  "symbol": "SKILL",
  "description": "browse - an AI agent skill from the SolanaOS ecosystem.",
  "image": "https://solanaos.net/og.png",
  "external_url": "https://seeker.solanaos.net/solanaos#skill-browse",
  "attributes": [
    { "trait_type": "Category", "value": "AI Agent Skill" },
    { "trait_type": "Skill Name", "value": "browse" },
    { "trait_type": "File Count", "value": "3" },
    { "trait_type": "Size Bytes", "value": "5432" }
  ],
  "properties": {
    "files": [{ "uri": "https://seeker.solanaos.net/downloads/skills/browse.zip", "type": "application/zip" }]
  }
}
```

### 8004 Agent Registry integration

The server endpoint `POST /api/skills/register-8004` handles registration after each Metaplex mint:

```json
// Request
{ "skillName": "browse", "metaplexAssetAddress": "Base58...", "ownerWallet": "Base58..." }

// Response
{ "success": true, "assetAddress": "Base58...", "txSignature": "hex...", "explorerUrl": "https://explorer.solana.com/address/...", "metadataUri": "https://solanaos.net/api/skills/nft-metadata/browse" }
```

To enable 8004 registration on deploy, set the factory wallet key:

```bash
netlify env:set SOLANA_PRIVATE_KEY '[1,2,3,...your 64-byte secret key array]'
```

### On-chain programs used

| Program | Package | Purpose |
|---------|---------|---------|
| Metaplex Core | `@metaplex-foundation/mpl-core` | NFT creation + collections |
| Metaplex Umi | `@metaplex-foundation/umi` | Transaction building + signing |
| Metaplex Agent Registry | `@metaplex-foundation/mpl-agent-registry` | Agent identity + execution delegation |
| 8004 Trustless Agent Registry | `8004-solana` | Agent registration, ATOM reputation, feedback |

### Key files

| File | Purpose |
|------|---------|
| `src/routes/setup/mint-skills.tsx` | Minting UI page with Phantom + Umi integration |
| `server/routes/api/skills/nft-metadata/[name].get.ts` | Per-skill NFT metadata JSON endpoint |
| `server/routes/api/skills/nft-metadata/collection.get.ts` | Collection metadata JSON endpoint |
| `server/routes/api/skills/register-8004.post.ts` | 8004 Agent Registry server endpoint |
| `convex/nanosolanaAgentsNode.ts` | Existing agent registration (Convex actions) |
| `scripts/generate-solanaos-catalog.mjs` | Skills catalog generator |
