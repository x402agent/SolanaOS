import { lazy, Suspense } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { isPublicPath } from '../lib/publicRoutes'

const AuthGatePrivate = lazy(() => import('./AuthGatePrivate'))

export function AuthGate({ children }: { children: React.ReactNode }) {
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  if (isPublicPath(pathname)) return <>{children}</>

  return (
    <Suspense fallback={null}>
      <AuthGatePrivate>{children}</AuthGatePrivate>
    </Suspense>
  )
}
