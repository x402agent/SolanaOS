import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { trackHubEvent } from '../lib/analytics'
import { getNanoHubSiteUrl } from '../lib/site'

export const Route = createFileRoute('/launch')({
  head: () => {
    const url = `${getNanoHubSiteUrl()}/launch`
    const title = 'SolanaOS Launch | The Solana Computer'
    const description =
      'See the live SolanaOS launch surface: Seeker mobile dapp, gateway runtime, skills, trading, voice, ORE, and operator tooling.'

    return {
      links: [
        {
          rel: 'canonical',
          href: url,
        },
      ],
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
  component: LaunchPage,
})

const BOOT_LINES = [
  { text: 'SolanaOS v3.0.0 — The Solana Computer', delay: 0, color: '#14f195' },
  { text: 'Initializing runtime...', delay: 400, color: '#888' },
  { text: '├─ Go binary loaded (9.2 MB)', delay: 800, color: '#00d4ff' },
  { text: '├─ Wallet: connected', delay: 1100, color: '#14f195' },
  { text: '├─ Gateway API: seeker.solanaos.net', delay: 1400, color: '#00d4ff' },
  { text: '├─ Telegram: @solanaos_bot', delay: 1700, color: '#00d4ff' },
  { text: '├─ OODA loop: armed', delay: 2000, color: '#ffc800' },
  { text: '├─ Honcho v3 memory: online', delay: 2300, color: '#14f195' },
  { text: '├─ SolanaTracker RPC: connected', delay: 2600, color: '#14f195' },
  { text: '├─ Phantom Connect: ready', delay: 2900, color: '#ab9ff2' },
  { text: '├─ Metaplex 014 Registry: armed', delay: 3200, color: '#e42575' },
  { text: '├─ BitAxe fleet: 0 miners (awaiting config)', delay: 3500, color: '#ff6600' },
  { text: '├─ Chrome extension: loaded', delay: 3800, color: '#00d4ff' },
  { text: '├─ Skills registry: 80+ skills available', delay: 4100, color: '#14f195' },
  { text: '├─ Strategy engine: multi-venue armed', delay: 4400, color: '#ffc800' },
  { text: '└─ Companion state: egg → awaiting operator', delay: 4700, color: '#ff6600' },
  { text: '', delay: 5000, color: '#888' },
  { text: 'All systems nominal. Ready for launch.', delay: 5200, color: '#14f195' },
]

const FEATURES = [
  { icon: '🖥', title: 'Gateway', desc: 'Terminal runtime + API', link: '/setup/gateway' },
  { icon: '📱', title: 'Seeker App', desc: 'Android + MWA wallet', link: '/mobile' },
  { icon: '💬', title: 'Telegram', desc: 'Remote operator bot', link: '/setup/telegram' },
  { icon: '🧩', title: 'Extension', desc: 'Chrome toolbar control', link: '/setup/extension' },
  { icon: '⛏', title: 'Mining', desc: 'BitAxe fleet + TamaGOchi', link: '/mining' },
  { icon: '📊', title: 'Strategy', desc: 'Multi-venue builder', link: '/strategy' },
  { icon: '⬡', title: 'Metaplex', desc: '014 Agent Registry', link: '/setup/metaplex' },
  { icon: '📦', title: 'Skills', desc: '80+ agent skills', link: '/skills' },
  { icon: '🧠', title: 'Souls', desc: 'SOUL.md library', link: '/souls' },
  { icon: '🎨', title: 'Gallery', desc: 'AI art feed', link: '/dashboard' },
  { icon: '🔗', title: 'Phantom', desc: 'Wallet connect', link: '/dashboard' },
  { icon: '🤖', title: 'Agents', desc: '8004 + Metaplex directory', link: '/agents' },
]

function LaunchPage() {
  const [visibleLines, setVisibleLines] = useState(0)
  const [bootDone, setBootDone] = useState(false)
  const [showFeatures, setShowFeatures] = useState(false)
  const [glitchText, setGlitchText] = useState('')
  const terminalRef = useRef<HTMLDivElement>(null)

  // Boot sequence
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 0; i < BOOT_LINES.length; i++) {
      timers.push(setTimeout(() => {
        setVisibleLines(i + 1)
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight
        }
      }, BOOT_LINES[i].delay))
    }
    timers.push(setTimeout(() => setBootDone(true), 5600))
    timers.push(setTimeout(() => setShowFeatures(true), 6200))
    return () => timers.forEach(clearTimeout)
  }, [])

  // Glitch effect on title
  useEffect(() => {
    if (!bootDone) return
    const chars = 'SOLANAOS'
    const glitchChars = '█▓░▒╗╔╚╝━┃'
    let frame = 0
    const interval = setInterval(() => {
      frame++
      if (frame > 20) {
        setGlitchText('')
        clearInterval(interval)
        return
      }
      if (frame % 3 === 0) {
        const pos = Math.floor(Math.random() * chars.length)
        const arr = chars.split('')
        arr[pos] = glitchChars[Math.floor(Math.random() * glitchChars.length)]
        setGlitchText(arr.join(''))
      } else {
        setGlitchText('')
      }
    }, 80)
    return () => clearInterval(interval)
  }, [bootDone])

  return (
    <div className="launch-page">
      {/* Scanlines */}
      <div className="launch-scanlines" />

      {/* Ambient orbs */}
      <div className="launch-orb launch-orb-1" />
      <div className="launch-orb launch-orb-2" />
      <div className="launch-orb launch-orb-3" />

      {/* Terminal */}
      <div className="launch-terminal-wrapper">
        <div className="launch-terminal">
          <div className="launch-terminal-chrome">
            <div className="launch-terminal-dots">
              <span className="launch-dot red" />
              <span className="launch-dot yellow" />
              <span className="launch-dot green" />
            </div>
            <span className="launch-terminal-title">solanaos — zsh — 80×24</span>
          </div>
          <div className="launch-terminal-body" ref={terminalRef}>
            <div className="launch-ascii">
{`   _____       __                        ____  _____
  / ___/____  / /___ _____  ____ _     / __ \\/ ___/
  \\__ \\/ __ \\/ / __ \`/ __ \\/ __ \`/    / / / /\\__ \\
 ___/ / /_/ / / /_/ / / / / /_/ /    / /_/ /___/ /
/____/\\____/_/\\__,_/_/ /_/\\__,_/     \\____//____/`}
            </div>
            {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
              <div key={i} className="launch-line" style={{ color: line.color }}>
                {line.text ? (
                  <>
                    <span className="launch-prompt">{i === 0 ? '$ ' : '  '}</span>
                    {line.text}
                  </>
                ) : null}
              </div>
            ))}
            {!bootDone ? <span className="launch-cursor">█</span> : null}
          </div>
        </div>
      </div>

      {/* Hero text */}
      <div className={`launch-hero ${bootDone ? 'visible' : ''}`}>
        <h1 className="launch-title">
          {glitchText || 'SOLANAOS'}
        </h1>
        <p className="launch-tagline">The Solana Computer</p>
        <p className="launch-subtitle">
          Autonomous operator runtime for trading, research, wallets, and hardware.
          <br />
          Pair a Seeker, inspect the runtime, and operate through one local-first control plane.
        </p>
        <div className="launch-cta">
          <Link
            to="/mobile"
            className="btn btn-primary launch-btn"
            onClick={() => trackHubEvent('launch_cta_click', { cta: 'mobile', surface: 'launch' })}
          >
            Open Seeker Mobile dApp
          </Link>
          <Link
            to="/dashboard"
            className="btn btn-primary launch-btn"
            onClick={() =>
              trackHubEvent('launch_cta_click', { cta: 'dashboard', surface: 'launch' })
            }
          >
            Open Operator Dashboard
          </Link>
          <a
            href="https://github.com/x402agent/Solana-Os-Go"
            target="_blank"
            rel="noreferrer"
            className="btn launch-btn"
            onClick={() => trackHubEvent('launch_cta_click', { cta: 'github', surface: 'launch' })}
          >
            GitHub
          </a>
          <Link
            to="/skills"
            search={{
              q: undefined,
              sort: undefined,
              dir: undefined,
              highlighted: undefined,
              nonSuspicious: true,
              view: undefined,
              focus: undefined,
            }}
            className="btn launch-btn"
            onClick={() => trackHubEvent('launch_cta_click', { cta: 'skills', surface: 'launch' })}
          >
            Install Skills
          </Link>
        </div>
      </div>

      {/* Feature grid */}
      <div className={`launch-features ${showFeatures ? 'visible' : ''}`}>
        <h2 className="launch-section-title">Everything Built In</h2>
        <div className="launch-feature-grid">
          {FEATURES.map((f, i) => (
            <Link
              key={f.title}
              to={f.link as '/'}
              className="launch-feature-card"
              style={{ animationDelay: `${i * 60}ms` }}
              onClick={() =>
                trackHubEvent('launch_feature_click', {
                  feature: f.title.toLowerCase(),
                  surface: 'launch',
                })
              }
            >
              <span className="launch-feature-icon">{f.icon}</span>
              <div>
                <div className="launch-feature-title">{f.title}</div>
                <div className="launch-feature-desc">{f.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className={`launch-stats ${showFeatures ? 'visible' : ''}`}>
        {[
          { label: 'Binary', value: '<10 MB' },
          { label: 'Skills', value: '80+' },
          { label: 'Venues', value: '3' },
          { label: 'Surfaces', value: '7' },
          { label: 'License', value: 'MIT' },
        ].map((s) => (
          <div key={s.label} className="launch-stat">
            <div className="launch-stat-value">{s.value}</div>
            <div className="launch-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <footer className="launch-footer">
        <p>SolanaOS · Built by SolanaOS Labs · Powered by Go · Built on Solana</p>
        <p>
          <a href="https://seeker.solanaos.net">Hub</a> · <a href="https://souls.solanaos.net">Souls</a> · <a href="https://github.com/x402agent/Solana-Os-Go">GitHub</a>
        </p>
      </footer>
    </div>
  )
}
