# TokenMill Service

This service provides a complete backend implementation for interacting with the TokenMill Solana program. TokenMill allows for the creation and management of token markets, token minting, staking, vesting, and market trading with customizable bonding curves.

## Features

The TokenMill service includes implementation for:

- Configuration of TokenMill program
- Market creation and management
- Token creation and management
- Token badge minting
- Market curve configuration
- Token swapping (buy/sell)
- Token staking
- Vesting schedules
- Market graduation

## Implementation

The service is built using:

- Anchor framework for Solana program interaction
- Web3.js for Solana blockchain transactions
- SPL Token program for token operations

## Available Functionality

### Configuration

- Create and initialize TokenMill configuration
- Retrieve configuration data
- Update configuration parameters

### Markets

- Create new token markets
- Configure market curves (linear, exponential, etc.)
- Set market fees and parameters
- Free markets from restrictions
- Fund markets with SOL
- Graduate markets to independent SPL tokens

### Tokens

- Create new tokens within markets
- Get token metadata and market information
- Manage token supply and distribution

### Swapping

- Buy tokens using SOL
- Sell tokens for SOL
- Get quotes for token swaps
- Execute swap transactions

### Staking

- Create staking positions
- Unstake tokens
- Calculate staking rewards
- Manage staking parameters

### Vesting

- Create vesting schedules
- Release vested tokens
- Track vesting progress
- Manage vesting parameters

## Usage

The service is used by controllers to handle API requests. It provides a clean interface for all TokenMill operations, handling the complexities of Solana transaction building, signing, and submission.

Example usage from a controller:

```typescript
import { createToken } from '../service/TokenMill/tokenService';

// In controller function
const result = await createToken({
  name: "My Token",
  symbol: "MTKN",
  marketIndex: 1,
  totalSupply: 1000000,
  decimals: 9,
  metadata: {
    description: "My awesome token",
    image: "https://example.com/image.png"
  }
});
```

## Configuration

The service requires the following environment variables:

- `TOKEN_MILL_PROGRAMID`: The Solana program ID for TokenMill
- `TOKEN_MILL_CONFIG_PDA`: The PDA address for TokenMill configuration
- `WALLET_PRIVATE_KEY`: Private key for the authority wallet
- `RPC_URL`: Solana RPC URL for network access

## Error Handling

The service implements comprehensive error handling for:

- Network issues
- Transaction failures
- Invalid parameters
- Authorization errors
- Rate limiting

## Security Considerations

- All transactions are signed by the authority wallet
- Input validation is performed for all parameters
- Rate limiting is implemented for high-volume operations
- Error messages are sanitized to prevent information leakage
