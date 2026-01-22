# Swap Module

A comprehensive token swapping module that integrates multiple DEX providers (Jupiter, Raydium, PumpSwap) into a unified interface for the Solana blockchain.

## Core Features

### Multi-Provider Support
- **Jupiter**: Primary DEX aggregator for optimal swap routes
- **Raydium**: Direct pool swaps with concentrated liquidity
- **PumpSwap**: Custom pool swaps with configurable slippage

### Components
- **SwapScreen**: Main swap interface with token selection, amount input, and provider selection
- **SelectTokenModal**: Token selection interface with search and popular tokens
- **SwapComponents**:
  - `Shimmer`: Loading animation component
  - `ProviderSelector`: DEX provider selection interface
  - `PumpSwapControls`: Pool address and slippage configuration for PumpSwap
  - `SwapInfo`: Displays conversion rates and transaction details
  - `StatusDisplay`: Shows loading states and transaction status
  - `Keypad`: Numeric input interface

### Services
- **TradeService**: A provider-agnostic service for executing swaps. It delegates to the appropriate provider-specific service.
- **JupiterUltraService**: Jupiter-specific operations, such as getting quotes and building swap transactions.
- **RaydiumService**: Raydium-specific swap logic.
- **PumpSwapService**: Handles swaps on Pump.fun.

### Hooks
- **useSwapLogic**: Custom hook managing swap functionality
  - Token state management
  - Price and balance updates
  - Transaction execution
  - UI state handling

## Usage

```typescript
import { SwapScreen, useSwapLogic, TradeService } from '@/modules/swap';

// Basic screen implementation
export default function CustomSwapScreen() {
  return <SwapScreen />;
}

// Custom implementation using hook
function CustomSwapImplementation() {
  const {
    inputToken,
    outputToken,
    handleSwap,
    // ... other swap logic
  } = useSwapLogic(routeParams, publicKey, connected, sendTransaction);
  
  // Custom UI implementation
}

// Direct service usage
const swapResult = await TradeService.executeSwap(
  inputToken,
  outputToken,
  amount,
  walletPublicKey,
  sendTransaction
);
```

## Features

### Token Selection
- Search functionality with token metadata
- Popular tokens list
- Token balance display
- Price information
- Custom token import

### Swap Interface
- Real-time price updates
- Slippage control
- Transaction fee display
- Transaction status tracking
- Error handling and recovery

### Provider-Specific Features
- **Jupiter**: 
  - Route optimization
  - Price impact calculation
  - Multiple hop swaps
  
- **Raydium**:
  - Direct pool swaps
  - Concentrated liquidity pools
  - Fee sharing options
  
- **PumpSwap**:
  - Custom pool address input
  - Configurable slippage (1-30%)
  - High impact warning system

## Error Handling
- Connection state validation
- Balance checks
- Transaction simulation
- Fee calculation validation
- Provider availability checks

## Styling
- Dark mode support
- Responsive design
- Loading states with shimmer effects
- Animated transitions
- Platform-specific adjustments (iOS/Android) 