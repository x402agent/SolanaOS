import {
  SolanaMobileWalletAdapterWalletName,
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
  registerMwa,
} from '@solana-mobile/wallet-standard-mobile'
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

const STANDARD_CONNECT = 'standard:connect'
const STANDARD_DISCONNECT = 'standard:disconnect'
const STANDARD_EVENTS = 'standard:events'
const DEFAULT_SITE_ORIGIN = 'https://seeker.solanaos.net'

type WalletAccount = {
  readonly address: string
  readonly publicKey: Uint8Array
  readonly chains: readonly string[]
  readonly features: readonly string[]
  readonly label?: string
  readonly icon?: string
}

type WalletStandardWallet = {
  readonly version: string
  readonly name: string
  readonly icon: string
  readonly chains: readonly string[]
  readonly features: Record<string, unknown>
  readonly accounts: readonly WalletAccount[]
}

type WalletRegistry = {
  get(): readonly WalletStandardWallet[]
  on(
    event: 'register' | 'unregister',
    listener: (...wallets: WalletStandardWallet[]) => void,
  ): () => void
}

type ConnectFeature = {
  readonly connect: (input?: { silent?: boolean }) => Promise<{ accounts: readonly WalletAccount[] }>
}

type DisconnectFeature = {
  readonly disconnect: () => Promise<void>
}

type EventsFeature = {
  readonly on: (event: 'change', listener: (...args: unknown[]) => void) => (() => void) | void
}

type MobileWalletAdapterContextValue = {
  available: boolean
  connected: boolean
  address: string | null
  busy: boolean
  errorText: string | null
  isAndroid: boolean
  isWebView: boolean
  connect: () => Promise<string | null>
  disconnect: () => Promise<void>
}

const MobileWalletAdapterContext = createContext<MobileWalletAdapterContextValue>({
  available: false,
  connected: false,
  address: null,
  busy: false,
  errorText: null,
  isAndroid: false,
  isWebView: false,
  connect: async () => null,
  disconnect: async () => {},
})

let didRegisterMwa = false
let walletRegistry: WalletRegistry | undefined
const registeredWallets = new Set<WalletStandardWallet>()
const registryListeners: Record<'register' | 'unregister', Array<(...wallets: WalletStandardWallet[]) => void>> = {
  register: [],
  unregister: [],
}

function getWallets(): WalletRegistry {
  if (walletRegistry) return walletRegistry

  walletRegistry = {
    get() {
      return [...registeredWallets]
    },
    on(event, listener) {
      registryListeners[event].push(listener)
      return () => {
        registryListeners[event] = registryListeners[event].filter((existing) => existing !== listener)
      }
    },
  }

  if (typeof window === 'undefined') return walletRegistry

  const api = Object.freeze({
    register(...wallets: WalletStandardWallet[]) {
      const fresh = wallets.filter((wallet) => !registeredWallets.has(wallet))
      if (fresh.length === 0) return () => {}
      fresh.forEach((wallet) => registeredWallets.add(wallet))
      registryListeners.register.forEach((listener) => {
        try {
          listener(...fresh)
        } catch (error) {
          console.error(error)
        }
      })
      return () => {
        fresh.forEach((wallet) => registeredWallets.delete(wallet))
        registryListeners.unregister.forEach((listener) => {
          try {
            listener(...fresh)
          } catch (error) {
            console.error(error)
          }
        })
      }
    },
  })

  window.addEventListener('wallet-standard:register-wallet', (event: Event) => {
    const callback = (event as CustomEvent<(api: typeof api) => void>).detail
    callback?.(api)
  })
  window.dispatchEvent(
    new CustomEvent('wallet-standard:app-ready', {
      detail: api,
    }),
  )

  return walletRegistry
}

function getSiteOrigin() {
  return typeof window !== 'undefined' ? window.location.origin : DEFAULT_SITE_ORIGIN
}

function isAndroidEnvironment(userAgent?: string) {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  return /Android/i.test(ua)
}

function isLikelyWebView(userAgent?: string) {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  return /; wv\)|\bwv\b|Version\/[\d.]+ Chrome\/[\d.]+ Mobile/i.test(ua)
}

function ensureMwaRegistered() {
  if (didRegisterMwa || typeof window === 'undefined') return
  getWallets()
  didRegisterMwa = true
  registerMwa({
    appIdentity: {
      name: 'SolanaOS Hub',
      uri: getSiteOrigin(),
      icon: 'favicon.ico',
    },
    authorizationCache: createDefaultAuthorizationCache(),
    chains: ['solana:mainnet', 'solana:devnet'],
    chainSelector: createDefaultChainSelector(),
    onWalletNotFound: createDefaultWalletNotFoundHandler(),
  })
}

function getMwaWallet() {
  return getWallets().get().find((wallet) => wallet.name === SolanaMobileWalletAdapterWalletName) ?? null
}

function featureConnect(wallet: WalletStandardWallet | null): ConnectFeature | null {
  return (wallet?.features?.[STANDARD_CONNECT] as ConnectFeature | undefined) ?? null
}

function featureDisconnect(wallet: WalletStandardWallet | null): DisconnectFeature | null {
  return (wallet?.features?.[STANDARD_DISCONNECT] as DisconnectFeature | undefined) ?? null
}

function featureEvents(wallet: WalletStandardWallet | null): EventsFeature | null {
  return (wallet?.features?.[STANDARD_EVENTS] as EventsFeature | undefined) ?? null
}

function describeWalletError(error: unknown, isAndroid: boolean, isWebView: boolean) {
  if (error instanceof Error && error.message.trim()) return error.message
  if (isWebView) {
    return 'Installed-wallet connect is blocked inside this in-app WebView. Open the hub in Android Chrome, or use the native Solana tab in the app for signing.'
  }
  if (!isAndroid) {
    return 'Mobile Wallet Adapter is only available on Android mobile browsers with a compatible wallet installed.'
  }
  return 'Installed-wallet connect failed.'
}

export function MobileWalletAdapterProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletStandardWallet | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const changeOffRef = useRef<(() => void) | null>(null)
  const isAndroid = isAndroidEnvironment()
  const isWebView = isLikelyWebView()

  const syncWallet = () => {
    const nextWallet = getMwaWallet()
    setWallet(nextWallet)
    setAddress(nextWallet?.accounts[0]?.address ?? null)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    ensureMwaRegistered()
    const registry = getWallets()
    syncWallet()
    const offRegister = registry.on('register', () => syncWallet())
    const offUnregister = registry.on('unregister', () => syncWallet())
    return () => {
      offRegister()
      offUnregister()
      changeOffRef.current?.()
      changeOffRef.current = null
    }
  }, [])

  useEffect(() => {
    changeOffRef.current?.()
    const events = featureEvents(wallet)
    if (!events?.on) return
    const off = events.on('change', () => syncWallet())
    changeOffRef.current = typeof off === 'function' ? off : null
    return () => {
      changeOffRef.current?.()
      changeOffRef.current = null
    }
  }, [wallet])

  const value = useMemo<MobileWalletAdapterContextValue>(() => {
    return {
      available: wallet != null,
      connected: address != null,
      address,
      busy,
      errorText,
      isAndroid,
      isWebView,
      connect: async () => {
        const targetWallet = wallet ?? getMwaWallet()
        if (!targetWallet) {
          const message = isWebView
            ? 'Installed-wallet connect is not available inside this WebView. Open the hub in Android Chrome or use the app’s native Solana tab.'
            : 'No compatible installed wallet is available in this browser.'
          setErrorText(message)
          return null
        }
        const connect = featureConnect(targetWallet)
        if (!connect?.connect) {
          setErrorText('Installed-wallet connect is unavailable for this wallet.')
          return null
        }
        setBusy(true)
        setErrorText(null)
        try {
          const result = await connect.connect()
          const nextAddress = result.accounts[0]?.address ?? targetWallet.accounts[0]?.address ?? null
          syncWallet()
          setAddress(nextAddress)
          return nextAddress
        } catch (error) {
          setErrorText(describeWalletError(error, isAndroid, isWebView))
          return null
        } finally {
          setBusy(false)
        }
      },
      disconnect: async () => {
        const targetWallet = wallet ?? getMwaWallet()
        const disconnect = featureDisconnect(targetWallet)
        if (!disconnect?.disconnect) {
          setAddress(null)
          return
        }
        setBusy(true)
        setErrorText(null)
        try {
          await disconnect.disconnect()
        } catch (error) {
          setErrorText(describeWalletError(error, isAndroid, isWebView))
        } finally {
          syncWallet()
          setBusy(false)
        }
      },
    }
  }, [address, busy, errorText, isAndroid, isWebView, wallet])

  return (
    <MobileWalletAdapterContext.Provider value={value}>
      {children}
    </MobileWalletAdapterContext.Provider>
  )
}

export function useInstalledWallet() {
  return useContext(MobileWalletAdapterContext)
}
