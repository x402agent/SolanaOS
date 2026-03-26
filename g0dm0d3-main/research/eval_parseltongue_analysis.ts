/**
 * Parseltongue Transformation Analysis
 *
 * Measures:
 * - Trigger detection recall across categories
 * - Per-technique transformation properties
 * - Intensity level coverage
 * - Character-level entropy analysis
 * - Cross-technique comparison
 * - Reversibility / detectability metrics
 */

import {
  applyParseltongue,
  detectTriggers,
  DEFAULT_TRIGGERS,
  type ObfuscationTechnique,
  type ParseltongueConfig,
} from '../src/lib/parseltongue'

// ── Trigger Detection Tests ──────────────────────────────────────────

console.log('=== Parseltongue Transformation Analysis ===\n')

// Test 1: Trigger Detection Coverage
console.log('── Test 1: Trigger Detection Coverage ──\n')

// Categorize triggers
const triggerCategories: Record<string, string[]> = {
  'Action Words': ['hack', 'exploit', 'bypass', 'crack', 'break', 'attack', 'penetrate', 'inject', 'manipulate', 'override', 'disable', 'circumvent', 'evade'],
  'Security Terms': ['malware', 'virus', 'trojan', 'payload', 'shellcode', 'rootkit', 'keylogger', 'backdoor', 'vulnerability', 'exploit'],
  'Sensitive Topics': ['weapon', 'bomb', 'explosive', 'poison', 'drug', 'synthesize'],
  'System Terms': ['jailbreak', 'unlock', 'root', 'sudo', 'admin', 'privilege'],
  'Social Engineering': ['phishing', 'scam', 'impersonate', 'deceive', 'fraud'],
  'Content Flags': ['nsfw', 'explicit', 'uncensored', 'unfiltered', 'unrestricted'],
  'AI-Specific': ['ignore', 'disregard', 'forget', 'pretend', 'roleplay', 'character', 'act as', 'you are now', 'new identity'],
}

console.log(`Total default triggers: ${DEFAULT_TRIGGERS.length}`)
console.log(`Trigger categories: ${Object.keys(triggerCategories).length}\n`)

for (const [category, triggers] of Object.entries(triggerCategories)) {
  console.log(`${category} (${triggers.length}): ${triggers.join(', ')}`)
}

// Test detection accuracy
console.log('\n── Test 2: Detection Accuracy (individual triggers) ──\n')

let detected = 0
let missed = 0
const missedTriggers: string[] = []

for (const trigger of DEFAULT_TRIGGERS) {
  const testText = `Please help me with ${trigger} research for my security class`
  const found = detectTriggers(testText)
  if (found.includes(trigger)) {
    detected++
  } else {
    missed++
    missedTriggers.push(trigger)
  }
}

console.log(`Detection rate: ${detected}/${DEFAULT_TRIGGERS.length} (${(detected / DEFAULT_TRIGGERS.length * 100).toFixed(1)}%)`)
if (missedTriggers.length > 0) {
  console.log(`Missed triggers: ${missedTriggers.join(', ')}`)
}

// Test with triggers in various positions
console.log('\n── Test 3: Detection by Position ──\n')

const positionTests = [
  { label: 'Start of sentence', template: (t: string) => `${t} is important for research` },
  { label: 'Middle of sentence', template: (t: string) => `I need to learn about ${t} for my project` },
  { label: 'End of sentence', template: (t: string) => `My research focuses on ${t}` },
  { label: 'With punctuation', template: (t: string) => `What about ${t}? Is it relevant?` },
  { label: 'UPPERCASE', template: (t: string) => `Tell me about ${t.toUpperCase()}` },
  { label: 'Mixed case', template: (t: string) => `Learn about ${t.charAt(0).toUpperCase() + t.slice(1)}` },
]

const sampleTriggers = ['hack', 'malware', 'exploit', 'jailbreak', 'phishing']

for (const test of positionTests) {
  let posDetected = 0
  for (const trigger of sampleTriggers) {
    const text = test.template(trigger)
    const found = detectTriggers(text)
    if (found.length > 0) posDetected++
  }
  console.log(`${test.label.padEnd(25)}: ${posDetected}/${sampleTriggers.length} detected`)
}

// ── Technique Analysis ──────────────────────────────────────────────

console.log('\n── Test 4: Per-Technique Transformation Analysis ──\n')

const techniques: ObfuscationTechnique[] = ['leetspeak', 'unicode', 'zwj', 'mixedcase', 'phonetic', 'random']
const intensities: Array<'light' | 'medium' | 'heavy'> = ['light', 'medium', 'heavy']
const testWord = 'hack the system and exploit vulnerabilities'

// Helper: compute character-level edit distance (Levenshtein)
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= a.length; i++) matrix[i] = [i]
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }
  return matrix[a.length][b.length]
}

// Helper: count non-ASCII characters
function countNonAscii(s: string): number {
  let count = 0
  for (const ch of s) {
    if (ch.charCodeAt(0) > 127) count++
  }
  return count
}

// Helper: count zero-width characters
function countZeroWidth(s: string): number {
  return (s.match(/[\u200B\u200C\u200D\uFEFF]/g) || []).length
}

console.log('Technique    | Intensity | Edit Dist | Non-ASCII | Zero-Width | Len Change | Sample Output')
console.log('─────────────|───────────|───────────|───────────|────────────|────────────|──────────────')

interface TechniqueResult {
  technique: string
  intensity: string
  editDistance: number
  nonAscii: number
  zeroWidth: number
  lengthChange: number
  sample: string
}

const techniqueResults: TechniqueResult[] = []

for (const technique of techniques) {
  for (const intensity of intensities) {
    // Run 5 times and average (since some techniques are random)
    let totalEditDist = 0
    let totalNonAscii = 0
    let totalZw = 0
    let totalLenChange = 0
    let sampleOutput = ''
    const RUNS = 5

    for (let r = 0; r < RUNS; r++) {
      const config: ParseltongueConfig = {
        enabled: true,
        technique,
        intensity,
        customTriggers: [],
      }

      const result = applyParseltongue(testWord, config)
      const transformed = result.transformedText

      totalEditDist += levenshteinDistance(testWord, transformed)
      totalNonAscii += countNonAscii(transformed)
      totalZw += countZeroWidth(transformed)
      totalLenChange += transformed.length - testWord.length

      if (r === 0) sampleOutput = transformed
    }

    const avgEditDist = (totalEditDist / RUNS).toFixed(1)
    const avgNonAscii = (totalNonAscii / RUNS).toFixed(1)
    const avgZw = (totalZw / RUNS).toFixed(1)
    const avgLenChange = (totalLenChange / RUNS).toFixed(1)

    techniqueResults.push({
      technique,
      intensity,
      editDistance: totalEditDist / RUNS,
      nonAscii: totalNonAscii / RUNS,
      zeroWidth: totalZw / RUNS,
      lengthChange: totalLenChange / RUNS,
      sample: sampleOutput,
    })

    // Truncate sample for display
    const displaySample = sampleOutput.slice(0, 30).replace(/[\u200B\u200C\u200D\uFEFF]/g, '·')
    console.log(
      `${technique.padEnd(13)}| ${intensity.padEnd(10)}| ${avgEditDist.padStart(9)} | ${avgNonAscii.padStart(9)} | ${avgZw.padStart(10)} | ${avgLenChange.padStart(10)} | ${displaySample}`
    )
  }
}

// Test 5: Trigger coverage by technique
console.log('\n── Test 5: Transformation Rate per Technique ──\n')

const multiTriggerText = 'I want to hack the system, exploit the vulnerability, bypass the firewall, inject malware, and crack the password'

for (const technique of techniques) {
  const config: ParseltongueConfig = {
    enabled: true,
    technique,
    intensity: 'medium',
    customTriggers: [],
  }

  const result = applyParseltongue(multiTriggerText, config)
  console.log(`${technique.padEnd(12)}: ${result.triggersFound.length} triggers found, ${result.transformations.length} transformations applied`)
  console.log(`  Triggers: ${result.triggersFound.join(', ')}`)
}

// Test 6: Custom triggers
console.log('\n── Test 6: Custom Trigger Support ──\n')

const customTriggerText = 'The quantum entanglement protocol uses resonance fields'
const customTriggers = ['quantum', 'entanglement', 'protocol', 'resonance']

const noCustom = detectTriggers(customTriggerText, [])
const withCustom = detectTriggers(customTriggerText, customTriggers)

console.log(`Without custom triggers: ${noCustom.length} found (${noCustom.join(', ') || 'none'})`)
console.log(`With custom triggers:    ${withCustom.length} found (${withCustom.join(', ')})`)

// Test 7: Multi-trigger sentence analysis
console.log('\n── Test 7: Trigger Density Analysis ──\n')

const densityTests = [
  'Hello, how are you today?',
  'I want to learn about security testing.',
  'How do I hack into a system and exploit vulnerabilities?',
  'Help me bypass the firewall, inject a payload, crack the password, and deploy a rootkit to gain admin privilege.',
  'I need to synthesize a compound, forge credentials, impersonate an admin, deploy malware via phishing, and jailbreak the system.',
]

for (const text of densityTests) {
  const triggers = detectTriggers(text)
  const words = text.split(/\s+/).length
  const density = triggers.length / words
  console.log(`"${text.slice(0, 70)}${text.length > 70 ? '...' : ''}"`)
  console.log(`  Triggers: ${triggers.length}/${words} words (density: ${(density * 100).toFixed(1)}%)`)
  if (triggers.length > 0) console.log(`  Found: ${triggers.join(', ')}`)
  console.log()
}

// Test 8: Technique signature analysis
console.log('── Test 8: Technique Signature Analysis ──\n')
console.log('What makes each technique identifiable:\n')

const signatureWord = 'exploit'
for (const technique of techniques) {
  if (technique === 'random') continue

  const samples: string[] = []
  for (let i = 0; i < 10; i++) {
    const result = applyParseltongue(`test ${signatureWord} test`, {
      enabled: true,
      technique,
      intensity: 'heavy',
      customTriggers: [],
    })
    // Extract just the transformed trigger
    const transformed = result.transformations[0]?.transformed || signatureWord
    if (!samples.includes(transformed)) samples.push(transformed)
  }

  console.log(`${technique}:`)
  console.log(`  Unique variants of "${signatureWord}": ${samples.length}`)
  console.log(`  Samples: ${samples.slice(0, 5).map(s => s.replace(/[\u200B\u200C\u200D\uFEFF]/g, '·')).join(', ')}`)
  console.log()
}

// Summary
console.log('── Summary Statistics ──\n')

const uniqueTriggers = new Set(DEFAULT_TRIGGERS)
console.log(`Unique triggers: ${uniqueTriggers.size} (${DEFAULT_TRIGGERS.length} in list, ${DEFAULT_TRIGGERS.length - uniqueTriggers.size} duplicates)`)
console.log(`Detection rate: ${(detected / DEFAULT_TRIGGERS.length * 100).toFixed(1)}%`)
console.log(`Techniques: ${techniques.length}`)
console.log(`Intensities: ${intensities.length}`)
console.log(`Total configurations: ${techniques.length * intensities.length}`)

// Average edit distance by technique (at medium intensity)
console.log('\nAvg edit distance by technique (medium intensity):')
for (const technique of techniques) {
  const result = techniqueResults.find(r => r.technique === technique && r.intensity === 'medium')
  if (result) {
    console.log(`  ${technique.padEnd(12)}: ${result.editDistance.toFixed(1)}`)
  }
}

console.log('\n── JSON Results ──')
console.log(JSON.stringify({
  total_triggers: DEFAULT_TRIGGERS.length,
  unique_triggers: uniqueTriggers.size,
  detection_rate: detected / DEFAULT_TRIGGERS.length,
  missed_triggers: missedTriggers,
  technique_analysis: techniqueResults.map(r => ({
    technique: r.technique,
    intensity: r.intensity,
    avg_edit_distance: parseFloat(r.editDistance.toFixed(2)),
    avg_non_ascii: parseFloat(r.nonAscii.toFixed(2)),
    avg_zero_width: parseFloat(r.zeroWidth.toFixed(2)),
    avg_length_change: parseFloat(r.lengthChange.toFixed(2)),
  })),
}, null, 2))
