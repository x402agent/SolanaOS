export type NanosolanaWalletSession = {
  walletAddress: string
  displayName?: string | null
  sessionToken: string
  sessionExpiresAt: number
}

export type NanosolanaPairingEnvelope = {
  pairingToken: string
  pairingSecret: string
  deepLinkUrl: string
  expiresAt: number
}

export type NanosolanaPairingSnapshot = {
  status: 'pending' | 'claimed' | 'expired'
  walletAddress: string | null
  displayName: string | null
  appVersion: string | null
  sessionToken: string | null
  sessionExpiresAt: number | null
  expiresAt: number
  claimedAt: number | null
}

export type NanosolanaWalletAgent = {
  _id: string
  ownerWalletAddress: string
  registryMode: '8004' | 'metaplex' | 'dual'
  name: string
  symbol?: string | null
  description: string
  metadataUri?: string | null
  ownerVerified: boolean
  cluster: string
  status: 'pending' | 'ready' | 'failed'
  errorMessage?: string | null
  metaplexAssetAddress?: string | null
  metaplexIdentityPda?: string | null
  metaplexExecutiveProfilePda?: string | null
  metaplexDelegateRecordPda?: string | null
  metaplexRegistered: boolean
  services: Array<{ type: string; value: string }>
  explorerAssetUrl: string | null
  explorerRegistrationUrl: string | null
  explorerTransferUrl: string | null
  explorerMetaplexAssetUrl?: string | null
  explorerMetaplexRegistrationUrl?: string | null
  explorerMetaplexDelegateUrl?: string | null
  explorerMetaplexTransferUrl?: string | null
}

export type NanosolanaWalletTelegramConfig = {
  walletAddress: string
  telegramConfigured: boolean
  telegramUserId?: string | null
  telegramBotUsername?: string | null
  maskedBotToken?: string | null
  configuredAt?: number | null
  verifiedAt?: number | null
  daemonEnvBlock?: string | null
}

const storageKey = 'nanosolana.walletSession'

function convexSiteUrl() {
  const value = import.meta.env.VITE_CONVEX_SITE_URL?.trim()
  if (!value) throw new Error('VITE_CONVEX_SITE_URL is not configured.')
  return value.replace(/\/$/, '')
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${convexSiteUrl()}${path}`, init)
  const payloadText = await response.text()
  let payload: unknown = null
  try {
    payload = JSON.parse(payloadText)
  } catch {
    payload = null
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : payloadText || `Request failed with HTTP ${response.status}`
    throw new Error(message)
  }
  return payload as T
}

export function loadWalletSession(): NanosolanaWalletSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<NanosolanaWalletSession>
    if (
      typeof parsed.walletAddress !== 'string' ||
      typeof parsed.sessionToken !== 'string' ||
      typeof parsed.sessionExpiresAt !== 'number'
    ) {
      return null
    }
    return {
      walletAddress: parsed.walletAddress,
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : null,
      sessionToken: parsed.sessionToken,
      sessionExpiresAt: parsed.sessionExpiresAt,
    }
  } catch {
    return null
  }
}

export function persistWalletSession(session: NanosolanaWalletSession | null) {
  if (typeof window === 'undefined') return
  if (!session) {
    window.localStorage.removeItem(storageKey)
    return
  }
  window.localStorage.setItem(storageKey, JSON.stringify(session))
}

export async function createPairingSession() {
  return requestJson<{
    status: string
    pairingToken: string
    pairingSecret: string
    deepLinkUrl: string
    expiresAt: number
  }>('/nanosolana/pairing/create', {
    method: 'POST',
  })
}

export async function fetchPairingSessionStatus(pairingToken: string, pairingSecret: string) {
  const query = new URLSearchParams({
    token: pairingToken,
    secret: pairingSecret,
  })
  return requestJson<{ status: string; pairing: NanosolanaPairingSnapshot }>(
    `/nanosolana/pairing/status?${query.toString()}`,
  )
}

export async function fetchWalletSession(sessionToken: string) {
  return requestJson<{
    status: string
    user: {
      walletAddress: string
      displayName?: string | null
      sessionToken: string
      sessionExpiresAt: number
    }
  }>('/nanosolana/users/session', {
    headers: {
      Authorization: `Bearer ${sessionToken.trim()}`,
    },
  })
}

export async function listWalletAgents(sessionToken: string) {
  return requestJson<{ status: string; agents: NanosolanaWalletAgent[] }>('/nanosolana/agents/mine', {
    headers: {
      Authorization: `Bearer ${sessionToken.trim()}`,
    },
  })
}

export async function fetchWalletTelegramConfig(sessionToken: string) {
  return requestJson<{ status: string; telegram: NanosolanaWalletTelegramConfig }>('/nanosolana/users/telegram', {
    headers: {
      Authorization: `Bearer ${sessionToken.trim()}`,
    },
  })
}

export async function saveWalletTelegramConfig(
  sessionToken: string,
  payload: {
    telegramBotToken: string
    telegramUserId: string
  },
) {
  return requestJson<{ status: string; telegram: NanosolanaWalletTelegramConfig }>('/nanosolana/users/telegram', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export async function createWalletAgent(
  sessionToken: string,
  payload: Record<string, unknown>,
) {
  return requestJson<{
    status: string
    registrationId: string
    assetAddress: string
    metadataUri: string
    explorerAssetUrl: string
  }>('/nanosolana/agents/create', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}
