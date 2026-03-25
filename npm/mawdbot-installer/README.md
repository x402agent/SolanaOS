# nanosolana-cli

Legacy compatibility package for installing and running SolanaOS from npm.

Prefer the new package:

```bash
npx solanaos-cli version
npm install -g solanaos-cli
```

## Install

```bash
# Run directly with npx
npx nanosolana-cli version

# Explicit first-time install or update
npx nanosolana-cli install
npx nanosolana-cli install --with-web

# Global install
npm install -g nanosolana-cli
nanosolana version
```

## What it does

1. ✅ Clones the SolanaOS repo
2. ✅ Builds the `nanosolana` 10MB binary (Go)
3. ✅ Creates `~/.nanosolana/` workspace + wallet
4. ✅ Installs a stable CLI at `~/.nanosolana/bin/nanosolana`
5. ✅ Optionally builds the web console and installs `~/.nanosolana/bin/nanosolana-web`

After the first bootstrap, `nanosolana ...` proxies straight to the Go binary from any working directory.
If you use `--with-web`, `nanosolana-web ...` does the same for the web console backend.

## After install

```bash
# Check mainnet health
nanosolana solana health

# Register agent on-chain (devnet NFT)
nanosolana solana register

# Start paper trading
nanosolana ooda --sim

# Full autonomous daemon
nanosolana daemon

# Local web console
nanosolana-web --no-browser
```

## Links

- **Docs**: [go.solanaos.net](https://go.solanaos.net)
- **GitHub**: [x402agent/Solana-Os-Go](https://github.com/x402agent/Solana-Os-Go)
- **Helius**: [helius.dev](https://helius.dev)

## Publish your own skill to SolanaOS Hub (npm)

SolanaOS Hub supports publishing user-created skills via npm CLI.

```bash
# Login to SolanaOS Hub
npx @nanosolana/nanohub login

# Publish a local skill folder (must contain SKILL.md)
npx @nanosolana/nanohub publish ./my-skill \
  --slug my-skill \
  --name "My Skill" \
  --version 1.0.0 \
  --tags latest,solana
```

Open your published skills at **https://seeker.solanaos.net**.
