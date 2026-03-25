import { useEffect, useRef } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuthStatus } from './useAuthStatus'
import { loadWalletSession } from './nanosolanaWalletSession'

const HEARTBEAT_INTERVAL_MS = 60_000 // 1 minute

/**
 * Read Phantom wallet address from localStorage.
 * This avoids depending on usePhantom() which requires PhantomProvider.
 */
function getPhantomAddress(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('phantom.wallet.connected')
    if (raw) {
      const parsed = JSON.parse(raw)
      return parsed?.solana?.address ?? parsed?.address ?? null
    }
    // Fallback: check the Solana provider directly
    const provider = (window as any).phantom?.solana
    if (provider?.isConnected && provider?.publicKey) {
      return provider.publicKey.toString()
    }
  } catch { /* ignore */ }
  return null
}

export function usePresenceHeartbeat() {
  const heartbeat = useMutation(api.nanosolanaPresence.heartbeat)
  const { isAuthenticated, user } = useAuthStatus()
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    const send = () => {
      let identifier = ''
      let authMethod: 'wallet' | 'github' | 'mobile' = 'wallet'
      let walletAddress: string | undefined
      let githubUsername: string | undefined

      // Check Phantom wallet (reads from window/localStorage, no hook needed)
      const phantomAddr = getPhantomAddress()
      if (phantomAddr) {
        identifier = phantomAddr
        authMethod = 'wallet'
        walletAddress = phantomAddr
      } else if (isAuthenticated && user) {
        identifier = user._id ?? user.name ?? ''
        authMethod = 'github'
        githubUsername = user.name
      } else {
        const session = loadWalletSession()
        if (session && session.sessionExpiresAt > Date.now()) {
          identifier = session.walletAddress ?? `session-${Date.now()}`
          authMethod = 'mobile'
          walletAddress = session.walletAddress
        }
      }

      if (!identifier) return

      void heartbeat({
        identifier,
        authMethod,
        walletAddress,
        githubUsername,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : undefined,
      }).catch(() => {
        // Non-fatal — presence is best-effort
      })
    }

    send()
    intervalRef.current = setInterval(send, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [heartbeat, isAuthenticated, user])
}

export function useOnlineCount() {
  return useQuery(api.nanosolanaPresence.getOnlineCount) ?? { total: 0, wallet: 0, github: 0, mobile: 0 }
}

export function useTotalUsers() {
  return useQuery(api.nanosolanaPresence.getTotalUsers) ?? { total: 0, wallet: 0, github: 0, mobile: 0 }
}
