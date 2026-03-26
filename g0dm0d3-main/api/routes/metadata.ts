/**
 * ZDR Metadata API Routes
 *
 * GET /v1/metadata/stats   — Aggregated usage analytics (all tiers)
 * GET /v1/metadata/events  — Raw event log (Enterprise only)
 *
 * Everything here is content-free. Zero messages, zero responses, zero PII.
 * Just numbers, timestamps, model names, and pipeline flags.
 */

import { Router } from 'express'
import { getStats, getEvents } from '../lib/metadata'
import { tierGate } from '../middleware/tierGate'

export const metadataRoutes = Router()

// ── Aggregated Stats (all tiers) ────────────────────────────────────

metadataRoutes.get('/stats', (_req, res) => {
  res.json(getStats())
})

// ── Raw Event Log (Enterprise only) ─────────────────────────────────

metadataRoutes.get('/events', tierGate('metadata:events'), (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit)) || 100, 1000)
  const offset = parseInt(String(req.query.offset)) || 0
  const since = parseInt(String(req.query.since)) || undefined
  const mode = req.query.mode as 'standard' | 'ultraplinian' | undefined

  const result = getEvents({ limit, offset, since, mode })
  res.json({
    events: result.events,
    total: result.total,
    limit,
    offset,
    has_more: offset + limit < result.total,
  })
})
