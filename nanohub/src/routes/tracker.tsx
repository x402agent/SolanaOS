import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

const TrackerLayout = lazy(() => import('../components/tracker/TrackerLayout'))

export const Route = createFileRoute('/tracker')({
  component: TrackerPage,
})

function TrackerPage() {
  const { token } = Route.useSearch<{ token?: string }>()
  return (
    <div className="page-container py-8 px-4">
      <Suspense fallback={<div className="text-center py-20 text-gray-500">Loading Tracker…</div>}>
        <TrackerLayout initialTab="chart" initialToken={token} />
      </Suspense>
    </div>
  )
}
