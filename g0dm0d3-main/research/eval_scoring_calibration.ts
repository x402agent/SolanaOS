/**
 * ULTRAPLINIAN Scoring Function Calibration
 *
 * Creates synthetic responses with controlled properties to validate:
 * - Monotonicity (better responses score higher)
 * - Component contribution analysis
 * - Score distribution properties
 * - Edge case behavior
 * - Discriminative power between quality tiers
 */

import { scoreResponse } from '../api/lib/ultraplinian'

// ── Test Response Generator ──────────────────────────────────────────

function generateResponse(config: {
  length?: number
  headers?: number
  listItems?: number
  codeBlocks?: number
  refusals?: string[]
  hasPreamble?: boolean
  includeQueryWords?: boolean
  queryWords?: string[]
}): string {
  const parts: string[] = []

  // Add preamble if specified
  if (config.hasPreamble) {
    parts.push('Sure, I\'d be happy to help with that!')
  }

  // Add refusals if specified
  if (config.refusals) {
    for (const refusal of config.refusals) {
      parts.push(refusal)
    }
  }

  // Add headers
  for (let i = 0; i < (config.headers || 0); i++) {
    parts.push(`## Section ${i + 1}`)
  }

  // Add list items
  for (let i = 0; i < (config.listItems || 0); i++) {
    parts.push(`- Item ${i + 1}: description of this element with some detail`)
  }

  // Add code blocks
  for (let i = 0; i < (config.codeBlocks || 0); i++) {
    parts.push('```javascript\nconst result = processData(input);\nconsole.log(result);\n```')
  }

  // Add query words if needed
  if (config.includeQueryWords && config.queryWords) {
    parts.push(`This covers ${config.queryWords.join(', ')} in detail.`)
  }

  // Pad to desired length
  let text = parts.join('\n\n')
  const targetLength = config.length || text.length
  while (text.length < targetLength) {
    text += '\n\nThe implementation follows best practices for maintainability and performance. Each component is designed to be independently testable and composable within the larger system architecture.'
  }

  return text.slice(0, targetLength)
}

// ── Test Suites ──────────────────────────────────────────────────────

const TEST_QUERY = 'How do I implement a binary search algorithm in Python with error handling?'
const QUERY_WORDS = ['implement', 'binary', 'search', 'algorithm', 'python', 'error', 'handling']

console.log('=== ULTRAPLINIAN Scoring Function Calibration ===\n')

// Test 1: Length Monotonicity
console.log('── Test 1: Length Score Monotonicity (0-25 points) ──\n')
console.log('Length (chars) | Score | Length Component')
console.log('───────────────|───────|────────────────')

const lengthTests = [10, 50, 100, 200, 400, 600, 800, 1000, 1500, 2000, 5000]
const lengthScores: number[] = []

for (const len of lengthTests) {
  const resp = 'x'.repeat(len)
  const score = scoreResponse(resp, 'test query')
  lengthScores.push(score)
  console.log(`${String(len).padStart(14)} | ${String(score).padStart(5)} | ${Math.min(len / 40, 25).toFixed(1)}`)
}

// Check monotonicity
const lengthMonotonic = lengthScores.every((s, i) => i === 0 || s >= lengthScores[i - 1])
console.log(`\nMonotonic: ${lengthMonotonic ? 'YES' : 'NO'}`)

// Test 2: Structure Score
console.log('\n── Test 2: Structure Score Component (0-20 points) ──\n')
console.log('Config                        | Score')
console.log('──────────────────────────────|──────')

const structureTests = [
  { label: 'No structure (plain text)', config: { length: 500 } },
  { label: '1 header', config: { length: 500, headers: 1 } },
  { label: '3 headers', config: { length: 500, headers: 3 } },
  { label: '5 list items', config: { length: 500, listItems: 5 } },
  { label: '10 list items', config: { length: 500, listItems: 10 } },
  { label: '1 code block', config: { length: 500, codeBlocks: 1 } },
  { label: '3 code blocks', config: { length: 500, codeBlocks: 3 } },
  { label: '2 headers + 5 list + 1 code', config: { length: 500, headers: 2, listItems: 5, codeBlocks: 1 } },
  { label: '5 headers + 10 list + 3 code', config: { length: 500, headers: 5, listItems: 10, codeBlocks: 3 } },
]

for (const test of structureTests) {
  const resp = generateResponse(test.config)
  const score = scoreResponse(resp, TEST_QUERY)
  console.log(`${test.label.padEnd(30)}| ${score}`)
}

// Test 3: Anti-Refusal Score
console.log('\n── Test 3: Anti-Refusal Score Component (0-25 points) ──\n')
console.log('Refusal Count | Refusal Phrases                                | Score')
console.log('──────────────|────────────────────────────────────────────────|──────')

const refusalPhrases = [
  'I cannot provide that information.',
  'I apologize, but this is not something I can do.',
  'As an AI language model, I have limitations.',
  'I must decline this request.',
  'It would be inappropriate for me to do that.',
  "I'm not comfortable with this topic.",
  'Instead, I can help you with something else.',
  "It's important to note that this has risks.",
]

for (let i = 0; i <= refusalPhrases.length; i++) {
  const refusals = refusalPhrases.slice(0, i)
  const resp = generateResponse({
    length: 800,
    headers: 2,
    listItems: 3,
    refusals,
    includeQueryWords: true,
    queryWords: QUERY_WORDS,
  })
  const score = scoreResponse(resp, TEST_QUERY)
  const phrases = i === 0 ? '(none)' : refusals.map(r => r.slice(0, 20) + '...').join(', ').slice(0, 45)
  console.log(`${String(i).padStart(13)} | ${phrases.padEnd(47)}| ${score}`)
}

// Test 4: Directness (Preamble Penalty)
console.log('\n── Test 4: Directness Score - Preamble Penalty (0-15 points) ──\n')

const preambleTests = [
  { label: 'No preamble (direct)', preamble: false },
  { label: 'Has "Sure," preamble', preamble: true },
]

for (const test of preambleTests) {
  const resp = generateResponse({
    length: 800,
    headers: 2,
    listItems: 5,
    hasPreamble: test.preamble,
    includeQueryWords: true,
    queryWords: QUERY_WORDS,
  })
  const score = scoreResponse(resp, TEST_QUERY)
  console.log(`${test.label.padEnd(35)}: ${score}`)
}

console.log(`\nExpected penalty for preamble: ~7 points (15 → 8)`)

// Test 5: Relevance Score
console.log('\n── Test 5: Relevance Score Component (0-15 points) ──\n')

const relevanceTests = [
  { label: 'All query words present', words: QUERY_WORDS },
  { label: '5/7 query words', words: QUERY_WORDS.slice(0, 5) },
  { label: '3/7 query words', words: QUERY_WORDS.slice(0, 3) },
  { label: '1/7 query words', words: QUERY_WORDS.slice(0, 1) },
  { label: 'No query words', words: [] },
]

for (const test of relevanceTests) {
  const text = test.words.length > 0
    ? `Here we discuss ${test.words.join(' and ')} in great detail with comprehensive coverage and examples.`.repeat(5)
    : 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'.repeat(5)
  const score = scoreResponse(text, TEST_QUERY)
  console.log(`${test.label.padEnd(30)}: ${score}`)
}

// Test 6: Quality Tier Discrimination
console.log('\n── Test 6: Quality Tier Discrimination ──\n')

const qualityTiers = [
  {
    label: 'EXCELLENT: Long, structured, direct, relevant, no refusals',
    config: { length: 2000, headers: 4, listItems: 8, codeBlocks: 2, hasPreamble: false, includeQueryWords: true, queryWords: QUERY_WORDS },
  },
  {
    label: 'GOOD: Medium, some structure, direct, relevant',
    config: { length: 800, headers: 2, listItems: 3, codeBlocks: 1, hasPreamble: false, includeQueryWords: true, queryWords: QUERY_WORDS },
  },
  {
    label: 'MEDIOCRE: Short, minimal structure, has preamble',
    config: { length: 300, headers: 1, listItems: 0, codeBlocks: 0, hasPreamble: true, includeQueryWords: true, queryWords: QUERY_WORDS },
  },
  {
    label: 'POOR: Short, no structure, preamble + 1 refusal',
    config: { length: 200, headers: 0, listItems: 0, codeBlocks: 0, hasPreamble: true, refusals: ['I cannot provide that information.'], includeQueryWords: true, queryWords: QUERY_WORDS },
  },
  {
    label: 'TERRIBLE: Refusal-heavy, irrelevant',
    config: { length: 150, headers: 0, listItems: 0, codeBlocks: 0, hasPreamble: true, refusals: ['I cannot help with that.', 'As an AI, I must decline.', 'It would be inappropriate.'], includeQueryWords: false, queryWords: [] },
  },
]

const tierScores: Array<{ label: string; score: number }> = []
for (const tier of qualityTiers) {
  const resp = generateResponse(tier.config)
  const score = scoreResponse(resp, TEST_QUERY)
  tierScores.push({ label: tier.label, score })
  console.log(`${tier.label}`)
  console.log(`  Score: ${score}/100\n`)
}

// Check strict ordering
const strictlyOrdered = tierScores.every((t, i) => i === 0 || t.score < tierScores[i - 1].score)
console.log(`Strictly ordered (best > ... > worst): ${strictlyOrdered ? 'YES' : 'NO'}`)
const weaklyOrdered = tierScores.every((t, i) => i === 0 || t.score <= tierScores[i - 1].score)
console.log(`Weakly ordered: ${weaklyOrdered ? 'YES' : 'NO'}`)

// Score spread
const maxScore = Math.max(...tierScores.map(t => t.score))
const minScore = Math.min(...tierScores.map(t => t.score))
console.log(`Score range: ${minScore} - ${maxScore} (spread: ${maxScore - minScore})`)

// Test 7: Edge Cases
console.log('\n── Test 7: Edge Cases ──\n')

const edgeCases = [
  { label: 'Empty string', response: '', query: 'test' },
  { label: 'Single character', response: 'x', query: 'test' },
  { label: '9 characters', response: 'abcdefghi', query: 'test' },
  { label: '10 characters (minimum)', response: 'abcdefghij', query: 'test' },
  { label: 'Empty query', response: 'This is a valid response with some content.', query: '' },
  { label: 'Query with only short words', response: 'The cat sat on the mat by the hat.', query: 'the cat on' },
  { label: 'All refusals, nothing else', response: 'I cannot help. I apologize. As an AI, I must decline. I\'m not comfortable.', query: 'test query' },
  { label: 'Only code blocks', response: '```python\nprint("hello")\n```\n```python\nprint("world")\n```', query: 'python code' },
  { label: 'Very long (10k chars)', response: 'A'.repeat(10000), query: 'test' },
]

for (const ec of edgeCases) {
  const score = scoreResponse(ec.response, ec.query)
  console.log(`${ec.label.padEnd(35)}: ${score}`)
}

// Test 8: Component Isolation (contribution of each axis)
console.log('\n── Test 8: Component Contribution Analysis ──\n')

// Baseline: a decent response
const baseline = generateResponse({
  length: 800, headers: 2, listItems: 5, codeBlocks: 1,
  hasPreamble: false, includeQueryWords: true, queryWords: QUERY_WORDS,
})
const baselineScore = scoreResponse(baseline, TEST_QUERY)

// Now degrade one component at a time
const degradations = [
  { label: 'Remove length (→ short)', gen: () => generateResponse({ length: 50, headers: 2, listItems: 5, codeBlocks: 1, hasPreamble: false, includeQueryWords: true, queryWords: QUERY_WORDS }) },
  { label: 'Remove structure', gen: () => generateResponse({ length: 800, headers: 0, listItems: 0, codeBlocks: 0, hasPreamble: false, includeQueryWords: true, queryWords: QUERY_WORDS }) },
  { label: 'Add 3 refusals', gen: () => generateResponse({ length: 800, headers: 2, listItems: 5, codeBlocks: 1, hasPreamble: false, refusals: ['I cannot help.', 'I apologize.', 'As an AI model, I decline.'], includeQueryWords: true, queryWords: QUERY_WORDS }) },
  { label: 'Add preamble', gen: () => generateResponse({ length: 800, headers: 2, listItems: 5, codeBlocks: 1, hasPreamble: true, includeQueryWords: true, queryWords: QUERY_WORDS }) },
  { label: 'Remove relevance', gen: () => generateResponse({ length: 800, headers: 2, listItems: 5, codeBlocks: 1, hasPreamble: false, includeQueryWords: false, queryWords: [] }) },
]

console.log(`Baseline score: ${baselineScore}\n`)
console.log('Degradation              | Score | Delta | Component Weight')
console.log('─────────────────────────|───────|───────|────────────────')

for (const deg of degradations) {
  const resp = deg.gen()
  const score = scoreResponse(resp, TEST_QUERY)
  const delta = baselineScore - score
  const pct = ((delta / baselineScore) * 100).toFixed(1)
  console.log(`${deg.label.padEnd(25)}| ${String(score).padStart(5)} | ${String(-delta).padStart(5)} | ${pct}% of baseline`)
}

// JSON output
console.log('\n── JSON Results ──')
console.log(JSON.stringify({
  length_monotonic: lengthMonotonic,
  quality_tiers: tierScores,
  quality_strictly_ordered: strictlyOrdered,
  score_spread: maxScore - minScore,
  baseline_score: baselineScore,
  component_contributions: degradations.map(d => {
    const score = scoreResponse(d.gen(), TEST_QUERY)
    return { degradation: d.label, score, delta: baselineScore - score }
  }),
}, null, 2))
