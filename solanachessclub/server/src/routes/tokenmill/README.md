# TokenMill Routes

This directory contains all the Express.js routes related to the TokenMill Solana program. These endpoints facilitate token creation, market management, swapping, staking, and vesting functionality.

## API Endpoints

### Token Creation

- **POST `/api/tokenmill/tokens`**: Create a new token within a market
  - Requires token details and market index
  - Returns serialized transaction for client signing

### Market Management

- **POST `/api/tokenmill/markets`**: Create a new token market
  - Requires market parameters, token details, and user wallet
  - Returns transaction for market creation

- **POST `/api/tokenmill/free-market`**: Free a market from restrictions
  - Requires market index and authority signature
  - Returns transaction to remove market restrictions

- **POST `/api/tokenmill/set-curve`**: Set market curve parameters
  - Configures bonding curve for the specified market
  - Sets pricing parameters, fees, and curve type

- **GET `/api/tokenmill/graduation/:marketIndex`**: Get graduation information for a market
  - Returns eligibility and requirements for graduation

### Token Swapping

- **POST `/api/tokenmill/swap`**: Swap tokens within a market
  - Handles both buying and selling operations
  - Requires market index, amount, and swap direction
  - Returns serialized transaction for client signing

- **POST `/api/tokenmill/quote-swap`**: Get a quote for a token swap
  - Calculates expected output for a given input
  - Returns price impact, fees, and expected tokens

### Staking

- **POST `/api/tokenmill/stake`**: Create a staking position
  - Requires token amount, market index, and duration
  - Returns transaction for creating the stake

- **POST `/api/tokenmill/unstake`**: Unstake tokens from a position
  - Requires stake position details
  - Returns transaction for unstaking

### Vesting

- **POST `/api/tokenmill/vesting`**: Create a vesting schedule
  - Sets up token vesting for a recipient
  - Requires token amount, market index, and vesting parameters
  - Returns transaction for creating the vesting schedule

- **POST `/api/tokenmill/vesting/release`**: Release vested tokens
  - Claims tokens that have completed their vesting period
  - Requires vesting position details
  - Returns transaction for token release

### Metadata and Information

- **POST `/api/tokenmill/get-asset`**: Get asset metadata
  - Retrieves token information and market details
  - Returns metadata for display in applications

- **POST `/api/tokenmill/quote-token-badge`**: Get token badge quote
  - Provides pricing information for token badge creation
  - Returns fee and cost estimates

## Implementation Pattern

Each route file follows a consistent pattern:

```typescript
import express, { Request, Response } from 'express';
import { tokenMillController } from '../../controllers/tokenMillController';

const router = express.Router();

router.post('/endpoint', async (req: Request, res: Response) => {
  try {
    const result = await tokenMillController.functionName(req.body);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in endpoint:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
```

## Error Handling

All routes implement consistent error handling:

- Try-catch blocks around controller calls
- Detailed error logging
- Consistent error response format
- Appropriate HTTP status codes

## Authentication

Some endpoints require authentication or specific permissions:

- Market creation requires valid wallet signature
- Free market operations require admin or creator permissions
- Token creation requires market creator permissions

## Best Practices

When adding new TokenMill routes:

1. Follow the established pattern for route implementation
2. Add comprehensive documentation for the endpoint
3. Ensure proper validation of request data
4. Implement appropriate error handling
5. Use descriptive route names that follow RESTful conventions 