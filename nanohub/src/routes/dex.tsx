import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { Search, TrendingUp, Shield, Activity, ExternalLink, Lock } from 'lucide-react'
import { useAuthStatus } from '../lib/useAuthStatus'

export const Route = createFileRoute('/dex')({
  head: () => ({ meta: [{ title: 'DEX — SolanaOS Hub' }] }),
  component: DexRouteGuard,
})

function DexRouteGuard() {
  const { isAuthenticated, isLoading } = useAuthStatus()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#71717a' }}>
        Loading…
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', gap: '1.5rem', color: '#e4e4e7', textAlign: 'center', padding: '2rem',
      }}>
        <Lock size={48} style={{ color: '#14f195', opacity: 0.7 }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-display, Manrope, sans-serif)' }}>
          Sign in to access DEX
        </h2>
        <p style={{ color: '#71717a', maxWidth: '28rem', lineHeight: 1.6 }}>
          Connect your Solana wallet and sign in to access Memescope, live token data, rugcheck analysis, and trending tokens.
        </p>
        <Link to="/dashboard" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1.5rem', borderRadius: '0.5rem',
          background: '#14f195', color: '#0a0a0f', fontWeight: 700, fontSize: '0.875rem',
          textDecoration: 'none',
        }}>
          Connect Wallet
        </Link>
      </div>
    )
  }

  return <DexRoute />
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface TokenCard {
  name: string
  symbol: string
  address: string
  image?: string
  liquidity?: number
  marketCap?: number
  price?: number
  volume24h?: number
  priceChange24h?: number
  priceChangeLive?: number
  risk?: number
  txns?: number
  holders?: number
}

interface RugCheckData {
  address: string
  name?: string
  symbol?: string
  image?: string
  liquidity?: number
  marketCap?: number
  totalSupply?: number
  riskScore?: number
  riskLevel?: string
  topHolders?: Array<{ address: string; percent: number }>
  lpLocked?: number
  mintAuthority?: string
  freezeAuthority?: string
  risks?: Array<{ label: string; level: string }>
}

type TabId = 'memescope' | 'latest' | 'rugcheck' | 'trending'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNum(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function formatNum(v: unknown): string {
  const n = toNum(v)
  if (n === null) return '—'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toFixed(2)
}

function formatUsd(v: unknown): string {
  const n = toNum(v)
  if (n === null) return '$0'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  if (n < 0.01 && n > 0) return `$${n.toFixed(6)}`
  return `$${n.toFixed(2)}`
}

function formatPercent(v: unknown): string {
  const n = toNum(v)
  if (n === null) return '0%'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}

function truncAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function riskColor(score: number | undefined): string {
  if (score === undefined) return 'text-gray-500'
  if (score <= 3) return 'text-[#14f195]'
  if (score <= 6) return 'text-yellow-400'
  return 'text-red-400'
}

function riskBg(score: number | undefined): string {
  if (score === undefined) return 'bg-gray-800/30'
  if (score <= 3) return 'bg-[#14f195]/10'
  if (score <= 6) return 'bg-yellow-900/20'
  return 'bg-red-900/20'
}

function normalize(t: Record<string, unknown>): TokenCard {
  const tok = (t.token ?? t) as Record<string, unknown>
  const pools = (t.pools ?? []) as Record<string, unknown>[]
  const pool = pools[0] as Record<string, unknown> | undefined
  const events = (t.events ?? {}) as Record<string, unknown>
  const risk = (t.risk ?? {}) as Record<string, unknown>
  const liq = pool?.liquidity as Record<string, unknown> | undefined
  const mc = pool?.marketCap as Record<string, unknown> | undefined
  const pr = pool?.price as Record<string, unknown> | undefined
  const txns = pool?.txns as Record<string, unknown> | undefined
  const ev24 = events['24h'] as Record<string, unknown> | undefined
  const ev1m = events['1m'] as Record<string, unknown> | undefined
  return {
    name: (tok.name as string) ?? '',
    symbol: (tok.symbol as string) ?? '',
    address: (tok.mint as string) ?? (tok.address as string) ?? '',
    image: (tok.image as string) ?? '',
    liquidity: toNum(liq?.usd),
    marketCap: toNum(mc?.usd),
    price: toNum(pr?.usd ?? pr?.quote),
    volume24h: toNum(txns?.volume24h),
    priceChange24h: toNum(ev24?.priceChangePercentage),
    priceChangeLive: toNum(ev1m?.priceChangePercentage),
    risk: toNum(risk.score),
    txns: toNum(t.txns ?? txns?.total),
    holders: toNum(t.holders) ?? undefined,
  }
}

function normalizeArr(arr: unknown): TokenCard[] {
  return (Array.isArray(arr) ? arr : []).map((t) => normalize(t as Record<string, unknown>))
}

// ─── Shared Styles ───────────────────────────────────────────────────────────

const styles = {
  page: {
    background: '#0a0a0f',
    minHeight: '100vh',
    fontFamily: "'Manrope', sans-serif",
  } as React.CSSProperties,
  mono: { fontFamily: "'IBM Plex Mono', monospace" } as React.CSSProperties,
  card: {
    background: 'rgba(15, 15, 35, 0.8)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
  } as React.CSSProperties,
  cardHover: {
    background: 'rgba(20, 20, 45, 0.9)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px',
  } as React.CSSProperties,
  input: {
    background: 'rgba(26, 26, 46, 0.6)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '8px',
    color: '#fff',
    fontFamily: "'IBM Plex Mono', monospace",
  } as React.CSSProperties,
  btnPrimary: {
    background: 'linear-gradient(135deg, #14f195, #00d4ff)',
    color: '#0a0a0f',
    fontWeight: 700,
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,
  btnGhost: {
    background: 'rgba(255,255,255,0.05)',
    color: '#9ca3af',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    cursor: 'pointer',
  } as React.CSSProperties,
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
      <div
        style={{
          width: 32,
          height: 32,
          border: '3px solid rgba(20,241,149,0.2)',
          borderTopColor: '#14f195',
          borderRadius: '50%',
          animation: 'dex-spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes dex-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Risk Badge ──────────────────────────────────────────────────────────────

function RiskBadge({ score }: { score?: number }) {
  if (score === undefined) return <span style={{ ...styles.mono, fontSize: 11, color: '#6b7280' }}>N/A</span>
  return (
    <span
      style={{
        ...styles.mono,
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 6,
        background: score <= 3 ? 'rgba(20,241,149,0.15)' : score <= 6 ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
        color: score <= 3 ? '#14f195' : score <= 6 ? '#eab308' : '#ef4444',
      }}
    >
      {toNum(score)?.toFixed(1) ?? score}/10
    </span>
  )
}

// ─── Token Image ─────────────────────────────────────────────────────────────

function TokenImg({ token }: { token: TokenCard }) {
  if (token.image) {
    return (
      <img
        src={token.image}
        alt=""
        style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }}
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.display = 'none'
        }}
      />
    )
  }
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #14f195, #00d4ff)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        color: '#0a0a0f',
        flexShrink: 0,
      }}
    >
      {token.symbol?.slice(0, 2) || '??'}
    </div>
  )
}

// ─── Memescope Tab ───────────────────────────────────────────────────────────

function MemescopeColumn({
  title,
  icon,
  tokens,
  loading,
}: {
  title: string
  icon: React.ReactNode
  tokens: TokenCard[]
  loading: boolean
}) {
  return (
    <div style={{ ...styles.card, flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', maxHeight: '78vh' }}>
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {icon}
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>{title}</h3>
        <span style={{ ...styles.mono, fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>
          {tokens.length} tokens
        </span>
      </div>
      <div style={{ padding: 12, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <Spinner />
        ) : tokens.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280', fontSize: 13 }}>No tokens found</div>
        ) : (
          tokens.map((token) => (
            <div
              key={token.address}
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: 'rgba(26,26,46,0.6)',
                border: '1px solid rgba(255,255,255,0.05)',
                transition: 'border-color 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(20,241,149,0.3)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <TokenImg token={token} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {token.name || token.symbol}
                    </span>
                    <span style={{ ...styles.mono, fontSize: 11, color: '#00d4ff' }}>{token.symbol}</span>
                  </div>
                  <div style={{ ...styles.mono, fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                    {truncAddr(token.address)}
                  </div>
                </div>
                <RiskBadge score={token.risk} />
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 8,
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>Liq</div>
                  <div style={{ ...styles.mono, fontSize: 12, color: '#d1d5db' }}>{formatUsd(token.liquidity)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>MCap</div>
                  <div style={{ ...styles.mono, fontSize: 12, color: '#d1d5db' }}>{formatUsd(token.marketCap)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>24h</div>
                  <div
                    style={{
                      ...styles.mono,
                      fontSize: 12,
                      color:
                        token.priceChange24h && token.priceChange24h > 0
                          ? '#14f195'
                          : token.priceChange24h && token.priceChange24h < 0
                            ? '#ef4444'
                            : '#9ca3af',
                    }}
                  >
                    {formatPercent(token.priceChange24h)}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <button
                  style={{
                    ...styles.btnPrimary,
                    width: '100%',
                    padding: '6px 0',
                    fontSize: 11,
                    letterSpacing: '0.05em',
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    alert(`Quick Buy placeholder for ${token.symbol}`)
                  }}
                >
                  QUICK BUY
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function MemescopeTab() {
  const [data, setData] = useState<{ new: TokenCard[]; graduating: TokenCard[]; graduated: TokenCard[] }>({
    new: [],
    graduating: [],
    graduated: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const memescopeRes = await fetch('/api/solana-tracker/memescope').then((r) => r.json())
        if (!cancelled) {
          setData({
            new: normalizeArr(memescopeRes.new ?? []),
            graduating: normalizeArr(memescopeRes.graduating ?? []),
            graduated: normalizeArr(memescopeRes.graduated ?? []),
          })
        }
      } catch (e) {
        console.error('Memescope load error:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <MemescopeColumn
        title="New Tokens"
        icon={<Activity size={16} color="#14f195" />}
        tokens={data.new}
        loading={loading}
      />
      <MemescopeColumn
        title="Graduating"
        icon={<TrendingUp size={16} color="#00d4ff" />}
        tokens={data.graduating}
        loading={loading}
      />
      <MemescopeColumn
        title="Graduated"
        icon={<Shield size={16} color="#a78bfa" />}
        tokens={data.graduated}
        loading={loading}
      />
    </div>
  )
}

// ─── Latest Tokens Tab ───────────────────────────────────────────────────────

function LatestTokensTab() {
  const [tokens, setTokens] = useState<TokenCard[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/solana-tracker/latest')
        const json = await res.json()
        if (!cancelled) {
          setTokens(normalizeArr(json.tokens ?? json.data ?? json))
        }
      } catch (e) {
        console.error('Latest tokens error:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <Spinner />

  return (
    <div>
      {/* View toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
        <button
          style={{
            ...(viewMode === 'table' ? styles.btnPrimary : styles.btnGhost),
            padding: '6px 16px',
            fontSize: 12,
          }}
          onClick={() => setViewMode('table')}
        >
          List
        </button>
        <button
          style={{
            ...(viewMode === 'grid' ? styles.btnPrimary : styles.btnGhost),
            padding: '6px 16px',
            fontSize: 12,
          }}
          onClick={() => setViewMode('grid')}
        >
          Grid
        </button>
      </div>

      {tokens.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>No tokens found</div>
      ) : viewMode === 'table' ? (
        <div style={{ ...styles.card, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', ...styles.mono }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Token', 'Liquidity', 'Market Cap', 'Price', 'Live / 24h', 'Risk', 'Actions'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 16px',
                        textAlign: h === 'Token' ? 'left' : 'right',
                        fontSize: 10,
                        fontWeight: 600,
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
                  <tr
                    key={token.address}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <TokenImg token={token} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{token.name || token.symbol}</div>
                          <div style={{ fontSize: 10, color: '#6b7280' }}>{truncAddr(token.address)}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: '#d1d5db' }}>
                      {formatUsd(token.liquidity)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: '#d1d5db' }}>
                      {formatUsd(token.marketCap)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: '#e5e7eb' }}>
                      {formatUsd(token.price)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color:
                              token.priceChangeLive && token.priceChangeLive > 0
                                ? '#14f195'
                                : token.priceChangeLive && token.priceChangeLive < 0
                                  ? '#ef4444'
                                  : '#9ca3af',
                          }}
                        >
                          {formatPercent(token.priceChangeLive)}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color:
                              token.priceChange24h && token.priceChange24h > 0
                                ? '#14f195'
                                : token.priceChange24h && token.priceChange24h < 0
                                  ? '#ef4444'
                                  : '#9ca3af',
                          }}
                        >
                          {formatPercent(token.priceChange24h)}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <RiskBadge score={token.risk} />
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <a
                          href={`https://www.solanatracker.io/token/${token.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            ...styles.btnGhost,
                            padding: '4px 10px',
                            fontSize: 11,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          More Info <ExternalLink size={10} />
                        </a>
                        <button
                          style={{ ...styles.btnPrimary, padding: '4px 12px', fontSize: 11 }}
                          onClick={() => alert(`Swap placeholder for ${token.symbol}`)}
                        >
                          Swap
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {tokens.map((token) => (
            <div
              key={token.address}
              style={{
                ...styles.card,
                padding: 16,
                transition: 'border-color 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(20,241,149,0.3)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <TokenImg token={token} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{token.name || token.symbol}</div>
                  <div style={{ ...styles.mono, fontSize: 10, color: '#6b7280' }}>{truncAddr(token.address)}</div>
                </div>
                <RiskBadge score={token.risk} />
              </div>
              <div
                style={{
                  ...styles.mono,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  fontSize: 12,
                  paddingTop: 12,
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>Liquidity</div>
                  <div style={{ color: '#d1d5db' }}>{formatUsd(token.liquidity)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>Market Cap</div>
                  <div style={{ color: '#d1d5db' }}>{formatUsd(token.marketCap)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>Price</div>
                  <div style={{ color: '#e5e7eb' }}>{formatUsd(token.price)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>24h Change</div>
                  <div
                    style={{
                      color:
                        token.priceChange24h && token.priceChange24h > 0
                          ? '#14f195'
                          : token.priceChange24h && token.priceChange24h < 0
                            ? '#ef4444'
                            : '#9ca3af',
                    }}
                  >
                    {formatPercent(token.priceChange24h)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <a
                  href={`https://www.solanatracker.io/token/${token.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...styles.btnGhost,
                    flex: 1,
                    padding: '6px 0',
                    fontSize: 11,
                    textAlign: 'center',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  More Info <ExternalLink size={10} />
                </a>
                <button
                  style={{ ...styles.btnPrimary, flex: 1, padding: '6px 0', fontSize: 11 }}
                  onClick={() => alert(`Swap placeholder for ${token.symbol}`)}
                >
                  Swap
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Rugcheck Tab ────────────────────────────────────────────────────────────

function RugcheckTab() {
  const [address, setAddress] = useState('')
  const [data, setData] = useState<RugCheckData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trendingTokens, setTrendingTokens] = useState<TokenCard[]>([])
  const [trendingLoading, setTrendingLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadTrending() {
      try {
        const res = await fetch('/api/solana-tracker/trending')
        const json = await res.json()
        if (!cancelled) setTrendingTokens(normalizeArr(json.tokens ?? json.data ?? json).slice(0, 12))
      } catch (e) {
        console.error('Trending load error:', e)
      } finally {
        if (!cancelled) setTrendingLoading(false)
      }
    }
    loadTrending()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!address.trim()) return
      setLoading(true)
      setError(null)
      setData(null)
      try {
        const res = await fetch(`/api/solana-tracker/rugcheck?address=${encodeURIComponent(address.trim())}`)
        if (!res.ok) throw new Error(`Error ${res.status}`)
        const result = await res.json()
        setData({
          address: result.address ?? address,
          name: result.name ?? result.token?.name,
          symbol: result.symbol ?? result.token?.symbol,
          image: result.image ?? result.token?.image,
          liquidity: result.liquidity ?? result.pools?.[0]?.liquidity?.usd,
          marketCap: result.marketCap ?? result.pools?.[0]?.marketCap?.usd,
          totalSupply: result.totalSupply ?? result.token?.totalSupply,
          riskScore: result.riskScore ?? result.risk?.score,
          riskLevel: result.riskLevel ?? result.risk?.level,
          topHolders: result.topHolders,
          lpLocked: result.lpLocked,
          mintAuthority: result.mintAuthority,
          freezeAuthority: result.freezeAuthority,
          risks: result.risks,
        })
      } catch (e: any) {
        setError(e.message || 'Failed to fetch risk data')
      } finally {
        setLoading(false)
      }
    },
    [address]
  )

  return (
    <div>
      {/* Search */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }}
          />
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter token address for risk analysis..."
            style={{
              ...styles.input,
              width: '100%',
              padding: '12px 14px 12px 40px',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
        <button type="submit" style={{ ...styles.btnPrimary, padding: '12px 28px', fontSize: 13 }} disabled={loading}>
          {loading ? 'Analyzing...' : 'Check Risk'}
        </button>
      </form>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8,
            color: '#ef4444',
            fontSize: 13,
            marginBottom: 24,
          }}
        >
          {error}
        </div>
      )}

      {loading && <Spinner />}

      {/* Results */}
      {data && (
        <div style={{ marginBottom: 32 }}>
          {/* Header */}
          <div style={{ ...styles.card, padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              {data.image ? (
                <img src={data.image} alt="" style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
              ) : (
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #14f195, #00d4ff)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#0a0a0f',
                  }}
                >
                  {data.symbol?.slice(0, 2) || '?'}
                </div>
              )}
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff' }}>
                  {data.name || data.symbol || 'Unknown'}
                </h3>
                <div style={{ ...styles.mono, fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  {data.address}
                </div>
              </div>
            </div>

            {/* Big Risk Score */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 32,
                borderRadius: 12,
                background: riskBg(data.riskScore),
                border: `1px solid ${data.riskScore !== undefined && data.riskScore <= 3 ? 'rgba(20,241,149,0.2)' : data.riskScore !== undefined && data.riskScore <= 6 ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Overall Risk Score
                </div>
                <div
                  style={{
                    ...styles.mono,
                    fontSize: 56,
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                  className={riskColor(data.riskScore)}
                >
                  <span style={{ color: data.riskScore !== undefined && data.riskScore <= 3 ? '#14f195' : data.riskScore !== undefined && data.riskScore <= 6 ? '#eab308' : '#ef4444' }}>
                    {data.riskScore?.toFixed(1) ?? 'N/A'}
                  </span>
                  <span style={{ fontSize: 24, color: '#6b7280' }}>/10</span>
                </div>
                {data.riskLevel && (
                  <div style={{ ...styles.mono, fontSize: 14, color: '#9ca3af', marginTop: 8, textTransform: 'capitalize' }}>
                    {data.riskLevel}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {/* Stats */}
            <div style={{ ...styles.card, padding: 20 }}>
              <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#fff' }}>Token Stats</h4>
              <div style={{ ...styles.mono, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#6b7280' }}>Liquidity</span>
                  <span style={{ color: '#d1d5db' }}>{formatUsd(data.liquidity)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#6b7280' }}>Market Cap</span>
                  <span style={{ color: '#d1d5db' }}>{formatUsd(data.marketCap)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#6b7280' }}>Total Supply</span>
                  <span style={{ color: '#d1d5db' }}>{data.totalSupply ? formatNum(data.totalSupply) : 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#6b7280' }}>LP Locked</span>
                  <span style={{ color: data.lpLocked && data.lpLocked > 50 ? '#14f195' : '#ef4444' }}>
                    {data.lpLocked !== undefined ? `${data.lpLocked.toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#6b7280' }}>Mint Authority</span>
                  <span style={{ color: data.mintAuthority ? '#ef4444' : '#14f195', fontWeight: 600 }}>
                    {data.mintAuthority ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#6b7280' }}>Freeze Authority</span>
                  <span style={{ color: data.freezeAuthority ? '#ef4444' : '#14f195', fontWeight: 600 }}>
                    {data.freezeAuthority ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Risk Factors */}
            {data.risks && data.risks.length > 0 && (
              <div style={{ ...styles.card, padding: 20 }}>
                <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#fff' }}>Risk Factors</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.risks.map((risk, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: 8,
                        background:
                          risk.level === 'low'
                            ? 'rgba(20,241,149,0.06)'
                            : risk.level === 'medium'
                              ? 'rgba(234,179,8,0.06)'
                              : 'rgba(239,68,68,0.06)',
                      }}
                    >
                      <span style={{ fontSize: 12, color: '#d1d5db' }}>{risk.label}</span>
                      <span
                        style={{
                          ...styles.mono,
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          color:
                            risk.level === 'low' ? '#14f195' : risk.level === 'medium' ? '#eab308' : '#ef4444',
                        }}
                      >
                        {risk.level}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Holders */}
            {data.topHolders && data.topHolders.length > 0 && (
              <div style={{ ...styles.card, padding: 20 }}>
                <h4 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#fff' }}>
                  Holder Distribution
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.topHolders.slice(0, 10).map((holder, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ ...styles.mono, fontSize: 11, color: '#9ca3af' }}>
                          {truncAddr(holder.address)}
                        </span>
                        <span
                          style={{
                            ...styles.mono,
                            fontSize: 11,
                            fontWeight: 600,
                            color: holder.percent > 10 ? '#ef4444' : holder.percent > 5 ? '#eab308' : '#14f195',
                          }}
                        >
                          {holder.percent.toFixed(2)}%
                        </span>
                      </div>
                      <div
                        style={{
                          height: 4,
                          borderRadius: 2,
                          background: 'rgba(255,255,255,0.06)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(holder.percent, 100)}%`,
                            borderRadius: 2,
                            background:
                              holder.percent > 10
                                ? '#ef4444'
                                : holder.percent > 5
                                  ? '#eab308'
                                  : '#14f195',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {data.topHolders.some((h) => h.percent > 10) && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.15)',
                      fontSize: 12,
                      color: '#fca5a5',
                    }}
                  >
                    Warning: One or more holders own &gt;10% of supply
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trending tokens below */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
          <TrendingUp size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8, color: '#14f195' }} />
          Quick Check — Trending Tokens
        </h3>
        {trendingLoading ? (
          <Spinner />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {trendingTokens.map((token) => (
              <div
                key={token.address}
                style={{
                  ...styles.card,
                  padding: 14,
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
                onClick={() => {
                  setAddress(token.address)
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <TokenImg token={token} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {token.name || token.symbol}
                    </div>
                    <div style={{ ...styles.mono, fontSize: 10, color: '#6b7280' }}>{truncAddr(token.address)}</div>
                  </div>
                  <RiskBadge score={token.risk} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Trending Tab ────────────────────────────────────────────────────────────

function TrendingTab() {
  const [tokens, setTokens] = useState<TokenCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/solana-tracker/trending')
        const json = await res.json()
        if (!cancelled) setTokens(normalizeArr(json.tokens ?? json.data ?? json))
      } catch (e) {
        console.error('Trending error:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <Spinner />

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
      {tokens.length === 0 ? (
        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          No trending tokens found
        </div>
      ) : (
        tokens.map((token) => (
          <div
            key={token.address}
            style={{
              ...styles.card,
              padding: 18,
              transition: 'border-color 0.2s, transform 0.15s',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(20,241,149,0.3)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <TokenImg token={token} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {token.name || token.symbol}
                  </span>
                  <span style={{ ...styles.mono, fontSize: 11, color: '#00d4ff', fontWeight: 600 }}>{token.symbol}</span>
                </div>
                <div style={{ ...styles.mono, fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                  {truncAddr(token.address)}
                </div>
              </div>
              <RiskBadge score={token.risk} />
            </div>

            <div
              style={{
                ...styles.mono,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 10,
                paddingTop: 14,
                borderTop: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3 }}>Price</div>
                <div style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 600 }}>{formatUsd(token.price)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3 }}>MCap</div>
                <div style={{ fontSize: 13, color: '#d1d5db' }}>{formatUsd(token.marketCap)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 3 }}>24h</div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color:
                      token.priceChange24h && token.priceChange24h > 0
                        ? '#14f195'
                        : token.priceChange24h && token.priceChange24h < 0
                          ? '#ef4444'
                          : '#9ca3af',
                  }}
                >
                  {formatPercent(token.priceChange24h)}
                </div>
              </div>
            </div>

            <div style={{ ...styles.mono, display: 'flex', gap: 16, marginTop: 10, fontSize: 11 }}>
              <span style={{ color: '#6b7280' }}>
                Liq: <span style={{ color: '#d1d5db' }}>{formatUsd(token.liquidity)}</span>
              </span>
              <span style={{ color: '#6b7280' }}>
                Vol: <span style={{ color: '#d1d5db' }}>{formatUsd(token.volume24h)}</span>
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ─── Main Route ──────────────────────────────────────────────────────────────

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'memescope', label: 'Memescope', icon: <Activity size={15} /> },
  { id: 'latest', label: 'Latest Tokens', icon: <TrendingUp size={15} /> },
  { id: 'rugcheck', label: 'Rugcheck', icon: <Shield size={15} /> },
  { id: 'trending', label: 'Trending', icon: <TrendingUp size={15} /> },
]

function DexRoute() {
  const [activeTab, setActiveTab] = useState<TabId>('memescope')

  return (
    <div style={styles.page}>
      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '24px 20px' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 800,
              fontFamily: "'Manrope', sans-serif",
              background: 'linear-gradient(135deg, #14f195, #00d4ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            DEX Terminal
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6b7280' }}>
            Real-time token discovery, risk analysis, and trading on Solana
          </p>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: 4,
            background: 'rgba(15,15,35,0.6)',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)',
            marginBottom: 24,
            overflowX: 'auto',
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "'Manrope', sans-serif",
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                ...(activeTab === tab.id
                  ? {
                      background: 'linear-gradient(135deg, rgba(20,241,149,0.15), rgba(0,212,255,0.1))',
                      color: '#14f195',
                      boxShadow: '0 0 20px rgba(20,241,149,0.1)',
                    }
                  : {
                      background: 'transparent',
                      color: '#6b7280',
                    }),
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'memescope' && <MemescopeTab />}
        {activeTab === 'latest' && <LatestTokensTab />}
        {activeTab === 'rugcheck' && <RugcheckTab />}
        {activeTab === 'trending' && <TrendingTab />}
      </div>
    </div>
  )
}
