import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

const RugCheck = lazy(() => import('../components/tracker/RugCheck'))

export const Route = createFileRoute('/rugcheck')({
  component: RugCheckPage,
})

function RugCheckPage() {
  return (
    <div className="page-container py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Rug Check</h1>
        <p className="text-sm text-gray-500 mt-1">Perform a rugcheck on any Solana token to verify its authenticity and avoid scams.</p>
      </div>
      <Suspense fallback={<div className="text-center py-20 text-gray-500">Loading…</div>}>
        <RugCheck />
      </Suspense>
    </div>
  )
}
