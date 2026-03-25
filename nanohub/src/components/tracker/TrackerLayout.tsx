/**
 * TrackerLayout — Main container with tab navigation, token search,
 * chart, trades, memescope, latest tokens, and rug check.
 */
import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react'
import { solanaTrackerApi } from '../../lib/solanaTrackerApi'
import type { TokenTransaction } from './TradesTable'
import type { LightweightChartHandle } from './LightweightChart'

// Lazy-load heavy components
const LightweightChart = lazy(() => import('./LightweightChart'))
const TradesTable = lazy(() => import('./TradesTable'))
const Memescope = lazy(() => import('./Memescope'))
const LatestTokens = lazy(() => import('./LatestTokens'))
const RugCheck = lazy(() => import('./RugCheck'))
const PumpScanner = lazy(() => import('./PumpScanner'))
const PumpTerminal = lazy(() => import('./PumpTerminal'))

type Tab = 'chart' | 'memescope' | 'latest' | 'rugcheck' | 'scanner' | 'terminal'

const DEFAULT_TOKEN = 'So11111111111111111111111111111111111111112' // wSOL

function fmt$(n: number | undefined): string {
  if (!n) return '$0'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

export function TrackerLayout({ initialTab, initialToken }: { initialTab?: Tab; initialToken?: string }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'terminal')
  const [tokenAddress, setTokenAddress] = useState(initialToken ?? DEFAULT_TOKEN)
  const [tokenDetail, setTokenDetail] = useState<any>(null)
  const [trades, setTrades] = useState<TokenTransaction[]>([])
  const [activeWallet, setActiveWallet] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const chartRef = useRef<LightweightChartHandle>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  /* ── Load token detail ────────────────────────────────── */

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await solanaTrackerApi.getToken(tokenAddress)
        if (!cancelled) setTokenDetail(data)
      } catch { /* ignore */ }
    }
    load()
    setTrades([])
    setActiveWallet(null)
    return () => { cancelled = true }
  }, [tokenAddress])

  /* ── Search ───────────────────────────────────────────── */

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) { setSearchResults([]); setSearchOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await solanaTrackerApi.search(q, 8) as any[]
        setSearchResults(results ?? [])
        setSearchOpen(true)
      } catch { /* ignore */ }
    }, 300)
  }, [])

  const selectToken = useCallback((addr: string) => {
    setTokenAddress(addr)
    setSearchQuery('')
    setSearchResults([])
    setSearchOpen(false)
    setTab('chart')
  }, [])

  /* ── Handle new transactions from WebSocket ───────────── */

  const handleTransaction = useCallback((tx: TokenTransaction) => {
    setTrades(prev => {
      const next = [tx, ...prev]
      return next.length > 500 ? next.slice(0, 500) : next
    })
  }, [])

  /* ── Wallet filter ────────────────────────────────────── */

  const handleWalletFilter = useCallback(async (wallet: string | null) => {
    setActiveWallet(wallet)
    if (!wallet) {
      chartRef.current?.setWalletMarks([])
      return
    }
    try {
      const walletTrades = await solanaTrackerApi.getTrades(tokenAddress, wallet) as any[]
      const marks = (walletTrades ?? []).map((t: any) => ({
        time: t.blockUnixTime ?? t.timestamp ?? 0,
        position: t.type === 'buy' ? 'belowBar' as const : 'aboveBar' as const,
        color: t.type === 'buy' ? '#16a34a' : '#dc2626',
        shape: t.type === 'buy' ? 'arrowUp' as const : 'arrowDown' as const,
        text: `${t.type === 'buy' ? 'B' : 'S'} $${(t.volumeUsd ?? 0).toFixed(0)}`,
      }))
      chartRef.current?.setWalletMarks(marks)
    } catch { /* ignore */ }
  }, [tokenAddress])

  /* ── Keyboard shortcut ────────────────────────────────── */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ── Close search on click outside ────────────────────── */

  useEffect(() => {
    if (!searchOpen) return
    function onClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.parentElement?.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [searchOpen])

  const token = tokenDetail?.token ?? tokenDetail
  const pool = tokenDetail?.pools?.[0] ?? {}

  const TABS: { key: Tab; label: string }[] = [
    { key: 'terminal', label: 'Pump Terminal' },
    { key: 'scanner', label: 'Pump Scanner' },
    { key: 'chart', label: 'Chart' },
    { key: 'memescope', label: 'Memescope' },
    { key: 'latest', label: 'Latest Tokens' },
    { key: 'rugcheck', label: 'Rug Check' },
  ]

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-4">
      {/* Search bar */}
      <div className="relative">
        <input
          ref={searchRef}
          className="w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50"
          placeholder="Search tokens or paste address… (⌘K)"
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
          onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
        />
        {searchOpen && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#111128] border border-white/10 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
            {searchResults.map((r: any) => (
              <button
                key={r.mint ?? r.address}
                className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                onClick={() => selectToken(r.mint ?? r.address)}
              >
                {r.image && <img src={r.image} alt="" className="w-7 h-7 rounded-full bg-white/10" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white font-medium truncate">{r.name ?? r.symbol}</div>
                  <div className="text-xs text-gray-500 font-mono">{(r.mint ?? r.address ?? '').slice(0, 8)}…</div>
                </div>
                {r.symbol && <span className="text-xs text-gray-400 shrink-0">{r.symbol}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Token header */}
      {token && tab === 'chart' && (
        <div className="flex items-center gap-4 text-sm">
          {token.image && <img src={token.image} alt="" className="w-8 h-8 rounded-full" />}
          <div>
            <span className="font-bold text-white">{token.name ?? token.symbol}</span>
            <span className="text-gray-500 ml-2">{token.symbol}</span>
          </div>
          <div className="flex gap-4 ml-auto text-xs text-gray-400">
            {pool?.price?.usd && <span>Price: <span className="text-white">${pool.price.usd < 0.01 ? pool.price.usd.toExponential(2) : pool.price.usd.toFixed(4)}</span></span>}
            {pool?.marketCap?.usd && <span>MC: <span className="text-white">{fmt$(pool.marketCap.usd)}</span></span>}
            {pool?.liquidity?.usd && <span>Liq: <span className="text-white">{fmt$(pool.liquidity.usd)}</span></span>}
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-white/5 pb-0">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'text-white border-blue-500'
                : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-white/10'
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <Suspense fallback={<div className="text-center py-12 text-gray-500 text-sm">Loading…</div>}>
        {tab === 'chart' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/5 overflow-hidden" style={{ height: 500 }}>
              <LightweightChart
                ref={chartRef}
                tokenAddress={tokenAddress}
                tokenDetail={tokenDetail}
                onTransaction={handleTransaction}
                theme="dark"
              />
            </div>
            <TradesTable
              trades={trades}
              tokenSupply={pool?.tokenSupply ?? 0}
              activeWallet={activeWallet}
              onWalletFilter={handleWalletFilter}
            />
          </div>
        )}
        {tab === 'terminal' && <PumpTerminal onSelectToken={selectToken} />}
        {tab === 'scanner' && <PumpScanner onSelectToken={selectToken} />}
        {tab === 'memescope' && <Memescope onSelectToken={selectToken} />}
        {tab === 'latest' && <LatestTokens onSelectToken={selectToken} />}
        {tab === 'rugcheck' && <RugCheck />}
      </Suspense>
    </div>
  )
}

export default TrackerLayout
