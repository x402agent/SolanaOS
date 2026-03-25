import { v } from 'convex/values'
import { internalMutation, query } from './functions'

export const upsertInternal = internalMutation({
  args: {
    assetAddress: v.string(),
    agentId: v.optional(v.id('nanosolanaAgents')),
    agentType: v.optional(v.string()),
    atomScore: v.optional(v.number()),
    trustTier: v.optional(v.string()),
    feedbackCount: v.optional(v.number()),
    positiveCount: v.optional(v.number()),
    negativeCount: v.optional(v.number()),
    scannerMetrics: v.optional(v.object({
      totalScans: v.number(),
      tokensClassified: v.number(),
      lastScanAt: v.number(),
      avgScanLatencyMs: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('nanosolanaAgentReputation')
      .withIndex('by_asset', (q) => q.eq('assetAddress', args.assetAddress))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        lastSyncedAt: now,
        updatedAt: now,
      })
      return existing._id
    }

    return ctx.db.insert('nanosolanaAgentReputation', {
      ...args,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const getByAsset = query({
  args: { assetAddress: v.string() },
  handler: async (ctx, { assetAddress }) => {
    return ctx.db
      .query('nanosolanaAgentReputation')
      .withIndex('by_asset', (q) => q.eq('assetAddress', assetAddress))
      .first()
  },
})

export const getByAgent = query({
  args: { agentId: v.id('nanosolanaAgents') },
  handler: async (ctx, { agentId }) => {
    return ctx.db
      .query('nanosolanaAgentReputation')
      .withIndex('by_agent', (q) => q.eq('agentId', agentId))
      .first()
  },
})

export const listTopReputed = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const results = await ctx.db
      .query('nanosolanaAgentReputation')
      .order('desc')
      .take(limit ?? 20)
    return results.sort((a, b) => (b.atomScore ?? 0) - (a.atomScore ?? 0))
  },
})
