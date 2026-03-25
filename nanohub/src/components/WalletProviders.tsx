import { AddressType, PhantomProvider, darkTheme, usePhantom } from '@phantom/react-sdk'
import { PhantomStateContext } from '../lib/phantomContext'
import { MobileWalletAdapterProvider } from './MobileWalletAdapterProvider'

const PHANTOM_APP_ID = import.meta.env.VITE_PHANTOM_APP_ID || ''
const SITE_ORIGIN =
  typeof window !== 'undefined' ? window.location.origin : 'https://seeker.solanaos.net'

/** Reads usePhantom() and pushes state into our safe context */
function PhantomStateBridge({ children }: { children: React.ReactNode }) {
  const { isConnected, user } = usePhantom()
  const address =
    user?.addresses?.find((a) => a.addressType === AddressType.solana)?.address ?? null

  return (
    <PhantomStateContext.Provider value={{ isConnected, address }}>
      {children}
    </PhantomStateContext.Provider>
  )
}

export default function WalletProviders({ children }: { children: React.ReactNode }) {
  const content = <MobileWalletAdapterProvider>{children}</MobileWalletAdapterProvider>

  if (!PHANTOM_APP_ID) return content

  return (
    <PhantomProvider
      config={{
        providers: ['google', 'apple', 'injected'],
        appId: PHANTOM_APP_ID,
        addressTypes: [AddressType.solana],
        authOptions: {
          redirectUrl: `${SITE_ORIGIN}/auth/callback`,
        },
      }}
      theme={darkTheme}
      appName="SolanaOS Hub"
    >
      <PhantomStateBridge>{content}</PhantomStateBridge>
    </PhantomProvider>
  )
}
