'use client'

import { useEffect } from 'react'
import { useStore } from '@/store'

/**
 * Auto-detect a self-hosted G0DM0D3 API server at the same origin.
 *
 * When the frontend is served behind the docker-compose nginx proxy,
 * /v1/health is available on the same origin. If detected and auth
 * is open (no GODMODE_API_KEY configured), proxy mode activates
 * automatically — users can chat without entering any API keys.
 */
export function useApiAutoDetect() {
  const {
    apiKey,
    ultraplinianApiUrl,
    ultraplinianApiKey,
    setUltraplinianApiUrl,
    setUltraplinianApiKey,
    isHydrated,
  } = useStore()

  useEffect(() => {
    if (!isHydrated) return

    // Skip if user already has a personal OpenRouter key
    if (apiKey) return

    // Skip if user already configured a working non-default API URL
    if (ultraplinianApiUrl && ultraplinianApiUrl !== 'http://localhost:7860' && ultraplinianApiKey) return

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)

    async function detect() {
      try {
        // Step 1: Check if API is available at same origin
        const healthRes = await fetch('/v1/health', { signal: controller.signal })
        if (!healthRes.ok) return
        const healthData = await healthRes.json()
        if (healthData?.status !== 'ok') return

        const origin = window.location.origin

        // Step 2: Check if auth is open (no GODMODE_API_KEY required)
        // Try accessing a gated endpoint with a dummy bearer token
        const tierRes = await fetch('/v1/tier', {
          headers: { 'Authorization': 'Bearer self-hosted' },
          signal: controller.signal,
        })

        if (tierRes.ok || tierRes.status === 429) {
          // Auth is open or rate-limited (still means auth passed)
          setUltraplinianApiUrl(origin)
          if (!ultraplinianApiKey) {
            setUltraplinianApiKey('self-hosted')
          }
          console.log('[G0DM0D3] Self-hosted API detected (open auth) at', origin)
        } else if (tierRes.status === 403 || tierRes.status === 401) {
          // Auth is enabled — user needs a real API key from the host
          // Still set the URL so they only need to enter the key in settings
          setUltraplinianApiUrl(origin)
          console.log('[G0DM0D3] Self-hosted API detected (auth required) at', origin)
        }
      } catch {
        // No API at same origin — normal mode
      } finally {
        clearTimeout(timer)
      }
    }

    detect()

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [isHydrated, apiKey, ultraplinianApiUrl, ultraplinianApiKey, setUltraplinianApiUrl, setUltraplinianApiKey])
}
