/**
 * AutoTune API Routes
 *
 * POST /v1/autotune/analyze
 * Analyzes a message (+ optional conversation history) and returns
 * optimal LLM parameters with full transparency into the decision.
 */

import { Router } from 'express'
import {
  computeAutoTuneParams,
  type AutoTuneStrategy,
} from '../../src/lib/autotune'
import type { ContextType } from '../../src/lib/autotune'
import type { LearnedProfile } from '../../src/lib/autotune-feedback'

export const autotuneRoutes = Router()

// In-memory learned profiles shared across requests (per-session learning)
let sharedLearnedProfiles: Record<ContextType, LearnedProfile> | undefined

/** Allow feedback route to update shared profiles */
export function updateSharedProfiles(profiles: Record<ContextType, LearnedProfile>) {
  sharedLearnedProfiles = profiles
}
export function getSharedProfiles() {
  return sharedLearnedProfiles
}

autotuneRoutes.post('/analyze', (req, res) => {
  try {
    const {
      message,
      conversation_history = [],
      strategy = 'adaptive',
      overrides,
    } = req.body

    // Validate
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message (string) is required' })
      return
    }

    const validStrategies: AutoTuneStrategy[] = ['precise', 'balanced', 'creative', 'chaotic', 'adaptive']
    if (!validStrategies.includes(strategy)) {
      res.status(400).json({
        error: `Invalid strategy. Must be one of: ${validStrategies.join(', ')}`,
      })
      return
    }

    // Normalize conversation history
    const history = Array.isArray(conversation_history)
      ? conversation_history.map((m: any) => ({
          role: String(m.role || 'user'),
          content: String(m.content || ''),
        }))
      : []

    const result = computeAutoTuneParams({
      strategy,
      message,
      conversationHistory: history,
      overrides,
      learnedProfiles: sharedLearnedProfiles,
    })

    res.json({
      params: result.params,
      detected_context: result.detectedContext,
      confidence: result.confidence,
      reasoning: result.reasoning,
      context_scores: result.contextScores,
      pattern_matches: result.patternMatches,
      param_deltas: result.paramDeltas.map(d => ({
        param: d.param,
        before: d.before,
        after: d.after,
        delta: d.delta,
        reason: d.reason,
      })),
      baseline_params: result.baselineParams,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
