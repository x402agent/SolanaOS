/**
 * Solana Tracker SDK — server-side singleton.
 * Wraps the @solana-tracker/data-api REST client so the API key
 * never leaks to the browser.  All Nitro API routes import from here.
 */

const API_BASE = 'https://data.solanatracker.io'

function getApiKey(): string {
  const key =
    process.env.SOLANA_TRACKER_API_KEY ??
    process.env.SOLANA_TRACKER_DATA_API_KEY
  if (!key) throw new Error('Missing SOLANA_TRACKER_API_KEY env var')
  return key
}

function getHeliusKey(): string {
  return process.env.HELIUS_API_KEY ?? ''
}

function getHeliusRpc(): string {
  return (
    process.env.HELIUS_RPC_URL ??
    `https://mainnet.helius-rpc.com/?api-key=${getHeliusKey()}`
  )
}

/* ── Generic fetch helper ─────────────────────────────────── */

async function stFetch<T = unknown>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const url = new URL(path, API_BASE)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      'x-api-key': getApiKey(),
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SolanaTracker ${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

/* ── Helius RPC helper ────────────────────────────────────── */

async function heliusFetch<T = unknown>(
  method: string,
  params: unknown[],
): Promise<T> {
  const res = await fetch(getHeliusRpc(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const json = (await res.json()) as { result?: T; error?: { message: string } }
  if (json.error) throw new Error(`Helius: ${json.error.message}`)
  return json.result as T
}

/* ── Chart / OHLCV ────────────────────────────────────────── */

export async function getChartData(opts: {
  tokenAddress: string
  type?: string
  marketCap?: boolean
  timeTo?: number
}) {
  return stFetch(`/chart/${opts.tokenAddress}`, {
    type: opts.type ?? '1m',
    market_cap: opts.marketCap ? 'true' : undefined,
    remove_outliers: 'true',
    dynamic_pools: 'true',
    time_to: opts.timeTo,
  })
}

/* ── Token info ───────────────────────────────────────────── */

export async function getTokenInfo(address: string) {
  return stFetch(`/tokens/${address}`)
}

/* ── Token trades ─────────────────────────────────────────── */

export async function getTokenTrades(
  token: string,
  wallet?: string,
) {
  if (wallet) {
    return stFetch(`/trades/${token}/${wallet}`, { parse: 'true' })
  }
  return stFetch(`/trades/${token}`, { parse: 'true' })
}

/* ── Search ───────────────────────────────────────────────── */

export async function searchTokens(query: string, limit = 10) {
  return stFetch('/search', { query, limit })
}

/* ── Holders chart ────────────────────────────────────────── */

export async function getHoldersChart(
  token: string,
  type?: string,
  timeFrom?: number,
  timeTo?: number,
) {
  return stFetch(`/holders/${token}/chart`, {
    type: type ?? '1m',
    time_from: timeFrom,
    time_to: timeTo,
  })
}

/* ── Latest / Trending tokens ─────────────────────────────── */

export async function getLatestTokens(page = 1) {
  return stFetch('/tokens/latest', { page })
}

export async function getTrendingTokens(period = '1h') {
  return stFetch('/tokens/trending', { period })
}

/* ── Memescope: new / graduating / graduated ──────────────── */

export async function getMemescopeNew() {
  return stFetch('/tokens/new')
}

export async function getMemescopeGraduating() {
  return stFetch('/tokens/graduating')
}

export async function getMemescopeGraduated() {
  return stFetch('/tokens/graduated')
}

/* ── Rug check / token risk ───────────────────────────────── */

export async function getTokenRisk(address: string) {
  // Solana Tracker provides risk scoring on the token detail endpoint
  // We also cross-reference with rugcheck.xyz public API
  const [tokenData, rugCheckData] = await Promise.allSettled([
    stFetch(`/tokens/${address}`),
    fetchRugCheck(address),
  ])

  return {
    token: tokenData.status === 'fulfilled' ? tokenData.value : null,
    rugCheck: rugCheckData.status === 'fulfilled' ? rugCheckData.value : null,
  }
}

async function fetchRugCheck(address: string) {
  const res = await fetch(
    `https://api.rugcheck.xyz/v1/tokens/${address}/report/summary`,
    { headers: { Accept: 'application/json' } },
  )
  if (!res.ok) return null
  return res.json()
}

/* ── Wallet profile (Helius enhanced) ─────────────────────── */

export async function getWalletBalances(address: string) {
  if (!getHeliusKey()) return null
  const url = `https://api.helius.xyz/v0/addresses/${address}/balances?api-key=${getHeliusKey()}`
  const res = await fetch(url)
  if (!res.ok) return null
  return res.json()
}

export async function getWalletIdentity(address: string) {
  if (!getHeliusKey()) return null
  const url = `https://api.helius.xyz/v0/addresses/${address}/names?api-key=${getHeliusKey()}`
  const res = await fetch(url)
  if (!res.ok) return null
  return res.json()
}

/* ── Re-exports for convenience ───────────────────────────── */

export { getApiKey, getHeliusKey, getHeliusRpc, stFetch, heliusFetch }
