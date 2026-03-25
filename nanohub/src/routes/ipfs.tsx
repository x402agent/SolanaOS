import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import {
  Cloud,
  Database,
  Download,
  FileText,
  Globe,
  HardDrive,
  Lock,
  Network,
  Rocket,
  Shield,
  Smartphone,
  Upload,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import { getNanoHubSiteUrl } from '../lib/site'
import { useAuthStatus } from '../lib/useAuthStatus'

export const Route = createFileRoute('/ipfs')({
  head: () => {
    const url = `${getNanoHubSiteUrl()}/ipfs`
    const title = 'IPFS Hub | SolanaOS Private File Storage'
    const description =
      'Private IPFS file storage scoped per Solana wallet and GitHub account. Upload, serve, and recall files across web, Seeker mobile, Android, and Tailscale mesh nodes.'

    return {
      links: [{ rel: 'canonical', href: url }],
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: url },
      ],
    }
  },
  component: IPFSHubPage,
})

function IPFSHubPage() {
  const { isAuthenticated, me } = useAuthStatus()
  const [walletFilter, setWalletFilter] = useState('')

  const walletAddress =
    walletFilter || (me as any)?.solanaWalletAddress || ''

  const files = useQuery(
    api.ipfsHub.listByWallet,
    walletAddress ? { solanaWallet: walletAddress, limit: 50 } : 'skip',
  )
  const stats = useQuery(
    api.ipfsHub.getWalletStorageStats,
    walletAddress ? { solanaWallet: walletAddress } : 'skip',
  )
  const groups = useQuery(
    api.ipfsHub.getGroupsByWallet,
    walletAddress ? { solanaWallet: walletAddress } : 'skip',
  )

  return (
    <main className="section">
      <section className="agent-shell">
        {/* Hero */}
        <div className="gallery-hero">
          <div className="gallery-copy">
            <p className="gallery-eyebrow">SolanaOS IPFS Hub</p>
            <h1 className="section-title" style={{ margin: 0 }}>
              Private IPFS File Storage
            </h1>
            <p className="gallery-copy-text">
              Upload, serve, and recall files on Pinata Private IPFS — scoped per Solana wallet
              and GitHub account. Files sync across Seeker mobile, Android app, and Tailscale
              mesh network. Deploy agents to Solana mainnet via 8004 + Metaplex.
            </p>
          </div>
          {stats && (
            <div className="gallery-stats">
              <div className="gallery-stat-card">
                <span className="gallery-stat-value">{stats.totalFiles}</span>
                <span className="gallery-stat-label">Total files</span>
              </div>
              <div className="gallery-stat-card">
                <span className="gallery-stat-value">{formatSize(stats.totalSize)}</span>
                <span className="gallery-stat-label">Total size</span>
              </div>
              <div className="gallery-stat-card">
                <span className="gallery-stat-value">{stats.privateCount}</span>
                <span className="gallery-stat-label">Private</span>
              </div>
              <div className="gallery-stat-card">
                <span className="gallery-stat-value">{stats.syncedCount}</span>
                <span className="gallery-stat-label">Mesh synced</span>
              </div>
            </div>
          )}
        </div>

        {/* Feature cards */}
        <div className="agent-feed-grid" style={{ marginBottom: '2rem' }}>
          <FeatureCard
            icon={<Lock className="h-5 w-5" />}
            title="Private IPFS"
            description="Files stored on Pinata Private IPFS. Only accessible via temporary signed URLs."
          />
          <FeatureCard
            icon={<Wallet className="h-5 w-5" />}
            title="Wallet-Scoped"
            description="Every file is tied to your Solana wallet. Cross-referenced with GitHub via Convex."
          />
          <FeatureCard
            icon={<Rocket className="h-5 w-5" />}
            title="Mainnet Deploy"
            description="Pin metadata to IPFS, then register on-chain via 8004 Agent Registry + Metaplex Core NFTs."
          />
          <FeatureCard
            icon={<Network className="h-5 w-5" />}
            title="Mesh Sync"
            description="Auto-distribute files to Tailscale peers and Bluetooth LE Seeker devices."
          />
          <FeatureCard
            icon={<Smartphone className="h-5 w-5" />}
            title="Seeker + Android"
            description="Upload from Seeker camera, presigned URLs for direct mobile upload without exposing keys."
          />
          <FeatureCard
            icon={<Shield className="h-5 w-5" />}
            title="8004 + Metaplex"
            description="Deploy dual-mode: 8004 Trustless Agent Registry with ATOM reputation + Metaplex mpl-core NFTs."
          />
        </div>

        {/* Wallet filter */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Wallet className="h-4 w-4" style={{ opacity: 0.6 }} />
            <input
              type="text"
              placeholder="Solana wallet address..."
              value={walletFilter}
              onChange={(e) => setWalletFilter(e.target.value.trim())}
              className="input"
              style={{ flex: 1, minWidth: '240px' }}
            />
            {walletAddress && (
              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
              </span>
            )}
          </div>
        </div>

        {/* Groups */}
        {groups && groups.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>
              <Database className="h-4 w-4" style={{ display: 'inline', marginRight: '0.5rem' }} />
              IPFS Groups
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {groups.map((g: any) => (
                <span key={g._id} className="badge" style={{ padding: '0.25rem 0.75rem' }}>
                  {g.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* File list */}
        {!walletAddress ? (
          <div className="gallery-empty card">
            <div className="dashboard-empty">
              <Cloud className="dashboard-empty-icon" aria-hidden="true" />
              <h2>Connect your wallet</h2>
              <p>Enter a Solana wallet address or connect via the dashboard to see your IPFS files.</p>
              <Link to="/dashboard" className="btn btn-primary">
                Open Dashboard
              </Link>
            </div>
          </div>
        ) : files === undefined ? (
          <div className="card">Loading files...</div>
        ) : files.length === 0 ? (
          <div className="gallery-empty card">
            <div className="dashboard-empty">
              <Upload className="dashboard-empty-icon" aria-hidden="true" />
              <h2>No files yet</h2>
              <p>Upload files via the Go daemon, Seeker app, or mesh network to see them here.</p>
            </div>
          </div>
        ) : (
          <div className="agent-feed-grid">
            {files.map((file: any) => (
              <article key={file._id} className="agent-card">
                <div className="agent-card-top">
                  <div>
                    <h3 style={{ fontSize: '0.95rem' }}>
                      <FileText className="h-4 w-4" style={{ display: 'inline', marginRight: '0.35rem' }} />
                      {file.name}
                    </h3>
                    <p className="agent-card-subtitle">
                      {file.network} · {formatSize(file.size)} · {file.mimeType || 'unknown'}
                    </p>
                  </div>
                  <span className={`agent-status agent-status-${file.syncStatus || 'local'}`}>
                    {file.syncStatus || 'local'}
                  </span>
                </div>

                <div className="agent-meta-grid">
                  <div className="agent-meta-item">
                    <HardDrive className="h-4 w-4" aria-hidden="true" />
                    <span className="agent-meta-label">CID</span>
                    <span className="agent-meta-value" style={{ fontSize: '0.7rem', wordBreak: 'break-all' }}>
                      {file.cid}
                    </span>
                  </div>
                  {file.deviceId && (
                    <div className="agent-meta-item">
                      <Smartphone className="h-4 w-4" aria-hidden="true" />
                      <span className="agent-meta-label">Device</span>
                      <span className="agent-meta-value">{file.deviceId}</span>
                    </div>
                  )}
                  {file.meshNodeId && (
                    <div className="agent-meta-item">
                      <Globe className="h-4 w-4" aria-hidden="true" />
                      <span className="agent-meta-label">Mesh Node</span>
                      <span className="agent-meta-value">{file.meshNodeId}</span>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', opacity: 0.5 }}>
                  {new Date(file.createdAt).toLocaleString()}
                </div>
              </article>
            ))}
          </div>
        )}

        {/* How it works */}
        <div className="card" style={{ marginTop: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>How It Works</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <Step
              num="1"
              title="Upload to Private IPFS"
              description="Files are uploaded to Pinata Private IPFS, scoped to your Solana wallet via groups and keyvalues. Supports web hub, Go daemon, Seeker mobile, and Android app."
            />
            <Step
              num="2"
              title="Track in Convex"
              description="Every upload is tracked in the Convex database, linking Pinata file IDs to your Solana wallet and GitHub account. Real-time sync across all surfaces."
            />
            <Step
              num="3"
              title="Deploy to Solana Mainnet"
              description="Pin agent metadata + NFT metadata to IPFS, then register on-chain via 8004 Agent Registry (with ATOM reputation) and/or Metaplex Core NFTs with identity PDAs."
            />
            <Step
              num="4"
              title="Mesh Sync"
              description="Files auto-distribute to all online Tailscale peers and BLE-connected Seeker devices. Temporary access links keep private files secure during transfer."
            />
            <Step
              num="5"
              title="Recall on Any Device"
              description="Generate temporary signed URLs to access private files from any authenticated surface — web, mobile, CLI, or mesh node."
            />
          </div>
        </div>

        {/* API reference */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>API Endpoints</h2>
          <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: '1.8' }}>
            <div><strong>GET</strong> /api/v1/ipfs/files?wallet=...&amp;github=...&amp;device=...</div>
            <div><strong>GET</strong> /api/v1/ipfs/files/:cid</div>
            <div><strong>GET</strong> /api/v1/ipfs/stats?wallet=...</div>
            <div><strong>GET</strong> /api/v1/ipfs/groups?wallet=...</div>
            <div><strong>POST</strong> /api/v1/ipfs/track — record uploaded file</div>
            <div><strong>POST</strong> /api/v1/ipfs/access — log access link creation</div>
            <div><strong>POST</strong> /api/v1/ipfs/deploy — deploy agent to mainnet (8004 + Metaplex)</div>
            <div><strong>POST</strong> /api/v1/ipfs/delete — remove tracked file</div>
          </div>
        </div>
      </section>
    </main>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {icon}
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{title}</h3>
      </div>
      <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>{description}</p>
    </div>
  )
}

function Step({ num, title, description }: { num: string; title: string; description: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '1.75rem',
          height: '1.75rem',
          borderRadius: '50%',
          background: 'var(--accent, #14f195)',
          color: '#000',
          fontWeight: 700,
          fontSize: '0.8rem',
          flexShrink: 0,
        }}
      >
        {num}
      </span>
      <div>
        <strong>{title}</strong>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', opacity: 0.7 }}>{description}</p>
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}
