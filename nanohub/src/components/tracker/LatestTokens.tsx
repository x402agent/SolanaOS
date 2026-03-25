/**
 * LatestTokens — Paginated table of the newest Solana tokens.
 */
import { useState, useEffect } from 'react'
import { solanaTrackerApi } from '../../lib/solanaTrackerApi'

function fmt$(n: number | undefined): string {
  if (!n) return '$0'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

function fmtPrice(n: number | undefined): string {
  if (!n) return '$0'
  if (n < 0.000001) return `$${n.toExponential(2)}`
  if (n < 0.01) return `$${n.toFixed(8)}`
  if (n < 1) return `$${n.toFixed(6)}`
  return `$${n.toFixed(4)}`
}

function fmtPct(n: number | undefined): string {
  if (!n) return '0%'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}

function RiskBadge({ score }: { score?: number }) {
  if (score === undefined || score === null) return <span className="text-xs text-gray-500">—</span>
  const color = score <= 3 ? 'text-green-400' : score <= 6 ? 'text-yellow-400' : 'text-red-400'
  return <span className={`text-xs font-semibold ${color}`}>{score}/10</span>
}

interface Token {
  name: string
  symbol: string
  address: string
  image?: string
  price?: number
  liquidity?: number
  marketCap?: number
  priceChangeLive?: number
  priceChange24h?: number
  risk?: number
}

function normalize(arr: any[]): Token[] {
  return (arr ?? []).map((t: any) => ({
    name: t.name ?? t.token?.name ?? '',
    symbol: t.symbol ?? t.token?.symbol ?? '',
    address: t.address ?? t.mint ?? t.token?.mint ?? '',
    image: t.image ?? t.token?.image ?? '',
    price: t.price ?? t.pools?.[0]?.price?.usd ?? t.token?.price,
    liquidity: t.liquidity ?? t.pools?.[0]?.liquidity?.usd,
    marketCap: t.marketCap ?? t.pools?.[0]?.marketCap?.usd,
    priceChangeLive: t.events?.['1h']?.priceChangePercentage ?? 0,
    priceChange24h: t.events?.['24h']?.priceChangePercentage ?? 0,
    risk: t.risk?.level ?? t.risk?.score ?? t.riskLevel,
  }))
}

export function LatestTokens({ onSelectToken }: { onSelectToken?: (addr: string) => void }) {
  const [tokens, setTokens] = useState<Token[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await solanaTrackerApi.getLatest(page) as any
        if (!cancelled) {
          const arr = Array.isArray(data) ? data : data?.tokens ?? data?.data ?? []
          setTokens(normalize(arr))
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [page])

  if (error) return <div className="text-center py-12 text-red-400 text-sm">Error: {error}</div>

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Latest Tokens</h2>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 text-xs font-medium rounded bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-30"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span className="text-xs text-gray-500">Page {page}</span>
          <button
            className="px-3 py-1 text-xs font-medium rounded bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors"
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </button>
        </div>
      </div>

      <div className="bg-[#0f0f23]/80 rounded-xl border border-white/5 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px_100px] gap-2 px-4 py-2.5 text-xs text-gray-500 font-semibold border-b border-white/5">
          <span>Token Info</span>
          <span>Liquidity</span>
          <span>Market Cap</span>
          <span>Price</span>
          <span>24h Change</span>
          <span>Risk</span>
          <span>Actions</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-sm text-gray-500">Loading…</div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-500">No tokens found</div>
        ) : (
          tokens.map((t, i) => (
            <div
              key={t.address || i}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px_100px] gap-2 px-4 py-3 items-center border-b border-white/3 hover:bg-white/[.02] transition-colors"
            >
              {/* Token Info */}
              <div className="flex items-center gap-2.5 min-w-0">
                {t.image ? (
                  <img src={t.image} alt="" className="w-8 h-8 rounded-full bg-white/10 shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center text-xs font-bold text-purple-300 shrink-0">
                    {t.symbol?.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{t.name || t.symbol}</div>
                  <div className="text-xs text-gray-500 font-mono truncate">{t.address.slice(0, 6)}…{t.address.slice(-4)}</div>
                </div>
              </div>
              {/* Liquidity */}
              <span className="text-sm text-gray-300">{fmt$(t.liquidity)}</span>
              {/* Market Cap */}
              <span className="text-sm text-gray-300">{fmt$(t.marketCap)}</span>
              {/* Price */}
              <span className="text-sm text-gray-300">{fmtPrice(t.price)}</span>
              {/* 24h Change */}
              <span className={`text-sm font-medium ${(t.priceChange24h ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtPct(t.priceChange24h)}
              </span>
              {/* Risk */}
              <RiskBadge score={t.risk} />
              {/* Actions */}
              <div className="flex gap-1.5">
                <button
                  className="px-2 py-1 text-xs rounded bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                  onClick={() => onSelectToken?.(t.address)}
                >
                  Chart
                </button>
                <a
                  href={`https://solscan.io/token/${t.address}`}
                  target="_blank"
                  rel="noopener"
                  className="px-2 py-1 text-xs rounded bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  Info
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default LatestTokens
