#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// MawdBot Go :: Animated Launcher
// One-shot install, build, and launch with unicode-animations spinners
// ─────────────────────────────────────────────────────────────────────
import spinners from 'unicode-animations';
import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Colors ───────────────────────────────────────────────────────────
const C = {
  green:  '\x1b[1;38;2;20;241;149m',
  purple: '\x1b[1;38;2;153;69;255m',
  teal:   '\x1b[1;38;2;0;212;255m',
  amber:  '\x1b[1;38;2;255;170;0m',
  red:    '\x1b[1;38;2;255;64;96m',
  dim:    '\x1b[38;2;85;102;128m',
  white:  '\x1b[1;37m',
  reset:  '\x1b[0m',
  bg:     '\x1b[48;2;2;2;8m',
};

// ── Banner ───────────────────────────────────────────────────────────
const BANNER = `
${C.green}    ███╗   ███╗ █████╗ ██╗    ██╗██████╗ ${C.purple}██████╗  ██████╗ ████████╗
${C.green}    ████╗ ████║██╔══██╗██║    ██║██╔══██╗${C.purple}██╔══██╗██╔═══██╗╚══██╔══╝
${C.green}    ██╔████╔██║███████║██║ █╗ ██║██║  ██║${C.purple}██████╔╝██║   ██║   ██║   
${C.green}    ██║╚██╔╝██║██╔══██║██║███╗██║██║  ██║${C.purple}██╔══██╗██║   ██║   ██║   
${C.green}    ██║ ╚═╝ ██║██║  ██║╚███╔███╔╝██████╔╝${C.purple}██████╔╝╚██████╔╝   ██║   
${C.green}    ╚═╝     ╚═╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚═════╝ ${C.purple}╚═════╝  ╚═════╝    ╚═╝   
${C.reset}`;

const LOBSTER = `${C.red}
                ,
               /|      __
              / |   ,-~ /
             Y :|  //  /
             | jj /( .^
             >-"~"-v"
            /       Y
           jo  o    |
          ( ~T~     j
           >._-' _./
          /   "~"  |
         Y     _,  |
        /| ;-"~ _  l
       / l/ ,-"~    \\
       \\//\\/      .- \\
        Y        /    Y
        l       I     !
        ]\\      _\\    /"\\
       (" ~----( ~   Y.  )
${C.reset}`;

const DIVIDER = `${C.dim}    ┌──────────────────────────────────────────────────────────────┐${C.reset}`;
const DIVIDER_END = `${C.dim}    └──────────────────────────────────────────────────────────────┘${C.reset}`;

// ── Spinner Helper ───────────────────────────────────────────────────
async function withSpinner(label, fn, spinnerName = 'helix') {
  const { frames, interval } = spinners[spinnerName];
  let i = 0;
  const timer = setInterval(() => {
    process.stdout.write(`\r\x1B[2K  ${C.teal}${frames[i++ % frames.length]}${C.reset} ${label}`);
  }, interval);

  try {
    const result = await fn();
    clearInterval(timer);
    process.stdout.write(`\r\x1B[2K  ${C.green}✔${C.reset} ${label}\n`);
    return result;
  } catch (err) {
    clearInterval(timer);
    process.stdout.write(`\r\x1B[2K  ${C.red}✗${C.reset} ${label} — ${err.message}\n`);
    throw err;
  }
}

// ── Exec helper — returns { ok, output } ─────────────────────────────
function run(cmd, opts = {}) {
  try {
    const output = execSync(cmd, {
      cwd: opts.cwd || ROOT,
      stdio: opts.stdio || 'pipe',
      env: { ...process.env, ...opts.env },
      timeout: opts.timeout || 120_000,
    }).toString().trim();
    return { ok: true, output };
  } catch (e) {
    return { ok: false, output: e.stderr?.toString?.() || e.message };
  }
}

// ── Check Prerequisites ──────────────────────────────────────────────
async function checkPrereqs() {
  const checks = [
    { name: 'Go compiler', cmd: 'go version',   extract: o => o.match(/go\d+\.\d+/)?.[0] || 'found' },
    { name: 'Node.js',     cmd: 'node -v',      extract: o => o },
    { name: 'npm',         cmd: 'npm -v',        extract: o => `v${o}` },
    { name: 'Git',         cmd: 'git --version', extract: o => o.replace('git version ', '') },
  ];

  const results = [];
  for (const c of checks) {
    const r = run(c.cmd);
    results.push({
      name: c.name,
      ok: r.ok,
      version: r.ok ? c.extract(r.output) : 'NOT FOUND',
    });
  }
  return results;
}

// ── Check env vars ───────────────────────────────────────────────────
function checkEnv() {
  const envFile = resolve(ROOT, '.env');
  if (!existsSync(envFile)) {
    return { loaded: false, keys: {} };
  }

  const content = readFileSync(envFile, 'utf-8');
  const keys = {};
  const required = [
    'SOLANA_TRACKER_API_KEY',
    'HELIUS_API_KEY', 'HELIUS_RPC_URL',
    'JUPITER_API_KEY', 'JUPITER_ENDPOINT',
    'ASTER_API_KEY', 'ASTER_API_SECRET',
    'OPENROUTER_API_KEY',
    'SUPABASE_URL', 'SUPABASE_SERVICE_KEY',
  ];

  for (const k of required) {
    const match = content.match(new RegExp(`^${k}=(.+)$`, 'm'));
    keys[k] = match ? (match[1].length > 8 ? '✔ set' : '⚠ short') : '✗ missing';
  }
  return { loaded: true, keys };
}

// ── Animated boot sequence ───────────────────────────────────────────
function animatedBoot() {
  return new Promise((resolve) => {
    const { frames, interval } = spinners.cascade;
    const bootLines = [
      `${C.dim}    │${C.teal}  🦞 Sentient Solana Trading Intelligence${C.dim}                     │${C.reset}`,
      `${C.dim}    │${C.amber}  OODA Loop · ClawVault Memory · Solana Tracker${C.dim}              │${C.reset}`,
      `${C.dim}    │${C.purple}  Aster Perps · Jupiter Swaps · Helius RPC${C.dim}                    │${C.reset}`,
      `${C.dim}    │${C.green}  $MAWD :: Droids Lead The Way${C.dim}                                 │${C.reset}`,
    ];
    
    let lineIdx = 0;
    let frameIdx = 0;
    
    console.log(DIVIDER);
    
    const lineTimer = setInterval(() => {
      if (lineIdx >= bootLines.length) {
        clearInterval(lineTimer);
        console.log(DIVIDER_END);
        console.log();
        resolve();
        return;
      }
      
      // Show a frame spinner then the line
      const frame = frames[frameIdx++ % frames.length];
      process.stdout.write(`\r  ${C.teal}${frame}${C.reset} `);
      
      setTimeout(() => {
        process.stdout.write(`\r\x1B[2K`);
        console.log(bootLines[lineIdx]);
        lineIdx++;
      }, 200);
    }, 400);
  });
}

// ── DNA Helix Animation ──────────────────────────────────────────────
function dnaAnimation() {
  return new Promise((resolve) => {
    const { frames, interval } = spinners.dna;
    let count = 0;
    const max = frames.length * 3; // 3 full cycles
    const timer = setInterval(() => {
      const f = frames[count % frames.length];
      process.stdout.write(`\r\x1B[2K    ${C.purple}${f} ${f} ${f} ${f} ${f} ${f} ${f} ${f} ${f} ${f} ${f} ${f} ${f} ${f} ${f}${C.reset}  ${C.dim}initializing neural pathways...${C.reset}`);
      count++;
      if (count >= max) {
        clearInterval(timer);
        process.stdout.write(`\r\x1B[2K    ${C.green}⣿ ⣿ ⣿ ⣿ ⣿ ⣿ ⣿ ⣿ ⣿ ⣿ ⣿ ⣿ ⣿ ⣿ ⣿${C.reset}  ${C.green}neural pathways online${C.reset}\n\n`);
        resolve();
      }
    }, interval);
  });
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.clear();
  console.log(BANNER);
  console.log(LOBSTER);
  
  await animatedBoot();
  await dnaAnimation();

  const startTime = Date.now();

  // ── Step 1: Prerequisites ──────────────────────────────────────
  console.log(`${C.amber}  ── PHASE 1: Prerequisites ──${C.reset}\n`);

  const prereqs = await withSpinner('Checking system prerequisites...', checkPrereqs, 'scan');

  for (const p of prereqs) {
    const icon = p.ok ? `${C.green}✔${C.reset}` : `${C.red}✗${C.reset}`;
    console.log(`    ${icon} ${p.name}: ${C.teal}${p.version}${C.reset}`);
  }
  console.log();

  const missing = prereqs.filter(p => !p.ok);
  if (missing.length > 0) {
    console.log(`${C.red}  ✗ Missing prerequisites: ${missing.map(m => m.name).join(', ')}${C.reset}`);
    console.log(`${C.dim}  Install them and run this script again.${C.reset}\n`);
    process.exit(1);
  }

  // ── Step 2: Environment ────────────────────────────────────────
  console.log(`${C.amber}  ── PHASE 2: Environment & API Keys ──${C.reset}\n`);

  const env = await withSpinner('Validating .env configuration...', () => checkEnv(), 'braille');

  if (!env.loaded) {
    console.log(`    ${C.red}✗${C.reset} No .env file found — creating from .env.example`);
    const example = resolve(ROOT, 'mawdbot-go', '.env.example');
    if (existsSync(example)) {
      const content = readFileSync(example, 'utf-8');
      writeFileSync(resolve(ROOT, '.env'), content);
      console.log(`    ${C.green}✔${C.reset} Created .env — ${C.amber}fill in your API keys!${C.reset}`);
    }
  } else {
    let allSet = true;
    for (const [key, status] of Object.entries(env.keys)) {
      const icon = status.includes('✔') ? `${C.green}✔${C.reset}` : `${C.red}✗${C.reset}`;
      if (!status.includes('✔')) allSet = false;
      // Only show missing ones to reduce noise
      if (!status.includes('✔')) {
        console.log(`    ${icon} ${C.dim}${key}${C.reset}: ${status}`);
      }
    }
    if (allSet) {
      console.log(`    ${C.green}✔${C.reset} All API keys configured`);
    }
  }
  console.log();

  // ── Step 3: Go Dependencies ────────────────────────────────────
  console.log(`${C.amber}  ── PHASE 3: Go Dependencies ──${C.reset}\n`);

  await withSpinner('Downloading Go modules...', async () => {
    const r = run('go mod download', { cwd: ROOT });
    if (!r.ok) throw new Error(r.output);
  }, 'cascade');

  await withSpinner('Tidying Go modules...', async () => {
    const r = run('go mod tidy', { cwd: ROOT });
    if (!r.ok) throw new Error(r.output);
  }, 'braillewave');

  console.log();

  // ── Step 4: Compile ────────────────────────────────────────────
  console.log(`${C.amber}  ── PHASE 4: Compilation ──${C.reset}\n`);

  await withSpinner('Compiling pkg/* (all packages)...', async () => {
    const r = run('go build ./pkg/...', { cwd: ROOT });
    if (!r.ok) throw new Error(r.output);
  }, 'helix');

  await withSpinner('Compiling cmd/mawdbot (CLI)...', async () => {
    const r = run('go build -o build/mawdbot ./cmd/mawdbot', { cwd: ROOT });
    if (!r.ok) throw new Error(r.output);
  }, 'dna');

  await withSpinner('Compiling cmd/mawdbot-tui (TUI)...', async () => {
    const r = run('go build -o build/mawdbot-tui ./cmd/mawdbot-tui', { cwd: ROOT });
    if (!r.ok) throw new Error(r.output);
  }, 'orbit');

  await withSpinner('Compiling web/backend (Web Console)...', async () => {
    const r = run('go build -o build/mawdbot-web ./web/backend', { cwd: ROOT });
    if (!r.ok) throw new Error(r.output);
  }, 'scan');

  // Count the Go source files
  const goCount = run('find . -name "*.go" -not -path "./.git/*" | wc -l', { cwd: ROOT });
  const fileCount = goCount.ok ? goCount.output.trim() : '??';

  console.log(`\n    ${C.dim}Compiled ${C.teal}${fileCount}${C.dim} Go source files into 3 binaries${C.reset}`);
  console.log();

  // ── Step 5: Frontend ───────────────────────────────────────────
  console.log(`${C.amber}  ── PHASE 5: Web Frontend ──${C.reset}\n`);

  const frontendDir = resolve(ROOT, 'web', 'frontend');

  await withSpinner('Installing frontend dependencies...', async () => {
    const r = run('npm install --no-audit --no-fund', { cwd: frontendDir, timeout: 120_000 });
    if (!r.ok) throw new Error(r.output);
  }, 'columns');

  await withSpinner('Building frontend (Vite + React)...', async () => {
    const r = run('npm run build', { cwd: frontendDir, timeout: 60_000 });
    if (!r.ok) throw new Error(r.output);
  }, 'fillsweep');

  console.log();

  // ── Step 6: Verify Binaries ────────────────────────────────────
  console.log(`${C.amber}  ── PHASE 6: Verification ──${C.reset}\n`);

  const binaries = [
    { name: 'mawdbot',     path: 'build/mawdbot' },
    { name: 'mawdbot-tui', path: 'build/mawdbot-tui' },
    { name: 'mawdbot-web', path: 'build/mawdbot-web' },
  ];

  for (const bin of binaries) {
    const fullPath = resolve(ROOT, bin.path);
    const exists = existsSync(fullPath);
    const icon = exists ? `${C.green}✔${C.reset}` : `${C.red}✗${C.reset}`;
    let size = '';
    if (exists) {
      const s = run(`ls -lh "${fullPath}" | awk '{print $5}'`);
      size = s.ok ? ` ${C.dim}(${s.output})${C.reset}` : '';
    }
    console.log(`    ${icon} ${C.teal}${bin.name}${C.reset}${size}`);
  }

  // Quick smoke test: version command
  await withSpinner('Running smoke test (mawdbot version)...', async () => {
    const r = run('./build/mawdbot version', { cwd: ROOT });
    if (!r.ok) throw new Error(r.output);
    return r.output;
  }, 'sparkle');

  console.log();

  // ── Step 7: Solana Tracker API Test ────────────────────────────
  console.log(`${C.amber}  ── PHASE 7: API Connectivity ──${C.reset}\n`);

  const trackerKey = process.env.SOLANA_TRACKER_API_KEY || (() => {
    try {
      const envContent = readFileSync(resolve(ROOT, '.env'), 'utf-8');
      const match = envContent.match(/^SOLANA_TRACKER_API_KEY=(.+)$/m);
      return match ? match[1].trim() : '';
    } catch { return ''; }
  })();

  if (trackerKey && trackerKey.length > 10) {
    await withSpinner('Testing Solana Tracker API (SOL price)...', async () => {
      return new Promise((resolve, reject) => {
        const req = https.get(
          `https://data.solanatracker.io/price?token=So11111111111111111111111111111111111111112`,
          { headers: { 'x-api-key': trackerKey } },
          (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                const json = JSON.parse(data);
                if (typeof json.price === 'number') {
                  console.log(`\n    ${C.dim}SOL Price: ${C.green}$${json.price.toFixed(2)}${C.reset}`);
                  resolve();
                } else {
                  reject(new Error('Invalid response'));
                }
              } catch (e) { reject(e); }
            });
          }
        );
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
      });
    }, 'breathe');
  } else {
    console.log(`    ${C.amber}⚠${C.reset} ${C.dim}Solana Tracker API key not found — skipping connectivity test${C.reset}`);
  }

  console.log();

  // ── Final Summary ──────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(DIVIDER);
  console.log(`${C.dim}    │${C.reset}                                                              ${C.dim}│${C.reset}`);
  console.log(`${C.dim}    │${C.green}  ✔  MawdBot Go — Installation Complete${C.dim}                        │${C.reset}`);
  console.log(`${C.dim}    │${C.reset}                                                              ${C.dim}│${C.reset}`);
  console.log(`${C.dim}    │${C.teal}  Time: ${elapsed}s${C.dim}                                                 │${C.reset}`);
  console.log(`${C.dim}    │${C.reset}                                                              ${C.dim}│${C.reset}`);
  console.log(`${C.dim}    │${C.amber}  Quick Start:${C.dim}                                                 │${C.reset}`);
  console.log(`${C.dim}    │${C.white}    ./build/mawdbot agent -m "What is SOL price?"${C.dim}              │${C.reset}`);
  console.log(`${C.dim}    │${C.white}    ./build/mawdbot solana trending${C.dim}                             │${C.reset}`);
  console.log(`${C.dim}    │${C.white}    ./build/mawdbot solana search BONK${C.dim}                          │${C.reset}`);
  console.log(`${C.dim}    │${C.white}    ./build/mawdbot solana research <mint>${C.dim}                      │${C.reset}`);
  console.log(`${C.dim}    │${C.white}    ./build/mawdbot ooda --interval 60${C.dim}                          │${C.reset}`);
  console.log(`${C.dim}    │${C.white}    ./build/mawdbot-web${C.dim}                                        │${C.reset}`);
  console.log(`${C.dim}    │${C.reset}                                                              ${C.dim}│${C.reset}`);
  console.log(`${C.dim}    │${C.purple}  🦞 $MAWD :: Droids Lead The Way${C.dim}                              │${C.reset}`);
  console.log(`${C.dim}    │${C.reset}                                                              ${C.dim}│${C.reset}`);
  console.log(DIVIDER_END);
  console.log();
}

main().catch((err) => {
  console.error(`\n${C.red}  ✗ Installation failed: ${err.message}${C.reset}\n`);
  process.exit(1);
});
