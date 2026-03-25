import { ConvexError, v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { internalMutation, internalQuery } from './functions'

const chessPacketKindValidator = v.union(v.literal('invite'), v.literal('move'))
const chessColorValidator = v.union(v.literal('White'), v.literal('Black'))
const chessStatusValidator = v.union(
  v.literal('Normal'),
  v.literal('Check'),
  v.literal('Checkmate'),
  v.literal('Stalemate'),
)

type ChessMatchSummary = {
  matchId: string
  inviterWalletAddress: string
  inviterLabel: string | null
  inviterColor: 'White' | 'Black'
  whiteWalletAddress: string | null
  blackWalletAddress: string | null
  viewerColor: 'White' | 'Black' | null
  opponentWalletAddress: string | null
  positionFingerprint: string
  positionStatus: 'Normal' | 'Check' | 'Checkmate' | 'Stalemate'
  moveCount: number
  latestPacketKind: 'invite' | 'move'
  latestSignerWalletAddress: string
  latestMove: string | null
  latestMoveDisplay: string | null
  latestSignedAtMs: number
  lastMoveAt: number | null
  createdAt: number
  updatedAt: number
}

type ChessPacketEvent = {
  packetKind: 'invite' | 'move'
  packetEncoded: string
  signerWalletAddress: string
  payloadJson: string
  signatureBase58: string
  ply: number | null
  move: string | null
  moveDisplay: string | null
  beforeFingerprint: string | null
  afterFingerprint: string | null
  signedAtMs: number
  createdAt: number
}

function normalizeWallet(value: string) {
  return value.trim()
}

function chooseWalletPair(
  inviterWalletAddress: string,
  viewerWalletAddress: string,
  remoteWalletAddress?: string | null,
) {
  const wallets = [normalizeWallet(inviterWalletAddress)]
  const viewer = normalizeWallet(viewerWalletAddress)
  if (viewer && !wallets.includes(viewer)) {
    wallets.push(viewer)
  }
  const remote = normalizeWallet(remoteWalletAddress ?? '')
  if (remote && !wallets.includes(remote)) {
    wallets.push(remote)
  }
  wallets.sort()
  if (wallets.length === 1) {
    return { walletA: wallets[0], walletB: wallets[0] }
  }
  return { walletA: wallets[0], walletB: wallets[1] }
}

function deriveColors(args: {
  viewerWalletAddress: string
  remoteWalletAddress?: string | null
  inviterWalletAddress: string
  inviterColor: 'White' | 'Black'
  localColor: 'White' | 'Black'
}) {
  const viewer = normalizeWallet(args.viewerWalletAddress)
  const remote = normalizeWallet(args.remoteWalletAddress ?? '')
  let whiteWalletAddress: string | undefined
  let blackWalletAddress: string | undefined

  if (viewer) {
    if (args.localColor === 'White') whiteWalletAddress = viewer
    if (args.localColor === 'Black') blackWalletAddress = viewer
  }
  if (remote) {
    if (args.localColor === 'White') blackWalletAddress = remote
    if (args.localColor === 'Black') whiteWalletAddress = remote
  } else {
    const inviter = normalizeWallet(args.inviterWalletAddress)
    if (viewer === inviter) {
      if (args.inviterColor === 'White') whiteWalletAddress = inviter
      if (args.inviterColor === 'Black') blackWalletAddress = inviter
    }
  }

  return { whiteWalletAddress, blackWalletAddress }
}

function toSummary(match: Doc<'nanosolanaChessMatches'>, viewerWalletAddress: string): ChessMatchSummary {
  const viewer = normalizeWallet(viewerWalletAddress)
  const viewerColor =
    match.whiteWalletAddress === viewer
      ? 'White'
      : match.blackWalletAddress === viewer
        ? 'Black'
        : null
  const opponentWalletAddress =
    viewerColor === 'White'
      ? match.blackWalletAddress ?? null
      : viewerColor === 'Black'
        ? match.whiteWalletAddress ?? null
        : match.inviterWalletAddress === viewer
          ? match.walletA === viewer
            ? match.walletB || null
            : match.walletA || null
          : match.inviterWalletAddress

  return {
    matchId: match.matchId,
    inviterWalletAddress: match.inviterWalletAddress,
    inviterLabel: match.inviterLabel ?? null,
    inviterColor: match.inviterColor,
    whiteWalletAddress: match.whiteWalletAddress ?? null,
    blackWalletAddress: match.blackWalletAddress ?? null,
    viewerColor,
    opponentWalletAddress,
    positionFingerprint: match.positionFingerprint,
    positionStatus: match.positionStatus,
    moveCount: match.moveCount,
    latestPacketKind: match.latestPacketKind,
    latestSignerWalletAddress: match.latestSignerWalletAddress,
    latestMove: match.latestMove ?? null,
    latestMoveDisplay: match.latestMoveDisplay ?? null,
    latestSignedAtMs: match.latestSignedAtMs,
    lastMoveAt: match.lastMoveAt ?? null,
    createdAt: match.createdAt,
    updatedAt: match.updatedAt,
  }
}

export const listMatchesForWalletInternal = internalQuery({
  args: {
    walletAddress: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ChessMatchSummary[]> => {
    const walletAddress = normalizeWallet(args.walletAddress)
    if (!walletAddress) {
      throw new ConvexError('Wallet address is required.')
    }
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 12), 1), 30)
    const [byA, byB] = await Promise.all([
      ctx.db
        .query('nanosolanaChessMatches')
        .withIndex('by_wallet_a_updated', (q) => q.eq('walletA', walletAddress))
        .order('desc')
        .take(limit),
      ctx.db
        .query('nanosolanaChessMatches')
        .withIndex('by_wallet_b_updated', (q) => q.eq('walletB', walletAddress))
        .order('desc')
        .take(limit),
    ])

    const unique = new Map<string, Doc<'nanosolanaChessMatches'>>()
    for (const match of [...byA, ...byB]) {
      unique.set(match._id, match)
    }

    return Array.from(unique.values())
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, limit)
      .map((match) => toSummary(match, walletAddress))
  },
})

export const getMatchForWalletInternal = internalQuery({
  args: {
    walletAddress: v.string(),
    matchId: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    summary: ChessMatchSummary
    events: ChessPacketEvent[]
  }> => {
    const walletAddress = normalizeWallet(args.walletAddress)
    const matchId = args.matchId.trim()
    if (!walletAddress || !matchId) {
      throw new ConvexError('Wallet address and matchId are required.')
    }

    const match = await ctx.db
      .query('nanosolanaChessMatches')
      .withIndex('by_match', (q) => q.eq('matchId', matchId))
      .unique()
    if (!match) {
      throw new ConvexError('Saved chess match not found.')
    }
    if (match.walletA !== walletAddress && match.walletB !== walletAddress) {
      throw new ConvexError('That saved chess match is not available to this wallet.')
    }

    const events = await ctx.db
      .query('nanosolanaChessEvents')
      .withIndex('by_match_created', (q) => q.eq('matchDocId', match._id))
      .order('asc')
      .collect()

    return {
      summary: toSummary(match, walletAddress),
      events: events.map((event) => ({
        packetKind: event.packetKind,
        packetEncoded: event.packetEncoded,
        signerWalletAddress: event.signerWalletAddress,
        payloadJson: event.payloadJson,
        signatureBase58: event.signatureBase58,
        ply: event.ply ?? null,
        move: event.move ?? null,
        moveDisplay: event.moveDisplay ?? null,
        beforeFingerprint: event.beforeFingerprint ?? null,
        afterFingerprint: event.afterFingerprint ?? null,
        signedAtMs: event.signedAtMs,
        createdAt: event.createdAt,
      })),
    }
  },
})

export const saveSignedPacketForWalletInternal = internalMutation({
  args: {
    viewerWalletAddress: v.string(),
    matchId: v.string(),
    packetKind: chessPacketKindValidator,
    packetEncoded: v.string(),
    signerWalletAddress: v.string(),
    payloadJson: v.string(),
    signatureBase58: v.string(),
    inviterWalletAddress: v.string(),
    inviterLabel: v.optional(v.string()),
    inviterColor: chessColorValidator,
    remoteWalletAddress: v.optional(v.string()),
    localColor: chessColorValidator,
    positionFingerprint: v.string(),
    positionStatus: chessStatusValidator,
    moveCount: v.number(),
    signedAtMs: v.number(),
    ply: v.optional(v.number()),
    move: v.optional(v.string()),
    moveDisplay: v.optional(v.string()),
    beforeFingerprint: v.optional(v.string()),
    afterFingerprint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewerWalletAddress = normalizeWallet(args.viewerWalletAddress)
    const matchId = args.matchId.trim()
    const signerWalletAddress = normalizeWallet(args.signerWalletAddress)
    const inviterWalletAddress = normalizeWallet(args.inviterWalletAddress)
    const remoteWalletAddress = normalizeWallet(args.remoteWalletAddress ?? '')
    const packetEncoded = args.packetEncoded.trim()
    const payloadJson = args.payloadJson.trim()
    const signatureBase58 = args.signatureBase58.trim()

    if (
      !viewerWalletAddress ||
      !matchId ||
      !signerWalletAddress ||
      !inviterWalletAddress ||
      !packetEncoded ||
      !payloadJson ||
      !signatureBase58
    ) {
      throw new ConvexError('Incomplete signed chess packet payload.')
    }

    const packetKey = `${matchId}:${args.packetKind}:${signatureBase58}`
    const now = Date.now()
    const signedAtMs = Math.max(1, Math.floor(args.signedAtMs))
    const { walletA, walletB } = chooseWalletPair(
      inviterWalletAddress,
      viewerWalletAddress,
      remoteWalletAddress,
    )
    const { whiteWalletAddress, blackWalletAddress } = deriveColors({
      viewerWalletAddress,
      remoteWalletAddress,
      inviterWalletAddress,
      inviterColor: args.inviterColor,
      localColor: args.localColor,
    })

    let match = await ctx.db
      .query('nanosolanaChessMatches')
      .withIndex('by_match', (q) => q.eq('matchId', matchId))
      .unique()

    if (!match) {
      const matchDocId = await ctx.db.insert('nanosolanaChessMatches', {
        matchId,
        walletA,
        walletB,
        inviterWalletAddress,
        inviterLabel: args.inviterLabel?.trim() || undefined,
        inviterColor: args.inviterColor,
        whiteWalletAddress,
        blackWalletAddress,
        positionFingerprint: args.positionFingerprint.trim(),
        positionStatus: args.positionStatus,
        moveCount: Math.max(0, Math.floor(args.moveCount)),
        latestPacketKind: args.packetKind,
        latestSignerWalletAddress: signerWalletAddress,
        latestMove: args.move?.trim() || undefined,
        latestMoveDisplay: args.moveDisplay?.trim() || undefined,
        latestSignedAtMs: signedAtMs,
        lastMoveAt: args.packetKind === 'move' ? signedAtMs : undefined,
        createdAt: signedAtMs,
        updatedAt: now,
      })
      match = await ctx.db.get(matchDocId)
      if (!match) {
        throw new ConvexError('Unable to create saved chess match.')
      }
    } else {
      const patch: Partial<Doc<'nanosolanaChessMatches'>> = {
        walletA,
        walletB,
        inviterWalletAddress,
        inviterLabel: args.inviterLabel?.trim() || match.inviterLabel,
        inviterColor: args.inviterColor,
        whiteWalletAddress: whiteWalletAddress ?? match.whiteWalletAddress,
        blackWalletAddress: blackWalletAddress ?? match.blackWalletAddress,
        positionFingerprint: args.positionFingerprint.trim(),
        positionStatus: args.positionStatus,
        moveCount: Math.max(match.moveCount, Math.max(0, Math.floor(args.moveCount))),
        latestPacketKind: args.packetKind,
        latestSignerWalletAddress: signerWalletAddress,
        latestMove: args.move?.trim() || undefined,
        latestMoveDisplay: args.moveDisplay?.trim() || undefined,
        latestSignedAtMs: Math.max(match.latestSignedAtMs, signedAtMs),
        lastMoveAt:
          args.packetKind === 'move'
            ? Math.max(match.lastMoveAt ?? 0, signedAtMs)
            : match.lastMoveAt,
        updatedAt: now,
      }
      await ctx.db.patch(match._id, patch)
      match = {
        ...match,
        ...patch,
      }
    }

    const existingEvent = await ctx.db
      .query('nanosolanaChessEvents')
      .withIndex('by_packet_key', (q) => q.eq('packetKey', packetKey))
      .unique()

    if (!existingEvent) {
      await ctx.db.insert('nanosolanaChessEvents', {
        matchDocId: match._id,
        matchId,
        packetKey,
        packetKind: args.packetKind,
        packetEncoded,
        signerWalletAddress,
        payloadJson,
        signatureBase58,
        ply: args.ply,
        move: args.move?.trim() || undefined,
        moveDisplay: args.moveDisplay?.trim() || undefined,
        beforeFingerprint: args.beforeFingerprint?.trim() || undefined,
        afterFingerprint: args.afterFingerprint?.trim() || undefined,
        signedAtMs,
        createdAt: signedAtMs,
        updatedAt: now,
      })
    }

    return {
      matchId: match.matchId,
      moveCount: match.moveCount,
      updatedAt: now,
      packetStored: !existingEvent,
    }
  },
})
