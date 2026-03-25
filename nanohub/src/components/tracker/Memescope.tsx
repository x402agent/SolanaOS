/**
 * Memescope — Three-column feed of new, graduating, and graduated Solana tokens.
 */
import { useState, useEffect, useCallback } from 'react'
import { solanaTrackerApi } from '../../lib/solanaTrackerApi'

interface TokenCard {
  name: string
  symbol: string
  address: string
  image?: string
  liquidity?: number
  marketCap?: number
  volume24h?: number
  priceChange24h?: number
  risk?: number
  txns?: number
  holders?: number
}

function fmt$(n: number | undefined): string {
  if (!n) return '$0'
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function fmtPct(n: number | undefined): string {
  if (!n) return '0%'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}

function RiskBadge({ score }: { score?: number }) {
  if (score === undefined || score === null) return null
  const color = score <= 3 ? 'text-green-400' : score <= 6 ? 'text-yellow-400' : 'text-red-400'
  return <span className={`text-xs font-semibold ${color}`}>Risk: {score}/10</span>
}

function Card({ token, onSelect }: { token: TokenCard; onSelect: (a: string) => void }) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg bg-[#1a1a2e]/60 border border-white/5 hover:border-white/15 cursor-pointer transition-colors"
      onClick={() => onSelect(token.address)}
    >
      <div className="flex items-center gap-3 min-w-0">
        {token.image ? (
          <img src={token.image} alt="" className="w-9 h-9 rounded-full bg-white/10 shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-purple-600/30 flex items-center justify-center text-xs font-bold text-purple-300 shrink-0">
            {token.symbol?.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0">
          <div className="font-semibold text-sm text-white truncate">{token.name || token.symbol}</div>
          <div className="text-xs text-gray-400 truncate">{token.address.slice(0, 4)}…{token.address.slice(-4)}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {token.txns !== undefined && <span>Txns: {token.txns} </span>}
            <span className={token.priceChange24h && token.priceChange24h > 0 ? 'text-green-400' : 'text-red-400'}>
              24h: {fmtPct(token.priceChange24h)}
            </span>
          </div>
        </div>
      </div>
      <div className="text-right shrink-0 ml-2">
        <RiskBadge score={token.risk} />
        <div className="text-xs text-gray-400 mt-1">
          V: {fmt$(token.volume24h)} MC: {fmt$(token.marketCap)}
        </div>
      </div>
    </div>
  )
}

function Column({ title, subtitle, tokens, loading, onSelect }: {
  title: string; subtitle: string; tokens: TokenCard[]; loading: boolean; onSelect: (a: string) => void
}) {
  return (
    <div className="flex-1 min-w-[300px] bg-[#0f0f23]/80 rounded-xl border border-white/5 overflow-hidden">
      <div className="p-4 border-b border-white/5">
        <h3 className="text-base font-bold text-white">{title}</h3>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
      <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
        {loading ? (
          <div className="text-center py-8 text-sm text-gray-500">Loading…</div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">No tokens found</div>
        ) : (
          tokens.map(t => <Card key={t.address} token={t} onSelect={onSelect} />)
        )}
      </div>
    </div>
  )
}

function normalize(arr: any[]): TokenCard[] {
  return (arr ?? []).map((t: any) => ({
    name: t.name ?? t.token?.name ?? '',
    symbol: t.symbol ?? t.token?.symbol ?? '',
    address: t.address ?? t.mint ?? t.token?.mint ?? '',
    image: t.image ?? t.token?.image ?? '',
    liquidity: t.liquidity ?? t.pools?.[0]?.liquidity?.usd,
    marketCap: t.marketCap ?? t.pools?.[0]?.marketCap?.usd,
    volume24h: t.volume24h ?? t.events?.['24h']?.volume,
    priceChange24h: t.priceChange24h ?? t.events?.['24h']?.priceChangePercentage,
    risk: t.risk?.level ?? t.risk?.score ?? t.riskLevel,
    txns: t.txns ?? t.events?.['24h']?.txCount,
    holders: t.holders,
  }))
}

export function Memescope({ onSelectToken }: { onSelectToken?: (addr: string) => void }) {
  const [data, setData] = useState<{ new: TokenCard[]; graduating: TokenCard[]; graduated: TokenCard[] }>({ new: [], graduating: [], graduated: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const handleSelect = useCallback((addr: string) => onSelectToken?.(addr), [onSelectToken])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const result = await solanaTrackerApi.getMemescope()
        if (!cancelled) {
          setData({
            new: normalize(result.new),
            graduating: normalize(result.graduating),
            graduated: normalize(result.graduated),
          })
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const iv = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])

  if (error) return <div className="text-center py-12 text-red-400 text-sm">Error: {error}</div>

  return (
    <div className="flex gap-4 w-full overflow-x-auto pb-4">
      <Column title="New Tokens" subtitle="New tokens" tokens={data.new} loading={loading} onSelect={handleSelect} />
      <Column title="Graduating" subtitle="Tokens almost ready to graduate" tokens={data.graduating} loading={loading} onSelect={handleSelect} />
      <Column title="Graduated" subtitle="Graduated tokens" tokens={data.graduated} loading={loading} onSelect={handleSelect} />
    </div>
  )
}

export default Memescope
