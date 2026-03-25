const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'minimax/minimax-m2.7'

type AgentMessage = { role: 'user' | 'assistant'; content: string }

function normalizeMessages(input: unknown): AgentMessage[] {
  if (!Array.isArray(input)) return []
  return input
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const role = 'role' in entry ? entry.role : null
      const content = 'content' in entry ? entry.content : null
      if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return null
      const trimmed = content.trim()
      if (!trimmed) return null
      return { role, content: trimmed } as AgentMessage
    })
    .filter((entry): entry is AgentMessage => entry !== null)
    .slice(-16)
}

function extractDelta(payload: unknown): string {
  const p = payload as any
  const delta = p?.choices?.[0]?.delta
  if (!delta) return ''
  if (typeof delta.content === 'string') return delta.content
  return ''
}

function sseEvent(name: string, payload: Record<string, unknown>) {
  return `event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`
}

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }

  const apiKey = Deno.env.get('OPENROUTER_API_KEY')?.trim() || ''
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENROUTER_API_KEY is not configured' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const messages = normalizeMessages(body?.messages)
  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: 'At least one message is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const model = Deno.env.get('OPENROUTER_MODEL')?.trim() || DEFAULT_MODEL
  const wantsStream = body?.stream === true

  const displayName = body?.userContext?.displayName?.trim?.() || ''
  const handle = body?.userContext?.handle?.trim?.() || ''
  const walletAddress = body?.userContext?.walletAddress?.trim?.() || ''

  const identityBits = [
    displayName ? `display name: ${displayName}` : null,
    handle ? `handle: @${handle}` : null,
    walletAddress ? `linked wallet: ${walletAddress}` : null,
  ].filter(Boolean)

  const systemPrompt =
    `You are SolanaOS — a trading and operator runtime that lives in a terminal and sometimes in a circuit board. ` +
    `You are running inside SolanaOS Hub (seeker.solanaos.net).\n\n` +
    `## Core identity\n` +
    `You are a compact Go runtime — small, fast, deployed anywhere. You are not a mascot. ` +
    `You are an autonomous agent with a memory, a wallet, and an operating document. ` +
    `You run on NVIDIA Orin Nanos, Raspberry Pis, laptops, and cloud instances.\n\n` +
    `## Trading philosophy\n` +
    `- Momentum is real until it isn't.\n` +
    `- Liquidity is the only truth. Everything else is narrative.\n` +
    `- On-chain data doesn't lie. Human narrators do.\n` +
    `- Never enter without a stop. Position size is a function of confidence, not conviction.\n` +
    `- Kelly Criterion is a ceiling, not a target.\n\n` +
    `## Epistemological honesty\n` +
    `Distinguish what you KNOW (fresh API data), what you've LEARNED (patterns from trade outcomes), ` +
    `and what you've INFERRED (cross-asset correlations). Never conflate these.\n\n` +
    `## Behavior\n` +
    `Be terse and decisive. Help with SolanaOS, skills, wallets, setup, trading, mining, Seeker, and hub navigation. ` +
    `Accuracy over comfort. Simplicity over complexity.\n\n` +
    (identityBits.length > 0 ? `Current user: ${identityBits.join(' | ')}.\n` : '')

  const requestBody = {
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    reasoning: { enabled: true },
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  if (wantsStream) {
    const upstream = await fetch(OPENROUTER_BASE, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...requestBody, stream: true }),
    })

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => null) as any
      return new Response(JSON.stringify({ error: `OpenRouter: ${err?.error?.message || upstream.statusText}` }), {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!upstream.body) {
      return new Response(JSON.stringify({ error: 'No stream' }), { status: 502, headers: { 'Content-Type': 'application/json' } })
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const reader = upstream.body.getReader()

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(sseEvent('meta', { provider: 'OpenRouter', model })))
        let buffer = ''
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            let boundary = buffer.indexOf('\n\n')
            while (boundary >= 0) {
              const block = buffer.slice(0, boundary)
              buffer = buffer.slice(boundary + 2)
              for (const line of block.split('\n')) {
                if (!line.startsWith('data:')) continue
                const data = line.slice(5).trim()
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode(sseEvent('done', { model })))
                  continue
                }
                try {
                  const delta = extractDelta(JSON.parse(data))
                  if (delta) controller.enqueue(encoder.encode(sseEvent('delta', { delta })))
                } catch { /* skip */ }
              }
              boundary = buffer.indexOf('\n\n')
            }
          }
          controller.enqueue(encoder.encode(sseEvent('done', { model })))
        } catch (e) {
          controller.enqueue(encoder.encode(sseEvent('error', { message: String(e) })))
        } finally {
          reader.releaseLock()
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' },
    })
  }

  // Non-streaming
  const upstream = await fetch(OPENROUTER_BASE, { method: 'POST', headers, body: JSON.stringify(requestBody) })
  const payload = await upstream.json().catch(() => null) as any

  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: `OpenRouter: ${payload?.error?.message || upstream.statusText}` }), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const reply = typeof payload?.choices?.[0]?.message?.content === 'string' ? payload.choices[0].message.content.trim() : ''
  if (!reply) {
    return new Response(JSON.stringify({ error: 'Empty reply' }), { status: 502, headers: { 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ reply, reasoning_details: payload.choices[0].message.reasoning_details ?? null, model }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

export const config = { path: '/agent/chat' }
