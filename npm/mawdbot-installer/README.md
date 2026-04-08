# solanaos-cli

Legacy compatibility package for installing and running SolanaOS from npm.

Prefer the new package:

```bash
npx solanaos-cli version
npm install -g solanaos-cli
```

## Install

```bash
# Run directly with npx
npx solanaos-cli version

# Explicit first-time install or update
npx solanaos-cli install
npx solanaos-cli install --with-web

# Global install
npm install -g solanaos-cli
solanaos version
```

## What it does

1. ✅ Clones the SolanaOS repo
2. ✅ Builds the `solanaos` 10MB binary (Go)
3. ✅ Creates `~/.solanaos/` workspace + wallet
4. ✅ Installs a stable CLI at `~/.solanaos/bin/solanaos`
5. ✅ Optionally builds the web console and installs `~/.solanaos/bin/solanaos-web`

After the first bootstrap, `solanaos ...` proxies straight to the Go binary from any working directory.
If you use `--with-web`, `solanaos-web ...` does the same for the web console backend.

## After install

```bash
# Check mainnet health
solanaos solana health

# Register agent on-chain (devnet NFT)
solanaos solana register

# Start paper trading
solanaos ooda --sim

# Full autonomous daemon
solanaos daemon

# Local web console
solanaos-web --no-browser
```

## Links

- **Docs**: [solanaos.net](https://solanaos.net)
- **GitHub**: [x402agent/SolanaOS](https://github.com/x402agent/SolanaOS)
- **Helius**: [helius.dev](https://helius.dev)

## Publish your own skill to SolanaOS Hub (npm)

SolanaOS Hub supports publishing user-created skills via npm CLI.

```bash
# Login to SolanaOS Hub
npx @solanaos/nanohub login

# Publish a local skill folder (must contain SKILL.md)
npx @solanaos/nanohub publish ./my-skill \
  --slug my-skill \
  --name "My Skill" \
  --version 1.0.0 \
  --tags latest,solana
```

Open your published skills at **https://seeker.solanaos.net**.
