# Swap Routes

This directory contains Express.js routes related to token swapping functionality for the Solana App Kit server. These endpoints provide integration with different swap protocols including Jupiter and PumpSwap.

## API Endpoints

### Jupiter Swap Endpoints

- **POST `/api/swap/jupiter/quote`**: Get a swap quote from Jupiter
  - Calculates expected output for a given input
  - Returns price impact, fees, and route information
  - Supports multiple input/output token combinations

- **POST `/api/swap/jupiter/swap`**: Execute a swap via Jupiter
  - Creates and returns a transaction for swapping tokens
  - Includes slippage protection
  - Returns serialized transaction for client signing

- **GET `/api/swap/jupiter/tokens`**: Get supported tokens
  - Returns list of tokens supported by Jupiter
  - Includes token metadata and market information

- **POST `/api/swap/jupiter/routes`**: Get possible swap routes
  - Returns available routes for swapping between tokens
  - Includes fee and price impact information for each route

### PumpSwap Endpoints

- **POST `/api/swap/pumpswap/quote`**: Get a swap quote from PumpSwap
  - Calculates expected output for a given input
  - Returns price impact and fees
  - Specialized for PumpSwap pools

- **POST `/api/swap/pumpswap/swap`**: Execute a swap via PumpSwap
  - Creates and returns a transaction for swapping tokens
  - Returns serialized transaction for client signing

- **POST `/api/swap/pumpswap/liquidity/add`**: Add liquidity to a PumpSwap pool
  - Creates transaction for adding liquidity
  - Returns LP token information

- **POST `/api/swap/pumpswap/liquidity/remove`**: Remove liquidity from a PumpSwap pool
  - Creates transaction for removing liquidity
  - Returns expected token amounts

- **POST `/api/swap/pumpswap/pool/create`**: Create a new PumpSwap pool
  - Creates a transaction for initializing a new pool
  - Sets initial liquidity and parameters

### General Swap Utilities

- **GET `/api/swap/price/:tokenAddress`**: Get token price information
  - Returns current price in USD and SOL
  - Includes 24h change and volume

- **GET `/api/swap/pools`**: Get list of available pools
  - Returns pools from multiple protocols
  - Includes TVL, volume, and APR information

## Implementation Pattern

Routes follow a consistent implementation pattern:

```typescript
import express, { Request, Response } from 'express';
import { jupiterController } from '../../controllers/jupiterSwapController';

const router = express.Router();

router.post('/quote', async (req: Request, res: Response) => {
  try {
    const { inputMint, outputMint, amount } = req.body;
    
    // Validate required parameters
    if (!inputMint || !outputMint || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const quoteResult = await jupiterController.getQuote(inputMint, outputMint, amount);
    
    return res.status(200).json({
      success: true,
      data: quoteResult
    });
  } catch (error) {
    console.error('Error getting swap quote:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get swap quote'
    });
  }
});

export default router;
```

## Protocol Integration

The swap routes integrate with multiple protocols:

1. **Jupiter**: Solana's liquidity aggregator for best price execution
2. **PumpSwap**: Specialized AMM for meme tokens and social tokens
3. **Future protocols**: The architecture supports adding additional swap protocols

## Error Handling

All routes implement comprehensive error handling for:

- Invalid input parameters
- Insufficient liquidity
- Price impact limits
- RPC errors
- Slippage tolerance issues

## Best Practices

When working with swap routes:

1. Always validate input parameters thoroughly
2. Implement slippage protection for all swap operations
3. Monitor for price manipulation attempts
4. Set reasonable gas limits and price impact thresholds
5. Cache frequently requested data (token lists, pool information)
6. Implement rate limiting to prevent abuse
7. Provide detailed error messages for debugging
8. Document all endpoints with expected parameters and responses 