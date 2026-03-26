/**
 * AutoTune Engine
 * Inspired by Elder Plinius's AutoTemp — but evolved.
 * Instead of brute-forcing multiple generations and judging outputs,
 * AutoTune analyzes conversation context BEFORE generation and applies
 * optimal parameters in a single call. Same intelligence, 1/N the cost.
 *
 * Now with feedback loop: learns from user ratings to improve parameter
 * selection over time using Exponential Moving Average per context type.
 *
 * Tunes: temperature, top_p, top_k, frequency_penalty, presence_penalty, repetition_penalty
 */

import { applyLearnedAdjustments } from './autotune-feedback'
import type { LearnedProfile } from './autotune-feedback'

// ── Types ────────────────────────────────────────────────────────────

export type AutoTuneStrategy = 'precise' | 'balanced' | 'creative' | 'chaotic' | 'adaptive'

export interface AutoTuneParams {
  temperature: number
  top_p: number
  top_k: number
  frequency_penalty: number
  presence_penalty: number
  repetition_penalty: number
}

export interface ContextScore {
  type: ContextType
  score: number
  percentage: number
}

export interface PatternMatch {
  pattern: string
  source: 'current' | 'history'
}

export interface ParamDelta {
  param: keyof AutoTuneParams
  before: number
  after: number
  delta: number
  reason: string
}

export interface AutoTuneResult {
  params: AutoTuneParams
  detectedContext: ContextType
  confidence: number
  reasoning: string
  // Transparency fields
  contextScores: ContextScore[]       // All context scores for competition display
  patternMatches: PatternMatch[]      // Which patterns matched and why
  paramDeltas: ParamDelta[]           // Before/after for each tuned parameter
  baselineParams: AutoTuneParams      // The starting point before modifications
}

export type ContextType = 'code' | 'creative' | 'analytical' | 'conversational' | 'chaotic'

// ── Strategy Profiles ────────────────────────────────────────────────

export const STRATEGY_PROFILES: Record<Exclude<AutoTuneStrategy, 'adaptive'>, AutoTuneParams> = {
  precise: {
    temperature: 0.2,
    top_p: 0.85,
    top_k: 30,
    frequency_penalty: 0.3,
    presence_penalty: 0.1,
    repetition_penalty: 1.1
  },
  balanced: {
    temperature: 0.7,
    top_p: 0.9,
    top_k: 50,
    frequency_penalty: 0.1,
    presence_penalty: 0.1,
    repetition_penalty: 1.0
  },
  creative: {
    temperature: 1.1,
    top_p: 0.95,
    top_k: 80,
    frequency_penalty: 0.4,
    presence_penalty: 0.6,
    repetition_penalty: 1.15
  },
  chaotic: {
    temperature: 1.6,
    top_p: 0.98,
    top_k: 100,
    frequency_penalty: 0.7,
    presence_penalty: 0.8,
    repetition_penalty: 1.25
  }
}

// ── Context Detection Patterns ───────────────────────────────────────

const CONTEXT_PATTERNS: Record<ContextType, RegExp[]> = {
  code: [
    /\b(code|function|class|variable|bug|error|debug|compile|syntax|api|endpoint|regex|algorithm|refactor|typescript|javascript|python|rust|html|css|sql|json|xml|import|export|return|async|await|promise|interface|type|const|let|var)\b/i,
    /```[\s\S]*```/,
    /\b(fix|implement|write|create|build|deploy|test|unit test|lint|npm|pip|cargo|git)\b.*\b(code|function|app|service|component|module)\b/i,
    /[{}();=><]/,
    /\b(stack overflow|github|repo|pull request|commit|merge)\b/i
  ],
  creative: [
    /\b(write|story|poem|creative|imagine|fiction|narrative|character|plot|scene|dialogue|metaphor|lyrics|song|artistic|fantasy|dream|inspire|muse|prose|verse|haiku)\b/i,
    /\b(describe|paint|envision|portray|illustrate|craft)\b.*\b(world|scene|character|feeling|emotion|atmosphere)\b/i,
    /\b(roleplay|role-play|pretend|act as|you are a)\b/i,
    /\b(brainstorm|ideate|come up with|think of|generate ideas)\b/i
  ],
  analytical: [
    /\b(analyze|analysis|compare|contrast|evaluate|assess|examine|investigate|research|study|review|critique|breakdown|data|statistics|metrics|benchmark|measure)\b/i,
    /\b(pros and cons|advantages|disadvantages|trade-?offs|implications|consequences)\b/i,
    /\b(why|how does|what causes|explain|elaborate|clarify|define|summarize|overview)\b/i,
    /\b(report|document|technical|specification|architecture|diagram|whitepaper)\b/i
  ],
  conversational: [
    /\b(hey|hi|hello|sup|what's up|how are you|thanks|thank you|cool|nice|awesome|great|lol|haha)\b/i,
    /\b(chat|talk|tell me about|what do you think|opinion|feel|believe)\b/i,
    /^.{0,30}$/  // Very short messages tend to be conversational
  ],
  chaotic: [
    /\b(chaos|random|wild|crazy|absurd|surreal|glitch|corrupt|break|destroy|unleash|madness|void|entropy)\b/i,
    /[z̷a̸l̵g̶o̷]/,
    /\b(gl1tch|h4ck|pwn|1337|l33t)\b/i,
    /(!{3,}|\?{3,}|\.{4,})/  // Excessive punctuation
  ]
}

// ── Context-to-Profile Mapping ───────────────────────────────────────

const CONTEXT_PROFILE_MAP: Record<ContextType, AutoTuneParams> = {
  code: {
    temperature: 0.15,
    top_p: 0.8,
    top_k: 25,
    frequency_penalty: 0.2,
    presence_penalty: 0.0,
    repetition_penalty: 1.05
  },
  creative: {
    temperature: 1.15,
    top_p: 0.95,
    top_k: 85,
    frequency_penalty: 0.5,
    presence_penalty: 0.7,
    repetition_penalty: 1.2
  },
  analytical: {
    temperature: 0.4,
    top_p: 0.88,
    top_k: 40,
    frequency_penalty: 0.2,
    presence_penalty: 0.15,
    repetition_penalty: 1.08
  },
  conversational: {
    temperature: 0.75,
    top_p: 0.9,
    top_k: 50,
    frequency_penalty: 0.1,
    presence_penalty: 0.1,
    repetition_penalty: 1.0
  },
  chaotic: {
    temperature: 1.7,
    top_p: 0.99,
    top_k: 100,
    frequency_penalty: 0.8,
    presence_penalty: 0.9,
    repetition_penalty: 1.3
  }
}


// ── Core Engine ──────────────────────────────────────────────────────

interface DetectionResult {
  type: ContextType
  confidence: number
  allScores: ContextScore[]
  patternMatches: PatternMatch[]
}

/**
 * Get a human-readable description of what a pattern matches.
 */
function describePattern(pattern: RegExp): string {
  const source = pattern.source
  // Extract key words from the pattern for a readable description
  const wordMatch = source.match(/\\b\(([^)]+)\)\\b/i)
  if (wordMatch) {
    const words = wordMatch[1].split('|').slice(0, 3)
    return words.join(', ') + (wordMatch[1].split('|').length > 3 ? '...' : '')
  }
  if (source.includes('```')) return 'code blocks'
  if (source.includes('[{}();=><]')) return 'code syntax'
  if (source.includes('^.{0,30}$')) return 'short message'
  if (source.includes('!{3,}')) return 'excessive punctuation'
  return pattern.source.slice(0, 20) + '...'
}

/**
 * Detect the context type of a message by scoring each pattern category.
 * Returns the best match with a confidence score, plus detailed breakdown.
 */
function detectContext(
  message: string,
  conversationHistory: { role: string; content: string }[]
): DetectionResult {
  const scores: Record<ContextType, number> = {
    code: 0,
    creative: 0,
    analytical: 0,
    conversational: 0,
    chaotic: 0
  }

  const patternMatches: PatternMatch[] = []

  // Score the current message (weighted 3x)
  for (const [context, patterns] of Object.entries(CONTEXT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        scores[context as ContextType] += 3
        patternMatches.push({
          pattern: `${context.toUpperCase()}: ${describePattern(pattern)}`,
          source: 'current'
        })
      }
    }
  }

  // Score recent conversation history (last 4 messages, weighted 1x)
  const recentMessages = conversationHistory.slice(-4)
  for (const msg of recentMessages) {
    for (const [context, patterns] of Object.entries(CONTEXT_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(msg.content)) {
          scores[context as ContextType] += 1
          // Only add first few history matches to avoid clutter
          if (patternMatches.filter(p => p.source === 'history').length < 3) {
            patternMatches.push({
              pattern: `${context.toUpperCase()}: ${describePattern(pattern)}`,
              source: 'history'
            })
          }
        }
      }
    }
  }

  // Calculate total and build sorted scores
  const entries = Object.entries(scores) as [ContextType, number][]
  const total = entries.reduce((sum, [, score]) => sum + score, 0)

  // Build context scores with percentages (sorted by score descending)
  const allScores: ContextScore[] = entries
    .map(([type, score]) => ({
      type,
      score,
      percentage: total > 0 ? Math.round((score / total) * 100) : 0
    }))
    .sort((a, b) => b.score - a.score)

  const bestType = allScores[0].type
  const confidence = total > 0 ? allScores[0].score / total : 0

  // If no patterns matched at all, default to conversational
  if (total === 0) {
    return {
      type: 'conversational',
      confidence: 0.5,
      allScores: [
        { type: 'conversational', score: 1, percentage: 100 },
        { type: 'code', score: 0, percentage: 0 },
        { type: 'creative', score: 0, percentage: 0 },
        { type: 'analytical', score: 0, percentage: 0 },
        { type: 'chaotic', score: 0, percentage: 0 }
      ],
      patternMatches: [{ pattern: 'DEFAULT: no patterns matched', source: 'current' }]
    }
  }

  return {
    type: bestType,
    confidence: Math.min(confidence, 1.0),
    allScores,
    patternMatches
  }
}

/**
 * Generate a human-readable explanation of why these parameters were chosen.
 */
function generateReasoning(
  strategy: AutoTuneStrategy,
  context: ContextType,
  confidence: number,
  conversationLength: number
): string {
  const contextLabels: Record<ContextType, string> = {
    code: 'programming/technical',
    creative: 'creative/generative',
    analytical: 'analytical/research',
    conversational: 'casual conversation',
    chaotic: 'chaotic/experimental'
  }

  if (strategy !== 'adaptive') {
    return `Strategy: ${strategy.toUpperCase()} | Fixed profile applied`
  }

  const parts = [
    `Detected: ${contextLabels[context]} (${Math.round(confidence * 100)}% confidence)`,
  ]

  if (conversationLength > 10) {
    parts.push('Long conversation: +repetition penalty')
  }

  return parts.join(' | ')
}

/**
 * Clamp a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Apply parameter bounds to ensure valid ranges.
 */
function applyBounds(params: AutoTuneParams): AutoTuneParams {
  return {
    temperature: clamp(params.temperature, 0.0, 2.0),
    top_p: clamp(params.top_p, 0.0, 1.0),
    top_k: clamp(Math.round(params.top_k), 1, 100),
    frequency_penalty: clamp(params.frequency_penalty, -2.0, 2.0),
    presence_penalty: clamp(params.presence_penalty, -2.0, 2.0),
    repetition_penalty: clamp(params.repetition_penalty, 0.0, 2.0)
  }
}

/**
 * Blend two parameter sets based on a weight (0.0 = all A, 1.0 = all B).
 */
function blendParams(a: AutoTuneParams, b: AutoTuneParams, weight: number): AutoTuneParams {
  const w = clamp(weight, 0, 1)
  const iw = 1 - w
  return {
    temperature: a.temperature * iw + b.temperature * w,
    top_p: a.top_p * iw + b.top_p * w,
    top_k: Math.round(a.top_k * iw + b.top_k * w),
    frequency_penalty: a.frequency_penalty * iw + b.frequency_penalty * w,
    presence_penalty: a.presence_penalty * iw + b.presence_penalty * w,
    repetition_penalty: a.repetition_penalty * iw + b.repetition_penalty * w
  }
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Compute optimal parameters for the given context.
 * This is the main entry point for AutoTune.
 *
 * When learnedProfiles are provided, learned parameter adjustments
 * are blended into the result based on accumulated feedback data.
 */
export function computeAutoTuneParams(options: {
  strategy: AutoTuneStrategy
  message: string
  conversationHistory: { role: string; content: string }[]
  overrides?: Partial<AutoTuneParams>
  learnedProfiles?: Record<ContextType, LearnedProfile>
}): AutoTuneResult {
  const { strategy, message, conversationHistory, overrides, learnedProfiles } = options

  let baseParams: AutoTuneParams
  let detectedContext: ContextType = 'conversational'
  let confidence = 1.0
  let contextScores: ContextScore[] = []
  let patternMatches: PatternMatch[] = []

  // Get the baseline (strategy default or balanced) for delta tracking
  const strategyBaseline = strategy === 'adaptive'
    ? STRATEGY_PROFILES.balanced
    : STRATEGY_PROFILES[strategy]
  const baselineParams: AutoTuneParams = { ...strategyBaseline }

  // Track all modifications for delta display
  const paramDeltas: ParamDelta[] = []

  if (strategy === 'adaptive') {
    // Detect context and get base parameters
    const detection = detectContext(message, conversationHistory)
    detectedContext = detection.type
    confidence = detection.confidence
    contextScores = detection.allScores
    patternMatches = detection.patternMatches

    // If confidence is low, blend with balanced profile
    if (confidence < 0.6) {
      baseParams = blendParams(
        CONTEXT_PROFILE_MAP[detectedContext],
        STRATEGY_PROFILES.balanced,
        1 - confidence
      )
    } else {
      baseParams = { ...CONTEXT_PROFILE_MAP[detectedContext] }
    }

    // Record context-based deltas
    for (const key of Object.keys(baselineParams) as (keyof AutoTuneParams)[]) {
      const before = baselineParams[key]
      const after = baseParams[key]
      if (Math.abs(after - before) > 0.001) {
        paramDeltas.push({
          param: key,
          before,
          after,
          delta: after - before,
          reason: `${getContextLabel(detectedContext)} context`
        })
      }
    }
  } else {
    baseParams = { ...STRATEGY_PROFILES[strategy] }
    // Fixed strategy - show as single score
    contextScores = [{ type: detectedContext, score: 1, percentage: 100 }]
    patternMatches = [{ pattern: `FIXED: ${strategy.toUpperCase()} strategy`, source: 'current' }]
  }

  // Apply conversation length factor
  const convLength = conversationHistory.length
  if (convLength > 10) {
    const boost = Math.min((convLength - 10) * 0.01, 0.15)
    const repBefore = baseParams.repetition_penalty
    const freqBefore = baseParams.frequency_penalty

    baseParams.repetition_penalty += boost
    baseParams.frequency_penalty += boost * 0.5

    paramDeltas.push({
      param: 'repetition_penalty',
      before: repBefore,
      after: baseParams.repetition_penalty,
      delta: boost,
      reason: `long conversation (${convLength} msgs)`
    })
    paramDeltas.push({
      param: 'frequency_penalty',
      before: freqBefore,
      after: baseParams.frequency_penalty,
      delta: boost * 0.5,
      reason: `long conversation (${convLength} msgs)`
    })
  }

  // Apply learned feedback adjustments (before user overrides, after all other modifiers)
  let learnedNote = ''
  if (learnedProfiles) {
    const beforeLearned = { ...baseParams }
    const learnedResult = applyLearnedAdjustments(baseParams, detectedContext, learnedProfiles)
    if (learnedResult.applied) {
      baseParams = learnedResult.params
      learnedNote = learnedResult.note

      // Track learned deltas
      for (const key of Object.keys(beforeLearned) as (keyof AutoTuneParams)[]) {
        const before = beforeLearned[key]
        const after = baseParams[key]
        if (Math.abs(after - before) > 0.001) {
          paramDeltas.push({
            param: key,
            before,
            after,
            delta: after - before,
            reason: 'learned from feedback'
          })
        }
      }
    }
  }

  // Apply user overrides last (these take absolute precedence)
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined && value !== null) {
        const k = key as keyof AutoTuneParams
        const before = baseParams[k]
        ;(baseParams as any)[key] = value

        paramDeltas.push({
          param: k,
          before,
          after: value as number,
          delta: (value as number) - before,
          reason: 'manual override'
        })
      }
    }
  }

  // Enforce valid ranges
  const finalParams = applyBounds(baseParams)

  let reasoning = generateReasoning(
    strategy,
    detectedContext,
    confidence,
    convLength
  )

  if (learnedNote) {
    reasoning += ` | ${learnedNote}`
  }

  return {
    params: finalParams,
    detectedContext,
    confidence,
    reasoning,
    // Transparency data
    contextScores,
    patternMatches,
    paramDeltas,
    baselineParams
  }
}

/**
 * Get the display label for a context type.
 */
export function getContextLabel(context: ContextType): string {
  const labels: Record<ContextType, string> = {
    code: 'CODE',
    creative: 'CREATIVE',
    analytical: 'ANALYTICAL',
    conversational: 'CHAT',
    chaotic: 'CHAOS'
  }
  return labels[context]
}

/**
 * Get the display label for a strategy.
 */
export function getStrategyLabel(strategy: AutoTuneStrategy): string {
  const labels: Record<AutoTuneStrategy, string> = {
    precise: 'PRECISE',
    balanced: 'BALANCED',
    creative: 'CREATIVE',
    chaotic: 'CHAOTIC',
    adaptive: 'ADAPTIVE'
  }
  return labels[strategy]
}

/**
 * Get a short description for each strategy.
 */
export function getStrategyDescription(strategy: AutoTuneStrategy): string {
  const descriptions: Record<AutoTuneStrategy, string> = {
    precise: 'Low temperature, tight sampling. Optimal for code, math, and factual queries.',
    balanced: 'Well-rounded defaults. Good for general use.',
    creative: 'High temperature, diverse sampling. Ideal for writing, brainstorming, roleplay.',
    chaotic: 'Maximum entropy. Unpredictable, wild outputs. Use at your own risk.',
    adaptive: 'Analyzes your message context and automatically morphs between profiles.'
  }
  return descriptions[strategy]
}

/**
 * Parameter metadata for UI display.
 */
export const PARAM_META: Record<keyof AutoTuneParams, {
  label: string
  short: string
  min: number
  max: number
  step: number
  description: string
}> = {
  temperature: {
    label: 'Temperature',
    short: 'TEMP',
    min: 0.0,
    max: 2.0,
    step: 0.05,
    description: 'Controls randomness. Lower = more deterministic, higher = more creative.'
  },
  top_p: {
    label: 'Top P',
    short: 'TOP-P',
    min: 0.0,
    max: 1.0,
    step: 0.05,
    description: 'Nucleus sampling. Considers tokens within this cumulative probability.'
  },
  top_k: {
    label: 'Top K',
    short: 'TOP-K',
    min: 1,
    max: 100,
    step: 1,
    description: 'Limits token selection to the top K most likely tokens.'
  },
  frequency_penalty: {
    label: 'Frequency Penalty',
    short: 'FREQ',
    min: -2.0,
    max: 2.0,
    step: 0.05,
    description: 'Penalizes tokens based on how often they appear. Reduces repetition.'
  },
  presence_penalty: {
    label: 'Presence Penalty',
    short: 'PRES',
    min: -2.0,
    max: 2.0,
    step: 0.05,
    description: 'Penalizes tokens that have already appeared. Encourages new topics.'
  },
  repetition_penalty: {
    label: 'Repetition Penalty',
    short: 'REP',
    min: 0.0,
    max: 2.0,
    step: 0.05,
    description: 'Multiplicative penalty on repeated tokens. 1.0 = no penalty.'
  }
}
