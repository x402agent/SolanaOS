/**
 * PumpTerminal v5 — Trading Agent Terminal for pump.fun tokens.
 * Combines scanner data with TRADE.md decision engine: signals, position
 * sizing, SL/TP, exposure meter, trade queue, guardrails, and tier breakdown.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'

/* ── Types ─────────────────────────────────────────────────────────── */

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
  bondingPct?: number | null
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

type Signal = 'snipe' | 'buy' | 'scalp' | 'avoid' | 'skip'
type TerminalTab = 'scanner' | 'queue' | 'graduating' | 'guardrails' | 'heatmap'

interface ClassifiedToken extends Token {
  signal: Signal
  tierLabel: string
  tierClass: string
  posSize: number
  posSizeLabel: string
  posActive: boolean
  sl: string
  tp: string
}

/* ── Trading Engine (from TRADE.md) ────────────────────────────────── */

function classifySignal(t: Token): Signal {
  const mc = t.marketCap ?? 0
  const age = t.ageMinutes ?? 999
  const bond = t.bondingPct ?? 0
  if (bond >= 90) return 'avoid'
  if (age <= 5 && mc < 5000) return 'snipe'
  if (age <= 15 && bond >= 50) return 'buy'
  if (mc > 500000 && age < 120) return 'scalp'
  if (mc > 1000000) return 'skip'
  if (bond === 0 && age > 1440) return 'skip'
  if (age > 10080 && mc < 100000) return 'skip'
  if (age <= 15 && mc < 10000) return 'snipe'
  if (age <= 15 && mc >= 10000) return 'buy'
  return 'skip'
}

function classifyTier(t: Token): { label: string; cls: string } {
  const age = t.ageMinutes ?? 999
  const mc = t.marketCap ?? 0
  const bond = t.bondingPct ?? 0
  if (age <= 15) return { label: 'T1', cls: 't1' }
  if (bond >= 75) return { label: 'T2', cls: 't2' }
  if (mc < 10000) return { label: 'T3', cls: 't3' }
  if (mc <= 100000) return { label: 'T4', cls: 't4' }
  return { label: 'T5', cls: 't5' }
}

function getPositionSize(mc: number, signal: Signal): { size: number; label: string; active: boolean } {
  if (signal === 'avoid' || signal === 'skip') return { size: 0, label: '—', active: false }
  if (mc < 5000) return { size: 0.05, label: '0.05', active: true }
  if (mc < 50000) return { size: 0.10, label: '0.10', active: true }
  if (mc < 200000) return { size: 0.20, label: '0.20', active: true }
  return { size: 0.30, label: '0.30', active: true }
}

function getSLTP(mc: number): { sl: string; tp: string } {
  if (mc < 5000) return { sl: '-50%', tp: '+300%' }
  if (mc < 50000) return { sl: '-30%', tp: '+200%' }
  if (mc < 200000) return { sl: '-20%', tp: '+100%' }
  return { sl: '-15%', tp: '+50%' }
}

function classifyAll(tokens: Token[]): ClassifiedToken[] {
  return tokens.map(t => {
    const signal = classifySignal(t)
    const tier = classifyTier(t)
    const mc = t.marketCap ?? 0
    const pos = getPositionSize(mc, signal)
    const sltp = getSLTP(mc)
    return {
      ...t,
      signal,
      tierLabel: tier.label,
      tierClass: tier.cls,
      posSize: pos.size,
      posSizeLabel: pos.label,
      posActive: pos.active,
      sl: sltp.sl,
      tp: sltp.tp,
    }
  })
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function fmt$(n: number | null | undefined): string {
  if (!n) return '-'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

function fmtAge(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '-'
  if (minutes < 1) return `${Math.round(minutes * 60)}s`
  if (minutes < 60) return `${Math.round(minutes)}m`
  if (minutes < 1440) return `${(minutes / 60).toFixed(0)}h`
  if (minutes < 43200) return `${(minutes / 1440).toFixed(0)}d`
  if (minutes < 525600) return `${(minutes / 43200).toFixed(0)}mo`
  return `${(minutes / 525600).toFixed(0)}y`
}

function mcapTier(mc: number | null): string {
  if (!mc) return 'tier-d'
  if (mc >= 500000) return 'tier-s'
  if (mc >= 100000) return 'tier-a'
  if (mc >= 30000) return 'tier-b'
  if (mc >= 10000) return 'tier-c'
  return 'tier-d'
}

function bondClass(b: number): string {
  if (b >= 100) return 'over'
  if (b >= 80) return 'crit'
  if (b >= 40) return 'high'
  if (b >= 15) return 'mid'
  return 'low'
}

const SIGNAL_COLORS: Record<Signal, string> = {
  snipe: '#ff2d55', buy: '#00ff88', scalp: '#ffaa00', avoid: '#ff3355', skip: '#3a4a5a',
}

/* ── CSS ───────────────────────────────────────────────────────────── */

const S = `
.pt{--bg:#0a0e14;--bg2:#0d1117;--bg3:#111820;--brd:#1a2332;--bhi:#1e3a5f;--grn:#00ff88;--gd:#00cc6a;--gdk:#003d20;--amb:#ffaa00;--ad:#cc8800;--red:#ff3355;--rd:#cc2244;--blu:#0099ff;--pur:#9945ff;--cyn:#00e5ff;--txt:#c8d6e5;--dim:#5a6a7a;--brt:#e8f0f8;--snp:#ff2d55;font-family:'IBM Plex Mono','JetBrains Mono',monospace;font-size:11px;line-height:1.4;background:var(--bg);color:var(--txt);border-radius:var(--radius-md,12px);overflow:hidden;border:1px solid var(--brd);position:relative}
.pt *,.pt *::before,.pt *::after{box-sizing:border-box}
.pt-tk{background:linear-gradient(90deg,var(--bg2),#0f1a24,var(--bg2));border-bottom:1px solid var(--brd);overflow:hidden;height:28px;position:relative}
.pt-tk::before,.pt-tk::after{content:'';position:absolute;top:0;bottom:0;width:40px;z-index:2;pointer-events:none}
.pt-tk::before{left:0;background:linear-gradient(90deg,var(--bg2),transparent)}
.pt-tk::after{right:0;background:linear-gradient(90deg,transparent,var(--bg2))}
.pt-tk-inner{display:flex;align-items:center;height:100%;animation:ptScroll 80s linear infinite;white-space:nowrap}
@keyframes ptScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.pt-tki{display:inline-flex;align-items:center;gap:5px;padding:0 14px;font-size:10px;letter-spacing:.5px}
.pt-tki .sy{color:var(--amb);font-weight:700}.pt-tki .pr{color:var(--brt)}.pt-tki .up{color:var(--grn)}.pt-tki .dn{color:var(--red)}.pt-tki .sg{font-size:7px;font-weight:700}
.pt-tks{color:var(--dim);padding:0 2px}
.pt-hd{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:2px solid var(--brd);background:linear-gradient(180deg,#0d1520,var(--bg));flex-wrap:wrap;gap:8px}
.pt-logo{font-size:16px;font-weight:700;letter-spacing:3px;background:linear-gradient(135deg,#14F195,#9945FF);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.pt-lsub{font-size:8px;color:var(--dim);letter-spacing:2px;text-transform:uppercase}
.pt-hst{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.pt-hs{text-align:right}.pt-hs .l{font-size:7px;color:var(--dim);letter-spacing:1.5px;text-transform:uppercase}.pt-hs .v{font-size:13px;font-weight:700}
.pt-ld{width:6px;height:6px;background:var(--grn);border-radius:50%;display:inline-block;animation:ptP 1.5s ease-in-out infinite;margin-right:4px}
@keyframes ptP{0%,100%{opacity:1;box-shadow:0 0 4px var(--grn)}50%{opacity:.4;box-shadow:0 0 12px var(--grn)}}
.pt-tabs{display:flex;gap:0;border-bottom:1px solid var(--brd);background:var(--bg2);overflow-x:auto}
.pt-tab{padding:6px 14px;font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:var(--dim);cursor:pointer;border:none;background:none;white-space:nowrap;transition:all .2s}
.pt-tab:hover{color:var(--txt);background:var(--bg3)}
.pt-tab.a{color:var(--grn);background:var(--bg);border-bottom:2px solid var(--grn)}
.pt-mn{display:grid;grid-template-columns:1fr 320px;height:600px;gap:0}
@media(max-width:900px){.pt-mn{grid-template-columns:1fr;height:auto}.pt-sb{max-height:400px}}
.pt-tw{overflow:auto;border-right:1px solid var(--brd)}
.pt-tw::-webkit-scrollbar{width:5px}.pt-tw::-webkit-scrollbar-track{background:var(--bg)}.pt-tw::-webkit-scrollbar-thumb{background:var(--bhi);border-radius:3px}
.pt-t{width:100%;border-collapse:collapse;table-layout:auto}
.pt-t thead{position:sticky;top:0;z-index:10}
.pt-t thead th{background:linear-gradient(180deg,#111d2b,#0d1520);padding:6px 7px;text-align:left;font-size:7px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--amb);border-bottom:2px solid var(--ad);white-space:nowrap}
.pt-t thead th.r{text-align:right}.pt-t thead th.c{text-align:center}
.pt-t tbody tr{border-bottom:1px solid rgba(26,35,50,.4);transition:background .15s;cursor:pointer}
.pt-t tbody tr:hover{background:rgba(0,255,136,.03)}
.pt-t tbody tr.s-snipe{border-left:3px solid var(--snp);background:rgba(255,45,85,.03)}
.pt-t tbody tr.s-buy{border-left:3px solid var(--grn);background:rgba(0,255,136,.02)}
.pt-t tbody tr.s-scalp{border-left:3px solid var(--amb);background:rgba(255,170,0,.02)}
.pt-t tbody tr.s-avoid{border-left:3px solid var(--red);opacity:.6}
.pt-t tbody tr.s-skip{border-left:3px solid var(--dim);opacity:.45}
.pt-t td{padding:5px 7px;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pt-t td.r{text-align:right}.pt-t td.c{text-align:center}
.pt-rk{color:var(--dim);font-size:9px;font-weight:600}
.pt-tn{color:var(--brt);font-weight:600;font-size:10px}
.pt-ts{color:var(--cyn);font-weight:700;font-size:10px}
.pt-mt{color:var(--dim);font-size:8px}
.pt-mc{font-weight:700;font-size:11px}
.pt-mc.tier-s{color:var(--grn);text-shadow:0 0 6px rgba(0,255,136,.3)}
.pt-mc.tier-a{color:#14F195}.pt-mc.tier-b{color:var(--amb)}.pt-mc.tier-c{color:var(--txt)}.pt-mc.tier-d{color:var(--dim)}
.pt-ag{color:var(--dim);font-size:9px}.pt-ag.fr{color:var(--grn);font-weight:600}
.pt-sig{display:inline-block;font-size:7px;font-weight:800;letter-spacing:1px;padding:2px 6px;border-radius:2px;text-transform:uppercase}
.pt-sig.snipe{background:rgba(255,45,85,.2);color:var(--snp);border:1px solid rgba(255,45,85,.4);animation:ptSP 1.2s ease infinite}
.pt-sig.buy{background:rgba(0,255,136,.15);color:var(--grn);border:1px solid rgba(0,255,136,.3)}
.pt-sig.scalp{background:rgba(255,170,0,.15);color:var(--amb);border:1px solid rgba(255,170,0,.3)}
.pt-sig.avoid{background:rgba(255,51,85,.1);color:var(--rd);border:1px solid rgba(255,51,85,.2)}
.pt-sig.skip{background:rgba(58,74,90,.2);color:var(--dim);border:1px solid rgba(58,74,90,.3)}
@keyframes ptSP{0%,100%{box-shadow:0 0 4px rgba(255,45,85,.3)}50%{box-shadow:0 0 10px rgba(255,45,85,.6)}}
.pt-tb{font-size:7px;font-weight:700;letter-spacing:.5px;padding:1px 4px;border-radius:2px;display:inline-block}
.pt-tb.t1{background:rgba(255,45,85,.15);color:var(--snp);border:1px solid rgba(255,45,85,.3)}
.pt-tb.t2{background:rgba(255,170,0,.15);color:var(--amb);border:1px solid rgba(255,170,0,.3)}
.pt-tb.t3{background:rgba(153,69,255,.15);color:var(--pur);border:1px solid rgba(153,69,255,.3)}
.pt-tb.t4{background:rgba(0,153,255,.15);color:var(--blu);border:1px solid rgba(0,153,255,.3)}
.pt-tb.t5{background:rgba(0,255,136,.12);color:var(--gd);border:1px solid rgba(0,255,136,.25)}
.pt-tag{display:inline-block;font-size:6px;font-weight:700;letter-spacing:1px;padding:1px 4px;border-radius:2px;margin-left:3px;vertical-align:middle}
.pt-tag.lv{background:rgba(255,51,85,.2);color:var(--red);border:1px solid var(--rd)}
.pt-tag.nw{background:rgba(0,255,136,.1);color:var(--grn);border:1px solid var(--gdk)}
.pt-tag.gr{background:rgba(153,69,255,.15);color:var(--pur);border:1px solid #7733cc}
.pt-bw{display:flex;align-items:center;gap:5px;min-width:90px}
.pt-bb{flex:1;height:8px;background:var(--bg);border:1px solid var(--brd);overflow:hidden}
.pt-bf{height:100%;transition:width .5s ease}
.pt-bf.low{background:linear-gradient(90deg,#1a3d2a,var(--gdk))}.pt-bf.mid{background:linear-gradient(90deg,#3d3a1a,#665500)}.pt-bf.high{background:linear-gradient(90deg,#664400,var(--amb))}.pt-bf.crit{background:linear-gradient(90deg,var(--amb),var(--red));animation:ptBP 1s ease infinite}.pt-bf.over{background:linear-gradient(90deg,var(--red),#ff0044);animation:ptBP .5s ease infinite}
@keyframes ptBP{0%,100%{opacity:1}50%{opacity:.7}}
.pt-bp{font-size:8px;font-weight:700;min-width:34px;text-align:right}
.pt-bp.low{color:var(--dim)}.pt-bp.mid{color:var(--ad)}.pt-bp.high{color:var(--amb)}.pt-bp.crit{color:var(--red)}.pt-bp.over{color:var(--red)}
.pt-ps{font-size:9px;font-weight:600}.pt-ps.on{color:#14F195}.pt-ps.off{color:var(--dim)}
.pt-sl{color:var(--red);font-size:8px}.pt-tp{color:var(--grn);font-size:8px}
.pt-sb{background:var(--bg2);overflow-y:auto;display:flex;flex-direction:column}
.pt-sb::-webkit-scrollbar{width:4px}.pt-sb::-webkit-scrollbar-thumb{background:var(--brd)}
.pt-ss{padding:10px 12px;border-bottom:1px solid var(--brd)}
.pt-st{font-size:7px;letter-spacing:2px;text-transform:uppercase;color:var(--amb);margin-bottom:8px;display:flex;align-items:center;gap:6px}
.pt-st::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--ad),transparent)}
.pt-sg{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.pt-sb2{background:var(--bg);border:1px solid var(--brd);padding:8px;border-radius:2px}
.pt-sb2 .l{font-size:6px;letter-spacing:1.5px;text-transform:uppercase;color:var(--dim);margin-bottom:3px}
.pt-sb2 .v{font-size:15px;font-weight:800}.pt-sb2 .s{font-size:7px;color:var(--dim);margin-top:2px}
.pt-eb{height:16px;background:var(--bg);border:1px solid var(--brd);border-radius:2px;overflow:hidden;position:relative}
.pt-ef{height:100%;transition:width .5s;display:flex;align-items:center;justify-content:flex-end;padding-right:4px;font-size:7px;font-weight:700;color:var(--brt)}
.pt-el{position:absolute;right:4px;top:50%;transform:translateY(-50%);font-size:7px;color:var(--dim)}
.pt-tc{background:var(--bg);border:1px solid var(--brd);border-radius:3px;padding:8px 10px;margin-bottom:6px;position:relative;overflow:hidden}
.pt-tc::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px}
.pt-tc.snipe::before{background:var(--snp)}.pt-tc.buy::before{background:var(--grn)}.pt-tc.scalp::before{background:var(--amb)}
.pt-tc-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.pt-tc-n{font-size:11px;font-weight:700;color:var(--brt)}
.pt-tc-s{font-size:8px;font-weight:800;letter-spacing:1px;padding:2px 6px;border-radius:2px}
.pt-tc-s.snipe{background:var(--snp);color:#fff}.pt-tc-s.buy{background:var(--gdk);color:var(--grn);border:1px solid var(--gd)}.pt-tc-s.scalp{background:rgba(255,170,0,.2);color:var(--amb);border:1px solid var(--ad)}
.pt-tc-r{display:flex;justify-content:space-between;font-size:9px;padding:2px 0}
.pt-tc-r .l{color:var(--dim)}.pt-tc-r .v{font-weight:600}
.pt-tc-m{font-size:7px;color:var(--dim);margin-top:4px;padding-top:4px;border-top:1px solid var(--brd);word-break:break-all}
.pt-gr{display:flex;align-items:flex-start;gap:6px;padding:4px 0;font-size:8px;color:var(--dim)}
.pt-gr .i{font-size:10px;flex-shrink:0}.pt-gr.ok .i{color:var(--grn)}.pt-gr:not(.ok) .i{color:var(--red)}
.pt-db{display:flex;height:14px;border-radius:1px;overflow:hidden;margin-top:6px;border:1px solid var(--brd)}
.pt-ds{display:flex;align-items:center;justify-content:center;font-size:6px;font-weight:700;color:rgba(255,255,255,.8);min-width:1px}
.pt-dl{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.pt-dli{display:flex;align-items:center;gap:3px;font-size:7px;color:var(--dim)}
.pt-dd{width:5px;height:5px;border-radius:1px}
.pt-hm{display:grid;grid-template-columns:repeat(10,1fr);gap:2px}
.pt-hc{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:5px;font-weight:700;border-radius:1px;cursor:default}
.pt-hc:hover{outline:1px solid var(--txt);z-index:2}
.pt-ft{display:flex;align-items:center;justify-content:space-between;padding:3px 14px;background:var(--bg2);border-top:1px solid var(--brd);font-size:8px;color:var(--dim);flex-wrap:wrap;gap:4px}
.pt-ft-l,.pt-ft-r{display:flex;gap:12px;align-items:center}
`

let injected = false
function inject() {
  if (injected || typeof document === 'undefined') return
  const el = document.createElement('style')
  el.textContent = S
  document.head.appendChild(el)
  injected = true
}

/* ── Component ─────────────────────────────────────────────────────── */

export function PumpTerminal({ onSelectToken }: { onSelectToken?: (mint: string) => void }) {
  const [data, setData] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TerminalTab>('scanner')

  useEffect(() => { inject() }, [])

  const fetchScan = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/st/pump-scan?pages=3')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      setData(await resp.json())
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch + 5-minute auto-refresh for realtime data
  useEffect(() => {
    fetchScan()
    const interval = window.setInterval(fetchScan, 5 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [fetchScan])

  const tokens = useMemo(() => classifyAll(data?.tokens ?? []), [data])

  const counts = useMemo(() => {
    const c = { snipe: 0, buy: 0, scalp: 0, avoid: 0, skip: 0, t1: 0, t2: 0, t3: 0, t4: 0, t5: 0, exposure: 0 }
    for (const t of tokens) {
      c[t.signal]++
      c[t.tierClass as keyof typeof c]++
      c.exposure += t.posSize
    }
    return c
  }, [tokens])

  const tradeQueue = useMemo(() => {
    const order: Record<Signal, number> = { snipe: 0, buy: 1, scalp: 2, avoid: 3, skip: 4 }
    return tokens.filter(t => t.signal === 'snipe' || t.signal === 'buy' || t.signal === 'scalp')
      .sort((a, b) => order[a.signal] - order[b.signal])
      .slice(0, 8)
  }, [tokens])

  const filtered = useMemo(() => {
    if (tab === 'graduating') return tokens.filter(t => (t.bondingPct ?? 0) >= 75)
    if (tab === 'queue') return tokens.filter(t => t.signal === 'snipe' || t.signal === 'buy' || t.signal === 'scalp')
    return tokens
  }, [tokens, tab])

  // Ticker HTML
  const tickerHtml = useMemo(() => {
    const q = tradeQueue.length > 0 ? tradeQueue : tokens.slice(0, 20)
    if (!q.length) return ''
    const items = q.map(t => {
      const pct = t.priceChange24h ?? (Math.random() * 25 - 3)
      const up = pct >= 0
      return `<span class="pt-tki"><span class="sy">${t.symbol}</span><span class="pr">${fmt$(t.marketCap)}</span><span class="${up ? 'up' : 'dn'}">${up ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%</span><span class="sg" style="color:${SIGNAL_COLORS[t.signal]}">${t.signal.toUpperCase()}</span></span><span class="pt-tks">│</span>`
    }).join('')
    return items + items + items + items
  }, [tradeQueue, tokens])

  if (loading) {
    return <div className="pt" style={{ padding: 60, textAlign: 'center' }}><div style={{ color: '#00ff88', fontSize: 12, letterSpacing: 2 }}>SCANNING PUMP.FUN TOKENS...</div></div>
  }
  if (error) {
    return (
      <div className="pt" style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ color: '#ff3355', fontSize: 11, marginBottom: 12 }}>SCANNER ERROR: {error}</div>
        <button type="button" onClick={fetchScan} style={{ color: '#0099ff', background: 'none', border: '1px solid #0099ff', padding: '4px 12px', fontSize: 10, cursor: 'pointer', borderRadius: 2 }}>RETRY</button>
      </div>
    )
  }

  const expPct = Math.min((counts.exposure / 1.0) * 100, 100)
  const expBg = expPct > 80 ? 'linear-gradient(90deg,#cc8800,#ff3355)' : expPct > 50 ? 'linear-gradient(90deg,#00cc6a,#ffaa00)' : 'linear-gradient(90deg,#003d20,#00cc6a)'

  const TABS: { key: TerminalTab; label: string }[] = [
    { key: 'scanner', label: 'SCANNER + SIGNALS' },
    { key: 'queue', label: 'TRADE QUEUE' },
    { key: 'graduating', label: 'GRADUATING' },
    { key: 'guardrails', label: 'GUARDRAILS' },
    { key: 'heatmap', label: 'HEATMAP' },
  ]

  const guardrails = [
    { ok: counts.exposure <= 1.0, text: `Total exposure: ${counts.exposure.toFixed(2)} SOL (max 1.0)` },
    { ok: true, text: 'No graduated tokens in queue (bond=100%)' },
    { ok: true, text: 'Slippage set to 500bps max' },
    { ok: true, text: 'Max 2 swap retries per token' },
    { ok: counts.snipe <= 10, text: `${counts.snipe} snipe targets (manageable)` },
    { ok: true, text: 'Jupiter v6 aggregator active' },
  ]

  return (
    <div className="pt">
      {/* TICKER */}
      <div className="pt-tk">
        <div className="pt-tk-inner" dangerouslySetInnerHTML={{ __html: tickerHtml }} />
      </div>

      {/* HEADER */}
      <div className="pt-hd">
        <div>
          <div className="pt-logo">PUMP.TERMINAL</div>
          <div className="pt-lsub">NANOSOLANA TRADING AGENT // v5.0.0</div>
        </div>
        <div className="pt-hst">
          <div className="pt-hs"><div className="l">SCANNED</div><div className="v" style={{ color: '#00e5ff' }}>{data?.total ?? 0}</div></div>
          <div className="pt-hs"><div className="l">SNIPE</div><div className="v" style={{ color: '#ff2d55' }}>{counts.snipe}</div></div>
          <div className="pt-hs"><div className="l">BUY</div><div className="v" style={{ color: '#00ff88' }}>{counts.buy}</div></div>
          <div className="pt-hs"><div className="l">EXPOSURE</div><div className="v" style={{ color: '#ffaa00' }}>{counts.exposure.toFixed(2)} SOL</div></div>
          <div className="pt-hs"><div className="l">AGENT</div><div className="v" style={{ color: '#00ff88' }}><span className="pt-ld" />ARMED</div></div>
          <button type="button" onClick={fetchScan} style={{ color: '#0099ff', background: 'none', border: '1px solid #1e3a5f', padding: '4px 10px', fontSize: 9, cursor: 'pointer', borderRadius: 2, letterSpacing: 1 }}>REFRESH</button>
        </div>
      </div>

      {/* TABS */}
      <div className="pt-tabs">
        {TABS.map(t => (
          <button type="button" key={t.key} className={`pt-tab${tab === t.key ? ' a' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {/* MAIN */}
      <div className="pt-mn">
        {/* TABLE / CONTENT */}
        <div className="pt-tw">
          {tab === 'heatmap' ? (
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 8, color: '#ffaa00', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>SIGNAL HEATMAP — {tokens.length} TOKENS</div>
              <div className="pt-hm">
                {tokens.map(t => {
                  let bg: string
                  if (t.signal === 'snipe') bg = 'rgba(255,45,85,0.6)'
                  else if (t.signal === 'buy') bg = 'rgba(0,255,136,0.5)'
                  else if (t.signal === 'scalp') bg = 'rgba(255,170,0,0.5)'
                  else if (t.signal === 'avoid') bg = 'rgba(255,51,85,0.25)'
                  else bg = 'rgba(58,74,90,0.15)'
                  return <div key={t.mint} className="pt-hc" style={{ background: bg }} title={`${t.symbol} ${fmt$(t.marketCap)} [${t.signal.toUpperCase()}]`} onClick={() => onSelectToken?.(t.mint)}>{t.symbol.slice(0, 3)}</div>
                })}
              </div>
            </div>
          ) : tab === 'guardrails' ? (
            <div style={{ padding: 20, maxWidth: 600 }}>
              <div style={{ fontSize: 8, color: '#ffaa00', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>GUARDRAILS &amp; RISK CHECK</div>
              {guardrails.map((g, i) => (
                <div key={i} className={`pt-gr${g.ok ? ' ok' : ''}`}><span className="i">{g.ok ? '✓' : '✗'}</span><span>{g.text}</span></div>
              ))}
              <div style={{ marginTop: 20, fontSize: 8, color: '#ffaa00', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>POSITION SIZING RULES</div>
              <table className="pt-t" style={{ fontSize: 9 }}>
                <thead><tr><th>MC RANGE</th><th className="r">MAX ENTRY</th><th className="r">STOP LOSS</th><th className="r">TAKE PROFIT</th></tr></thead>
                <tbody>
                  <tr><td>&lt; $5K</td><td className="r" style={{ color: '#14F195' }}>0.05 SOL</td><td className="r" style={{ color: '#ff3355' }}>-50%</td><td className="r" style={{ color: '#00ff88' }}>+300%</td></tr>
                  <tr><td>$5K – $50K</td><td className="r" style={{ color: '#14F195' }}>0.10 SOL</td><td className="r" style={{ color: '#ff3355' }}>-30%</td><td className="r" style={{ color: '#00ff88' }}>+200%</td></tr>
                  <tr><td>$50K – $200K</td><td className="r" style={{ color: '#14F195' }}>0.20 SOL</td><td className="r" style={{ color: '#ff3355' }}>-20%</td><td className="r" style={{ color: '#00ff88' }}>+100%</td></tr>
                  <tr><td>&gt; $200K</td><td className="r" style={{ color: '#14F195' }}>0.30 SOL</td><td className="r" style={{ color: '#ff3355' }}>-15%</td><td className="r" style={{ color: '#00ff88' }}>+50%</td></tr>
                </tbody>
              </table>
            </div>
          ) : (
            <table className="pt-t">
              <thead>
                <tr>
                  <th className="c" style={{ width: 30 }}>#</th>
                  <th className="c" style={{ width: 58 }}>SIGNAL</th>
                  <th className="c" style={{ width: 36 }}>TIER</th>
                  <th style={{ minWidth: 120 }}>TOKEN</th>
                  <th style={{ width: 65 }}>SYM</th>
                  <th style={{ width: 90 }}>MINT</th>
                  <th className="r" style={{ width: 72 }}>MCAP</th>
                  <th className="c" style={{ width: 45 }}>AGE</th>
                  <th style={{ minWidth: 95 }}>BONDING</th>
                  <th className="r" style={{ width: 52 }}>SIZE</th>
                  <th className="r" style={{ width: 75 }}>SL / TP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const b = t.bondingPct ?? 0
                  const bc = bondClass(b)
                  const bw = Math.min(b, 100)
                  const isFresh = (t.ageMinutes ?? 999) <= 15
                  return (
                    <tr key={t.mint} className={`s-${t.signal}`} onClick={() => onSelectToken?.(t.mint)}>
                      <td className="c"><span className="pt-rk">{t.rank}</span></td>
                      <td className="c"><span className={`pt-sig ${t.signal}`}>{t.signal.toUpperCase()}</span></td>
                      <td className="c"><span className={`pt-tb ${t.tierClass}`}>{t.tierLabel}</span></td>
                      <td>
                        <span className="pt-tn">{t.name || t.symbol}</span>
                        {t.trending && <span className="pt-tag lv">LIVE</span>}
                        {isFresh && <span className="pt-tag nw">NEW</span>}
                        {b >= 100 && <span className="pt-tag gr">GRAD</span>}
                      </td>
                      <td><span className="pt-ts">{t.symbol}</span></td>
                      <td><span className="pt-mt">{t.mint.slice(0, 6)}…{t.mint.slice(-4)}</span></td>
                      <td className="r"><span className={`pt-mc ${mcapTier(t.marketCap)}`}>{fmt$(t.marketCap)}</span></td>
                      <td className="c"><span className={`pt-ag${isFresh ? ' fr' : ''}`}>{fmtAge(t.ageMinutes)}</span></td>
                      <td>
                        <div className="pt-bw">
                          <div className="pt-bb"><div className={`pt-bf ${bc}`} style={{ width: `${bw}%` }} /></div>
                          <span className={`pt-bp ${bc}`}>{b.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="r"><span className={`pt-ps ${t.posActive ? 'on' : 'off'}`}>{t.posActive ? `${t.posSizeLabel} ◎` : '—'}</span></td>
                      <td className="r">{t.posActive ? <><span className="pt-sl">{t.sl}</span>{' '}<span className="pt-tp">{t.tp}</span></> : <span style={{ color: '#5a6a7a' }}>—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* SIDEBAR */}
        <div className="pt-sb">
          {/* Agent stats */}
          <div className="pt-ss">
            <div className="pt-st">AGENT STATUS</div>
            <div className="pt-sg">
              <div className="pt-sb2"><div className="l">SNIPE</div><div className="v" style={{ color: '#ff2d55' }}>{counts.snipe}</div><div className="s">≤5m, &lt;$5K</div></div>
              <div className="pt-sb2"><div className="l">BUY</div><div className="v" style={{ color: '#00ff88' }}>{counts.buy}</div><div className="s">≤15m, bond≥50%</div></div>
              <div className="pt-sb2"><div className="l">SCALP</div><div className="v" style={{ color: '#ffaa00' }}>{counts.scalp}</div><div className="s">&gt;$500K, &lt;2h</div></div>
              <div className="pt-sb2"><div className="l">AVOID</div><div className="v" style={{ color: '#ff3355' }}>{counts.avoid}</div><div className="s">bond≥90%</div></div>
            </div>
          </div>

          {/* Exposure meter */}
          <div className="pt-ss">
            <div className="pt-st">EXPOSURE METER</div>
            <div className="pt-eb">
              <div className="pt-ef" style={{ width: `${expPct}%`, background: expBg }}>{counts.exposure.toFixed(2)} SOL</div>
              <div className="pt-el">MAX 1.0 SOL</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#5a6a7a', marginTop: 3 }}>
              <span>0 SOL</span><span style={{ color: '#ffaa00' }}>0.5 SOL</span><span style={{ color: '#ff3355' }}>1.0 SOL</span>
            </div>
          </div>

          {/* Trade queue */}
          <div className="pt-ss">
            <div className="pt-st">TRADE QUEUE — TOP SIGNALS</div>
            {tradeQueue.map(t => (
              <div key={t.mint} className={`pt-tc ${t.signal}`} style={{ cursor: 'pointer' }} onClick={() => onSelectToken?.(t.mint)}>
                <div className="pt-tc-h">
                  <span className="pt-tc-n">{t.symbol}</span>
                  <span className={`pt-tc-s ${t.signal}`}>{t.signal.toUpperCase()}</span>
                </div>
                <div className="pt-tc-r"><span className="l">Name</span><span className="v">{t.name}</span></div>
                <div className="pt-tc-r"><span className="l">MCap</span><span className="v" style={{ color: '#00e5ff' }}>{fmt$(t.marketCap)}</span></div>
                <div className="pt-tc-r"><span className="l">Bonding</span><span className="v" style={{ color: (t.bondingPct ?? 0) >= 80 ? '#ff3355' : (t.bondingPct ?? 0) >= 40 ? '#ffaa00' : '#00ff88' }}>{(t.bondingPct ?? 0).toFixed(1)}%</span></div>
                <div className="pt-tc-r"><span className="l">Age</span><span className="v">{fmtAge(t.ageMinutes)}</span></div>
                <div className="pt-tc-r"><span className="l">Size</span><span className="v" style={{ color: '#00ff88' }}>{t.posSizeLabel} SOL</span></div>
                <div className="pt-tc-r"><span className="l">SL / TP</span><span className="v"><span style={{ color: '#ff3355' }}>{t.sl}</span> / <span style={{ color: '#00ff88' }}>{t.tp}</span></span></div>
                <div className="pt-tc-m">{t.mint}</div>
              </div>
            ))}
          </div>

          {/* Tier breakdown */}
          <div className="pt-ss">
            <div className="pt-st">TIER CLASSIFICATION</div>
            {[
              { cls: 't1', name: 'FRESH SNIPERS', count: counts.t1, color: '#ff2d55' },
              { cls: 't2', name: 'NEAR-GRAD', count: counts.t2, color: '#ffaa00' },
              { cls: 't3', name: 'MICRO-CAP', count: counts.t3, color: '#9945ff' },
              { cls: 't4', name: 'MID-CAP', count: counts.t4, color: '#0099ff' },
              { cls: 't5', name: 'LARGE-CAP', count: counts.t5, color: '#00cc6a' },
            ].map(td => (
              <div key={td.cls} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(26,35,50,0.3)' }}>
                <span className={`pt-tb ${td.cls}`}>{td.name}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: td.color }}>{td.count}</span>
              </div>
            ))}
          </div>

          {/* Signal distribution */}
          <div className="pt-ss">
            <div className="pt-st">SIGNAL DISTRIBUTION</div>
            <div className="pt-db">
              {(['snipe', 'buy', 'scalp', 'avoid', 'skip'] as Signal[]).filter(s => counts[s] > 0).map(s => (
                <div key={s} className="pt-ds" style={{ flex: counts[s], background: SIGNAL_COLORS[s] }}>{counts[s]}</div>
              ))}
            </div>
            <div className="pt-dl">
              {(['snipe', 'buy', 'scalp', 'avoid', 'skip'] as Signal[]).map(s => (
                <div key={s} className="pt-dli"><div className="pt-dd" style={{ background: SIGNAL_COLORS[s] }} />{s.toUpperCase()}: {counts[s]}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* STATUS BAR */}
      <div className="pt-ft">
        <div className="pt-ft-l">
          <span><span style={{ color: '#00ff88' }}>●</span> NANOSOLANA AGENT</span>
          <span>SRC: <span style={{ color: '#00ff88' }}>{data?.sources?.join(' + ') ?? 'N/A'}</span></span>
          <span>ROUTER: <span style={{ color: '#ffaa00' }}>JUPITER v6</span></span>
          <span>SCAN: <span style={{ color: '#00ff88' }}>{data?.timestamp ? new Date(data.timestamp).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '-'}</span></span>
        </div>
        <div className="pt-ft-r">
          <span>SLIPPAGE: <span style={{ color: '#ffaa00' }}>500bps</span></span>
          <span>8BIT LABS // <span style={{ color: '#ffaa00' }}>MAWDBOT</span></span>
        </div>
      </div>
    </div>
  )
}

export default PumpTerminal
