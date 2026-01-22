# Buy Card Components

This directory contains components for purchasing tokens and cryptocurrencies.

## Components

### BuyCard
A comprehensive component for buying tokens:

**Features:**
- Token selection interface
- Price display with real-time updates
- Amount input with validation
- Payment method selection
- Transaction confirmation
- Success/failure states
- Order history

## Styling

Styling for these components can be found in:
- `buyCard.style.ts`: Contains all styles for the buy card components

## Usage

```typescript
import { BuyCard } from '@core/profile';

function TokenPurchaseScreen() {
  return (
    <BuyCard 
      defaultToken="SOL"
      availableTokens={['SOL', 'USDC', 'BONK']}
      onPurchaseComplete={(transaction) => {
        // Handle purchase completion
      }}
      theme="light"
    />
  );
}
```

## Integration Points

The BuyCard component integrates with:
- Price data providers
- Wallet connections for transactions
- Payment processors
- Blockchain networks for transaction validation
- Token data services 