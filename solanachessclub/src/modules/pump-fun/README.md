# Pump.fun & PumpSwap Module

This module integrates functionalities for interacting with the Pump.fun platform and a generic PumpSwap AMM (Automated Market Maker) interface.

## Core Functionalities

### Pump.fun Integration
- **Token Launching**: Create and launch new tokens on Pump.fun, including metadata upload (name, symbol, description, image, social links) and initial liquidity provision.
- **Token Trading**: Buy and sell tokens listed on Pump.fun using its bonding curve mechanism or, if the token has migrated to Raydium, via Raydium's swap API.
- **RugCheck Integration**: Submit newly launched tokens for verification on RugCheck.

### PumpSwap AMM (Generic DEX Interaction via Server)
This part of the module interacts with a backend service that wraps the `@pump-fun/pump-swap-sdk` to simplify client-side interactions for a generic AMM.
- **Token Swapping**: Swap between different tokens using liquidity pools managed by the PumpSwap backend.
- **Liquidity Management**: Add liquidity to existing pools and remove liquidity.
- **Pool Creation**: Create new liquidity pools for token pairs.
- **Quotes**: Fetch quotes for swaps, adding liquidity, and removing liquidity.

## Module Structure

```
src/modules/pump-fun/
├── components/               # UI components for Pump.fun and PumpSwap
│   ├── pump-swap/            # Components specific to the PumpSwap AMM interface
│   │   ├── LiquidityAddSection.tsx
│   │   ├── LiquidityRemoveSection.tsx
│   │   ├── PoolCreationSection.tsx
│   │   ├── SwapSection.tsx
│   │   └── index.ts
│   ├── PumpfunBuySection.tsx   # UI for buying tokens on Pump.fun
│   ├── PumpfunCard.tsx       # Generic card component for styling
│   ├── PumpfunLaunchSection.tsx # UI for launching new tokens
│   ├── PumpfunSellSection.tsx  # UI for selling tokens on Pump.fun
│   └── Pumpfun.styles.ts     # Styles for Pump.fun components
├── hooks/                    # React hooks
│   └── usePumpFun.ts         # Hook for Pump.fun interactions (launch, buy, sell, verify)
├── navigation/               # Navigation setup for PumpSwap
│   ├── pumpSwapNavigator.tsx # Stack navigator for PumpSwap screens
│   └── index.ts
├── screens/                  # Screen components
│   ├── PumpSwapScreen.tsx    # Main screen for PumpSwap AMM functionalities (tabs for swap, pool, liquidity)
│   ├── pumpfunScreen.tsx     # Screen for launching tokens on Pump.fun
│   └── index.ts
├── services/                 # Business logic and API interactions
│   ├── pumpfunService.ts     # Service for Pump.fun specific actions (launch, buy, sell)
│   ├── pumpSwapService.ts    # Service for PumpSwap AMM actions (swap, liquidity, pool creation)
│   └── types.ts              # TypeScript types specific to services
├── types/                    # TypeScript interfaces and type definitions
│   └── index.ts              # Main type definitions for the module
├── utils/                    # Utility functions
│   ├── anchorMobilePatch.ts  # Patch for Anchor Wallet on mobile
│   ├── pumpfunUtils.ts       # Utilities for Pump.fun (Raydium checks, transaction building)
│   └── pumpSwapUtils.ts      # Utilities for PumpSwap (slippage, formatting)
├── index.ts                  # Main export file for the module
└── README.md                 # This file
```

## Key Components & Hooks

-   **`PumpfunLaunchSection`**: UI for creating and launching a new token on Pump.fun.
-   **`PumpfunBuySection`**: UI for buying tokens, handles Pump.fun bonding curve and Raydium swaps.
-   **`PumpfunSellSection`**: UI for selling tokens.
-   **`usePumpFun`**: Hook abstracting the logic for `launchToken`, `buyToken`, `sellToken`, and `submitTokenForVerification`.
-   **`PumpSwapScreen`**: Tabbed screen for interacting with the PumpSwap AMM (Swap, Add Liquidity, Remove Liquidity, Create Pool).
    -   **`SwapSection`**: Component for token swaps.
    -   **`LiquidityAddSection`**: Component for adding liquidity.
    -   **`LiquidityRemoveSection`**: Component for removing liquidity.
    -   **`PoolCreationSection`**: Component for creating new pools.

## Services

-   **`pumpfunService.ts`**:
    -   `createAndBuyTokenViaPumpfun`: Handles metadata upload to a server, token creation, and initial buy on Pump.fun.
    -   `buyTokenViaPumpfun`: Buys tokens. Checks if the token is on Raydium; if so, uses Raydium's API, otherwise uses Pump.fun SDK.
    -   `sellTokenViaPumpfun`: Sells tokens, similar logic to buying regarding Raydium.
-   **`pumpSwapService.ts`**: (Interacts with a backend that uses `@pump-fun/pump-swap-sdk`)
    -   `createPool`: Builds and sends a transaction to create a new liquidity pool.
    -   `addLiquidity`, `removeLiquidity`: Manage liquidity in pools.
    -   `swapTokens`: Executes token swaps.
    -   `getDepositQuoteFromBase`, `getDepositQuoteFromQuote`, `getSwapQuoteFromBase`, `getSwapQuoteFromQuote`, `getWithdrawalQuote`: Fetch various quotes from the backend.

## Utils

-   **`pumpfunUtils.ts`**: Contains helpers for interacting with Raydium (checking if a token is listed, getting swap fees/quotes, building transactions) and Pump.fun bonding curve transactions.
-   **`pumpSwapUtils.ts`**: General AMM utility functions like slippage calculation, fee calculation, token amount formatting.
-   **`anchorMobilePatch.ts`**: Provides `MobileWallet`, a React Native compatible replacement for Anchor's `NodeWallet`.

## Environment Variables

This module relies on environment variables, typically managed via an `.env` file and exposed through `@env`:

-   `SERVER_URL`: The base URL for the backend server that handles metadata uploads (for Pump.fun) and PumpSwap SDK interactions.
    -   Example Pump.fun metadata upload endpoint: `${SERVER_URL}/api/pumpfun/uploadMetadata`
    -   Example PumpSwap backend endpoints: `${SERVER_URL}/api/pump-swap/*`
-   `HELIUS_STAKED_URL` (or `RPC_URL`): The Solana RPC endpoint used.
-   `COMMISSION_WALLET`: Public key of the wallet to receive commissions for Pump.fun token launches.

## Usage Example

### Launching a Token on Pump.fun

```tsx
import { PumpfunLaunchSection } from '@/modules/pump-fun'; // or specific path

function MyLaunchScreen() {
  return (
    <PumpfunLaunchSection
      containerStyle={{ padding: 10 }}
      // Other props as needed
    />
  );
}
```

### Using the PumpSwap AMM

```tsx
import { PumpSwapScreen } from '@/modules/pump-fun';

function MyAMMScreen() {
  // Ensure wallet is connected and connection is established
  return <PumpSwapScreen />;
}
```

## Important Considerations

-   **Backend Dependency**: The PumpSwap AMM functionalities and Pump.fun metadata uploads depend on a backend server. Ensure this server is running and correctly configured.
-   **Wallet Integration**: Uses `@/modules/wallet-providers` for wallet connections and transaction signing. Ensure this is set up.
-   **Error Handling**: Services and hooks include `onStatusUpdate` callbacks and use `TransactionService` for user-facing success/error messages.
-   **Pump.fun vs. Raydium**: The `pumpfunService` intelligently switches between Pump.fun's native SDK and Raydium's API for trading depending on where the token is primarily active.
-   **PumpSwap SDK Wrapper**: The `pumpSwapService.ts` communicates with a server that acts as a wrapper around the `@pump-fun/pump-swap-sdk`. Direct SDK usage on the client-side for PumpSwap AMM operations is abstracted away by this service.
