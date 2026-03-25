/**
 * PumpScanner — Displays the top 100 pump.fun tokens from the scanner pipeline.
 * Fetches from /st/pump-scan edge function (GeckoTerminal + Solana Tracker).
 */
import { Suspense, lazy, useCallback, useEffect, useState } from 'react'

const AgentStatus = lazy(() => import('./AgentStatus'))

interface Token {
  rank: number
  name: string
  symbol: string
  mint: string
  marketCap: number | null
  fdv: number | null
  volume24h: number | null
  priceChange24h: number | null
  liquidity: number | null
  ageMinutes: number | null
  tier: string
  action: string
  trending?: boolean
}

interface ScanResult {
  tokens: Token[]
  total: number
  timestamp: string
  sources: string[]
  scannerAgent?: string
  tiers: {
    freshSniper: number
    nearGraduation: number
    microCap: number
    midCap: number
    largeCap: number
  }
}

function fmt$(n: number | null | undefined): string {
  if (!n) return '-'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

function fmtAge(minutes: number | null): string {
  if (minutes === null) return '-'
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`
  return `${(minutes / 1440).toFixed(1)}d`
}

function fmtPct(n: number | null): string {
  if (n === null) return '-'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

const tierColors: Record<string, string> = {
  'fresh-sniper': 'text-green-400',
  'near-graduation': 'text-yellow-400',
  'micro-cap': 'text-blue-400',
  'mid-cap': 'text-purple-400',
  'large-cap': 'text-white',
}

const actionColors: Record<string, string> = {
  SNIPE: 'bg-green-500/20 text-green-400',
  BUY: 'bg-green-500/20 text-green-300',
  SCALP: 'bg-yellow-500/20 text-yellow-400',
  WATCH: 'bg-blue-500/20 text-blue-400',
  HOLD: 'bg-purple-500/20 text-purple-400',
  AVOID: 'bg-red-500/20 text-red-400',
  SKIP: 'bg-gray-500/20 text-gray-500',
  SPECULATIVE: 'bg-orange-500/20 text-orange-400',
}

export function PumpScanner({ onSelectToken }: { onSelectToken?: (mint: string) => void }) {
  const [data, setData] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  const fetchScan = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/st/pump-scan?pages=3')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = await resp.json()
      setData(json)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchScan() }, [fetchScan])

  const filtered = data?.tokens.filter(t => {
    if (filter === 'all') return true
    return t.tier === filter
  }) ?? []

  if (loading) {
    return <div className="text-center py-12 text-gray-500 text-sm">Scanning pump.fun tokens...</div>
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 text-sm mb-2">Scanner error: {error}</p>
        <button onClick={fetchScan} className="text-xs text-blue-400 hover:underline">Retry</button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-3">
      {/* Agent reputation status */}
      <Suspense fallback={null}>
        <AgentStatus assetAddress={data?.scannerAgent} />
      </Suspense>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {data.total} tokens · {data.sources.join(' + ')} · {new Date(data.timestamp).toLocaleTimeString()}
        </div>
        <button
          onClick={fetchScan}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Tier filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { key: 'all', label: `All (${data.total})` },
          { key: 'fresh-sniper', label: `Fresh (${data.tiers.freshSniper})` },
          { key: 'near-graduation', label: `Graduating (${data.tiers.nearGraduation})` },
          { key: 'micro-cap', label: `Micro (${data.tiers.microCap})` },
          { key: 'mid-cap', label: `Mid (${data.tiers.midCap})` },
          { key: 'large-cap', label: `Large (${data.tiers.largeCap})` },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f.key
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-white/5 text-gray-400 border border-transparent hover:bg-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Token table */}
      <div className="overflow-x-auto rounded-lg border border-white/5">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-white/5">
              <th className="text-left px-3 py-2 font-medium">#</th>
              <th className="text-left px-3 py-2 font-medium">Token</th>
              <th className="text-right px-3 py-2 font-medium">Market Cap</th>
              <th className="text-right px-3 py-2 font-medium">Vol 24h</th>
              <th className="text-right px-3 py-2 font-medium">Change</th>
              <th className="text-right px-3 py-2 font-medium">Liquidity</th>
              <th className="text-right px-3 py-2 font-medium">Age</th>
              <th className="text-center px-3 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr
                key={t.mint}
                className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer transition-colors"
                onClick={() => onSelectToken?.(t.mint)}
              >
                <td className="px-3 py-2 text-gray-500">{t.rank}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className={`font-medium ${tierColors[t.tier] ?? 'text-white'}`}>
                        {t.name || t.symbol || t.mint.slice(0, 8)}
                        {t.trending && <span className="ml-1 text-yellow-500" title="Trending">*</span>}
                      </div>
                      <div className="text-gray-600 font-mono">{t.symbol}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-white">{fmt$(t.marketCap)}</td>
                <td className="px-3 py-2 text-right text-gray-400">{fmt$(t.volume24h)}</td>
                <td className={`px-3 py-2 text-right ${(t.priceChange24h ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtPct(t.priceChange24h)}
                </td>
                <td className="px-3 py-2 text-right text-gray-400">{fmt$(t.liquidity)}</td>
                <td className="px-3 py-2 text-right text-gray-400">{fmtAge(t.ageMinutes)}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${actionColors[t.action] ?? 'bg-gray-500/20 text-gray-400'}`}>
                    {t.action}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PumpScanner
