# dApp Publishing CLI

Tooling for publishing to the Solana Mobile dApp Store.

For all documentation regarding usage of the tooling, including a thorough walkthrough of the dApp publishing process, visit the [Solana Mobile docs site](https://docs.solanamobile.com/dapp-publishing/intro).

# Workspace

This repo contains two publishable packages:

- `@solana-mobile/dapp-store-cli`
- `@solana-mobile/dapp-store-publishing-tools`

Recommended local toolchain:

- Node.js 18+
- pnpm `7.33.7`

# Installation

Please run the CLI with Node version 18 or greater.

```shell
corepack enable
corepack prepare pnpm@7.33.7 --activate
```

Then install the workspace dependencies:

```shell
pnpm install --frozen-lockfile
```

Build, test, and verify the npm tarballs:

```shell
pnpm run build
pnpm run test
pnpm run pack:all
```

One command for the full publish-readiness check:

```shell
pnpm run release:check
```

## CLI usage

```shell
mkdir publishing
cd publishing

pnpm init
pnpm add -D @solana-mobile/dapp-store-cli
npx dapp-store init
npx dapp-store --help
```

## Publishing

The workspace is set up so the packages can be published individually from `packages/core` and `packages/cli` after:

1. `pnpm install --frozen-lockfile`
2. `pnpm run release:check`
3. `npm publish --access public`

## License

Apache 2.0
