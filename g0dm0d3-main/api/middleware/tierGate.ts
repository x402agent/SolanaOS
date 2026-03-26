/**
 * Tier Gate Middleware
 *
 * Creates Express middleware that blocks requests from tiers
 * that don't have the required access level.
 *
 * Usage:
 *   app.use('/v1/research', apiKeyAuth, tierGate('research:read'), researchRoutes)
 *   app.use('/v1/dataset',  apiKeyAuth, tierGate('dataset:export'), datasetRoutes)
 */

import type { Request, Response, NextFunction } from 'express'
import type { Tier, TierConfig } from '../lib/tiers'
import { getTierConfig, TIER_CONFIGS } from '../lib/tiers'

type GateCheck =
  | 'research:read'
  | 'research:full'
  | 'dataset:export'
  | 'dataset:jsonl'
  | 'flush'
  | 'metadata:events'
  | 'corpus:download'
  | `ultraplinian:${'fast' | 'standard' | 'smart' | 'power' | 'ultra'}`

/**
 * Evaluate whether a tier config passes a given gate check.
 */
function passesGate(config: TierConfig, gate: GateCheck): boolean {
  switch (gate) {
    case 'research:read':
      return config.researchAccess === 'read' || config.researchAccess === 'full'
    case 'research:full':
      return config.researchAccess === 'full'
    case 'dataset:export':
      return config.datasetExportFormats.length > 0
    case 'dataset:jsonl':
      return config.datasetExportFormats.includes('jsonl')
    case 'flush':
      return config.canFlush
    case 'metadata:events':
      return config.canAccessMetadataEvents
    case 'corpus:download':
      return config.canDownloadCorpus
    case 'ultraplinian:fast':
      return config.ultraplinianTiers.includes('fast')
    case 'ultraplinian:standard':
      return config.ultraplinianTiers.includes('standard')
    case 'ultraplinian:smart':
      return config.ultraplinianTiers.includes('smart')
    case 'ultraplinian:power':
      return config.ultraplinianTiers.includes('power')
    case 'ultraplinian:ultra':
      return config.ultraplinianTiers.includes('ultra')
    default:
      return false
  }
}

/**
 * Find the minimum tier that passes the gate (for upgrade messaging).
 */
function minimumTierFor(gate: GateCheck): Tier {
  const order: Tier[] = ['free', 'pro', 'enterprise']
  for (const tier of order) {
    if (passesGate(TIER_CONFIGS[tier], gate)) return tier
  }
  return 'enterprise'
}

/**
 * Create middleware that enforces a tier gate.
 */
export function tierGate(gate: GateCheck) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const tier: Tier = req.tier || 'free'
    const config = getTierConfig(tier)

    if (!passesGate(config, gate)) {
      const required = minimumTierFor(gate)
      res.status(403).json({
        error: 'Upgrade required',
        message: `This feature requires a ${required} plan or higher.`,
        current_tier: tier,
        required_tier: required,
        feature: gate,
        upgrade: 'Contact sales or set GODMODE_TIER_KEYS to upgrade your API key tier.',
      })
      return
    }

    next()
  }
}
