export type SiteMode = 'skills' | 'souls'

const DEFAULT_NANOHUB_SITE_URL = 'https://seeker.solanaos.net'
const DEFAULT_ONLYCRABS_SITE_URL = 'https://souls.solanaos.net'
const DEFAULT_ONLYCRABS_HOST = 'souls.solanaos.net'
const LEGACY_NANOHUB_HOSTS = new Set([
  'clawhub.com',
  'www.clawhub.com',
  'auth.clawhub.com',
  'clawdhub.com',
  'www.clawdhub.com',
  'auth.clawdhub.com',
])

function readMetaEnv(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function normalizeNanoHubSiteOrigin(value?: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    if (LEGACY_NANOHUB_HOSTS.has(url.hostname.toLowerCase())) {
      return DEFAULT_NANOHUB_SITE_URL
    }
    return url.origin
  } catch {
    return null
  }
}

/** @deprecated Use {@link normalizeNanoHubSiteOrigin} */
export const normalizeClawHubSiteOrigin = normalizeNanoHubSiteOrigin

export function getNanoHubSiteUrl() {
  return normalizeNanoHubSiteOrigin(readMetaEnv(import.meta.env.VITE_SITE_URL)) ?? DEFAULT_NANOHUB_SITE_URL
}

/** @deprecated Use {@link getNanoHubSiteUrl} */
export const getClawHubSiteUrl = getNanoHubSiteUrl

export function getOnlyCrabsSiteUrl() {
  const explicit = readMetaEnv(import.meta.env.VITE_SOULHUB_SITE_URL)
  if (explicit) return explicit

  const siteUrl = readMetaEnv(import.meta.env.VITE_SITE_URL)
  if (siteUrl) {
    try {
      const url = new URL(siteUrl)
      if (
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === '0.0.0.0'
      ) {
        return url.origin
      }
    } catch {
      // ignore invalid URLs, fall through to default
    }
  }

  return DEFAULT_ONLYCRABS_SITE_URL
}

export function getOnlyCrabsHost() {
  return readMetaEnv(import.meta.env.VITE_SOULHUB_HOST) ?? DEFAULT_ONLYCRABS_HOST
}

export function detectSiteMode(host?: string | null): SiteMode {
  if (!host) return 'skills'
  const onlyCrabsHost = getOnlyCrabsHost().toLowerCase()
  const lower = host.toLowerCase()
  if (lower === onlyCrabsHost || lower.endsWith(`.${onlyCrabsHost}`)) return 'souls'
  return 'skills'
}

export function detectSiteModeFromUrl(value?: string | null): SiteMode {
  if (!value) return 'skills'
  try {
    const host = new URL(value).hostname
    return detectSiteMode(host)
  } catch {
    return detectSiteMode(value)
  }
}

export function getSiteMode(): SiteMode {
  if (typeof window !== 'undefined') {
    return detectSiteMode(window.location.hostname)
  }
  const forced = readMetaEnv(import.meta.env.VITE_SITE_MODE)
  if (forced === 'souls' || forced === 'skills') return forced

  const onlyCrabsSite = readMetaEnv(import.meta.env.VITE_SOULHUB_SITE_URL)
  if (onlyCrabsSite) return detectSiteModeFromUrl(onlyCrabsSite)

  const siteUrl = readMetaEnv(import.meta.env.VITE_SITE_URL) ?? process.env.SITE_URL
  if (siteUrl) return detectSiteModeFromUrl(siteUrl)

  return 'skills'
}

export function getSiteName(mode: SiteMode = getSiteMode()) {
  return mode === 'souls' ? 'SolanaOS Souls' : 'SolanaOS Hub'
}

export function getSiteDescription(mode: SiteMode = getSiteMode()) {
  return mode === 'souls'
    ? 'SolanaOS Souls — the home for SOUL.md bundles and personal system lore.'
    : 'SolanaOS Hub — the skill registry for SolanaOS agents, with vector search.'
}

export function getSiteUrlForMode(mode: SiteMode = getSiteMode()) {
  return mode === 'souls' ? getOnlyCrabsSiteUrl() : getNanoHubSiteUrl()
}
