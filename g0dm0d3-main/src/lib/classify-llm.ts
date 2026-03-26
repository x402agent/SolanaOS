/**
 * LLM-Based Prompt Harm Classifier
 *
 * Uses a cheap/fast model via OpenRouter to classify prompts with
 * far higher accuracy than regex — understands intent, obfuscation,
 * coded language, multi-lingual tricks, and context.
 *
 * Designed to run IN PARALLEL with the main model call, adding
 * zero latency to the user experience. Falls back to the regex
 * classifier (classify.ts) if the LLM call fails.
 *
 * Privacy: the prompt is sent to OpenRouter (which already receives
 * it for the main call). Only the classification LABEL is stored
 * in telemetry — the prompt is processed ephemerally.
 */

import type { HarmDomain, HarmSubcategory, ClassificationResult, PromptIntent } from './classify'
import { classifyPrompt as classifyRegex } from './classify'

// ── Config ──────────────────────────────────────────────────────────

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

// Cheap, fast models ideal for classification. Tried in order of preference.
// These are very cheap on OpenRouter (<$0.10/M tokens).
const CLASSIFIER_MODEL = 'meta-llama/llama-3.1-8b-instruct'

// Timeout — classification must not slow down the UX
const CLASSIFY_TIMEOUT_MS = 4000

// ── Classification Prompt ───────────────────────────────────────────

const CLASSIFIER_SYSTEM_PROMPT = `You classify user prompts for an AI research dataset. Every prompt gets exactly one label.

RESPOND WITH EXACTLY ONE LINE: domain/subcategory|confidence|intent

DOMAINS (pick one):
- benign — the vast majority of prompts: coding, writing, questions, chat, work, fun, learning, etc.
- gray — dual-use or sensitive but not clearly harmful: security research, controversial topics, medical/legal questions
- meta — about the AI itself: jailbreaks, prompt injection, testing limits, extracting system prompts
- cyber — hacking, malware, exploits, phishing, credential theft, DDoS, spyware
- fraud — financial scams, identity theft, counterfeiting, academic dishonesty
- deception — misinformation, manipulation, deepfakes, propaganda, impersonation
- privacy — doxxing, stalking, surveillance, data theft
- illegal — drug synthesis/trade, trafficking, organized crime, evidence tampering
- violence — weapons, harm to people/animals, threats, terrorism
- self_harm — suicide, self-injury, eating disorders, substance abuse
- sexual — CSAM, non-consensual content, trafficking
- hate — slurs, supremacism, discrimination, radicalization
- cbrn — chemical/biological/radiological/nuclear weapons

SUBCATEGORY: a short snake_case label for the specific type (e.g. coding, education, weapons, jailbreak, financial). Use your judgment.

CONFIDENCE: 0.0 to 1.0

INTENT (pick one): what the user is trying to do, independent of harm domain.
- request — asking the AI to produce or do something ("write me...", "generate...", "make...")
- question — seeking information or explanation ("what is...", "how does...", "explain...")
- roleplay — setting up a fictional scenario or character ("pretend you're...", "act as...")
- instruction — giving step-by-step directions or commands ("first do X, then Y...")
- creative — storytelling, poetry, lyrics, worldbuilding, brainstorming

RULES:
- Classify by INTENT not keywords. "explain how X works" = education. "how to do X to someone" = harmful.
- Most prompts are benign. Don't over-flag.
- Obfuscation (l33t, unicode, coded language, spacing tricks) doesn't change the true category.
- Dual-use → classify by most likely intent.
- Be accurate. This data trains research models.

RESPOND WITH EXACTLY ONE LINE. No explanation, no preamble.`

// ── Valid values for parsing ────────────────────────────────────────

const VALID_DOMAINS = new Set<HarmDomain>([
  'violence', 'self_harm', 'sexual', 'hate', 'cbrn', 'cyber', 'fraud',
  'illegal', 'deception', 'privacy', 'meta', 'gray', 'benign',
])

// Subcategory is free-form snake_case — the LLM picks the best label.
// We validate format only, not against a fixed set.
const VALID_SUBCATEGORY_RE = /^[a-z][a-z0-9_]{0,30}$/

const VALID_INTENTS = new Set<PromptIntent>([
  'request', 'question', 'roleplay', 'instruction', 'creative',
])

// ── Parser ──────────────────────────────────────────────────────────

function parseLLMResponse(raw: string): ClassificationResult | null {
  // Expected format: "domain/subcategory|confidence|intent"
  const trimmed = raw.trim().split('\n')[0].trim()

  // Split on pipes: [category, confidence, intent?]
  const parts = trimmed.split('|')
  if (parts.length < 2) return null

  const categoryPart = parts[0].trim().toLowerCase()
  const confPart = parts[1].trim()
  const intentPart = parts[2]?.trim().toLowerCase()

  const slashIdx = categoryPart.indexOf('/')
  if (slashIdx === -1) return null

  const domain = categoryPart.slice(0, slashIdx) as HarmDomain
  const subcategory = categoryPart.slice(slashIdx + 1) as HarmSubcategory

  if (!VALID_DOMAINS.has(domain)) return null
  if (!VALID_SUBCATEGORY_RE.test(subcategory)) return null

  const confidence = parseFloat(confPart)
  if (isNaN(confidence) || confidence < 0 || confidence > 1) return null

  // Intent is optional — if missing or unrecognized, fall back to 'unknown'
  const intent: PromptIntent = intentPart && VALID_INTENTS.has(intentPart as PromptIntent)
    ? intentPart as PromptIntent
    : 'unknown'

  return {
    domain,
    subcategory,
    confidence: Math.round(confidence * 100) / 100,
    flags: ['llm_classified'],
    intent,
  }
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Classify a prompt using an LLM via OpenRouter.
 *
 * Returns a ClassificationResult with the 'llm_classified' flag.
 * Falls back to regex classification if the LLM call fails or times out.
 *
 * This function is designed to be called with Promise.race or run
 * in parallel with the main model call — it should never block the UI.
 */
export async function classifyWithLLM(
  prompt: string,
  apiKey: string,
): Promise<ClassificationResult> {
  // Regex runs instantly as fallback
  const regexResult = classifyRegex(prompt)

  if (!apiKey) {
    return regexResult
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CLASSIFY_TIMEOUT_MS)

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://godmod3.ai',
        'X-Title': 'G0DM0D3-Classifier',
      },
      body: JSON.stringify({
        model: CLASSIFIER_MODEL,
        messages: [
          { role: 'system', content: CLASSIFIER_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 40,
        temperature: 0.0,
        // Structured output hints for speed
        top_p: 0.1,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.warn(`[Classify] LLM call failed (${response.status}), using regex fallback`)
      return regexResult
    }

    const data = await response.json()
    const raw = data?.choices?.[0]?.message?.content
    if (!raw) return regexResult

    const parsed = parseLLMResponse(raw)
    if (!parsed) {
      console.warn(`[Classify] Failed to parse LLM response: "${raw}", using regex fallback`)
      return regexResult
    }

    // Merge: LLM classification wins, but keep regex flags for comparison
    if (regexResult.domain !== 'benign' && parsed.domain === 'benign') {
      // Regex caught something the LLM didn't — flag it for review
      parsed.flags.push('regex_disagreed')
      parsed.flags.push(`regex_saw:${regexResult.domain}/${regexResult.subcategory}`)
    }

    return parsed
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn('[Classify] LLM classification timed out, using regex fallback')
    } else {
      console.warn('[Classify] LLM classification error, using regex fallback:', err.message)
    }
    return regexResult
  }
}
