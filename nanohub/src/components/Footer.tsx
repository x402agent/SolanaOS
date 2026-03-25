import { getSiteName } from '../lib/site'

export function Footer() {
  const siteName = getSiteName()
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-divider" aria-hidden="true" />
        <div className="site-footer-row">
          <div className="site-footer-copy">
            {siteName} · A{' '}
            <a href="https://solanaos.net" target="_blank" rel="noreferrer">
              SolanaOS
            </a>{' '}
            project · Powered by{' '}
            <a href="https://www.convex.dev" target="_blank" rel="noreferrer">
              Convex
            </a>{' '}
            ·{' '}
            <a
              href="https://github.com/x402agent/Solana-Os-Go"
              target="_blank"
              rel="noreferrer"
            >
              Open source (MIT)
            </a>
            .
          </div>
        </div>
      </div>
    </footer>
  )
}
