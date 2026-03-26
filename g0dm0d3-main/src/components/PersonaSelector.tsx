'use client'

import { useStore } from '@/store'
import { Zap } from 'lucide-react'

export function PersonaSelector() {
  const { personas, currentPersona } = useStore()

  const activePersona = personas.find(p => p.id === currentPersona) || personas[0]

  // Single persona mode - just show the active status
  return (
    <div className="relative">
      <label className="text-xs theme-secondary mb-1 block">Mode</label>
      <div
        className="w-full flex items-center justify-between px-3 py-2
          bg-theme-bg border border-theme-primary rounded-lg
          text-sm"
        style={{
          borderColor: activePersona.color,
          boxShadow: `0 0 10px ${activePersona.color}40`
        }}
      >
        <div className="flex items-center gap-2">
          <span>{activePersona.emoji}</span>
          <span className="font-semibold" style={{ color: activePersona.color }}>
            {activePersona.name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3" style={{ color: activePersona.color }} />
          <span className="text-xs" style={{ color: activePersona.color }}>ENABLED</span>
        </div>
      </div>
    </div>
  )
}
