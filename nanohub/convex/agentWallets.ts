/**
 * Convex mutations & queries for the Agent Wallet vault.
 *
 * Stores wallet metadata in Convex (linked to a Phantom wallet owner).
 * Private keys live in the Go vault — Convex never sees them.
 */
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

/** List all agent wallets owned by a Phantom wallet address. */
export const listByOwner = query({
  args: { ownerWalletAddress: v.string() },
  handler: async (ctx, { ownerWalletAddress }) => {
    return ctx.db
      .query('agentWallets')
      .withIndex('by_owner', (q) => q.eq('ownerWalletAddress', ownerWalletAddress))
      .order('desc')
      .collect()
  },
})

/** List agent wallets for the current authenticated user. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []
    const user = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('email'), identity.email))
      .first()
    if (!user) return []
    return ctx.db
      .query('agentWallets')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .collect()
  },
})

/** Get a single agent wallet by its vault ID. */
export const getByVaultId = query({
  args: { vaultWalletId: v.string() },
  handler: async (ctx, { vaultWalletId }) => {
    return ctx.db
      .query('agentWallets')
      .withIndex('by_vault_id', (q) => q.eq('vaultWalletId', vaultWalletId))
      .unique()
  },
})

/** Register a new agent wallet after it's been created in the Go vault. */
export const register = mutation({
  args: {
    ownerWalletAddress: v.string(),
    vaultWalletId: v.string(),
    label: v.string(),
    address: v.string(),
    chainType: v.union(v.literal('solana'), v.literal('evm')),
    chainId: v.number(),
    privyWalletId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // Try to find the user by their Solana wallet
    const user = await ctx.db
      .query('users')
      .withIndex('by_solana_wallet', (q) => q.eq('solanaWalletAddress', args.ownerWalletAddress))
      .first()

    return ctx.db.insert('agentWallets', {
      userId: user?._id,
      ownerWalletAddress: args.ownerWalletAddress,
      vaultWalletId: args.vaultWalletId,
      label: args.label,
      address: args.address,
      chainType: args.chainType,
      chainId: args.chainId,
      paused: false,
      privyWalletId: args.privyWalletId,
      createdAt: now,
      updatedAt: now,
    })
  },
})

/** Update balance cache for an agent wallet. */
export const updateBalance = mutation({
  args: {
    vaultWalletId: v.string(),
    lastBalanceSol: v.optional(v.number()),
    lastBalanceWei: v.optional(v.string()),
  },
  handler: async (ctx, { vaultWalletId, lastBalanceSol, lastBalanceWei }) => {
    const wallet = await ctx.db
      .query('agentWallets')
      .withIndex('by_vault_id', (q) => q.eq('vaultWalletId', vaultWalletId))
      .unique()
    if (!wallet) throw new Error('Wallet not found')

    await ctx.db.patch(wallet._id, {
      lastBalanceSol,
      lastBalanceWei,
      lastBalanceCheckedAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

/** Toggle pause state for an agent wallet. */
export const setPaused = mutation({
  args: {
    vaultWalletId: v.string(),
    ownerWalletAddress: v.string(),
    paused: v.boolean(),
  },
  handler: async (ctx, { vaultWalletId, ownerWalletAddress, paused }) => {
    const wallet = await ctx.db
      .query('agentWallets')
      .withIndex('by_vault_id', (q) => q.eq('vaultWalletId', vaultWalletId))
      .unique()
    if (!wallet) throw new Error('Wallet not found')
    if (wallet.ownerWalletAddress !== ownerWalletAddress) throw new Error('Not owner')

    await ctx.db.patch(wallet._id, { paused, updatedAt: Date.now() })
  },
})

/** Store E2B deployment info for an agent wallet. */
export const setDeployment = mutation({
  args: {
    vaultWalletId: v.string(),
    deploymentSandboxId: v.optional(v.string()),
    deploymentApiUrl: v.optional(v.string()),
  },
  handler: async (ctx, { vaultWalletId, deploymentSandboxId, deploymentApiUrl }) => {
    const wallet = await ctx.db
      .query('agentWallets')
      .withIndex('by_vault_id', (q) => q.eq('vaultWalletId', vaultWalletId))
      .unique()
    if (!wallet) throw new Error('Wallet not found')

    await ctx.db.patch(wallet._id, {
      deploymentSandboxId,
      deploymentApiUrl,
      updatedAt: Date.now(),
    })
  },
})

/** Delete an agent wallet record (soft — vault key remains until vault delete). */
export const remove = mutation({
  args: {
    vaultWalletId: v.string(),
    ownerWalletAddress: v.string(),
  },
  handler: async (ctx, { vaultWalletId, ownerWalletAddress }) => {
    const wallet = await ctx.db
      .query('agentWallets')
      .withIndex('by_vault_id', (q) => q.eq('vaultWalletId', vaultWalletId))
      .unique()
    if (!wallet) throw new Error('Wallet not found')
    if (wallet.ownerWalletAddress !== ownerWalletAddress) throw new Error('Not owner')

    await ctx.db.delete(wallet._id)
  },
})
