---
summary: 'Copy/paste CLI smoke checklist for local verification.'
read_when:
  - Pre-merge validation
  - Reproducing a reported CLI bug
---

# Manual testing (CLI)

## Setup
- Ensure logged in: `npx @nanosolana/nanohub@latest whoami` (or `npx @nanosolana/nanohub@latest login`).
- Optional: set env
  - `CLAWHUB_SITE=https://hub.solanaos.net`
  - `CLAWHUB_REGISTRY=https://hub.solanaos.net`

## Smoke
- `npx @nanosolana/nanohub@latest --help`
- `npx @nanosolana/nanohub@latest --cli-version`
- `npx @nanosolana/nanohub@latest whoami`

## Search
- `npx @nanosolana/nanohub@latest search gif --limit 5`

## Install / list / update
- `mkdir -p /tmp/nanohub-manual && cd /tmp/nanohub-manual`
- `bunx @nanosolana/nanohub@latest install gifgrep --force`
- `bunx @nanosolana/nanohub@latest list`
- `bunx @nanosolana/nanohub@latest update gifgrep --force`

## Publish (changelog optional)
- `mkdir -p /tmp/nanohub-skill-demo/SKILL && cd /tmp/nanohub-skill-demo`
- Create files:
  - `SKILL.md`
  - `notes.md`
- Publish:
  - `npx @nanosolana/nanohub@latest publish . --slug nanohub-manual-<ts> --name "Manual <ts>" --version 1.0.0 --tags latest`
- Publish update with empty changelog:
  - `npx @nanosolana/nanohub@latest publish . --slug nanohub-manual-<ts> --name "Manual <ts>" --version 1.0.1 --tags latest`

## Delete / undelete (owner/admin)
- `npx @nanosolana/nanohub@latest delete nanohub-manual-<ts> --yes`
- Verify hidden:
- `curl -i "https://hub.solanaos.net/api/v1/skills/nanohub-manual-<ts>"`
- Restore:
  - `npx @nanosolana/nanohub@latest undelete nanohub-manual-<ts> --yes`
- Cleanup:
  - `npx @nanosolana/nanohub@latest delete nanohub-manual-<ts> --yes`

## Sync
- `npx @nanosolana/nanohub@latest sync --dry-run --all`

## Playwright (menu smoke)

Run against prod:

```
PLAYWRIGHT_BASE_URL=https://hub.solanaos.net bun run test:pw
```

This smoke gate should fail on visible error UI, page errors, and browser
console errors.

Recommended workflow coverage in Playwright:

- home/install-switcher + browse CTA
- `/search` redirect into skills browse
- skills browse -> detail -> owner profile
- souls browse -> detail -> owner profile
- upload signed-out gate
- import signed-out gate
- authenticated upload/import canaries when storage state is configured

Authenticated prod canary:

```
PLAYWRIGHT_BASE_URL=https://hub.solanaos.net \
PLAYWRIGHT_AUTH_STORAGE_STATE=/path/to/storage-state.json \
bunx playwright test e2e/upload-auth-smoke.pw.test.ts
```

Capture `storage-state.json` once with Playwright or browser devtools after GitHub login.

Run against a local preview server:

```
bun run test:e2e:local
```
