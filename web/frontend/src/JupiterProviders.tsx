import { PropsWithChildren, useEffect } from 'react'
import { JupiverseKitProvider } from 'jupiverse-kit'
import { Toaster } from 'sonner'
import {
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
  registerMwa,
} from '@solana-mobile/wallet-standard-mobile'

declare global {
  interface Window {
    __solanaOsMwaRegistered?: boolean
  }
}

type PublicEnv = Record<string, string | undefined>

const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com'

function readPublicEnv(keys: string[], fallback = '') {
  const env = (import.meta as ImportMeta & { env: PublicEnv }).env
  for (const key of keys) {
    const value = env[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return fallback
}

function normalizeCluster(value: string) {
  if (value === 'devnet' || value === 'testnet') {
    return value
  }
  return 'mainnet-beta'
}

function getAppOrigin() {
  if (typeof window === 'undefined') {
    return 'https://solana.com'
  }
  return window.location.origin
}

export function AppProviders({ children }: PropsWithChildren) {
  const origin = getAppOrigin()
  const cluster = normalizeCluster(
    readPublicEnv(['VITE_SOLANA_CLUSTER', 'NEXT_PUBLIC_SOLANA_CLUSTER'], 'mainnet-beta'),
  )
  const rpcUrl = readPublicEnv(['VITE_RPC_URL', 'NEXT_PUBLIC_RPC_URL'], DEFAULT_RPC_URL)

  useEffect(() => {
    if (typeof window === 'undefined' || window.__solanaOsMwaRegistered) {
      return
    }

    registerMwa({
      appIdentity: {
        name: 'SolanaOS',
        uri: origin,
      },
      authorizationCache: createDefaultAuthorizationCache(),
      chains: ['solana:mainnet', 'solana:devnet'],
      chainSelector: createDefaultChainSelector(),
      onWalletNotFound: createDefaultWalletNotFoundHandler(),
    })

    window.__solanaOsMwaRegistered = true
  }, [origin])

  return (
    <JupiverseKitProvider
      autoConnect
      env={cluster}
      endpoint={rpcUrl}
      metadata={{
        name: 'SolanaOS',
        description: 'SolanaOS console with Jupiter terminal and Solana Mobile wallet support.',
        url: origin,
        iconUrls: [`${origin}/favicon.ico`],
      }}
      theme="jupiter"
    >
      {children}
      <Toaster richColors position="top-center" theme="dark" />
    </JupiverseKitProvider>
  )
}
