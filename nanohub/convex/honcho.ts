"use node"

import { v } from 'convex/values'
import { internalAction } from './_generated/server'

const HONCHO_API_KEY = process.env.HONCHO_API_KEY ?? ''
const HONCHO_BASE_URL = process.env.HONCHO_BASE_URL ?? 'https://api.honcho.dev'
const WORKSPACE_ID = 'solanaos-hub-chat'

// ── Low-level Honcho HTTP helpers ───────────────────────────────────
// We use fetch directly instead of the SDK to keep the Node action lean.

async function honchoFetch(path: string, opts: RequestInit = {}) {
  const url = `${HONCHO_BASE_URL}/v2/workspaces/${WORKSPACE_ID}${path}`
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${HONCHO_API_KEY}`,
      ...(opts.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Honcho ${res.status}: ${text}`)
  }
  return res.json()
}

async function ensurePeer(peerId: string) {
  try {
    await honchoFetch(`/peers/${encodeURIComponent(peerId)}`, { method: 'GET' })
  } catch {
    await honchoFetch('/peers', {
      method: 'POST',
      body: JSON.stringify({ identifier: peerId }),
    })
  }
}

async function ensureSession(sessionId: string, peers: string[]) {
  try {
    await honchoFetch(`/sessions/${encodeURIComponent(sessionId)}`, { method: 'GET' })
  } catch {
    await honchoFetch('/sessions', {
      method: 'POST',
      body: JSON.stringify({
        identifier: sessionId,
        peers: peers.map((p) => ({ identifier: p })),
      }),
    })
  }
}

async function addMessages(
  sessionId: string,
  messages: Array<{ peer: string; content: string }>,
) {
  await honchoFetch(`/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      messages: messages.map((m) => ({
        peer_identifier: m.peer,
        content: m.content,
      })),
    }),
  })
}

// ── Exported Convex Actions ─────────────────────────────────────────

/**
 * Ingest a chat message into Honcho for background reasoning.
 * Called from chat.sendMessage via the scheduler.
 */
export const ingestMessage = internalAction({
  args: {
    senderWallet: v.string(),
    recipientWallet: v.string(),
    content: v.string(),
    threadId: v.string(),
  },
  handler: async (_ctx, args) => {
    if (!HONCHO_API_KEY) return // Honcho not configured – silently skip

    const senderPeer = `wallet:${args.senderWallet}`
    const recipientPeer = `wallet:${args.recipientWallet}`
    const sessionId = `thread:${args.threadId}`

    await ensurePeer(senderPeer)
    await ensurePeer(recipientPeer)
    await ensureSession(sessionId, [senderPeer, recipientPeer])
    await addMessages(sessionId, [{ peer: senderPeer, content: args.content }])
  },
})

/**
 * Query Honcho for synthesized context/insights about a user.
 * Returns a text summary from Honcho's reasoning engine.
 */
export const getContextForUser = internalAction({
  args: {
    walletAddress: v.string(),
    query: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<string | null> => {
    if (!HONCHO_API_KEY) return null

    const peerId = `wallet:${args.walletAddress}`
    const question =
      args.query ?? 'Summarize what you know about this user in 2-3 sentences.'

    try {
      await ensurePeer(peerId)
      const res = await honchoFetch(`/peers/${encodeURIComponent(peerId)}/chat`, {
        method: 'POST',
        body: JSON.stringify({ query: question }),
      })
      return res?.response ?? res?.content ?? JSON.stringify(res)
    } catch (e: any) {
      console.error('Honcho getContextForUser error:', e.message)
      return null
    }
  },
})
