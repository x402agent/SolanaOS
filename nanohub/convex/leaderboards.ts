import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalAction, internalMutation, internalQuery } from './functions'
import {
  buildTrendingLeaderboard,
  compareTrendingEntries,
  getTrendingRange,
  queryDailyStats,
  topN,
} from './lib/leaderboards'

const MAX_TRENDING_LIMIT = 200
const KEEP_LEADERBOARD_ENTRIES = 3

// ---------------------------------------------------------------------------
// Action → Query → Mutation pattern (avoids 32K document-read limit)
// ---------------------------------------------------------------------------

/** Reads a single day's skillDailyStats in its own query transaction. */
export const getDailyStats = internalQuery({
  args: { day: v.number() },
  handler: async (ctx, { day }) => {
    const rows = await queryDailyStats(ctx, day)
    return rows.map((r) => ({ skillId: r.skillId, installs: r.installs, downloads: r.downloads }))
  },
})

/** Writes the pre-computed leaderboard and prunes old entries. */
export const writeTrendingLeaderboard = internalMutation({
  args: {
    items: v.array(
      v.object({
        skillId: v.id('skills'),
        score: v.number(),
        installs: v.number(),
        downloads: v.number(),
      }),
    ),
    startDay: v.number(),
    endDay: v.number(),
  },
  handler: async (ctx, { items, startDay, endDay }) => {
    const now = Date.now()

    await ctx.db.insert('skillLeaderboards', {
      kind: 'trending',
      generatedAt: now,
      rangeStartDay: startDay,
      rangeEndDay: endDay,
      items,
    })

    const recent = await ctx.db
      .query('skillLeaderboards')
      .withIndex('by_kind', (q) => q.eq('kind', 'trending'))
      .order('desc')
      .take(KEEP_LEADERBOARD_ENTRIES + 5)

    for (const entry of recent.slice(KEEP_LEADERBOARD_ENTRIES)) {
      await ctx.db.delete(entry._id)
    }

    return { ok: true as const, count: items.length }
  },
})

/** Orchestrates the rebuild: queries each day separately, aggregates, writes. */
export const rebuildTrendingLeaderboardAction = internalAction({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ ok: true; count: number }> => {
    const limit = clampInt(args.limit ?? MAX_TRENDING_LIMIT, 1, MAX_TRENDING_LIMIT)
    const { startDay, endDay } = getTrendingRange(Date.now())

    const dayKeys = Array.from({ length: endDay - startDay + 1 }, (_, i) => startDay + i)
    const perDayRows = await Promise.all(
      dayKeys.map((day) => ctx.runQuery(internal.leaderboards.getDailyStats, { day })),
    )

    const totals = new Map<string, { installs: number; downloads: number }>()
    for (const rows of perDayRows) {
      for (const row of rows) {
        const current = totals.get(row.skillId) ?? { installs: 0, downloads: 0 }
        current.installs += row.installs
        current.downloads += row.downloads
        totals.set(row.skillId, current)
      }
    }

    const entries = Array.from(totals, ([skillId, t]) => ({
      skillId: skillId as Id<'skills'>,
      installs: t.installs,
      downloads: t.downloads,
      score: t.installs,
    }))

    const items = topN(entries, limit, compareTrendingEntries).sort((a, b) =>
      compareTrendingEntries(b, a),
    )

    return await ctx.runMutation(internal.leaderboards.writeTrendingLeaderboard, {
      items,
      startDay,
      endDay,
    })
  },
})

// ---------------------------------------------------------------------------
// Legacy single-mutation path (kept as fallback for under-32K workloads)
// ---------------------------------------------------------------------------

export const rebuildTrendingLeaderboardInternal = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = clampInt(args.limit ?? MAX_TRENDING_LIMIT, 1, MAX_TRENDING_LIMIT)
    const now = Date.now()
    const { startDay, endDay, items } = await buildTrendingLeaderboard(ctx, { limit, now })

    await ctx.db.insert('skillLeaderboards', {
      kind: 'trending',
      generatedAt: now,
      rangeStartDay: startDay,
      rangeEndDay: endDay,
      items,
    })

    const recent = await ctx.db
      .query('skillLeaderboards')
      .withIndex('by_kind', (q) => q.eq('kind', 'trending'))
      .order('desc')
      .take(KEEP_LEADERBOARD_ENTRIES + 5)

    for (const entry of recent.slice(KEEP_LEADERBOARD_ENTRIES)) {
      await ctx.db.delete(entry._id)
    }

    return { ok: true as const, count: items.length }
  },
})

function clampInt(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
