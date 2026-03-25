/**
 * RugCheck — Token risk analysis with scoring and detailed breakdown.
 */
import { useState, useCallback } from 'react'
import { solanaTrackerApi } from '../../lib/solanaTrackerApi'

function fmt$(n: number | undefined): string {
  if (!n) return '$0'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

function ScoreRing({ score }: { score: number }) {
  const color = score <= 3 ? '#16a34a' : score <= 6 ? '#eab308' : '#dc2626'
  const label = score <= 3 ? 'Low Risk' : score <= 6 ? 'Medium Risk' : 'High Risk'
  const pct = (score / 10) * 100
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${pct * 2.64} ${264 - pct * 2.64}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>{score}</span>
          <span className="text-sm text-gray-500">/10</span>
        </div>
      </div>
      <span className="text-sm font-semibold" style={{ color }}>{label}</span>
    </div>
  )
}

function RiskFactorRow({ name, level, desc }: { name: string; level?: string; desc?: string }) {
  const color = level === 'danger' || level === 'high' ? 'bg-red-500' : level === 'warn' || level === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
      <div className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white font-medium">{name}</div>
        {desc && <div className="text-xs text-gray-500 truncate">{desc}</div>}
      </div>
      {level && <span className="text-xs text-gray-400 capitalize">{level}</span>}
    </div>
  )
}

function HolderBar({ address, pct }: { address: string; pct: number }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs text-gray-400 w-20 truncate font-mono">{address.slice(0, 6)}…</span>
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full bg-blue-500/60" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-300 w-12 text-right">{pct.toFixed(1)}%</span>
    </div>
  )
}

export function RugCheck() {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const doCheck = useCallback(async () => {
    const addr = address.trim()
    if (!addr) return
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const result = await solanaTrackerApi.getRugCheck(addr)
      setData(result)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }, [address])

  const token = data?.token?.token ?? data?.token
  const pool = data?.token?.pools?.[0] ?? {}
  const rug = data?.rugCheck
  const score = rug?.score ?? data?.token?.risk?.level ?? data?.token?.risk?.score
  const risks = rug?.risks ?? []
  const topHolders = rug?.topHolders ?? []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          className="flex-1 bg-[#1a1a2e] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50"
          placeholder="Enter token address…"
          value={address}
          onChange={e => setAddress(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doCheck()}
        />
        <button
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          onClick={doCheck}
          disabled={loading || !address.trim()}
        >
          {loading ? 'Checking…' : 'Check'}
        </button>
      </div>

      {error && <div className="text-center py-4 text-red-400 text-sm">{error}</div>}

      {data && (
        <>
          {/* Token info + score */}
          <div className="bg-[#0f0f23]/80 rounded-xl border border-white/5 p-6">
            <div className="flex items-start gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  {token?.image && <img src={token.image} alt="" className="w-10 h-10 rounded-full" />}
                  <div>
                    <h2 className="text-lg font-bold text-white">{token?.name ?? 'Unknown'}</h2>
                    <p className="text-sm text-gray-400">{token?.symbol ?? '?'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Price:</span> <span className="text-white">{token?.price ? fmt$(token.price) : 'N/A'}</span></div>
                  <div><span className="text-gray-500">Market Cap:</span> <span className="text-white">{fmt$(pool?.marketCap?.usd)}</span></div>
                  <div><span className="text-gray-500">Liquidity:</span> <span className="text-white">{fmt$(pool?.liquidity?.usd)}</span></div>
                  <div><span className="text-gray-500">Supply:</span> <span className="text-white">{pool?.tokenSupply?.toLocaleString() ?? 'N/A'}</span></div>
                </div>

                {/* Authority info */}
                <div className="mt-4 space-y-1 text-xs">
                  {rug?.mintAuthority !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${rug.mintAuthority ? 'bg-red-500' : 'bg-green-500'}`} />
                      <span className="text-gray-400">Mint Authority: {rug.mintAuthority ? 'Enabled' : 'Revoked'}</span>
                    </div>
                  )}
                  {rug?.freezeAuthority !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${rug.freezeAuthority ? 'bg-red-500' : 'bg-green-500'}`} />
                      <span className="text-gray-400">Freeze Authority: {rug.freezeAuthority ? 'Enabled' : 'Revoked'}</span>
                    </div>
                  )}
                  {rug?.lpLocked !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${rug.lpLocked ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      <span className="text-gray-400">LP Locked: {rug.lpLocked ? `Yes (${rug.lpLockedPct ?? '?'}%)` : 'No'}</span>
                    </div>
                  )}
                </div>
              </div>
              {score !== undefined && score !== null && <ScoreRing score={typeof score === 'number' ? score : parseInt(score)} />}
            </div>
          </div>

          {/* Risk factors */}
          {risks.length > 0 && (
            <div className="bg-[#0f0f23]/80 rounded-xl border border-white/5 p-5">
              <h3 className="text-sm font-bold text-white mb-3">Risk Factors</h3>
              {risks.map((r: any, i: number) => (
                <RiskFactorRow key={i} name={r.name ?? r.title ?? 'Unknown'} level={r.level ?? r.severity} desc={r.description} />
              ))}
            </div>
          )}

          {/* Top holders */}
          {topHolders.length > 0 && (
            <div className="bg-[#0f0f23]/80 rounded-xl border border-white/5 p-5">
              <h3 className="text-sm font-bold text-white mb-3">Top Holders</h3>
              {topHolders.slice(0, 10).map((h: any, i: number) => (
                <HolderBar key={i} address={h.address ?? h.owner ?? '?'} pct={h.pct ?? h.percentage ?? 0} />
              ))}
            </div>
          )}
        </>
      )}

      {!data && !loading && !error && (
        <div className="bg-[#0f0f23]/80 rounded-xl border border-white/5 p-8 text-center space-y-4">
          <div className="text-4xl">🛡</div>
          <h2 className="text-lg font-bold text-white">Solana Rug Check</h2>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Enter any Solana token address to get an instant risk analysis with scoring,
            holder distribution, authority checks, and more.
          </p>
          <div className="flex justify-center gap-8 text-xs text-gray-500 pt-2">
            <div><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />0-3 Low Risk</div>
            <div><span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1" />4-6 Medium</div>
            <div><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />7-10 High Risk</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RugCheck
