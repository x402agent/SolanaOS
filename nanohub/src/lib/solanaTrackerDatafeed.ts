/**
 * TradingView DataFeed implementation for Solana Tracker.
 * Adapted from the solana-tradingview-advanced-chart-example for TanStack Start.
 */

import { solanaTrackerApi } from './solanaTrackerApi'
import { getDatastream, type SolanaTrackerDatastream } from './solanaTrackerDatastream'

export interface TokenTransaction {
  signature: string
  wallet: string
  type: 'buy' | 'sell'
  tokenAmount: number
  solAmount: number
  priceUsd: number
  volumeUsd: number
  timestamp: number
  pool?: string
  marketCap?: number
}

interface Bar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

const RESOLUTION_MAP: Record<string, string> = {
  '1S': '1s', '5S': '5s', '15S': '15s',
  '1': '1m', '5': '5m', '15': '15m', '30': '30m',
  '60': '1h', '120': '2h', '180': '3h', '240': '4h',
  '360': '6h', '720': '12h', '1440': '1d',
}

export class SolanaTrackerDataFeed {
  private tokenAddress: string
  private tokenSymbol: string
  private marketCapMode: boolean
  private tokenSupply: number
  private onTransaction?: (tx: TokenTransaction) => void
  private lastBars = new Map<string, Bar>()
  private subscribers = new Map<string, { unsubscribes: (() => void)[] }>()
  private walletMarks: any[] = []
  private watchedWallet: string | null = null

  constructor(opts: {
    tokenAddress: string
    tokenSymbol: string
    tokenSupply?: number
    marketCapMode?: boolean
    onTransaction?: (tx: TokenTransaction) => void
  }) {
    this.tokenAddress = opts.tokenAddress
    this.tokenSymbol = opts.tokenSymbol
    this.tokenSupply = opts.tokenSupply ?? 0
    this.marketCapMode = opts.marketCapMode ?? false
    this.onTransaction = opts.onTransaction
  }

  onReady(callback: (config: any) => void) {
    setTimeout(() => callback({
      supported_resolutions: ['1S','5S','15S','1','5','15','30','60','120','180','240','360','720','1440'],
      supports_marks: true,
      supports_timescale_marks: true,
      supports_time: true,
      exchanges: [],
      symbols_types: [],
    }))
  }

  resolveSymbol(symbolName: string, onResolve: (info: any) => void) {
    setTimeout(() => onResolve({
      name: this.tokenSymbol,
      full_name: this.tokenSymbol,
      description: `${this.tokenSymbol} / USD`,
      type: 'crypto',
      session: '24x7',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      exchange: 'Solana',
      minmov: 1,
      pricescale: 100000000,
      has_intraday: true,
      has_seconds: true,
      seconds_multipliers: ['1', '5', '15'],
      supported_resolutions: ['1S','5S','15S','1','5','15','30','60','120','180','240','360','720','1440'],
      volume_precision: 2,
      data_status: 'streaming',
    }))
  }

  async getBars(
    symbolInfo: any,
    resolution: string,
    periodParams: { from: number; to: number; firstDataRequest: boolean },
    onResult: (bars: Bar[], meta: { noData: boolean }) => void,
    onError: (err: string) => void,
  ) {
    try {
      const type = RESOLUTION_MAP[resolution] ?? '1m'
      const data = await solanaTrackerApi.getChart(
        this.tokenAddress,
        type,
        this.marketCapMode,
        periodParams.firstDataRequest ? undefined : periodParams.to,
      )

      const oclhv = (data as any)?.oclhv ?? (data as any)?.ohlcv ?? []
      if (!oclhv.length) {
        onResult([], { noData: true })
        return
      }

      const bars: Bar[] = oclhv
        .map((c: number[]) => ({
          time: c[0] * 1000,
          open: c[1],
          close: c[2],
          low: c[3],
          high: c[4],
          volume: c[5] ?? 0,
        }))
        .filter((b: Bar) => b.time >= periodParams.from * 1000 && b.time <= periodParams.to * 1000)
        .sort((a: Bar, b: Bar) => a.time - b.time)

      if (bars.length > 0) {
        this.lastBars.set(resolution, { ...bars[bars.length - 1] })
      }

      onResult(bars, { noData: bars.length === 0 })
    } catch (e: any) {
      onError(e.message ?? 'Failed to fetch chart data')
    }
  }

  async subscribeBars(
    symbolInfo: any,
    resolution: string,
    onTick: (bar: Bar) => void,
    subscriberUID: string,
  ) {
    const unsubs: (() => void)[] = []
    try {
      const ds = await getDatastream()

      // Subscribe to aggregated price
      const priceUnsub = ds.subscribe(`price:${this.tokenAddress}`, (data: any) => {
        const price = this.marketCapMode
          ? (data?.price ?? data?.aggregated?.average ?? 0) * this.tokenSupply
          : (data?.price ?? data?.aggregated?.average ?? 0)

        const lastBar = this.lastBars.get(resolution)
        if (!lastBar) return

        const now = Date.now()
        const resMs = this.getResolutionMs(resolution)
        const barTime = Math.floor(now / resMs) * resMs

        if (barTime > lastBar.time) {
          // New bar
          const newBar: Bar = {
            time: barTime,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: 0,
          }
          this.lastBars.set(resolution, newBar)
          onTick(newBar)
        } else {
          // Update current bar
          lastBar.close = price
          lastBar.high = Math.max(lastBar.high, price)
          lastBar.low = Math.min(lastBar.low, price)
          onTick({ ...lastBar })
        }
      })
      unsubs.push(priceUnsub)

      // Subscribe to transactions
      const txUnsub = ds.subscribe(`tx:${this.tokenAddress}`, (data: any) => {
        if (data && this.onTransaction) {
          const tx: TokenTransaction = {
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
          }
          this.onTransaction(tx)
        }
      })
      unsubs.push(txUnsub)

    } catch (e) {
      console.error('[datafeed] subscribeBars error:', e)
    }

    this.subscribers.set(subscriberUID, { unsubscribes: unsubs })
  }

  unsubscribeBars(subscriberUID: string) {
    const sub = this.subscribers.get(subscriberUID)
    if (sub) {
      sub.unsubscribes.forEach(fn => fn())
      this.subscribers.delete(subscriberUID)
    }
  }

  async getMarks(
    symbolInfo: any,
    from: number,
    to: number,
    onDataCallback: (marks: any[]) => void,
  ) {
    const marks = this.walletMarks.filter(
      m => m.time >= from && m.time <= to
    )
    onDataCallback(marks)
  }

  searchSymbols() { /* not needed - single token */ }
  getTimescaleMarks() { /* optional */ }

  setMarketCapMode(enabled: boolean) {
    this.marketCapMode = enabled
    this.lastBars.clear()
  }

  setWalletMarks(marks: any[], wallet: string | null) {
    this.walletMarks = marks
    this.watchedWallet = wallet
  }

  getWatchedWallet() {
    return this.watchedWallet
  }

  destroy() {
    for (const [uid] of this.subscribers) {
      this.unsubscribeBars(uid)
    }
  }

  private getResolutionMs(res: string): number {
    if (res.endsWith('S')) return parseInt(res) * 1000
    const n = parseInt(res) || 1
    return n * 60 * 1000
  }
}
