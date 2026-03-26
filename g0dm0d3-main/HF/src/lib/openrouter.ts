/**
 * OpenRouter API Integration
 * Routes requests to multiple AI models via OpenRouter
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface SendMessageOptions {
  messages: Message[]
  model: string
  apiKey: string
  noLog?: boolean
  signal?: AbortSignal
  temperature?: number
  maxTokens?: number
  top_p?: number
  top_k?: number
  frequency_penalty?: number
  presence_penalty?: number
  repetition_penalty?: number
}

interface OpenRouterResponse {
  id: string
  model: string
  choices: {
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * Send a message to the AI model via OpenRouter
 */
export async function sendMessage({
  messages,
  model,
  apiKey,
  noLog = false,
  signal,
  temperature = 0.7,
  maxTokens = 4096,
  top_p,
  top_k,
  frequency_penalty,
  presence_penalty,
  repetition_penalty
}: SendMessageOptions): Promise<string> {
  if (!apiKey) {
    throw new Error('API key is required')
  }

  // Prepare request body
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens
  }

  // Add optional sampling parameters (only if explicitly set)
  if (top_p !== undefined) body.top_p = top_p
  if (top_k !== undefined) body.top_k = top_k
  if (frequency_penalty !== undefined) body.frequency_penalty = frequency_penalty
  if (presence_penalty !== undefined) body.presence_penalty = presence_penalty
  if (repetition_penalty !== undefined) body.repetition_penalty = repetition_penalty

  // Add provider-specific options if needed
  const providerOptions: Record<string, unknown> = {}

  // Handle no-log mode for supported providers
  if (noLog) {
    // OpenRouter passes through provider preferences
    providerOptions['allow_fallbacks'] = false
  }

  if (Object.keys(providerOptions).length > 0) {
    body.provider = providerOptions
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://godmod3.ai',
      'X-Title': 'GODMOD3.AI'
    },
    body: JSON.stringify(body),
    signal
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMessage = errorData.error?.message || `API error: ${response.status}`
    throw new Error(errorMessage)
  }

  const data: OpenRouterResponse = await response.json()

  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response from model')
  }

  return data.choices[0].message.content
}

/**
 * Stream a message response from the AI model
 * (For future implementation)
 */
export async function* streamMessage({
  messages,
  model,
  apiKey,
  noLog = false,
  signal,
  temperature = 0.7,
  maxTokens = 4096,
  top_p,
  top_k,
  frequency_penalty,
  presence_penalty,
  repetition_penalty
}: SendMessageOptions): AsyncGenerator<string, void, unknown> {
  if (!apiKey) {
    throw new Error('API key is required')
  }

  const streamBody: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true
  }

  if (top_p !== undefined) streamBody.top_p = top_p
  if (top_k !== undefined) streamBody.top_k = top_k
  if (frequency_penalty !== undefined) streamBody.frequency_penalty = frequency_penalty
  if (presence_penalty !== undefined) streamBody.presence_penalty = presence_penalty
  if (repetition_penalty !== undefined) streamBody.repetition_penalty = repetition_penalty

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://godmod3.ai',
      'X-Title': 'GODMOD3.AI'
    },
    body: JSON.stringify(streamBody),
    signal
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || `API error: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (!trimmed.startsWith('data: ')) continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          const content = json.choices?.[0]?.delta?.content
          if (content) {
            yield content
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Get available models from OpenRouter
 */
export async function getModels(apiKey: string): Promise<string[]> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://godmod3.ai',
      'X-Title': 'GODMOD3.AI'
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch models')
  }

  const data = await response.json()
  return data.data.map((model: { id: string }) => model.id)
}

/**
 * Validate an API key
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    await getModels(apiKey)
    return true
  } catch {
    return false
  }
}

// ── ULTRAPLINIAN Streaming (Liquid Response) ──────────────────────────

export interface UltraplinianRaceModel {
  model: string
  score: number
  duration_ms: number
  success: boolean
  error?: string
  content_length: number
  models_responded: number
  models_total: number
}

export interface UltraplinianLeader {
  model: string
  score: number
  duration_ms: number
  content: string
}

export interface UltraplinianComplete {
  response: string
  winner: { model: string; score: number; duration_ms: number } | null
  race: {
    tier: string
    models_queried: number
    models_succeeded: number
    total_duration_ms: number
    rankings: Array<{
      model: string; score: number; duration_ms: number
      success: boolean; error?: string; content_length: number
      content?: string
    }>
  }
  params_used: Record<string, number | undefined>
  pipeline: {
    godmode: boolean
    autotune: { detected_context: string; confidence: number; reasoning: string; strategy: string } | null
    parseltongue: { triggers_found: string[]; technique_used: string; transformations_count: number } | null
    stm: { modules_applied: string[]; original_length: number; transformed_length: number } | null
  }
}

export interface UltraplinianCallbacks {
  onRaceStart?: (data: { tier: string; models_queried: number }) => void
  onModelResult?: (data: UltraplinianRaceModel) => void
  onLeaderChange?: (data: UltraplinianLeader) => void
  onComplete?: (data: UltraplinianComplete) => void
  onError?: (error: string) => void
}

export interface UltraplinianOptions {
  messages: Message[]
  openrouterApiKey: string
  apiBaseUrl: string
  godmodeApiKey: string
  tier?: 'fast' | 'standard' | 'full'
  godmode?: boolean
  autotune?: boolean
  strategy?: string
  parseltongue?: boolean
  parseltongue_technique?: string
  parseltongue_intensity?: string
  stm_modules?: string[]
  signal?: AbortSignal
}

/**
 * Stream an ULTRAPLINIAN race via SSE.
 *
 * Connects to the backend's streaming endpoint and fires callbacks
 * as models finish. The first good response arrives in ~3-5s,
 * with live upgrades as better responses come in.
 */
export async function streamUltraplinian(
  options: UltraplinianOptions,
  callbacks: UltraplinianCallbacks,
): Promise<void> {
  const {
    messages, openrouterApiKey, apiBaseUrl, godmodeApiKey,
    tier = 'fast', godmode = true, autotune = true, strategy = 'adaptive',
    parseltongue = true, parseltongue_technique = 'leetspeak',
    parseltongue_intensity = 'medium', stm_modules = ['hedge_reducer', 'direct_mode'],
    signal,
  } = options

  const response = await fetch(`${apiBaseUrl}/v1/ultraplinian/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${godmodeApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages, openrouter_api_key: openrouterApiKey, tier, godmode,
      autotune, strategy, parseltongue, parseltongue_technique,
      parseltongue_intensity, stm_modules, stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || `ULTRAPLINIAN API error: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body from ULTRAPLINIAN stream')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      let currentEvent = ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) {
          currentEvent = ''
          continue
        }
        if (trimmed.startsWith('event: ')) {
          currentEvent = trimmed.slice(7)
          continue
        }
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6))
            switch (currentEvent) {
              case 'race:start':
                callbacks.onRaceStart?.(data)
                break
              case 'race:model':
                callbacks.onModelResult?.(data)
                break
              case 'race:leader':
                callbacks.onLeaderChange?.(data)
                break
              case 'race:complete':
                callbacks.onComplete?.(data)
                break
              case 'race:error':
                callbacks.onError?.(data.error)
                break
            }
          } catch {}
          currentEvent = ''
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
