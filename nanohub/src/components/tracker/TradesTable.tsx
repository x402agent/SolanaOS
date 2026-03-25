/**
 * TradesTable — Live trades with wallet filtering and Solscan links.
 */
import { useMemo } from 'react'

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

function fmtTime(ts: number): string {
  const d = new Date(ts < 1e12 ? ts * 1000 : ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtPrice(n: number): string {
  if (!n) return '$0'
  if (n < 0.00001) return `$${n.toExponential(2)}`
  if (n < 0.01) return `$${n.toFixed(8)}`
  if (n < 1) return `$${n.toFixed(6)}`
  if (n < 100) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

function fmtAmt(n: number): string {
  if (!n) return '0'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toFixed(2)
}

function fmt$(n: number): string {
  if (!n) return '$0'
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

export function TradesTable({
  trades,
  tokenSupply = 0,
  activeWallet,
  onWalletFilter,
}: {
  trades: TokenTransaction[]
  tokenSupply?: number
  activeWallet?: string | null
  onWalletFilter?: (wallet: string | null) => void
}) {
  const sorted = useMemo(() =>
    [...trades].sort((a, b) => b.timestamp - a.timestamp).slice(0, 200),
    [trades]
  )

  return (
    <div className="w-full bg-[#0f0f23]/80 rounded-xl border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <h3 className="text-sm font-bold text-white">
          Trades
          {sorted.length > 0 && <span className="text-gray-500 font-normal ml-1">({sorted.length})</span>}
        </h3>
        {activeWallet && (
          <button
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            onClick={() => onWalletFilter?.(null)}
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Header */}
      <div className="grid grid-cols-[70px_50px_1fr_80px_80px_80px_110px_60px] gap-1 px-3 py-2 text-[10px] text-gray-500 font-semibold uppercase border-b border-white/5">
        <span>Time</span>
        <span>Type</span>
        <span>Price</span>
        <span>Amount</span>
        <span>Vol USD</span>
        <span>MC</span>
        <span>Wallet</span>
        <span>TX</span>
      </div>

      {/* Rows */}
      <div className="max-h-[400px] overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">No trades yet</div>
        ) : (
          sorted.map((tx, i) => {
            const isBuy = tx.type === 'buy'
            const isActive = activeWallet && tx.wallet === activeWallet
            const mc = tx.marketCap ?? (tx.priceUsd && tokenSupply ? tx.priceUsd * tokenSupply : 0)

            return (
              <div
                key={tx.signature || i}
                className={`grid grid-cols-[70px_50px_1fr_80px_80px_80px_110px_60px] gap-1 px-3 py-1.5 items-center text-xs border-b border-white/[.02] hover:bg-white/[.02] transition-colors ${isActive ? 'bg-blue-500/10' : ''}`}
              >
                <span className="text-gray-400 font-mono">{fmtTime(tx.timestamp)}</span>
                <span className={`font-bold ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                  {isBuy ? 'BUY' : 'SELL'}
                </span>
                <span className="text-gray-300">{fmtPrice(tx.priceUsd)}</span>
                <span className="text-gray-300">{fmtAmt(tx.tokenAmount)}</span>
                <span className="text-gray-300">{fmt$(tx.volumeUsd)}</span>
                <span className="text-gray-400">{fmt$(mc)}</span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 font-mono truncate">
                    {tx.wallet.slice(0, 4)}…{tx.wallet.slice(-4)}
                  </span>
                  <button
                    className="text-gray-500 hover:text-blue-400 transition-colors shrink-0"
                    onClick={() => onWalletFilter?.(tx.wallet === activeWallet ? null : tx.wallet)}
                    title="Filter by wallet"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                  </button>
                </div>
                <a
                  href={`https://solscan.io/tx/${tx.signature}`}
                  target="_blank"
                  rel="noopener"
                  className="text-gray-500 hover:text-blue-400 transition-colors font-mono truncate"
                  title={tx.signature}
                >
                  {tx.signature.slice(0, 6)}…
                </a>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default TradesTable
