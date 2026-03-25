import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Bot, ExternalLink, Hexagon, LinkIcon, Wallet } from 'lucide-react'
import type { Doc } from '../../../convex/_generated/dataModel'
import { api } from '../../../convex/_generated/api'
import { getNanoHubSiteUrl } from '../../lib/site'

type PublicAgent = Doc<'nanosolanaAgents'> & {
  explorerAssetUrl: string | null
  explorerRegistrationUrl: string | null
  explorerTransferUrl: string | null
  explorerMetaplexAssetUrl?: string | null
  explorerMetaplexRegistrationUrl?: string | null
  explorerMetaplexDelegateUrl?: string | null
  explorerMetaplexTransferUrl?: string | null
}

export const Route = createFileRoute('/agents/$agentRef')({
  component: AgentProfilePage,
})

function AgentProfilePage() {
  const { agentRef } = Route.useParams()
  const agent = useQuery(api.nanosolanaAgents.getPublicByRef, { ref: agentRef }) as PublicAgent | null | undefined

  const registrationUrl = `${convexSiteUrl()}/nanosolana/agents/registration?id=${encodeURIComponent(agentRef)}`
  const agentCardUrl = `${convexSiteUrl()}/nanosolana/agents/agent-card?id=${encodeURIComponent(agentRef)}`

  return (
    <main className="section">
      {agent === undefined ? (
        <div className="card">Loading agent…</div>
      ) : agent === null ? (
        <div className="gallery-empty card">
          <div className="dashboard-empty">
            <Bot className="dashboard-empty-icon" aria-hidden="true" />
            <h2>Agent not found</h2>
            <p>No public SolanaOS agent matched this reference.</p>
            <Link to="/agents" className="btn btn-primary">
              Back to directory
            </Link>
          </div>
        </div>
      ) : (
        <section className="agent-shell">
          <div className="gallery-hero">
            <div className="gallery-copy">
              <p className="gallery-eyebrow">Public agent profile</p>
              <h1 className="section-title" style={{ margin: 0 }}>
                {agent.name}
              </h1>
              <p className="gallery-copy-text">{agent.description}</p>
            </div>
            <div className="gallery-stats">
              <div className="gallery-stat-card">
                <span className="gallery-stat-value">{agent.registryMode}</span>
                <span className="gallery-stat-label">Registry mode</span>
              </div>
              <div className="gallery-stat-card">
                <span className="gallery-stat-value">{agent.metaplexRegistered ? 'yes' : 'no'}</span>
                <span className="gallery-stat-label">Metaplex 014</span>
              </div>
            </div>
          </div>

          <div className="agent-layout">
            <div className="gallery-upload card">
              <div className="gallery-panel-header">
                <div>
                  <h2>Identity</h2>
                  <p>Convex-backed public record for the agent’s 8004 and Metaplex registrations.</p>
                </div>
                <Hexagon className="gallery-panel-icon" aria-hidden="true" />
              </div>

              <div className="agent-meta-grid">
                <div className="agent-meta-item">
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                  <span>{shortAddress(agent.ownerWalletAddress)}</span>
                </div>
                <div className="agent-meta-item">
                  <LinkIcon className="h-4 w-4" aria-hidden="true" />
                  <span>{agent.cluster}</span>
                </div>
              </div>

              <div className="agent-link-list">
                <a href={registrationUrl} target="_blank" rel="noreferrer">
                  Registration JSON
                </a>
                <a href={agentCardUrl} target="_blank" rel="noreferrer">
                  Agent card JSON
                </a>
                {agent.metadataUri ? (
                  <a href={agent.metadataUri.replace('ipfs://', 'https://ipfs.io/ipfs/')} target="_blank" rel="noreferrer">
                    IPFS metadata
                  </a>
                ) : null}
                {agent.explorerAssetUrl ? (
                  <a href={agent.explorerAssetUrl} target="_blank" rel="noreferrer">
                    8004 explorer asset
                  </a>
                ) : null}
                {agent.explorerMetaplexAssetUrl ? (
                  <a href={agent.explorerMetaplexAssetUrl} target="_blank" rel="noreferrer">
                    Metaplex explorer asset
                  </a>
                ) : null}
              </div>

              {agent.services.length > 0 ? (
                <div className="agent-pill-row">
                  {agent.services.map((service) => (
                    <span key={`${service.type}-${service.value}`} className="agent-pill">
                      {service.type}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="agent-feed">
              <div className="agent-card">
                <div className="agent-card-top">
                  <div>
                    <h3>Service endpoints</h3>
                    <p className="agent-card-subtitle">What the on-chain registration points to</p>
                  </div>
                </div>
                <div className="agent-link-list">
                  {agent.services.map((service) => (
                    <a key={`${service.type}-${service.value}`} href={service.value} target="_blank" rel="noreferrer">
                      {service.type} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>

              <div className="agent-card" style={{ marginTop: 16 }}>
                <div className="agent-card-top">
                  <div>
                    <h3>Transaction trail</h3>
                    <p className="agent-card-subtitle">Registration, delegation, and transfer links</p>
                  </div>
                </div>
                <div className="agent-link-list">
                  {agent.explorerRegistrationUrl ? (
                    <a href={agent.explorerRegistrationUrl} target="_blank" rel="noreferrer">
                      8004 register tx
                    </a>
                  ) : null}
                  {agent.explorerTransferUrl ? (
                    <a href={agent.explorerTransferUrl} target="_blank" rel="noreferrer">
                      8004 transfer tx
                    </a>
                  ) : null}
                  {agent.explorerMetaplexRegistrationUrl ? (
                    <a href={agent.explorerMetaplexRegistrationUrl} target="_blank" rel="noreferrer">
                      Metaplex register tx
                    </a>
                  ) : null}
                  {agent.explorerMetaplexDelegateUrl ? (
                    <a href={agent.explorerMetaplexDelegateUrl} target="_blank" rel="noreferrer">
                      Metaplex delegate tx
                    </a>
                  ) : null}
                  {agent.explorerMetaplexTransferUrl ? (
                    <a href={agent.explorerMetaplexTransferUrl} target="_blank" rel="noreferrer">
                      Metaplex transfer tx
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

function convexSiteUrl() {
  return (import.meta.env.VITE_CONVEX_SITE_URL?.trim() || getNanoHubSiteUrl()).replace(/\/$/, '')
}

function shortAddress(value: string) {
  return value.length > 12 ? `${value.slice(0, 4)}…${value.slice(-4)}` : value
}
