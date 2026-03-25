import { ConvexAuthProvider, useAuthActions } from '@convex-dev/auth/react'
import { useRouterState } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { convex, convexUrl } from '../convex/client'
import { getUserFacingConvexError } from '../lib/convexError'
import { persistWalletSession, type NanosolanaWalletSession } from '../lib/nanosolanaWalletSession'
import { isPublicPath } from '../lib/publicRoutes'
import { clearAuthError, setAuthError } from '../lib/useAuthError'
import { UserBootstrap } from './UserBootstrap'
const WalletProviders = lazy(() => import('./WalletProviders'))

function getPendingAuthCode() {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  if (!code) return null
  url.searchParams.delete('code')
  return {
    code,
    relativeUrl: `${url.pathname}${url.search}${url.hash}`,
  }
}

function getPendingWalletSession() {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  const sessionToken = url.searchParams.get('sessionToken')?.trim()
  const walletAddress = url.searchParams.get('walletAddress')?.trim()
  const sessionExpiresAt = Number(url.searchParams.get('sessionExpiresAt') || '')
  const displayName = url.searchParams.get('displayName')?.trim() || null
  if (!sessionToken || !walletAddress || !Number.isFinite(sessionExpiresAt) || sessionExpiresAt <= Date.now()) {
    return null
  }
  url.searchParams.delete('sessionToken')
  url.searchParams.delete('walletAddress')
  url.searchParams.delete('sessionExpiresAt')
  url.searchParams.delete('displayName')
  return {
    session: {
      walletAddress,
      displayName,
      sessionToken,
      sessionExpiresAt,
    } satisfies NanosolanaWalletSession,
    relativeUrl: `${url.pathname}${url.search}${url.hash}`,
  }
}

export function AuthCodeHandler() {
  const { signIn } = useAuthActions()
  const handledCodeRef = useRef<string | null>(null)
  const signInWithCode = signIn as (
    provider: string | undefined,
    params: { code: string },
  ) => Promise<{ signingIn: boolean }>

  useEffect(() => {
    const pending = getPendingAuthCode()
    if (!pending) return
    if (handledCodeRef.current === pending.code) return
    handledCodeRef.current = pending.code

    clearAuthError()
    window.history.replaceState(null, '', pending.relativeUrl)

    void signInWithCode(undefined, { code: pending.code })
      .then((result) => {
        if (result.signingIn === false) {
          setAuthError('Sign in failed. Please try again.')
        }
      })
      .catch((error) => {
        setAuthError(getUserFacingConvexError(error, 'Sign in failed. Please try again.'))
      })
  }, [signInWithCode])

  return null
}

function WalletSessionBootstrap() {
  const handledTokenRef = useRef<string | null>(null)

  useEffect(() => {
    const pending = getPendingWalletSession()
    if (!pending) return
    if (handledTokenRef.current === pending.session.sessionToken) return
    handledTokenRef.current = pending.session.sessionToken
    persistWalletSession(pending.session)
    window.history.replaceState(null, '', pending.relativeUrl)
  }, [])

  return null
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  if (!convex) {
    return (
      <div className="app-shell">
        <div style={{ maxWidth: 820, margin: '4rem auto', padding: '2rem' }}>
          <h1>SolanaOS Hub setup required</h1>
          <p>
            <code>VITE_CONVEX_URL</code> is not configured, so the Convex client
            cannot start.
          </p>
          <p>For local development:</p>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{`cp .env.local.example .env.local
bunx convex dev
bun run dev`}</pre>
          <p>
            Then set <code>VITE_CONVEX_URL</code> in <code>.env.local</code>.
          </p>
          <p>
            Current value: <code>{convexUrl || 'missing'}</code>
          </p>
        </div>
      </div>
    )
  }

  const appContent = (
    <ConvexAuthProvider client={convex} shouldHandleCode={false}>
      <AuthCodeHandler />
      <WalletSessionBootstrap />
      <UserBootstrap />
      {children}
    </ConvexAuthProvider>
  )

  if (isPublicPath(pathname)) return appContent

  return (
    <Suspense fallback={null}>
      <WalletProviders>{appContent}</WalletProviders>
    </Suspense>
  )
}
