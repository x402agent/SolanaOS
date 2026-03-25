import { createFileRoute, Link } from '@tanstack/react-router'
import { AddressType, usePhantom } from '@phantom/react-sdk'
import { useAction, useMutation, useQuery } from 'convex/react'
import { Bot, Clock, Github, Hexagon, ImagePlus, LinkIcon, MessageCircle, Package, Plus, Rocket, Server, Sparkles, Star, Upload, Wallet } from 'lucide-react'
import QRCode from 'qrcode'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'
import { getUserFacingConvexError } from '../lib/convexError'
import {
  createPairingSession,
  createWalletAgent,
  fetchWalletTelegramConfig,
  fetchPairingSessionStatus,
  fetchWalletSession,
  listWalletAgents,
  loadWalletSession,
  persistWalletSession,
  saveWalletTelegramConfig,
  type NanosolanaPairingEnvelope,
  type NanosolanaWalletAgent,
  type NanosolanaWalletSession,
  type NanosolanaWalletTelegramConfig,
} from '../lib/nanosolanaWalletSession'
import { formatCompactStat } from '../lib/numberFormat'
import { getSiteUrlForMode } from '../lib/site'
import { formatBytes, uploadFile } from '../lib/uploadUtils'
import { useAuthStatus } from '../lib/useAuthStatus'
import type { PublicSkill } from '../lib/publicUser'
import { useInstalledWallet } from '../components/MobileWalletAdapterProvider'

type DashboardSkill = PublicSkill & { pendingReview?: boolean }
type GalleryFeedItem = {
  artwork: Doc<'galleryArtworks'>
  artist: {
    _id: Doc<'users'>['_id']
    handle?: string | null
    name?: string | null
    displayName?: string | null
    image?: string | null
  }
  imageUrl: string
  viewerRating: number | null
}

type SolanaAgentItem = (Doc<'nanosolanaAgents'> | NanosolanaWalletAgent) & {
  registryMode: '8004' | 'metaplex' | 'dual'
  explorerAssetUrl: string | null
  explorerRegistrationUrl: string | null
  explorerTransferUrl: string | null
  explorerMetaplexAssetUrl?: string | null
  explorerMetaplexRegistrationUrl?: string | null
  explorerMetaplexDelegateUrl?: string | null
  explorerMetaplexTransferUrl?: string | null
}

type SeekerPresenceItem = {
  walletAddress: string
  displayName?: string | null
  appVersion?: string | null
  firstSeenAt: number
  lastSeenAt: number
  lastAuthAt: number
  sessionExpiresAt?: number | null
  online: boolean
}

const XAI_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'] as const
const XAI_RESOLUTIONS = ['1k', '2k'] as const

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
})

function Dashboard() {
  const { isAuthenticated, isConvexAuthed, me } = useAuthStatus()
  const galleryFeed = useQuery(api.gallery.listFeed, { limit: 24 }) as GalleryFeedItem[] | undefined
  const recentSeekers = useQuery(api.nanosolanaUsers.listRecentPublic, {
    limit: 8,
  }) as SeekerPresenceItem[] | undefined
  const convexAgents = useQuery(
    api.nanosolanaAgents.listMine,
    isConvexAuthed ? {} : 'skip',
  ) as SolanaAgentItem[] | undefined
  const mySkills = useQuery(
    api.skills.list,
    me?._id ? { ownerUserId: me._id, limit: 100 } : 'skip',
  ) as DashboardSkill[] | undefined
  const [walletSession, setWalletSession] = useState<NanosolanaWalletSession | null>(() => loadWalletSession())
  const [walletAgents, setWalletAgents] = useState<SolanaAgentItem[]>([])
  const [walletAgentsBusy, setWalletAgentsBusy] = useState(false)
  const [walletAgentsVersion, setWalletAgentsVersion] = useState(0)
  const [walletTelegramConfig, setWalletTelegramConfig] = useState<NanosolanaWalletTelegramConfig | null>(null)
  const [walletTelegramBusy, setWalletTelegramBusy] = useState(false)
  const [pairing, setPairing] = useState<NanosolanaPairingEnvelope | null>(null)
  const [pairingQrUrl, setPairingQrUrl] = useState<string | null>(null)
  const [pairingBusy, setPairingBusy] = useState(false)
  const [pairingStatus, setPairingStatus] = useState<string | null>(null)
  const [pairingError, setPairingError] = useState<string | null>(null)

  const skills = mySkills ?? []
  const ownerHandle = me ? (me.handle ?? me.name ?? me.displayName ?? me._id) : null
  const activeWalletSession =
    !isConvexAuthed && walletSession && walletSession.sessionExpiresAt > Date.now() ? walletSession : null
  const agents = isConvexAuthed ? (convexAgents ?? []) : walletAgents

  useEffect(() => {
    persistWalletSession(walletSession)
  }, [walletSession])

  useEffect(() => {
    if (!walletSession || walletSession.sessionExpiresAt <= Date.now()) {
      if (walletSession) {
        setWalletSession(null)
      }
      return
    }
    if (isConvexAuthed) return
    let cancelled = false
    fetchWalletSession(walletSession.sessionToken)
      .then((result) => {
        if (cancelled) return
        setWalletSession({
          walletAddress: result.user.walletAddress,
          displayName: result.user.displayName ?? null,
          sessionToken: result.user.sessionToken,
          sessionExpiresAt: result.user.sessionExpiresAt,
        })
      })
      .catch(() => {
        if (!cancelled) {
          setWalletSession(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [isConvexAuthed, walletSession])

  useEffect(() => {
    if (isConvexAuthed || !activeWalletSession) {
      setWalletAgents([])
      setWalletAgentsBusy(false)
      setWalletTelegramConfig(null)
      setWalletTelegramBusy(false)
      return
    }
    let cancelled = false
    setWalletAgentsBusy(true)
    listWalletAgents(activeWalletSession.sessionToken)
      .then((result) => {
        if (!cancelled) {
          setWalletAgents(result.agents)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPairingError(error instanceof Error ? error.message : 'Could not load wallet agents.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setWalletAgentsBusy(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [activeWalletSession, isConvexAuthed, walletAgentsVersion])

  useEffect(() => {
    if (isConvexAuthed || !activeWalletSession) {
      setWalletTelegramConfig(null)
      setWalletTelegramBusy(false)
      return
    }
    let cancelled = false
    setWalletTelegramBusy(true)
    fetchWalletTelegramConfig(activeWalletSession.sessionToken)
      .then((result) => {
        if (!cancelled) {
          setWalletTelegramConfig(result.telegram)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPairingError(error instanceof Error ? error.message : 'Could not load Telegram settings.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setWalletTelegramBusy(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [activeWalletSession, isConvexAuthed])

  useEffect(() => {
    if (!pairing) {
      setPairingQrUrl(null)
      return
    }
    let cancelled = false
    const handoffUrl = buildPairingHandoffUrl(pairing.pairingToken)
    QRCode.toDataURL(handoffUrl, {
      width: 320,
      margin: 1,
    })
      .then((value) => {
        if (!cancelled) setPairingQrUrl(value)
      })
      .catch(() => {
        if (!cancelled) setPairingQrUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [pairing])

  useEffect(() => {
    if (!pairing || isConvexAuthed) return
    let cancelled = false
    async function pollPairing() {
      try {
        const result = await fetchPairingSessionStatus(pairing.pairingToken, pairing.pairingSecret)
        if (cancelled) return
        const snapshot = result.pairing
        if (snapshot.status === 'claimed' && snapshot.walletAddress && snapshot.sessionToken && snapshot.sessionExpiresAt) {
          setWalletSession({
            walletAddress: snapshot.walletAddress,
            displayName: snapshot.displayName ?? null,
            sessionToken: snapshot.sessionToken,
            sessionExpiresAt: snapshot.sessionExpiresAt,
          })
          setPairingStatus(`Seeker paired ${shortAddress(snapshot.walletAddress)}.`)
          setPairing(null)
          return
        }
        if (snapshot.status === 'expired') {
          setPairing(null)
          setPairingError('Pairing code expired. Generate a new QR code.')
          return
        }
        setPairingStatus('Waiting for Seeker to scan and sign…')
      } catch (error) {
        if (!cancelled) {
          setPairingError(error instanceof Error ? error.message : 'Could not check pairing status.')
        }
      }
    }
    void pollPairing()
    const interval = window.setInterval(() => {
      void pollPairing()
    }, 3000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [isConvexAuthed, pairing])

  async function handleCreatePairing() {
    try {
      setPairingBusy(true)
      setPairingError(null)
      setPairingStatus('Generating a one-time Seeker pairing code…')
      const result = await createPairingSession()
      setPairing({
        pairingToken: result.pairingToken,
        pairingSecret: result.pairingSecret,
        deepLinkUrl: result.deepLinkUrl,
        expiresAt: result.expiresAt,
      })
      setPairingStatus('Scan this QR code with Seeker. The handoff page will open the app and request your wallet signature.')
    } catch (error) {
      setPairingError(error instanceof Error ? error.message : 'Could not create pairing QR code.')
      setPairingStatus(null)
    } finally {
      setPairingBusy(false)
    }
  }

  function handleClearWalletSession() {
    setWalletSession(null)
    setPairing(null)
    setPairingStatus('Wallet session cleared.')
  }

  return (
    <main className="section">
      <UserProfileSection
        isAuthenticated={isAuthenticated}
        me={me}
        walletSession={activeWalletSession}
        agentCount={agents.length}
      />

      <div className="dashboard-divider" />

      <ArtGallerySection
        feed={galleryFeed ?? []}
        isAuthenticated={isAuthenticated}
      />

      <div className="dashboard-divider" />

      <WalletPairingSection
        isAuthenticated={isAuthenticated}
        walletSession={activeWalletSession}
        pairing={pairing}
        pairingQrUrl={pairingQrUrl}
        busy={pairingBusy}
        status={pairingStatus}
        error={pairingError}
        onCreatePairing={handleCreatePairing}
        onClearWalletSession={handleClearWalletSession}
      />

      <div className="dashboard-divider" />

      <ConnectedSeekersSection seekers={recentSeekers ?? []} walletSession={activeWalletSession} />

      <div className="dashboard-divider" />

      <TelegramBridgeSection
        walletSession={activeWalletSession}
        telegramConfig={walletTelegramConfig}
        busy={walletTelegramBusy}
        onSaved={setWalletTelegramConfig}
      />

      <div className="dashboard-divider" />

      <SolanaAgentSection
        agents={agents}
        isAuthenticated={isAuthenticated}
        isConvexAuthed={isConvexAuthed}
        walletSession={activeWalletSession}
        walletAgentsBusy={walletAgentsBusy}
        onWalletAgentCreated={() => setWalletAgentsVersion((value) => value + 1)}
      />

      <div className="dashboard-divider" />

      <div className="dashboard-header">
        <h1 className="section-title" style={{ margin: 0 }}>
          My Skills
        </h1>
        {me ? (
          <Link to="/upload" search={{ updateSlug: undefined }} className="btn btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Upload New Skill
          </Link>
        ) : null}
      </div>

      {!me ? (
        <div className="card">Sign in to manage your published skills and upload new versions.</div>
      ) : skills.length === 0 ? (
        <div className="card dashboard-empty">
          <Package className="dashboard-empty-icon" aria-hidden="true" />
          <h2>No skills yet</h2>
          <p>Upload your first skill to share it with the community.</p>
          <Link to="/upload" search={{ updateSlug: undefined }} className="btn btn-primary">
            <Upload className="h-4 w-4" aria-hidden="true" />
            Upload a Skill
          </Link>
        </div>
      ) : (
        <div className="dashboard-grid">
          {skills.map((skill) => (
            <SkillCard key={skill._id} skill={skill} ownerHandle={ownerHandle} />
          ))}
        </div>
      )}
    </main>
  )
}

function UserProfileSection({
  isAuthenticated,
  me,
  walletSession,
  agentCount,
}: {
  isAuthenticated: boolean
  me: ReturnType<typeof useAuthStatus>['me']
  walletSession: NanosolanaWalletSession | null
  agentCount: number
}) {
  const { isConnected: phantomConnected, user: phantomUser } = usePhantom()
  const installedWallet = useInstalledWallet()
  const linkWallet = useMutation(api.users.linkSolanaWallet)
  const [linkStatus, setLinkStatus] = useState<string | null>(null)

  const displayName = me?.displayName ?? me?.name ?? walletSession?.displayName ?? null
  const walletAddress = walletSession?.walletAddress ?? null
  const phantomAddress = phantomUser?.addresses?.find((a) => a.addressType === AddressType.solana)?.address ?? null
  const installedWalletAddress = installedWallet.address
  const linkedWallet = me && 'solanaWalletAddress' in me ? (me as Record<string, unknown>).solanaWalletAddress as string | null : null
  const preferredWalletAddress = installedWalletAddress ?? phantomAddress
  const showInstalledWalletRow = Boolean(installedWallet.connected && installedWalletAddress)
  const showPhantomRow = Boolean(phantomConnected && phantomAddress && phantomAddress !== installedWalletAddress)
  const showLinkedWalletRow =
    Boolean(linkedWallet) &&
    linkedWallet !== installedWalletAddress &&
    linkedWallet !== phantomAddress &&
    linkedWallet !== walletAddress

  // Auto-link the active browser wallet when GitHub auth is present.
  useEffect(() => {
    if (!preferredWalletAddress || !me) return
    if (linkedWallet === preferredWalletAddress) return
    void linkWallet({ walletAddress: preferredWalletAddress })
      .then(() => setLinkStatus('Wallet linked to your account.'))
      .catch(() => {})
  }, [linkedWallet, linkWallet, me, preferredWalletAddress])

  async function handleLinkWallet(address: string | null) {
    if (!address) return
    try {
      await linkWallet({ walletAddress: address })
      setLinkStatus('Wallet linked to your account.')
      window.setTimeout(() => setLinkStatus(null), 2000)
    } catch {
      setLinkStatus('Could not link wallet.')
    }
  }

  return (
    <section className="dashboard-profile card">
      <div className="dashboard-profile-identity">
        <h2>{displayName ?? (isAuthenticated ? 'Welcome back' : walletAddress ? 'Wallet Connected' : 'Get Started')}</h2>

        {/* Connected accounts */}
        <div className="dashboard-connected-accounts">
          {isAuthenticated && me ? (
            <div className="dashboard-account-row">
              <Github className="h-4 w-4" aria-hidden="true" />
              <span className="mono">@{me.handle ?? me.name ?? 'github'}</span>
              <span className="dashboard-account-badge connected">Connected</span>
            </div>
          ) : null}

          {showInstalledWalletRow ? (
            <div className="dashboard-account-row">
              <Wallet className="h-4 w-4" aria-hidden="true" />
              <span className="mono">{shortAddress(installedWalletAddress!)}</span>
              {linkedWallet === installedWalletAddress ? (
                <span className="dashboard-account-badge connected">Linked</span>
              ) : isAuthenticated ? (
                <button
                  type="button"
                  className="dashboard-account-badge link-btn"
                  onClick={() => void handleLinkWallet(installedWalletAddress)}
                >
                  <LinkIcon className="h-3 w-3" aria-hidden="true" />
                  Link
                </button>
              ) : (
                <span className="dashboard-account-badge connected">Installed Wallet</span>
              )}
            </div>
          ) : null}

          {showPhantomRow ? (
            <div className="dashboard-account-row">
              <Wallet className="h-4 w-4" aria-hidden="true" />
              <span className="mono">{shortAddress(phantomAddress!)}</span>
              {linkedWallet === phantomAddress ? (
                <span className="dashboard-account-badge connected">Linked</span>
              ) : isAuthenticated ? (
                <button type="button" className="dashboard-account-badge link-btn" onClick={() => void handleLinkWallet(phantomAddress)}>
                  <LinkIcon className="h-3 w-3" aria-hidden="true" />
                  Link
                </button>
              ) : (
                <span className="dashboard-account-badge connected">Phantom</span>
              )}
            </div>
          ) : null}

          {showLinkedWalletRow ? (
            <div className="dashboard-account-row">
              <Wallet className="h-4 w-4" aria-hidden="true" />
              <span className="mono">{shortAddress(linkedWallet!)}</span>
              <span className="dashboard-account-badge connected">Linked</span>
            </div>
          ) : null}

          {walletAddress &&
          walletAddress !== installedWalletAddress &&
          walletAddress !== phantomAddress &&
          walletAddress !== linkedWallet ? (
            <div className="dashboard-account-row">
              <Wallet className="h-4 w-4" aria-hidden="true" />
              <span className="mono">{shortAddress(walletAddress)}</span>
              <span className="dashboard-account-badge">Seeker</span>
            </div>
          ) : null}
        </div>

        {linkStatus ? <p className="gallery-success" style={{ fontSize: '0.85rem' }}>{linkStatus}</p> : null}

        <div className="gallery-stats" style={{ marginTop: 4 }}>
          <div className="gallery-stat-card">
            <span className="gallery-stat-value">{agentCount}</span>
            <span className="gallery-stat-label">Agents</span>
          </div>
        </div>
      </div>
      <div className="dashboard-quick-links">
        <Link to="/setup/gateway" className="dashboard-quick-link-card">
          <div className="dashboard-quick-link-icon gw">
            <Server className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="dashboard-quick-link-text">
            <h3>Install Gateway</h3>
            <p>Run SolanaOS on your terminal</p>
          </div>
        </Link>
        <Link to="/setup/telegram" className="dashboard-quick-link-card">
          <div className="dashboard-quick-link-icon tg">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="dashboard-quick-link-text">
            <h3>Set Up Telegram Bot</h3>
            <p>Remote monitoring and commands</p>
          </div>
        </Link>
        <Link to="/setup/metaplex" className="dashboard-quick-link-card">
          <div className="dashboard-quick-link-icon mx">
            <Hexagon className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="dashboard-quick-link-text">
            <h3>Register on Metaplex</h3>
            <p>On-chain agent identity (014 Registry)</p>
          </div>
        </Link>
        <Link to="/agents" className="dashboard-quick-link-card">
          <div className="dashboard-quick-link-icon mx">
            <Bot className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="dashboard-quick-link-text">
            <h3>Agent Directory</h3>
            <p>Public 8004 + Metaplex profiles</p>
          </div>
        </Link>
        <Link to="/strategy" className="dashboard-quick-link-card">
          <div className="dashboard-quick-link-icon st">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="dashboard-quick-link-text">
            <h3>Build a Strategy</h3>
            <p>Generate your own strategy.md for SolanaOS</p>
          </div>
        </Link>
      </div>
    </section>
  )
}

function buildPairingHandoffUrl(pairingToken: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : getSiteUrlForMode()
  const url = new URL('/pair', origin)
  url.searchParams.set('token', pairingToken)
  return url.toString()
}

function buildPairingAdbCommand(pairingToken: string) {
  const deepLinkUrl = new URL('solanaos://pair')
  deepLinkUrl.searchParams.set('token', pairingToken)
  return `adb shell am start -a android.intent.action.VIEW -d '${deepLinkUrl.toString()}' com.nanosolana.solanaos`
}

function CopyButton({
  value,
  label,
}: {
  value: string
  label: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button type="button" className="btn btn-secondary" onClick={() => void handleCopy()}>
      {copied ? 'Copied' : label}
    </button>
  )
}

function WalletPairingSection({
  isAuthenticated,
  walletSession,
  pairing,
  pairingQrUrl,
  busy,
  status,
  error,
  onCreatePairing,
  onClearWalletSession,
}: {
  isAuthenticated: boolean
  walletSession: NanosolanaWalletSession | null
  pairing: NanosolanaPairingEnvelope | null
  pairingQrUrl: string | null
  busy: boolean
  status: string | null
  error: string | null
  onCreatePairing: () => Promise<void>
  onClearWalletSession: () => void
}) {
  return (
    <section className="wallet-pairing card">
      <div className="gallery-panel-header">
        <div>
          <h2>Pair A New Seeker</h2>
          <p>Create a one-time QR deep link, scan it on-device, and exchange the wallet signature for a Convex session.</p>
        </div>
        <Wallet className="gallery-panel-icon" aria-hidden="true" />
      </div>

      {isAuthenticated ? (
        <p className="gallery-success">Convex account session is already active in this browser.</p>
      ) : walletSession ? (
        <div className="wallet-session-summary">
          <div>
            <strong>{walletSession.displayName || 'Wallet session active'}</strong>
            <p>{shortAddress(walletSession.walletAddress)} is paired to this browser.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClearWalletSession}>
            Clear Wallet Session
          </button>
        </div>
      ) : (
        <div className="wallet-pairing-grid">
          <div className="wallet-pairing-copy">
            <p className="gallery-copy-text">
              1. Generate a one-time token here.
              <br />
              2. Scan it with Seeker.
              <br />
              3. Seeker signs the challenge on-device.
              <br />
              4. This browser receives the wallet-backed Convex session.
            </p>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void onCreatePairing()}>
              <Wallet className="h-4 w-4" aria-hidden="true" />
              {busy ? 'Generating…' : 'Generate Pairing QR'}
            </button>
            {pairing ? (
              <div className="gallery-locked pairing-command-block">
                <p>
                  Handoff URL: <code>{buildPairingHandoffUrl(pairing.pairingToken)}</code>
                </p>
                <div className="pairing-command-actions">
                  <CopyButton value={buildPairingHandoffUrl(pairing.pairingToken)} label="Copy Handoff URL" />
                </div>
                <p>
                  App deep link: <code>{pairing.deepLinkUrl}</code>
                </p>
                <p>
                  If your Seeker is plugged into this Mac, skip scanning and run:
                </p>
                <pre className="pairing-command-code"><code>{buildPairingAdbCommand(pairing.pairingToken)}</code></pre>
                <div className="pairing-command-actions">
                  <CopyButton value={buildPairingAdbCommand(pairing.pairingToken)} label="Copy ADB Command" />
                </div>
              </div>
            ) : null}
            {status ? <p className="gallery-success">{status}</p> : null}
            {error ? <p className="gallery-error">{error}</p> : null}
          </div>
          <div className="wallet-pairing-qr">
            {pairingQrUrl ? <img src={pairingQrUrl} alt="Seeker wallet pairing QR code" /> : <div className="wallet-pairing-placeholder">QR code appears here</div>}
          </div>
        </div>
      )}
    </section>
  )
}

function ConnectedSeekersSection({
  seekers,
  walletSession,
}: {
  seekers: SeekerPresenceItem[]
  walletSession: NanosolanaWalletSession | null
}) {
  return (
    <section className="wallet-pairing card">
      <div className="gallery-panel-header">
        <div>
          <h2>Connected Seekers</h2>
          <p>
            Wallet-backed Seeker sessions claimed through Convex show up here on the hub. Once a device finishes pairing, it becomes visible to the public feed immediately.
          </p>
        </div>
        <Server className="gallery-panel-icon" aria-hidden="true" />
      </div>

      {walletSession ? (
        <p className="gallery-success">
          This browser is paired with {walletSession.displayName || shortAddress(walletSession.walletAddress)} and will appear in the Seeker hub activity feed.
        </p>
      ) : null}

      {seekers.length === 0 ? (
        <div className="gallery-empty card">
          <div className="dashboard-empty">
            <Server className="dashboard-empty-icon" aria-hidden="true" />
            <h2>No Seekers paired yet</h2>
            <p>Generate a pairing QR and finish the wallet signature flow on-device to populate this feed.</p>
          </div>
        </div>
      ) : (
        <div className="agent-feed-grid">
          {seekers.map((seeker) => (
            <article key={seeker.walletAddress} className="agent-card">
              <div className="agent-card-top">
                <div>
                  <h3>{seeker.displayName || 'Seeker device'}</h3>
                  <p className="agent-card-subtitle">
                    {shortAddress(seeker.walletAddress)}
                    {seeker.appVersion ? ` · ${seeker.appVersion}` : ''}
                  </p>
                </div>
                <span className={`agent-status ${seeker.online ? 'agent-status-ready' : 'agent-status-pending'}`}>
                  {seeker.online ? 'online' : 'seen'}
                </span>
              </div>

              <div className="agent-meta-grid">
                <div className="agent-meta-item">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  <span>Last seen {formatRelativeTime(seeker.lastSeenAt)}</span>
                </div>
                <div className="agent-meta-item">
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                  <span>Signed {formatRelativeTime(seeker.lastAuthAt)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function TelegramBridgeSection({
  walletSession,
  telegramConfig,
  busy,
  onSaved,
}: {
  walletSession: NanosolanaWalletSession | null
  telegramConfig: NanosolanaWalletTelegramConfig | null
  busy: boolean
  onSaved: (value: NanosolanaWalletTelegramConfig | null) => void
}) {
  const [telegramBotToken, setTelegramBotToken] = useState('')
  const [telegramUserId, setTelegramUserId] = useState(telegramConfig?.telegramUserId ?? '')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTelegramUserId(telegramConfig?.telegramUserId ?? '')
  }, [telegramConfig?.telegramUserId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!walletSession) {
      setError('Pair a Seeker wallet before saving Telegram settings.')
      return
    }
    try {
      setSaving(true)
      setError(null)
      setStatus('Verifying Telegram bot token and saving daemon settings...')
      const result = await saveWalletTelegramConfig(walletSession.sessionToken, {
        telegramBotToken,
        telegramUserId,
      })
      onSaved(result.telegram)
      setTelegramBotToken('')
      setStatus(
        `Telegram bot linked${result.telegram.telegramBotUsername ? ` @${result.telegram.telegramBotUsername}` : ''}.`,
      )
    } catch (err) {
      setStatus(null)
      setError(err instanceof Error ? err.message : 'Could not save Telegram settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="wallet-pairing card">
      <div className="gallery-panel-header">
        <div>
          <h2>Telegram Bridge</h2>
          <p>
            Save your bot token and Telegram operator id against the paired wallet, then use the daemon env block below to run the local bot against the same Seeker identity.
          </p>
        </div>
        <MessageCircle className="gallery-panel-icon" aria-hidden="true" />
      </div>

      {!walletSession ? (
        <div className="gallery-empty card">
          <div className="dashboard-empty">
            <MessageCircle className="dashboard-empty-icon" aria-hidden="true" />
            <h2>Pair a Seeker first</h2>
            <p>The Telegram bridge is saved against the wallet-backed Seeker session.</p>
          </div>
        </div>
      ) : (
        <div className="gallery-upload-grid">
          <div className="gallery-upload card">
            <form className="gallery-form" onSubmit={handleSubmit}>
              <label className="gallery-field">
                <span>Telegram bot token</span>
                <input
                  type="password"
                  value={telegramBotToken}
                  onChange={(event) => setTelegramBotToken(event.target.value)}
                  placeholder="8793...:AA..."
                  autoComplete="off"
                />
              </label>
              <label className="gallery-field">
                <span>Telegram user id</span>
                <input
                  value={telegramUserId}
                  onChange={(event) => setTelegramUserId(event.target.value)}
                  placeholder="1740095485"
                  inputMode="numeric"
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={busy || saving}>
                {saving ? 'Saving Telegram…' : 'Save Telegram Bot'}
              </button>
              {status ? <p className="gallery-success">{status}</p> : null}
              {error ? <p className="gallery-error">{error}</p> : null}
            </form>
          </div>

          <div className="gallery-live-feed card">
            <div className="gallery-panel-header">
              <div>
                <h3>Daemon wiring</h3>
                <p>Use this block when you launch or restart your local `build/nanosolana daemon`.</p>
              </div>
              <Bot className="gallery-panel-icon" aria-hidden="true" />
            </div>

            {busy ? <p className="gallery-copy-text">Loading Telegram config…</p> : null}

            {telegramConfig?.telegramConfigured ? (
              <>
                <p className="gallery-copy-text">
                  Linked bot: {telegramConfig.telegramBotUsername ? `@${telegramConfig.telegramBotUsername}` : 'verified'}
                  {telegramConfig.maskedBotToken ? ` · ${telegramConfig.maskedBotToken}` : ''}
                </p>
                <pre className="setup-copy-block">
                  <code>{telegramConfig.daemonEnvBlock ?? ''}</code>
                </pre>
                <p className="gallery-copy-text">
                  Wallet: {shortAddress(walletSession.walletAddress)}
                </p>
              </>
            ) : (
              <p className="gallery-copy-text">
                No Telegram bot is saved for this paired wallet yet.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function SolanaAgentSection({
  agents,
  isAuthenticated,
  isConvexAuthed,
  walletSession,
  walletAgentsBusy,
  onWalletAgentCreated,
}: {
  agents: SolanaAgentItem[]
  isAuthenticated: boolean
  isConvexAuthed: boolean
  walletSession: NanosolanaWalletSession | null
  walletAgentsBusy: boolean
  onWalletAgentCreated: () => void
}) {
  const createAgent = useAction(api.nanosolanaAgentsNode.createForCurrentUser)
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [description, setDescription] = useState('')
  const [ownerWalletAddress, setOwnerWalletAddress] = useState('')
  const [registryMode, setRegistryMode] = useState<'8004' | 'metaplex' | 'dual'>('dual')
  const [imageUri, setImageUri] = useState('')
  const [website, setWebsite] = useState('')
  const [xUrl, setXUrl] = useState('')
  const [discordUrl, setDiscordUrl] = useState('')
  const [mcpUrl, setMcpUrl] = useState('')
  const [a2aUrl, setA2aUrl] = useState('')
  const [snsName, setSnsName] = useState('')
  const [skillsText, setSkillsText] = useState('')
  const [domainsText, setDomainsText] = useState('')
  const [atomEnabled, setAtomEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      setBusy(true)
      setError(null)
      setStatus('Registering your agent on Solana devnet and Pinata...')
      const payload = {
        registryMode,
        name,
        symbol: symbol.trim() || undefined,
        description,
        ownerWalletAddress,
        imageUri: imageUri.trim() || undefined,
        website: website.trim() || undefined,
        xUrl: xUrl.trim() || undefined,
        discordUrl: discordUrl.trim() || undefined,
        mcpUrl: mcpUrl.trim() || undefined,
        a2aUrl: a2aUrl.trim() || undefined,
        snsName: snsName.trim() || undefined,
        skills: skillsText
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        domains: domainsText
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        atomEnabled,
      }
      if (isConvexAuthed) {
        await createAgent(payload)
      } else if (walletSession) {
        await createWalletAgent(walletSession.sessionToken, payload)
        onWalletAgentCreated()
      } else {
        throw new Error('Pair a Seeker wallet or sign in before creating an agent.')
      }
      setStatus('Agent registered. The Convex feed will refresh with the devnet asset and registry links shortly.')
      setName('')
      setSymbol('')
      setDescription('')
      setOwnerWalletAddress('')
      setRegistryMode('dual')
      setImageUri('')
      setWebsite('')
      setXUrl('')
      setDiscordUrl('')
      setMcpUrl('')
      setA2aUrl('')
      setSnsName('')
      setSkillsText('')
      setDomainsText('')
      setAtomEnabled(false)
      window.setTimeout(() => setStatus(null), 2400)
    } catch (err) {
      setStatus(null)
      setError(getUserFacingConvexError(err, 'Could not register your Solana agent.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="agent-shell">
      <div className="gallery-hero">
        <div className="gallery-copy">
          <p className="gallery-eyebrow">Solana Devnet Agent Factory</p>
          <h1 className="section-title" style={{ margin: 0 }}>
            Register Personal Solana Agents
          </h1>
          <p className="gallery-copy-text">
            Create an 8004 agent, register the same identity with Metaplex on devnet, pin the metadata
            to IPFS, and transfer the asset to your wallet.
          </p>
        </div>
        <div className="gallery-stats">
          <div className="gallery-stat-card">
            <span className="gallery-stat-value">{agents.length}</span>
            <span className="gallery-stat-label">Agents tracked</span>
          </div>
          <div className="gallery-stat-card">
            <span className="gallery-stat-value">
              {agents.filter((agent) => agent.status === 'ready').length}
            </span>
            <span className="gallery-stat-label">Ready on devnet</span>
          </div>
        </div>
      </div>

      <div className="agent-layout">
        <div className="gallery-upload card">
          <div className="gallery-panel-header">
            <div>
              <h2>Create an agent</h2>
              <p>The backend pays the devnet registration transaction, then transfers the asset.</p>
            </div>
            <Rocket className="gallery-panel-icon" aria-hidden="true" />
          </div>

          {isAuthenticated || walletSession ? (
            <form className="gallery-form" onSubmit={handleSubmit}>
              <label className="gallery-field">
                <span>Agent name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Seeker Research Agent"
                  maxLength={64}
                />
              </label>
              <div className="gallery-inline-fields">
                <label className="gallery-field">
                  <span>Symbol</span>
                  <input
                    value={symbol}
                    onChange={(event) => setSymbol(event.target.value)}
                    placeholder="SEEK"
                    maxLength={12}
                  />
                </label>
                <label className="gallery-field">
                  <span>Owner wallet</span>
                  <input
                    value={ownerWalletAddress}
                    onChange={(event) => setOwnerWalletAddress(event.target.value)}
                    placeholder="Your devnet wallet"
                  />
                </label>
                <label className="gallery-field">
                  <span>Registry</span>
                  <select
                    value={registryMode}
                    onChange={(event) => setRegistryMode(event.target.value as '8004' | 'metaplex' | 'dual')}
                  >
                    <option value="dual">8004 + Metaplex</option>
                    <option value="8004">8004 only</option>
                    <option value="metaplex">Metaplex only</option>
                  </select>
                </label>
              </div>
              <label className="gallery-field">
                <span>Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What this agent does, what it serves, and why it matters."
                  rows={5}
                  maxLength={800}
                />
              </label>
              <label className="gallery-field">
                <span>Avatar URL or ipfs:// URI</span>
                <input
                  value={imageUri}
                  onChange={(event) => setImageUri(event.target.value)}
                  placeholder="https://... or ipfs://..."
                />
              </label>
              <div className="gallery-inline-fields">
                <label className="gallery-field">
                  <span>Website</span>
                  <input
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                    placeholder="https://..."
                  />
                </label>
                <label className="gallery-field">
                  <span>X / Twitter</span>
                  <input
                    value={xUrl}
                    onChange={(event) => setXUrl(event.target.value)}
                    placeholder="https://x.com/..."
                  />
                </label>
              </div>
              <div className="gallery-inline-fields">
                <label className="gallery-field">
                  <span>Discord</span>
                  <input
                    value={discordUrl}
                    onChange={(event) => setDiscordUrl(event.target.value)}
                    placeholder="https://discord.gg/..."
                  />
                </label>
                <label className="gallery-field">
                  <span>SNS</span>
                  <input
                    value={snsName}
                    onChange={(event) => setSnsName(event.target.value)}
                    placeholder="agent.sol"
                  />
                </label>
              </div>
              <div className="gallery-inline-fields">
                <label className="gallery-field">
                  <span>MCP endpoint</span>
                  <input
                    value={mcpUrl}
                    onChange={(event) => setMcpUrl(event.target.value)}
                    placeholder="https://your-agent/mcp"
                  />
                </label>
                <label className="gallery-field">
                  <span>A2A endpoint</span>
                  <input
                    value={a2aUrl}
                    onChange={(event) => setA2aUrl(event.target.value)}
                    placeholder="https://your-agent/a2a"
                  />
                </label>
              </div>
              <div className="gallery-inline-fields">
                <label className="gallery-field">
                  <span>Skills</span>
                  <input
                    value={skillsText}
                    onChange={(event) => setSkillsText(event.target.value)}
                    placeholder="natural_language_processing/..."
                  />
                </label>
                <label className="gallery-field">
                  <span>Domains</span>
                  <input
                    value={domainsText}
                    onChange={(event) => setDomainsText(event.target.value)}
                    placeholder="technology/software_engineering/..."
                  />
                </label>
              </div>
              <label className="agent-checkbox">
                <input
                  type="checkbox"
                  checked={atomEnabled}
                  onChange={(event) => setAtomEnabled(event.target.checked)}
                />
                <span>Enable ATOM stats during registration</span>
              </label>
              {status ? (
                <div>
                  <p className="gallery-success">{status}</p>
                  {status.includes('Metaplex') ? (
                    <Link to="/setup/metaplex" className="btn" style={{ marginTop: 8 }}>
                      <Hexagon className="h-4 w-4" aria-hidden="true" />
                      Register on Metaplex 014
                    </Link>
                  ) : null}
                </div>
              ) : null}
              {error ? <p className="gallery-error">{error}</p> : null}
              <button type="submit" className="btn btn-primary" disabled={busy}>
                <Bot className="h-4 w-4" aria-hidden="true" />
                {busy ? 'Registering…' : 'Create Devnet Agent'}
              </button>
              <Link to="/agents" className="btn btn-secondary">
                View public directory
              </Link>
            </form>
          ) : (
            <p className="gallery-locked">
              Pair a Seeker wallet or sign in first. Agent registrations are saved per user session and then transferred to the wallet you specify.
            </p>
          )}
        </div>

        <div className="agent-feed">
          {walletAgentsBusy ? (
            <div className="gallery-empty card">
              <div className="dashboard-empty">
                <Clock className="dashboard-empty-icon" aria-hidden="true" />
                <h2>Loading wallet agents…</h2>
                <p>Convex is syncing the wallet-backed agent feed.</p>
              </div>
            </div>
          ) : agents.length === 0 ? (
            <div className="gallery-empty card">
              <div className="dashboard-empty">
                <Bot className="dashboard-empty-icon" aria-hidden="true" />
                <h2>No registered agents yet</h2>
                <p>Your devnet 8004 and Metaplex agents will appear here with IPFS and explorer links.</p>
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
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      <span>{agent.ownerVerified ? 'Owner verified on-chain' : 'Owner transfer pending readback'}</span>
                    </div>
                  </div>

                  <div className="agent-link-list">
                    <Link to="/agents/$agentRef" params={{ agentRef: String(agent._id) }}>
                      Public profile
                    </Link>
                    {agent.metadataUri ? (
                      <a href={agent.metadataUri.replace('ipfs://', 'https://ipfs.io/ipfs/')} target="_blank" rel="noreferrer">
                        IPFS metadata
                      </a>
                    ) : null}
                    {agent.explorerAssetUrl ? (
                      <a href={agent.explorerAssetUrl} target="_blank" rel="noreferrer">
                        Devnet asset
                      </a>
                    ) : null}
                    {agent.explorerRegistrationUrl ? (
                      <a href={agent.explorerRegistrationUrl} target="_blank" rel="noreferrer">
                        Register tx
                      </a>
                    ) : null}
                    {agent.explorerTransferUrl ? (
                      <a href={agent.explorerTransferUrl} target="_blank" rel="noreferrer">
                        Transfer tx
                      </a>
                    ) : null}
                    {agent.explorerMetaplexAssetUrl ? (
                      <a href={agent.explorerMetaplexAssetUrl} target="_blank" rel="noreferrer">
                        Metaplex asset
                      </a>
                    ) : null}
                    {agent.explorerMetaplexRegistrationUrl ? (
                      <a href={agent.explorerMetaplexRegistrationUrl} target="_blank" rel="noreferrer">
                        Metaplex register tx
                      </a>
                    ) : null}
                    {agent.explorerMetaplexDelegateUrl ? (
                      <a href={agent.explorerMetaplexDelegateUrl} target="_blank" rel="noreferrer">
                        Delegate tx
                      </a>
                    ) : null}
                    {agent.explorerMetaplexTransferUrl ? (
                      <a href={agent.explorerMetaplexTransferUrl} target="_blank" rel="noreferrer">
                        Metaplex transfer tx
                      </a>
                    ) : null}
                  </div>

                  {agent.services.length > 0 || ('metaplexRegistered' in agent && agent.metaplexRegistered) ? (
                    <div className="agent-pill-row">
                      {'metaplexRegistered' in agent && agent.metaplexRegistered ? (
                        <span className="agent-pill" style={{ background: 'rgba(153, 69, 255, 0.15)', color: '#9945ff' }}>
                          Metaplex 014
                        </span>
                      ) : null}
                      {agent.services.slice(0, 4).map((service) => (
                        <span key={`${agent._id}-${service.type}-${service.value}`} className="agent-pill">
                          {service.type}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {agent.errorMessage ? <p className="gallery-error">{agent.errorMessage}</p> : null}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function shortAddress(value: string) {
  return value.length > 12 ? `${value.slice(0, 4)}…${value.slice(-4)}` : value
}

function formatRelativeTime(value: number) {
  const diffMs = Math.max(0, Date.now() - value)
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function ArtGallerySection({
  feed,
  isAuthenticated,
}: {
  feed: GalleryFeedItem[]
  isAuthenticated: boolean
}) {
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl)
  const createArtwork = useMutation(api.gallery.createArtwork)
  const generateArtwork = useAction(api.gallery.generateArtwork)
  const rateArtwork = useMutation(api.gallery.rateArtwork)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<(typeof XAI_ASPECT_RATIOS)[number]>('1:1')
  const [resolution, setResolution] = useState<(typeof XAI_RESOLUTIONS)[number]>('1k')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generateStatus, setGenerateStatus] = useState<string | null>(null)
  const [generateBusy, setGenerateBusy] = useState(false)
  const [ratingArtworkId, setRatingArtworkId] = useState<string | null>(null)
  const [ratingError, setRatingError] = useState<string | null>(null)

  const selectedImageLabel = useMemo(() => {
    if (!selectedImage) return null
    return `${selectedImage.name} · ${formatBytes(selectedImage.size)}`
  }, [selectedImage])

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedImage) {
      setUploadError('Pick an image first.')
      return
    }

    try {
      setUploadError(null)
      setGenerateError(null)
      setUploadStatus('Uploading artwork...')
      const uploadUrl = await generateUploadUrl()
      const storageId = await uploadFile(uploadUrl, selectedImage)
      await createArtwork({
        storageId: storageId as never,
        title: title.trim() || undefined,
        caption: caption.trim() || undefined,
      })
      setSelectedImage(null)
      setTitle('')
      setCaption('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      setUploadStatus('Artwork posted to the live feed.')
      window.setTimeout(() => setUploadStatus(null), 1800)
    } catch (error) {
      setUploadStatus(null)
      setUploadError(getUserFacingConvexError(error, 'Could not upload artwork.'))
    }
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!prompt.trim()) {
      setGenerateError('Enter a prompt before generating an image.')
      return
    }

    try {
      setGenerateBusy(true)
      setGenerateError(null)
      setUploadError(null)
      setGenerateStatus('Generating with xAI and publishing to the gallery...')
      await generateArtwork({
        prompt: prompt.trim(),
        title: title.trim() || undefined,
        caption: caption.trim() || undefined,
        aspectRatio,
        resolution,
      })
      setGenerateStatus('xAI image generated and published to the live feed.')
      setPrompt('')
      window.setTimeout(() => setGenerateStatus(null), 2200)
    } catch (error) {
      setGenerateStatus(null)
      setGenerateError(getUserFacingConvexError(error, 'Could not generate an image with xAI.'))
    } finally {
      setGenerateBusy(false)
    }
  }

  async function handleRate(artworkId: string, value: number) {
    try {
      setRatingArtworkId(artworkId)
      setRatingError(null)
      await rateArtwork({ artworkId: artworkId as never, value })
    } catch (error) {
      setRatingError(getUserFacingConvexError(error, 'Could not save your rating.'))
    } finally {
      setRatingArtworkId(null)
    }
  }

  return (
    <section className="gallery-shell">
      <div className="gallery-hero">
        <div className="gallery-copy">
          <p className="gallery-eyebrow">Realtime Convex Gallery</p>
          <h1 className="section-title" style={{ margin: 0 }}>
            Live Art Feed
          </h1>
          <p className="gallery-copy-text">
            Upload images into Convex storage, watch them appear instantly for every viewer, and
            let the whole room rate them live.
          </p>
        </div>
        <div className="gallery-stats">
          <div className="gallery-stat-card">
            <span className="gallery-stat-value">{feed.length}</span>
            <span className="gallery-stat-label">Visible artworks</span>
          </div>
          <div className="gallery-stat-card">
            <span className="gallery-stat-value">
              {feed.reduce((sum, item) => sum + item.artwork.ratingCount, 0)}
            </span>
            <span className="gallery-stat-label">Ratings saved</span>
          </div>
        </div>
      </div>

      <div className="gallery-layout">
        <div className="gallery-upload card">
          <div className="gallery-panel-header">
            <div>
              <h2>Post to the feed</h2>
              <p>Every new image lands in Convex storage and fans out to all open clients.</p>
            </div>
            <ImagePlus className="gallery-panel-icon" aria-hidden="true" />
          </div>

          {isAuthenticated ? (
            <>
              <form className="gallery-form" onSubmit={handleUpload}>
                <label className="gallery-field">
                  <span>Image</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(event) => setSelectedImage(event.target.files?.[0] ?? null)}
                  />
                </label>
                {selectedImageLabel ? <p className="gallery-file-note">{selectedImageLabel}</p> : null}
                <label className="gallery-field">
                  <span>Title</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Neon Reef"
                    maxLength={120}
                  />
                </label>
                <label className="gallery-field">
                  <span>Caption</span>
                  <textarea
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    placeholder="What should everyone notice about this piece?"
                    maxLength={800}
                    rows={4}
                  />
                </label>
                {uploadError ? <p className="gallery-error">{uploadError}</p> : null}
                {uploadStatus ? <p className="gallery-success">{uploadStatus}</p> : null}
                <button className="btn btn-primary" type="submit" disabled={!selectedImage}>
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Publish Artwork
                </button>
              </form>

              <div className="gallery-form-divider" />

              <form className="gallery-form" onSubmit={handleGenerate}>
                <div className="gallery-subhead">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>xAI image generation</span>
                </div>
                <label className="gallery-field">
                  <span>Prompt</span>
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="A luminous reef cathedral made of glass coral, cinematic volumetric light, hyper-detailed"
                    maxLength={1500}
                    rows={4}
                  />
                </label>
                <div className="gallery-inline-fields">
                  <label className="gallery-field">
                    <span>Aspect ratio</span>
                    <select
                      value={aspectRatio}
                      onChange={(event) =>
                        setAspectRatio(event.target.value as (typeof XAI_ASPECT_RATIOS)[number])}
                    >
                      {XAI_ASPECT_RATIOS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="gallery-field">
                    <span>Resolution</span>
                    <select
                      value={resolution}
                      onChange={(event) =>
                        setResolution(event.target.value as (typeof XAI_RESOLUTIONS)[number])}
                    >
                      {XAI_RESOLUTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {generateError ? <p className="gallery-error">{generateError}</p> : null}
                {generateStatus ? <p className="gallery-success">{generateStatus}</p> : null}
                <button
                  className="btn btn-secondary"
                  type="submit"
                  disabled={generateBusy || !prompt.trim()}
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {generateBusy ? 'Generating…' : 'Generate With xAI'}
                </button>
              </form>
            </>
          ) : (
            <div className="gallery-locked">
              <p>Sign in to upload artwork, generate images with xAI, and rate the live feed.</p>
            </div>
          )}
        </div>

        <div className="gallery-feed">
          <div className="gallery-panel-header">
            <div>
              <h2>Live feed</h2>
              <p>New posts and rating changes stream into this list automatically.</p>
            </div>
          </div>

          {ratingError ? <p className="gallery-error">{ratingError}</p> : null}

          {feed.length === 0 ? (
            <div className="card gallery-empty">
              No artwork yet. Upload the first image to seed the gallery.
            </div>
          ) : (
            <div className="gallery-feed-grid">
              {feed.map((item) => (
                <article key={item.artwork._id} className="gallery-card">
                  <img
                    className="gallery-card-image"
                    src={item.imageUrl}
                    alt={item.artwork.title ?? item.artwork.caption ?? 'Gallery artwork'}
                    loading="lazy"
                  />
                  <div className="gallery-card-body">
                    <div className="gallery-card-topline">
                      <div>
                        <h3>{item.artwork.title ?? 'Untitled piece'}</h3>
                        <p className="gallery-card-artist">
                          by{' '}
                          {item.artist.displayName ??
                            item.artist.handle ??
                            item.artist.name ??
                            item.artist._id}
                        </p>
                      </div>
                      <div className="gallery-rating-summary">
                        <span>{item.artwork.averageRating.toFixed(1)}</span>
                        <small>{item.artwork.ratingCount} ratings</small>
                      </div>
                    </div>
                    <div className="gallery-card-meta">
                      <span className={`gallery-source-badge source-${item.artwork.source}`}>
                        {item.artwork.source === 'xai' ? 'Generated with xAI' : 'Uploaded'}
                      </span>
                      {item.artwork.source === 'xai' && item.artwork.sourceModel ? (
                        <span className="gallery-card-model">{item.artwork.sourceModel}</span>
                      ) : null}
                    </div>
                    {item.artwork.caption ? (
                      <p className="gallery-card-caption">{item.artwork.caption}</p>
                    ) : null}
                    {item.artwork.source === 'xai' && item.artwork.sourcePrompt ? (
                      <p className="gallery-card-prompt">{item.artwork.sourcePrompt}</p>
                    ) : null}
                    <div className="gallery-card-footer">
                      <div className="gallery-stars" aria-label="Rate this artwork">
                        {[1, 2, 3, 4, 5].map((value) => {
                          const isActive = (item.viewerRating ?? 0) >= value
                          return (
                            <button
                              key={value}
                              type="button"
                              className={`gallery-star-button${isActive ? ' is-active' : ''}`}
                              onClick={() => handleRate(item.artwork._id, value)}
                              disabled={!isAuthenticated || ratingArtworkId === item.artwork._id}
                              aria-label={`Rate ${value} star${value === 1 ? '' : 's'}`}
                            >
                              <Star className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )
                        })}
                      </div>
                      <span className="gallery-rating-note">
                        {item.viewerRating ? `You rated this ${item.viewerRating}/5` : 'Tap to rate'}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function SkillCard({ skill, ownerHandle }: { skill: DashboardSkill; ownerHandle: string | null }) {
  return (
    <div className="dashboard-skill-card">
      <div className="dashboard-skill-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Link
            to="/$owner/$slug"
            params={{ owner: ownerHandle ?? 'unknown', slug: skill.slug }}
            className="dashboard-skill-name"
          >
            {skill.displayName}
          </Link>
          <span className="dashboard-skill-slug">/{skill.slug}</span>
          {skill.pendingReview ? (
            <span className="tag tag-pending">
              <Clock className="h-3 w-3" aria-hidden="true" />
              Scanning
            </span>
          ) : null}
        </div>
        {skill.summary && <p className="dashboard-skill-description">{skill.summary}</p>}
        <div className="dashboard-skill-stats">
          <span>
            <Package size={13} aria-hidden="true" /> {formatCompactStat(skill.stats.downloads)}
          </span>
          <span>★ {formatCompactStat(skill.stats.stars)}</span>
          <span>{skill.stats.versions} v</span>
        </div>
      </div>
      <div className="dashboard-skill-actions">
        <Link to="/upload" search={{ updateSlug: skill.slug }} className="btn btn-sm">
          <Upload className="h-3 w-3" aria-hidden="true" />
          New Version
        </Link>
        <Link
          to="/$owner/$slug"
          params={{ owner: ownerHandle ?? 'unknown', slug: skill.slug }}
          className="btn btn-ghost btn-sm"
        >
          View
        </Link>
      </div>
    </div>
  )
}
