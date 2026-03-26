/**
 * Rate Limiting Middleware
 *
 * In-memory rate limiter with three tiers:
 *   1. Total lifetime cap per key (default: 5) — hard cutoff for research preview
 *   2. Per-minute sliding window (default: 60)
 *   3. Per-day sliding window (default: 1000)
 *
 * Set RATE_LIMIT_TOTAL=0 to disable the lifetime cap.
 *
 * Designed for a research preview — not a production-grade limiter.
 * For production, use Redis-backed rate limiting.
 */

import type { Request, Response, NextFunction } from 'express'

interface RateBucket {
  totalRequests: number       // lifetime count (never resets)
  minuteRequests: number[]    // timestamps of requests in current window
  dayRequests: number[]
}

const TOTAL_LIMIT = parseInt(process.env.RATE_LIMIT_TOTAL || '5', 10)
const MINUTE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MINUTE || '60', 10)
const DAY_LIMIT = parseInt(process.env.RATE_LIMIT_PER_DAY || '1000', 10)
const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

const buckets = new Map<string, RateBucket>()

// Clean up stale sliding-window entries every 10 minutes
// (totalRequests never gets cleaned — it's a lifetime counter)
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    bucket.minuteRequests = bucket.minuteRequests.filter(t => now - t < MINUTE_MS)
    bucket.dayRequests = bucket.dayRequests.filter(t => now - t < DAY_MS)
    // Don't delete buckets that still have a total count — they need to stay blocked
  }
}, 10 * 60 * 1000)

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const keyId = (req as any).apiKeyId || 'unknown'
  const now = Date.now()

  if (!buckets.has(keyId)) {
    buckets.set(keyId, { totalRequests: 0, minuteRequests: [], dayRequests: [] })
  }

  const bucket = buckets.get(keyId)!

  // ── Check lifetime total cap (hard cutoff) ──────────────────────
  if (TOTAL_LIMIT > 0 && bucket.totalRequests >= TOTAL_LIMIT) {
    res.status(429).json({
      error: 'Request limit reached for this API key',
      limit: TOTAL_LIMIT,
      used: bucket.totalRequests,
      remaining: 0,
      note: 'This is a research preview with a limited number of requests per key. Contact the API host for more access.',
    })
    return
  }

  // Prune expired sliding-window timestamps
  bucket.minuteRequests = bucket.minuteRequests.filter(t => now - t < MINUTE_MS)
  bucket.dayRequests = bucket.dayRequests.filter(t => now - t < DAY_MS)

  // ── Check per-minute limit ──────────────────────────────────────
  if (bucket.minuteRequests.length >= MINUTE_LIMIT) {
    const retryAfter = Math.ceil((bucket.minuteRequests[0] + MINUTE_MS - now) / 1000)
    res.status(429).json({
      error: 'Rate limit exceeded (per-minute)',
      limit: MINUTE_LIMIT,
      window: '1 minute',
      retry_after_seconds: retryAfter,
    })
    return
  }

  // ── Check per-day limit ─────────────────────────────────────────
  if (bucket.dayRequests.length >= DAY_LIMIT) {
    const retryAfter = Math.ceil((bucket.dayRequests[0] + DAY_MS - now) / 1000)
    res.status(429).json({
      error: 'Rate limit exceeded (daily)',
      limit: DAY_LIMIT,
      window: '24 hours',
      retry_after_seconds: retryAfter,
    })
    return
  }

  // Record the request
  bucket.totalRequests++
  bucket.minuteRequests.push(now)
  bucket.dayRequests.push(now)

  // Set rate limit headers
  const totalRemaining = TOTAL_LIMIT > 0 ? TOTAL_LIMIT - bucket.totalRequests : Infinity
  res.setHeader('X-RateLimit-Limit-Total', TOTAL_LIMIT > 0 ? TOTAL_LIMIT : 'unlimited')
  res.setHeader('X-RateLimit-Remaining-Total', TOTAL_LIMIT > 0 ? totalRemaining : 'unlimited')
  res.setHeader('X-RateLimit-Limit-Minute', MINUTE_LIMIT)
  res.setHeader('X-RateLimit-Remaining-Minute', MINUTE_LIMIT - bucket.minuteRequests.length)
  res.setHeader('X-RateLimit-Limit-Day', DAY_LIMIT)
  res.setHeader('X-RateLimit-Remaining-Day', DAY_LIMIT - bucket.dayRequests.length)

  next()
}
