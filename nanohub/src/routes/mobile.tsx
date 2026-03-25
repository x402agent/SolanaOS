import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState, useCallback, type CSSProperties } from 'react'
import { trackHubEvent } from '../lib/analytics'
import { getNanoHubSiteUrl } from '../lib/site'

export const Route = createFileRoute('/mobile')({
  head: () => {
    const url = `${getNanoHubSiteUrl()}/mobile`
    const title = 'SolanaOS Mobile dApp | Seeker Runtime Preview'
    const description =
      'Experience the SolanaOS Seeker mobile dapp: pairing, DEX trading, Grok research, operator chat, voice agent, ORE mining, arcade, canvas remoting, and runtime settings.'

    return {
      links: [{ rel: 'canonical', href: url }],
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: url },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
      ],
    }
  },
  component: SolanaOsMobileRoute,
})

// ── Tab definitions ─────────────────────────────────────────────

type MobileTabId =
  | 'connect'
  | 'solana'
  | 'dex'
  | 'grok'
  | 'chat'
  | 'arcade'
  | 'voice'
  | 'ore'
  | 'screen'
  | 'settings'

type MobileTab = {
  id: MobileTabId
  label: string
  icon: string
  accent: string
  eyebrow: string
  headline: string
  blurb: string
}

const MOBILE_TABS: MobileTab[] = [
  {
    id: 'connect',
    label: 'Connect',
    icon: '⟐',
    accent: '#14f195',
    eyebrow: 'Pairing + Trust',
    headline: 'Wallet-first Seeker entrypoint',
    blurb:
      'Ed25519 device identity, TLS-pinned gateway, Convex session sync, and wallet-linked public agent registry.',
  },
  {
    id: 'solana',
    label: 'Solana',
    icon: '◆',
    accent: '#00d4ff',
    eyebrow: 'Chain + Wallet',
    headline: 'On-device Solana operator dashboard',
    blurb:
      'RPC health, wallet balance, recent transactions, token accounts, and staged intent queue in one surface.',
  },
  {
    id: 'dex',
    label: 'DEX',
    icon: '⧫',
    accent: '#14f195',
    eyebrow: 'Market + Trade',
    headline: 'SolanaTracker-powered trading surface',
    blurb:
      'Trending tokens, live datastream, swap quoting, holder risk, and AI token analysis through Grok and Convex.',
  },
  {
    id: 'grok',
    label: 'Grok',
    icon: '⌕',
    accent: '#8f6aff',
    eyebrow: 'Search + Execute',
    headline: 'Multi-mode research deck',
    blurb:
      'Web search, X search, image generation, live camera vision, and code execution in one handheld surface.',
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: '◌',
    accent: '#14f195',
    eyebrow: 'Operator Terminal',
    headline: 'Gateway-connected command shell',
    blurb:
      'Runtime chat with model hot-swap, Claude Code sessions, structured commands, media attachments, and streaming output.',
  },
  {
    id: 'arcade',
    label: 'Arcade',
    icon: '◈',
    accent: '#ff8f3d',
    eyebrow: 'Signal Breaks',
    headline: 'Device-native game arcade',
    blurb:
      'Chess with wallet identity, Snake with speed ramp, and a platformer — all in the SolanaOS visual language.',
  },
  {
    id: 'voice',
    label: 'Voice',
    icon: '◉',
    accent: '#8f6aff',
    eyebrow: 'Realtime Agent',
    headline: 'Live voice operator companion',
    blurb:
      'Grok-powered realtime voice with web search, X search, PCM streaming, server-side VAD, and tool routing.',
  },
  {
    id: 'ore',
    label: 'ORE',
    icon: '⚒',
    accent: '#ff8f3d',
    eyebrow: 'Mining Planner',
    headline: 'Bankroll-aware ORE launchpad',
    blurb:
      'Block coverage modeling, SOL requirement checks, wallet readiness, and honest risk framing before capital commitment.',
  },
  {
    id: 'screen',
    label: 'Screen',
    icon: '▣',
    accent: '#00d4ff',
    eyebrow: 'Canvas Bridge',
    headline: 'Remote gateway-driven UI surface',
    blurb:
      'WebView canvas bridge, A2UI hydration, and remote page payloads pushed from the operator runtime.',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: '⚙',
    accent: '#14f195',
    eyebrow: 'Runtime Controls',
    headline: 'Operator maintenance console',
    blurb:
      'Foreground service, network, permissions, AI provider fallback, secure prefs, and protocol internals.',
  },
]

const OODA_PHASES = ['OBSERVE', 'ORIENT', 'DECIDE', 'ACT'] as const

const BUILD_HIGHLIGHTS = [
  { label: 'Package', value: 'com.nanosolana.solanaos' },
  { label: 'Version', value: '2026.3.12' },
  { label: 'Protocol', value: 'v3' },
  { label: 'Surfaces', value: '10 tabs' },
  { label: 'Gateway', value: '25 routes' },
  { label: 'Commands', value: '29 invoke' },
]

const ARCHITECTURE_LAYERS = [
  {
    name: 'Seeker Device',
    detail: 'Kotlin/Compose shell with MWA, SolanaTracker, xAI, OpenRouter, Convex clients',
    accent: '#14f195',
  },
  {
    name: 'Gateway Binary',
    detail: 'Pure Go CGO_ENABLED=0, ARM64/RISC-V, port 18790, WebSocket + JSON-TCP',
    accent: '#00d4ff',
  },
  {
    name: 'Convex Backend',
    detail: 'Shared identity, wallet sync, pairing claims, gallery, chess archive, registry',
    accent: '#8f6aff',
  },
  {
    name: 'On-Chain',
    detail: 'SolanaTracker RPC, Jupiter DEX, ORE mainnet, pump.fun, agent registry 8004',
    accent: '#ff8f3d',
  },
]

// ── Main route ──────────────────────────────────────────────────

function SolanaOsMobileRoute() {
  const [activeTabId, setActiveTabId] = useState<MobileTabId>('connect')
  const [clock, setClock] = useState(formatClock())
  const [tick, setTick] = useState(0)

  useEffect(() => {
    trackHubEvent('mobile_route_view', { surface: 'mobile' })
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(formatClock())
      setTick((c) => c + 1)
    }, 2400)
    return () => window.clearInterval(timer)
  }, [])

  const activeTab = useMemo(
    () => MOBILE_TABS.find((t) => t.id === activeTabId) ?? MOBILE_TABS[0],
    [activeTabId],
  )

  const phase = OODA_PHASES[tick % OODA_PHASES.length]
  const liveSlot = 258_114_392 + tick * 2

  const selectTab = useCallback(
    (tabId: MobileTabId) => {
      setActiveTabId(tabId)
      trackHubEvent('mobile_tab_select', { tab: tabId, surface: 'mobile' })
    },
    [],
  )

  return (
    <main className="solana-mobile-page">
      {/* ── Hero ──────────────────────────────────── */}
      <section className="hero solana-mobile-hero">
        <div className="hero-inner solana-mobile-hero-inner">
          <div className="hero-copy fade-up" data-delay="1">
            <span className="hero-badge">
              Seeker dApp / build 2026.3.12 / protocol v3
            </span>
            <h1 className="hero-title">
              SolanaOS on Seeker.
              <br />
              <span className="solana-mobile-hero-accent">The operator cockpit, visualized.</span>
            </h1>
            <p className="hero-subtitle">
              Ten tabs. Wallet pairing. Gateway trust. Convex identity. Agent registry. DEX
              trading. Grok research. Voice agent. ORE planning. Canvas remoting. Runtime
              controls. One mobile frame.
            </p>
            <div className="solana-mobile-cta-row">
              <Link to="/pair" className="btn btn-primary">
                Pair Seeker
              </Link>
              <Link to="/solanaos" className="btn">
                Runtime Catalog
              </Link>
              <a
                href="https://github.com/x402agent/Solana-Os-Go"
                className="btn"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </div>

            <div className="solana-mobile-build-strip">
              {BUILD_HIGHLIGHTS.map((h) => (
                <div key={h.label} className="solana-mobile-build-chip">
                  <span>{h.label}</span>
                  <strong>{h.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-card solana-mobile-hero-card fade-up" data-delay="2">
            <div className="solana-mobile-hero-card-top">
              <div>
                <div className="stat">Live system snapshot</div>
                <h2>Seeker &rarr; Gateway &rarr; Chain</h2>
              </div>
              <span className="tag tag-accent">OODA {phase}</span>
            </div>
            <div className="solana-mobile-hero-grid">
              <div className="card solana-mobile-pulse-card">
                <div className="stat">Runtime</div>
                <strong>{2840 + tick}</strong>
              </div>
              <div className="card solana-mobile-pulse-card">
                <div className="stat">RPC Slot</div>
                <strong>{liveSlot.toLocaleString('en-US')}</strong>
              </div>
              <div className="card solana-mobile-pulse-card">
                <div className="stat">Registry</div>
                <strong>Convex live</strong>
              </div>
            </div>
            <div className="solana-mobile-arch-stack">
              {ARCHITECTURE_LAYERS.map((layer) => (
                <div
                  key={layer.name}
                  className="solana-mobile-arch-row"
                  style={{ '--arch-accent': layer.accent } as CSSProperties}
                >
                  <strong>{layer.name}</strong>
                  <span>{layer.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Interactive phone + detail ────────────── */}
      <section className="section">
        <div className="solana-mobile-stage">
          <div className="solana-mobile-frame-column">
            <MobilePhone
              activeTab={activeTab}
              activeTabId={activeTabId}
              clock={clock}
              phase={phase}
              tick={tick}
              liveSlot={liveSlot}
              onSelectTab={selectTab}
            />
          </div>

          <div className="solana-mobile-detail-column">
            <article
              className="card solana-mobile-focus-card"
              style={{ '--mobile-accent': activeTab.accent } as CSSProperties}
            >
              <span className="tag solana-mobile-focus-badge">{activeTab.eyebrow}</span>
              <h2>{activeTab.headline}</h2>
              <p>{activeTab.blurb}</p>

              <div className="solana-mobile-tab-rail">
                {MOBILE_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`solana-mobile-tab-chip${t.id === activeTabId ? ' is-active' : ''}`}
                    onClick={() => selectTab(t.id)}
                  >
                    <span>{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>

              <TabDetail tabId={activeTabId} tick={tick} liveSlot={liveSlot} />

              <div className="solana-mobile-inline-actions">
                {activeTabId === 'connect' && (
                  <Link to="/pair" className="btn btn-primary">
                    Open Pair Handoff
                  </Link>
                )}
                {activeTabId === 'dex' && (
                  <Link to="/solanaos" className="btn btn-primary">
                    Explore Runtime Catalog
                  </Link>
                )}
                <Link to="/dashboard" className="btn">
                  Dashboard
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ── Operator flow ─────────────────────────── */}
      <section className="section">
        <div className="card solana-mobile-flow-card">
          <div className="solana-mobile-flow-copy">
            <span className="hero-badge">Operator path</span>
            <h2 className="section-title" style={{ marginBottom: 12 }}>
              From handheld pairing to on-chain execution.
            </h2>
            <p className="section-subtitle" style={{ marginBottom: 0 }}>
              The mobile dApp sits in the middle of the full SolanaOS stack.
            </p>
          </div>
          <div className="solana-mobile-flow-steps">
            {[
              'Pair wallet and device identity on Seeker.',
              'Pin and trust the gateway TLS transport.',
              'Sync Convex profile, wallet, and public agents.',
              'Operate through DEX, Grok, chat, voice, canvas, and ORE.',
              'Escalate from mobile command to gateway execution and on-chain action.',
            ].map((step, i) => (
              <div key={step} className="solana-mobile-flow-step">
                <span>{i + 1}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

// ── Tab detail panels (right side) ──────────────────────────────

function TabDetail({
  tabId,
  liveSlot,
}: {
  tabId: MobileTabId
  tick: number
  liveSlot: number
}) {
  switch (tabId) {
    case 'connect':
      return (
        <div className="sm-detail-grid">
          <MetricRow
            items={[
              { label: 'Gateway', value: 'TLS pinned' },
              { label: 'Convex', value: 'session live' },
              { label: 'Registry', value: 'ACP ready' },
            ]}
          />
          <DetailCard title="Handshake flow">
            <DetailItem label="Wallet handoff" value="solanaos://pair from QR or web" />
            <DetailItem label="Device identity" value="Ed25519 keypair + signed auth v3" />
            <DetailItem label="Agent card" value="Profile, A2A, Explorer from registry" />
            <DetailItem label="Session" value="Convex upsert on wallet sync" />
          </DetailCard>
        </div>
      )
    case 'solana': {
      const formattedSlot = liveSlot.toLocaleString('en-US')
      return (
        <div className="sm-detail-grid">
          <MetricRow
            items={[
              { label: 'RPC slot', value: formattedSlot },
              { label: 'Balance', value: '2.4831 SOL' },
              { label: 'Network', value: 'mainnet-beta' },
            ]}
          />
          <DetailCard title="Wallet surfaces">
            <DetailItem label="Health" value="RPC latency, block height, epoch progress" />
            <DetailItem label="Tokens" value="SPL token accounts with USD values" />
            <DetailItem label="Transactions" value="Recent sends, swaps, and program calls" />
            <DetailItem label="Intents" value="Staged trade queue from OODA loop" />
          </DetailCard>
        </div>
      )
    }
    case 'dex':
      return (
        <div className="sm-detail-grid">
          <MetricRow
            items={[
              { label: 'Feed', value: 'streaming' },
              { label: 'Tokens', value: 'graduating' },
              { label: 'Swap', value: 'Jupiter v6' },
            ]}
          />
          <DetailCard title="Trading surfaces">
            <DetailItem label="Boards" value="Latest / graduating / graduated / trending" />
            <DetailItem label="Search" value="By mint, symbol, or name" />
            <DetailItem label="Detail" value="Trades, holders, chart, bundler risk" />
            <DetailItem label="Analysis" value="AI token analysis via Grok / Convex" />
            <DetailItem label="Execution" value="Swap quote and send via MWA" />
          </DetailCard>
        </div>
      )
    case 'grok':
      return (
        <div className="sm-detail-grid">
          <MetricRow
            items={[
              { label: 'Search', value: 'grok-4.20' },
              { label: 'Image', value: 'imagine' },
              { label: 'Vision', value: 'camera' },
            ]}
          />
          <DetailCard title="Mode stack">
            <DetailItem label="Web mode" value="xAI Responses API with web_search tools" />
            <DetailItem label="X mode" value="X-native scan for narratives and raids" />
            <DetailItem label="Image" value="Generate and iterate on prompts" />
            <DetailItem label="Vision" value="Live camera feed analysis" />
            <DetailItem label="Code" value="Sandboxed computation and modeling" />
          </DetailCard>
        </div>
      )
    case 'chat':
      return (
        <div className="sm-detail-grid">
          <MetricRow
            items={[
              { label: 'Transport', value: 'Gateway RPC' },
              { label: 'Model', value: 'DeepSolana' },
              { label: 'Thinking', value: 'Medium' },
            ]}
          />
          <DetailCard title="Command rails">
            <DetailItem label="Claude" value="/claude start, continue, commit, status, log" />
            <DetailItem label="Router" value="/model ollama 8bit/DeepSolana hot-swap" />
            <DetailItem label="Media" value="Attachments, code blocks, tool runs, streaming" />
            <DetailItem label="Fallback" value="Direct OpenRouter when gateway unavailable" />
          </DetailCard>
        </div>
      )
    case 'arcade':
      return (
        <div className="sm-detail-grid">
          <MetricRow
            items={[
              { label: 'Games', value: '3' },
              { label: 'Input', value: 'touch-first' },
              { label: 'Theme', value: 'SolanaOS' },
            ]}
          />
          <DetailCard title="Game modes">
            <DetailItem label="Chess" value="Turn logic, legal moves, wallet identity, Convex archive" />
            <DetailItem label="Snake" value="Canvas render loop, speed ramp, restartable" />
            <DetailItem label="Platformer" value="Lightweight physics, on-brand pixel art" />
          </DetailCard>
        </div>
      )
    case 'voice':
      return (
        <div className="sm-detail-grid">
          <MetricRow
            items={[
              { label: 'Voice', value: 'Eve' },
              { label: 'Sample', value: '24 kHz' },
              { label: 'VAD', value: 'server' },
            ]}
          />
          <DetailCard title="Realtime flow">
            <DetailItem label="Session" value="WSS realtime with session.update semantics" />
            <DetailItem label="Audio" value="PCM input/output for low-latency loops" />
            <DetailItem label="Tools" value="web_search and x_search toggles" />
            <DetailItem label="Transcript" value="Live scrolling text alongside orb" />
          </DetailCard>
        </div>
      )
    case 'ore':
      return (
        <div className="sm-detail-grid">
          <MetricRow
            items={[
              { label: 'Wallet', value: '2.48 SOL' },
              { label: 'Coverage', value: '20.0%' },
              { label: 'Strategy', value: 'Balanced' },
            ]}
          />
          <DetailCard title="Round model">
            <DetailItem label="Grid" value="5x5 blocks, sixty-second rounds" />
            <DetailItem label="Motherlode" value="1 in 625 chance — framed as variance" />
            <DetailItem label="Launch" value="Wallet prep then jump to live ORE mainnet" />
            <DetailItem label="Risk" value="Honest bankroll framing before commitment" />
          </DetailCard>
        </div>
      )
    case 'screen':
      return (
        <div className="sm-detail-grid">
          <MetricRow
            items={[
              { label: 'Canvas', value: 'ready' },
              { label: 'A2UI', value: 'hydrated' },
              { label: 'Bridge', value: 'waiting' },
            ]}
          />
          <DetailCard title="Bridge state">
            <DetailItem label="URL" value="Canvas host controlled by gateway" />
            <DetailItem label="A2UI" value="Structured actions pushed through host bridge" />
            <DetailItem label="Rehydrate" value="Recover and redraw state on reconnect" />
          </DetailCard>
        </div>
      )
    case 'settings':
      return (
        <div className="sm-detail-grid">
          <MetricRow
            items={[
              { label: 'Port', value: '18790' },
              { label: 'Network', value: 'mainnet' },
              { label: 'Service', value: 'sticky' },
            ]}
          />
          <DetailCard title="Config surfaces">
            <DetailItem label="Prefs" value="Plain + secure pref boundaries explicit" />
            <DetailItem label="Android" value="Permissions, foreground service, boot restore" />
            <DetailItem label="AI" value="OpenRouter / xAI / Together fallback keys" />
            <DetailItem label="Protocol" value="Auth v3, TLS fingerprint, transport" />
          </DetailCard>
        </div>
      )
  }
}

function MetricRow({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="solana-mobile-metric-grid">
      {items.map((m) => (
        <div key={m.label} className="solana-mobile-metric">
          <span>{m.label}</span>
          <strong>{m.value}</strong>
        </div>
      ))}
    </div>
  )
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="solana-mobile-feed-card">
      <div className="stat">{title}</div>
      <div className="solana-mobile-feed-list">{children}</div>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="solana-mobile-feed-item">
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  )
}

// ── Phone mockup with rich per-tab screens ──────────────────────

function MobilePhone({
  activeTab,
  activeTabId,
  clock,
  phase,
  tick,
  liveSlot,
  onSelectTab,
}: {
  activeTab: MobileTab
  activeTabId: MobileTabId
  clock: string
  phase: string
  tick: number
  liveSlot: number
  onSelectTab: (tabId: MobileTabId) => void
}) {
  // Show 5 tabs in the bottom nav based on which is active
  const visibleNavTabs = useMemo(() => {
    const idx = MOBILE_TABS.findIndex((t) => t.id === activeTabId)
    const start = Math.max(0, Math.min(idx - 2, MOBILE_TABS.length - 5))
    return MOBILE_TABS.slice(start, start + 5)
  }, [activeTabId])

  return (
    <div
      className="solana-mobile-phone"
      style={{ '--mobile-accent': activeTab.accent } as CSSProperties}
    >
      <div className="solana-mobile-phone-cutout" />
      <div className="solana-mobile-phone-screen">
        <div className="solana-mobile-statusbar">
          <span>{clock}</span>
          <div>
            <span className="sm-signal-dot" />
            <span>5G</span>
            <span>86%</span>
          </div>
        </div>

        <div className="solana-mobile-phone-header">
          <div>
            <div className="stat">SolanaOS / {activeTab.eyebrow}</div>
            <h3>{activeTab.label}</h3>
          </div>
          <span className="tag solana-mobile-phase-pill">{phase}</span>
        </div>

        <div className="solana-mobile-screen-body">
          <PhoneScreen tabId={activeTabId} tick={tick} liveSlot={liveSlot} clock={clock} />
        </div>

        <div className="solana-mobile-bottom-nav">
          {visibleNavTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`solana-mobile-bottom-tab${t.id === activeTabId ? ' is-active' : ''}`}
              onClick={() => onSelectTab(t.id)}
              aria-label={t.label}
            >
              <span>{t.icon}</span>
              <small>{t.label}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Rich phone screen content per tab ───────────────────────────

function PhoneScreen({
  tabId,
  tick,
  liveSlot,
}: {
  tabId: MobileTabId
  tick: number
  liveSlot: number
  clock: string
}) {
  switch (tabId) {
    case 'connect':
      return <ConnectScreen tick={tick} />
    case 'solana':
      return <SolanaScreen tick={tick} liveSlot={liveSlot} />
    case 'dex':
      return <DexScreen tick={tick} />
    case 'grok':
      return <GrokScreen tick={tick} />
    case 'chat':
      return <ChatScreen />
    case 'arcade':
      return <ArcadeScreen />
    case 'voice':
      return <VoiceScreen tick={tick} />
    case 'ore':
      return <OreScreen tick={tick} />
    case 'screen':
      return <CanvasScreen tick={tick} />
    case 'settings':
      return <SettingsScreen />
  }
}

function ConnectScreen({ tick }: { tick: number }) {
  const connected = tick > 2
  return (
    <>
      <div className="sm-card sm-card-glow">
        <div className="sm-row-between">
          <strong className="sm-text-sm">Gateway Status</strong>
          <span className={`sm-status-dot ${connected ? 'sm-dot-green' : 'sm-dot-amber'}`} />
        </div>
        <div className="sm-mono sm-text-xs sm-muted">wss://192.168.1.42:18790</div>
        <div className="sm-chip-row">
          <span className="sm-chip sm-chip-green">TLS Pinned</span>
          <span className="sm-chip">Protocol v3</span>
          <span className="sm-chip">Ed25519</span>
        </div>
      </div>

      <div className="sm-card">
        <strong className="sm-text-sm">Wallet Identity</strong>
        <div className="sm-mono sm-text-xs sm-muted" style={{ marginTop: 6 }}>
          7xKr...4Fz9
        </div>
        <div className="sm-chip-row">
          <span className="sm-chip sm-chip-blue">SIWS Signed</span>
          <span className="sm-chip">Convex Synced</span>
        </div>
      </div>

      <div className="sm-card">
        <strong className="sm-text-sm">Agent Registry</strong>
        <div className="sm-registry-item">
          <div className="sm-row-between">
            <span className="sm-text-xs">SolanaOS Agent</span>
            <span className="sm-chip sm-chip-green sm-chip-xs">live</span>
          </div>
          <div className="sm-mono sm-text-xs sm-muted">8004 / ACP registered</div>
        </div>
        <div className="sm-btn-row">
          <span className="sm-btn-ghost">Profile</span>
          <span className="sm-btn-ghost">A2A</span>
          <span className="sm-btn-ghost">Explorer</span>
        </div>
      </div>
    </>
  )
}

function SolanaScreen({ liveSlot }: { tick: number; liveSlot: number }) {
  return (
    <>
      <div className="sm-metric-strip">
        <div className="sm-metric-box">
          <span>Balance</span>
          <strong>2.4831 SOL</strong>
        </div>
        <div className="sm-metric-box">
          <span>Slot</span>
          <strong>{liveSlot.toLocaleString('en-US')}</strong>
        </div>
        <div className="sm-metric-box">
          <span>Epoch</span>
          <strong>596</strong>
        </div>
      </div>

      <div className="sm-card">
        <strong className="sm-text-sm">Token Accounts</strong>
        <div className="sm-token-list">
          {[
            { sym: 'USDC', amt: '142.50', usd: '$142.50' },
            { sym: 'JUP', amt: '1,204', usd: '$1,084' },
            { sym: 'BONK', amt: '2.4M', usd: '$48.22' },
          ].map((t) => (
            <div key={t.sym} className="sm-token-row">
              <div className="sm-token-icon">{t.sym[0]}</div>
              <div className="sm-token-info">
                <strong>{t.sym}</strong>
                <span className="sm-muted">{t.amt}</span>
              </div>
              <span className="sm-text-sm">{t.usd}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sm-card">
        <strong className="sm-text-sm">Recent Activity</strong>
        <div className="sm-activity-list">
          {[
            { action: 'Swap', detail: '0.5 SOL → 284 USDC', time: '2m ago' },
            { action: 'Receive', detail: '1.0 SOL from 9xPr...', time: '14m ago' },
            { action: 'Stake', detail: '2.0 SOL → mSOL', time: '1h ago' },
          ].map((a) => (
            <div key={a.detail} className="sm-activity-row">
              <div>
                <strong className="sm-text-xs">{a.action}</strong>
                <span className="sm-mono sm-text-xs sm-muted">{a.detail}</span>
              </div>
              <span className="sm-text-xs sm-muted">{a.time}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function DexScreen({ tick }: { tick: number }) {
  const tokens = useMemo(
    () => [
      { name: 'POPCAT', price: '$1.42', change: '+18.4%', mc: '$1.4B', hot: true },
      { name: 'WIF', price: '$2.88', change: '+7.2%', mc: '$2.9B', hot: true },
      { name: 'BONK', price: '$0.000020', change: '-2.1%', mc: '$1.3B', hot: false },
      { name: 'MYRO', price: '$0.16', change: '+42.1%', mc: '$162M', hot: true },
    ],
    [],
  )

  return (
    <>
      <div className="sm-dex-board-tabs">
        <span className="sm-dex-tab is-active">Trending</span>
        <span className="sm-dex-tab">Graduating</span>
        <span className="sm-dex-tab">New</span>
      </div>

      <div className="sm-card sm-dex-feed">
        <div className="sm-row-between sm-muted sm-text-xs" style={{ marginBottom: 8 }}>
          <span>Token</span>
          <span>MC / 24h</span>
        </div>
        {tokens.map((t) => (
          <div key={t.name} className="sm-dex-row">
            <div className="sm-dex-token-left">
              <div className="sm-token-icon sm-token-icon-dex">{t.name[0]}</div>
              <div>
                <strong className="sm-text-sm">{t.name}</strong>
                <span className="sm-mono sm-text-xs sm-muted">{t.price}</span>
              </div>
            </div>
            <div className="sm-dex-token-right">
              <span className="sm-text-xs sm-muted">{t.mc}</span>
              <span
                className={`sm-text-xs sm-mono ${t.change.startsWith('+') ? 'sm-text-green' : 'sm-text-red'}`}
              >
                {t.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="sm-card sm-card-glow">
        <div className="sm-row-between">
          <strong className="sm-text-sm">Datastream</strong>
          <span className="sm-status-dot sm-dot-green" />
        </div>
        <div className="sm-mono sm-text-xs sm-muted">
          {12 + (tick % 8)} events/sec &middot; slot {(258114392 + tick * 2).toLocaleString('en-US')}
        </div>
      </div>
    </>
  )
}

function GrokScreen({ tick }: { tick: number }) {
  const modes = ['Web', 'X', 'Image', 'Vision', 'Code'] as const
  const activeMode = modes[tick % modes.length]

  return (
    <>
      <div className="sm-grok-mode-bar">
        {modes.map((m) => (
          <span key={m} className={`sm-grok-mode${m === activeMode ? ' is-active' : ''}`}>
            {m}
          </span>
        ))}
      </div>

      <div className="sm-card sm-card-glow">
        <div className="sm-grok-prompt">
          <div className="sm-mono sm-text-xs sm-muted">grok-4.20-beta</div>
          <div className="sm-grok-input">
            <span className="sm-muted">analyze $POPCAT holder distribution...</span>
            <span className="sm-grok-cursor" />
          </div>
        </div>
      </div>

      <div className="sm-card">
        <strong className="sm-text-sm">Response</strong>
        <div className="sm-grok-response">
          <p className="sm-text-xs">
            POPCAT shows strong distribution with top 10 holders at 18.2% concentration. No single
            wallet above 4.1%. Liquidity depth is healthy at $2.4M in the primary pool.
          </p>
          <div className="sm-chip-row">
            <span className="sm-chip sm-chip-purple">web_search</span>
            <span className="sm-chip">x_search</span>
          </div>
        </div>
      </div>

      <div className="sm-card">
        <strong className="sm-text-sm">Gallery</strong>
        <div className="sm-grok-gallery">
          <div className="sm-grok-gallery-item" />
          <div className="sm-grok-gallery-item" />
          <div className="sm-grok-gallery-item" />
        </div>
      </div>
    </>
  )
}

function ChatScreen() {
  return (
    <>
      <div className="sm-chat-messages">
        <div className="sm-chat-msg sm-chat-user">
          <div className="sm-chat-bubble sm-chat-bubble-user">
            /model ollama 8bit/DeepSolana
          </div>
          <span className="sm-text-xs sm-muted">You</span>
        </div>

        <div className="sm-chat-msg sm-chat-agent">
          <div className="sm-chat-bubble sm-chat-bubble-agent">
            Model switched to <strong>8bit/DeepSolana</strong> via local Ollama.
            Reasoning mode: medium.
          </div>
          <span className="sm-text-xs sm-muted">SolanaOS</span>
        </div>

        <div className="sm-chat-msg sm-chat-user">
          <div className="sm-chat-bubble sm-chat-bubble-user">
            what's the current OODA state for my watchlist?
          </div>
          <span className="sm-text-xs sm-muted">You</span>
        </div>

        <div className="sm-chat-msg sm-chat-agent">
          <div className="sm-chat-bubble sm-chat-bubble-agent">
            <div className="sm-chat-tool-call">
              <span className="sm-chip sm-chip-green sm-chip-xs">tool</span>
              <span className="sm-mono sm-text-xs">ooda.watchlist_state()</span>
            </div>
            <div className="sm-text-xs" style={{ marginTop: 6 }}>
              JUP: OBSERVE &middot; BONK: DECIDE &middot; WIF: ACT
            </div>
          </div>
          <span className="sm-text-xs sm-muted">SolanaOS</span>
        </div>
      </div>

      <div className="sm-chat-input">
        <div className="sm-chat-input-box">
          <span className="sm-muted sm-text-xs">Message SolanaOS...</span>
        </div>
      </div>
    </>
  )
}

function ArcadeScreen() {
  return (
    <>
      <div className="sm-arcade-grid">
        <div className="sm-arcade-card">
          <div className="sm-arcade-preview sm-arcade-chess">
            <div className="sm-chess-board">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className={`sm-chess-cell ${(Math.floor(i / 4) + (i % 4)) % 2 === 0 ? 'sm-chess-light' : 'sm-chess-dark'}`}
                />
              ))}
            </div>
          </div>
          <strong className="sm-text-sm">Chess</strong>
          <span className="sm-text-xs sm-muted">Wallet identity &middot; Convex archive</span>
        </div>

        <div className="sm-arcade-card">
          <div className="sm-arcade-preview sm-arcade-snake">
            <div className="sm-snake-body">
              <div className="sm-snake-seg" style={{ left: '40%', top: '40%' }} />
              <div className="sm-snake-seg" style={{ left: '50%', top: '40%' }} />
              <div className="sm-snake-seg sm-snake-head" style={{ left: '60%', top: '40%' }} />
              <div className="sm-snake-food" style={{ left: '20%', top: '60%' }} />
            </div>
          </div>
          <strong className="sm-text-sm">Snake</strong>
          <span className="sm-text-xs sm-muted">Speed ramp &middot; Restartable</span>
        </div>

        <div className="sm-arcade-card">
          <div className="sm-arcade-preview sm-arcade-platform">
            <div className="sm-platform-ground" />
            <div className="sm-platform-player" />
            <div className="sm-platform-block" style={{ left: '55%', bottom: '28%' }} />
          </div>
          <strong className="sm-text-sm">Platformer</strong>
          <span className="sm-text-xs sm-muted">Physics &middot; Pixel art</span>
        </div>
      </div>
    </>
  )
}

function VoiceScreen({ tick }: { tick: number }) {
  const orbScale = 1 + Math.sin(tick * 0.8) * 0.12
  return (
    <>
      <div className="sm-voice-orb-container">
        <div
          className="sm-voice-orb"
          style={{ transform: `scale(${orbScale})` }}
        >
          <div className="sm-voice-orb-ring sm-voice-ring-1" />
          <div className="sm-voice-orb-ring sm-voice-ring-2" />
          <div className="sm-voice-orb-core" />
        </div>
        <div className="sm-text-xs sm-muted" style={{ marginTop: 12 }}>
          Listening &middot; Eve &middot; 24 kHz
        </div>
      </div>

      <div className="sm-card">
        <strong className="sm-text-sm">Transcript</strong>
        <div className="sm-voice-transcript">
          <div className="sm-voice-line sm-voice-line-user">
            What's the current SOL price and any major moves today?
          </div>
          <div className="sm-voice-line sm-voice-line-agent">
            SOL is at $178.42, up 3.2% in the last 24 hours. Jupiter volume hit $2.1B today
            with strong DEX activity.
          </div>
        </div>
      </div>

      <div className="sm-chip-row" style={{ justifyContent: 'center' }}>
        <span className="sm-chip sm-chip-purple">web_search</span>
        <span className="sm-chip sm-chip-purple">x_search</span>
        <span className="sm-chip">tools enabled</span>
      </div>
    </>
  )
}

function OreScreen({ tick }: { tick: number }) {
  const coverage = 20 + (tick % 5) * 4
  return (
    <>
      <div className="sm-metric-strip">
        <div className="sm-metric-box">
          <span>Wallet</span>
          <strong>2.48 SOL</strong>
        </div>
        <div className="sm-metric-box">
          <span>Coverage</span>
          <strong>{coverage}%</strong>
        </div>
        <div className="sm-metric-box">
          <span>Strategy</span>
          <strong>Balanced</strong>
        </div>
      </div>

      <div className="sm-card">
        <strong className="sm-text-sm">Mining Grid</strong>
        <div className="sm-ore-grid">
          {Array.from({ length: 25 }).map((_, i) => {
            const isMined = i < Math.floor(coverage / 4)
            const isMotherlode = i === 12 && tick % 7 === 0
            return (
              <div
                key={i}
                className={`sm-ore-cell ${isMined ? 'sm-ore-mined' : ''} ${isMotherlode ? 'sm-ore-motherlode' : ''}`}
              />
            )
          })}
        </div>
        <div className="sm-row-between sm-text-xs sm-muted" style={{ marginTop: 8 }}>
          <span>5x5 grid &middot; 60s rounds</span>
          <span>Motherlode: 1/625</span>
        </div>
      </div>

      <div className="sm-card sm-card-amber">
        <strong className="sm-text-sm">Risk Framing</strong>
        <p className="sm-text-xs sm-muted" style={{ margin: '6px 0 0' }}>
          ORE mining is variance-heavy. The app shows real bankroll risk before you commit capital.
          This is not a guaranteed return.
        </p>
      </div>
    </>
  )
}

function CanvasScreen({ tick }: { tick: number }) {
  return (
    <>
      <div className="sm-card sm-card-glow">
        <div className="sm-row-between">
          <strong className="sm-text-sm">Canvas Bridge</strong>
          <span className="sm-chip sm-chip-green sm-chip-xs">connected</span>
        </div>
        <div className="sm-mono sm-text-xs sm-muted" style={{ marginTop: 6 }}>
          ws://192.168.1.42:18791
        </div>
      </div>

      <div className="sm-canvas-viewport">
        <div className="sm-canvas-inner">
          <div className="sm-canvas-placeholder">
            <div className="sm-canvas-grid-lines" />
            <div className="sm-canvas-cursor" style={{
              left: `${30 + Math.sin(tick * 0.5) * 20}%`,
              top: `${40 + Math.cos(tick * 0.3) * 15}%`,
            }} />
          </div>
        </div>
        <div className="sm-text-xs sm-muted" style={{ marginTop: 8, textAlign: 'center' }}>
          Remote page payload from gateway
        </div>
      </div>

      <div className="sm-card">
        <strong className="sm-text-sm">A2UI Actions</strong>
        <div className="sm-btn-row">
          <span className="sm-btn-ghost">Rehydrate</span>
          <span className="sm-btn-ghost">Navigate</span>
          <span className="sm-btn-ghost">Close</span>
        </div>
      </div>
    </>
  )
}

function SettingsScreen() {
  return (
    <>
      <div className="sm-settings-group">
        <strong className="sm-text-sm">Runtime</strong>
        <SettingsRow label="Gateway Port" value="18790" />
        <SettingsRow label="Network" value="mainnet-beta" />
        <SettingsRow label="Protocol" value="v3" />
      </div>

      <div className="sm-settings-group">
        <strong className="sm-text-sm">Service</strong>
        <SettingsToggle label="Start on Boot" on />
        <SettingsToggle label="Foreground Service" on />
        <SettingsToggle label="Auto-reconnect" on />
      </div>

      <div className="sm-settings-group">
        <strong className="sm-text-sm">AI Providers</strong>
        <SettingsRow label="Primary" value="OpenRouter" />
        <SettingsRow label="Model" value="MiniMax-M2.7" />
        <SettingsRow label="Fallback" value="Together" />
      </div>

      <div className="sm-settings-group">
        <strong className="sm-text-sm">Security</strong>
        <SettingsRow label="Auth" value="Ed25519 v3" />
        <SettingsRow label="TLS" value="Pinned SHA-256" />
        <SettingsToggle label="Secure Prefs" on />
      </div>
    </>
  )
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="sm-settings-row">
      <span className="sm-text-xs">{label}</span>
      <span className="sm-mono sm-text-xs sm-muted">{value}</span>
    </div>
  )
}

function SettingsToggle({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="sm-settings-row">
      <span className="sm-text-xs">{label}</span>
      <div className={`sm-toggle ${on ? 'sm-toggle-on' : ''}`}>
        <div className="sm-toggle-knob" />
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────

function formatClock() {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date())
}
