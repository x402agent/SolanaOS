/**
 * AutoTune Feedback Loop Engine
 *
 * Collects quality signals (user ratings + automated heuristics) after each response,
 * stores them alongside the parameters that produced them, and uses Exponential Moving
 * Average to learn optimal parameter adjustments per context type over time.
 *
 * The learned adjustments blend into AutoTune's parameter selection — more feedback data
 * means more influence, capped at 50% weight so base profiles remain the foundation.
 */

import type { AutoTuneParams, ContextType } from './autotune'

// ── Types ────────────────────────────────────────────────────────────

export interface ResponseHeuristics {
  responseLength: number
  repetitionScore: number      // 0.0 = no repetition, 1.0 = very repetitive
  averageSentenceLength: number
  vocabularyDiversity: number  // unique words / total words ratio
}

export interface FeedbackRecord {
  messageId: string
  timestamp: number
  contextType: ContextType
  model: string
  persona: string
  params: AutoTuneParams
  rating: 1 | -1             // thumbs up / thumbs down
  heuristics: ResponseHeuristics
}

export interface LearnedProfile {
  contextType: ContextType
  sampleCount: number
  positiveCount: number
  negativeCount: number
  positiveParams: AutoTuneParams   // EMA of params from upvoted responses
  negativeParams: AutoTuneParams   // EMA of params from downvoted responses
  adjustments: Partial<AutoTuneParams>  // computed delta to apply
  lastUpdated: number
}

export interface FeedbackState {
  history: FeedbackRecord[]
  learnedProfiles: Record<ContextType, LearnedProfile>
}

// ── Constants ────────────────────────────────────────────────────────

const EMA_ALPHA = 0.3          // Weight for new observations (higher = faster learning)
const MAX_HISTORY = 500        // Cap feedback history to prevent unbounded growth
const MIN_SAMPLES_TO_APPLY = 3 // Minimum feedback samples before learned adjustments kick in
const MAX_LEARNED_WEIGHT = 0.5 // Maximum influence of learned adjustments (50%)
const SAMPLES_FOR_MAX_WEIGHT = 20 // Samples needed to reach maximum weight

// Neutral starting params (middle of each range, used to initialize EMA)
const NEUTRAL_PARAMS: AutoTuneParams = {
  temperature: 0.7,
  top_p: 0.9,
  top_k: 50,
  frequency_penalty: 0.2,
  presence_penalty: 0.2,
  repetition_penalty: 1.1
}

// ── Heuristics Engine ────────────────────────────────────────────────

/**
 * Compute automated quality heuristics for a response.
 * These supplement user ratings to provide signal even without explicit feedback.
 */
export function computeHeuristics(response: string): ResponseHeuristics {
  const responseLength = response.length

  // Repetition score: check for repeated n-grams
  const repetitionScore = computeRepetitionScore(response)

  // Average sentence length
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const averageSentenceLength = sentences.length > 0
    ? sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length
    : 0

  // Vocabulary diversity: unique words / total words
  const words = response.toLowerCase().split(/\s+/).filter(w => w.length > 0)
  const uniqueWords = new Set(words)
  const vocabularyDiversity = words.length > 0 ? uniqueWords.size / words.length : 1

  return {
    responseLength,
    repetitionScore,
    averageSentenceLength,
    vocabularyDiversity
  }
}

/**
 * Detect repetition by checking for repeated 3-gram sequences.
 * Returns 0.0 (no repetition) to 1.0 (extremely repetitive).
 */
function computeRepetitionScore(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0)
  if (words.length < 6) return 0

  const trigrams = new Map<string, number>()
  let totalTrigrams = 0

  for (let i = 0; i <= words.length - 3; i++) {
    const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`
    trigrams.set(trigram, (trigrams.get(trigram) || 0) + 1)
    totalTrigrams++
  }

  if (totalTrigrams === 0) return 0

  // Count trigrams that appear more than once
  let repeatedCount = 0
  trigrams.forEach((count) => {
    if (count > 1) {
      repeatedCount += count - 1
    }
  })

  return Math.min(repeatedCount / totalTrigrams, 1.0)
}

// ── Learning Engine ──────────────────────────────────────────────────

/**
 * Create initial empty feedback state.
 */
export function createInitialFeedbackState(): FeedbackState {
  const contexts: ContextType[] = ['code', 'creative', 'analytical', 'conversational', 'chaotic']

  const learnedProfiles: Record<string, LearnedProfile> = {}
  for (const ctx of contexts) {
    learnedProfiles[ctx] = {
      contextType: ctx,
      sampleCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      positiveParams: { ...NEUTRAL_PARAMS },
      negativeParams: { ...NEUTRAL_PARAMS },
      adjustments: {},
      lastUpdated: 0
    }
  }

  return {
    history: [],
    learnedProfiles: learnedProfiles as Record<ContextType, LearnedProfile>
  }
}

/**
 * Process a new feedback record and update learned profiles using EMA.
 * Returns the updated feedback state.
 */
export function processFeedback(
  state: FeedbackState,
  record: FeedbackRecord
): FeedbackState {
  // Add to history (capped)
  const newHistory = [...state.history, record]
  if (newHistory.length > MAX_HISTORY) {
    newHistory.splice(0, newHistory.length - MAX_HISTORY)
  }

  // Update the learned profile for this context type
  const profile = { ...state.learnedProfiles[record.contextType] }
  profile.sampleCount++
  profile.lastUpdated = Date.now()

  if (record.rating === 1) {
    // Positive feedback: update positive EMA
    profile.positiveCount++
    profile.positiveParams = emaUpdate(profile.positiveParams, record.params, EMA_ALPHA)
  } else {
    // Negative feedback: update negative EMA
    profile.negativeCount++
    profile.negativeParams = emaUpdate(profile.negativeParams, record.params, EMA_ALPHA)
  }

  // Recompute adjustments: direction from negative toward positive
  profile.adjustments = computeAdjustments(profile)

  const newProfiles = {
    ...state.learnedProfiles,
    [record.contextType]: profile
  }

  return {
    history: newHistory,
    learnedProfiles: newProfiles
  }
}

/**
 * EMA update: new_value = (1 - alpha) * old_value + alpha * observation
 */
function emaUpdate(
  current: AutoTuneParams,
  observation: AutoTuneParams,
  alpha: number
): AutoTuneParams {
  const inv = 1 - alpha
  return {
    temperature: current.temperature * inv + observation.temperature * alpha,
    top_p: current.top_p * inv + observation.top_p * alpha,
    top_k: Math.round(current.top_k * inv + observation.top_k * alpha),
    frequency_penalty: current.frequency_penalty * inv + observation.frequency_penalty * alpha,
    presence_penalty: current.presence_penalty * inv + observation.presence_penalty * alpha,
    repetition_penalty: current.repetition_penalty * inv + observation.repetition_penalty * alpha
  }
}

/**
 * Compute parameter adjustments based on the difference between
 * positively-rated and negatively-rated parameter EMAs.
 *
 * The idea: if upvoted responses used temp=0.3 and downvoted used temp=0.8,
 * the adjustment nudges temperature downward.
 */
function computeAdjustments(profile: LearnedProfile): Partial<AutoTuneParams> {
  // Need both positive and negative samples to compute a meaningful delta
  if (profile.positiveCount < 1 || profile.negativeCount < 1) {
    // With only positive data, use the delta from neutral as a mild nudge
    if (profile.positiveCount >= MIN_SAMPLES_TO_APPLY) {
      return computeDeltaFromNeutral(profile.positiveParams, 0.5)
    }
    return {}
  }

  const adj: Partial<AutoTuneParams> = {}
  const keys: (keyof AutoTuneParams)[] = [
    'temperature', 'top_p', 'top_k',
    'frequency_penalty', 'presence_penalty', 'repetition_penalty'
  ]

  for (const key of keys) {
    const posDelta = profile.positiveParams[key] - NEUTRAL_PARAMS[key]
    const negDelta = profile.negativeParams[key] - NEUTRAL_PARAMS[key]
    // Push toward positive, away from negative
    const adjustment = (posDelta - negDelta) * 0.5
    // Only include non-trivial adjustments
    if (Math.abs(adjustment) > 0.01) {
      adj[key] = adjustment
    }
  }

  return adj
}

/**
 * Compute a mild adjustment from neutral toward the positively-rated average.
 */
function computeDeltaFromNeutral(
  positiveParams: AutoTuneParams,
  scale: number
): Partial<AutoTuneParams> {
  const adj: Partial<AutoTuneParams> = {}
  const keys: (keyof AutoTuneParams)[] = [
    'temperature', 'top_p', 'top_k',
    'frequency_penalty', 'presence_penalty', 'repetition_penalty'
  ]

  for (const key of keys) {
    const delta = (positiveParams[key] - NEUTRAL_PARAMS[key]) * scale
    if (Math.abs(delta) > 0.01) {
      adj[key] = delta
    }
  }

  return adj
}

// ── Integration with AutoTune ────────────────────────────────────────

/**
 * Apply learned adjustments to a base parameter set.
 * Weight is determined by how much feedback data exists for this context.
 *
 * Returns the adjusted params and a note about what was applied.
 */
export function applyLearnedAdjustments(
  baseParams: AutoTuneParams,
  contextType: ContextType,
  learnedProfiles: Record<ContextType, LearnedProfile>
): { params: AutoTuneParams; applied: boolean; note: string } {
  const profile = learnedProfiles[contextType]

  if (!profile || profile.sampleCount < MIN_SAMPLES_TO_APPLY || Object.keys(profile.adjustments).length === 0) {
    return { params: baseParams, applied: false, note: '' }
  }

  // Weight scales from 0 to MAX_LEARNED_WEIGHT based on sample count
  const weight = Math.min(
    (profile.sampleCount / SAMPLES_FOR_MAX_WEIGHT) * MAX_LEARNED_WEIGHT,
    MAX_LEARNED_WEIGHT
  )

  const adjusted = { ...baseParams }
  const appliedKeys: string[] = []

  for (const [key, delta] of Object.entries(profile.adjustments)) {
    const k = key as keyof AutoTuneParams
    if (delta !== undefined) {
      adjusted[k] = (adjusted[k] as number) + (delta as number) * weight
      appliedKeys.push(key)
    }
  }

  const note = `Learned: ${appliedKeys.length} params adjusted (${profile.sampleCount} samples, ${Math.round(weight * 100)}% weight)`

  return { params: adjusted, applied: true, note }
}

// ── Stats / Display Helpers ──────────────────────────────────────────

/**
 * Get summary stats for the feedback learning system.
 */
export function getFeedbackStats(state: FeedbackState): {
  totalFeedback: number
  positiveRate: number
  contextBreakdown: Record<ContextType, { total: number; positive: number; negative: number; hasLearned: boolean }>
  oldestRecord: number | null
  newestRecord: number | null
} {
  const contexts: ContextType[] = ['code', 'creative', 'analytical', 'conversational', 'chaotic']
  const totalFeedback = state.history.length
  const positiveCount = state.history.filter(r => r.rating === 1).length

  const contextBreakdown = {} as Record<ContextType, { total: number; positive: number; negative: number; hasLearned: boolean }>
  for (const ctx of contexts) {
    const profile = state.learnedProfiles[ctx]
    contextBreakdown[ctx] = {
      total: profile.sampleCount,
      positive: profile.positiveCount,
      negative: profile.negativeCount,
      hasLearned: profile.sampleCount >= MIN_SAMPLES_TO_APPLY && Object.keys(profile.adjustments).length > 0
    }
  }

  return {
    totalFeedback,
    positiveRate: totalFeedback > 0 ? positiveCount / totalFeedback : 0,
    contextBreakdown,
    oldestRecord: state.history.length > 0 ? state.history[0].timestamp : null,
    newestRecord: state.history.length > 0 ? state.history[state.history.length - 1].timestamp : null
  }
}
