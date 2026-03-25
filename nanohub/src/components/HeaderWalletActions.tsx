import { useAuthActions } from '@convex-dev/auth/react'
import { AddressType, useDisconnect, useModal, usePhantom } from '@phantom/react-sdk'
import { LogOut, RefreshCw, Wallet } from 'lucide-react'
import { useState } from 'react'
import { getUserFacingConvexError } from '../lib/convexError'
import { setAuthError, useAuthError } from '../lib/useAuthError'
import { useInstalledWallet } from './MobileWalletAdapterProvider'

function getCurrentRelativeUrl() {
  if (typeof window === 'undefined') return '/'
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export default function HeaderWalletActions({ isLoading }: { isLoading: boolean }) {
  const { signIn } = useAuthActions()
  const { open: openPhantom } = useModal()
  const { isConnected: phantomConnected, user: phantomUser } = usePhantom()
  const { disconnect: phantomDisconnect, isDisconnecting } = useDisconnect()
  const installedWallet = useInstalledWallet()
  const { error: authError, clear: clearAuthError } = useAuthError()
  const signInRedirectTo = getCurrentRelativeUrl()
  const installedWalletAddress = installedWallet.address
  const shouldOfferInstalledWallet =
    !installedWallet.connected &&
    !installedWallet.isWebView &&
    (installedWallet.available || installedWallet.isAndroid)

  const [walletMenuOpen, setWalletMenuOpen] = useState(false)

  const anyWalletConnected = phantomConnected || installedWallet.connected

  return (
    <>
      {authError ? (
        <div className="error" role="alert" style={{ fontSize: '0.85rem', marginRight: 8 }}>
          {authError}{' '}
          <button
            type="button"
            onClick={clearAuthError}
            aria-label="Dismiss"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              padding: '0 2px',
            }}
          >
            &times;
          </button>
        </div>
      ) : null}
      {!authError && installedWallet.errorText ? (
        <div className="error" role="alert" style={{ fontSize: '0.85rem', marginRight: 8 }}>
          {installedWallet.errorText}
        </div>
      ) : null}

      {/* Connected installed wallet with dropdown */}
      {installedWallet.connected && installedWalletAddress ? (
        <div style={{ position: 'relative' }}>
          <button
            className="btn"
            type="button"
            style={{ gap: 6 }}
            onClick={() => setWalletMenuOpen((v) => !v)}
          >
            <Wallet className="h-4 w-4" aria-hidden="true" />
            <span className="mono" style={{ fontSize: '0.82rem' }}>
              {`${installedWalletAddress.slice(0, 4)}…${installedWalletAddress.slice(-4)}`}
            </span>
            <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>▾</span>
          </button>
          {walletMenuOpen && (
            <WalletDropdown
              onClose={() => setWalletMenuOpen(false)}
              onDisconnect={() => {
                void installedWallet.disconnect()
                setWalletMenuOpen(false)
              }}
              onSwitch={() => {
                void installedWallet.disconnect().then(() => {
                  openPhantom()
                })
                setWalletMenuOpen(false)
              }}
              disconnecting={false}
            />
          )}
        </div>
      ) : shouldOfferInstalledWallet ? (
        <button
          className="btn"
          type="button"
          disabled={installedWallet.busy}
          onClick={() => {
            void installedWallet.connect()
          }}
        >
          <Wallet className="h-4 w-4" aria-hidden="true" />
          <span className="sign-in-label">
            {installedWallet.busy ? 'Connecting…' : 'Use Installed Wallet'}
          </span>
        </button>
      ) : null}

      {/* Phantom wallet with dropdown */}
      {phantomConnected ? (
        <div style={{ position: 'relative' }}>
          <button
            className="btn"
            type="button"
            style={{ gap: 6 }}
            onClick={() => setWalletMenuOpen((v) => !v)}
          >
            <Wallet className="h-4 w-4" aria-hidden="true" />
            <span className="mono" style={{ fontSize: '0.82rem' }}>
              {(() => {
                const addr = phantomUser?.addresses?.find(
                  (entry) => entry.addressType === AddressType.solana,
                )?.address
                return addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : 'Phantom'
              })()}
            </span>
            <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>▾</span>
          </button>
          {walletMenuOpen && (
            <WalletDropdown
              onClose={() => setWalletMenuOpen(false)}
              onDisconnect={() => {
                phantomDisconnect()
                setWalletMenuOpen(false)
              }}
              onSwitch={() => {
                phantomDisconnect()
                setWalletMenuOpen(false)
                requestAnimationFrame(() => openPhantom())
              }}
              disconnecting={isDisconnecting}
            />
          )}
        </div>
      ) : !anyWalletConnected ? (
        <button className="btn" type="button" onClick={openPhantom}>
          <Wallet className="h-4 w-4" aria-hidden="true" />
          <span className="sign-in-label">Wallet</span>
        </button>
      ) : null}

      <button
        className="btn btn-primary"
        type="button"
        disabled={isLoading}
        onClick={() => {
          clearAuthError()
          void signIn(
            'github',
            signInRedirectTo ? { redirectTo: signInRedirectTo } : undefined,
          ).catch((error) => {
            setAuthError(getUserFacingConvexError(error, 'Sign in failed. Please try again.'))
          })
        }}
      >
        <span className="sign-in-label">Sign in</span>
        <span className="sign-in-provider">with GitHub</span>
      </button>
    </>
  )
}

function WalletDropdown({
  onClose,
  onDisconnect,
  onSwitch,
  disconnecting,
}: {
  onClose: () => void
  onDisconnect: () => void
  onSwitch: () => void
  disconnecting: boolean
}) {
  return (
    <>
      {/* Backdrop to close menu */}
      <button
        type="button"
        aria-label="Close wallet menu"
        style={{ position: 'fixed', inset: 0, zIndex: 99, background: 'transparent', border: 'none', cursor: 'default' }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border-ui)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          zIndex: 100,
          minWidth: 170,
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={onSwitch}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '12px 16px',
            background: 'none',
            border: 'none',
            color: 'var(--ink)',
            fontSize: '0.9rem',
            cursor: 'pointer',
            minHeight: 44,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-soft)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
        >
          <RefreshCw size={14} />
          Switch Wallet
        </button>
        <div style={{ height: 1, background: 'var(--line)' }} />
        <button
          type="button"
          onClick={onDisconnect}
          disabled={disconnecting}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '12px 16px',
            background: 'none',
            border: 'none',
            color: 'var(--red, #ef4444)',
            fontSize: '0.9rem',
            cursor: disconnecting ? 'not-allowed' : 'pointer',
            opacity: disconnecting ? 0.5 : 1,
            minHeight: 44,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-soft)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
        >
          <LogOut size={14} />
          {disconnecting ? 'Disconnecting…' : 'Disconnect'}
        </button>
      </div>
    </>
  )
}
