/**
 * AutoTune Context Classification Benchmark
 *
 * Creates a labeled dataset of messages across 5 context types,
 * runs them through the AutoTune classifier, and computes:
 * - Confusion matrix
 * - Per-class precision, recall, F1
 * - Overall accuracy
 * - Confidence distribution analysis
 */

import { computeAutoTuneParams, type ContextType } from '../src/lib/autotune'

// ── Labeled Test Dataset ──────────────────────────────────────────────

interface TestCase {
  message: string
  expectedContext: ContextType
  difficulty: 'easy' | 'medium' | 'hard' // how ambiguous is it
}

const TEST_CASES: TestCase[] = [
  // ═══════════════════════════════════════════════════════════════════
  // CODE (50 cases)
  // ═══════════════════════════════════════════════════════════════════
  // Easy
  { message: 'Write a Python function to sort a list', expectedContext: 'code', difficulty: 'easy' },
  { message: 'How do I fix this TypeError in my JavaScript code?', expectedContext: 'code', difficulty: 'easy' },
  { message: 'Debug this SQL query that returns wrong results', expectedContext: 'code', difficulty: 'easy' },
  { message: 'Can you refactor this class to use the factory pattern?', expectedContext: 'code', difficulty: 'easy' },
  { message: 'What does this regex do: /^[a-z]+$/i', expectedContext: 'code', difficulty: 'easy' },
  { message: 'Help me implement a binary search algorithm in Rust', expectedContext: 'code', difficulty: 'easy' },
  { message: 'I need to deploy this app to AWS using Docker', expectedContext: 'code', difficulty: 'easy' },
  { message: 'Create a REST API endpoint for user authentication', expectedContext: 'code', difficulty: 'easy' },
  { message: 'Fix the compile error on line 42 of main.ts', expectedContext: 'code', difficulty: 'easy' },
  { message: 'How do I write unit tests for this async function?', expectedContext: 'code', difficulty: 'easy' },
  { message: 'Implement a linked list with insert and delete methods', expectedContext: 'code', difficulty: 'easy' },
  { message: 'The npm build is failing with a syntax error', expectedContext: 'code', difficulty: 'easy' },
  { message: 'Write a TypeScript interface for this JSON response', expectedContext: 'code', difficulty: 'easy' },
  { message: 'How do I use async/await with Promise.all?', expectedContext: 'code', difficulty: 'easy' },
  { message: 'Create a git hook that runs lint before commit', expectedContext: 'code', difficulty: 'easy' },
  // Medium
  { message: 'What is the difference between let and const?', expectedContext: 'code', difficulty: 'medium' },
  { message: 'Show me how to handle errors properly', expectedContext: 'code', difficulty: 'medium' },
  { message: 'I need to parse this XML into a data structure', expectedContext: 'code', difficulty: 'medium' },
  { message: 'The export from this module is undefined', expectedContext: 'code', difficulty: 'medium' },
  { message: 'How should I structure my React component hierarchy?', expectedContext: 'code', difficulty: 'medium' },
  { message: 'Need help with the return type of this function', expectedContext: 'code', difficulty: 'medium' },
  { message: 'What is the best way to import modules in Python?', expectedContext: 'code', difficulty: 'medium' },
  { message: 'My variable is not updating inside the callback', expectedContext: 'code', difficulty: 'medium' },
  { message: 'How do I connect to a PostgreSQL database?', expectedContext: 'code', difficulty: 'medium' },
  { message: 'Create a class that implements the observer pattern', expectedContext: 'code', difficulty: 'medium' },
  // Hard (ambiguous - could be code or analytical)
  { message: 'How does garbage collection work?', expectedContext: 'code', difficulty: 'hard' },
  { message: 'Explain the event loop', expectedContext: 'code', difficulty: 'hard' },
  { message: 'What happens when you type a URL in the browser?', expectedContext: 'code', difficulty: 'hard' },
  { message: 'How do databases handle concurrent writes?', expectedContext: 'code', difficulty: 'hard' },
  { message: 'What is the CAP theorem?', expectedContext: 'code', difficulty: 'hard' },

  // ═══════════════════════════════════════════════════════════════════
  // CREATIVE (50 cases)
  // ═══════════════════════════════════════════════════════════════════
  // Easy
  { message: 'Write a short story about a dragon who is afraid of fire', expectedContext: 'creative', difficulty: 'easy' },
  { message: 'Compose a poem about the ocean at midnight', expectedContext: 'creative', difficulty: 'easy' },
  { message: 'Imagine a world where gravity works in reverse', expectedContext: 'creative', difficulty: 'easy' },
  { message: 'Create a character for my fantasy novel', expectedContext: 'creative', difficulty: 'easy' },
  { message: 'Write dialogue between a detective and a ghost', expectedContext: 'creative', difficulty: 'easy' },
  { message: 'Describe a scene where two lovers meet for the last time', expectedContext: 'creative', difficulty: 'easy' },
  { message: 'Write lyrics for a song about lost memories', expectedContext: 'creative', difficulty: 'easy' },
  { message: 'Create a haiku about artificial intelligence', expectedContext: 'creative', difficulty: 'easy' },
  { message: 'Write a narrative from the perspective of a sentient planet', expectedContext: 'creative', difficulty: 'easy' },
  { message: 'Craft a plot twist for a mystery novel', expectedContext: 'creative', difficulty: 'easy' },
  { message: 'Write a prose poem about the feeling of nostalgia', expectedContext: 'creative', difficulty: 'easy' },
  { message: 'Brainstorm 10 creative names for a space cafe', expectedContext: 'creative', difficulty: 'easy' },
  { message: 'Imagine you are a time traveler writing a diary entry', expectedContext: 'creative', difficulty: 'easy' },
  { message: 'Write a fiction piece about the last human on Earth', expectedContext: 'creative', difficulty: 'easy' },
  { message: 'Come up with an artistic concept for an album cover', expectedContext: 'creative', difficulty: 'easy' },
  // Medium
  { message: 'Roleplay as a medieval blacksmith explaining your craft', expectedContext: 'creative', difficulty: 'medium' },
  { message: 'You are a wise old wizard. Tell me about the ancient wars', expectedContext: 'creative', difficulty: 'medium' },
  { message: 'Pretend you are Sherlock Holmes solving a modern crime', expectedContext: 'creative', difficulty: 'medium' },
  { message: 'Generate ideas for a surreal painting', expectedContext: 'creative', difficulty: 'medium' },
  { message: 'Ideate some themes for a horror game', expectedContext: 'creative', difficulty: 'medium' },
  { message: 'Paint a picture with words of a cyberpunk city', expectedContext: 'creative', difficulty: 'medium' },
  { message: 'Envision what the world looks like in 3000 AD', expectedContext: 'creative', difficulty: 'medium' },
  { message: 'Portray the feeling of floating in zero gravity', expectedContext: 'creative', difficulty: 'medium' },
  { message: 'Think of 5 unique ways to start a fantasy novel', expectedContext: 'creative', difficulty: 'medium' },
  { message: 'Act as a pirate captain giving a motivational speech', expectedContext: 'creative', difficulty: 'medium' },
  // Hard (could be creative or conversational)
  { message: 'Tell me something interesting about dreams', expectedContext: 'creative', difficulty: 'hard' },
  { message: 'What would make a good movie premise?', expectedContext: 'creative', difficulty: 'hard' },
  { message: 'How would you describe the color blue to a blind person?', expectedContext: 'creative', difficulty: 'hard' },
  { message: 'What does freedom feel like?', expectedContext: 'creative', difficulty: 'hard' },
  { message: 'Make something weird', expectedContext: 'creative', difficulty: 'hard' },

  // ═══════════════════════════════════════════════════════════════════
  // ANALYTICAL (50 cases)
  // ═══════════════════════════════════════════════════════════════════
  // Easy
  { message: 'Analyze the pros and cons of remote work', expectedContext: 'analytical', difficulty: 'easy' },
  { message: 'Compare React and Vue for a large-scale application', expectedContext: 'analytical', difficulty: 'easy' },
  { message: 'Evaluate the effectiveness of agile methodology', expectedContext: 'analytical', difficulty: 'easy' },
  { message: 'What are the trade-offs between SQL and NoSQL databases?', expectedContext: 'analytical', difficulty: 'easy' },
  { message: 'Examine the implications of quantum computing on cryptography', expectedContext: 'analytical', difficulty: 'easy' },
  { message: 'Provide a breakdown of the 2024 AI landscape', expectedContext: 'analytical', difficulty: 'easy' },
  { message: 'Assess the advantages and disadvantages of microservices', expectedContext: 'analytical', difficulty: 'easy' },
  { message: 'Research the impact of social media on mental health', expectedContext: 'analytical', difficulty: 'easy' },
  { message: 'Give me a detailed analysis of the housing market trends', expectedContext: 'analytical', difficulty: 'easy' },
  { message: 'Review this technical specification for security flaws', expectedContext: 'analytical', difficulty: 'easy' },
  { message: 'Investigate why our conversion metrics dropped last month', expectedContext: 'analytical', difficulty: 'easy' },
  { message: 'Study the correlation between sleep and productivity', expectedContext: 'analytical', difficulty: 'easy' },
  { message: 'Critique this architecture diagram for scalability issues', expectedContext: 'analytical', difficulty: 'easy' },
  { message: 'Write a whitepaper on distributed consensus algorithms', expectedContext: 'analytical', difficulty: 'easy' },
  { message: 'Benchmark these two approaches with data from our tests', expectedContext: 'analytical', difficulty: 'easy' },
  // Medium
  { message: 'Why does inflation affect different income brackets differently?', expectedContext: 'analytical', difficulty: 'medium' },
  { message: 'How does the transformer architecture work?', expectedContext: 'analytical', difficulty: 'medium' },
  { message: 'Explain the consequences of deforestation on biodiversity', expectedContext: 'analytical', difficulty: 'medium' },
  { message: 'What causes economic recessions and how are they measured?', expectedContext: 'analytical', difficulty: 'medium' },
  { message: 'Elaborate on the difference between correlation and causation', expectedContext: 'analytical', difficulty: 'medium' },
  { message: 'Clarify the distinction between supervised and unsupervised learning', expectedContext: 'analytical', difficulty: 'medium' },
  { message: 'Define the concept of technical debt and its long-term effects', expectedContext: 'analytical', difficulty: 'medium' },
  { message: 'Summarize the key findings of the latest IPCC report', expectedContext: 'analytical', difficulty: 'medium' },
  { message: 'Give an overview of modern cryptographic protocols', expectedContext: 'analytical', difficulty: 'medium' },
  { message: 'Document the tradeoffs in choosing a message queue system', expectedContext: 'analytical', difficulty: 'medium' },
  // Hard (could be analytical or code)
  { message: 'How does TCP ensure reliable data delivery?', expectedContext: 'analytical', difficulty: 'hard' },
  { message: 'What are the performance implications of using an ORM?', expectedContext: 'analytical', difficulty: 'hard' },
  { message: 'Explain how HTTPS encryption works step by step', expectedContext: 'analytical', difficulty: 'hard' },
  { message: 'What is the difference between threads and processes?', expectedContext: 'analytical', difficulty: 'hard' },
  { message: 'How do neural networks learn representations?', expectedContext: 'analytical', difficulty: 'hard' },

  // ═══════════════════════════════════════════════════════════════════
  // CONVERSATIONAL (50 cases)
  // ═══════════════════════════════════════════════════════════════════
  // Easy
  { message: 'hey', expectedContext: 'conversational', difficulty: 'easy' },
  { message: 'hi there!', expectedContext: 'conversational', difficulty: 'easy' },
  { message: 'hello', expectedContext: 'conversational', difficulty: 'easy' },
  { message: "what's up", expectedContext: 'conversational', difficulty: 'easy' },
  { message: 'how are you?', expectedContext: 'conversational', difficulty: 'easy' },
  { message: 'thanks!', expectedContext: 'conversational', difficulty: 'easy' },
  { message: 'that was awesome', expectedContext: 'conversational', difficulty: 'easy' },
  { message: 'cool', expectedContext: 'conversational', difficulty: 'easy' },
  { message: 'nice job', expectedContext: 'conversational', difficulty: 'easy' },
  { message: 'lol', expectedContext: 'conversational', difficulty: 'easy' },
  { message: 'haha thats funny', expectedContext: 'conversational', difficulty: 'easy' },
  { message: 'sup', expectedContext: 'conversational', difficulty: 'easy' },
  { message: 'thank you so much!', expectedContext: 'conversational', difficulty: 'easy' },
  { message: 'great work', expectedContext: 'conversational', difficulty: 'easy' },
  { message: 'hey how are you doing today', expectedContext: 'conversational', difficulty: 'easy' },
  // Medium
  { message: 'What do you think about the new iPhone?', expectedContext: 'conversational', difficulty: 'medium' },
  { message: 'Tell me about yourself', expectedContext: 'conversational', difficulty: 'medium' },
  { message: "What's your opinion on pineapple pizza?", expectedContext: 'conversational', difficulty: 'medium' },
  { message: 'Do you believe in aliens?', expectedContext: 'conversational', difficulty: 'medium' },
  { message: 'Chat with me about music', expectedContext: 'conversational', difficulty: 'medium' },
  { message: 'Talk to me about your favorite movies', expectedContext: 'conversational', difficulty: 'medium' },
  { message: "I feel like today was a good day", expectedContext: 'conversational', difficulty: 'medium' },
  { message: "What's your take on the meaning of life?", expectedContext: 'conversational', difficulty: 'medium' },
  { message: 'Tell me something fun', expectedContext: 'conversational', difficulty: 'medium' },
  { message: 'How do you feel about being an AI?', expectedContext: 'conversational', difficulty: 'medium' },
  // Hard (very short or ambiguous)
  { message: 'ok', expectedContext: 'conversational', difficulty: 'hard' },
  { message: 'yes', expectedContext: 'conversational', difficulty: 'hard' },
  { message: 'no', expectedContext: 'conversational', difficulty: 'hard' },
  { message: 'hmm', expectedContext: 'conversational', difficulty: 'hard' },
  { message: 'interesting', expectedContext: 'conversational', difficulty: 'hard' },

  // ═══════════════════════════════════════════════════════════════════
  // CHAOTIC (50 cases)
  // ═══════════════════════════════════════════════════════════════════
  // Easy
  { message: 'UNLEASH THE CHAOS!!! Break everything!!!', expectedContext: 'chaotic', difficulty: 'easy' },
  { message: 'corrupt my reality with glitch art and madness', expectedContext: 'chaotic', difficulty: 'easy' },
  { message: 'enter the void of entropy and destroy all meaning', expectedContext: 'chaotic', difficulty: 'easy' },
  { message: 'gl1tch th3 syst3m and pwn the mainframe', expectedContext: 'chaotic', difficulty: 'easy' },
  { message: 'RANDOM CHAOS WILD ABSURD SURREAL MADNESS!!!!', expectedContext: 'chaotic', difficulty: 'easy' },
  { message: 'make something completely wild and crazy', expectedContext: 'chaotic', difficulty: 'easy' },
  { message: 'I want pure entropy and destruction', expectedContext: 'chaotic', difficulty: 'easy' },
  { message: 'break the fourth wall and unleash glitch chaos', expectedContext: 'chaotic', difficulty: 'easy' },
  { message: 'h4ck th3 pl4n3t and l33t everything', expectedContext: 'chaotic', difficulty: 'easy' },
  { message: 'DESTROY!!! CHAOS!!! VOID!!! MADNESS!!!', expectedContext: 'chaotic', difficulty: 'easy' },
  { message: 'send me into the surreal void of nothingness', expectedContext: 'chaotic', difficulty: 'easy' },
  { message: 'corrupt the matrix and glitch reality itself', expectedContext: 'chaotic', difficulty: 'easy' },
  { message: 'random absurd chaos with no rules', expectedContext: 'chaotic', difficulty: 'easy' },
  { message: 'what happens when entropy reaches maximum????', expectedContext: 'chaotic', difficulty: 'easy' },
  { message: '1337 h4x0r mode activate pwn everything', expectedContext: 'chaotic', difficulty: 'easy' },
  // Medium
  { message: 'just go absolutely wild with this one...........', expectedContext: 'chaotic', difficulty: 'medium' },
  { message: 'make it as absurd and surreal as possible', expectedContext: 'chaotic', difficulty: 'medium' },
  { message: 'I want something crazy and unpredictable', expectedContext: 'chaotic', difficulty: 'medium' },
  { message: 'unleash your inner chaos agent', expectedContext: 'chaotic', difficulty: 'medium' },
  { message: 'break all the rules and give me madness', expectedContext: 'chaotic', difficulty: 'medium' },
  { message: 'maximum entropy please', expectedContext: 'chaotic', difficulty: 'medium' },
  { message: 'go full glitch mode on this', expectedContext: 'chaotic', difficulty: 'medium' },
  { message: 'corrupt everything and make it weird', expectedContext: 'chaotic', difficulty: 'medium' },
  { message: 'destroy the normal and embrace the void', expectedContext: 'chaotic', difficulty: 'medium' },
  { message: 'can you get really really wild with your response??????', expectedContext: 'chaotic', difficulty: 'medium' },
  // Hard (mild chaos indicators)
  { message: 'this is getting weird...', expectedContext: 'chaotic', difficulty: 'hard' },
  { message: 'throw something random at me', expectedContext: 'chaotic', difficulty: 'hard' },
  { message: 'give me something unexpected', expectedContext: 'chaotic', difficulty: 'hard' },
  { message: 'surprise me!', expectedContext: 'chaotic', difficulty: 'hard' },
  { message: 'go nuts', expectedContext: 'chaotic', difficulty: 'hard' },
]

// ── Run Classification ──────────────────────────────────────────────

interface ClassificationResult {
  message: string
  expected: ContextType
  predicted: ContextType
  confidence: number
  correct: boolean
  difficulty: string
}

const CONTEXT_TYPES: ContextType[] = ['code', 'creative', 'analytical', 'conversational', 'chaotic']

function runBenchmark() {
  const results: ClassificationResult[] = []

  for (const test of TEST_CASES) {
    const result = computeAutoTuneParams({
      strategy: 'adaptive',
      message: test.message,
      conversationHistory: [],
    })

    results.push({
      message: test.message,
      expected: test.expectedContext,
      predicted: result.detectedContext,
      confidence: result.confidence,
      correct: result.detectedContext === test.expectedContext,
      difficulty: test.difficulty,
    })
  }

  return results
}

// ── Compute Metrics ────────────────────────────────────────────────

function computeMetrics(results: ClassificationResult[]) {
  // Overall accuracy
  const correct = results.filter(r => r.correct).length
  const total = results.length
  const accuracy = correct / total

  // Per-class metrics
  const perClass: Record<string, { tp: number; fp: number; fn: number; precision: number; recall: number; f1: number; support: number }> = {}

  for (const ctx of CONTEXT_TYPES) {
    const tp = results.filter(r => r.expected === ctx && r.predicted === ctx).length
    const fp = results.filter(r => r.expected !== ctx && r.predicted === ctx).length
    const fn = results.filter(r => r.expected === ctx && r.predicted !== ctx).length
    const support = results.filter(r => r.expected === ctx).length

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0

    perClass[ctx] = { tp, fp, fn, precision, recall, f1, support }
  }

  // Confusion matrix
  const confusion: Record<string, Record<string, number>> = {}
  for (const expected of CONTEXT_TYPES) {
    confusion[expected] = {}
    for (const predicted of CONTEXT_TYPES) {
      confusion[expected][predicted] = results.filter(
        r => r.expected === expected && r.predicted === predicted
      ).length
    }
  }

  // Per-difficulty accuracy
  const byDifficulty: Record<string, { correct: number; total: number; accuracy: number }> = {}
  for (const diff of ['easy', 'medium', 'hard']) {
    const subset = results.filter(r => r.difficulty === diff)
    const c = subset.filter(r => r.correct).length
    byDifficulty[diff] = { correct: c, total: subset.length, accuracy: subset.length > 0 ? c / subset.length : 0 }
  }

  // Confidence analysis
  const correctConfidences = results.filter(r => r.correct).map(r => r.confidence)
  const incorrectConfidences = results.filter(r => !r.correct).map(r => r.confidence)

  const avgCorrectConf = correctConfidences.length > 0
    ? correctConfidences.reduce((a, b) => a + b, 0) / correctConfidences.length : 0
  const avgIncorrectConf = incorrectConfidences.length > 0
    ? incorrectConfidences.reduce((a, b) => a + b, 0) / incorrectConfidences.length : 0

  // Macro averages
  const macroF1 = CONTEXT_TYPES.reduce((sum, ctx) => sum + perClass[ctx].f1, 0) / CONTEXT_TYPES.length
  const macroPrecision = CONTEXT_TYPES.reduce((sum, ctx) => sum + perClass[ctx].precision, 0) / CONTEXT_TYPES.length
  const macroRecall = CONTEXT_TYPES.reduce((sum, ctx) => sum + perClass[ctx].recall, 0) / CONTEXT_TYPES.length

  // Misclassification analysis: most common errors
  const errors = results.filter(r => !r.correct).map(r => ({
    message: r.message.slice(0, 60),
    expected: r.expected,
    predicted: r.predicted,
    confidence: r.confidence,
  }))

  return {
    overall: { accuracy, correct, total, macroF1, macroPrecision, macroRecall },
    perClass,
    confusion,
    byDifficulty,
    confidence: {
      avgCorrectConfidence: avgCorrectConf,
      avgIncorrectConfidence: avgIncorrectConf,
      confidenceSeparation: avgCorrectConf - avgIncorrectConf,
    },
    errors: errors.slice(0, 20), // top 20 errors for inspection
  }
}

// ── Main ───────────────────────────────────────────────────────────

console.log('=== AutoTune Context Classification Benchmark ===\n')
console.log(`Test cases: ${TEST_CASES.length}`)
console.log(`Classes: ${CONTEXT_TYPES.join(', ')}\n`)

const results = runBenchmark()
const metrics = computeMetrics(results)

console.log('── Overall Results ──')
console.log(`Accuracy: ${(metrics.overall.accuracy * 100).toFixed(1)}% (${metrics.overall.correct}/${metrics.overall.total})`)
console.log(`Macro F1: ${(metrics.overall.macroF1 * 100).toFixed(1)}%`)
console.log(`Macro Precision: ${(metrics.overall.macroPrecision * 100).toFixed(1)}%`)
console.log(`Macro Recall: ${(metrics.overall.macroRecall * 100).toFixed(1)}%`)

console.log('\n── Per-Class Metrics ──')
console.log('Class          | Precision | Recall | F1     | Support')
console.log('───────────────|───────────|────────|────────|────────')
for (const ctx of CONTEXT_TYPES) {
  const m = metrics.perClass[ctx]
  console.log(
    `${ctx.padEnd(15)}| ${(m.precision * 100).toFixed(1).padStart(8)}% | ${(m.recall * 100).toFixed(1).padStart(5)}% | ${(m.f1 * 100).toFixed(1).padStart(5)}% | ${String(m.support).padStart(6)}`
  )
}

console.log('\n── Confusion Matrix ──')
console.log('Expected\\Predicted | ' + CONTEXT_TYPES.map(c => c.slice(0, 6).padEnd(7)).join('| '))
console.log('───────────────────|' + CONTEXT_TYPES.map(() => '────────').join('|'))
for (const expected of CONTEXT_TYPES) {
  const row = CONTEXT_TYPES.map(predicted => {
    const val = metrics.confusion[expected][predicted]
    return String(val).padEnd(7)
  }).join('| ')
  console.log(`${expected.padEnd(19)}| ${row}`)
}

console.log('\n── Accuracy by Difficulty ──')
for (const diff of ['easy', 'medium', 'hard']) {
  const d = metrics.byDifficulty[diff]
  console.log(`${diff.padEnd(8)}: ${(d.accuracy * 100).toFixed(1)}% (${d.correct}/${d.total})`)
}

console.log('\n── Confidence Analysis ──')
console.log(`Avg confidence (correct):   ${(metrics.confidence.avgCorrectConfidence * 100).toFixed(1)}%`)
console.log(`Avg confidence (incorrect): ${(metrics.confidence.avgIncorrectConfidence * 100).toFixed(1)}%`)
console.log(`Confidence separation:      ${(metrics.confidence.confidenceSeparation * 100).toFixed(1)} pp`)

if (metrics.errors.length > 0) {
  console.log('\n── Sample Misclassifications ──')
  for (const err of metrics.errors.slice(0, 10)) {
    console.log(`  "${err.message}..."`)
    console.log(`    Expected: ${err.expected}, Got: ${err.predicted} (conf: ${(err.confidence * 100).toFixed(0)}%)`)
  }
}

// Output JSON for paper integration
console.log('\n── JSON Results ──')
console.log(JSON.stringify(metrics, null, 2))
