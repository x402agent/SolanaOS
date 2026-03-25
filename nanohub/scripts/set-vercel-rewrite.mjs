import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const API_REWRITE_SOURCE = '/api/:path*'

function normalizeOrigin(raw) {
    const value = raw?.trim()
    if (!value) return null
    const url = new URL(value)
    return url.origin.replace(/\/$/, '')
}

function resolveConvexSiteOrigin() {
    const argValue = process.argv[2]
    const envValue = process.env.CONVEX_SITE_URL ?? process.env.VITE_CONVEX_SITE_URL
    const origin = normalizeOrigin(argValue) ?? normalizeOrigin(envValue)
    if (!origin) {
        throw new Error(
            'Missing Convex site URL. Pass it as the first arg or set CONVEX_SITE_URL (or VITE_CONVEX_SITE_URL).',
        )
    }
    return origin
}

function loadConfig(path) {
    try {
        return JSON.parse(readFileSync(path, 'utf8'))
    } catch (error) {
        throw new Error(`Failed to read ${path}: ${error instanceof Error ? error.message : String(error)}`)
    }
}

function main() {
    const convexOrigin = resolveConvexSiteOrigin()
    const destination = `${convexOrigin}/api/:path*`
    const configPath = resolve(process.cwd(), 'vercel.json')
    const config = loadConfig(configPath)

    const rewrites = Array.isArray(config.rewrites) ? config.rewrites : []
    const existing = rewrites.find((entry) => entry?.source === API_REWRITE_SOURCE)
    if (existing) {
        existing.destination = destination
    } else {
        rewrites.unshift({
            source: API_REWRITE_SOURCE,
            destination,
        })
    }

    config.rewrites = rewrites
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)

    console.log(`Updated vercel.json rewrite: ${API_REWRITE_SOURCE} -> ${destination}`)
}

main()