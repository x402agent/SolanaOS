/**
 * Convex Functions - Players & Leaderboard
 */

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

// ============ Player Queries ============

export const getPlayer = query({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();
  },
});

export const getPlayerById = query({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.playerId);
  },
});

export const getOnlinePlayers = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("players")
      .withIndex("by_online", (q) => q.eq("isOnline", true))
      .collect();
  },
});

export const getTopPlayers = query({
  args: { 
    limit: v.optional(v.number()),
    sortBy: v.optional(v.union(
      v.literal("rating"),
      v.literal("wins"),
      v.literal("winStreak"),
      v.literal("totalWon")
    ))
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const sortBy = args.sortBy ?? "rating";
    
    const players = await ctx.db.query("players").collect();
    
    return players
      .sort((a, b) => {
        switch (sortBy) {
          case "rating": return b.rating - a.rating;
          case "wins": return b.wins - a.wins;
          case "winStreak": return b.bestWinStreak - a.bestWinStreak;
          case "totalWon": return b.totalWon - a.totalWon;
          default: return b.rating - a.rating;
        }
      })
      .slice(0, limit)
      .map((player, index) => ({
        rank: index + 1,
        ...player,
        winRate: player.gamesPlayed > 0 
          ? ((player.wins / player.gamesPlayed) * 100).toFixed(1)
          : "0.0",
      }));
  },
});

// ============ Player Mutations ============

export const createOrUpdatePlayer = mutation({
  args: {
    walletAddress: v.string(),
    username: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        username: args.username,
        lastSeen: Date.now(),
        isOnline: true,
      });
      return existing._id;
    }

    return await ctx.db.insert("players", {
      walletAddress: args.walletAddress,
      username: args.username,
      rating: 1200,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winStreak: 0,
      bestWinStreak: 0,
      totalWagered: 0,
      totalWon: 0,
      createdAt: Date.now(),
      lastSeen: Date.now(),
      isOnline: true,
    });
  },
});

export const setPlayerOnline = mutation({
  args: { 
    playerId: v.id("players"),
    isOnline: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.playerId, {
      isOnline: args.isOnline,
      lastSeen: Date.now(),
    });
  },
});

export const updatePlayerStats = mutation({
  args: {
    playerId: v.id("players"),
    result: v.union(v.literal("win"), v.literal("loss"), v.literal("draw")),
    ratingChange: v.number(),
    wagerAmount: v.optional(v.number()),
    wonAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");

    const updates: any = {
      gamesPlayed: player.gamesPlayed + 1,
      rating: Math.max(100, player.rating + args.ratingChange),
      lastSeen: Date.now(),
    };

    if (args.result === "win") {
      updates.wins = player.wins + 1;
      updates.winStreak = player.winStreak + 1;
      updates.bestWinStreak = Math.max(player.bestWinStreak, player.winStreak + 1);
    } else if (args.result === "loss") {
      updates.losses = player.losses + 1;
      updates.winStreak = 0;
    } else {
      updates.draws = player.draws + 1;
    }

    if (args.wagerAmount) {
      updates.totalWagered = player.totalWagered + args.wagerAmount;
    }
    if (args.wonAmount) {
      updates.totalWon = player.totalWon + args.wonAmount;
    }

    await ctx.db.patch(args.playerId, updates);
  },
});

// ============ Leaderboard Queries ============

export const getLeaderboard = query({
  args: {
    period: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("allTime")
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    if (args.period === "allTime") {
      // Real-time calculation for all-time
      const players = await ctx.db.query("players").collect();
      return players
        .filter(p => p.gamesPlayed > 0)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, limit)
        .map((player, index) => ({
          rank: index + 1,
          playerId: player._id,
          username: player.username,
          walletAddress: player.walletAddress,
          rating: player.rating,
          wins: player.wins,
          losses: player.losses,
          draws: player.draws,
          gamesPlayed: player.gamesPlayed,
          winRate: player.gamesPlayed > 0 
            ? ((player.wins / player.gamesPlayed) * 100).toFixed(1)
            : "0.0",
          totalWon: player.totalWon,
          winStreak: player.winStreak,
          bestWinStreak: player.bestWinStreak,
        }));
    }

    // Get cached snapshot for daily/weekly/monthly
    const today = new Date().toISOString().split('T')[0];
    const snapshot = await ctx.db
      .query("leaderboardSnapshots")
      .withIndex("by_period_date", (q) => 
        q.eq("period", args.period).eq("date", today)
      )
      .first();

    if (snapshot) {
      return snapshot.rankings.slice(0, limit);
    }

    // Fallback to real-time if no snapshot
    const players = await ctx.db.query("players").collect();
    return players
      .filter(p => p.gamesPlayed > 0)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit)
      .map((player, index) => ({
        rank: index + 1,
        playerId: player._id,
        username: player.username,
        walletAddress: player.walletAddress,
        rating: player.rating,
        wins: player.wins,
        winRate: player.gamesPlayed > 0 
          ? ((player.wins / player.gamesPlayed) * 100)
          : 0,
        totalWon: player.totalWon,
      }));
  },
});

export const getPlayerRank = query({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) return null;

    const playersAbove = await ctx.db
      .query("players")
      .filter((q) => q.gt(q.field("rating"), player.rating))
      .collect();

    return {
      rank: playersAbove.length + 1,
      rating: player.rating,
      percentile: 0, // Would need total player count
    };
  },
});

// ============ Leaderboard Snapshot (Internal) ============

export const createLeaderboardSnapshot = internalMutation({
  args: {
    period: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly")
    ),
  },
  handler: async (ctx, args) => {
    const players = await ctx.db.query("players").collect();
    const today = new Date().toISOString().split('T')[0];

    const rankings = players
      .filter(p => p.gamesPlayed > 0)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 100)
      .map((player, index) => ({
        rank: index + 1,
        playerId: player._id,
        username: player.username,
        walletAddress: player.walletAddress,
        rating: player.rating,
        wins: player.wins,
        winRate: player.gamesPlayed > 0 
          ? (player.wins / player.gamesPlayed) * 100
          : 0,
        totalWon: player.totalWon,
      }));

    await ctx.db.insert("leaderboardSnapshots", {
      period: args.period,
      date: today,
      rankings,
      createdAt: Date.now(),
    });
  },
});
