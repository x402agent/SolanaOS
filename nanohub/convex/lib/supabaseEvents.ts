type SkillEventType = 'skill.publish' | 'skill.highlighted'

type SkillEventRecord = {
    eventType: SkillEventType
    slug: string
    displayName: string
    version?: string
    ownerHandle?: string
    highlighted?: boolean
    tags?: string[]
    summary?: string
    source: 'nanohub-convex'
    createdAt: string
}

type SupabaseConfig = {
    enabled: boolean
    url: string | null
    serviceRoleKey: string | null
    table: string
}

const DEFAULT_EVENTS_TABLE = 'skill_events'

export function getSupabaseConfig(env: NodeJS.ProcessEnv = process.env): SupabaseConfig {
    const url = env.SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim() || null
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null
    const table = env.SUPABASE_EVENTS_TABLE?.trim() || DEFAULT_EVENTS_TABLE

    return {
        enabled: Boolean(url && serviceRoleKey),
        url,
        serviceRoleKey,
        table,
    }
}

export function buildSkillEventRecord(args: {
    eventType: SkillEventType
    slug: string
    displayName: string
    version?: string
    ownerHandle?: string
    highlighted?: boolean
    tags?: string[]
    summary?: string
    now?: Date
}): SkillEventRecord {
    const now = args.now ?? new Date()
    return {
        eventType: args.eventType,
        slug: args.slug,
        displayName: args.displayName,
        version: args.version,
        ownerHandle: args.ownerHandle,
        highlighted: args.highlighted,
        tags: args.tags,
        summary: args.summary,
        source: 'nanohub-convex',
        createdAt: now.toISOString(),
    }
}

export async function persistSkillEventToSupabase(
    record: SkillEventRecord,
    env: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: boolean; skipped?: boolean }> {
    const config = getSupabaseConfig(env)
    if (!config.enabled || !config.url || !config.serviceRoleKey) {
        return { ok: false, skipped: true }
    }

    const endpoint = `${config.url.replace(/\/$/, '')}/rest/v1/${encodeURIComponent(config.table)}`

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: config.serviceRoleKey,
            Authorization: `Bearer ${config.serviceRoleKey}`,
            Prefer: 'return=minimal',
        },
        body: JSON.stringify(record),
    })

    if (!response.ok) {
        const body = await response.text()
        throw new Error(`Supabase event insert failed: ${response.status} ${body}`)
    }

    return { ok: true }
}
