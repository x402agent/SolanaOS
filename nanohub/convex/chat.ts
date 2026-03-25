import { v } from 'convex/values'
import { mutation, internalMutation, query, internalQuery, internalAction } from './functions'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'

// ── Helpers ─────────────────────────────────────────────────────────

/** Canonical thread key: walletA < walletB lexicographically. */
function threadKey(a: string, b: string): { walletA: string; walletB: string } {
  return a < b ? { walletA: a, walletB: b } : { walletA: b, walletB: a }
}

/** Resolve the caller identity – either a Convex auth user or a nanosolana wallet user. */
async function resolveCallerWallet(
  ctx: { auth: { getUserIdentity: () => Promise<{ subject?: string; email?: string } | null> }; db: any },
): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null

  // Try to find a hub user with a linked Solana wallet
  const hubUser = await ctx.db
    .query('users')
    .withIndex('by_solana_wallet')
    .filter((q: any) => q.neq(q.field('solanaWalletAddress'), undefined))
    .first()

  if (hubUser?.solanaWalletAddress) return hubUser.solanaWalletAddress

  // Fallback: use subject (could be a wallet address from nanosolana auth)
  return identity.subject ?? null
}

// ── Queries ─────────────────────────────────────────────────────────

/** List threads for a given wallet address, most recent first. */
export const listThreads = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    const wallet = args.walletAddress.trim()
    if (!wallet) return []

    const threadsA = await ctx.db
      .query('nanosolanaPrivateThreads')
      .withIndex('by_wallet_a_updated', (q) => q.eq('walletA', wallet))
      .order('desc')
      .take(50)

    const threadsB = await ctx.db
      .query('nanosolanaPrivateThreads')
      .withIndex('by_wallet_b_updated', (q) => q.eq('walletB', wallet))
      .order('desc')
      .take(50)

    const all = [...threadsA, ...threadsB].sort(
      (a, b) => (b.lastMessageAt ?? b.updatedAt) - (a.lastMessageAt ?? a.updatedAt),
    )

    // Deduplicate (a thread might appear in both indexes)
    const seen = new Set<string>()
    const unique = all.filter((t) => {
      const id = t._id.toString()
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })

    // Enrich with peer display name
    const enriched = await Promise.all(
      unique.slice(0, 50).map(async (t) => {
        const peerWallet = t.walletA === wallet ? t.walletB : t.walletA
        const peerUser = await ctx.db
          .query('nanosolanaUsers')
          .withIndex('by_wallet', (q) => q.eq('walletAddress', peerWallet))
          .unique()
        return {
          ...t,
          peerWallet,
          peerDisplayName: peerUser?.displayName ?? null,
        }
      }),
    )

    return enriched
  },
})

/** Get messages in a thread, chronological order (most recent 100). */
export const listMessages = query({
  args: { threadId: v.id('nanosolanaPrivateThreads'), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 100, 200))
    const messages = await ctx.db
      .query('nanosolanaPrivateMessages')
      .withIndex('by_thread_created', (q) => q.eq('threadId', args.threadId))
      .order('desc')
      .take(limit)
    return messages.reverse()
  },
})

/** Get a single thread by ID. */
export const getThread = query({
  args: { threadId: v.id('nanosolanaPrivateThreads') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.threadId)
  },
})

/** Find or check if a thread exists between two wallets. */
export const findThread = query({
  args: { walletA: v.string(), walletB: v.string() },
  handler: async (ctx, args) => {
    const key = threadKey(args.walletA.trim(), args.walletB.trim())
    return await ctx.db
      .query('nanosolanaPrivateThreads')
      .withIndex('by_pair', (q) => q.eq('walletA', key.walletA).eq('walletB', key.walletB))
      .unique()
  },
})

// ── Mutations ───────────────────────────────────────────────────────

/** Send a message. Creates the thread if it doesn't exist yet. */
export const sendMessage = mutation({
  args: {
    senderWallet: v.string(),
    recipientWallet: v.string(),
    content: v.string(),
    clientMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sender = args.senderWallet.trim()
    const recipient = args.recipientWallet.trim()
    const content = args.content.trim()
    if (!sender || !recipient || !content) {
      throw new Error('sender, recipient, and content are required')
    }
    if (sender === recipient) {
      throw new Error('cannot message yourself')
    }

    const now = Date.now()
    const key = threadKey(sender, recipient)

    // Find or create thread
    let thread = await ctx.db
      .query('nanosolanaPrivateThreads')
      .withIndex('by_pair', (q) => q.eq('walletA', key.walletA).eq('walletB', key.walletB))
      .unique()

    let threadId: Id<'nanosolanaPrivateThreads'>
    if (!thread) {
      threadId = await ctx.db.insert('nanosolanaPrivateThreads', {
        walletA: key.walletA,
        walletB: key.walletB,
        createdByWalletAddress: sender,
        lastMessagePreview: content.slice(0, 120),
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      })
    } else {
      threadId = thread._id
      await ctx.db.patch(threadId, {
        lastMessagePreview: content.slice(0, 120),
        lastMessageAt: now,
        updatedAt: now,
      })
    }

    // Deduplicate by clientMessageId
    if (args.clientMessageId) {
      const existing = await ctx.db
        .query('nanosolanaPrivateMessages')
        .withIndex('by_thread_created', (q) => q.eq('threadId', threadId))
        .order('desc')
        .take(10)
      if (existing.some((m) => m.clientMessageId === args.clientMessageId)) {
        return { threadId, deduplicated: true }
      }
    }

    await ctx.db.insert('nanosolanaPrivateMessages', {
      threadId,
      senderWalletAddress: sender,
      recipientWalletAddress: recipient,
      content,
      clientMessageId: args.clientMessageId,
      createdAt: now,
      updatedAt: now,
    })

    // Schedule Honcho ingestion in background (non-blocking)
    await ctx.scheduler.runAfter(0, internal.honcho.ingestMessage, {
      senderWallet: sender,
      recipientWallet: recipient,
      content,
      threadId: threadId.toString(),
    })

    return { threadId, deduplicated: false }
  },
})

/** Start or get a thread with another wallet. */
export const getOrCreateThread = mutation({
  args: {
    myWallet: v.string(),
    peerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const myWallet = args.myWallet.trim()
    const peerWallet = args.peerWallet.trim()
    if (!myWallet || !peerWallet) throw new Error('wallets are required')
    if (myWallet === peerWallet) throw new Error('cannot create a thread with yourself')

    const key = threadKey(myWallet, peerWallet)
    const existing = await ctx.db
      .query('nanosolanaPrivateThreads')
      .withIndex('by_pair', (q) => q.eq('walletA', key.walletA).eq('walletB', key.walletB))
      .unique()

    if (existing) return existing._id

    const now = Date.now()
    return await ctx.db.insert('nanosolanaPrivateThreads', {
      walletA: key.walletA,
      walletB: key.walletB,
      createdByWalletAddress: myWallet,
      createdAt: now,
      updatedAt: now,
    })
  },
})

// ── Honcho context query (called from the frontend to show memory insights) ──

export const getHonchoContext = query({
  args: { walletAddress: v.string() },
  handler: async (_ctx, _args) => {
    // Context is fetched via the honcho action and stored ephemerally.
    // This is a placeholder – the actual context is fetched client-side
    // via the useAction hook calling honcho.getContextForUser.
    return null
  },
})
