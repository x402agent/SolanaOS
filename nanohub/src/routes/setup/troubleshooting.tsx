import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertTriangle, Bot, Radio, ShieldAlert, Wrench } from 'lucide-react'
import { CopyBlock } from '../../components/SetupStepper'

export const Route = createFileRoute('/setup/troubleshooting')({
  component: TroubleshootingRoute,
})

function TroubleshootingRoute() {
  return (
    <main>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy fade-up" data-delay="1">
            <span className="hero-badge">SolanaOS / Troubleshooting</span>
            <h1 className="hero-title">Operational fixes for Seeker, gateway, bridge, skills, and mobile runtime failures.</h1>
            <p className="hero-subtitle">
              This page adapts the mobile diagnostics playbook into a SolanaOS runbook. Keep the
              public hub at <code>https://seeker.solanaos.net</code> and the skills catalog at{' '}
              <code>https://seeker.solanaos.net/solanaos</code> as the canonical recovery
              surfaces.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
              <a href="https://seeker.solanaos.net" className="btn btn-primary">
                Open hub
              </a>
              <a href="https://seeker.solanaos.net/solanaos" className="btn">
                Open skills
              </a>
              <Link to="/setup/gateway" className="btn">
                Gateway setup
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="grid">
          <article className="card solanaos-feature-card">
            <div className="catalog-card-top">
              <h3 className="skill-card-title">Gateway and bridge</h3>
              <Radio className="gallery-panel-icon" aria-hidden="true" />
            </div>
            <p className="stat" style={{ margin: 0 }}>
              Use this first when the Seeker says the gateway is offline, canvas is stale, or the
              localhost device bridge is unavailable.
            </p>
            <CopyBlock code={`solanaos gateway start`} label="Copy gateway command" />
            <CopyBlock code={`curl -sS http://127.0.0.1:8765/ping`} label="Copy bridge ping" />
          </article>
          <article className="card solanaos-feature-card">
            <div className="catalog-card-top">
              <h3 className="skill-card-title">LLM and transport</h3>
              <Bot className="gallery-panel-icon" aria-hidden="true" />
            </div>
            <p className="stat" style={{ margin: 0 }}>
              Use this when responses cut off, runs stall, or the model returns context overflow or
              rate-limit failures.
            </p>
            <CopyBlock code={`rg -n "ETIMEDOUT|ECONNRESET|socket hang up|too many tokens|context" node_debug.log | tail -20`} label="Copy transport check" />
          </article>
          <article className="card solanaos-feature-card">
            <div className="catalog-card-top">
              <h3 className="skill-card-title">Permissions and tools</h3>
              <ShieldAlert className="gallery-panel-icon" aria-hidden="true" />
            </div>
            <p className="stat" style={{ margin: 0 }}>
              Use this when camera, SMS, contacts, notifications, or location actions fail even
              though the runtime is otherwise healthy.
            </p>
            <CopyBlock code={`solanaos version`} label="Copy diagnostics command" />
          </article>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">1. Gateway or bridge down</h2>
        <p className="section-subtitle">
          Symptoms: Seeker shows offline, the app reports no cached or reachable gateway, or local
          mobile tools stop responding.
        </p>
        <div className="card" style={{ gap: 16 }}>
          <p className="stat" style={{ margin: 0 }}>
            If the bridge is down, reopen the SolanaOS app and keep it in the foreground long
            enough for the runtime to reattach. The Android build now exposes a loopback SolanaOS
            compatibility bridge on <code>127.0.0.1:8765</code>.
          </p>
          <CopyBlock code={`curl -sS http://127.0.0.1:8765/ping`} label="Copy bridge health check" />
          <CopyBlock code={`curl -sS http://127.0.0.1:8765/battery\ncurl -sS http://127.0.0.1:8765/storage`} label="Copy device checks" />
          <CopyBlock code={`solanaos gateway start --no-tailscale`} label="Copy local-only gateway start" />
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">2. Telegram or channel failures</h2>
        <p className="section-subtitle">
          Symptoms: no bot replies, delayed messages, or 401/429 errors in logs.
        </p>
        <div className="card" style={{ gap: 16 }}>
          <CopyBlock code={`rg -n "401|Unauthorized|FORBIDDEN|429|Too Many Requests" node_debug.log | tail -20`} label="Copy Telegram log check" />
          <p className="stat" style={{ margin: 0 }}>
            `401 Unauthorized` usually means the bot token is invalid or revoked. `429` means the
            channel is rate-limited and should be allowed to cool down before retrying.
          </p>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">3. LLM transport and context issues</h2>
        <p className="section-subtitle">
          Symptoms: partial responses, dropped streams, or context overflow errors.
        </p>
        <div className="card" style={{ gap: 16 }}>
          <CopyBlock code={`rg -n "\\[Trace\\]|ETIMEDOUT|ECONNRESET|socket hang up" node_debug.log | tail -20`} label="Copy transport trace check" />
          <CopyBlock code={`/new`} label="Reset long chat history" />
          <p className="stat" style={{ margin: 0 }}>
            Long tool payloads and unstable networks are the most common causes. Prefer smaller
            queries and reconnect on stable Wi-Fi before escalating.
          </p>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">4. Tool and permission mismatches</h2>
        <p className="section-subtitle">
          Symptoms: mobile actions fail without obvious runtime errors.
        </p>
        <div className="grid">
          {[
            ['SMS', 'Grant SEND_SMS and keep telephony available.'],
            ['Camera', 'Grant CAMERA and keep the app foregrounded for capture.'],
            ['Location', 'Grant coarse or fine location and keep SolanaOS open.'],
            ['Notifications', 'Grant POST_NOTIFICATIONS and notification-listener access where required.'],
          ].map(([title, summary]) => (
            <article key={title} className="card catalog-card">
              <div className="catalog-card-top">
                <h3 className="skill-card-title">{title}</h3>
                <Wrench className="gallery-panel-icon" aria-hidden="true" />
              </div>
              <p className="stat" style={{ margin: 0 }}>
                {summary}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">5. Skills, storage, and recovery</h2>
        <p className="section-subtitle">
          Symptoms: skills do not trigger, memory writes fail, or large outputs appear truncated.
        </p>
        <div className="card" style={{ gap: 16 }}>
          <CopyBlock code={`df -h\nrg -n "ENOSPC|disk.*full|memory_save|write.*fail" node_debug.log | tail -20`} label="Copy storage check" />
          <p className="stat" style={{ margin: 0 }}>
            Large tool outputs should be narrowed before retrying. If storage is tight, clear old
            logs or media and reinstall missing skills from the hub.
          </p>
          <a href="https://seeker.solanaos.net/solanaos" className="btn btn-primary">
            Reinstall skills from SolanaOS Hub
          </a>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <div className="catalog-card-top">
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              Escalation path
            </h2>
            <AlertTriangle className="gallery-panel-icon" aria-hidden="true" />
          </div>
          <p className="section-subtitle" style={{ marginBottom: 0 }}>
            If the device still fails after these checks, refresh the Seeker registration from the
            public hub, reconnect the gateway, and then retry from a clean foreground app state.
          </p>
        </div>
      </section>
    </main>
  )
}
