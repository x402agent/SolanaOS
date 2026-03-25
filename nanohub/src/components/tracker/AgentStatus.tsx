/**
 * AgentStatus — Shows the on-chain scanner agent's reputation and trust tier.
 * Fetches from /st/agent-registry edge function.
 */
import { useState, useEffect } from 'react'

interface AgentReputation {
  asset: string
  agent: {
    name: string
    uri: string
    owner: string
    wallet: string
    atom_enabled: boolean
    created_at: string
  } | null
  reputation: {
    atomScore: number
    trustTier: string
    feedbackCount: number
    positiveCount: number
    negativeCount: number
    recentFeedbacks: Array<{ score: number; tag1: string; created_at: string }>
  }
  timestamp: string
}

const tierConfig: Record<string, { color: string; bg: string; label: string }> = {
  platinum: { color: 'text-cyan-300', bg: 'bg-cyan-500/20', label: 'Platinum' },
  gold: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Gold' },
  silver: { color: 'text-gray-300', bg: 'bg-gray-400/20', label: 'Silver' },
  bronze: { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Bronze' },
  unrated: { color: 'text-gray-500', bg: 'bg-gray-600/20', label: 'Unrated' },
}

export function AgentStatus({ assetAddress }: { assetAddress?: string }) {
  const [data, setData] = useState<AgentReputation | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!assetAddress) return
    setLoading(true)
    fetch(`/st/agent-registry?asset=${assetAddress}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [assetAddress])

  if (!assetAddress) return null
  if (loading) return <div className="text-xs text-gray-500">Loading agent...</div>
  if (!data?.agent) return null

  const tier = tierConfig[data.reputation.trustTier] ?? tierConfig.unrated
  const rep = data.reputation

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-medium text-white">{data.agent.name}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tier.bg} ${tier.color}`}>
            {tier.label}
          </span>
        </div>
        <a
          href={`https://explorer.solana.com/address/${data.asset}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-gray-500 hover:text-blue-400 font-mono"
        >
          {data.asset.slice(0, 6)}...{data.asset.slice(-4)}
        </a>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="text-lg font-bold text-white">{rep.atomScore}</div>
          <div className="text-[10px] text-gray-500">ATOM Score</div>
        </div>
        <div>
          <div className="text-lg font-bold text-white">{rep.feedbackCount}</div>
          <div className="text-[10px] text-gray-500">Feedbacks</div>
        </div>
        <div>
          <div className="text-lg font-bold text-green-400">{rep.positiveCount}</div>
          <div className="text-[10px] text-gray-500">Positive</div>
        </div>
        <div>
          <div className="text-lg font-bold text-red-400">{rep.negativeCount}</div>
          <div className="text-[10px] text-gray-500">Negative</div>
        </div>
      </div>

      {data.agent.atom_enabled && (
        <div className="text-[10px] text-gray-600 text-center">
          ATOM reputation engine active
        </div>
      )}
    </div>
  )
}

export default AgentStatus
