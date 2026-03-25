/**
 * Solana Token Chart using TradingView Lightweight Charts v5.
 * Replaces the proprietary TradingView Advanced Charts with the
 * open-source lightweight-charts library.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
  CrosshairMode,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
} from 'lightweight-charts'
import { solanaTrackerApi } from '../../lib/solanaTrackerApi'
import { getDatastream } from '../../lib/solanaTrackerDatastream'

/* ── Types ────────────────────────────────────────────────── */

interface ChartBar {
  time: Time
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface ChartMark {
  time: Time
  position: 'aboveBar' | 'belowBar'
  color: string
  shape: 'arrowUp' | 'arrowDown' | 'circle'
  text: string
  id?: string
}

export interface LightweightChartHandle {
  setWalletMarks: (marks: ChartMark[]) => void
  refreshData: () => void
}

interface LightweightChartProps {
  tokenAddress: string
  tokenDetail?: {
    token?: { symbol?: string; name?: string; decimals?: number }
    pools?: Array<{ tokenSupply?: number; marketCap?: { usd?: number }; liquidity?: { usd?: number } }>
    risk?: { level?: number }
  } | null
  onTransaction?: (tx: any) => void
  theme?: 'dark' | 'light'
  resolution?: string
}

/* ── Resolution helpers ───────────────────────────────────── */

const RESOLUTION_MAP: Record<string, string> = {
  '1s': '1s', '5s': '5s', '15s': '15s',
  '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '4h': '4h', '6h': '6h', '12h': '12h', '1d': '1d',
}

const RESOLUTION_MS: Record<string, number> = {
  '1s': 1_000, '5s': 5_000, '15s': 15_000,
  '1m': 60_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000,
  '1h': 3_600_000, '4h': 14_400_000, '6h': 21_600_000, '12h': 43_200_000,
  '1d': 86_400_000,
}

const RESOLUTION_OPTIONS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const

/* ── Dark / Light palettes ────────────────────────────────── */

function getPalette(t: 'dark' | 'light') {
  return t === 'dark'
    ? {
        bg: '#0c0c0e',
        text: '#9a9aa0',
        grid: '#1a1a1e',
        border: '#232326',
        crosshair: '#555',
        upColor: '#16a34a',
        downColor: '#dc2626',
        volUp: 'rgba(22,163,74,.25)',
        volDown: 'rgba(220,38,38,.25)',
        toolbarBg: '#111114',
        toolbarBorder: '#232326',
        toolbarText: '#9a9aa0',
        toolbarActiveText: '#e8e8ec',
        toolbarActiveBg: 'rgba(255,255,255,.1)',
      }
    : {
        bg: '#ffffff',
        text: '#525252',
        grid: '#f0f0f0',
        border: '#e0e0e0',
        crosshair: '#aaa',
        upColor: '#16a34a',
        downColor: '#dc2626',
        volUp: 'rgba(22,163,74,.15)',
        volDown: 'rgba(220,38,38,.15)',
        toolbarBg: '#fafafa',
        toolbarBorder: '#e0e0e0',
        toolbarText: '#71717a',
        toolbarActiveText: '#0a0a0a',
        toolbarActiveBg: 'rgba(0,0,0,.06)',
      }
}

/* ── Component ────────────────────────────────────────────── */

export const LightweightChart = forwardRef<LightweightChartHandle, LightweightChartProps>(
  function LightweightChart({ tokenAddress, tokenDetail, onTransaction, theme = 'dark', resolution: initialRes }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi | null>(null)
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
    const markersRef = useRef<ReturnType<typeof createSeriesMarkers> | null>(null)
    const lastBarRef = useRef<ChartBar | null>(null)
    const wsUnsubsRef = useRef<Array<() => void>>([])

    const [res, setRes] = useState(initialRes ?? '1m')
    const [marketCapMode, setMarketCapMode] = useState(false)
    const [loading, setLoading] = useState(true)

    const supply = tokenDetail?.pools?.[0]?.tokenSupply ?? 0
    const symbol = tokenDetail?.token?.symbol ?? '?'
    const p = getPalette(theme)

    /* ── Imperative handle ──────────────────────────────── */

    useImperativeHandle(ref, () => ({
      setWalletMarks(marks: ChartMark[]) {
        if (!markersRef.current || !candleSeriesRef.current) return
        markersRef.current.setMarkers(marks)
      },
      refreshData() {
        loadBars()
      },
    }), [])

    /* ── Fetch bars ─────────────────────────────────────── */

    const loadBars = useCallback(async () => {
      if (!candleSeriesRef.current || !volumeSeriesRef.current) return
      setLoading(true)
      try {
        const type = RESOLUTION_MAP[res] ?? '1m'
        const data = await solanaTrackerApi.getChart(tokenAddress, type, marketCapMode)
        const raw = (data as any)?.oclhv ?? (data as any)?.ohlcv ?? []
        if (!raw.length) { setLoading(false); return }

        const candles: CandlestickData[] = []
        const volumes: HistogramData[] = []

        for (const c of raw) {
          const t = c[0] as Time
          const o = marketCapMode ? c[1] * supply : c[1]
          const cl = marketCapMode ? c[2] * supply : c[2]
          const lo = marketCapMode ? c[3] * supply : c[3]
          const hi = marketCapMode ? c[4] * supply : c[4]
          const v = c[5] ?? 0
          candles.push({ time: t, open: o, high: hi, low: lo, close: cl })
          volumes.push({ time: t, value: v, color: cl >= o ? p.volUp : p.volDown })
        }

        candles.sort((a, b) => (a.time as number) - (b.time as number))
        volumes.sort((a, b) => (a.time as number) - (b.time as number))

        candleSeriesRef.current.setData(candles)
        volumeSeriesRef.current.setData(volumes)

        if (candles.length) {
          const last = candles[candles.length - 1]
          lastBarRef.current = {
            time: last.time,
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
            volume: volumes[volumes.length - 1]?.value,
          }
        }

        chartRef.current?.timeScale().fitContent()
      } catch (e) {
        console.error('[chart] loadBars error:', e)
      }
      setLoading(false)
    }, [tokenAddress, res, marketCapMode, supply, p.volUp, p.volDown])

    /* ── Create / destroy chart ─────────────────────────── */

    useEffect(() => {
      if (!containerRef.current) return

      const chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        layout: {
          background: { type: ColorType.Solid, color: p.bg },
          textColor: p.text,
          fontFamily: "'IBM Plex Mono', 'DM Mono', monospace",
          fontSize: 12,
        },
        grid: {
          vertLines: { color: p.grid },
          horzLines: { color: p.grid },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: p.crosshair, width: 1, style: 3, labelBackgroundColor: p.border },
          horzLine: { color: p.crosshair, width: 1, style: 3, labelBackgroundColor: p.border },
        },
        rightPriceScale: {
          borderColor: p.border,
          scaleMargins: { top: 0.1, bottom: 0.25 },
        },
        timeScale: {
          borderColor: p.border,
          timeVisible: true,
          secondsVisible: res.includes('s'),
          rightOffset: 5,
        },
        handleScroll: { vertTouchDrag: false },
      })
      chartRef.current = chart

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: p.upColor,
        downColor: p.downColor,
        borderUpColor: p.upColor,
        borderDownColor: p.downColor,
        wickUpColor: p.upColor,
        wickDownColor: p.downColor,
      })
      candleSeriesRef.current = candleSeries

      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      })
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      })
      volumeSeriesRef.current = volumeSeries

      // Series markers for wallet trades
      markersRef.current = createSeriesMarkers(candleSeries, [])

      // Resize observer
      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          chart.resize(width, height)
        }
      })
      ro.observe(containerRef.current)

      return () => {
        ro.disconnect()
        chart.remove()
        chartRef.current = null
        candleSeriesRef.current = null
        volumeSeriesRef.current = null
        markersRef.current = null
      }
    }, [theme]) // recreate chart on theme change

    /* ── Load bars when deps change ─────────────────────── */

    useEffect(() => {
      if (candleSeriesRef.current) loadBars()
    }, [loadBars])

    /* ── WebSocket real-time updates ────────────────────── */

    useEffect(() => {
      let cancelled = false

      async function connectWs() {
        try {
          const ds = await getDatastream()

          const priceUnsub = ds.subscribe(`price:${tokenAddress}`, (data: any) => {
            if (cancelled || !candleSeriesRef.current) return
            const raw = data?.price ?? data?.aggregated?.average ?? 0
            const price = marketCapMode ? raw * supply : raw

            const last = lastBarRef.current
            if (!last) return

            const now = Math.floor(Date.now() / 1000)
            const resMs = RESOLUTION_MS[res] ?? 60_000
            const resSec = resMs / 1000
            const barTime = (Math.floor(now / resSec) * resSec) as Time

            if ((barTime as number) > (last.time as number)) {
              const newBar: ChartBar = {
                time: barTime, open: price, high: price, low: price, close: price, volume: 0,
              }
              lastBarRef.current = newBar
              candleSeriesRef.current!.update({
                time: barTime, open: price, high: price, low: price, close: price,
              })
            } else {
              last.close = price
              last.high = Math.max(last.high, price)
              last.low = Math.min(last.low, price)
              candleSeriesRef.current!.update({
                time: last.time, open: last.open, high: last.high, low: last.low, close: last.close,
              })
            }
          })
          wsUnsubsRef.current.push(priceUnsub)

          const txUnsub = ds.subscribe(`tx:${tokenAddress}`, (data: any) => {
            if (cancelled || !data || !onTransaction) return
            onTransaction({
              signature: data.signature ?? data.tx ?? '',
              wallet: data.wallet ?? data.owner ?? '',
              type: data.type === 'sell' ? 'sell' : 'buy',
              tokenAmount: data.tokenAmount ?? data.amount ?? 0,
              solAmount: data.solAmount ?? 0,
              priceUsd: data.priceUsd ?? data.price ?? 0,
              volumeUsd: data.volumeUsd ?? data.volume ?? 0,
              timestamp: data.timestamp ?? Date.now(),
              pool: data.pool,
              marketCap: data.marketCap,
            })
          })
          wsUnsubsRef.current.push(txUnsub)
        } catch (e) {
          console.error('[chart] WS connect error:', e)
        }
      }

      connectWs()

      return () => {
        cancelled = true
        wsUnsubsRef.current.forEach(fn => fn())
        wsUnsubsRef.current = []
      }
    }, [tokenAddress, marketCapMode, supply, res, onTransaction])

    /* ── Toolbar ────────────────────────────────────────── */

    const btnStyle = (active: boolean): React.CSSProperties => ({
      padding: '4px 10px',
      fontSize: 12,
      fontWeight: 600,
      borderRadius: 4,
      cursor: 'pointer',
      border: 'none',
      transition: 'all .15s',
      background: active ? p.toolbarActiveBg : 'transparent',
      color: active ? p.toolbarActiveText : p.toolbarText,
    })

    return (
      <div className="flex flex-col w-full h-full" style={{ minHeight: 400 }}>
        {/* Toolbar */}
        <div
          className="flex items-center gap-1 px-3 py-1.5 shrink-0 overflow-x-auto"
          style={{ background: p.toolbarBg, borderBottom: `1px solid ${p.toolbarBorder}` }}
        >
          {/* Resolution selector */}
          {RESOLUTION_OPTIONS.map(r => (
            <button key={r} style={btnStyle(res === r)} onClick={() => setRes(r)}>
              {r.toUpperCase()}
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: p.toolbarBorder, margin: '0 6px' }} />
          {/* Price / Market Cap toggle */}
          <button style={btnStyle(!marketCapMode)} onClick={() => setMarketCapMode(false)}>
            Price
          </button>
          <button style={btnStyle(marketCapMode)} onClick={() => setMarketCapMode(true)}>
            MC
          </button>
          <div style={{ width: 1, height: 20, background: p.toolbarBorder, margin: '0 6px' }} />
          <span style={{ fontSize: 12, color: p.toolbarText, fontWeight: 600 }}>
            {symbol}/USD
          </span>
          {loading && (
            <span style={{ fontSize: 11, color: p.toolbarText, marginLeft: 'auto' }}>
              Loading…
            </span>
          )}
        </div>

        {/* Chart container */}
        <div ref={containerRef} className="flex-1 w-full" style={{ background: p.bg, minHeight: 0 }} />
      </div>
    )
  }
)

export default LightweightChart
