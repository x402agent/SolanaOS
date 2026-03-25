# @solana-mobile/dapp-store-cli

CLI for publishing apps and releases to the Solana Mobile dApp Store.

## Install

```bash
pnpm add -D @solana-mobile/dapp-store-cli
npx dapp-store --help
```

## Requirements

- Node.js 18+
- pnpm 7.x

## Common commands

```bash
npx dapp-store init
npx dapp-store validate --keypair /path/to/keypair.json --build-tools-path /path/to/android-sdk/build-tools/34.0.0
npx dapp-store create app --keypair /path/to/keypair.json --dry-run
npx dapp-store create release --keypair /path/to/keypair.json --build-tools-path /path/to/android-sdk/build-tools/34.0.0 --dry-run
```

## Docs

https://docs.solanamobile.com/dapp-publishing/intro
