#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const packages = [
  {
    key: 'solanaos',
    dir: join(repoRoot, 'npm', 'solanaos'),
    packageJson: join(repoRoot, 'npm', 'solanaos', 'package.json'),
  },
  {
    key: 'cli',
    dir: join(repoRoot, 'npm', 'solanaos-installer'),
    packageJson: join(repoRoot, 'npm', 'solanaos-installer', 'package.json'),
  },
  {
    key: 'compat',
    dir: join(repoRoot, 'npm', 'mawdbot-installer'),
    packageJson: join(repoRoot, 'npm', 'mawdbot-installer', 'package.json'),
  },
];

function usage() {
  console.log(`Usage:
  node scripts/release-npm.mjs version <major|minor|patch|x.y.z> [target]
  node scripts/release-npm.mjs publish [target]
  node scripts/release-npm.mjs release <major|minor|patch|x.y.z> [target]
  node scripts/release-npm.mjs pack [target]

Targets:
  all      Publish all npm packages (default)
  solanaos Publish only npm/solanaos
  cli      Publish only npm/solanaos-installer
  compat   Publish only npm/mawdbot-installer`);
}

function readJSON(pathname) {
  return JSON.parse(readFileSync(pathname, 'utf8'));
}

function writeJSON(pathname, value) {
  writeFileSync(pathname, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function isSemver(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function bumpVersion(current, bump) {
  if (isSemver(bump)) {
    return bump;
  }
  if (!isSemver(current)) {
    throw new Error(`unsupported current version: ${current}`);
  }

  const [major, minor, patch] = current.split('.').map(Number);
  switch (bump) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`unsupported version bump: ${bump}`);
  }
}

function resolveTargets(rawTarget) {
  const target = (rawTarget || 'all').trim().toLowerCase();
  if (target === 'all') {
    return packages;
  }
  const match = packages.find((pkg) => pkg.key === target);
  if (!match) {
    throw new Error(`unknown target: ${rawTarget}`);
  }
  return [match];
}

function run(command, args, options = {}) {
  const env = {
    ...process.env,
    PATH: ['/opt/homebrew/bin', '/usr/local/bin', process.env.PATH || ''].filter(Boolean).join(':'),
    npm_config_cache: process.env.npm_config_cache || join(repoRoot, '.npm-cache'),
  };

  return execFileSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env,
    ...options,
  });
}

function ensureFiles() {
  for (const pkg of packages) {
    if (!existsSync(pkg.packageJson)) {
      throw new Error(`missing package json: ${pkg.packageJson}`);
    }
  }
}

function versionPackages(bump, target) {
  const selected = resolveTargets(target);
  for (const pkg of selected) {
    const manifest = readJSON(pkg.packageJson);
    const nextVersion = bumpVersion(manifest.version, bump);
    manifest.version = nextVersion;
    writeJSON(pkg.packageJson, manifest);
    console.log(`[version] ${manifest.name}: ${nextVersion}`);
  }
}

function packPackages(target) {
  const selected = resolveTargets(target);
  for (const pkg of selected) {
    console.log(`[pack] ${pkg.dir}`);
    run('npm', ['pack', '--dry-run', pkg.dir]);
  }
}

function publishPackages(target) {
  const selected = resolveTargets(target);
  for (const pkg of selected) {
    const manifest = readJSON(pkg.packageJson);
    console.log(`[publish] ${manifest.name}@${manifest.version}`);
    run('npm', ['publish', '--access', 'public'], { cwd: pkg.dir });
  }
}

function main() {
  ensureFiles();

  const [command, arg1, arg2] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    usage();
    process.exit(command ? 0 : 1);
  }

  switch (command) {
    case 'version':
      if (!arg1) {
        throw new Error('version command requires a bump or exact version');
      }
      versionPackages(arg1, arg2);
      break;
    case 'pack':
      packPackages(arg1);
      break;
    case 'publish':
      packPackages(arg1);
      publishPackages(arg1);
      break;
    case 'release':
      if (!arg1) {
        throw new Error('release command requires a bump or exact version');
      }
      versionPackages(arg1, arg2);
      packPackages(arg2);
      publishPackages(arg2);
      break;
    default:
      throw new Error(`unknown command: ${command}`);
  }
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
