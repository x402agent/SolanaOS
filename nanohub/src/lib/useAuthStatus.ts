import { useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Doc } from '../../convex/_generated/dataModel'
import { loadWalletSession } from './nanosolanaWalletSession'
import { usePhantomState } from './phantomContext'

export function useAuthStatus() {
  const me = useQuery(api.users.me) as Doc<'users'> | null | undefined

  // Phantom SDK wallet (safe — returns disconnected if outside PhantomProvider)
  const { isConnected: phantomConnected, address: phantomAddress } = usePhantomState()

  // Gateway / pairing wallet session
  const [walletSession, setWalletSession] = useState(() =>
    typeof window !== 'undefined' ? loadWalletSession() : null,
  )
  useEffect(() => {
    const session = loadWalletSession()
    setWalletSession(session)
  }, [])
  const activeWalletSession =
    walletSession && walletSession.sessionExpiresAt > Date.now() ? walletSession : null

  // Unified wallet address: Convex linked > Phantom > wallet session
  const walletAddress =
    (me as Record<string, unknown> | null | undefined)?.solanaWalletAddress as string | null ??
    phantomAddress ??
    activeWalletSession?.walletAddress ??
    null

  // Authenticated if ANY auth source is active
  const isAuthenticated = Boolean(me) || phantomConnected || Boolean(activeWalletSession)

  return {
    me,
    isLoading: me === undefined && !phantomConnected && !activeWalletSession,
    isAuthenticated,
    /** True only when the user has a Convex/GitHub account */
    isConvexAuthed: Boolean(me),
    phantomConnected,
    phantomAddress,
    walletSession: activeWalletSession,
    /** Best available wallet address from any auth source */
    walletAddress,
  }
}
