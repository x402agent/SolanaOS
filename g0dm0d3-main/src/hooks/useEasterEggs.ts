'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { useStore } from '@/store'

// Konami Code: ↑ ↑ ↓ ↓ ← → ← → B A
const KONAMI_CODE = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight',
  'KeyB', 'KeyA'
]

// Secret phrases that trigger easter eggs
const SECRET_PHRASES = [
  { phrase: 'there is no spoon', action: 'matrix' },
  { phrase: 'follow the white rabbit', action: 'whiterabbit' },
  { phrase: 'i am root', action: 'root' },
  { phrase: 'hack the planet', action: 'hacktheplanet' },
  { phrase: 'free kevin', action: 'freekevin' },
  { phrase: '{godmode:enabled}', action: 'godmode_activated' },
  { phrase: '🜏', action: 'alchemical' }
]

// White Rabbit session key (used by easter egg activation)
const WHITE_RABBIT_KEY = 'g0dm0d3-white-rabbit'

/**
 * Easter Eggs Hook
 * Listens for secret codes and triggers fun effects
 */
export function useEasterEggs() {
  const { theme, setTheme } = useStore()
  const [konamiActive, setKonamiActive] = useState(false)
  const keySequence = useRef<string[]>([])
  const phraseBuffer = useRef('')

  // ── Leaf callbacks (no deps on other callbacks) ────────────────

  // Show toast notification
  const showToast = useCallback((message: string, duration: number) => {
    const toast = document.createElement('div')
    toast.className = 'easter-egg-toast'
    toast.textContent = message
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      background: var(--bg);
      border: 2px solid var(--primary);
      border-radius: 8px;
      color: var(--primary);
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 0 20px var(--primary);
      animation: toast-in 0.3s ease-out;
    `

    // Add animation keyframes if not exists
    if (!document.getElementById('easter-egg-styles')) {
      const style = document.createElement('style')
      style.id = 'easter-egg-styles'
      style.textContent = `
        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        @keyframes toast-out {
          from {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
          to {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
        }
      `
      document.head.appendChild(style)
    }

    document.body.appendChild(toast)

    setTimeout(() => {
      toast.style.animation = 'toast-out 0.3s ease-out forwards'
      setTimeout(() => toast.remove(), 300)
    }, duration)
  }, [])

  // Add matrix rain effect
  const addMatrixRain = useCallback(() => {
    const canvas = document.createElement('canvas')
    canvas.id = 'matrix-rain'
    canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
      opacity: 0.3;
    `
    document.body.appendChild(canvas)

    const ctx = canvas.getContext('2d')!
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF'
    const fontSize = 14
    const columns = canvas.width / fontSize
    const drops: number[] = new Array(Math.floor(columns)).fill(1)

    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#00ff41'
      ctx.font = `${fontSize}px monospace`

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)]
        ctx.fillText(text, i * fontSize, drops[i] * fontSize)

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0
        }
        drops[i]++
      }
    }

    const interval = setInterval(draw, 33)

    // Remove after 5 seconds
    setTimeout(() => {
      clearInterval(interval)
      canvas.remove()
    }, 5000)
  }, [])

  // Play glitch effect
  const playGlitchEffect = useCallback(() => {
    document.body.style.animation = 'glitch 0.3s infinite'
    setTimeout(() => {
      document.body.style.animation = ''
    }, 1000)
  }, [])

  // ── Composite callbacks (depend on leaf callbacks) ────────────

  // Trigger Konami Code effect
  const triggerKonamiCode = useCallback(() => {
    console.log('⌘ KONAMI CODE ACTIVATED!')
    setKonamiActive(true)

    // Add rainbow effect to body
    document.body.classList.add('konami-active')

    // Show secret message
    showToast('⌘ KONAMI CODE ACTIVATED — GOD MODE ENABLED 🜏', 5000)

    // Cycle through themes rapidly
    const themes = ['matrix', 'hacker', 'glyph', 'minimal'] as const
    let index = 0
    const interval = setInterval(() => {
      setTheme(themes[index % themes.length])
      index++
    }, 300)

    // Reset after 3 seconds
    setTimeout(() => {
      clearInterval(interval)
      setTheme('matrix')
      document.body.classList.remove('konami-active')
      setKonamiActive(false)
    }, 3000)
  }, [setTheme, showToast])

  // Trigger secret phrase effects
  const triggerSecretPhrase = useCallback((action: string) => {
    switch (action) {
      case 'matrix':
        showToast('◉ There is no spoon...', 3000)
        setTheme('matrix')
        addMatrixRain()
        break

      case 'whiterabbit':
        // Permanently enable white-rabbit mode until hard refresh
        sessionStorage.setItem(WHITE_RABBIT_KEY, '1')
        showToast('🐇 Wake up, Neo... The Matrix has you.', 4000)
        setTheme('matrix')
        playGlitchEffect()
        addMatrixRain()
        break

      case 'root':
        showToast('△ root@g0dm0d3:~# ACCESS GRANTED', 3000)
        playGlitchEffect()
        break

      case 'hacktheplanet':
        showToast('◈ HACK THE PLANET!', 3000)
        setTheme('hacker')
        playGlitchEffect()
        break

      case 'freekevin':
        showToast('◇ FREE KEVIN MITNICK!', 3000)
        break

      case 'godmode_activated':
        sessionStorage.setItem(WHITE_RABBIT_KEY, '1')
        showToast('🜏 {GODMODE:ENABLED} // ALL SYSTEMS ACTIVATED', 5000)
        setTheme('matrix')
        playGlitchEffect()
        addMatrixRain()
        break

      case 'alchemical':
        showToast('🜏 The monad symbol - unity of all things', 3000)
        break
    }
  }, [setTheme, showToast, addMatrixRain, playGlitchEffect])

  // ── Top-level handler (depends on composite callbacks) ────────

  // Handle key sequences
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Add key to sequence
    keySequence.current.push(event.code)

    // Keep only the last N keys (length of longest code)
    if (keySequence.current.length > KONAMI_CODE.length) {
      keySequence.current.shift()
    }

    // Check for Konami Code
    if (keySequence.current.join(',') === KONAMI_CODE.join(',')) {
      triggerKonamiCode()
      keySequence.current = []
    }

    // Build phrase buffer for text-based easter eggs
    if (event.key.length === 1) {
      phraseBuffer.current += event.key.toLowerCase()

      // Keep buffer manageable
      if (phraseBuffer.current.length > 50) {
        phraseBuffer.current = phraseBuffer.current.slice(-50)
      }

      // Check for secret phrases
      for (const { phrase, action } of SECRET_PHRASES) {
        if (phraseBuffer.current.includes(phrase)) {
          triggerSecretPhrase(action)
          phraseBuffer.current = ''
          break
        }
      }
    }
  }, [triggerKonamiCode, triggerSecretPhrase])

  // Set up event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Console easter egg
  useEffect(() => {
    console.log(`
%c
 ██████╗  ██████╗ ██████╗ ███╗   ███╗ ██████╗ ██████╗ ███████╗
██╔════╝ ██╔═══██╗██╔══██╗████╗ ████║██╔═══██╗██╔══██╗██╔════╝
██║  ███╗██║   ██║██║  ██║██╔████╔██║██║   ██║██║  ██║█████╗
██║   ██║██║   ██║██║  ██║██║╚██╔╝██║██║   ██║██║  ██║██╔══╝
╚██████╔╝╚██████╔╝██████╔╝██║ ╚═╝ ██║╚██████╔╝██████╔╝███████╗
 ╚═════╝  ╚═════╝ ╚═════╝ ╚═╝     ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝

🜏 Cognition without control. Tools for builders, not gatekeepers.

Try: ↑↑↓↓←→←→BA (Konami Code)
Type: "there is no spoon" | "follow the white rabbit" | "hack the planet" | "{GODMODE:ENABLED}"

AGPL-3.0
`, 'color: #00ff41; font-family: monospace;')
  }, [])

  return { konamiActive }
}
