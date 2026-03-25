import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { internalMutation, internalQuery, query } from './functions'
import { requireUser } from './lib/access'

function toExplorerUrl(kind: 'address' | 'tx', value: string, cluster: string) {
  const url = new URL(`https://explorer.solana.com/${kind}/${value}`)
  if (cluster !== 'mainnet-beta') {
    url.searchParams.set('cluster', cluster)
  }
  return url.toString()
}

export const createDraftInternal = internalMutation({
  args: {
    userId: v.id('users'),
    ownerWalletAddress: v.string(),
    registryMode: v.union(v.literal('8004'), v.literal('metaplex'), v.literal('dual')),
    name: v.string(),
    symbol: v.optional(v.string()),
    description: v.string(),
    imageUri: v.optional(v.string()),
    services: v.array(v.object({ type: v.string(), value: v.string() })),
    skills: v.array(v.string()),
    domains: v.array(v.string()),
    socials: v.optional(
      v.object({
        website: v.optional(v.string()),
        x: v.optional(v.string()),
        discord: v.optional(v.string()),
      }),
    ),
    atomEnabled: v.boolean(),
    cluster: v.string(),
    collectionPointer: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    return ctx.db.insert('nanosolanaAgents', {
      ...args,
      ownerVerified: false,
      metadataUri: undefined,
      metadataCid: undefined,
      assetAddress: undefined,
      assetTxSignature: undefined,
      transferTxSignature: undefined,
      metaplexAssetAddress: undefined,
      metaplexIdentityPda: undefined,
      metaplexExecutiveProfilePda: undefined,
      metaplexDelegateRecordPda: undefined,
      metaplexRegistered: false,
      metaplexRegistrationTxSignature: undefined,
      metaplexDelegateTxSignature: undefined,
      metaplexTransferTxSignature: undefined,
      status: 'pending',
      errorMessage: undefined,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const markReadyInternal = internalMutation({
  args: {
    registrationId: v.id('nanosolanaAgents'),
    metadataCid: v.string(),
    metadataUri: v.string(),
    assetAddress: v.string(),
    ownerVerified: v.boolean(),
    assetTxSignature: v.optional(v.string()),
    transferTxSignature: v.optional(v.string()),
    metaplexAssetAddress: v.optional(v.string()),
    metaplexIdentityPda: v.optional(v.string()),
    metaplexExecutiveProfilePda: v.optional(v.string()),
    metaplexDelegateRecordPda: v.optional(v.string()),
    metaplexRegistered: v.boolean(),
    metaplexRegistrationTxSignature: v.optional(v.string()),
    metaplexDelegateTxSignature: v.optional(v.string()),
    metaplexTransferTxSignature: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.registrationId, {
      metadataCid: args.metadataCid,
      metadataUri: args.metadataUri,
      assetAddress: args.assetAddress,
      ownerVerified: args.ownerVerified,
      assetTxSignature: args.assetTxSignature,
      transferTxSignature: args.transferTxSignature,
      metaplexAssetAddress: args.metaplexAssetAddress,
      metaplexIdentityPda: args.metaplexIdentityPda,
      metaplexExecutiveProfilePda: args.metaplexExecutiveProfilePda,
      metaplexDelegateRecordPda: args.metaplexDelegateRecordPda,
      metaplexRegistered: args.metaplexRegistered,
      metaplexRegistrationTxSignature: args.metaplexRegistrationTxSignature,
      metaplexDelegateTxSignature: args.metaplexDelegateTxSignature,
      metaplexTransferTxSignature: args.metaplexTransferTxSignature,
      status: 'ready',
      errorMessage: undefined,
      updatedAt: Date.now(),
    })
  },
})

export const updateDraftServicesInternal = internalMutation({
  args: {
    registrationId: v.id('nanosolanaAgents'),
    services: v.array(v.object({ type: v.string(), value: v.string() })),
    socials: v.optional(
      v.object({
        website: v.optional(v.string()),
        x: v.optional(v.string()),
        discord: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.registrationId, {
      services: args.services,
      socials: args.socials,
      updatedAt: Date.now(),
    })
  },
})

export const upsertRegistrySyncInternal = internalMutation({
  args: {
    userId: v.id('users'),
    ownerWalletAddress: v.string(),
    registryMode: v.union(v.literal('8004'), v.literal('metaplex'), v.literal('dual')),
    name: v.string(),
    symbol: v.optional(v.string()),
    description: v.string(),
    imageUri: v.optional(v.string()),
    metadataCid: v.optional(v.string()),
    metadataUri: v.optional(v.string()),
    assetAddress: v.string(),
    ownerVerified: v.boolean(),
    assetTxSignature: v.optional(v.string()),
    transferTxSignature: v.optional(v.string()),
    cluster: v.string(),
    atomEnabled: v.boolean(),
    services: v.array(v.object({ type: v.string(), value: v.string() })),
    skills: v.array(v.string()),
    domains: v.array(v.string()),
    socials: v.optional(
      v.object({
        website: v.optional(v.string()),
        x: v.optional(v.string()),
        discord: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('nanosolanaAgents')
      .withIndex('by_asset', (q) => q.eq('assetAddress', args.assetAddress))
      .unique()

    const nextDoc = {
      userId: args.userId,
      ownerWalletAddress: args.ownerWalletAddress,
      registryMode: args.registryMode,
      name: args.name,
      symbol: args.symbol,
      description: args.description,
      imageUri: args.imageUri,
      metadataCid: args.metadataCid,
      metadataUri: args.metadataUri,
      assetAddress: args.assetAddress,
      ownerVerified: args.ownerVerified,
      assetTxSignature: args.assetTxSignature,
      transferTxSignature: args.transferTxSignature,
      metaplexAssetAddress: undefined,
      metaplexIdentityPda: undefined,
      metaplexExecutiveProfilePda: undefined,
      metaplexDelegateRecordPda: undefined,
      metaplexRegistered: args.registryMode === 'metaplex' || args.registryMode === 'dual',
      metaplexRegistrationTxSignature: undefined,
      metaplexDelegateTxSignature: undefined,
      metaplexTransferTxSignature: undefined,
      cluster: args.cluster,
      collectionPointer: undefined,
      atomEnabled: args.atomEnabled,
      status: 'ready' as const,
      errorMessage: undefined,
      services: args.services,
      skills: args.skills,
      domains: args.domains,
      socials: args.socials,
      updatedAt: now,
    }

    if (existing) {
      await ctx.db.patch(existing._id, nextDoc)
      return decorateRow({
        ...existing,
        ...nextDoc,
      })
    }

    const insertedId = await ctx.db.insert('nanosolanaAgents', {
      ...nextDoc,
      createdAt: now,
    })
    const inserted = await ctx.db.get(insertedId)
    return inserted ? decorateRow(inserted) : null
  },
})

function decorateRow(row: Doc<'nanosolanaAgents'>) {
  return {
    ...row,
    explorerAssetUrl: row.assetAddress ? toExplorerUrl('address', row.assetAddress, row.cluster) : null,
    explorerRegistrationUrl: row.assetTxSignature
      ? toExplorerUrl('tx', row.assetTxSignature, row.cluster)
      : null,
    explorerTransferUrl: row.transferTxSignature
      ? toExplorerUrl('tx', row.transferTxSignature, row.cluster)
      : null,
    explorerMetaplexAssetUrl: row.metaplexAssetAddress
      ? toExplorerUrl('address', row.metaplexAssetAddress, row.cluster)
      : null,
    explorerMetaplexRegistrationUrl: row.metaplexRegistrationTxSignature
      ? toExplorerUrl('tx', row.metaplexRegistrationTxSignature, row.cluster)
      : null,
    explorerMetaplexDelegateUrl: row.metaplexDelegateTxSignature
      ? toExplorerUrl('tx', row.metaplexDelegateTxSignature, row.cluster)
      : null,
    explorerMetaplexTransferUrl: row.metaplexTransferTxSignature
      ? toExplorerUrl('tx', row.metaplexTransferTxSignature, row.cluster)
      : null,
  }
}

export const markFailedInternal = internalMutation({
  args: {
    registrationId: v.id('nanosolanaAgents'),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.registrationId, {
      status: 'failed',
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    })
  },
})

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const { userId, user } = await requireUser(ctx)
    const rowsByUser: Array<Doc<'nanosolanaAgents'>> = await ctx.db
      .query('nanosolanaAgents')
      .withIndex('by_user_created', (q) => q.eq('userId', userId))
      .order('desc')
      .collect()
    const deduped = new Map<string, Doc<'nanosolanaAgents'>>()
    for (const row of rowsByUser) {
      deduped.set(String(row._id), row)
    }

    const linkedWallet = user.solanaWalletAddress?.trim() || ''
    if (linkedWallet) {
      const rowsByWallet: Array<Doc<'nanosolanaAgents'>> = await ctx.db
        .query('nanosolanaAgents')
        .withIndex('by_owner_created', (q) => q.eq('ownerWalletAddress', linkedWallet))
        .order('desc')
        .collect()
      for (const row of rowsByWallet) {
        deduped.set(String(row._id), row)
      }
    }

    return Array.from(deduped.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(decorateRow)
  },
})

export const listByUserInternal = internalQuery({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const rows: Array<Doc<'nanosolanaAgents'>> = await ctx.db
      .query('nanosolanaAgents')
      .withIndex('by_user_created', (q) => q.eq('userId', args.userId))
      .order('desc')
      .collect()
    return rows.map(decorateRow)
  },
})

export const listRecentPublic = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.trunc(args.limit ?? 24), 48))
    const rows: Array<Doc<'nanosolanaAgents'>> = await ctx.db
      .query('nanosolanaAgents')
      .withIndex('by_status_created', (q) => q.eq('status', 'ready'))
      .order('desc')
      .take(limit)
    return rows.map(decorateRow)
  },
})

export const getPublicByRef = query({
  args: {
    ref: v.string(),
  },
  handler: async (ctx, args) => {
    const ref = args.ref.trim()
    if (!ref) return null

    const byAsset = await ctx.db
      .query('nanosolanaAgents')
      .withIndex('by_asset', (q) => q.eq('assetAddress', ref))
      .unique()
    if (byAsset && byAsset.status === 'ready') {
      return decorateRow(byAsset)
    }

    const rows: Array<Doc<'nanosolanaAgents'>> = await ctx.db
      .query('nanosolanaAgents')
      .withIndex('by_status_created', (q) => q.eq('status', 'ready'))
      .order('desc')
      .collect()

    const matched = rows.find((row) => String(row._id) === ref)
    return matched ? decorateRow(matched) : null
  },
})
