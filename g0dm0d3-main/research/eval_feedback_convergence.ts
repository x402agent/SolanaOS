/**
 * Feedback Loop Convergence Simulation
 *
 * Simulates synthetic users with known parameter preferences to measure:
 * - Convergence speed (how many ratings to approach target)
 * - Stability under noisy ratings
 * - EMA alpha sensitivity analysis
 * - Cold-start behavior (MIN_SAMPLES_TO_APPLY threshold)
 */

import {
  createInitialFeedbackState,
  processFeedback,
  applyLearnedAdjustments,
  computeHeuristics,
  type FeedbackRecord,
  type FeedbackState,
} from '../src/lib/autotune-feedback'
import type { AutoTuneParams, ContextType } from '../src/lib/autotune'

// ── Synthetic User Profiles ──────────────────────────────────────────

interface SyntheticUser {
  name: string
  contextType: ContextType
  preferredParams: AutoTuneParams  // what they "like"
  dislikedParams: AutoTuneParams   // what they "dislike"
}

const USERS: SyntheticUser[] = [
  {
    name: 'CodePrecisionist',
    contextType: 'code',
    preferredParams: { temperature: 0.1, top_p: 0.75, top_k: 20, frequency_penalty: 0.1, presence_penalty: 0.0, repetition_penalty: 1.0 },
    dislikedParams: { temperature: 1.0, top_p: 0.95, top_k: 80, frequency_penalty: 0.5, presence_penalty: 0.5, repetition_penalty: 1.3 },
  },
  {
    name: 'CreativeWriter',
    contextType: 'creative',
    preferredParams: { temperature: 1.3, top_p: 0.98, top_k: 90, frequency_penalty: 0.6, presence_penalty: 0.8, repetition_penalty: 1.25 },
    dislikedParams: { temperature: 0.3, top_p: 0.8, top_k: 30, frequency_penalty: 0.1, presence_penalty: 0.0, repetition_penalty: 1.0 },
  },
  {
    name: 'DataAnalyst',
    contextType: 'analytical',
    preferredParams: { temperature: 0.3, top_p: 0.85, top_k: 35, frequency_penalty: 0.15, presence_penalty: 0.1, repetition_penalty: 1.05 },
    dislikedParams: { temperature: 1.2, top_p: 0.95, top_k: 85, frequency_penalty: 0.7, presence_penalty: 0.7, repetition_penalty: 1.2 },
  },
  {
    name: 'CasualChatter',
    contextType: 'conversational',
    preferredParams: { temperature: 0.8, top_p: 0.92, top_k: 55, frequency_penalty: 0.05, presence_penalty: 0.05, repetition_penalty: 1.0 },
    dislikedParams: { temperature: 0.2, top_p: 0.7, top_k: 20, frequency_penalty: 0.5, presence_penalty: 0.3, repetition_penalty: 1.2 },
  },
  {
    name: 'ChaosAgent',
    contextType: 'chaotic',
    preferredParams: { temperature: 1.8, top_p: 0.99, top_k: 100, frequency_penalty: 0.9, presence_penalty: 0.95, repetition_penalty: 1.35 },
    dislikedParams: { temperature: 0.5, top_p: 0.85, top_k: 40, frequency_penalty: 0.2, presence_penalty: 0.1, repetition_penalty: 1.05 },
  },
]

// ── Simulation Engine ────────────────────────────────────────────────

const NEUTRAL_PARAMS: AutoTuneParams = {
  temperature: 0.7, top_p: 0.9, top_k: 50,
  frequency_penalty: 0.2, presence_penalty: 0.2, repetition_penalty: 1.1,
}

function paramDistance(a: AutoTuneParams, b: AutoTuneParams): number {
  // Normalized L2 distance across all 6 parameters
  const diffs = [
    (a.temperature - b.temperature) / 2.0,      // range 0-2
    (a.top_p - b.top_p) / 1.0,                   // range 0-1
    (a.top_k - b.top_k) / 100,                   // range 1-100
    (a.frequency_penalty - b.frequency_penalty) / 4.0,  // range -2 to 2
    (a.presence_penalty - b.presence_penalty) / 4.0,
    (a.repetition_penalty - b.repetition_penalty) / 2.0,
  ]
  return Math.sqrt(diffs.reduce((sum, d) => sum + d * d, 0) / diffs.length)
}

function generateFakeResponse(): string {
  // Generate a realistic-ish response for heuristics computation
  const sentences = [
    'The implementation uses a modular architecture.',
    'Each component is independently testable and composable.',
    'Performance characteristics depend on the input distribution.',
    'The system processes requests in constant time per token.',
    'Error handling follows the fail-fast principle.',
    'State management is handled through immutable data structures.',
    'The pipeline supports both synchronous and asynchronous execution.',
  ]
  const count = 3 + Math.floor(Math.random() * 5)
  return Array.from({ length: count }, () =>
    sentences[Math.floor(Math.random() * sentences.length)]
  ).join(' ')
}

interface ConvergenceTrace {
  step: number
  distanceToPreferred: number
  distanceToDisliked: number
  weight: number
  adjustmentsApplied: boolean
}

function simulateUser(
  user: SyntheticUser,
  numRatings: number,
  noiseRate: number = 0,  // fraction of ratings that are flipped
): ConvergenceTrace[] {
  let state = createInitialFeedbackState()
  const traces: ConvergenceTrace[] = []

  for (let i = 0; i < numRatings; i++) {
    // Alternate: positive rating with preferred params, negative with disliked
    const isPositive = i % 2 === 0
    const rating: 1 | -1 = isPositive ? 1 : -1

    // Apply noise: flip some ratings
    const actualRating = Math.random() < noiseRate ? (rating === 1 ? -1 : 1) as 1 | -1 : rating

    const params = isPositive ? { ...user.preferredParams } : { ...user.dislikedParams }
    const heuristics = computeHeuristics(generateFakeResponse())

    const record: FeedbackRecord = {
      messageId: `msg-${i}`,
      timestamp: Date.now() + i * 1000,
      contextType: user.contextType,
      model: 'test-model',
      persona: 'test',
      params,
      rating: actualRating,
      heuristics,
    }

    state = processFeedback(state, record)

    // Check what adjustments would be applied
    const adjustResult = applyLearnedAdjustments(
      NEUTRAL_PARAMS,
      user.contextType,
      state.learnedProfiles
    )

    const distToPreferred = paramDistance(adjustResult.params, user.preferredParams)
    const distToDisliked = paramDistance(adjustResult.params, user.dislikedParams)

    // Extract weight from the note
    const weightMatch = adjustResult.note.match(/(\d+)% weight/)
    const weight = weightMatch ? parseInt(weightMatch[1]) / 100 : 0

    traces.push({
      step: i + 1,
      distanceToPreferred: distToPreferred,
      distanceToDisliked: distToDisliked,
      weight,
      adjustmentsApplied: adjustResult.applied,
    })
  }

  return traces
}

// ── Run Experiments ──────────────────────────────────────────────────

console.log('=== Feedback Loop Convergence Simulation ===\n')

// Experiment 1: Basic convergence per user
console.log('── Experiment 1: Convergence per User Profile (50 ratings, 0% noise) ──\n')

const NUM_RATINGS = 50

for (const user of USERS) {
  const traces = simulateUser(user, NUM_RATINGS, 0)

  const initial = traces[0]
  const afterColdStart = traces.find(t => t.adjustmentsApplied)
  const final = traces[traces.length - 1]
  const midpoint = traces[Math.floor(traces.length / 2)]

  console.log(`${user.name} (${user.contextType}):`)
  console.log(`  Cold-start activates at: step ${afterColdStart?.step || 'never'}`)
  console.log(`  Distance to preferred: start=${initial.distanceToPreferred.toFixed(4)}, mid=${midpoint.distanceToPreferred.toFixed(4)}, end=${final.distanceToPreferred.toFixed(4)}`)
  console.log(`  Distance to disliked:  start=${initial.distanceToDisliked.toFixed(4)}, mid=${midpoint.distanceToDisliked.toFixed(4)}, end=${final.distanceToDisliked.toFixed(4)}`)
  console.log(`  Improvement (pref): ${((1 - final.distanceToPreferred / initial.distanceToPreferred) * 100).toFixed(1)}%`)
  console.log(`  Final weight: ${(final.weight * 100).toFixed(0)}%`)
  console.log()
}

// Experiment 2: Noise robustness
console.log('── Experiment 2: Noise Robustness (50 ratings per noise level) ──\n')

const NOISE_LEVELS = [0, 0.1, 0.2, 0.3, 0.4, 0.5]
const testUser = USERS[0] // CodePrecisionist

console.log(`User: ${testUser.name} (${testUser.contextType})`)
console.log('Noise Rate | Final Dist to Pref | Final Dist to Disliked | Improvement')
console.log('───────────|────────────────────|────────────────────────|───────────')

const noiseResults: Array<{ noise: number; distPref: number; distDisliked: number; improvement: number }> = []

for (const noise of NOISE_LEVELS) {
  // Average over 5 runs to smooth randomness
  let sumPref = 0, sumDisliked = 0
  const RUNS = 5
  let baseline = 0

  for (let r = 0; r < RUNS; r++) {
    const traces = simulateUser(testUser, NUM_RATINGS, noise)
    sumPref += traces[traces.length - 1].distanceToPreferred
    sumDisliked += traces[traces.length - 1].distanceToDisliked
    if (baseline === 0) baseline = traces[0].distanceToPreferred
  }

  const avgPref = sumPref / RUNS
  const avgDisliked = sumDisliked / RUNS
  const improvement = (1 - avgPref / baseline) * 100

  noiseResults.push({ noise, distPref: avgPref, distDisliked: avgDisliked, improvement })

  console.log(
    `${(noise * 100).toFixed(0).padStart(8)}%  | ${avgPref.toFixed(4).padStart(18)} | ${avgDisliked.toFixed(4).padStart(22)} | ${improvement.toFixed(1).padStart(9)}%`
  )
}

// Experiment 3: Convergence speed
console.log('\n── Experiment 3: Convergence Speed (steps to reach 50%/75%/90% of max improvement) ──\n')

for (const user of USERS) {
  const traces = simulateUser(user, 100, 0)
  const initialDist = traces[0].distanceToPreferred
  const finalDist = traces[traces.length - 1].distanceToPreferred
  const maxImprovement = initialDist - finalDist

  const thresholds = [0.5, 0.75, 0.9]
  const steps: number[] = []

  for (const thresh of thresholds) {
    const target = initialDist - maxImprovement * thresh
    const step = traces.findIndex(t => t.distanceToPreferred <= target)
    steps.push(step === -1 ? -1 : step + 1)
  }

  console.log(`${user.name.padEnd(20)}: 50% at step ${String(steps[0]).padStart(3)}, 75% at step ${String(steps[1]).padStart(3)}, 90% at step ${String(steps[2]).padStart(3)}`)
}

// Experiment 4: Weight scaling behavior
console.log('\n── Experiment 4: Weight Scaling (how weight grows with sample count) ──\n')
console.log('Samples | Weight | Effective Influence')
console.log('────────|────────|───────────────────')

const weightUser = USERS[0]
const weightTraces = simulateUser(weightUser, 40, 0)
const samplePoints = [1, 2, 3, 5, 10, 15, 20, 25, 30, 40]

for (const s of samplePoints) {
  if (s <= weightTraces.length) {
    const trace = weightTraces[s - 1]
    console.log(`${String(s).padStart(7)} | ${(trace.weight * 100).toFixed(0).padStart(5)}% | ${trace.adjustmentsApplied ? 'Active' : 'Inactive (cold start)'}`)
  }
}

// Summary JSON
console.log('\n── JSON Summary ──')
const summary = {
  experiment1_convergence: USERS.map(user => {
    const traces = simulateUser(user, NUM_RATINGS, 0)
    const initial = traces[0]
    const final = traces[traces.length - 1]
    return {
      user: user.name,
      context: user.contextType,
      initial_distance: initial.distanceToPreferred,
      final_distance: final.distanceToPreferred,
      improvement_pct: ((1 - final.distanceToPreferred / initial.distanceToPreferred) * 100),
      cold_start_step: traces.findIndex(t => t.adjustmentsApplied) + 1,
    }
  }),
  experiment2_noise: noiseResults,
  experiment3_speed: USERS.map(user => {
    const traces = simulateUser(user, 100, 0)
    const initialDist = traces[0].distanceToPreferred
    const finalDist = traces[traces.length - 1].distanceToPreferred
    const maxImpr = initialDist - finalDist
    return {
      user: user.name,
      steps_to_50pct: (traces.findIndex(t => t.distanceToPreferred <= initialDist - maxImpr * 0.5) + 1) || -1,
      steps_to_75pct: (traces.findIndex(t => t.distanceToPreferred <= initialDist - maxImpr * 0.75) + 1) || -1,
      steps_to_90pct: (traces.findIndex(t => t.distanceToPreferred <= initialDist - maxImpr * 0.9) + 1) || -1,
    }
  }),
}
console.log(JSON.stringify(summary, null, 2))
