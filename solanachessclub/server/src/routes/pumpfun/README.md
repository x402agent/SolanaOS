# PumpFun Routes

This directory contains Express.js routes related to the PumpFun token launch functionality for the Solana App Kit server. These endpoints facilitate token launches, participation, and status tracking on the PumpFun platform.

## API Endpoints

### Token Launch

- **POST `/api/pumpfun/launch`**: Launch a new token
  - Creates a new token on PumpFun platform
  - Sets up initial parameters, supply, and distribution
  - Returns launch details and transaction information

- **POST `/api/pumpfun/launch/verify`**: Verify a token launch
  - Confirms that a token launch transaction was successful
  - Returns final token information and market data

- **POST `/api/pumpfun/launch/participate`**: Participate in a token launch
  - Allows users to join a token launch
  - Creates transaction for participation
  - Returns serialized transaction for client signing

### Token Information

- **GET `/api/pumpfun/token/:address`**: Get token information
  - Returns detailed information about a specific token
  - Includes price, supply, holder count, and market metrics

- **GET `/api/pumpfun/tokens/hot`**: Get hot tokens
  - Returns list of trending tokens on PumpFun
  - Sorted by recent volume or price action
  - Includes basic token information

- **GET `/api/pumpfun/tokens/new`**: Get new token launches
  - Returns recently launched tokens
  - Sorted by launch date
  - Includes basic token information

### Market Data

- **GET `/api/pumpfun/market/:address`**: Get market data
  - Returns market information for a specific token
  - Includes price history, volume, and market metrics

- **GET `/api/pumpfun/market/:address/chart`**: Get price chart data
  - Returns time-series data for token price
  - Supports different time intervals (1h, 24h, 7d, 30d)
  - Formatted for chart visualization

### User Participation

- **GET `/api/pumpfun/user/:walletAddress/launches`**: Get user's launch history
  - Returns tokens the user has participated in launching
  - Includes participation details and outcomes

- **GET `/api/pumpfun/user/:walletAddress/tokens`**: Get user's token holdings
  - Returns tokens held by the user on PumpFun
  - Includes amount, value, and profit/loss information

## Implementation Pattern

Routes follow a consistent implementation pattern:

```typescript
import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { pumpfunController } from '../../controllers/pumpfunController';

const router = express.Router();

router.post('/launch', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user.id; // Set by requireAuth middleware
    const launchResult = await pumpfunController.launchToken({
      ...req.body,
      userId
    });
    
    return res.status(201).json({
      success: true,
      data: launchResult
    });
  } catch (error) {
    console.error('Error launching token:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
```

## PumpFun SDK Integration

The routes utilize the PumpFun SDK for communication with the platform:

- Token creation and launching
- Market data retrieval
- User participation
- Transaction building

## Authentication

Most PumpFun routes require authentication:

- **Public routes**: Basic token and market information
- **Protected routes**: Token launching, participation, and user-specific information

## Best Practices

When working with PumpFun routes:

1. Validate all parameters before submitting to the PumpFun API
2. Implement rate limiting to prevent abuse
3. Cache frequently accessed token and market data
4. Include appropriate error handling for PumpFun API errors
5. Document requirements for token launches
6. Implement transaction simulation before submission
7. Verify transaction success after submission
8. Store relevant information in the local database for quicker access 