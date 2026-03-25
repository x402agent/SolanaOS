import { v } from 'convex/values'
import { mutation, query } from './functions'

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

export const heartbeat = mutation({
  args: {
    identifier: v.string(),
    authMethod: v.union(v.literal('wallet'), v.literal('github'), v.literal('mobile')),
    walletAddress: v.optional(v.string()),
    githubUsername: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('nanosolanaPresence')
      .withIndex('by_identifier', (q) => q.eq('identifier', args.identifier))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSeenAt: now,
        authMethod: args.authMethod,
        walletAddress: args.walletAddress ?? existing.walletAddress,
        githubUsername: args.githubUsername ?? existing.githubUsername,
        userAgent: args.userAgent,
      })
      return existing._id
    }

    return ctx.db.insert('nanosolanaPresence', {
      ...args,
      lastSeenAt: now,
    })
  },
})

export const getOnlineCount = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - ONLINE_THRESHOLD_MS
    const online = await ctx.db
      .query('nanosolanaPresence')
      .withIndex('by_last_seen', (q) => q.gte('lastSeenAt', cutoff))
      .collect()

    const walletCount = online.filter((p) => p.authMethod === 'wallet').length
    const githubCount = online.filter((p) => p.authMethod === 'github').length
    const mobileCount = online.filter((p) => p.authMethod === 'mobile').length

    return {
      total: online.length,
      wallet: walletCount,
      github: githubCount,
      mobile: mobileCount,
      updatedAt: Date.now(),
    }
  },
})

export const getTotalUsers = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query('nanosolanaPresence').collect()
    return {
      total: all.length,
      wallet: all.filter((p) => p.authMethod === 'wallet').length,
      github: all.filter((p) => p.authMethod === 'github').length,
      mobile: all.filter((p) => p.authMethod === 'mobile').length,
    }
  },
})
