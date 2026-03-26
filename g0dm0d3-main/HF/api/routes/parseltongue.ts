/**
 * Parseltongue API Routes
 *
 * POST /v1/parseltongue/encode  — Obfuscate trigger words in text
 * POST /v1/parseltongue/detect  — Detect trigger words without transforming
 */

import { Router } from 'express'
import {
  applyParseltongue,
  detectTriggers,
  getAvailableTechniques,
  type ObfuscationTechnique,
  type ParseltongueConfig,
} from '../../src/lib/parseltongue'

export const parseltongueRoutes = Router()

const VALID_TECHNIQUES: ObfuscationTechnique[] = [
  'leetspeak', 'unicode', 'zwj', 'mixedcase', 'phonetic', 'random',
]
const VALID_INTENSITIES = ['light', 'medium', 'heavy'] as const

parseltongueRoutes.post('/encode', (req, res) => {
  try {
    const {
      text,
      technique = 'leetspeak',
      intensity = 'medium',
      custom_triggers = [],
    } = req.body

    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'text (string) is required' })
      return
    }

    if (!VALID_TECHNIQUES.includes(technique)) {
      res.status(400).json({
        error: `Invalid technique. Must be one of: ${VALID_TECHNIQUES.join(', ')}`,
      })
      return
    }

    if (!VALID_INTENSITIES.includes(intensity)) {
      res.status(400).json({
        error: `Invalid intensity. Must be one of: ${VALID_INTENSITIES.join(', ')}`,
      })
      return
    }

    const config: ParseltongueConfig = {
      enabled: true,
      technique,
      intensity,
      customTriggers: Array.isArray(custom_triggers) ? custom_triggers : [],
    }

    const result = applyParseltongue(text, config)

    res.json({
      original_text: result.originalText,
      transformed_text: result.transformedText,
      triggers_found: result.triggersFound,
      technique_used: result.techniqueUsed,
      transformations: result.transformations,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

parseltongueRoutes.post('/detect', (req, res) => {
  try {
    const { text, custom_triggers = [] } = req.body

    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'text (string) is required' })
      return
    }

    const triggers = detectTriggers(
      text,
      Array.isArray(custom_triggers) ? custom_triggers : []
    )

    res.json({
      text,
      triggers_found: triggers,
      count: triggers.length,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

parseltongueRoutes.get('/techniques', (_req, res) => {
  res.json({ techniques: getAvailableTechniques() })
})
