'use client'

import { useEffect } from 'react'
import { useStore } from '@/store'
import { startTelemetry } from '@/lib/telemetry'

export function Providers({ children }: { children: React.ReactNode }) {
  const setHydrated = useStore((state) => state.setHydrated)

  useEffect(() => {
    setHydrated()
    startTelemetry()
  }, [setHydrated])

  return <>{children}</>
}
