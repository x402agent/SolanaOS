# Getting Started

A quick-start guide for integrating the Pump SDK into your TypeScript/JavaScript project.

<div align="center">
  <img src="assets/pump.svg" alt="Bonding curve price mechanics" width="720">
</div>

> **New here?** See the [Ecosystem Overview](./ecosystem.md) for a map of everything in this repository — the SDK, bots, dashboards, generators, and more.

## Prerequisites

- **Node.js 18+** (20+ recommended)
- **TypeScript** project (or JavaScript with JSDoc types)
- **Solana wallet** with SOL for transaction fees
  - Devnet: `solana airdrop 2` (free)
  - Mainnet: fund from an exchange or another wallet

### Optional: Solana CLI

For local development and testing:

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Create a devnet keypair
solana-keygen new --outfile ~/.config/solana/devnet.json
solana config set --url devnet
solana airdrop 2
```

## Installation

```bash
npm install @nirholas/pump-sdk
# or
yarn add @nirholas/pump-sdk
# or
pnpm add @nirholas/pump-sdk
```

### Peer Dependencies

The SDK depends on these Solana ecosystem packages:

```bash
npm install @solana/web3.js @coral-xyz/anchor @solana/spl-token bn.js
```

### TypeScript Configuration

If using TypeScript, ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "strict": true
  }
}
```

## Quick Start

### 1. Initialize the SDK

The SDK offers two modes of operation:

- **Offline (`PumpSdk`)** — builds transaction instructions without a network connection. Use for server-side apps, testing, or when you manage RPC calls yourself.
- **Online (`OnlinePumpSdk`)** — extends the offline SDK with RPC fetchers. Reads on-chain state automatically. Use for interactive apps and scripts.

```typescript
import { Connection } from "@solana/web3.js";
import { PumpSdk, OnlinePumpSdk, PUMP_SDK } from "@nirholas/pump-sdk";

// Option A: Use the pre-built singleton (offline only)
// Best for: building instructions when you already have the on-chain state
const offlineSdk = PUMP_SDK;

// Option B: Create an online SDK with a connection
// Best for: scripts and bots that need to fetch state before building instructions
const connection = new Connection("https://api.devnet.solana.com", "confirmed");
const sdk = new OnlinePumpSdk(connection);
```

> **Important:** All financial amounts use `BN` (bn.js), never JavaScript `number`. This prevents precision loss with large Solana amounts. `1 SOL = 1_000_000_000 lamports = new BN(1e9)`.

### 2. Create a Token

```typescript
import { Keypair, PublicKey } from "@solana/web3.js";

const mint = Keypair.generate();
const creator = wallet.publicKey; // your wallet

const instruction = await PUMP_SDK.createV2Instruction({
  mint: mint.publicKey,
  name: "My Token",
  symbol: "MTK",
  uri: "https://example.com/metadata.json",
  creator,
  user: creator,
  mayhemMode: false,
});
```

### 3. Buy Tokens

```typescript
import BN from "bn.js";
import { getBuyTokenAmountFromSolAmount } from "@nirholas/pump-sdk";

const mint = new PublicKey("...");
const user = wallet.publicKey;

const global = await sdk.fetchGlobal();
const feeConfig = await sdk.fetchFeeConfig();
const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } =
  await sdk.fetchBuyState(mint, user);

const solAmount = new BN(0.1 * 1e9); // 0.1 SOL in lamports
const tokenAmount = getBuyTokenAmountFromSolAmount({
  global,
  feeConfig,
  mintSupply: null,
  bondingCurve,
  amount: solAmount,
});

const instructions = await PUMP_SDK.buyInstructions({
  global,
  bondingCurveAccountInfo,
  bondingCurve,
  associatedUserAccountInfo,
  mint,
  user,
  solAmount,
  amount: tokenAmount,
  slippage: 1, // 1%
  tokenProgram: TOKEN_PROGRAM_ID,
});
```

### 4. Sell Tokens

```typescript
import { getSellSolAmountFromTokenAmount } from "@nirholas/pump-sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const { bondingCurveAccountInfo, bondingCurve } = await sdk.fetchSellState(
  mint,
  user,
);
const sellAmount = new BN(15_828);

const instructions = await PUMP_SDK.sellInstructions({
  global,
  bondingCurveAccountInfo,
  bondingCurve,
  mint,
  user,
  amount: sellAmount,
  solAmount: getSellSolAmountFromTokenAmount({
    global,
    feeConfig,
    mintSupply: bondingCurve.tokenTotalSupply,
    bondingCurve,
    amount: sellAmount,
  }),
  slippage: 1,
  tokenProgram: TOKEN_PROGRAM_ID,
  mayhemMode: false,
});
```

### 5. Send a Transaction

```typescript
import { Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

const tx = new Transaction().add(...instructions);
const signature = await sendAndConfirmTransaction(connection, tx, [wallet]);
console.log("Transaction:", signature);
```

## Common Patterns

### Loading a Wallet from File

```typescript
import { Keypair } from "@solana/web3.js";
import fs from "fs";

const secretKey = JSON.parse(fs.readFileSync("/path/to/keypair.json", "utf8"));
const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
```

### Loading a Wallet from Environment Variable

```typescript
const secretKey = JSON.parse(process.env.WALLET_PRIVATE_KEY!);
const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
```

### Checking if a Token Has Graduated

```typescript
const bondingCurve = await sdk.fetchBondingCurve(mint);

if (bondingCurve.complete) {
  console.log("Token has graduated to PumpAMM — use AMM instructions instead");
} else {
  console.log("Token is still on the bonding curve");
}
```

### Fetching Fee Config (Required for Buy/Sell Calculations)

```typescript
// FeeConfig determines the fee tier based on token supply
const feeConfig = await sdk.fetchFeeConfig();

// Pass to buy/sell amount calculations:
const tokens = getBuyTokenAmountFromSolAmount({
  global,
  feeConfig,      // ← required since v1.27
  mintSupply: bondingCurve.tokenTotalSupply,
  bondingCurve,
  amount: solAmount,
});
```

### Getting a Quick Token Summary

```typescript
const summary = await sdk.fetchBondingCurveSummary(mint);

console.log(`Market cap: ${summary.marketCap.toNumber() / 1e9} SOL`);
console.log(`Progress: ${(summary.progressBps / 100).toFixed(1)}%`);
console.log(`Buy price: ${summary.buyPricePerToken.toString()} lamports/token`);
console.log(`Graduated: ${summary.isGraduated}`);
```

## Next Steps

### Learn the SDK

- [Examples](./examples.md) — 20+ practical code examples for common operations
- [Analytics Guide](./analytics.md) — price impact, graduation progress, token pricing
- [API Reference](./api-reference.md) — every exported function, type, and constant
### Understand the Protocol

- [Architecture](./architecture.md) — how the SDK is structured
- [Bonding Curve Math](./bonding-curve-math.md) — virtual reserves, constant-product AMM formulas
- [Fee Sharing Guide](./fee-sharing.md) — set up creator fee distribution to shareholders
- [Fee Tiers](./fee-tiers.md) — tiered fee schedule based on token supply
- [Token Incentives Guide](./token-incentives.md) — volume-based token rewards program
- [Mayhem Mode](./mayhem-mode.md) — alternate PDA routing mode
- [End-to-End Workflow](./end-to-end-workflow.md) — complete token lifecycle from create to graduate

### Follow the Tutorials

19 hands-on guides from beginner to advanced — see the [Tutorials Index](../tutorials/README.md):
- Start with [Tutorial 1: Create Your First Token](../tutorials/01-create-token.md)
- Then [Tutorial 2: Buy Tokens](../tutorials/02-buy-tokens.md) and [Tutorial 3: Sell Tokens](../tutorials/03-sell-tokens.md)
- For advanced topics: [Trading Bot](../tutorials/11-trading-bot.md), [Telegram Bot](../tutorials/18-telegram-bot.md), [x402 Payments](../tutorials/14-x402-paywalled-apis.md)

### Explore the Ecosystem

- [Ecosystem Overview](./ecosystem.md) — comprehensive map of every component in this repository
- [Telegram Bot](../telegram-bot/README.md) — fee claim monitor, CTO alerts, whale detection
- [Channel Bot](../channel-bot/README.md) — read-only Telegram channel feed
- [WebSocket Relay](../websocket-server/README.md) — real-time token launch feed for browsers
- [Live Dashboards](../live/README.md) — browser-based token launch & trade monitoring
- [x402 Payments](../x402/README.md) — HTTP 402 micropayments with Solana USDC
- [Rust Vanity Generator](../rust/README.md) — 100K+ keys/sec multi-threaded generator
- [TypeScript Vanity Generator](../typescript/README.md) — educational reference implementation

### Maintain and Debug

- [Migration Guide](./MIGRATION.md) — upgrading between SDK versions
- [Troubleshooting](./TROUBLESHOOTING.md) — common issues and solutions
- [Testing Guide](./testing.md) — how to run every test suite
- [Security](./security.md) — security practices and key handling rules


