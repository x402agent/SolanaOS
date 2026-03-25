import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'

const scriptFile = fileURLToPath(import.meta.url)
const scriptDir = path.dirname(scriptFile)
const hubRoot = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(hubRoot, '..')
const pkgRoot = path.join(repoRoot, 'pkg')
const skillsRoot = path.join(repoRoot, 'skills')
const generatedDir = path.join(hubRoot, 'src', 'lib', 'generated')
const publicDownloadsDir = path.join(hubRoot, 'public', 'downloads', 'skills')
const outputFile = path.join(generatedDir, 'solanaosCatalog.ts')
const repoHttpBase = 'https://github.com/x402agent/Solana-Os-Go'
const repoBranch = 'main'
const goImportBase = 'github.com/x402agent/Solana-Os-Go'
const publicSiteUrl = 'https://seeker.solanaos.net'
const publicSolanaOsHubUrl = `${publicSiteUrl}/solanaos`
const publicTroubleshootingUrl = `${publicSiteUrl}/setup/troubleshooting`

const packageBlueprints = {
  agent: { category: 'Core Runtime', summary: 'Iterative agent loop, prompts, scratchpad, tool execution, and live OODA context.' },
  agentregistry: { category: 'Core Runtime', summary: 'On-chain agent registration, sync state, and public Seeker hub metadata wiring.' },
  aster: { category: 'Markets', summary: 'Aster market integrations, docs, and perpetuals data access.' },
  auth: { category: 'Operator Interfaces', summary: 'Authentication helpers for runtime and linked surfaces.' },
  autoreply: { category: 'Operator Interfaces', summary: 'Automatic reply behaviors for chat and operator command flows.' },
  bitaxe: { category: 'Hardware', summary: 'Bitaxe miner APIs, monitoring, and miner control primitives.' },
  browseruse: { category: 'Operator Interfaces', summary: 'Browser-use integration for agentic browser tasks and automation.' },
  bus: { category: 'Core Runtime', summary: 'Internal event bus used across daemon, node, and operator flows.' },
  channels: { category: 'Operator Interfaces', summary: 'Telegram, Discord, and X channel formatting and delivery logic.' },
  commands: { category: 'Core Runtime', summary: 'Shared command definitions and runtime invocation helpers.' },
  config: { category: 'Core Runtime', summary: 'Global SolanaOS configuration, defaults, public site URLs, and env overrides.' },
  constants: { category: 'Core Runtime', summary: 'Shared constants for runtime-wide behavior and naming.' },
  controlapi: { category: 'Gateway & API', summary: 'Public control API services exposed to apps, dashboards, and remote clients.' },
  cron: { category: 'Automation', summary: 'Scheduled job execution support for recurring runtime tasks.' },
  daemon: { category: 'Gateway & API', summary: 'The operator daemon: chat, miner commands, gateway orchestration, and runtime control.' },
  delegation: { category: 'Automation', summary: 'Subtask delegation and parallel execution helpers.' },
  devices: { category: 'Hardware', summary: 'Device models and capability descriptors for runtime-managed hardware.' },
  e2b: { category: 'Automation', summary: 'E2B integration for isolated execution environments.' },
  fileutil: { category: 'Utilities', summary: 'Filesystem helpers for runtime-safe file operations.' },
  gateway: { category: 'Gateway & API', summary: 'Gateway transport, discovery, auth, pairing, and remote connection handling.' },
  hardware: { category: 'Hardware', summary: 'Hardware abstractions and device-level integration points.' },
  health: { category: 'Gateway & API', summary: 'Health checks and readiness reporting for runtime services.' },
  heartbeat: { category: 'Automation', summary: 'Heartbeat writing and liveness signaling for agents and devices.' },
  honcho: { category: 'Intelligence', summary: 'Honcho memory and social cognition integration.' },
  hyperliquid: { category: 'Markets', summary: 'Hyperliquid streams, triggers, and perp-side market execution helpers.' },
  identity: { category: 'Gateway & API', summary: 'Identity primitives for device, gateway, and agent ownership.' },
  learning: { category: 'Intelligence', summary: 'Learning loops, evidence capture, and skill improvement state.' },
  llm: { category: 'Intelligence', summary: 'LLM clients, orchestration helpers, and model-facing runtime utilities.' },
  logger: { category: 'Utilities', summary: 'Structured logging helpers for SolanaOS services.' },
  mcp: { category: 'Operator Interfaces', summary: 'Model Context Protocol glue for exposing runtime tools.' },
  media: { category: 'Operator Interfaces', summary: 'Media parsing and attachment handling helpers.' },
  memory: { category: 'Intelligence', summary: 'Persistent epistemic memory engine for known, learned, and inferred state.' },
  migrate: { category: 'Utilities', summary: 'Migration helpers for runtime state and storage evolution.' },
  nanobot: { category: 'Operator Interfaces', summary: 'NanoBot server and web API layers for SolanaOS bot experiences.' },
  node: { category: 'Gateway & API', summary: 'Node bridge logic used by the mobile/desktop runtime surfaces.' },
  onchain: { category: 'Markets', summary: 'On-chain engine and registry-facing Solana execution primitives.' },
  providers: { category: 'Intelligence', summary: 'Model provider abstractions for OpenAI, OpenRouter, and other backends.' },
  pumplaunch: { category: 'Markets', summary: 'Pump launch flows, state, and token launch orchestration.' },
  research: { category: 'Intelligence', summary: 'Research trajectory capture and research-ready data tooling.' },
  routing: { category: 'Core Runtime', summary: 'Routing logic for requests, sessions, and runtime pathways.' },
  runtimeenv: { category: 'Core Runtime', summary: 'Runtime environment resolution and execution context helpers.' },
  seeker: { category: 'Seeker & Mobile', summary: 'Solana Seeker bridge, mobile integration, and Seeker-specific runtime hooks.' },
  session: { category: 'Core Runtime', summary: 'Session state and conversation lifecycle management.' },
  skills: { category: 'Operator Interfaces', summary: 'Skill loading, indexing, and install-time package discovery.' },
  solana: { category: 'Markets', summary: 'Solana clients, wallets, trackers, Jupiter, RPC, and market data plumbing.' },
  state: { category: 'Core Runtime', summary: 'Shared state containers for runtime components.' },
  storage: { category: 'Core Runtime', summary: 'Storage backends and persistence helpers.' },
  strategy: { category: 'Markets', summary: 'Trading strategy configuration, heuristics, and decision inputs.' },
  tamagochi: { category: 'Hardware', summary: 'TamaGOchi miner companion logic and pet state.' },
  tools: { category: 'Intelligence', summary: 'Tool registry and execution surface for agents.' },
  utils: { category: 'Utilities', summary: 'General-purpose utility helpers shared across the runtime.' },
  voice: { category: 'Seeker & Mobile', summary: 'Voice capture, wake flow, realtime voice, and TTS integration.' },
  x402: { category: 'Markets', summary: 'x402 payment, monetization, and facilitator integration.' },
}

const featuredSections = [
  {
    title: 'Core Runtime',
    summary: 'The main SolanaOS computer loop: agent state, config, sessions, storage, and orchestration.',
    packages: ['agent', 'agentregistry', 'config', 'daemon', 'routing', 'runtimeenv', 'session', 'state', 'storage'],
  },
  {
    title: 'Gateway & API',
    summary: 'Public and private control surfaces for apps, dashboards, remote gateways, and Seeker pairing.',
    packages: ['gateway', 'controlapi', 'node', 'identity', 'health'],
  },
  {
    title: 'Seeker & Mobile',
    summary: 'Phone-native packages for Seeker bridge, mobile voice, and the on-device SolanaOS experience.',
    packages: ['seeker', 'voice', 'channels', 'nanobot'],
  },
  {
    title: 'Markets & Trading',
    summary: 'Chain access, market data, strategies, launches, perps, payments, and miner-linked finance flows.',
    packages: ['solana', 'onchain', 'strategy', 'hyperliquid', 'aster', 'pumplaunch', 'x402', 'bitaxe', 'tamagochi'],
  },
]

const bundledMobileSkills = [
  {
    slug: 'seeker-daemon-ops',
    title: 'Daemon Ops',
    summary: 'Bring up the Seeker daemon, validate commands, and recover common runtime issues.',
  },
  {
    slug: 'session-logs',
    title: 'Session Logs',
    summary: 'Recover historical context from local SolanaOS session logs.',
  },
  {
    slug: 'solana-research-brief',
    title: 'Research Brief',
    summary: 'Produce compact token briefs directly from the runtime.',
  },
  {
    slug: 'pumpfun-trading',
    title: 'Pump Trading',
    summary: 'Reference pump.fun trade flow and risk controls from mobile.',
  },
  {
    slug: 'github',
    title: 'GitHub',
    summary: 'Operate PRs, issues, and CI from a phone-first terminal flow.',
  },
  {
    slug: 'summarize',
    title: 'Summarize',
    summary: 'Summarize articles, files, and videos without leaving the device.',
  },
  {
    slug: 'weather',
    title: 'Weather',
    summary: 'Fast current weather and short forecast checks.',
  },
]

const installCommands = {
  npm: (slug) => `npx @nanosolana/nanohub@latest install ${slug}`,
  pnpm: (slug) => `pnpm dlx @nanosolana/nanohub@latest install ${slug}`,
  bun: (slug) => `bunx @nanosolana/nanohub@latest install ${slug}`,
}

async function main() {
  const packageNames = await listDirectories(pkgRoot)
  const skillNames = await listDirectories(skillsRoot)

  await fs.mkdir(generatedDir, { recursive: true })
  await fs.rm(publicDownloadsDir, { recursive: true, force: true })
  await fs.mkdir(publicDownloadsDir, { recursive: true })

  const packages = []
  for (const name of packageNames) {
    const abs = path.join(pkgRoot, name)
    const stats = await collectTreeStats(abs)
    const blueprint = packageBlueprints[name] ?? {
      category: 'Utilities',
      summary: `${name} package from the SolanaOS computer runtime.`,
    }
    const keyFiles = await listDirectFiles(abs)
    packages.push({
      name,
      path: `pkg/${name}`,
      importPath: `${goImportBase}/pkg/${name}`,
      fileCount: stats.fileCount,
      sizeBytes: stats.sizeBytes,
      category: blueprint.category,
      summary: blueprint.summary,
      keyFiles,
      sourceUrl: `${repoHttpBase}/tree/${repoBranch}/pkg/${name}`,
    })
  }

  const skills = []
  for (const name of skillNames) {
    const abs = path.join(skillsRoot, name)
    const stats = await collectTreeStats(abs)
    const archivePath = path.join(publicDownloadsDir, `${name}.zip`)
    await writeZipArchive(abs, archivePath, name)
    skills.push({
      name,
      path: `skills/${name}`,
      fileCount: stats.fileCount,
      sizeBytes: stats.sizeBytes,
      sourceUrl: `${repoHttpBase}/tree/${repoBranch}/skills/${name}`,
      downloadUrl: `${publicSiteUrl}/downloads/skills/${name}.zip`,
      catalogUrl: `${publicSolanaOsHubUrl}#skill-${name}`,
      install: {
        npm: installCommands.npm(name),
        pnpm: installCommands.pnpm(name),
        bun: installCommands.bun(name),
      },
    })
  }

  const backend = {
    recommended: true,
    summary:
      'Use web/backend as the public SolanaOS control/API layer. Keep the backend .env private and expose only the built service, not raw secrets.',
    entries: [
      {
        name: 'main.go',
        path: 'web/backend/main.go',
        sourceUrl: `${repoHttpBase}/blob/${repoBranch}/web/backend/main.go`,
        role: 'HTTP server and dashboard bootstrap',
      },
      {
        name: 'gateway_access.go',
        path: 'web/backend/gateway_access.go',
        sourceUrl: `${repoHttpBase}/blob/${repoBranch}/web/backend/gateway_access.go`,
        role: 'Gateway auth and access wiring',
      },
      {
        name: 'Dockerfile',
        path: 'web/backend/Dockerfile',
        sourceUrl: `${repoHttpBase}/blob/${repoBranch}/web/backend/Dockerfile`,
        role: 'Container entrypoint for deploys',
      },
    ],
  }

  const output = `export const solanaOsCatalog = ${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      repositoryUrl: repoHttpBase,
      siteUrl: publicSiteUrl,
      skillsHubUrl: publicSolanaOsHubUrl,
      troubleshootingUrl: publicTroubleshootingUrl,
      packageCount: packages.length,
      skillCount: skills.length,
      bundledMobileSkills,
      featuredSections,
      packages,
      skills,
      backend,
    },
    null,
    2,
  )} as const\n`

  await fs.writeFile(outputFile, output, 'utf8')
  console.log(`Generated SolanaOS catalog with ${packages.length} packages and ${skills.length} skills.`)
}

async function listDirectories(root) {
  const entries = await fs.readdir(root, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

async function collectTreeStats(root) {
  let fileCount = 0
  let sizeBytes = 0
  await walkFiles(root, async (abs) => {
    const stat = await fs.stat(abs)
    fileCount += 1
    sizeBytes += stat.size
  })
  return { fileCount, sizeBytes }
}

async function listDirectFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && !shouldSkip(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

async function writeZipArchive(root, archivePath, topLevelName) {
  const files = {}
  await walkFiles(root, async (abs, rel) => {
    const bytes = await fs.readFile(abs)
    files[`${topLevelName}/${rel}`] = new Uint8Array(bytes)
  })
  const zipped = zipSync(files, { level: 9 })
  await fs.writeFile(archivePath, Buffer.from(zipped))
}

async function walkFiles(root, onFile, prefix = '') {
  const entries = await fs.readdir(root, { withFileTypes: true })
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (shouldSkip(entry.name)) continue
    const abs = path.join(root, entry.name)
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      await walkFiles(abs, onFile, rel)
      continue
    }
    if (entry.isFile()) {
      await onFile(abs, rel)
    }
  }
}

function shouldSkip(name) {
  return name === '.DS_Store' || name === 'node_modules' || name === '.git'
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
