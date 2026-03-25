/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    buildSkillEventRecord,
    getSupabaseConfig,
    persistSkillEventToSupabase,
} from './supabaseEvents'

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
})

describe('supabase event config', () => {
    it('is disabled when required env vars are missing', () => {
        const config = getSupabaseConfig({} as NodeJS.ProcessEnv)
        expect(config.enabled).toBe(false)
        expect(config.table).toBe('skill_events')
    })

    it('is enabled when URL and service role key exist', () => {
        const config = getSupabaseConfig({
            SUPABASE_URL: 'https://example.supabase.co',
            SUPABASE_SERVICE_ROLE_KEY: 'service-key',
            SUPABASE_EVENTS_TABLE: 'nanohub_events',
        } as NodeJS.ProcessEnv)

        expect(config.enabled).toBe(true)
        expect(config.url).toBe('https://example.supabase.co')
        expect(config.table).toBe('nanohub_events')
    })
})

describe('supabase event persistence', () => {
    it('skips persistence when not configured', async () => {
        const result = await persistSkillEventToSupabase(
            buildSkillEventRecord({
                eventType: 'skill.publish',
                slug: 'demo',
                displayName: 'Demo',
            }),
            {} as NodeJS.ProcessEnv,
        )
        expect(result).toEqual({ ok: false, skipped: true })
    })

    it('posts event payload to supabase REST endpoint', async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, status: 201 } as Response))
        globalThis.fetch = fetchMock as unknown as typeof fetch

        const record = buildSkillEventRecord({
            eventType: 'skill.publish',
            slug: 'demo',
            displayName: 'Demo',
            version: '1.0.0',
            ownerHandle: 'alice',
            tags: ['latest'],
            highlighted: false,
            summary: 'summary',
            now: new Date('2026-01-01T00:00:00.000Z'),
        })

        const result = await persistSkillEventToSupabase(record, {
            SUPABASE_URL: 'https://example.supabase.co',
            SUPABASE_SERVICE_ROLE_KEY: 'service-key',
            SUPABASE_EVENTS_TABLE: 'skill_events',
        } as NodeJS.ProcessEnv)

        expect(result).toEqual({ ok: true })
        expect(fetchMock).toHaveBeenCalledOnce()

        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
        expect(url).toBe('https://example.supabase.co/rest/v1/skill_events')
        expect(init.method).toBe('POST')
        expect(init.headers).toMatchObject({
            'Content-Type': 'application/json',
            apikey: 'service-key',
            Authorization: 'Bearer service-key',
        })
        expect(init.body).toContain('"eventType":"skill.publish"')
        expect(init.body).toContain('"source":"nanohub-convex"')
    })
})
