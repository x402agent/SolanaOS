import { useModal } from '@phantom/react-sdk'
import { useAuthActions } from '@convex-dev/auth/react'
import { Link } from '@tanstack/react-router'
import { Github, Wallet } from 'lucide-react'
import { useAuthStatus } from '../lib/useAuthStatus'
import { getUserFacingConvexError } from '../lib/convexError'
import { setAuthError, useAuthError } from '../lib/useAuthError'

export default function AuthGatePrivate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStatus()
  const { open: openPhantom } = useModal()
  const { signIn } = useAuthActions()
  const { error: authError, clear: clearAuthError } = useAuthError()

  if (isAuthenticated) return <>{children}</>

  if (isLoading) {
    return (
      <main className="section" style={{ textAlign: 'center', paddingTop: 80 }}>
        <div className="card" style={{ maxWidth: 420, margin: '0 auto', padding: 32 }}>
          <div className="launch-cursor" style={{ fontSize: '2rem', marginBottom: 16 }}>
            █
          </div>
          <p style={{ color: 'var(--ink-soft)' }}>Checking authentication...</p>
        </div>
      </main>
    )
  }

  const signInRedirectTo =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}${window.location.hash}`
      : '/'

  return (
    <main className="section">
      <div className="auth-gate">
        <div className="auth-gate-terminal">
          <div className="launch-terminal-chrome">
            <div className="launch-terminal-dots">
              <span className="launch-dot red" />
              <span className="launch-dot yellow" />
              <span className="launch-dot green" />
            </div>
            <span className="launch-terminal-title">access control</span>
          </div>
          <div style={{ padding: '32px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔒</div>
            <h1
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.3rem',
                color: '#14f195',
                letterSpacing: 2,
                margin: '0 0 8px',
              }}
            >
              AUTHENTICATION REQUIRED
            </h1>
            <p style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', marginBottom: 24 }}>
              Connect your Solana wallet to get started. GitHub sign-in is optional and unlocks skill publishing.
            </p>

            {authError ? (
              <p className="gallery-error" style={{ marginBottom: 16 }}>
                {authError}{' '}
                <button
                  type="button"
                  onClick={clearAuthError}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'inherit',
                  }}
                >
                  &times;
                </button>
              </p>
            ) : null}

            <div className="auth-gate-buttons">
              <button
                type="button"
                className="btn btn-primary auth-gate-btn"
                onClick={openPhantom}
              >
                <Wallet className="h-4 w-4" aria-hidden="true" />
                Connect Wallet
              </button>

              <button
                type="button"
                className="btn auth-gate-btn"
                onClick={() => {
                  clearAuthError()
                  void signIn(
                    'github',
                    signInRedirectTo ? { redirectTo: signInRedirectTo } : undefined,
                  ).catch((error) => {
                    setAuthError(getUserFacingConvexError(error, 'Sign in failed.'))
                  })
                }}
              >
                <Github className="h-4 w-4" aria-hidden="true" />
                Sign in with GitHub
              </button>
            </div>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
                New here?{' '}
                <Link to="/launch" style={{ color: 'var(--accent)' }}>
                  See what SolanaOS is about
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
