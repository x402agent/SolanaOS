/**
 * Convex Functions - Agent Sessions (Ralph Wiggum Loop)
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ============ Agent Session Queries ============

export const getAgentSession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentSessions")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});

export const getActiveAgentSessions = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("agentSessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  },
});

export const getAgentSessionsByAgent = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentSessions")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
  },
});

// ============ Agent Session Mutations ============

export const createAgentSession = mutation({
  args: {
    agentId: v.string(),
    sessionId: v.string(),
    maxIterations: v.number(),
    successCriteria: v.string(),
    targetMetrics: v.object({
      winRate: v.number(),
      avgMoveTime: v.number(),
      maxBlunders: v.number(),
      minAccuracy: v.number(),
    }),
    langsmithRunId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentSessions", {
      agentId: args.agentId,
      sessionId: args.sessionId,
      status: "active",
      iterationCount: 0,
      maxIterations: args.maxIterations,
      successCriteria: args.successCriteria,
      currentMetrics: {
        winRate: 0,
        avgMoveTime: 0,
        blunders: 0,
        accuracy: 0,
      },
      targetMetrics: args.targetMetrics,
      improvements: [],
      langsmithRunId: args.langsmithRunId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const updateAgentSessionMetrics = mutation({
  args: {
    sessionId: v.id("agentSessions"),
    metrics: v.object({
      winRate: v.number(),
      avgMoveTime: v.number(),
      blunders: v.number(),
      accuracy: v.number(),
    }),
    iterationCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      currentMetrics: args.metrics,
      iterationCount: args.iterationCount,
      updatedAt: Date.now(),
    });
  },
});

export const addAgentImprovement = mutation({
  args: {
    sessionId: v.id("agentSessions"),
    improvement: v.object({
      iteration: v.number(),
      change: v.string(),
      metrics: v.any(),
      timestamp: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    await ctx.db.patch(args.sessionId, {
      improvements: [...session.improvements, args.improvement],
      iterationCount: args.improvement.iteration,
      updatedAt: Date.now(),
    });
  },
});

export const completeAgentSession = mutation({
  args: {
    sessionId: v.id("agentSessions"),
    success: v.boolean(),
    finalMetrics: v.object({
      winRate: v.number(),
      avgMoveTime: v.number(),
      blunders: v.number(),
      accuracy: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      status: args.success ? "completed" : "failed",
      currentMetrics: args.finalMetrics,
      updatedAt: Date.now(),
    });
  },
});

// ============ Agent Moves ============

export const recordAgentMove = mutation({
  args: {
    agentSessionId: v.id("agentSessions"),
    gameId: v.id("games"),
    fen: v.string(),
    move: v.string(),
    evaluation: v.number(),
    thinking: v.optional(v.string()),
    timeSpent: v.number(),
    wasBlunder: v.boolean(),
    suggestedBetterMove: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agentMoves", {
      agentSessionId: args.agentSessionId,
      gameId: args.gameId,
      fen: args.fen,
      move: args.move,
      evaluation: args.evaluation,
      thinking: args.thinking,
      timeSpent: args.timeSpent,
      wasBlunder: args.wasBlunder,
      suggestedBetterMove: args.suggestedBetterMove,
      timestamp: Date.now(),
    });
  },
});

export const getAgentMoves = query({
  args: { 
    agentSessionId: v.id("agentSessions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("agentMoves")
      .withIndex("by_session", (q) => q.eq("agentSessionId", args.agentSessionId))
      .take(limit);
  },
});

export const getAgentGameMoves = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentMoves")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
  },
});

// ============ Agent Stats ============

export const getAgentStats = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("agentSessions")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();

    const completed = sessions.filter(s => s.status === "completed");
    const failed = sessions.filter(s => s.status === "failed");
    const active = sessions.filter(s => s.status === "active");

    const totalIterations = sessions.reduce((sum, s) => sum + s.iterationCount, 0);
    const avgIterationsToSuccess = completed.length > 0
      ? completed.reduce((sum, s) => sum + s.iterationCount, 0) / completed.length
      : 0;

    // Best metrics achieved
    let bestWinRate = 0;
    let bestAccuracy = 0;
    
    for (const session of sessions) {
      if (session.currentMetrics.winRate > bestWinRate) {
        bestWinRate = session.currentMetrics.winRate;
      }
      if (session.currentMetrics.accuracy > bestAccuracy) {
        bestAccuracy = session.currentMetrics.accuracy;
      }
    }

    return {
      totalSessions: sessions.length,
      completedSessions: completed.length,
      failedSessions: failed.length,
      activeSessions: active.length,
      successRate: sessions.length > 0 
        ? (completed.length / sessions.length) * 100 
        : 0,
      totalIterations,
      avgIterationsToSuccess,
      bestWinRate,
      bestAccuracy,
    };
  },
});

// ============ Leaderboard for Agents ============

export const getAgentLeaderboard = query({
  handler: async (ctx) => {
    const sessions = await ctx.db.query("agentSessions").collect();
    
    // Group by agentId and calculate stats
    const agentStats = new Map<string, {
      agentId: string;
      sessions: number;
      completed: number;
      bestWinRate: number;
      bestAccuracy: number;
      avgIterations: number;
    }>();

    for (const session of sessions) {
      const existing = agentStats.get(session.agentId);
      
      if (existing) {
        existing.sessions++;
        if (session.status === "completed") existing.completed++;
        if (session.currentMetrics.winRate > existing.bestWinRate) {
          existing.bestWinRate = session.currentMetrics.winRate;
        }
        if (session.currentMetrics.accuracy > existing.bestAccuracy) {
          existing.bestAccuracy = session.currentMetrics.accuracy;
        }
        existing.avgIterations = (existing.avgIterations * (existing.sessions - 1) + session.iterationCount) / existing.sessions;
      } else {
        agentStats.set(session.agentId, {
          agentId: session.agentId,
          sessions: 1,
          completed: session.status === "completed" ? 1 : 0,
          bestWinRate: session.currentMetrics.winRate,
          bestAccuracy: session.currentMetrics.accuracy,
          avgIterations: session.iterationCount,
        });
      }
    }

    // Convert to array and sort by best win rate
    return Array.from(agentStats.values())
      .sort((a, b) => b.bestWinRate - a.bestWinRate)
      .map((agent, index) => ({
        rank: index + 1,
        ...agent,
        successRate: agent.sessions > 0 
          ? (agent.completed / agent.sessions) * 100 
          : 0,
      }));
  },
});
