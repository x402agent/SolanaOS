import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { lazy, Suspense, useCallback } from 'react'

const Memescope = lazy(() => import('../components/tracker/Memescope'))

export const Route = createFileRoute('/memescope')({
  component: MemescopePage,
})

function MemescopePage() {
  const navigate = useNavigate()
  const handleSelect = useCallback(
    (addr: string) => navigate({ to: '/tracker', search: { token: addr } }),
    [navigate],
  )

  return (
    <div className="page-container py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Memescope</h1>
        <p className="text-sm text-gray-500 mt-1">Track new tokens and discover the next big memecoin opportunity.</p>
      </div>
      <Suspense fallback={<div className="text-center py-20 text-gray-500">Loading…</div>}>
        <Memescope onSelectToken={handleSelect} />
      </Suspense>
    </div>
  )
}
