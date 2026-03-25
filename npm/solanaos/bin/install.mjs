#!/usr/bin/env node
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const INSTALL_URL = 'https://raw.githubusercontent.com/x402agent/Solana-Os-Go/newnew/install.sh';
const __dirname = dirname(fileURLToPath(import.meta.url));
const GREEN = '\x1b[38;2;20;241;149m';
const CYAN = '\x1b[38;2;0;212;255m';
const PURPLE = '\x1b[38;2;153;69;255m';
const AMBER = '\x1b[38;2;255;170;0m';
const DIM = '\x1b[38;2;85;102;128m';
const RESET = '\x1b[0m';

const BOOT_FRAMES = [
  `${PURPLE}░▒▓█ SOLANA OS COMPUTER :: BOOT 010 █▓▒░${RESET}`,
  `${GREEN}░▒▓█ SOLANA OS COMPUTER :: BOOT 011 █▓▒░${RESET}`,
  `${CYAN}░▒▓█ SOLANA OS COMPUTER :: BOOT 101 █▓▒░${RESET}`,
  `${AMBER}░▒▓█ SOLANA OS COMPUTER :: OODA ONLINE █▓▒░${RESET}`,
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playBootSequence() {
  if (!process.stdout.isTTY || process.env.CI) {
    return;
  }

  process.stdout.write('\x1b[?25l');
  try {
    for (const frame of BOOT_FRAMES) {
      process.stdout.write(`\r${frame}`);
      await sleep(90);
    }
    process.stdout.write('\r\x1b[2K');
  } finally {
    process.stdout.write('\x1b[?25h');
  }
}

function resolveBinary(candidates, fallback) {
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    return execSync(`command -v ${fallback}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function withToolchainPath(env = process.env) {
  const pathParts = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    env.PATH || '',
  ].filter(Boolean);

  return {
    ...env,
    PATH: pathParts.join(':'),
  };
}

function getLocalInstallerPath() {
  const cwdInstall = resolve(process.cwd(), 'install.sh');
  return existsSync(cwdInstall) ? cwdInstall : resolve(__dirname, '..', '..', '..', 'install.sh');
}

export async function installSolanaOS(args = []) {
  const localInstall = getLocalInstallerPath();
  const childEnv = withToolchainPath();
  const goBin = resolveBinary(['/opt/homebrew/bin/go', '/usr/local/go/bin/go'], 'go');

  await playBootSequence();
  console.log(`\n${GREEN}  🖥️ SolanaOS Installer${RESET}`);
  console.log(`${DIM}  The Solana Computer · Pure Go · One Binary${RESET}`);
  console.log(`${GREEN}   _____       __                        ____  _____ ${RESET}`);
  console.log(`${GREEN}  / ___/____  / /___ _____  ____ _     / __ \\/ ___/${RESET}`);
  console.log(`${GREEN}  \\__ \\/ __ \\/ / __ \`/ __ \\/ __ \`/    / / / /\\__ \\ ${RESET}`);
  console.log(`${GREEN} ___/ / /_/ / / /_/ / / / / /_/ /    / /_/ /___/ / ${RESET}`);
  console.log(`${GREEN}/____/\\____/_/\\__,_/_/ /_/\\__,_/     \\____//____/  ${RESET}`);
  console.log(`${PURPLE}                S O L A N A O S${RESET}`);
  console.log(`${DIM}  ╭────────────────────────────────────────────────────────────╮${RESET}`);
  console.log(`${DIM}  │${CYAN}  Unicode Matrix Boot${DIM} · ${AMBER}OODA Runtime${DIM} · ${GREEN}Solana Themed Install${DIM} │${RESET}`);
  console.log(`${DIM}  ╰────────────────────────────────────────────────────────────╯${RESET}\n`);

  try {
    execSync('which curl', { stdio: 'ignore' });
  } catch {
    if (!existsSync(localInstall)) {
      throw new Error('curl is required but not found. Install it first.');
    }
  }

  try {
    const goVersion = execSync(`${goBin} version`, { encoding: 'utf-8', env: childEnv }).trim();
    console.log(`  ${DIM}${goVersion}${RESET}`);
  } catch {
    throw new Error('Go is required but not found. Install from https://go.dev/dl/');
  }

  const useLocalInstall = existsSync(localInstall);
  console.log(`${DIM}  ${useLocalInstall ? 'Using local install script...' : 'Downloading install script...'}${RESET}\n`);

  return new Promise((resolvePromise, reject) => {
    let scriptPath = localInstall;

    try {
      if (!useLocalInstall) {
        scriptPath = join(mkdtempSync(join(tmpdir(), 'solanaos-')), 'install.sh');
        execSync(`curl -fsSL "${INSTALL_URL}" -o "${scriptPath}"`, { stdio: 'inherit' });
        execSync(`chmod +x "${scriptPath}"`, { stdio: 'ignore' });
      }
    } catch (err) {
      reject(new Error(`Install failed: ${err.message}`));
      return;
    }

    const child = spawn('bash', [scriptPath, ...args], {
      stdio: 'inherit',
      env: childEnv,
    });

    child.on('exit', (code) => {
      if (!useLocalInstall) {
        try {
          unlinkSync(scriptPath);
        } catch {}
      }

      if ((code ?? 0) === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`Installer exited with code ${code ?? 1}`));
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to run installer: ${err.message}`));
    });
  });
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) {
  installSolanaOS(process.argv.slice(2)).catch((err) => {
    console.error(`  ✖ ${err.message}`);
    process.exit(1);
  });
}
