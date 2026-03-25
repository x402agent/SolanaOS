/**
 * Client-side API service for Solana Tracker features.
 * All calls go through our Nitro server routes so API keys stay server-side.
 */

const BASE = '/api/solana-tracker'

async function fetchJson<T = unknown>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    }
  }
  const res = await fetch(url.toString())
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export const solanaTrackerApi = {
  // Chart OHLCV data
  getChart: (token: string, type = '1m', marketCap = false, timeTo?: number) =>
    fetchJson('/chart', { token, type, marketCap, timeTo }),

  // Token info/detail
  getToken: (address: string) =>
    fetchJson('/token', { address }),

  // Token trades (optionally filtered by wallet)
  getTrades: (token: string, wallet?: string) =>
    fetchJson('/trades', { token, wallet }),

  // Search tokens
  search: (query: string, limit = 10) =>
    fetchJson('/search', { query, limit }),

  // Holders chart
  getHoldersChart: (token: string, type = '1m', timeFrom?: number, timeTo?: number) =>
    fetchJson('/holders-chart', { token, type, timeFrom, timeTo }),

  // Latest tokens
  getLatest: (page = 1) =>
    fetchJson('/latest', { page }),

  // Trending tokens
  getTrending: (period = '1h') =>
    fetchJson('/trending', { period }),

  // Memescope (new, graduating, graduated)
  getMemescope: () =>
    fetchJson<{ new: any[]; graduating: any[]; graduated: any[] }>('/memescope'),

  // Rug check / risk score
  getRugCheck: (address: string) =>
    fetchJson('/rugcheck', { address }),

  // Wallet info (balances + identity)
  getWallet: (address: string) =>
    fetchJson('/wallet', { address }),

  // Get WebSocket URL for datastream
  getWsUrl: () =>
    fetchJson<{ wsUrl: string }>('/ws'),
}
