# TokenMill Module

A comprehensive token creation and management module for the Solana blockchain, providing a complete suite of tools for token lifecycle management, including market creation, bonding curve configuration, swapping, staking, and vesting.

## Core Features

### Token Market Creation & Management
- Create new token markets with customizable parameters
- Configure token metadata (name, symbol, URI)
- Set creator and staking fees
- Manage total supply and distribution
- Fund markets with SOL/wSOL

### Bonding Curve Configuration
- Multiple curve types support:
  - Linear
  - Power
  - Exponential
  - Logarithmic
- Visual curve configuration
- Real-time price point updates
- Customizable parameters:
  - Base price
  - Top price
  - Number of points
  - Fee percentage
  - Power factor

### Token Operations
- **Swapping**:
  - Buy tokens using SOL
  - Sell tokens for SOL
  - Real-time price calculations
  - Slippage protection
  
- **Staking**:
  - Stake tokens for rewards
  - Configurable staking periods
  - Reward distribution management
  
- **Vesting**:
  - Create vesting schedules
  - Release vested tokens
  - Track vesting progress
  - Multiple beneficiary support

## Components

### Market Management
- **MarketCreationCard**: Create new token markets
  ```typescript
  <MarketCreationCard
    connection={connection}
    publicKey={publicKey}
    solanaWallet={wallet}
    setLoading={setLoading}
    onMarketCreated={handleMarketCreated}
  />
  ```

- **FundMarketCard**: Fund market liquidity
- **FundUserCard**: Fund user wallets with wSOL

### Trading & Pricing
- **BondingCurveCard**: Configure and visualize price curves
  ```typescript
  <BondingCurveCard
    marketAddress={marketAddress}
    connection={connection}
    publicKey={publicKey}
    solanaWallet={wallet}
    setLoading={setLoading}
    onCurveChange={handleCurveChange}
  />
  ```

- **BondingCurveConfigurator**: Advanced curve settings
- **SwapCard**: Token swap interface

### Token Management
- **StakingCard**: Stake and unstake tokens
- **VestingCard**: Manage token vesting
- **ExistingAddressesCard**: Handle existing token addresses

## Services

### TokenMillService
Core service providing all token-related operations:

```typescript
import { 
  createMarket,
  fundUserWithWSOL,
  stakeTokens,
  swapTokens,
  setBondingCurve
} from '@/modules/token-mill';

// Create a new market
const market = await createMarket({
  tokenName: 'My Token',
  tokenSymbol: 'MTK',
  metadataUri: 'https://...',
  totalSupply: 1_000_000,
  creatorFee: 2.5,
  stakingFee: 1.0,
  userPublicKey: publicKey,
  connection,
  solanaWallet: wallet
});

// Configure bonding curve
await setBondingCurve({
  marketAddress: market.address,
  askPrices: [...],
  bidPrices: [...],
  userPublicKey: publicKey,
  connection,
  solanaWallet: wallet
});
```

## Error Handling

The module implements comprehensive error handling:
- Input validation
- Transaction simulation
- Network error recovery
- User-friendly error messages
- Status updates during operations

## Styling

Components follow the app's design system:
- Dark mode support
- Responsive layouts
- Loading states
- Error states
- Interactive elements
- Custom style overrides via props

## Best Practices

### Performance
- Minimize network calls
- Cache curve calculations
- Debounce user inputs
- Optimize re-renders
- Use web workers for heavy computations

### Security
- Input sanitization
- Transaction simulation
- Fee validation
- Slippage protection
- Error boundary implementation

## Usage Examples

### Creating a Token Market
```typescript
import { TokenMillScreen, createMarket } from '@/modules/token-mill';

// Quick start - use the screen
function App() {
  return <TokenMillScreen />;
}

// Custom implementation
async function createCustomToken() {
  const result = await createMarket({
    tokenName: 'Custom Token',
    tokenSymbol: 'CTK',
    metadataUri: 'https://...',
    totalSupply: 1_000_000,
    creatorFee: 2.0,
    stakingFee: 1.0,
    userPublicKey,
    connection,
    solanaWallet: wallet,
    onStatusUpdate: (status) => console.log(status)
  });
  
  console.log('Market created:', result);
}
```

### Configuring a Bonding Curve
```typescript
import { BondingCurveConfigurator } from '@/modules/token-mill';

function CurveConfig() {
  const handleCurveChange = (pricePoints, parameters) => {
    console.log('New curve configuration:', { pricePoints, parameters });
  };

  return (
    <BondingCurveConfigurator
      onCurveChange={handleCurveChange}
      disabled={false}
      styleOverrides={{
        container: { margin: 20 }
      }}
    />
  );
}
``` 