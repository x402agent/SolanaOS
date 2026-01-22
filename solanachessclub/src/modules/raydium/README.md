# Raydium Module

This module provides integration with the Raydium platform, focusing on token launching (Launchpad) and swapping functionalities.

## Core Functionalities

### Raydium Launchpad
- **Token Creation & Launching**:
    - **JustSendIt Mode**: Simplified token launch with pre-defined standard configurations (e.g., 1B supply, 85 SOL AMM threshold, 51% on bonding curve).
    - **LaunchLab Mode**: Advanced configuration for token launches, allowing customization of:
        - Quote Token (e.g., SOL, USDC)
        - Token Supply
        - SOL to be Raised
        - Bonding Curve Percentage (51%-80%)
        - Vesting Percentage (0%-30%) and Schedule (duration, cliff, time unit)
        - Pool Migration Percentage (calculated based on bonding curve and vesting)
        - AMM vs CPMM Pool Migration
        - Fee Sharing (for CPMM pools)
        - Slippage
        - Initial Buy options (enable/disable, amount)
- **Metadata & Image Upload**: Handles uploading token metadata (name, symbol, description, social links) and token image to a server (which then pins to IPFS or similar).

### Raydium Swaps
- **Token Swapping**: Executes token swaps via a backend service that interacts with Raydium\'s SDK. This keeps direct SDK interaction off the client-side.

## Module Structure

```
src/modules/raydium/
├── components/
│   ├── AdvancedOptionsSection.styles.ts # Styles for the advanced options UI
│   ├── AdvancedOptionsSection.tsx       # UI for advanced token launch configurations (LaunchLab)
│   └── LaunchlabsLaunchSection.tsx      # UI for initial token details input (name, symbol, image, etc.) and choosing launch mode (JustSendIt vs LaunchLab)
├── screens/
│   └── LaunchlabsScreen.tsx             # Main screen orchestrating the token launch flow (combines LaunchlabsLaunchSection and AdvancedOptionsSection)
├── services/
│   └── raydiumService.ts                # Service for interacting with the backend for Raydium Launchpad and Swap functionalities
├── utils/
│   └── AdvancedOptionsSectionUtils.tsx  # Utility functions, constants, and type definitions for the AdvancedOptionsSection component (validation, calculations, sample data)
├── index.ts                             # Main export file for the module
└── README.md                            # This file
```

## Key Components

-   **`LaunchlabsScreen`**: The primary screen for the Raydium Launchpad feature. It manages the flow between inputting basic token details and configuring advanced options.
    -   Uses `LaunchlabsLaunchSection` for initial token data input.
    -   Uses `AdvancedOptionsSection` when the user opts for "LaunchLab" (advanced mode).
-   **`LaunchlabsLaunchSection`**: A UI component for users to input essential token information like name, symbol, description, image, and social links. It also allows the user to choose between "JustSendIt" (standard launch) or "Go To Lab" (advanced launch).
-   **`AdvancedOptionsSection`**: A detailed UI component for configuring all aspects of a token launch on Raydium Launchpad, including supply, pricing curve, vesting, and pool parameters. It includes input validation and visual feedback (like a bonding curve graph).

## Services

-   **`raydiumService.ts`**:
    -   `uploadTokenMetadata`: Uploads token metadata (name, symbol, description, image, social links) to a backend endpoint. The backend is expected to handle pinning to IPFS or a similar decentralized storage and return the metadata URI.
    -   `createAndLaunchToken`: Communicates with a backend service to create and launch a token on Raydium Launchpad. It sends all token data and configuration (from `LaunchpadTokenData` and `LaunchpadConfigData`) to the server.
        -   Supports both "JustSendIt" (simple mode with defaults) and "LaunchLab" (advanced mode with custom configuration).
        -   Handles initial token purchase if specified.
    -   `executeSwap`: Facilitates token swaps by calling a backend API. The client provides input/output tokens, amount, and user\'s public key. The server constructs and returns the transaction(s) to be signed by the user.

## Utils

-   **`AdvancedOptionsSectionUtils.tsx`**:
    -   Contains various helper functions for the `AdvancedOptionsSection` component:
        -   `parseNumericString`, `formatNumber`, `truncateAddress`
        -   Validation functions: `validateBondingCurvePercentage`, `validateVestingPercentage`, `validateSolRaised`
        -   Calculation functions: `calculatePoolMigrationPercentage`, `calculateGraphData` (for the bonding curve visualization), `convertVestingPeriodToSeconds`
    -   Defines constants like `TOKEN_SUPPLY_OPTIONS`, `TIME_UNIT_OPTIONS`, and `SAMPLE_TOKENS`.
    -   Includes a `TokenSelectionModal` component (though its primary use might be within the utils for demonstration or selection if quote tokens were dynamically fetched).
    -   Exports shared types like `TokenInfo` and re-exports `LaunchpadConfigData` from the service.

## Environment Variables

This module relies on environment variables, typically managed via an `.env` file:

-   `SERVER_URL`: The base URL for the backend server that handles:
    -   Raydium Launchpad metadata uploads (e.g., `${SERVER_URL}/api/raydium/launchpad/uploadMetadata`)
    -   Raydium Launchpad token creation (e.g., `${SERVER_URL}/api/raydium/launchpad/create`)
    -   Raydium swap transactions (e.g., `${SERVER_URL}/api/raydium/swap`)
-   `HELIUS_STAKED_URL` (or `RPC_URL`): The Solana RPC endpoint used for on-chain interactions if not handled by the backend.
-   `CLUSTER`: The Solana cluster (e.g., `mainnet-beta`, `devnet`).

## Usage Example

### Launching a Token via LaunchlabsScreen

```tsx
import { LaunchlabsScreen } from \'@/modules/raydium\'; // or specific path
import { NavigationContainer } from \'@react-navigation/native\'; // Assuming you have navigation setup

function App() {
  // Ensure WalletProvider, AuthProvider, etc., are set up higher in the tree
  return (
    <NavigationContainer>
      {/* ... other navigators or screens ... */}
      <LaunchlabsScreen />
      {/* ... other navigators or screens ... */}
    </NavigationContainer>
  );
}
```

## Important Considerations

-   **Backend Dependency**: Most functionalities, especially token creation, launch, metadata upload, and swaps, are heavily reliant on a backend server that implements the necessary logic using Raydium SDKs. Ensure this server is operational and correctly configured.
-   **Wallet Integration**: The module uses `@/modules/wallet-providers` (specifically `useAuth`, `useWallet`) for wallet connections, fetching the public key, and signing transactions. This integration must be correctly set up in the application.
-   **Error Handling and Status Updates**: The `raydiumService` and `LaunchlabsScreen` use callbacks (`statusCallback`, `isComponentMounted`) for providing feedback to the user during long operations like transaction processing. Errors are typically communicated via `Alert.alert`.
-   **Image Handling**: Token images are selected via `expo-image-picker` and can be provided as a URI. The `raydiumService.uploadTokenMetadata` function then sends this as form data to the backend.
-   **Configuration Complexity**: The "LaunchLab" mode offers many configuration options. The `AdvancedOptionsSection` and its utilities provide validation to guide the user, but understanding Raydium\'s Launchpad parameters is crucial. 