/**
 * STM (Semantic Transformation Module) API Routes
 *
 * POST /v1/transform — Apply one or more STM modules to text
 */

import { Router } from 'express'
import {
  allModules,
  applySTMs,
  type STMModule,
} from '../../src/stm/modules'

export const transformRoutes = Router()

const AVAILABLE_MODULE_IDS = allModules.map(m => m.id)

transformRoutes.post('/', (req, res) => {
  try {
    const { text, modules: requestedModules } = req.body

    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'text (string) is required' })
      return
    }

    // Default: apply all modules
    let moduleIds: string[] = AVAILABLE_MODULE_IDS
    if (Array.isArray(requestedModules)) {
      // Validate module IDs
      const invalid = requestedModules.filter((id: string) => !AVAILABLE_MODULE_IDS.includes(id))
      if (invalid.length > 0) {
        res.status(400).json({
          error: `Invalid module ID(s): ${invalid.join(', ')}. Available: ${AVAILABLE_MODULE_IDS.join(', ')}`,
        })
        return
      }
      moduleIds = requestedModules
    }

    // Create module copies with enabled set based on request
    const enabledModules: STMModule[] = allModules.map(m => ({
      ...m,
      enabled: moduleIds.includes(m.id),
    }))

    const result = applySTMs(text, enabledModules)

    res.json({
      original_text: text,
      transformed_text: result,
      modules_applied: moduleIds,
      available_modules: allModules.map(m => ({
        id: m.id,
        name: m.name,
        description: m.description,
      })),
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

transformRoutes.get('/modules', (_req, res) => {
  res.json({
    modules: allModules.map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      version: m.version,
      author: m.author,
    })),
  })
})
