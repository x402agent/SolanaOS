# Development Guide

> How to set up, build, test, and extend the Pump SDK.

---

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Environment Setup](#environment-setup)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Build System](#build-system)
- [Adding a New Feature](#adding-a-new-feature)
- [Debugging](#debugging)
- [Common Issues](#common-issues)

---

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Language | TypeScript | 5.0+ |
| Runtime | Node.js | ≥ 18.0 |
| Package Manager | npm | ≥ 9.0 |
| Build Tool | tsup | latest |
| Test Framework | Jest (ts-jest) | 29.x |
| Linter | ESLint + Prettier | 9.x |
| Blockchain SDK | @solana/web3.js | 1.98+ |
| IDL Framework | @coral-xyz/anchor | 0.31+ |
| Precision Math | bn.js | 5.x |
| Rust (vanity gen) | Rust + Cargo | 1.70+ |

---

## Environment Setup

### 1. Clone and Install

```bash
git clone https://github.com/nirholas/pump-fun-sdk.git
cd pump-fun-sdk
npm install
```

### 2. Build

```bash
npm run build
```

This produces:
- `dist/` — CommonJS build with TypeScript declarations
- `dist/esm/` — ESM build

### 3. Verify

```bash
npm test              # Run all tests
npm run typecheck     # Type-check without emitting
npm run lint          # Lint check
```

### 4. (Optional) Rust Vanity Generator

```bash
cd rust
cargo build --release
cargo test
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build CJS + ESM output with `.d.ts` declarations (via tsup) |
| `npm run dev` | Build in watch mode — auto-rebuilds on file changes |
| `npm test` | Run all Jest tests (`src/__tests__/` and `tests/`) |
| `npm run lint` | Check for lint errors with ESLint |
| `npm run lint:fix` | Auto-fix lint errors |
| `npm run typecheck` | Run `tsc --noEmit` for type validation |
| `npm run clean` | Delete the `dist/` directory |
| `npm run prepublishOnly` | Auto-runs build before `npm publish` |

### Makefile Targets

The project also includes a Makefile with additional targets:

```bash
make install          # npm install
make build            # npm run build
make test             # npm test
make lint             # npm run lint
make clean            # rm -rf dist node_modules
make generate         # Run vanity address generator scripts
make verify           # Verify generated keypairs
make docs             # Generate documentation
```

---

## Project Structure

```
src/
├── index.ts              # Public API — all exports go through here
├── sdk.ts                # PumpSdk class — offline instruction builders
│                         #   createV2Instruction, buyInstructions, sellInstructions,
│                         #   feeSharing, ammInstructions, decodeEvents, etc.
├── onlineSdk.ts          # OnlinePumpSdk — extends PumpSdk with:
│                         #   fetchBondingCurve, fetchBuyState, fetchSellState,
│                         #   fetchGraduationProgress, collectCreatorFees, etc.
├── bondingCurve.ts       # Pure math: getBuyTokenAmountFromSolAmount,
│                         #   getSellSolAmountFromTokenAmount, bondingCurveMarketCap
├── fees.ts               # Fee calculation: getFee, computeFeesBps, calculateFeeTier
├── pda.ts                # PDA derivation: bondingCurvePda, creatorVaultPda,
│                         #   canonicalPumpPoolPda, socialFeePda, etc.
├── state.ts              # TypeScript interfaces: Global, BondingCurve, Pool,
│                         #   TradeEvent, CreateEvent, Shareholder, Platform, etc.
├── analytics.ts          # calculateBuyPriceImpact, getGraduationProgress,
│                         #   getTokenPrice, getBondingCurveSummary
├── tokenIncentives.ts    # totalUnclaimedTokens, currentDayTokens
├── errors.ts             # Custom errors: InvalidShareTotalError, etc.
├── idl/                  # Anchor IDL JSON + TypeScript types (auto-generated)
│   ├── pump.json / .ts
│   ├── pump_amm.json / .ts
│   └── pump_fees.json / .ts
└── __tests__/            # Unit tests
    ├── fixtures.ts       # Shared test data (globals, bonding curves, fee configs)
    ├── bondingCurve.test.ts
    ├── fees.test.ts
    ├── analytics.test.ts
    ├── pda.test.ts
    ├── state.test.ts
    └── tokenIncentives.test.ts
```

---

## Build System

The SDK uses **tsup** for dual-format builds:

```typescript
// tsup.config.ts
export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["cjs"],          // CommonJS for Node.js require()
    outDir: "dist",
    dts: true,                // TypeScript declarations
    sourcemap: true,
  },
  {
    entry: ["src/index.ts"],
    format: ["esm"],          // ESM for modern bundlers
    outDir: "dist/esm",
    sourcemap: true,
  },
]);
```

### package.json Exports

```json
{
  "main": "./dist/index.js",
  "module": "./dist/esm/index.js",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.js",
      "import": "./dist/esm/index.js"
    }
  }
}
```

---

## Adding a New Feature

### Step 1: Understand the Pattern

All SDK methods follow the same pattern:

```typescript
// In sdk.ts (offline)
async myNewInstruction(params: MyParams): Promise<TransactionInstruction> {
  const program = getPumpProgram(/* ... */);
  return program.methods
    .myInstruction(/* on-chain args */)
    .accountsStrict({ /* required accounts */ })
    .instruction();
}
```

### Step 2: Add the Instruction Builder

1. Add your method to `PumpSdk` in `src/sdk.ts`
2. If it needs on-chain state, add a convenience method to `OnlinePumpSdk` in `src/onlineSdk.ts`
3. Export from `src/index.ts`

### Step 3: Add Types

If you need new account interfaces or event types:
1. Add them to `src/state.ts`
2. Export them from `src/index.ts`

### Step 4: Add PDA Derivation (if needed)

If your instruction uses a new PDA:
1. Add the derivation function to `src/pda.ts`
2. Export from `src/index.ts`

### Step 5: Write Tests

1. Create or extend a test file in `src/__tests__/`
2. Use fixtures from `src/__tests__/fixtures.ts`
3. Test both success and error paths

```typescript
// src/__tests__/myFeature.test.ts
import { PUMP_SDK } from "../sdk";
import { testGlobal, testBondingCurve } from "./fixtures";

describe("myNewInstruction", () => {
  it("should build a valid instruction", async () => {
    const ix = await PUMP_SDK.myNewInstruction({ /* params */ });
    expect(ix.programId.toBase58()).toBe(PUMP_PROGRAM_ID);
    expect(ix.keys).toHaveLength(/* expected accounts */);
  });

  it("should throw on invalid input", async () => {
    await expect(
      PUMP_SDK.myNewInstruction({ /* bad params */ })
    ).rejects.toThrow();
  });
});
```

### Step 6: Verify

```bash
npm test              # Tests pass
npm run typecheck     # Types check
npm run lint          # Lint passes
npm run build         # Build succeeds
```

---

## Debugging

### TypeScript Issues

```bash
# Run the project's type checker
npm run typecheck
```

### Test Debugging

```bash
# Run a single test with verbose output
npx jest src/__tests__/bondingCurve.test.ts --verbose

# Run tests matching a name pattern
npx jest -t "getBuyTokenAmountFromSolAmount"

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand src/__tests__/fees.test.ts
```

### BN Arithmetic Debugging

When debugging `BN` calculations, convert to strings for readable output:

```typescript
console.log("amount:", amount.toString());
console.log("fee:", fee.toString());
console.log("market cap:", marketCap.toString(), "lamports");
console.log("market cap SOL:", marketCap.div(new BN(1e9)).toString(), "SOL");
```

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `Cannot find module '@nirholas/pump-sdk'` | Package not built | Run `npm run build` |
| `TypeError: Cannot read properties of null` | Account not found on-chain | Verify the mint address exists; check RPC endpoint |
| `BN is not a constructor` | Missing bn.js import | `import BN from "bn.js"` (default import) |
| `Invalid account discriminator` | Wrong account type for decoder | Verify you're passing the right account (bonding curve vs pool) |
| Tests fail with `Cannot find module` | Missing dev dependencies | Run `npm install` |
| `TypeScript: Property X does not exist` | Outdated types after IDL change | Run `npm run build` to regenerate |
| Build fails with ESM errors | Node.js version too old | Upgrade to Node.js ≥ 18 |
| `Anchor error: AccountNotInitialized` | Account doesn't exist on-chain | Create the account first (e.g., `createFeeSharingConfig`) |
| Slippage errors on buy/sell | Price moved beyond tolerance | Increase `slippage` parameter or retry |
| `InvalidShareTotalError` | Fee shares don't sum to 10,000 | Ensure all `shareBps` values total exactly 10,000 |
