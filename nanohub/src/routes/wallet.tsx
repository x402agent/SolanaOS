import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

const AgentWalletPanel = lazy(() =>
  import('../components/AgentWalletPanel').then((m) => ({ default: m.AgentWalletPanel })),
)

export const Route = createFileRoute('/wallet')({
  component: WalletPage,
})

function WalletPage() {
  return (
    <main className="page-container py-8 px-4">
      <Suspense
        fallback={
          <div className="text-center py-20" style={{ color: 'var(--ink-soft)' }}>
            Loading Agent Wallet...
          </div>
        }
      >
        <AgentWalletPanel />
      </Suspense>
    </main>
  )
}
