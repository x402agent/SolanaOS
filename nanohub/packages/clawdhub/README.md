# `@nanosolana/nanohub`

SolanaOS Hub CLI — install, update, search, and publish agent skills for the SolanaOS ecosystem.

**Repo**: [github.com/x402agent/Solana-Os-Go](https://github.com/x402agent/Solana-Os-Go)
**Hub**: [seeker.solanaos.net](https://seeker.solanaos.net)
**Skill Creator**: [seeker.solanaos.net/create](https://seeker.solanaos.net/create)

## Install

```bash
# One-off via npx
npx @nanosolana/nanohub --help

# Optional global install
npm i -g @nanosolana/nanohub
```

Command aliases provided by the package:

- `nanohub` (primary)
- `nanosolana-skill`
- `clawhub` (legacy)
- `clawdhub` (legacy)

## Auth (publish)

```bash
nanohub login
# or
nanohub auth login

# Headless / token paste
nanohub login --token <token>
```

Notes:

- Browser login opens `${NANOHUB_SITE:-https://seeker.solanaos.net}/cli/auth` and completes via a loopback callback.
- Token stored in `~/Library/Application Support/clawhub/config.json` on macOS.
- Config path override envs: `NANOHUB_CONFIG_PATH` (preferred), `CLAWHUB_CONFIG_PATH`, `CLAWDHUB_CONFIG_PATH`.

## Publish a skill

Skill folder requirements:

- `SKILL.md` (or `skills.md`)
- text files only
- semver version (for example `1.0.0`)

```bash
npx @nanosolana/nanohub publish ./my-skill \
  --slug my-skill \
  --name "My Skill" \
  --version 1.0.0 \
  --tags latest,solana \
  --changelog "Initial release"
```

Or use the [Skill Creator](https://seeker.solanaos.net/create) to build your SKILL.md in the browser.

## Sync (upload local skills)

```bash
# Scan + upload from discovered skill roots
nanohub sync

# Non-interactive upload of all candidates
nanohub sync --all --bump patch --tags latest
```

## Defaults

- Site: `https://seeker.solanaos.net` (override via `--site`, `NANOHUB_SITE`, `CLAWHUB_SITE`, `CLAWDHUB_SITE`)
- Registry: discovered from site `/.well-known/*.json`, fallback `https://seeker.solanaos.net` (override via `--registry`, `NANOHUB_REGISTRY`, `CLAWHUB_REGISTRY`, `CLAWDHUB_REGISTRY`)
- Workdir: current directory (falls back to SolanaOS workspace when configured; override via `--workdir`, `NANOHUB_WORKDIR`, `CLAWHUB_WORKDIR`, `CLAWDHUB_WORKDIR`)
- Install dir: `./skills` under workdir (override via `--dir`)

## Links

- [SolanaOS Hub](https://seeker.solanaos.net) — browse and install skills
- [SolanaOS Souls](https://souls.solanaos.net) — SOUL.md library
- [Launch Page](https://solanaos.net) — platform overview
- [GitHub](https://github.com/x402agent/Solana-Os-Go) — source code
