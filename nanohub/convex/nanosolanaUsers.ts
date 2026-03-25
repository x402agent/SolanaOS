import { v } from 'convex/values'
import { internalMutation, internalQuery, query } from './functions'

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
const PAIRING_TTL_MS = 1000 * 60 * 10

function normalizeDisplayName(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  return trimmed.replace(/\s+/g, ' ').slice(0, 64)
}

function createSessionToken() {
  const token =
    globalThis.crypto?.randomUUID?.().replace(/-/g, '') ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  return token
}

function createRandomToken() {
  return createSessionToken()
}

export const getWalletUserBySessionTokenInternal = internalQuery({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const sessionToken = args.sessionToken.trim()
    if (!sessionToken) return null
    const user = await ctx.db
      .query('nanosolanaUsers')
      .withIndex('by_session_token', (q) => q.eq('activeSessionToken', sessionToken))
      .unique()

    if (!user) return null
    if (!user.activeSessionExpiresAt || user.activeSessionExpiresAt <= Date.now()) {
      return null
    }

    return {
      walletAddress: user.walletAddress,
      displayName: user.displayName ?? null,
      galleryUserId: user.galleryUserId ?? null,
      sessionExpiresAt: user.activeSessionExpiresAt,
    }
  },
})

export const getWalletUserByWalletInternal = internalQuery({
  args: {
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const walletAddress = args.walletAddress.trim()
    if (!walletAddress) return null
    return await ctx.db
      .query('nanosolanaUsers')
      .withIndex('by_wallet', (q) => q.eq('walletAddress', walletAddress))
      .unique()
  },
})

export const upsertWalletUserInternal = internalMutation({
  args: {
    walletAddress: v.string(),
    displayName: v.optional(v.string()),
    appVersion: v.optional(v.string()),
    signedAtMs: v.number(),
    nonce: v.string(),
    signatureBase58: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const sessionToken = createSessionToken()
    const sessionExpiresAt = now + SESSION_TTL_MS
    const walletAddress = args.walletAddress.trim()
    const displayName = normalizeDisplayName(args.displayName)
    const existing = await ctx.db
      .query('nanosolanaUsers')
      .withIndex('by_wallet', (q) => q.eq('walletAddress', walletAddress))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: displayName || existing.displayName,
        appVersion: args.appVersion?.trim() || existing.appVersion,
        lastSeenAt: now,
        lastAuthAt: args.signedAtMs,
        lastNonce: args.nonce.trim(),
        lastSignatureBase58: args.signatureBase58.trim(),
        activeSessionToken: sessionToken,
        activeSessionIssuedAt: now,
        activeSessionExpiresAt: sessionExpiresAt,
        updatedAt: now,
      })
      return {
        walletAddress,
        displayName: displayName || existing.displayName || null,
        appVersion: args.appVersion?.trim() || existing.appVersion || null,
        firstSeenAt: existing.firstSeenAt,
        lastSeenAt: now,
        sessionToken,
        sessionExpiresAt,
      }
    }

    await ctx.db.insert('nanosolanaUsers', {
      walletAddress,
      displayName: displayName || undefined,
      appVersion: args.appVersion?.trim() || undefined,
      firstSeenAt: now,
      lastSeenAt: now,
      lastAuthAt: args.signedAtMs,
      lastNonce: args.nonce.trim(),
      lastSignatureBase58: args.signatureBase58.trim(),
      activeSessionToken: sessionToken,
      activeSessionIssuedAt: now,
      activeSessionExpiresAt: sessionExpiresAt,
      createdAt: now,
      updatedAt: now,
    })

    return {
      walletAddress,
      displayName: displayName || null,
      appVersion: args.appVersion?.trim() || null,
      firstSeenAt: now,
      lastSeenAt: now,
      sessionToken,
      sessionExpiresAt,
    }
  },
})

export const ensureWalletUserForSyncInternal = internalMutation({
  args: {
    walletAddress: v.string(),
    displayName: v.optional(v.string()),
    appVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const walletAddress = args.walletAddress.trim()
    const displayName = normalizeDisplayName(args.displayName)
    const appVersion = args.appVersion?.trim() || undefined
    const existing = await ctx.db
      .query('nanosolanaUsers')
      .withIndex('by_wallet', (q) => q.eq('walletAddress', walletAddress))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: displayName || existing.displayName,
        appVersion: appVersion || existing.appVersion,
        lastSeenAt: now,
        updatedAt: now,
      })
      return {
        walletAddress,
        displayName: displayName || existing.displayName || null,
        appVersion: appVersion || existing.appVersion || null,
        galleryUserId: existing.galleryUserId ?? null,
      }
    }

    const nonce = `registry-sync:${now}`
    const userId = await ctx.db.insert('nanosolanaUsers', {
      walletAddress,
      displayName: displayName || undefined,
      appVersion,
      firstSeenAt: now,
      lastSeenAt: now,
      lastAuthAt: now,
      lastNonce: nonce,
      lastSignatureBase58: undefined,
      createdAt: now,
      updatedAt: now,
    })

    return {
      walletAddress,
      displayName: displayName || null,
      appVersion: appVersion || null,
      galleryUserId: null,
      userId,
    }
  },
})

export const linkWalletUserToGalleryUserInternal = internalMutation({
  args: {
    walletAddress: v.string(),
    galleryUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const walletAddress = args.walletAddress.trim()
    if (!walletAddress) throw new Error('walletAddress is required')

    const existing = await ctx.db
      .query('nanosolanaUsers')
      .withIndex('by_wallet', (q) => q.eq('walletAddress', walletAddress))
      .unique()

    if (!existing) {
      throw new Error('wallet user not found')
    }

    await ctx.db.patch(existing._id, {
      galleryUserId: args.galleryUserId,
      updatedAt: Date.now(),
    })

    return {
      walletAddress,
      galleryUserId: args.galleryUserId,
    }
  },
})

export const upsertTelegramConfigInternal = internalMutation({
  args: {
    walletAddress: v.string(),
    telegramBotToken: v.string(),
    telegramUserId: v.string(),
    telegramBotUsername: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const walletAddress = args.walletAddress.trim()
    const existing = await ctx.db
      .query('nanosolanaUsers')
      .withIndex('by_wallet', (q) => q.eq('walletAddress', walletAddress))
      .unique()

    if (!existing) {
      throw new Error('wallet user not found')
    }

    const now = Date.now()
    await ctx.db.patch(existing._id, {
      telegramBotToken: args.telegramBotToken.trim(),
      telegramUserId: args.telegramUserId.trim(),
      telegramBotUsername: args.telegramBotUsername?.trim() || undefined,
      telegramConfiguredAt: now,
      telegramVerifiedAt: args.verifiedAt ?? now,
      updatedAt: now,
    })

    return {
      walletAddress,
      telegramUserId: args.telegramUserId.trim(),
      telegramBotUsername: args.telegramBotUsername?.trim() || null,
      telegramConfiguredAt: now,
      telegramVerifiedAt: args.verifiedAt ?? now,
    }
  },
})

export const createPairingSessionInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const pairingToken = createRandomToken()
    const pairingSecret = createRandomToken()
    const expiresAt = now + PAIRING_TTL_MS
    await ctx.db.insert('nanosolanaPairingSessions', {
      pairingToken,
      pairingSecret,
      status: 'pending',
      createdAt: now,
      expiresAt,
      updatedAt: now,
    })
    return {
      pairingToken,
      pairingSecret,
      expiresAt,
    }
  },
})

export const getPairingSessionStatusInternal = internalQuery({
  args: {
    pairingToken: v.string(),
    pairingSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const pairingToken = args.pairingToken.trim()
    const pairingSecret = args.pairingSecret.trim()
    if (!pairingToken || !pairingSecret) return null
    const session = await ctx.db
      .query('nanosolanaPairingSessions')
      .withIndex('by_pairing_token', (q) => q.eq('pairingToken', pairingToken))
      .unique()
    if (!session || session.pairingSecret !== pairingSecret) return null
    const now = Date.now()
    const status =
      session.status === 'pending' && session.expiresAt <= now ? 'expired' : session.status
    return {
      status,
      walletAddress: session.walletAddress ?? null,
      displayName: session.displayName ?? null,
      appVersion: session.appVersion ?? null,
      sessionToken: session.sessionToken ?? null,
      sessionExpiresAt: session.sessionExpiresAt ?? null,
      expiresAt: session.expiresAt,
      claimedAt: session.claimedAt ?? null,
    }
  },
})

export const claimPairingSessionInternal = internalMutation({
  args: {
    pairingToken: v.string(),
    walletAddress: v.string(),
    displayName: v.optional(v.string()),
    appVersion: v.optional(v.string()),
    sessionToken: v.string(),
    sessionExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const pairingToken = args.pairingToken.trim()
    const session = await ctx.db
      .query('nanosolanaPairingSessions')
      .withIndex('by_pairing_token', (q) => q.eq('pairingToken', pairingToken))
      .unique()
    if (!session) {
      return { ok: false as const, error: 'pairing token not found' }
    }
    if (session.status === 'claimed') {
      return { ok: false as const, error: 'pairing token already claimed' }
    }
    if (session.expiresAt <= now) {
      await ctx.db.patch(session._id, {
        status: 'expired',
        updatedAt: now,
      })
      return { ok: false as const, error: 'pairing token expired' }
    }

    await ctx.db.patch(session._id, {
      status: 'claimed',
      walletAddress: args.walletAddress.trim(),
      displayName: normalizeDisplayName(args.displayName),
      appVersion: args.appVersion?.trim() || undefined,
      sessionToken: args.sessionToken.trim(),
      sessionExpiresAt: args.sessionExpiresAt,
      claimedAt: now,
      updatedAt: now,
    })
    return { ok: true as const }
  },
})

export const listRecentPublic = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.trunc(args.limit ?? 8), 24))
    const rows = await ctx.db
      .query('nanosolanaUsers')
      .withIndex('by_last_seen')
      .order('desc')
      .take(limit)

    const now = Date.now()
    return rows.map((row) => ({
      walletAddress: row.walletAddress,
      displayName: row.displayName ?? null,
      appVersion: row.appVersion ?? null,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
      lastAuthAt: row.lastAuthAt,
      sessionExpiresAt: row.activeSessionExpiresAt ?? null,
      online: Boolean(row.activeSessionExpiresAt && row.activeSessionExpiresAt > now),
    }))
  },
})
