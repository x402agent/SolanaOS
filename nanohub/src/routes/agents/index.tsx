import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Bot, Hexagon, Wallet } from 'lucide-react'
import type { Doc } from '../../../convex/_generated/dataModel'
import { api } from '../../../convex/_generated/api'

type PublicAgent = Doc<'nanosolanaAgents'> & {
  explorerAssetUrl: string | null
  explorerRegistrationUrl: string | null
  explorerTransferUrl: string | null
  explorerMetaplexAssetUrl?: string | null
  explorerMetaplexRegistrationUrl?: string | null
  explorerMetaplexDelegateUrl?: string | null
  explorerMetaplexTransferUrl?: string | null
}

export const Route = createFileRoute('/agents/')({
  component: AgentsIndexPage,
})

function AgentsIndexPage() {
  const agents = (useQuery(api.nanosolanaAgents.listRecentPublic, { limit: 36 }) as PublicAgent[] | undefined) ?? []

  return (
    <main className="section">
      <section className="agent-shell">
        <div className="gallery-hero">
          <div className="gallery-copy">
            <p className="gallery-eyebrow">SolanaOS Agent Directory</p>
            <h1 className="section-title" style={{ margin: 0 }}>
              Registered 8004 + Metaplex agents
            </h1>
            <p className="gallery-copy-text">
              Public agent pages backed by Convex, with on-chain 8004 and Metaplex registry state,
              explorer links, and service endpoints served from the Hub.
            </p>
          </div>
          <div className="gallery-stats">
            <div className="gallery-stat-card">
              <span className="gallery-stat-value">{agents.length}</span>
              <span className="gallery-stat-label">Public agents</span>
            </div>
            <div className="gallery-stat-card">
              <span className="gallery-stat-value">{agents.filter((agent) => agent.metaplexRegistered).length}</span>
              <span className="gallery-stat-label">Metaplex linked</span>
            </div>
          </div>
        </div>

        {agents.length === 0 ? (
          <div className="gallery-empty card">
            <div className="dashboard-empty">
              <Bot className="dashboard-empty-icon" aria-hidden="true" />
              <h2>No public agents yet</h2>
              <p>Create one from the dashboard and it will appear here.</p>
              <Link to="/dashboard" className="btn btn-primary">
                Open Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <div className="agent-feed-grid">
            {agents.map((agent) => (
              <article key={agent._id} className="agent-card">
                <div className="agent-card-top">
                  <div>
                    <h3>{agent.name}</h3>
                    <p className="agent-card-subtitle">
                      {agent.symbol ? `${agent.symbol} · ` : ''}
                      {agent.cluster} · {agent.registryMode}
                    </p>
                  </div>
                  <span className={`agent-status agent-status-${agent.status}`}>{agent.status}</span>
                </div>

                <p className="agent-card-description">{agent.description}</p>

                <div className="agent-meta-grid">
                  <div className="agent-meta-item">
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    <span>{shortAddress(agent.ownerWalletAddress)}</span>
                  </div>
                  <div className="agent-meta-item">
                    <Hexagon className="h-4 w-4" aria-hidden="true" />
                    <span>{agent.metaplexRegistered ? 'Metaplex 014 linked' : '8004 only'}</span>
                  </div>
                </div>

                <div className="agent-link-list">
                  <Link to="/agents/$agentRef" params={{ agentRef: String(agent._id) }}>
                    Open public profile
                  </Link>
                  {agent.explorerAssetUrl ? (
                    <a href={agent.explorerAssetUrl} target="_blank" rel="noreferrer">
                      Explorer asset
                    </a>
                  ) : null}
                  {agent.explorerMetaplexAssetUrl ? (
                    <a href={agent.explorerMetaplexAssetUrl} target="_blank" rel="noreferrer">
                      Metaplex asset
                    </a>
                  ) : null}
                </div>

                <div className="agent-pill-row">
                  {agent.services.slice(0, 5).map((service) => (
                    <span key={`${agent._id}-${service.type}-${service.value}`} className="agent-pill">
                      {service.type}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function shortAddress(value: string) {
  return value.length > 12 ? `${value.slice(0, 4)}…${value.slice(-4)}` : value
}
