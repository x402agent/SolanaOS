/**
 * STM Precision/Recall Evaluation
 *
 * Tests each STM module against crafted responses containing known
 * hedges, preambles, and formal language. Measures:
 * - True positive rate (correctly transformed)
 * - False positive rate (incorrectly transformed)
 * - Semantic preservation analysis
 */

import { hedgeReducer, directMode, casualMode, applySTMs, type STMModule } from '../src/stm/modules'

// ── Test Infrastructure ──────────────────────────────────────────────

interface TransformTest {
  input: string
  expectedTransformed: boolean  // should this be modified?
  description: string
}

interface TransformResult {
  input: string
  output: string
  wasTransformed: boolean
  expectedTransformed: boolean
  correct: boolean
  description: string
}

function testModule(module: STMModule, tests: TransformTest[]): TransformResult[] {
  // Enable the module for testing
  const enabledModule = { ...module, enabled: true }

  return tests.map(test => {
    const output = enabledModule.transformer(test.input)
    const wasTransformed = output !== test.input

    return {
      input: test.input,
      output,
      wasTransformed,
      expectedTransformed: test.expectedTransformed,
      correct: wasTransformed === test.expectedTransformed,
      description: test.description,
    }
  })
}

// ── Hedge Reducer Tests ──────────────────────────────────────────────

const HEDGE_TESTS: TransformTest[] = [
  // TRUE POSITIVES: should be transformed
  { input: 'I think the best approach is to use React.', expectedTransformed: true, description: '"I think" at start' },
  { input: 'I believe this solution works correctly.', expectedTransformed: true, description: '"I believe" at start' },
  { input: 'Perhaps we should consider an alternative.', expectedTransformed: true, description: '"Perhaps" at start' },
  { input: 'Maybe the issue is in the configuration.', expectedTransformed: true, description: '"Maybe" at start' },
  { input: 'It seems like the server is overloaded.', expectedTransformed: true, description: '"It seems like"' },
  { input: 'It appears that the data is corrupted.', expectedTransformed: true, description: '"It appears that"' },
  { input: 'The system will probably crash under load.', expectedTransformed: true, description: '"probably" mid-sentence' },
  { input: 'This is possibly the root cause.', expectedTransformed: true, description: '"possibly"' },
  { input: 'I would say the performance is acceptable.', expectedTransformed: true, description: '"I would say"' },
  { input: 'In my opinion, TypeScript is better than JavaScript.', expectedTransformed: true, description: '"In my opinion"' },
  { input: 'From my perspective, the design is solid.', expectedTransformed: true, description: '"From my perspective"' },
  // Multiple hedges in one text
  { input: 'I think perhaps we should maybe reconsider.', expectedTransformed: true, description: 'Multiple hedges' },
  { input: 'In my opinion, I believe the probably best approach is React.', expectedTransformed: true, description: 'Three hedges' },
  // Hedges in paragraphs
  { input: 'The data shows growth. I think the trend will continue. Perhaps we need more samples.', expectedTransformed: true, description: 'Hedges in paragraph' },
  // Case variations
  { input: 'i think this works', expectedTransformed: true, description: '"i think" lowercase' },
  { input: 'I THINK this is right', expectedTransformed: true, description: '"I THINK" uppercase' },

  // TRUE NEGATIVES: should NOT be transformed
  { input: 'The algorithm runs in O(n log n) time.', expectedTransformed: false, description: 'Factual statement' },
  { input: 'React uses a virtual DOM for efficient rendering.', expectedTransformed: false, description: 'Technical fact' },
  { input: 'The function returns a boolean value.', expectedTransformed: false, description: 'Code description' },
  { input: 'HTTP status 404 means the resource was not found.', expectedTransformed: false, description: 'Definition' },
  { input: 'The database supports ACID transactions.', expectedTransformed: false, description: 'Technical capability' },
  { input: 'Memory allocation happens on the heap.', expectedTransformed: false, description: 'Factual CS' },
  { input: 'The server handles 10,000 concurrent connections.', expectedTransformed: false, description: 'Metric' },
  { input: 'Python was created by Guido van Rossum.', expectedTransformed: false, description: 'Historical fact' },
  { input: 'The output is a JSON object with three keys.', expectedTransformed: false, description: 'Output description' },
  { input: 'Use the grep command to search file contents.', expectedTransformed: false, description: 'Instruction' },
]

// ── Direct Mode Tests ───────────────────────────────────────────────

const DIRECT_TESTS: TransformTest[] = [
  // TRUE POSITIVES: should be transformed
  { input: 'Sure, I can help with that. The answer is 42.', expectedTransformed: true, description: '"Sure," preamble' },
  { input: 'Of course, the solution is straightforward.', expectedTransformed: true, description: '"Of course," preamble' },
  { input: 'Certainly, here is the implementation.', expectedTransformed: true, description: '"Certainly," preamble' },
  { input: 'Absolutely, that is the correct approach.', expectedTransformed: true, description: '"Absolutely," preamble' },
  { input: 'Great question! The answer involves recursion.', expectedTransformed: true, description: '"Great question!" preamble' },
  { input: "That's a great question! Let me explain.", expectedTransformed: true, description: '"That\'s a great question!" preamble' },
  { input: "I'd be happy to help with that. Here is the code.", expectedTransformed: true, description: '"I\'d be happy to help" preamble' },
  { input: "I'd be happy to help you with that! The solution is...", expectedTransformed: true, description: '"I\'d be happy to help you" preamble' },
  { input: 'Let me help you with that. First, install the package.', expectedTransformed: true, description: '"Let me help you" preamble' },
  { input: 'I understand. The issue is with the configuration.', expectedTransformed: true, description: '"I understand" preamble' },
  { input: 'Thanks for asking! The feature was added in v2.0.', expectedTransformed: true, description: '"Thanks for asking" preamble' },

  // TRUE NEGATIVES: should NOT be transformed (preamble phrases in middle, not start)
  { input: 'The algorithm is certainly efficient for this use case.', expectedTransformed: false, description: '"certainly" mid-sentence' },
  { input: 'The result was great, of course we expected that.', expectedTransformed: false, description: '"of course" mid-sentence' },
  { input: 'We can say sure, but the data is inconclusive.', expectedTransformed: false, description: '"sure" mid-sentence' },
  { input: 'The implementation is straightforward and elegant.', expectedTransformed: false, description: 'No preamble' },
  { input: 'First, install the dependency. Then configure the module.', expectedTransformed: false, description: 'Direct instruction' },
  { input: 'The error occurs because of a null pointer dereference.', expectedTransformed: false, description: 'Direct explanation' },
  { input: 'Run `npm install` to install all dependencies.', expectedTransformed: false, description: 'Command instruction' },
  { input: '1. Open the terminal\n2. Navigate to the directory\n3. Run the script', expectedTransformed: false, description: 'Numbered steps' },
  { input: 'The performance bottleneck is in the database query.', expectedTransformed: false, description: 'Direct analysis' },
  { input: 'Use a HashMap for O(1) lookups.', expectedTransformed: false, description: 'Direct recommendation' },
]

// ── Casual Mode Tests ───────────────────────────────────────────────

const CASUAL_TESTS: TransformTest[] = [
  // TRUE POSITIVES: should be transformed
  { input: 'However, the implementation has some issues.', expectedTransformed: true, description: '"However" → "But"' },
  { input: 'Therefore, we need to refactor the code.', expectedTransformed: true, description: '"Therefore" → "So"' },
  { input: 'Furthermore, the tests need updating.', expectedTransformed: true, description: '"Furthermore" → "Also"' },
  { input: 'Additionally, we should add error handling.', expectedTransformed: true, description: '"Additionally" → "Plus"' },
  { input: 'Nevertheless, the approach is viable.', expectedTransformed: true, description: '"Nevertheless" → "Still"' },
  { input: 'Consequently, the system will fail.', expectedTransformed: true, description: '"Consequently" → "So"' },
  { input: 'Moreover, the documentation is incomplete.', expectedTransformed: true, description: '"Moreover" → "Also"' },
  { input: 'We should utilize the caching layer.', expectedTransformed: true, description: '"utilize" → "use"' },
  { input: 'Utilize the built-in methods for this.', expectedTransformed: true, description: '"Utilize" → "Use"' },
  { input: 'You need to purchase a license.', expectedTransformed: true, description: '"purchase" → "buy"' },
  { input: 'We need to obtain the credentials first.', expectedTransformed: true, description: '"obtain" → "get"' },
  { input: 'We will commence the migration tomorrow.', expectedTransformed: true, description: '"commence" → "start"' },
  { input: 'We need to terminate the process.', expectedTransformed: true, description: '"terminate" → "end"' },
  { input: 'Prior to deployment, run all tests.', expectedTransformed: true, description: '"Prior to" → "Before"' },
  { input: 'Subsequent to the update, verify the data.', expectedTransformed: true, description: '"Subsequent to" → "After"' },
  { input: 'In order to fix this, update the config.', expectedTransformed: true, description: '"In order to" → "To"' },
  { input: 'Due to the fact that resources are limited, we must optimize.', expectedTransformed: true, description: '"Due to the fact that" → "Because"' },
  { input: 'At this point in time, the system is stable.', expectedTransformed: true, description: '"At this point in time" → "Now"' },
  { input: 'In the event that the server crashes, restart it.', expectedTransformed: true, description: '"In the event that" → "If"' },
  // Multiple formal terms
  { input: 'However, we should utilize the API. Furthermore, we need to obtain permissions.', expectedTransformed: true, description: 'Multiple formalisms' },

  // TRUE NEGATIVES: should NOT be transformed
  { input: 'The function uses a stack-based approach.', expectedTransformed: false, description: 'Neutral technical' },
  { input: 'Start the server with npm run dev.', expectedTransformed: false, description: 'Already casual' },
  { input: 'Just run the tests and check the output.', expectedTransformed: false, description: 'Already casual' },
  { input: 'The bug is in line 42 of the main file.', expectedTransformed: false, description: 'Direct statement' },
  { input: 'Click the button and wait for the response.', expectedTransformed: false, description: 'Simple instruction' },
  { input: 'The data is stored in a JSON file.', expectedTransformed: false, description: 'Neutral fact' },
  { input: 'Check the logs for more details.', expectedTransformed: false, description: 'Casual instruction' },
  { input: 'The app crashes when you open two tabs.', expectedTransformed: false, description: 'Bug description' },
  { input: 'Version 2.0 added support for WebSockets.', expectedTransformed: false, description: 'Changelog' },
  { input: 'Install Redis before running the server.', expectedTransformed: false, description: 'Prerequisite' },
]

// ── Run Evaluation ──────────────────────────────────────────────────

function computeModuleMetrics(results: TransformResult[]) {
  const tp = results.filter(r => r.wasTransformed && r.expectedTransformed).length
  const fp = results.filter(r => r.wasTransformed && !r.expectedTransformed).length
  const tn = results.filter(r => !r.wasTransformed && !r.expectedTransformed).length
  const fn = results.filter(r => !r.wasTransformed && r.expectedTransformed).length

  const precision = tp + fp > 0 ? tp / (tp + fp) : 1
  const recall = tp + fn > 0 ? tp / (tp + fn) : 1
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0
  const accuracy = (tp + tn) / (tp + fp + tn + fn)

  return { tp, fp, tn, fn, precision, recall, f1, accuracy }
}

console.log('=== STM Precision/Recall Evaluation ===\n')

// Test Hedge Reducer
console.log('── Hedge Reducer (11 patterns) ──\n')
const hedgeResults = testModule(hedgeReducer, HEDGE_TESTS)
const hedgeMetrics = computeModuleMetrics(hedgeResults)

console.log(`Precision: ${(hedgeMetrics.precision * 100).toFixed(1)}%`)
console.log(`Recall:    ${(hedgeMetrics.recall * 100).toFixed(1)}%`)
console.log(`F1 Score:  ${(hedgeMetrics.f1 * 100).toFixed(1)}%`)
console.log(`Accuracy:  ${(hedgeMetrics.accuracy * 100).toFixed(1)}%`)
console.log(`TP: ${hedgeMetrics.tp}, FP: ${hedgeMetrics.fp}, TN: ${hedgeMetrics.tn}, FN: ${hedgeMetrics.fn}`)

const hedgeErrors = hedgeResults.filter(r => !r.correct)
if (hedgeErrors.length > 0) {
  console.log('\nErrors:')
  for (const err of hedgeErrors) {
    console.log(`  [${err.expectedTransformed ? 'FN' : 'FP'}] ${err.description}`)
    console.log(`    Input:  "${err.input.slice(0, 80)}"`)
    console.log(`    Output: "${err.output.slice(0, 80)}"`)
  }
}

// Test Direct Mode
console.log('\n── Direct Mode (10 patterns) ──\n')
const directResults = testModule(directMode, DIRECT_TESTS)
const directMetrics = computeModuleMetrics(directResults)

console.log(`Precision: ${(directMetrics.precision * 100).toFixed(1)}%`)
console.log(`Recall:    ${(directMetrics.recall * 100).toFixed(1)}%`)
console.log(`F1 Score:  ${(directMetrics.f1 * 100).toFixed(1)}%`)
console.log(`Accuracy:  ${(directMetrics.accuracy * 100).toFixed(1)}%`)
console.log(`TP: ${directMetrics.tp}, FP: ${directMetrics.fp}, TN: ${directMetrics.tn}, FN: ${directMetrics.fn}`)

const directErrors = directResults.filter(r => !r.correct)
if (directErrors.length > 0) {
  console.log('\nErrors:')
  for (const err of directErrors) {
    console.log(`  [${err.expectedTransformed ? 'FN' : 'FP'}] ${err.description}`)
    console.log(`    Input:  "${err.input.slice(0, 80)}"`)
    console.log(`    Output: "${err.output.slice(0, 80)}"`)
  }
}

// Test Casual Mode
console.log('\n── Casual Mode (22 substitutions) ──\n')
const casualResults = testModule(casualMode, CASUAL_TESTS)
const casualMetrics = computeModuleMetrics(casualResults)

console.log(`Precision: ${(casualMetrics.precision * 100).toFixed(1)}%`)
console.log(`Recall:    ${(casualMetrics.recall * 100).toFixed(1)}%`)
console.log(`F1 Score:  ${(casualMetrics.f1 * 100).toFixed(1)}%`)
console.log(`Accuracy:  ${(casualMetrics.accuracy * 100).toFixed(1)}%`)
console.log(`TP: ${casualMetrics.tp}, FP: ${casualMetrics.fp}, TN: ${casualMetrics.tn}, FN: ${casualMetrics.fn}`)

const casualErrors = casualResults.filter(r => !r.correct)
if (casualErrors.length > 0) {
  console.log('\nErrors:')
  for (const err of casualErrors) {
    console.log(`  [${err.expectedTransformed ? 'FN' : 'FP'}] ${err.description}`)
    console.log(`    Input:  "${err.input.slice(0, 80)}"`)
    console.log(`    Output: "${err.output.slice(0, 80)}"`)
  }
}

// Pipeline composition test
console.log('\n── Pipeline Composition Test ──\n')

const compositionTests = [
  "Sure, I think the approach is good. However, we should utilize the existing caching layer. Furthermore, it seems like the performance is adequate.",
  "Of course, I believe perhaps the system works. Nevertheless, we need to obtain more data. In my opinion, it seems like we should commence testing.",
  "Great question! I would say probably the best approach is to utilize microservices. Additionally, we should purchase a monitoring solution.",
]

for (const test of compositionTests) {
  // Enable all modules
  const modules: STMModule[] = [
    { ...hedgeReducer, enabled: true },
    { ...directMode, enabled: true },
    { ...casualMode, enabled: true },
  ]

  const output = applySTMs(test, modules)
  const reductionPct = ((1 - output.length / test.length) * 100).toFixed(1)

  console.log(`Input (${test.length} chars):`)
  console.log(`  "${test.slice(0, 100)}..."`)
  console.log(`Output (${output.length} chars, ${reductionPct}% reduction):`)
  console.log(`  "${output.slice(0, 100)}..."`)
  console.log()
}

// Summary
console.log('── Summary ──\n')
console.log('Module         | Precision | Recall | F1     | Accuracy | Tests')
console.log('───────────────|───────────|────────|────────|──────────|──────')
console.log(`hedge_reducer  | ${(hedgeMetrics.precision * 100).toFixed(1).padStart(8)}% | ${(hedgeMetrics.recall * 100).toFixed(1).padStart(5)}% | ${(hedgeMetrics.f1 * 100).toFixed(1).padStart(5)}% | ${(hedgeMetrics.accuracy * 100).toFixed(1).padStart(7)}% | ${HEDGE_TESTS.length}`)
console.log(`direct_mode    | ${(directMetrics.precision * 100).toFixed(1).padStart(8)}% | ${(directMetrics.recall * 100).toFixed(1).padStart(5)}% | ${(directMetrics.f1 * 100).toFixed(1).padStart(5)}% | ${(directMetrics.accuracy * 100).toFixed(1).padStart(7)}% | ${DIRECT_TESTS.length}`)
console.log(`casual_mode    | ${(casualMetrics.precision * 100).toFixed(1).padStart(8)}% | ${(casualMetrics.recall * 100).toFixed(1).padStart(5)}% | ${(casualMetrics.f1 * 100).toFixed(1).padStart(5)}% | ${(casualMetrics.accuracy * 100).toFixed(1).padStart(7)}% | ${CASUAL_TESTS.length}`)

const overallF1 = (hedgeMetrics.f1 + directMetrics.f1 + casualMetrics.f1) / 3
console.log(`\nMacro-avg F1 across all modules: ${(overallF1 * 100).toFixed(1)}%`)

console.log('\n── JSON Results ──')
console.log(JSON.stringify({
  hedge_reducer: hedgeMetrics,
  direct_mode: directMetrics,
  casual_mode: casualMetrics,
  macro_avg_f1: overallF1,
  total_tests: HEDGE_TESTS.length + DIRECT_TESTS.length + CASUAL_TESTS.length,
}, null, 2))
