/**
 * Internal mutations for self-service agent registration.
 *
 * Separated from nanosolanaAgentsSelfRegister.ts because that file uses
 * 'use node' (for 8004-solana SDK), and Convex only allows actions in
 * Node.js modules — not mutations or queries.
 */
import { v } from 'convex/values'
import { internalMutation } from './_generated/server'

export const createPending = internalMutation({
  args: {
    walletAddress: v.string(),
    name: v.string(),
    description: v.string(),
    imageUri: v.optional(v.string()),
    metadataCid: v.string(),
    metadataUri: v.string(),
    cluster: v.string(),
    atomEnabled: v.boolean(),
    services: v.array(v.object({ type: v.string(), value: v.string() })),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    const user = await ctx.db
      .query('nanosolanaUsers')
      .filter((q) => q.eq(q.field('walletAddress'), args.walletAddress))
      .first()

    const placeholderUserId = user?._id

    return ctx.db.insert('nanosolanaAgents', {
      userId: placeholderUserId ?? ('' as any),
      ownerWalletAddress: args.walletAddress,
      registryMode: '8004',
      name: args.name,
      description: args.description,
      imageUri: args.imageUri,
      metadataCid: args.metadataCid,
      metadataUri: args.metadataUri,
      services: args.services,
      skills: [],
      domains: [],
      socials: args.website ? { website: args.website } : undefined,
      atomEnabled: args.atomEnabled,
      cluster: args.cluster,
      ownerVerified: false,
      metaplexRegistered: false,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const markConfirmed = internalMutation({
  args: {
    pendingId: v.id('nanosolanaAgents'),
    txSignature: v.string(),
    assetAddress: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pendingId, {
      assetAddress: args.assetAddress,
      assetTxSignature: args.txSignature,
      ownerVerified: true,
      status: 'ready',
      updatedAt: Date.now(),
    })
  },
})
