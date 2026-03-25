/**
 * pumpTokens — Convex functions for ingesting & serving pump.fun scanner data.
 *
 * Data flow:
 *   Scanner (browser/CLI/remote) → POST /nanosolana/tracker/pump-scan → ingestScan mutation
 *   Edge function (st-pump-scan)  → GET  /nanosolana/tracker/pump-scan → latestScan query
 *   Frontend (PumpScanner.tsx)    → GET  /st/pump-scan                → edge fn reads Convex
 */
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { httpAction } from './functions'
import { corsHeaders, mergeHeaders } from './lib/httpHeaders'

// ── Helpers ─────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: mergeHeaders(corsHeaders(), {
      'Content-Type': 'application/json',
    }),
  })
}

function options(methods: string) {
  return new Response(null, {
    status: 204,
    headers: mergeHeaders(corsHeaders(), {
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }),
  })
}

// ── Classification ──────────────────────────────────────────────────

function classifyToken(t: {
  marketCap?: number | null
  ageMinutes?: number | null
  bondingPct?: number | null
}): { tier: string; action: string } {
  const mc = t.marketCap ?? 0
  const age = t.ageMinutes ?? 9999
  const bonding = t.bondingPct ?? 0

  if (bonding >= 90) return { tier: 'near-graduation', action: 'AVOID' }
  if (age <= 5 && mc < 5000) return { tier: 'fresh-sniper', action: 'SNIPE' }
  if (age <= 15 && bonding >= 50) return { tier: 'fresh-sniper', action: 'BUY' }
  if (mc > 1_000_000) return { tier: 'large-cap', action: 'SKIP' }
  if (mc > 500_000 && age < 120) return { tier: 'large-cap', action: 'SCALP' }
  if (mc > 100_000) return { tier: 'large-cap', action: 'HOLD' }
  if (mc > 10_000) return { tier: 'mid-cap', action: 'WATCH' }
  return { tier: 'micro-cap', action: 'SPECULATIVE' }
}

/** Parse pump.fun age strings like "3m ago", "2h ago", "5d ago", "22s ago" */
function parseAgeMinutes(raw?: string | null): number | null {
  if (!raw || raw === 'N/A') return null
  const m = raw.match(/^(\d+)([smhd])\s*ago$/i)
  if (!m) return null
  const val = parseInt(m[1])
  switch (m[2].toLowerCase()) {
    case 's':
      return Math.max(0, Math.round(val / 60))
    case 'm':
      return val
    case 'h':
      return val * 60
    case 'd':
      return val * 1440
    default:
      return null
  }
}

/** Parse market cap strings like "$112.4K", "$3.2M", "$83.2M" */
function parseMc(raw?: string | null): number | null {
  if (!raw || raw === 'N/A') return null
  const s = raw.replace('$', '').replace(/,/g, '')
  if (s.endsWith('M')) return parseFloat(s.slice(0, -1)) * 1e6
  if (s.endsWith('K')) return parseFloat(s.slice(0, -1)) * 1e3
  if (s.endsWith('B')) return parseFloat(s.slice(0, -1)) * 1e9
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

// ── Mutation: Ingest a scan batch ───────────────────────────────────

const tokenValidator = v.object({
  rank: v.number(),
  name: v.string(),
  symbol: v.string(),
  mint: v.string(),
  marketCap: v.optional(v.number()),
  fdv: v.optional(v.number()),
  volume24h: v.optional(v.number()),
  priceChange24h: v.optional(v.number()),
  liquidity: v.optional(v.number()),
  bondingPct: v.optional(v.number()),
  ageMinutes: v.optional(v.number()),
  ageRaw: v.optional(v.string()),
  tier: v.string(),
  action: v.string(),
  trending: v.optional(v.boolean()),
})

export const ingestScanInternal = internalMutation({
  args: {
    source: v.string(),
    tokens: v.array(tokenValidator),
    scannerAgent: v.optional(v.string()),
    scannedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const tokens = args.tokens.slice(0, 100)

    // Compute tier counts
    const tiers = {
      freshSniper: tokens.filter((t) => t.tier === 'fresh-sniper').length,
      nearGraduation: tokens.filter((t) => t.tier === 'near-graduation').length,
      microCap: tokens.filter((t) => t.tier === 'micro-cap').length,
      midCap: tokens.filter((t) => t.tier === 'mid-cap').length,
      largeCap: tokens.filter((t) => t.tier === 'large-cap').length,
    }

    const id = await ctx.db.insert('pumpTokenScans', {
      source: args.source,
      tokenCount: tokens.length,
      tokens,
      tiers,
      scannerAgent: args.scannerAgent,
      scannedAt: args.scannedAt ?? now,
      createdAt: now,
    })

    return { id, tokenCount: tokens.length, tiers }
  },
})

// ── Query: Get the latest scan ──────────────────────────────────────

export const latestScanInternal = internalQuery({
  args: {
    maxAgeMs: v.optional(v.number()), // default 30 min
  },
  handler: async (ctx, args) => {
    const maxAge = args.maxAgeMs ?? 30 * 60 * 1000
    const cutoff = Date.now() - maxAge

    const scan = await ctx.db
      .query('pumpTokenScans')
      .withIndex('by_scanned_at')
      .order('desc')
      .first()

    if (!scan || scan.scannedAt < cutoff) return null

    return {
      tokens: scan.tokens,
      total: scan.tokenCount,
      timestamp: new Date(scan.scannedAt).toISOString(),
      sources: [scan.source],
      scannerAgent: scan.scannerAgent,
      tiers: scan.tiers,
    }
  },
})

// ── Public query: Get the latest scan (for frontend use) ────────────

export const latestScan = query({
  args: {
    maxAgeMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxAge = args.maxAgeMs ?? 30 * 60 * 1000
    const cutoff = Date.now() - maxAge

    const scan = await ctx.db
      .query('pumpTokenScans')
      .withIndex('by_scanned_at')
      .order('desc')
      .first()

    if (!scan || scan.scannedAt < cutoff) return null

    return {
      tokens: scan.tokens,
      total: scan.tokenCount,
      timestamp: new Date(scan.scannedAt).toISOString(),
      sources: [scan.source],
      scannerAgent: scan.scannerAgent,
      tiers: scan.tiers,
    }
  },
})

// ── Query: Scan history (last N scans, lightweight) ─────────────────

export const scanHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 10, 50)
    const scans = await ctx.db
      .query('pumpTokenScans')
      .withIndex('by_scanned_at')
      .order('desc')
      .take(limit)

    return scans.map((s) => ({
      id: s._id,
      source: s.source,
      tokenCount: s.tokenCount,
      tiers: s.tiers,
      scannedAt: new Date(s.scannedAt).toISOString(),
    }))
  },
})

// ── HTTP Handlers ───────────────────────────────────────────────────

/**
 * POST /nanosolana/tracker/pump-ingest
 * Accepts raw pump.md-style pipe-delimited rows OR pre-classified Token[].
 *
 * Body format A (pre-classified):
 *   { source: string, tokens: Token[], scannerAgent?: string }
 *
 * Body format B (raw from pump.md):
 *   { source: string, raw: "1|name|sym|mint|$5K|3m ago|45%" }
 */
export const pumpIngestHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('POST, OPTIONS')
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: any
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  const source = body.source || 'unknown'
  const scannerAgent = body.scannerAgent || undefined
  const scannedAt = body.scannedAt ? Number(body.scannedAt) : undefined

  let tokens: Array<{
    rank: number
    name: string
    symbol: string
    mint: string
    marketCap?: number
    fdv?: number
    volume24h?: number
    priceChange24h?: number
    liquidity?: number
    bondingPct?: number
    ageMinutes?: number
    ageRaw?: string
    tier: string
    action: string
    trending?: boolean
  }>

  if (body.tokens && Array.isArray(body.tokens)) {
    // Format A: pre-classified
    tokens = body.tokens.slice(0, 100)
  } else if (body.raw && typeof body.raw === 'string') {
    // Format B: pipe-delimited rows from pump.md
    const lines = body.raw.trim().split('\n')
    tokens = lines.slice(0, 100).map((line: string) => {
      const [rankStr, name, symbol, mint, mcRaw, ageRaw, pctRaw] = line.split('|')
      const mc = parseMc(mcRaw)
      const ageMinutes = parseAgeMinutes(ageRaw)
      const bondingPct = pctRaw ? parseFloat(pctRaw.replace('%', '')) : undefined
      const { tier, action } = classifyToken({ marketCap: mc, ageMinutes, bondingPct })
      return {
        rank: parseInt(rankStr) || 0,
        name: name?.trim() || '',
        symbol: symbol?.trim() || '',
        mint: mint?.trim() || '',
        marketCap: mc ?? undefined,
        ageMinutes: ageMinutes ?? undefined,
        ageRaw: ageRaw?.trim(),
        bondingPct: isNaN(bondingPct!) ? undefined : bondingPct,
        tier,
        action,
      }
    })
  } else {
    return json({ error: 'body must contain "tokens" array or "raw" string' }, 400)
  }

  if (tokens.length === 0) {
    return json({ error: 'no tokens provided' }, 400)
  }

  const result = await ctx.runMutation(
    internal.pumpTokens.ingestScanInternal,
    { source, tokens, scannerAgent, scannedAt },
  )

  return json({ status: 'ok', ...result })
})

/**
 * GET /nanosolana/tracker/pump-scan
 * Returns the latest scan from Convex (same format as /st/pump-scan).
 */
export const pumpScanHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') return options('GET, OPTIONS')
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405)

  const url = new URL(request.url)
  const maxAgeMs = parseInt(url.searchParams.get('maxAge') ?? '') || 30 * 60 * 1000

  const scan = await ctx.runQuery(
    internal.pumpTokens.latestScanInternal,
    { maxAgeMs },
  )

  if (!scan) {
    return json({ error: 'no recent scan available', stale: true }, 404)
  }

  return new Response(JSON.stringify(scan), {
    status: 200,
    headers: mergeHeaders(corsHeaders(), {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=120', // 2 min cache
    }),
  })
})
