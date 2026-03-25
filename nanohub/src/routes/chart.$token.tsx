import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { ArrowLeft, ExternalLink, Shield, TrendingUp, Users, Activity } from 'lucide-react'

export const Route = createFileRoute('/chart/$token')({
  head: ({ params }) => ({
    meta: [{ title: `Chart ${params.token.slice(0, 8)}... — SolanaOS Hub` }],
  }),
  component: ChartRoute,
})

// ─── Types ───────────────────────────────────────────────────────────────────

interface TokenDetail {
  token: { name: string; symbol: string; mint: string; image?: string; description?: string }
  pools: Array<{
    poolId: string
    price: { usd: number; quote: number }
    liquidity: { usd: number }
    marketCap: { usd: number }
    market: string
    tokenSupply: number
    lpBurn: number
    security: { freezeAuthority: any; mintAuthority: any }
    txns?: { buys: number; sells: number; total: number; volume: number; volume24h: number }
  }>
  events: Record<string, { priceChangePercentage: number }>
  risk: {
    top10: number
    dev: { percentage: number; amount: number }
    snipers: { count: number; totalPercentage: number }
    insiders: { count: number; totalPercentage: number }
    bundlers: { count: number; totalPercentage: number }
    rugged: boolean
    score: number
    jupiterVerified: boolean
  }
  buys: number
  sells: number
  txns: number
  holders: number
}

interface ChartBar {
  open: number; close: number; high: number; low: number; volume: number; time: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatUsd(n: number | undefined): string {
  if (!n) return '$0'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  if (n < 0.01 && n > 0) return `$${n.toFixed(8)}`
  return `$${n.toFixed(2)}`
}

function formatPct(n: number | undefined): string {
  if (n === undefined || n === null) return '0%'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}

function riskLabel(score: number): { text: string; color: string; bg: string } {
  if (score <= 3) return { text: 'Low Risk', color: '#14f195', bg: 'rgba(20,241,149,0.1)' }
  if (score <= 6) return { text: 'Medium Risk', color: '#facc15', bg: 'rgba(250,204,21,0.1)' }
  return { text: 'High Risk', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
}

function sparkline(bars: ChartBar[]): string {
  if (!bars.length) return ''
  const chars = '▁▂▃▄▅▆▇█'
  const closes = bars.map(b => b.close)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const spread = max - min || 1
  return closes.map(c => {
    const idx = Math.min(Math.floor(((c - min) / spread) * (chars.length - 1)), chars.length - 1)
    return chars[idx]
  }).join('')
}

// ─── Component ───────────────────────────────────────────────────────────────

function ChartRoute() {
  const { token: tokenAddress } = Route.useParams()
  const [tokenData, setTokenData] = useState<TokenDetail | null>(null)
  const [chartData, setChartData] = useState<ChartBar[]>([])
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('1h')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [tokenRes, chartRes] = await Promise.all([
          fetch(`/api/solana-tracker/token?address=${tokenAddress}`).then(r => r.json()),
          fetch(`/api/solana-tracker/chart?token=${tokenAddress}&type=${timeframe}`).then(r => r.json()),
        ])
        if (!cancelled) {
          setTokenData(tokenRes)
          setChartData(chartRes?.oclhv ?? [])
        }
      } catch (e) {
        console.error('Chart load error:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [tokenAddress, timeframe])

  const pool = tokenData?.pools?.[0]
  const price = pool?.price?.usd ?? 0
  const mc = pool?.marketCap?.usd ?? 0
  const liq = pool?.liquidity?.usd ?? 0
  const change24h = tokenData?.events?.['24h']?.priceChangePercentage ?? 0
  const risk = tokenData?.risk
  const riskInfo = riskLabel(risk?.score ?? 5)

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', color: '#e5e5e5', fontFamily: "'Manrope', sans-serif" }}>
      {/* Header */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <a href="/dex" style={{ color: '#71717a', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 13 }}>
            <ArrowLeft size={14} /> Back to DEX
          </a>
        </div>

        {loading && !tokenData ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#71717a' }}>Loading token data...</div>
        ) : (
          <>
            {/* Token Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              {tokenData?.token.image && (
                <img src={tokenData.token.image} alt="" style={{ width: 48, height: 48, borderRadius: 12 }} />
              )}
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: '#fff' }}>
                  {tokenData?.token.name ?? 'Unknown'}{' '}
                  <span style={{ color: '#71717a', fontWeight: 600, fontSize: 18 }}>
                    {tokenData?.token.symbol}
                  </span>
                </h1>
                <div style={{ fontSize: 13, color: '#71717a', fontFamily: "'IBM Plex Mono', monospace", marginTop: 4 }}>
                  {tokenAddress}
                </div>
              </div>
            </div>

            {/* Key Metrics Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
              <MetricCard label="Price" value={formatUsd(price)} />
              <MetricCard label="Market Cap" value={formatUsd(mc)} />
              <MetricCard label="Liquidity" value={formatUsd(liq)} />
              <MetricCard label="24h Change" value={formatPct(change24h)} color={change24h >= 0 ? '#14f195' : '#ef4444'} />
              <MetricCard label="Holders" value={tokenData?.holders?.toLocaleString() ?? '—'} icon={<Users size={14} />} />
              <MetricCard label="Transactions" value={tokenData?.txns?.toLocaleString() ?? '—'} icon={<Activity size={14} />} />
            </div>

            {/* ASCII Sparkline + Timeframe selector */}
            <div style={{
              background: 'rgba(15,15,35,0.8)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={16} style={{ color: '#14f195' }} />
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Price Chart</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        background: tf === timeframe ? 'rgba(20,241,149,0.15)' : 'rgba(255,255,255,0.04)',
                        color: tf === timeframe ? '#14f195' : '#71717a',
                      }}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sparkline */}
              <div style={{
                fontSize: 28,
                letterSpacing: 2,
                fontFamily: 'monospace',
                color: change24h >= 0 ? '#14f195' : '#ef4444',
                marginBottom: 16,
                lineHeight: 1.2,
              }}>
                {chartData.length > 0 ? sparkline(chartData.slice(-40)) : '...'}
              </div>

              {/* OHLCV Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
                  <thead>
                    <tr style={{ color: '#71717a', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <th style={{ padding: '8px 6px', textAlign: 'left' }}>Time</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>Open</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>High</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>Low</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>Close</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.slice(-10).reverse().map((bar, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '6px', color: '#9ca3af' }}>{new Date(bar.time).toLocaleTimeString()}</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{bar.open.toFixed(8)}</td>
                        <td style={{ padding: '6px', textAlign: 'right', color: '#14f195' }}>{bar.high.toFixed(8)}</td>
                        <td style={{ padding: '6px', textAlign: 'right', color: '#ef4444' }}>{bar.low.toFixed(8)}</td>
                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 600 }}>{bar.close.toFixed(8)}</td>
                        <td style={{ padding: '6px', textAlign: 'right', color: '#9ca3af' }}>{formatUsd(bar.volume)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Risk Assessment */}
            {risk && (
              <div style={{
                background: riskInfo.bg,
                border: `1px solid ${riskInfo.color}33`,
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Shield size={18} style={{ color: riskInfo.color }} />
                  <span style={{ fontWeight: 700, fontSize: 16, color: riskInfo.color }}>{riskInfo.text}</span>
                  <span style={{ fontSize: 13, color: '#9ca3af' }}>Score: {risk.score}/10</span>
                  {risk.rugged && <span style={{ background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>RUGGED</span>}
                  {risk.jupiterVerified && <span style={{ background: '#14f195', color: '#0a0a0f', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>Jupiter Verified</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: 13 }}>
                  <div>Top 10 holders: <b>{risk.top10.toFixed(2)}%</b></div>
                  <div>Dev holdings: <b>{risk.dev.percentage.toFixed(4)}%</b></div>
                  <div>Snipers: <b>{risk.snipers.count}</b> ({risk.snipers.totalPercentage.toFixed(2)}%)</div>
                  <div>Insiders: <b>{risk.insiders.count}</b> ({risk.insiders.totalPercentage.toFixed(2)}%)</div>
                  <div>Bundlers: <b>{risk.bundlers.count}</b> ({risk.bundlers.totalPercentage.toFixed(2)}%)</div>
                  <div>Freeze Auth: <b>{pool?.security?.freezeAuthority ? 'Yes' : 'None'}</b></div>
                  <div>Mint Auth: <b>{pool?.security?.mintAuthority ? 'Yes' : 'None'}</b></div>
                  <div>LP Burn: <b>{pool?.lpBurn ?? 0}%</b></div>
                </div>
              </div>
            )}

            {/* External Links */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <ExtLink href={`https://www.solanatracker.io/token/${tokenAddress}`} label="SolanaTracker" />
              <ExtLink href={`https://solscan.io/token/${tokenAddress}`} label="Solscan" />
              <ExtLink href={`https://birdeye.so/token/${tokenAddress}?chain=solana`} label="Birdeye" />
              <ExtLink href={`https://dexscreener.com/solana/${tokenAddress}`} label="DexScreener" />
              <ExtLink href={`https://jup.ag/swap/SOL-${tokenAddress}`} label="Jupiter Swap" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(15,15,35,0.8)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10,
      padding: '14px 16px',
    }}>
      <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color ?? '#fff', fontFamily: "'IBM Plex Mono', monospace" }}>
        {value}
      </div>
    </div>
  )
}

function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        color: '#9ca3af',
        fontSize: 13,
        fontWeight: 600,
        textDecoration: 'none',
      }}
    >
      {label} <ExternalLink size={12} />
    </a>
  )
}
