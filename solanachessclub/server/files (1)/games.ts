/**
 * Convex Functions - Games
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ============ Game Queries ============

export const getGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) return null;

    const white = game.whitePlayerId 
      ? await ctx.db.get(game.whitePlayerId) 
      : null;
    const black = game.blackPlayerId 
      ? await ctx.db.get(game.blackPlayerId) 
      : null;

    return {
      ...game,
      white,
      black,
    };
  },
});

export const getGameByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();

    if (!game) return null;

    const white = game.whitePlayerId 
      ? await ctx.db.get(game.whitePlayerId) 
      : null;
    const black = game.blackPlayerId 
      ? await ctx.db.get(game.blackPlayerId) 
      : null;

    return {
      ...game,
      white,
      black,
    };
  },
});

export const getAvailableGames = query({
  handler: async (ctx) => {
    const games = await ctx.db
      .query("games")
      .withIndex("by_status", (q) => q.eq("status", "waiting"))
      .collect();

    return Promise.all(
      games.map(async (game) => {
        const white = game.whitePlayerId 
          ? await ctx.db.get(game.whitePlayerId) 
          : null;
        const black = game.blackPlayerId 
          ? await ctx.db.get(game.blackPlayerId) 
          : null;

        return {
          ...game,
          white,
          black,
        };
      })
    );
  },
});

export const getActiveGames = query({
  handler: async (ctx) => {
    const games = await ctx.db
      .query("games")
      .withIndex("by_status", (q) => q.eq("status", "playing"))
      .collect();

    return Promise.all(
      games.map(async (game) => {
        const white = game.whitePlayerId 
          ? await ctx.db.get(game.whitePlayerId) 
          : null;
        const black = game.blackPlayerId 
          ? await ctx.db.get(game.blackPlayerId) 
          : null;

        return {
          ...game,
          white,
          black,
        };
      })
    );
  },
});

export const getPlayerGames = query({
  args: { 
    playerId: v.id("players"),
    status: v.optional(v.union(
      v.literal("waiting"),
      v.literal("playing"),
      v.literal("finished")
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    
    let gamesAsWhite = ctx.db
      .query("games")
      .withIndex("by_white", (q) => q.eq("whitePlayerId", args.playerId));

    let gamesAsBlack = ctx.db
      .query("games")
      .withIndex("by_black", (q) => q.eq("blackPlayerId", args.playerId));

    if (args.status) {
      gamesAsWhite = gamesAsWhite.filter((q) => 
        q.eq(q.field("status"), args.status!)
      );
      gamesAsBlack = gamesAsBlack.filter((q) => 
        q.eq(q.field("status"), args.status!)
      );
    }

    const whiteGames = await gamesAsWhite.collect();
    const blackGames = await gamesAsBlack.collect();

    const allGames = [...whiteGames, ...blackGames]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    return Promise.all(
      allGames.map(async (game) => {
        const white = game.whitePlayerId 
          ? await ctx.db.get(game.whitePlayerId) 
          : null;
        const black = game.blackPlayerId 
          ? await ctx.db.get(game.blackPlayerId) 
          : null;

        return {
          ...game,
          white,
          black,
        };
      })
    );
  },
});

// ============ Game Mutations ============

function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export const createGame = mutation({
  args: {
    hostPlayerId: v.id("players"),
    side: v.union(v.literal("white"), v.literal("black"), v.literal("random")),
    timeControl: v.number(),
    wagerAmount: v.optional(v.number()),
    isRanked: v.optional(v.boolean()),
    isAgentGame: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const hostSide = args.side === "random" 
      ? (Math.random() > 0.5 ? "white" : "black")
      : args.side;

    const code = generateGameCode();
    const initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    const gameId = await ctx.db.insert("games", {
      code,
      status: "waiting",
      whitePlayerId: hostSide === "white" ? args.hostPlayerId : undefined,
      blackPlayerId: hostSide === "black" ? args.hostPlayerId : undefined,
      fen: initialFen,
      pgn: "",
      moves: [],
      turn: "w",
      timeControl: args.timeControl,
      whiteTimeRemaining: args.timeControl,
      blackTimeRemaining: args.timeControl,
      wagerAmount: args.wagerAmount,
      wagerStatus: args.wagerAmount ? "pending" : undefined,
      createdAt: Date.now(),
      isRanked: args.isRanked ?? true,
      isAgentGame: args.isAgentGame ?? false,
    });

    return { gameId, code };
  },
});

export const joinGame = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    side: v.optional(v.union(v.literal("white"), v.literal("black"))),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "waiting") throw new Error("Game not available");

    // Determine which side to join
    let joinSide: "white" | "black";
    if (args.side) {
      if (args.side === "white" && game.whitePlayerId) {
        throw new Error("White side already taken");
      }
      if (args.side === "black" && game.blackPlayerId) {
        throw new Error("Black side already taken");
      }
      joinSide = args.side;
    } else {
      // Auto-select available side
      if (!game.whitePlayerId) joinSide = "white";
      else if (!game.blackPlayerId) joinSide = "black";
      else throw new Error("Game is full");
    }

    // Update game
    const updates: any = {};
    if (joinSide === "white") {
      updates.whitePlayerId = args.playerId;
    } else {
      updates.blackPlayerId = args.playerId;
    }

    // Check if game is ready to start
    const whiteId = joinSide === "white" ? args.playerId : game.whitePlayerId;
    const blackId = joinSide === "black" ? args.playerId : game.blackPlayerId;

    if (whiteId && blackId) {
      updates.status = "playing";
      updates.startedAt = Date.now();
    }

    await ctx.db.patch(args.gameId, updates);

    return { 
      side: joinSide,
      started: !!(whiteId && blackId),
    };
  },
});

export const makeMove = mutation({
  args: {
    gameId: v.id("games"),
    playerId: v.id("players"),
    from: v.string(),
    to: v.string(),
    san: v.string(),
    newFen: v.string(),
    newPgn: v.string(),
    timeRemaining: v.number(),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "playing") throw new Error("Game not in progress");

    // Verify it's the player's turn
    const isWhite = game.whitePlayerId === args.playerId;
    const isBlack = game.blackPlayerId === args.playerId;
    
    if (!isWhite && !isBlack) {
      throw new Error("Not a player in this game");
    }
    if ((game.turn === "w" && !isWhite) || (game.turn === "b" && !isBlack)) {
      throw new Error("Not your turn");
    }

    // Record move
    const move = {
      from: args.from,
      to: args.to,
      san: args.san,
      timestamp: Date.now(),
    };

    // Update game state
    const updates: any = {
      fen: args.newFen,
      pgn: args.newPgn,
      moves: [...game.moves, move],
      turn: game.turn === "w" ? "b" : "w",
    };

    // Update time
    if (isWhite) {
      updates.whiteTimeRemaining = args.timeRemaining;
    } else {
      updates.blackTimeRemaining = args.timeRemaining;
    }

    await ctx.db.patch(args.gameId, updates);

    // Add move to game chat
    const player = await ctx.db.get(args.playerId);
    await ctx.db.insert("gameChat", {
      gameId: args.gameId,
      playerId: args.playerId,
      username: player?.username ?? "Unknown",
      message: args.san,
      timestamp: Date.now(),
      type: "move",
    });

    return { success: true };
  },
});

export const endGame = mutation({
  args: {
    gameId: v.id("games"),
    winner: v.union(v.literal("white"), v.literal("black"), v.literal("draw")),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");

    await ctx.db.patch(args.gameId, {
      status: "finished",
      winner: args.winner,
      endReason: args.reason,
      endedAt: Date.now(),
    });

    // Update player stats if ranked
    if (game.isRanked && game.whitePlayerId && game.blackPlayerId) {
      const ratingDelta = 16; // Simplified ELO change

      if (args.winner === "white") {
        // White wins
        const whitePlayer = await ctx.db.get(game.whitePlayerId);
        const blackPlayer = await ctx.db.get(game.blackPlayerId);
        
        if (whitePlayer) {
          await ctx.db.patch(game.whitePlayerId, {
            wins: whitePlayer.wins + 1,
            gamesPlayed: whitePlayer.gamesPlayed + 1,
            rating: whitePlayer.rating + ratingDelta,
            winStreak: whitePlayer.winStreak + 1,
            bestWinStreak: Math.max(whitePlayer.bestWinStreak, whitePlayer.winStreak + 1),
          });
        }
        if (blackPlayer) {
          await ctx.db.patch(game.blackPlayerId, {
            losses: blackPlayer.losses + 1,
            gamesPlayed: blackPlayer.gamesPlayed + 1,
            rating: Math.max(100, blackPlayer.rating - ratingDelta),
            winStreak: 0,
          });
        }
      } else if (args.winner === "black") {
        // Black wins
        const whitePlayer = await ctx.db.get(game.whitePlayerId);
        const blackPlayer = await ctx.db.get(game.blackPlayerId);
        
        if (whitePlayer) {
          await ctx.db.patch(game.whitePlayerId, {
            losses: whitePlayer.losses + 1,
            gamesPlayed: whitePlayer.gamesPlayed + 1,
            rating: Math.max(100, whitePlayer.rating - ratingDelta),
            winStreak: 0,
          });
        }
        if (blackPlayer) {
          await ctx.db.patch(game.blackPlayerId, {
            wins: blackPlayer.wins + 1,
            gamesPlayed: blackPlayer.gamesPlayed + 1,
            rating: blackPlayer.rating + ratingDelta,
            winStreak: blackPlayer.winStreak + 1,
            bestWinStreak: Math.max(blackPlayer.bestWinStreak, blackPlayer.winStreak + 1),
          });
        }
      } else {
        // Draw
        const whitePlayer = await ctx.db.get(game.whitePlayerId);
        const blackPlayer = await ctx.db.get(game.blackPlayerId);
        
        if (whitePlayer) {
          await ctx.db.patch(game.whitePlayerId, {
            draws: whitePlayer.draws + 1,
            gamesPlayed: whitePlayer.gamesPlayed + 1,
          });
        }
        if (blackPlayer) {
          await ctx.db.patch(game.blackPlayerId, {
            draws: blackPlayer.draws + 1,
            gamesPlayed: blackPlayer.gamesPlayed + 1,
          });
        }
      }
    }

    // Add end game message to chat
    await ctx.db.insert("gameChat", {
      gameId: args.gameId,
      playerId: undefined,
      username: "System",
      message: args.winner === "draw" 
        ? `Game ended in a draw (${args.reason})`
        : `${args.winner} wins by ${args.reason}!`,
      timestamp: Date.now(),
      type: "system",
    });

    return { success: true };
  },
});

// ============ Stats ============

export const getGlobalStats = query({
  handler: async (ctx) => {
    const allGames = await ctx.db.query("games").collect();
    const allPlayers = await ctx.db.query("players").collect();
    
    const activeGames = allGames.filter(g => g.status === "playing").length;
    const onlinePlayers = allPlayers.filter(p => p.isOnline).length;
    const totalGamesPlayed = allGames.filter(g => g.status === "finished").length;
    const totalWagered = allGames.reduce((sum, g) => sum + (g.wagerAmount ?? 0), 0);

    return {
      activeGames,
      onlinePlayers,
      totalGamesPlayed,
      totalPlayers: allPlayers.length,
      totalWagered,
      gamesWaiting: allGames.filter(g => g.status === "waiting").length,
    };
  },
});
