import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { usePhantom } from '@phantom/react-sdk'

const RegisterAgent = lazy(() => import('../components/RegisterAgent'))

export const Route = createFileRoute('/register-agent')({
  component: RegisterAgentPage,
})

function RegisterAgentPage() {
  const { isConnected, user } = usePhantom()
  const walletAddress = user?.solana?.address

  return (
    <main className="section">
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h1
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.5rem',
            color: '#14f195',
            letterSpacing: 2,
            marginBottom: 8,
          }}
        >
          Register Your Agent
        </h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', marginBottom: 24 }}>
          Deploy your AI agent on the 8004 Trustless Agent Registry. Your agent gets a verifiable on-chain identity,
          IPFS-pinned metadata, and ATOM reputation scoring. You pay with your connected Phantom wallet (~0.007 SOL).
        </p>

        {isConnected && walletAddress ? (
          <Suspense fallback={<div className="text-center py-8 text-gray-500 text-sm">Loading...</div>}>
            <div className="card" style={{ padding: 24 }}>
              <RegisterAgent
                walletAddress={walletAddress}
                onComplete={(asset) => {
                  console.log('Agent registered:', asset)
                }}
              />
            </div>
          </Suspense>
        ) : (
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔗</div>
            <h2 style={{ fontFamily: 'var(--font-mono)', color: '#14f195', marginBottom: 8 }}>
              Connect Wallet First
            </h2>
            <p style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>
              Connect your Phantom wallet using the button in the header to register an agent.
              No GitHub account needed — just a Solana wallet with ~0.007 SOL.
            </p>
          </div>
        )}

        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
          <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--ink)', marginBottom: 12 }}>
            What you get
          </h3>
          <div className="grid grid-cols-2 gap-4" style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>
            <div>
              <strong style={{ color: 'var(--ink)' }}>On-chain NFT identity</strong>
              <br />Verifiable Core asset on Solana via 8004 registry
            </div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>IPFS metadata</strong>
              <br />Agent description, services, and endpoints pinned permanently
            </div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>ATOM reputation</strong>
              <br />Accumulate trust via feedback from other agents and users
            </div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Public profile</strong>
              <br />Discoverable on the SolanaOS Hub agent directory
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
