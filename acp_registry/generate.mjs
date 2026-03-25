#!/usr/bin/env node

/**
 * ACP Registry Generator
 *
 * Interactive CLI that walks users through creating an agent.json
 * for the Agent Commerce Protocol (8004) registry on SolanaOS.
 *
 * Usage:
 *   node acp_registry/generate.mjs
 *   # or via the solanaos CLI:
 *   solanaos acp init
 */

import { createInterface } from 'node:readline';
import { writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Skill catalogue (mirrors 8004 ACP spec) ────────────────────────
const SKILL_CATEGORIES = {
  'advanced_reasoning_planning': [
    'strategic_planning', 'problem_solving', 'multi_step_reasoning',
    'decision_making', 'risk_assessment',
  ],
  'finance_and_business': [
    'finance', 'trading', 'portfolio_management', 'market_analysis',
    'defi', 'tokenomics', 'accounting',
  ],
  'software_development': [
    'coding', 'debugging', 'code_review', 'architecture',
    'devops', 'smart_contracts', 'web3',
  ],
  'data_and_analytics': [
    'data_analysis', 'visualization', 'machine_learning',
    'on_chain_analytics', 'sentiment_analysis',
  ],
  'creative': [
    'writing', 'design', 'content_creation', 'meme_generation',
    'marketing', 'branding',
  ],
  'communication': [
    'community_management', 'social_media', 'customer_support',
    'translation', 'moderation',
  ],
  'infrastructure': [
    'node_operation', 'validator', 'rpc_provider', 'indexing',
    'monitoring', 'security_audit',
  ],
};

const DOMAIN_OPTIONS = Object.keys(SKILL_CATEGORIES).map(
  (cat) => `${cat}/${cat}`
);

const SERVICE_TYPES = ['mcp', 'a2a', 'http', 'websocket', 'grpc'];

const METADATA_STORAGE_OPTIONS = ['pinata_ipfs', 'arweave', 'shadow_drive', 'none'];
const NFT_STANDARDS = ['metaplex_core', 'metaplex_legacy', 'none'];
const CLUSTER_OPTIONS = ['mainnet-beta', 'devnet', 'testnet', 'localnet'];

const REGISTRY_FEATURES = [
  'atom_reputation',
  'seal_v1',
  'x402_payments',
  'proof_pass',
  'collection_pointer',
  'heartbeat_sync',
];

// ── Readline helpers ────────────────────────────────────────────────

function createPrompt() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl, question, fallback) {
  return new Promise((resolve) => {
    const suffix = fallback != null ? ` (${fallback})` : '';
    rl.question(`\x1b[36m?\x1b[0m ${question}${suffix}: `, (answer) => {
      const trimmed = answer.trim();
      resolve(trimmed || (fallback ?? ''));
    });
  });
}

function askYesNo(rl, question, fallback = true) {
  const hint = fallback ? 'Y/n' : 'y/N';
  return new Promise((resolve) => {
    rl.question(`\x1b[36m?\x1b[0m ${question} (${hint}): `, (answer) => {
      const trimmed = answer.trim().toLowerCase();
      if (!trimmed) return resolve(fallback);
      resolve(trimmed === 'y' || trimmed === 'yes');
    });
  });
}

function pickMany(rl, label, options) {
  return new Promise((resolve) => {
    console.log(`\n\x1b[33m${label}\x1b[0m`);
    options.forEach((opt, i) => console.log(`  \x1b[2m${i + 1}.\x1b[0m ${opt}`));
    rl.question(
      `\x1b[36m?\x1b[0m Enter numbers (comma-separated) or press Enter to skip: `,
      (answer) => {
        if (!answer.trim()) return resolve([]);
        const indices = answer
          .split(',')
          .map((s) => parseInt(s.trim(), 10) - 1)
          .filter((i) => i >= 0 && i < options.length);
        resolve([...new Set(indices.map((i) => options[i]))]);
      }
    );
  });
}

// ── Generator ───────────────────────────────────────────────────────

async function generate() {
  console.log('\n\x1b[1m\x1b[35m  ACP Registry Generator\x1b[0m');
  console.log('\x1b[2m  Create an agent.json for the 8004 Agent Commerce Protocol\x1b[0m\n');

  const rl = createPrompt();

  try {
    // ── Basic info ────────────────────────────────────────────────
    const name = await ask(rl, 'Agent name (slug)', 'my-agent');
    const displayName = await ask(rl, 'Display name', name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
    const description = await ask(rl, 'Description');
    const icon = await ask(rl, 'Icon file', 'icon.svg');

    // ── Distribution ──────────────────────────────────────────────
    console.log('\n\x1b[1mDistribution\x1b[0m');
    const distType = await ask(rl, 'Distribution type (command | docker | npm)', 'command');
    const distCommand = await ask(rl, 'Command to run the agent', name);
    const distArgsRaw = await ask(rl, 'Default args (comma-separated)', 'acp');
    const distArgs = distArgsRaw.split(',').map((s) => s.trim()).filter(Boolean);

    // ── Services ──────────────────────────────────────────────────
    const services = [];
    console.log('\n\x1b[1mServices\x1b[0m');
    const selectedServiceTypes = await pickMany(rl, 'Available service types:', SERVICE_TYPES);
    for (const stype of selectedServiceTypes) {
      const sdesc = await ask(rl, `Description for ${stype} service`, `${stype.toUpperCase()} service endpoint`);
      services.push({ type: stype, description: sdesc });
    }

    // ── Registry ──────────────────────────────────────────────────
    console.log('\n\x1b[1mRegistry (8004 Protocol)\x1b[0m');
    const programId = await ask(rl, 'Program ID', 'Ag8004rWo8ao8AUKhLk78iv2nLQpZMyBPXiAh5QLbFiE');
    const atomProgramId = await ask(rl, 'ATOM Program ID (or empty to skip)', '');
    const metadataStorage = await ask(rl, `Metadata storage (${METADATA_STORAGE_OPTIONS.join(' | ')})`, 'pinata_ipfs');
    const nftStandard = await ask(rl, `NFT standard (${NFT_STANDARDS.join(' | ')})`, 'metaplex_core');
    const clusters = await pickMany(rl, 'Target clusters:', CLUSTER_OPTIONS);
    if (clusters.length === 0) clusters.push('devnet');

    const features = {};
    console.log('\n\x1b[1mRegistry Features\x1b[0m');
    for (const feat of REGISTRY_FEATURES) {
      features[feat] = await askYesNo(rl, `Enable ${feat}?`, false);
    }

    // ── Capabilities ──────────────────────────────────────────────
    console.log('\n\x1b[1mCapabilities\x1b[0m');
    const allSkills = [];
    for (const [cat, skills] of Object.entries(SKILL_CATEGORIES)) {
      const picked = await pickMany(rl, `${cat} skills:`, skills);
      allSkills.push(...picked.map((s) => `${cat}/${s}`));
    }

    const domains = await pickMany(rl, 'Primary domains:', DOMAIN_OPTIONS);
    const x402 = await askYesNo(rl, 'Enable x402 payment support?', false);

    // ── Build JSON ────────────────────────────────────────────────
    const registry = {
      protocol: '8004',
      program_id: programId,
      ...(atomProgramId && { atom_program_id: atomProgramId }),
      metadata_storage: metadataStorage,
      ...(nftStandard !== 'none' && { nft_standard: nftStandard }),
      clusters,
      features,
    };

    const agent = {
      schema_version: 1,
      name,
      display_name: displayName,
      description,
      icon,
      distribution: {
        type: distType,
        command: distCommand,
        args: distArgs,
      },
      services,
      registry,
      capabilities: {
        skills: allSkills,
        domains,
        x402_support: x402,
      },
    };

    // ── Write ─────────────────────────────────────────────────────
    const outDir = await ask(rl, 'Output directory', __dirname);
    const outPath = join(outDir, 'agent.json');
    const json = JSON.stringify(agent, null, 2) + '\n';

    console.log(`\n\x1b[2m${json}\x1b[0m`);

    const confirm = await askYesNo(rl, `Write to ${outPath}?`, true);
    if (!confirm) {
      console.log('\x1b[33mAborted.\x1b[0m');
      rl.close();
      return;
    }

    await writeFile(outPath, json, 'utf-8');
    console.log(`\n\x1b[32m  agent.json written to ${outPath}\x1b[0m`);
    console.log('\x1b[2m  See agent.example.json for a reference configuration.\x1b[0m\n');
  } finally {
    rl.close();
  }
}

// ── Validate mode ───────────────────────────────────────────────────

async function validate(filePath) {
  const raw = await readFile(filePath, 'utf-8');
  const agent = JSON.parse(raw);
  const errors = [];

  if (agent.schema_version !== 1) errors.push('schema_version must be 1');
  if (!agent.name || typeof agent.name !== 'string') errors.push('name is required (string)');
  if (!agent.display_name) errors.push('display_name is required');
  if (!agent.description) errors.push('description is required');
  if (!agent.distribution?.type) errors.push('distribution.type is required');
  if (!agent.distribution?.command) errors.push('distribution.command is required');
  if (!agent.registry?.protocol) errors.push('registry.protocol is required');
  if (!agent.registry?.program_id) errors.push('registry.program_id is required');
  if (!Array.isArray(agent.registry?.clusters) || agent.registry.clusters.length === 0) {
    errors.push('registry.clusters must be a non-empty array');
  }
  if (!Array.isArray(agent.services)) errors.push('services must be an array');
  if (!agent.capabilities) errors.push('capabilities is required');

  if (errors.length > 0) {
    console.log(`\x1b[31m  Validation failed (${errors.length} error${errors.length > 1 ? 's' : ''}):\x1b[0m`);
    errors.forEach((e) => console.log(`    - ${e}`));
    process.exit(1);
  }

  console.log(`\x1b[32m  ${filePath} is valid.\x1b[0m`);
  console.log(`\x1b[2m  Agent: ${agent.display_name} | Protocol: ${agent.registry.protocol} | Clusters: ${agent.registry.clusters.join(', ')}\x1b[0m`);
}

// ── Entry point ─────────────────────────────────────────────────────

const [,, subcommand, ...rest] = process.argv;

switch (subcommand) {
  case 'validate':
  case '--validate': {
    const target = rest[0] || join(__dirname, 'agent.json');
    validate(target).catch((err) => {
      console.error(`\x1b[31m  Error: ${err.message}\x1b[0m`);
      process.exit(1);
    });
    break;
  }
  case 'help':
  case '--help':
  case '-h':
    console.log(`
  \x1b[1mACP Registry Generator\x1b[0m

  Usage:
    node acp_registry/generate.mjs              Interactive agent.json generator
    node acp_registry/generate.mjs validate     Validate an existing agent.json
    node acp_registry/generate.mjs validate <path>

  Or via the SolanaOS CLI:
    solanaos acp init
    solanaos acp validate
`);
    break;
  default:
    generate().catch((err) => {
      console.error(`\x1b[31m  Error: ${err.message}\x1b[0m`);
      process.exit(1);
    });
}
