import { createFileRoute, Link } from '@tanstack/react-router'
import { ExternalLink, QrCode, Smartphone, Terminal, Wifi } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { trackHubEvent } from '../lib/analytics'

export const Route = createFileRoute('/pair')({
  component: PairRoute,
})

function PairRoute() {
  const search = Route.useSearch() as { token?: string }
  const pairingToken = search.token?.trim().toString() || ''
  const deepLinkUrl = useMemo(() => {
    if (!pairingToken) return ''
    const url = new URL('solanaos://pair')
    url.searchParams.set('token', pairingToken)
    return url.toString()
  }, [pairingToken])
  const [status, setStatus] = useState(pairingToken ? 'Opening SolanaOS on your Seeker...' : '')

  useEffect(() => {
    trackHubEvent('pair_route_view', {
      surface: 'pair',
      has_token: Boolean(pairingToken),
    })
  }, [pairingToken])

  useEffect(() => {
    if (!deepLinkUrl) return
    const launch = window.setTimeout(() => {
      trackHubEvent('pair_deeplink_launch', {
        surface: 'pair',
        mode: 'auto',
      })
      window.location.href = deepLinkUrl
    }, 250)
    const fallback = window.setTimeout(() => {
      setStatus('If the app did not open automatically, tap the button below.')
    }, 1800)
    return () => {
      window.clearTimeout(launch)
      window.clearTimeout(fallback)
    }
  }, [deepLinkUrl])

  if (!pairingToken) {
    return <PairLanding />
  }

  return (
    <main className="section">
      <section className="wallet-pairing card pair-launch-card">
        <div className="gallery-panel-header">
          <div>
            <h1>Open SolanaOS On Seeker</h1>
            <p>Launching the app and completing wallet pairing on-device.</p>
          </div>
          <Smartphone className="gallery-panel-icon" aria-hidden="true" />
        </div>

        <div className="pair-launch-body">
          <p className="gallery-copy-text">{status}</p>

          {deepLinkUrl && (
            <>
              <a
                className="btn btn-primary"
                href={deepLinkUrl}
                onClick={() =>
                  trackHubEvent('pair_deeplink_launch', {
                    surface: 'pair',
                    mode: 'manual',
                  })
                }
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Open SolanaOS
              </a>
              <p className="gallery-locked">
                Deep link: <code>{deepLinkUrl}</code>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  )
}

function PairLanding() {
  return (
    <main className="section">
      <section className="card" style={{ padding: '32px 20px', textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(20,241,149,0.15), rgba(0,212,255,0.1))',
          border: '1px solid var(--border-ui)',
          marginBottom: 20,
        }}>
          <Wifi size={28} style={{ color: 'var(--accent)' }} />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 8 }}>
          Pair Your Seeker
        </h1>
        <p style={{ color: 'var(--ink-soft)', maxWidth: 480, marginInline: 'auto', lineHeight: 1.6, marginBottom: 0 }}>
          Connect your Solana Seeker device to your SolanaOS daemon for real-time wallet control, trading, and agent management.
        </p>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StepCard
          step={1}
          icon={<Terminal size={20} />}
          title="Start Your Gateway"
          description="Run the gateway on your local machine to generate a pairing code."
          code="solanaos gateway start && solanaos gateway setup-code"
        />
        <StepCard
          step={2}
          icon={<QrCode size={20} />}
          title="Scan the QR Code"
          description="Open the Seeker app camera or use the Connect tab to scan the setup code QR."
        />
        <StepCard
          step={3}
          icon={<Smartphone size={20} />}
          title="Confirm on Device"
          description="The Seeker will auto-pair and connect to your daemon. You're ready to trade."
        />
      </div>

      <section className="card" style={{ padding: '24px 28px' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: 12 }}>
          Other ways to pair
        </h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/dashboard" className="btn btn-primary" style={{ padding: '10px 20px' }}>
            Generate QR from Dashboard
          </Link>
          <Link to="/setup/gateway" className="btn" style={{ padding: '10px 20px' }}>
            Gateway Setup Guide
          </Link>
        </div>
      </section>
    </main>
  )
}

function StepCard({
  step,
  icon,
  title,
  description,
  code,
}: {
  step: number
  icon: React.ReactNode
  title: string
  description: string
  code?: string
}) {
  return (
    <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(20,241,149,0.2), rgba(0,212,255,0.15))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--accent)',
          border: '1px solid var(--border-ui)',
          flexShrink: 0,
        }}>
          {step}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)' }}>
          {icon}
          <span style={{ fontWeight: 650, fontSize: 15 }}>{title}</span>
        </div>
      </div>
      <p style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
        {description}
      </p>
      {code && (
        <code style={{
          display: 'block',
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-soft)',
          border: '1px solid var(--line)',
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          color: 'var(--ink)',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}>
          {code}
        </code>
      )}
    </div>
  )
}
