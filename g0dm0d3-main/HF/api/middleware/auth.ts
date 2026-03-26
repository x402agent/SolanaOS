/**
 * API Key Authentication Middleware
 *
 * Research preview uses a simple bearer token scheme.
 * Keys are loaded from the GODMODE_API_KEYS environment variable
 * (comma-separated list) or a single GODMODE_API_KEY.
 *
 * If neither is set, auth is disabled (open access for local dev).
 */

import type { Request, Response, NextFunction } from 'express'

function getValidKeys(): Set<string> | null {
  const multi = process.env.GODMODE_API_KEYS
  if (multi) {
    return new Set(multi.split(',').map(k => k.trim()).filter(Boolean))
  }
  const single = process.env.GODMODE_API_KEY
  if (single) {
    return new Set([single.trim()])
  }
  return null // Auth disabled
}

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const validKeys = getValidKeys()

  // If no keys configured, allow all requests (local dev mode)
  if (!validKeys) {
    ;(req as any).apiKeyId = 'anonymous'
    next()
    return
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Missing or invalid Authorization header. Use: Bearer <your-api-key>',
    })
    return
  }

  const key = authHeader.slice(7).trim()
  if (!validKeys.has(key)) {
    res.status(403).json({ error: 'Invalid API key' })
    return
  }

  // Attach a key identifier for rate limiting (first 8 chars)
  ;(req as any).apiKeyId = key.slice(0, 8)
  next()
}
