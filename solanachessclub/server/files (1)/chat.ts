/**
 * Convex Functions - Lobby & Game Chat
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ============ Lobby Chat ============

export const getLobbyMessages = query({
  args: { 
    limit: v.optional(v.number()),
    before: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    let messagesQuery = ctx.db
      .query("lobbyChat")
      .withIndex("by_timestamp")
      .order("desc");

    if (args.before) {
      messagesQuery = messagesQuery.filter((q) => 
        q.lt(q.field("timestamp"), args.before!)
      );
    }

    const messages = await messagesQuery.take(limit);
    
    // Return in chronological order
    return messages.reverse();
  },
});

export const sendLobbyMessage = mutation({
  args: {
    playerId: v.id("players"),
    message: v.string(),
    type: v.optional(v.union(
      v.literal("message"),
      v.literal("system"),
      v.literal("challenge"),
      v.literal("join"),
      v.literal("leave")
    )),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId);
    if (!player) throw new Error("Player not found");

    // Validate message
    const cleanMessage = args.message.trim().slice(0, 500);
    if (!cleanMessage) throw new Error("Empty message");

    return await ctx.db.insert("lobbyChat", {
      playerId: args.playerId,
      username: player.username,
      message: cleanMessage,
      timestamp: Date.now(),
      type: args.type ?? "message",
    });
  },
});

export const sendSystemMessage = mutation({
  args: {
    message: v.string(),
    type: v.union(
      v.literal("system"),
      v.literal("challenge"),
      v.literal("join"),
      v.literal("leave")
    ),
  },
  handler: async (ctx, args) => {
    // Get or create system player
    let systemPlayer = await ctx.db
      .query("players")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", "SYSTEM"))
      .first();

    if (!systemPlayer) {
      const id = await ctx.db.insert("players", {
        walletAddress: "SYSTEM",
        username: "System",
        rating: 0,
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
      systemPlayer = await ctx.db.get(id);
    }

    return await ctx.db.insert("lobbyChat", {
      playerId: systemPlayer!._id,
      username: "System",
      message: args.message,
      timestamp: Date.now(),
      type: args.type,
    });
  },
});

// ============ Game Chat ============

export const getGameMessages = query({
  args: { 
    gameId: v.id("games"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    
    const messages = await ctx.db
      .query("gameChat")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .order("asc")
      .take(limit);

    return messages;
  },
});

export const sendGameMessage = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.optional(v.id("players")),
    message: v.string(),
    type: v.optional(v.union(
      v.literal("message"),
      v.literal("system"),
      v.literal("move")
    )),
  },
  handler: async (ctx, args) => {
    let username = "System";
    
    if (args.playerId) {
      const player = await ctx.db.get(args.playerId);
      if (!player) throw new Error("Player not found");
      username = player.username;
    }

    const cleanMessage = args.message.trim().slice(0, 500);
    if (!cleanMessage) throw new Error("Empty message");

    return await ctx.db.insert("gameChat", {
      gameId: args.gameId,
      playerId: args.playerId,
      username,
      message: cleanMessage,
      timestamp: Date.now(),
      type: args.type ?? (args.playerId ? "message" : "system"),
    });
  },
});

// ============ Challenges ============

export const createChallenge = mutation({
  args: {
    challengerId: v.id("players"),
    challengedId: v.id("players"),
    timeControl: v.number(),
    wagerAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const challenger = await ctx.db.get(args.challengerId);
    const challenged = await ctx.db.get(args.challengedId);
    
    if (!challenger || !challenged) {
      throw new Error("Player not found");
    }

    // Check for existing pending challenge
    const existing = await ctx.db
      .query("challenges")
      .withIndex("by_challenger", (q) => q.eq("challengerId", args.challengerId))
      .filter((q) => 
        q.and(
          q.eq(q.field("challengedId"), args.challengedId),
          q.eq(q.field("status"), "pending")
        )
      )
      .first();

    if (existing) {
      throw new Error("Challenge already pending");
    }

    const challengeId = await ctx.db.insert("challenges", {
      challengerId: args.challengerId,
      challengedId: args.challengedId,
      timeControl: args.timeControl,
      wagerAmount: args.wagerAmount,
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000, // 1 minute expiry
    });

    // Send lobby message
    await ctx.db.insert("lobbyChat", {
      playerId: args.challengerId,
      username: challenger.username,
      message: `challenged ${challenged.username} to a ${args.timeControl / 60}min game${args.wagerAmount ? ` for ${args.wagerAmount} SOL` : ''}!`,
      timestamp: Date.now(),
      type: "challenge",
    });

    return challengeId;
  },
});

export const respondToChallenge = mutation({
  args: {
    challengeId: v.id("challenges"),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) throw new Error("Challenge not found");
    if (challenge.status !== "pending") throw new Error("Challenge not pending");
    if (Date.now() > challenge.expiresAt) {
      await ctx.db.patch(args.challengeId, { status: "expired" });
      throw new Error("Challenge expired");
    }

    if (args.accept) {
      await ctx.db.patch(args.challengeId, { status: "accepted" });
      // Game creation would happen here
      return { accepted: true };
    } else {
      await ctx.db.patch(args.challengeId, { status: "declined" });
      return { accepted: false };
    }
  },
});

export const getPendingChallenges = query({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const asChallenger = await ctx.db
      .query("challenges")
      .withIndex("by_challenger", (q) => q.eq("challengerId", args.playerId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    const asChallenged = await ctx.db
      .query("challenges")
      .withIndex("by_challenged", (q) => q.eq("challengedId", args.playerId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    return {
      sent: asChallenger,
      received: asChallenged,
    };
  },
});
