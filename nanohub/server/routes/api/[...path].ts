/**
 * Proxy /api/* → Convex HTTP site URL.
 *
 * On Vercel this was handled by the rewrite in vercel.json:
 *   { "source": "/api/:path*", "destination": "<CONVEX_SITE_URL>/api/:path*" }
 *
 * On Railway (and any other Nitro-served host) this Nitro route handler
 * performs the same proxy using h3's proxyRequest, reading the target from
 * the CONVEX_SITE_URL environment variable set in the Railway service config.
 */
import { createError, proxyRequest } from 'h3'
import { withSentryEventHandler } from '../../lib/sentry'

export default withSentryEventHandler('api/[...path]', (event) => {
  const convexSiteUrl = process.env.CONVEX_SITE_URL?.replace(/\/$/, '')
  if (!convexSiteUrl) {
    throw createError({ statusCode: 503, message: 'CONVEX_SITE_URL is not configured' })
  }
  const target = convexSiteUrl + event.path
  return proxyRequest(event, target, { fetchOptions: { redirect: 'follow' } })
})
