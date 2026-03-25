# solanaos-computer

Primary npm entrypoint for installing and launching SolanaOS.

This package wraps the repo’s public [`install.sh`](https://github.com/x402agent/Solana-Os-Go/blob/main/install.sh), installs the Go runtime into `~/.nanosolana/bin/`, and keeps the legacy `nanosolana` alias working.

## Install

```bash
# One-shot runtime install
npx solanaos-computer@latest install

# Install with the local web console flow
npx solanaos-computer@latest install --with-web

# Global install, then use solanaos anywhere
npm install -g solanaos-computer
solanaos install --with-web
```

## What this package installs

- `solanaos`
- `solanaos-cli`
- `nanosolana`

All three command names point at the same runtime bootstrapper. The public brand is `solanaos`; the others are compatibility aliases for older scripts and users.

## What the installer does

1. Uses a local checkout when run inside the repo, otherwise clones `x402agent/Solana-Os-Go`
2. Builds the main Go binary at `build/solanaos`
3. Creates the workspace at `~/.nanosolana/`
4. Installs stable launchers into `~/.nanosolana/bin/`
5. Optionally builds the web console launcher with `--with-web`
6. Generates the native Seeker connect bundle and setup code when available

## Requirements

- Node.js `>=18`
- Go installed locally
- `git` for remote bootstrap installs
- `curl` for remote script download
- macOS or Linux for the packaged CLI flow

Windows is not supported by this npm bootstrapper. Use WSL if needed.

## Minimum config

After install, populate `.env` with at least:

```bash
SOLANA_TRACKER_API_KEY=your-key
OPENROUTER_API_KEY=sk-or-v1-...
TELEGRAM_BOT_TOKEN=your-token
TELEGRAM_ID=your-chat-id
```

## After install

```bash
~/.nanosolana/bin/solanaos version
~/.nanosolana/bin/solanaos solana health
~/.nanosolana/bin/solanaos gateway start
~/.nanosolana/bin/solanaos gateway setup-code
~/.nanosolana/bin/solanaos daemon
```

If installed with `--with-web`:

```bash
~/.nanosolana/bin/solanaos-web --no-browser
```

## Product links

- Docs: https://go.solanaos.net
- Hub: https://seeker.solanaos.net
- Souls: https://souls.solanaos.net
- Strategy Builder: https://seeker.solanaos.net/strategy
- GitHub: https://github.com/x402agent/Solana-Os-Go

## Verify before publish

```bash
cd npm/solanaos
npm pack --dry-run
```

## Publish

```bash
cd npm/solanaos
npm publish --access public
```
