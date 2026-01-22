/**
 * Convex Schema for Solana Chess
 * Real-time database for games, leaderboards, chat, and agent sessions
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Players table
  players: defineTable({
    walletAddress: v.string(),
    username: v.string(),
    rating: v.number(),
    gamesPlayed: v.number(),
    wins: v.number(),
    losses: v.number(),
    draws: v.number(),
    winStreak: v.number(),
    bestWinStreak: v.number(),
    totalWagered: v.number(),
    totalWon: v.number(),
    createdAt: v.number(),
    lastSeen: v.number(),
    isOnline: v.boolean(),
    avatarUrl: v.optional(v.string()),
    country: v.optional(v.string()),
  })
    .index("by_wallet", ["walletAddress"])
    .index("by_rating", ["rating"])
    .index("by_wins", ["wins"])
    .index("by_online", ["isOnline"]),

  // Games table
  games: defineTable({
    code: v.string(),
    status: v.union(
      v.literal("waiting"),
      v.literal("playing"),
      v.literal("finished"),
      v.literal("abandoned")
    ),
    whitePlayerId: v.optional(v.id("players")),
    blackPlayerId: v.optional(v.id("players")),
    fen: v.string(),
    pgn: v.string(),
    moves: v.array(v.object({
      from: v.string(),
      to: v.string(),
      san: v.string(),
      timestamp: v.number(),
    })),
    turn: v.union(v.literal("w"), v.literal("b")),
    winner: v.optional(v.union(
      v.literal("white"),
      v.literal("black"),
      v.literal("draw")
    )),
    endReason: v.optional(v.string()),
    timeControl: v.number(),
    whiteTimeRemaining: v.number(),
    blackTimeRemaining: v.number(),
    wagerAmount: v.optional(v.number()),
    wagerStatus: v.optional(v.string()),
    escrowTx: v.optional(v.string()),
    payoutTx: v.optional(v.string()),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    isRanked: v.boolean(),
    isAgentGame: v.boolean(),
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"])
    .index("by_white", ["whitePlayerId"])
    .index("by_black", ["blackPlayerId"]),

  // Lobby chat messages
  lobbyChat: defineTable({
    playerId: v.id("players"),
    username: v.string(),
    message: v.string(),
    timestamp: v.number(),
    type: v.union(
      v.literal("message"),
      v.literal("system"),
      v.literal("challenge"),
      v.literal("join"),
      v.literal("leave")
    ),
  })
    .index("by_timestamp", ["timestamp"]),

  // Game chat messages
  gameChat: defineTable({
    gameId: v.id("games"),
    playerId: v.optional(v.id("players")),
    username: v.string(),
    message: v.string(),
    timestamp: v.number(),
    type: v.union(
      v.literal("message"),
      v.literal("system"),
      v.literal("move")
    ),
  })
    .index("by_game", ["gameId"])
    .index("by_game_timestamp", ["gameId", "timestamp"]),

  // Leaderboard snapshots (daily/weekly/monthly)
  leaderboardSnapshots: defineTable({
    period: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("allTime")
    ),
    date: v.string(),
    rankings: v.array(v.object({
      rank: v.number(),
      playerId: v.id("players"),
      username: v.string(),
      walletAddress: v.string(),
      rating: v.number(),
      wins: v.number(),
      winRate: v.number(),
      totalWon: v.number(),
    })),
    createdAt: v.number(),
  })
    .index("by_period_date", ["period", "date"]),

  // Agent sessions for Ralph Wiggum loops
  agentSessions: defineTable({
    agentId: v.string(),
    sessionId: v.string(),
    gameId: v.optional(v.id("games")),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("paused")
    ),
    iterationCount: v.number(),
    maxIterations: v.number(),
    successCriteria: v.string(),
    currentMetrics: v.object({
      winRate: v.number(),
      avgMoveTime: v.number(),
      blunders: v.number(),
      accuracy: v.number(),
    }),
    targetMetrics: v.object({
      winRate: v.number(),
      avgMoveTime: v.number(),
      maxBlunders: v.number(),
      minAccuracy: v.number(),
    }),
    improvements: v.array(v.object({
      iteration: v.number(),
      change: v.string(),
      metrics: v.any(),
      timestamp: v.number(),
    })),
    langsmithRunId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_session", ["sessionId"])
    .index("by_status", ["status"]),

  // Agent move history for learning
  agentMoves: defineTable({
    agentSessionId: v.id("agentSessions"),
    gameId: v.id("games"),
    fen: v.string(),
    move: v.string(),
    evaluation: v.number(),
    thinking: v.optional(v.string()),
    timeSpent: v.number(),
    wasBlunder: v.boolean(),
    suggestedBetterMove: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_session", ["agentSessionId"])
    .index("by_game", ["gameId"]),

  // Challenges between players
  challenges: defineTable({
    challengerId: v.id("players"),
    challengedId: v.id("players"),
    timeControl: v.number(),
    wagerAmount: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("expired")
    ),
    gameId: v.optional(v.id("games")),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_challenger", ["challengerId"])
    .index("by_challenged", ["challengedId"])
    .index("by_status", ["status"]),

  // Tournaments
  tournaments: defineTable({
    name: v.string(),
    description: v.string(),
    format: v.union(
      v.literal("swiss"),
      v.literal("roundRobin"),
      v.literal("elimination")
    ),
    timeControl: v.number(),
    entryFee: v.optional(v.number()),
    prizePool: v.number(),
    maxPlayers: v.number(),
    currentPlayers: v.number(),
    players: v.array(v.id("players")),
    rounds: v.array(v.object({
      roundNumber: v.number(),
      pairings: v.array(v.object({
        whiteId: v.id("players"),
        blackId: v.id("players"),
        gameId: v.optional(v.id("games")),
        result: v.optional(v.string()),
      })),
    })),
    standings: v.array(v.object({
      playerId: v.id("players"),
      points: v.number(),
      tiebreak: v.number(),
    })),
    status: v.union(
      v.literal("registration"),
      v.literal("inProgress"),
      v.literal("completed")
    ),
    startsAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_start", ["startsAt"]),
});
