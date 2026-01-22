# Meteora Module

The Meteora module integrates Meteora's Dynamic Liquidity Markets (DLMM) and token creation functionalities into the application. It allows users to swap tokens, manage liquidity, and create new tokens with customizable bonding curves.

This module interacts with a backend service (assumed to be running at `http://localhost:8080/api` or a configurable `SERVER_URL`) that wraps the Meteora SDK to simplify client-side interactions.

## Core Functionalities

- **Token Swapping**: Allows users to swap between different tokens using Meteora's liquidity pools.
- **Liquidity Management**: Enables users to add and view their liquidity positions in Meteora pools (removal functionality is planned).
- **Token Creation**: Provides a comprehensive interface for creating new SPL tokens or Token-2022 tokens with dynamic bonding curves, including metadata upload and initial liquidity provisioning.
- **Bonding Curve Visualization**: Dynamically visualizes the token's price curve based on creation parameters.

## Module Structure

```
src/modules/meteora/
├── components/               # Reusable UI components for Meteora features.
│   ├── SwapForm.tsx            # Form for initiating token swaps.
│   ├── LiquidityPanel.tsx      # Panel for viewing and managing liquidity positions.
│   ├── TokenCreationForm.tsx   # Multi-step form for creating new tokens and their bonding curves.
│   ├── BondingCurveVisualizer.tsx # Component to visualize the token's price curve.
│   └── index.ts                # Barrel file for components.
├── screens/                  # Top-level screen components for the module.
│   └── MeteoraScreen.tsx       # Main screen integrating swap, liquidity, and token creation features (currently defaults to Token Creation).
├── services/                 # Logic for interacting with the Meteora backend service.
│   ├── meteoraService.ts       # Contains functions to call backend endpoints (e.g., create pool, swap, get quote).
│   └── index.ts                # Barrel file for services.
├── types/                    # TypeScript type definitions specific to the Meteora module.
│   └── index.ts                # Defines interfaces and enums (MeteoraTrade, LiquidityPosition, CreateConfigParams, etc.).
└── index.ts                  # Main barrel file for exporting all public APIs of the module.
└── README.md                 # This file.
```

## Key Components

- **`MeteoraScreen`**: The main entry point for Meteora features. It currently defaults to displaying the token creation flow but is designed to potentially include tabs for swapping and liquidity management.
- **`TokenCreationForm`**: A multi-step form that guides the user through:
    - Basic token information (name, symbol, description, image).
    - Bonding curve parameters (initial/migration market cap, supply, fees).
    - Optional immediate purchase of tokens upon creation.
    - Advanced settings for fees and LP distribution.
    - Metadata upload to a service like IPFS (via the backend).
- **`SwapForm`**: Allows users to select input/output tokens, specify an amount, and get a swap quote from the backend. It then executes the trade.
- **`LiquidityPanel`**: Displays the user's current liquidity positions and lists available pools. It includes functionality to add liquidity (currently with mock values for amounts).
- **`BondingCurveVisualizer`**: Renders an SVG chart that dynamically updates to show the projected price curve of a token based on the parameters entered in `TokenCreationForm`.

## Key Services (`meteoraService.ts`)

This service acts as a client for a backend API that implements the Meteora SDK. All functions in `meteoraService.ts` make calls to this backend.

- **Token Creation & Configuration:**
    - `createConfig(params, connection, wallet, onStatusUpdate)`: Creates a new Dynamic Bonding Curve (DBC) configuration.
    - `buildCurveByMarketCap(params, connection, wallet, onStatusUpdate)`: Builds a bonding curve based on market cap parameters and creates the associated config.
    - `createPool(params, connection, wallet, onStatusUpdate)`: Creates a new liquidity pool for a configured token.
    - `uploadTokenMetadata(params)`: Uploads token metadata (name, symbol, image) to a metadata store (e.g., IPFS via backend).
    - `createTokenWithCurve(params, connection, wallet, onStatusUpdate)`: A comprehensive function that combines metadata upload and `buildCurveByMarketCap` to launch a new token with its bonding curve.
    - `createPoolAndBuy(params, connection, wallet, onStatusUpdate)`: Creates a pool and immediately buys a specified amount of the new token.
    - `createPoolMetadata(params, connection, wallet, onStatusUpdate)`: Creates on-chain metadata for a virtual pool.

- **Swapping & Liquidity:**
    - `fetchMeteoraPools()`: Fetches available Meteora liquidity pools from the backend.
    - `fetchUserLiquidityPositions(walletAddress)`: Fetches the user's current liquidity positions.
    - `fetchSwapQuote(inputToken, outputToken, amount, slippage, poolAddress?)`: Gets a swap quote from the backend.
    - `executeTrade(tradeParams, poolAddress, wallet, onStatusUpdate)`: Executes a token swap.
    - `addLiquidity(poolAddress, tokenAAmount, tokenBAmount, slippage, connection, wallet, onStatusUpdate)`: Adds liquidity to a specified pool.
    - `removeLiquidity(positionId, percentage, connection, wallet, onStatusUpdate)`: Removes a percentage of liquidity from a position.

## Types (`types/index.ts`)

The `types/index.ts` file defines all necessary TypeScript interfaces and enums that correspond to Meteora SDK structures and API request/response bodies. Key types include:
- `MeteoraTrade`, `LiquidityPosition`, `MeteoraPool`
- `CreateConfigParams`, `BuildCurveByMarketCapParams`, `CreatePoolParams`
- Enums for `TokenType`, `FeeSchedulerMode`, `ActivationType`, `CollectFeeMode`, `MigrationOption`, `MigrationFeeOption`.

## Usage Example (Token Creation Flow)

The `MeteoraScreen` currently focuses on the token creation process:

1.  The user navigates to the Meteora section of the app.
2.  `MeteoraScreen` renders `TokenCreationForm`.
3.  The user fills in token details (name, symbol, supply, market caps, etc.) and uploads an image.
4.  `BondingCurveVisualizer` (embedded in `TokenCreationForm`) updates in real-time to show the expected price curve.
5.  Upon submission, `TokenCreationForm` calls `uploadTokenMetadata` and then `createTokenWithCurve` from `meteoraService.ts`.
6.  `meteoraService.ts` communicates with the backend, which uses the Meteora SDK to perform on-chain actions.
7.  The user's wallet is prompted to sign transactions.
8.  Status updates are provided throughout the process.
9.  On success, `onTokenCreated` callback is triggered, potentially updating UI or navigating the user.

```typescript
// Example of how MeteoraScreen might be used (simplified)
import { MeteoraScreen } from '@/modules/meteora'; // Assuming @ is an alias for src

function AppNavigator() {
  // ... other navigation setup ...
  return (
    <Stack.Screen
      name="Meteora"
      component={MeteoraScreen}
      options={{ headerShown: false }}
    />
  );
}
```

## Backend Dependency

It's crucial to note that this module relies heavily on a backend server that implements the Meteora SDK. The frontend `meteoraService.ts` is essentially an API client for this server. The backend handles the complexities of interacting with the Solana blockchain and the Meteora programs.

Ensure the `SERVER_URL` environment variable is correctly configured to point to this backend API. 