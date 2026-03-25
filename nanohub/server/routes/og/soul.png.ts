import { initWasm, Resvg } from '@resvg/resvg-wasm'
import { getQuery, getRequestHost } from 'h3'
import { withSentryEventHandler } from '../../lib/sentry'

import type { SoulOgMeta } from '../../og/fetchSoulOgMeta'
import { fetchSoulOgMeta } from '../../og/fetchSoulOgMeta'
import {
  FONT_MONO,
  FONT_SANS,
  getFontBuffers,
  getMarkDataUrl,
  getResvgWasm,
} from '../../og/ogAssets'
import { buildSoulOgSvg } from '../../og/soulOgSvg'

type OgQuery = {
  slug?: string
  owner?: string
  version?: string
  title?: string
  description?: string
  v?: string
}

let wasmInitPromise: Promise<void> | null = null

function cleanString(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function getApiBase(eventHost: string | null) {
  const direct = process.env.VITE_CONVEX_SITE_URL?.trim()
  if (direct) return direct

  const site = process.env.SITE_URL?.trim() || process.env.VITE_SITE_URL?.trim()
  if (site) return site

  if (eventHost) return `https://${eventHost}`
  return 'https://souls.hub.solanaos.net'
}

async function ensureWasm() {
  if (!wasmInitPromise) {
    wasmInitPromise = getResvgWasm().then((wasm) => {
      // Suppress stdout during WASM init — on Netlify Lambda, any binary
      // written to stdout gets prepended to the response JSON envelope and
      // causes "invalid character '\x00'" decode errors.
      const origWrite = process.stdout.write
      process.stdout.write = () => true
      return initWasm(wasm).finally(() => {
        process.stdout.write = origWrite
      })
    })
  }
  await wasmInitPromise
}

function buildFooter(slug: string, owner: string | null) {
  if (owner) return `@${owner}/${slug}`
  return `souls/${slug}`
}

export default withSentryEventHandler('og/soul.png', async (event) => {
  const query = getQuery(event) as OgQuery
  const slug = cleanString(query.slug)
  if (!slug) {
    return new Response('Missing `slug` query param.', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const ownerFromQuery = cleanString(query.owner)
  const versionFromQuery = cleanString(query.version)
  const titleFromQuery = cleanString(query.title)
  const descriptionFromQuery = cleanString(query.description)

  const needFetch = !titleFromQuery || !descriptionFromQuery || !ownerFromQuery || !versionFromQuery
  const meta: SoulOgMeta | null = needFetch
    ? await fetchSoulOgMeta(slug, getApiBase(getRequestHost(event)))
    : null

  const owner = ownerFromQuery || meta?.owner || ''
  const version = versionFromQuery || meta?.version || ''
  const title = titleFromQuery || meta?.displayName || slug
  const description = descriptionFromQuery || meta?.summary || ''

  const ownerLabel = owner ? `@${owner}` : 'SolanaOS Souls'
  const versionLabel = version ? `v${version}` : 'latest'
  const footer = buildFooter(slug, owner || null)

  const cacheKey = version ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'

  const [markDataUrl, fontBuffers] = await Promise.all([
    getMarkDataUrl(),
    ensureWasm().then(() => getFontBuffers()),
  ])

  const svg = buildSoulOgSvg({
    markDataUrl,
    title,
    description,
    ownerLabel,
    versionLabel,
    footer,
  })

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: {
      fontBuffers,
      defaultFontFamily: FONT_SANS,
      sansSerifFamily: FONT_SANS,
      monospaceFamily: FONT_MONO,
    },
  })
  const png = resvg.render().asPng()
  resvg.free()

  // Return a proper Response so Nitro/Netlify Lambda correctly
  // base64-encodes the binary body instead of injecting raw bytes
  // into the JSON response envelope (which causes "\x00" decode errors).
  return new Response(Buffer.from(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': cacheKey,
    },
  })
})
