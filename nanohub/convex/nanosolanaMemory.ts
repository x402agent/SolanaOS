import { v } from 'convex/values'
import { internal } from './_generated/api'
import { httpAction, internalMutation } from './functions'
import { corsHeaders, mergeHeaders } from './lib/httpHeaders'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: mergeHeaders(corsHeaders(), {
      'Content-Type': 'application/json',
    }),
  })
}

function getBearerToken(request: Request) {
  const raw = request.headers.get('authorization') ?? request.headers.get('Authorization') ?? ''
  if (!raw.startsWith('Bearer ')) return ''
  return raw.slice('Bearer '.length).trim()
}

function resolveIngestKey() {
  return (
    process.env.NANOSOLANA_MEMORY_INGEST_KEY?.trim() ||
    process.env.CONVEX_MEMORY_INGEST_KEY?.trim() ||
    ''
  )
}

export const appendEntry = internalMutation({
  args: {
    entryId: v.string(),
    sessionId: v.string(),
    parentId: v.optional(v.string()),
    role: v.string(),
    channel: v.optional(v.string()),
    chatId: v.optional(v.string()),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    content: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('nanosolanaMemoryEntries')
      .withIndex('by_entry', (q) => q.eq('entryId', args.entryId))
      .unique()
    if (existing) {
      return { entryId: existing.entryId, sessionId: existing.sessionId, deduped: true }
    }

    const createdAt = args.createdAt ?? Date.now()
    await ctx.db.insert('nanosolanaMemoryEntries', {
      entryId: args.entryId,
      sessionId: args.sessionId,
      parentId: args.parentId,
      role: args.role,
      channel: args.channel,
      chatId: args.chatId,
      provider: args.provider,
      model: args.model,
      content: args.content,
      metadata: args.metadata,
      createdAt,
      updatedAt: createdAt,
    })

    const head = await ctx.db
      .query('nanosolanaSessionHeads')
      .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
      .unique()
    if (head) {
      await ctx.db.patch(head._id, {
        lastEntryId: args.entryId,
        lastRole: args.role,
        updatedAt: createdAt,
      })
    } else {
      await ctx.db.insert('nanosolanaSessionHeads', {
        sessionId: args.sessionId,
        lastEntryId: args.entryId,
        lastRole: args.role,
        updatedAt: createdAt,
      })
    }

    return { entryId: args.entryId, sessionId: args.sessionId, deduped: false }
  },
})

export const appendMemoryHttp = httpAction(async (ctx, request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: mergeHeaders(corsHeaders(), {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }),
    })
  }
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const expected = resolveIngestKey()
  if (!expected) {
    return json({ error: 'ingest key not configured' }, 500)
  }
  if (getBearerToken(request) != expected) {
    return json({ error: 'unauthorized' }, 401)
  }

  const body = await request.json()
  const entryId = typeof body?.entryId === 'string' ? body.entryId.trim() : ''
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : ''
  const role = typeof body?.role === 'string' ? body.role.trim().toLowerCase() : ''
  const content = typeof body?.content === 'string' ? body.content.trim() : ''
  if (!entryId || !sessionId || !role || !content) {
    return json({ error: 'entryId, sessionId, role, and content are required' }, 400)
  }

  const result = await ctx.runMutation(internal.nanosolanaMemory.appendEntry, {
    entryId,
    sessionId,
    parentId: typeof body?.parentId === 'string' ? body.parentId.trim() : undefined,
    role,
    channel: typeof body?.channel === 'string' ? body.channel.trim() : undefined,
    chatId: typeof body?.chatId === 'string' ? body.chatId.trim() : undefined,
    provider: typeof body?.provider === 'string' ? body.provider.trim() : undefined,
    model: typeof body?.model === 'string' ? body.model.trim() : undefined,
    content,
    metadata: body?.metadata,
    createdAt: typeof body?.createdAt === 'number' ? body.createdAt : undefined,
  })

  return json({ status: 'ok', result })
})
