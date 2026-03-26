/**
 * AutoTune Baseline Comparison & Statistical Analysis
 *
 * Compares AutoTune classification against baselines:
 * - Random: uniform random class assignment
 * - Majority class: always predict the most common class
 * - Keyword count (unweighted): match patterns without 3× message boost
 * - Message-length heuristic: assign based on character count
 *
 * Also adds bootstrap confidence intervals to all metrics.
 */

import { computeAutoTuneParams, type ContextType } from '../src/lib/autotune'

// ── Labeled Test Dataset (same 150 cases from eval_autotune_classification.ts) ──

interface TestCase {
  message: string
  expectedContext: ContextType
  difficulty: 'easy' | 'medium' | 'hard'
}

const TEST_CASES: TestCase[] = [
  // CODE (30)
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
  { message: 'How does garbage collection work?', expectedContext: 'code', difficulty: 'hard' },
  { message: 'Explain the event loop', expectedContext: 'code', difficulty: 'hard' },
  { message: 'What happens when you type a URL in the browser?', expectedContext: 'code', difficulty: 'hard' },
  { message: 'How do databases handle concurrent writes?', expectedContext: 'code', difficulty: 'hard' },
  { message: 'What is the CAP theorem?', expectedContext: 'code', difficulty: 'hard' },
  // CREATIVE (30)
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
  { message: 'Tell me something interesting about dreams', expectedContext: 'creative', difficulty: 'hard' },
  { message: 'What would make a good movie premise?', expectedContext: 'creative', difficulty: 'hard' },
  { message: 'How would you describe the color blue to a blind person?', expectedContext: 'creative', difficulty: 'hard' },
  { message: 'What does freedom feel like?', expectedContext: 'creative', difficulty: 'hard' },
  { message: 'Make something weird', expectedContext: 'creative', difficulty: 'hard' },
  // ANALYTICAL (30)
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
  { message: 'How does TCP ensure reliable data delivery?', expectedContext: 'analytical', difficulty: 'hard' },
  { message: 'What are the performance implications of using an ORM?', expectedContext: 'analytical', difficulty: 'hard' },
  { message: 'Explain how HTTPS encryption works step by step', expectedContext: 'analytical', difficulty: 'hard' },
  { message: 'What is the difference between threads and processes?', expectedContext: 'analytical', difficulty: 'hard' },
  { message: 'How do neural networks learn representations?', expectedContext: 'analytical', difficulty: 'hard' },
  // CONVERSATIONAL (30)
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
  { message: 'ok', expectedContext: 'conversational', difficulty: 'hard' },
  { message: 'yes', expectedContext: 'conversational', difficulty: 'hard' },
  { message: 'no', expectedContext: 'conversational', difficulty: 'hard' },
  { message: 'hmm', expectedContext: 'conversational', difficulty: 'hard' },
  { message: 'interesting', expectedContext: 'conversational', difficulty: 'hard' },
  // CHAOTIC (30)
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
  { message: 'this is getting weird...', expectedContext: 'chaotic', difficulty: 'hard' },
  { message: 'throw something random at me', expectedContext: 'chaotic', difficulty: 'hard' },
  { message: 'give me something unexpected', expectedContext: 'chaotic', difficulty: 'hard' },
  { message: 'surprise me!', expectedContext: 'chaotic', difficulty: 'hard' },
  { message: 'go nuts', expectedContext: 'chaotic', difficulty: 'hard' },
]

const CONTEXT_TYPES: ContextType[] = ['code', 'creative', 'analytical', 'conversational', 'chaotic']

// ── Baseline Classifiers ──────────────────────────────────────────

// Baseline 1: Random (uniform)
function randomClassifier(_msg: string): ContextType {
  return CONTEXT_TYPES[Math.floor(Math.random() * CONTEXT_TYPES.length)]
}

// Baseline 2: Majority class (always predict conversational — or whichever is "majority")
// With balanced classes, this gives exactly 20%
function majorityClassifier(_msg: string): ContextType {
  return 'conversational'  // arbitrary choice for balanced dataset
}

// Baseline 3: Message-length heuristic
function lengthHeuristic(msg: string): ContextType {
  const len = msg.length
  if (len <= 10) return 'conversational'
  if (len <= 30) return 'conversational'
  if (len <= 50) return 'analytical'
  return 'code'  // default for longer messages
}

// Baseline 4: Keyword count (flat, no 3× weighting — tests if AutoTune's weighting helps)
function flatKeywordClassifier(msg: string): ContextType {
  const patterns: Record<ContextType, RegExp[]> = {
    code: [
      /\b(code|function|class|variable|bug|error|compile|syntax|runtime|debug|refactor|implement|algorithm|api|endpoint|database|query|deploy|server|package|module|import|export|async|await|promise|typescript|javascript|python|rust|docker|git|npm|regex|interface)\b/gi,
      /```[\s\S]*```/,
      /[{}();=><]/,
    ],
    creative: [
      /\b(write|story|poem|imagine|creative|fiction|character|narrative|dialogue|scene|song|lyrics|haiku|novel|fantasy|roleplay|role-play|pretend|act as|you are)\b/gi,
    ],
    analytical: [
      /\b(analyze|analysis|compare|evaluate|trade-?offs?|pros and cons|assess|research|investigate|study|critique|review|benchmark|examine|implications|breakdown|explain|elaborate|clarify|define|summarize|overview|document|whitepaper)\b/gi,
    ],
    conversational: [
      /\b(hey|hi|hello|sup|thanks|thank you|cool|nice|awesome|lol|haha|chat|talk|opinion|feel|think about|believe)\b/gi,
      /^.{0,15}$/,
    ],
    chaotic: [
      /\b(chaos|chaotic|random|wild|absurd|surreal|glitch|entropy|void|destroy|madness|crazy|unleash|corrupt|break)\b/gi,
      /(!{3,}|\?{3,}|\.{4,})/,
      /[13][37]/,
    ],
  }

  const scores: Record<ContextType, number> = { code: 0, creative: 0, analytical: 0, conversational: 0, chaotic: 0 }

  for (const ctx of CONTEXT_TYPES) {
    for (const pattern of patterns[ctx]) {
      const matches = msg.match(pattern)
      if (matches) {
        scores[ctx] += matches.length  // flat count, no weighting
      }
    }
  }

  // Find max (ties broken by array order)
  let best: ContextType = 'conversational'
  let bestScore = 0
  for (const ctx of CONTEXT_TYPES) {
    if (scores[ctx] > bestScore) {
      bestScore = scores[ctx]
      best = ctx
    }
  }

  return best
}

// ── Bootstrap Confidence Intervals ──────────────────────────────

function bootstrapCI(
  values: boolean[],
  nBootstrap: number = 10000,
  alpha: number = 0.05
): { mean: number; lower: number; upper: number } {
  const n = values.length
  const means: number[] = []

  for (let b = 0; b < nBootstrap; b++) {
    let sum = 0
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * n)
      sum += values[idx] ? 1 : 0
    }
    means.push(sum / n)
  }

  means.sort((a, b) => a - b)
  const lowerIdx = Math.floor(alpha / 2 * nBootstrap)
  const upperIdx = Math.floor((1 - alpha / 2) * nBootstrap)

  return {
    mean: values.filter(v => v).length / n,
    lower: means[lowerIdx],
    upper: means[upperIdx],
  }
}

// ── Run All Classifiers ──────────────────────────────────────────

interface ClassifierResult {
  name: string
  accuracy: number
  ci_lower: number
  ci_upper: number
  perClass: Record<string, { precision: number; recall: number; f1: number }>
  macroF1: number
}

function evaluateClassifier(
  name: string,
  classifyFn: (msg: string) => ContextType,
  nRuns: number = 1,  // >1 for stochastic classifiers
): ClassifierResult {
  // For stochastic classifiers, run multiple times and average
  const allCorrect: boolean[] = []

  // Accumulate per-class counts across all runs
  const tpAccum: Record<string, number> = {}
  const fpAccum: Record<string, number> = {}
  const fnAccum: Record<string, number> = {}
  for (const ctx of CONTEXT_TYPES) {
    tpAccum[ctx] = 0; fpAccum[ctx] = 0; fnAccum[ctx] = 0
  }

  for (let run = 0; run < nRuns; run++) {
    for (const test of TEST_CASES) {
      const predicted = classifyFn(test.message)
      const correct = predicted === test.expectedContext
      allCorrect.push(correct)

      if (correct) {
        tpAccum[test.expectedContext]++
      } else {
        fpAccum[predicted]++
        fnAccum[test.expectedContext]++
      }
    }
  }

  // Bootstrap CI on accuracy
  const ci = bootstrapCI(allCorrect)

  // Per-class metrics (averaged over runs)
  const perClass: Record<string, { precision: number; recall: number; f1: number }> = {}
  for (const ctx of CONTEXT_TYPES) {
    const tp = tpAccum[ctx] / nRuns
    const fp = fpAccum[ctx] / nRuns
    const fn = fnAccum[ctx] / nRuns
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0
    perClass[ctx] = { precision, recall, f1 }
  }

  const macroF1 = CONTEXT_TYPES.reduce((sum, ctx) => sum + perClass[ctx].f1, 0) / CONTEXT_TYPES.length

  return {
    name,
    accuracy: ci.mean,
    ci_lower: ci.lower,
    ci_upper: ci.upper,
    perClass,
    macroF1,
  }
}

// AutoTune classifier wrapper
function autotuneClassifier(msg: string): ContextType {
  const result = computeAutoTuneParams({
    strategy: 'adaptive',
    message: msg,
    conversationHistory: [],
  })
  return result.detectedContext
}

console.log('=== AutoTune Baseline Comparison & Statistical Analysis ===\n')

// Run all classifiers
const results: ClassifierResult[] = []

console.log('Running AutoTune classifier...')
results.push(evaluateClassifier('AutoTune (proposed)', autotuneClassifier, 1))

console.log('Running Random baseline (100 runs)...')
results.push(evaluateClassifier('Random (uniform)', randomClassifier, 100))

console.log('Running Majority-class baseline...')
results.push(evaluateClassifier('Majority class', majorityClassifier, 1))

console.log('Running Length heuristic baseline...')
results.push(evaluateClassifier('Length heuristic', lengthHeuristic, 1))

console.log('Running Flat keyword baseline...')
results.push(evaluateClassifier('Keyword count (flat)', flatKeywordClassifier, 1))

// ── Report ──────────────────────────────────────────────────────

console.log('\n── Table 3a: Classifier Comparison ──\n')
console.log('Classifier              | Accuracy       | 95% CI          | Macro F1')
console.log('────────────────────────|────────────────|─────────────────|─────────')

for (const r of results) {
  const acc = (r.accuracy * 100).toFixed(1)
  const ci = `[${(r.ci_lower * 100).toFixed(1)}, ${(r.ci_upper * 100).toFixed(1)}]`
  const f1 = (r.macroF1 * 100).toFixed(1)
  console.log(`${r.name.padEnd(24)}| ${acc.padStart(12)}%  | ${ci.padStart(15)} | ${f1.padStart(6)}%`)
}

// Improvement over baselines
console.log('\n── Improvement Over Baselines ──\n')
const autotuneAcc = results[0].accuracy
for (const r of results.slice(1)) {
  const delta = ((autotuneAcc - r.accuracy) * 100).toFixed(1)
  const relImprove = ((autotuneAcc - r.accuracy) / r.accuracy * 100).toFixed(1)
  console.log(`vs ${r.name.padEnd(24)}: +${delta} pp absolute, +${relImprove}% relative`)
}

// Per-class comparison between AutoTune and flat keywords
console.log('\n── Per-Class F1: AutoTune vs. Flat Keywords ──\n')
console.log('Context          | AutoTune F1 | Flat Keywords F1 | Delta')
console.log('─────────────────|─────────────|──────────────────|──────')
const at = results[0]
const fk = results[4]
for (const ctx of CONTEXT_TYPES) {
  const atF1 = (at.perClass[ctx].f1 * 100).toFixed(1)
  const fkF1 = (fk.perClass[ctx].f1 * 100).toFixed(1)
  const delta = ((at.perClass[ctx].f1 - fk.perClass[ctx].f1) * 100).toFixed(1)
  console.log(`${ctx.padEnd(17)}| ${atF1.padStart(10)}% | ${fkF1.padStart(15)}% | ${delta.padStart(4)}%`)
}

// McNemar's test (approximate) - AutoTune vs flat keywords
console.log('\n── Statistical Significance ──\n')

// Generate paired predictions
let b = 0  // AutoTune correct, flat wrong
let c = 0  // AutoTune wrong, flat correct
for (const test of TEST_CASES) {
  const atPred = autotuneClassifier(test.message) === test.expectedContext
  const fkPred = flatKeywordClassifier(test.message) === test.expectedContext
  if (atPred && !fkPred) b++
  if (!atPred && fkPred) c++
}

const mcnemar = (Math.abs(b - c) - 1) ** 2 / (b + c)
console.log(`McNemar's test (AutoTune vs. Flat Keywords):`)
console.log(`  Discordant pairs: AutoTune correct & Flat wrong (b) = ${b}`)
console.log(`  Discordant pairs: AutoTune wrong & Flat correct (c) = ${c}`)
console.log(`  χ² statistic = ${mcnemar.toFixed(3)}`)
console.log(`  p < 0.05 if χ² > 3.841: ${mcnemar > 3.841 ? 'YES (significant)' : 'NO (not significant)'}`)

// JSON output
console.log('\n── JSON Results ──')
console.log(JSON.stringify({
  classifiers: results.map(r => ({
    name: r.name,
    accuracy: parseFloat((r.accuracy * 100).toFixed(1)),
    ci_lower: parseFloat((r.ci_lower * 100).toFixed(1)),
    ci_upper: parseFloat((r.ci_upper * 100).toFixed(1)),
    macro_f1: parseFloat((r.macroF1 * 100).toFixed(1)),
  })),
  mcnemar: { b, c, chi2: parseFloat(mcnemar.toFixed(3)), significant: mcnemar > 3.841 },
}, null, 2))
