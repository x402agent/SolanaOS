import { v } from 'convex/values'
import { internalMutation, internalQuery, mutation, query } from './functions'

// ── IPFS Hub Functions ──────────────────────────────────────────────
// Track Pinata Private IPFS files per Solana wallet + GitHub account.
// Cross-referenced with Convex users for the web hub, Seeker mobile,
// Android app, and Tailscale mesh nodes.

// ── Mutations ───────────────────────────────────────────────────────

export const trackUpload = mutation({
  args: {
    pinataId: v.string(),
    cid: v.string(),
    name: v.string(),
    size: v.number(),
    mimeType: v.optional(v.string()),
    network: v.union(v.literal('public'), v.literal('private')),
    groupId: v.optional(v.string()),
    solanaWallet: v.optional(v.string()),
    githubUser: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    meshNodeId: v.optional(v.string()),
    keyvalues: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    const now = Date.now()

    // Resolve ownerUserId from auth or wallet lookup
    let ownerUserId = undefined
    if (identity) {
      const user = await ctx.db
        .query('users')
        .withIndex('email', (q) => q.eq('email', identity.email ?? ''))
        .first()
      if (user) ownerUserId = user._id
    }

    const fileId = await ctx.db.insert('ipfsFiles', {
      pinataId: args.pinataId,
      cid: args.cid,
      name: args.name,
      size: args.size,
      mimeType: args.mimeType,
      network: args.network,
      groupId: args.groupId,
      ownerUserId,
      solanaWallet: args.solanaWallet,
      githubUser: args.githubUser,
      deviceId: args.deviceId,
      meshNodeId: args.meshNodeId,
      keyvalues: args.keyvalues,
      syncStatus: 'local',
      createdAt: now,
      updatedAt: now,
    })

    return { fileId, cid: args.cid }
  },
})

export const trackUploadInternal = internalMutation({
  args: {
    pinataId: v.string(),
    cid: v.string(),
    name: v.string(),
    size: v.number(),
    mimeType: v.optional(v.string()),
    network: v.union(v.literal('public'), v.literal('private')),
    groupId: v.optional(v.string()),
    solanaWallet: v.optional(v.string()),
    githubUser: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    meshNodeId: v.optional(v.string()),
    keyvalues: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Try to resolve owner from wallet
    let ownerUserId = undefined
    if (args.solanaWallet) {
      const walletUser = await ctx.db
        .query('nanosolanaUsers')
        .withIndex('by_wallet', (q) => q.eq('walletAddress', args.solanaWallet!))
        .first()
      if (walletUser?.galleryUserId) {
        ownerUserId = walletUser.galleryUserId
      }
    }

    return await ctx.db.insert('ipfsFiles', {
      pinataId: args.pinataId,
      cid: args.cid,
      name: args.name,
      size: args.size,
      mimeType: args.mimeType,
      network: args.network,
      groupId: args.groupId,
      ownerUserId,
      solanaWallet: args.solanaWallet,
      githubUser: args.githubUser,
      deviceId: args.deviceId,
      meshNodeId: args.meshNodeId,
      keyvalues: args.keyvalues,
      syncStatus: 'local',
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const trackGroup = internalMutation({
  args: {
    pinataGroupId: v.string(),
    name: v.string(),
    network: v.union(v.literal('public'), v.literal('private')),
    solanaWallet: v.optional(v.string()),
    githubUser: v.optional(v.string()),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Check if group already tracked
    const existing = await ctx.db
      .query('ipfsGroups')
      .withIndex('by_pinata_group', (q) =>
        q.eq('pinataGroupId', args.pinataGroupId),
      )
      .first()
    if (existing) return existing._id

    return await ctx.db.insert('ipfsGroups', {
      pinataGroupId: args.pinataGroupId,
      name: args.name,
      network: args.network,
      solanaWallet: args.solanaWallet,
      githubUser: args.githubUser,
      deviceId: args.deviceId,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const logAccess = mutation({
  args: {
    fileId: v.id('ipfsFiles'),
    cid: v.string(),
    accessUrl: v.optional(v.string()),
    solanaWallet: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    let accessedBy = undefined
    if (identity) {
      const user = await ctx.db
        .query('users')
        .withIndex('email', (q) => q.eq('email', identity.email ?? ''))
        .first()
      if (user) accessedBy = user._id
    }

    return await ctx.db.insert('ipfsAccessLog', {
      fileId: args.fileId,
      cid: args.cid,
      accessUrl: args.accessUrl,
      accessedBy,
      solanaWallet: args.solanaWallet,
      deviceId: args.deviceId,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    })
  },
})

export const updateSyncStatus = internalMutation({
  args: {
    fileId: v.id('ipfsFiles'),
    syncStatus: v.union(
      v.literal('local'),
      v.literal('syncing'),
      v.literal('synced'),
    ),
    syncedToNodes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.fileId, {
      syncStatus: args.syncStatus,
      syncedToNodes: args.syncedToNodes,
      updatedAt: Date.now(),
    })
  },
})

export const deleteFile = mutation({
  args: {
    fileId: v.id('ipfsFiles'),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.fileId)
    if (!file) throw new Error('File not found')
    await ctx.db.delete(args.fileId)
    return { pinataId: file.pinataId, cid: file.cid }
  },
})

// ── Queries ─────────────────────────────────────────────────────────

export const listByWallet = query({
  args: {
    solanaWallet: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50
    return await ctx.db
      .query('ipfsFiles')
      .withIndex('by_wallet', (q) => q.eq('solanaWallet', args.solanaWallet))
      .order('desc')
      .take(limit)
  },
})

export const listByGithubUser = query({
  args: {
    githubUser: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50
    return await ctx.db
      .query('ipfsFiles')
      .withIndex('by_github', (q) => q.eq('githubUser', args.githubUser))
      .order('desc')
      .take(limit)
  },
})

export const listByOwner = query({
  args: {
    ownerUserId: v.id('users'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50
    return await ctx.db
      .query('ipfsFiles')
      .withIndex('by_owner', (q) => q.eq('ownerUserId', args.ownerUserId))
      .order('desc')
      .take(limit)
  },
})

export const listByDevice = query({
  args: {
    deviceId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50
    return await ctx.db
      .query('ipfsFiles')
      .withIndex('by_device', (q) => q.eq('deviceId', args.deviceId))
      .order('desc')
      .take(limit)
  },
})

export const getByCid = query({
  args: { cid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('ipfsFiles')
      .withIndex('by_cid', (q) => q.eq('cid', args.cid))
      .first()
  },
})

export const getGroupsByWallet = query({
  args: { solanaWallet: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('ipfsGroups')
      .withIndex('by_wallet', (q) =>
        q.eq('solanaWallet', args.solanaWallet),
      )
      .collect()
  },
})

export const getAccessLog = query({
  args: {
    fileId: v.id('ipfsFiles'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20
    return await ctx.db
      .query('ipfsAccessLog')
      .withIndex('by_file', (q) => q.eq('fileId', args.fileId))
      .order('desc')
      .take(limit)
  },
})

// ── Internal Queries ────────────────────────────────────────────────

export const getFileByPinataIdInternal = internalQuery({
  args: { pinataId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('ipfsFiles')
      .withIndex('by_pinata_id', (q) => q.eq('pinataId', args.pinataId))
      .first()
  },
})

export const getWalletStorageStats = query({
  args: { solanaWallet: v.string() },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query('ipfsFiles')
      .withIndex('by_wallet', (q) => q.eq('solanaWallet', args.solanaWallet))
      .collect()

    const totalSize = files.reduce((sum, f) => sum + f.size, 0)
    const privateCount = files.filter((f) => f.network === 'private').length
    const publicCount = files.filter((f) => f.network === 'public').length

    return {
      totalFiles: files.length,
      totalSize,
      privateCount,
      publicCount,
      syncedCount: files.filter((f) => f.syncStatus === 'synced').length,
    }
  },
})
