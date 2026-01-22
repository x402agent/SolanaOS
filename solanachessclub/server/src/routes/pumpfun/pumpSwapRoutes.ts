import express, { Request, Response } from 'express';
import { PumpSwapClient } from '../../service/pumpSwap/pumpSwapService';
import { PublicKey } from '@solana/web3.js';

// Create router and bypass type checking with 'as any' 
// This is necessary due to a version mismatch between Express 4.x and @types/express 5.x
const router = express.Router() as any;
const pumpSwapClient = new PumpSwapClient();

/**
 * Get a swap quote
 * @route POST /api/pump-swap/quote-swap
 */
router.post('/quote-swap', async (req: Request, res: Response) => {
  console.log('[PumpSwapRoutes] Received request to /quote-swap');
  console.log('[PumpSwapRoutes] Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    console.log('[PumpSwapRoutes] Calling pumpSwapClient.getSwapQuote');
    const result = await pumpSwapClient.getSwapQuote(req.body);
    console.log('[PumpSwapRoutes] Quote result:', JSON.stringify(result, null, 2));
    res.json(result);
  } catch (error: any) {
    console.error('[PumpSwapRoutes] Error in POST /quote-swap:', error);
    console.error('[PumpSwapRoutes] Error details:', error.stack);
    
    // Try to extract any RPC errors
    const errorMsg = error.message || '';
    if (errorMsg.includes('401 Unauthorized')) {
      console.error('[PumpSwapRoutes] RPC Authorization error detected - API key issue');
    }
    if (errorMsg.includes('429 Too Many Requests')) {
      console.error('[PumpSwapRoutes] RPC rate limit error detected');
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Error getting swap quote',
    });
  }
});

/**
 * Get a liquidity quote
 * @route POST /api/pump-swap/quote-liquidity
 */
router.post('/quote-liquidity', async (req: Request, res: Response) => {
  console.log('[PumpSwapRoutes] Received request to /quote-liquidity');
  console.log('[PumpSwapRoutes] Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    console.log('[PumpSwapRoutes] Calling pumpSwapClient.getLiquidityQuote');
    const result = await pumpSwapClient.getLiquidityQuote(req.body);
    console.log('[PumpSwapRoutes] Liquidity quote result:', JSON.stringify(result, null, 2));
    res.json(result);
  } catch (error: any) {
    console.error('[PumpSwapRoutes] Error in POST /quote-liquidity:', error);
    console.error('[PumpSwapRoutes] Error details:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Error getting liquidity quote',
    });
  }
});

/**
 * Build a swap transaction
 * @route POST /api/pump-swap/build-swap
 */
router.post('/build-swap', async (req: Request, res: Response) => {
  console.log('[PumpSwapRoutes] Received request to /build-swap');
  console.log('[PumpSwapRoutes] Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    // Validate input addresses
    try {
      console.log('[PumpSwapRoutes] Validating public keys');
      if (req.body.userPublicKey) {
        console.log('[PumpSwapRoutes] Validating userPublicKey:', req.body.userPublicKey);
        new PublicKey(req.body.userPublicKey);
      }
      
      if (req.body.pool) {
        console.log('[PumpSwapRoutes] Validating pool address:', req.body.pool);
        new PublicKey(req.body.pool);
      }
    } catch (err) {
      console.error('[PumpSwapRoutes] Invalid public key format:', err);
      return res.status(400).json({
        success: false,
        error: 'Invalid public key format',
      });
    }
    
    console.log('[PumpSwapRoutes] Calling pumpSwapClient.buildSwapTx');
    const result = await pumpSwapClient.buildSwapTx(req.body);
    console.log('[PumpSwapRoutes] Successfully built swap transaction');
    
    // Don't log the full result as it may contain a large transaction
    console.log('[PumpSwapRoutes] Transaction built successfully:', { 
      success: result.success,
      txSize: result.data?.transaction ? 
        `${Buffer.from(result.data.transaction, 'base64').length} bytes` : 'N/A'
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('[PumpSwapRoutes] Error in POST /build-swap:', error);
    console.error('[PumpSwapRoutes] Error stack:', error.stack);
    
    // Try to extract the RPC error details 
    const errorMsg = error.message || '';
    if (errorMsg.includes('401 Unauthorized')) {
      console.error('[PumpSwapRoutes] RPC Authorization error detected - API key issue. Check your RPC endpoint configuration.');
      
      // Try to extract the specific RPC URL being used
      const urlMatch = errorMsg.match(/https:\/\/[^\s"')]+/);
      if (urlMatch) {
        console.error('[PumpSwapRoutes] RPC URL with auth error:', urlMatch[0]);
      }
    }
    
    if (errorMsg.includes('jsonrpc')) {
      try {
        // Try to extract and parse the JSON-RPC error message
        const jsonRpcMatch = errorMsg.match(/{[\s\S]*"jsonrpc"[\s\S]*}/);
        if (jsonRpcMatch) {
          const jsonRpcError = JSON.parse(jsonRpcMatch[0]);
          console.error('[PumpSwapRoutes] JSON-RPC error details:', JSON.stringify(jsonRpcError, null, 2));
        }
      } catch (parseErr) {
        console.error('[PumpSwapRoutes] Could not parse JSON-RPC error');
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Error building swap transaction',
    });
  }
});

/**
 * Build an add liquidity transaction
 * @route POST /api/pump-swap/build-add-liquidity
 */
router.post('/build-add-liquidity', async (req: Request, res: Response) => {
  console.log('[PumpSwapRoutes] Received request to /build-add-liquidity');
  console.log('[PumpSwapRoutes] Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    console.log('[PumpSwapRoutes] Calling pumpSwapClient.buildAddLiquidityTx');
    const result = await pumpSwapClient.buildAddLiquidityTx(req.body);
    console.log('[PumpSwapRoutes] Add liquidity transaction built successfully');
    res.json(result);
  } catch (error: any) {
    console.error('[PumpSwapRoutes] Error in POST /build-add-liquidity:', error);
    console.error('[PumpSwapRoutes] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Error building add liquidity transaction',
    });
  }
});

/**
 * Build a remove liquidity transaction
 * @route POST /api/pump-swap/build-remove-liquidity
 */
router.post('/build-remove-liquidity', async (req: Request, res: Response) => {
  console.log('[PumpSwapRoutes] Received request to /build-remove-liquidity');
  
  try {
    console.log('[PumpSwapRoutes] Calling pumpSwapClient.buildRemoveLiquidityTx');
    const result = await pumpSwapClient.buildRemoveLiquidityTx(req.body);
    console.log('[PumpSwapRoutes] Remove liquidity transaction built successfully');
    res.json(result);
  } catch (error: any) {
    console.error('[PumpSwapRoutes] Error in POST /build-remove-liquidity:', error);
    console.error('[PumpSwapRoutes] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Error building remove liquidity transaction',
    });
  }
});

/**
 * Build a create pool transaction
 * @route POST /api/pump-swap/build-create-pool
 */
router.post('/build-create-pool', async (req: Request, res: Response) => {
  console.log('[PumpSwapRoutes] Received request to /build-create-pool');
  console.log('[PumpSwapRoutes] Pool creation request:', {
    baseMint: req.body.baseMint,
    quoteMint: req.body.quoteMint,
    baseAmount: req.body.baseAmount,
    quoteAmount: req.body.quoteAmount,
    index: req.body.index
  });
  
  try {
    // Validate the base and quote mints are different
    if (req.body.baseMint === req.body.quoteMint) {
      console.error('[PumpSwapRoutes] Validation error: Base and quote tokens are the same');
      return res.status(400).json({
        success: false,
        error: 'Base and quote tokens cannot be the same',
      });
    }
    
    // Validate amounts
    if (req.body.baseAmount <= 0 || req.body.quoteAmount <= 0) {
      console.error('[PumpSwapRoutes] Validation error: Token amounts must be positive');
      return res.status(400).json({
        success: false,
        error: 'Token amounts must be greater than zero',
      });
    }
    
    // Validate input addresses
    try {
      console.log('[PumpSwapRoutes] Validating public keys');
      // Public key constructor will throw if invalid
      new PublicKey(req.body.baseMint);
      new PublicKey(req.body.quoteMint);
      new PublicKey(req.body.userPublicKey);
    } catch (err) {
      console.error('[PumpSwapRoutes] Invalid public key format:', err);
      return res.status(400).json({
        success: false,
        error: 'Invalid public key format',
      });
    }
    
    console.log('[PumpSwapRoutes] Calling pumpSwapClient.buildCreatePoolTx');
    const result = await pumpSwapClient.buildCreatePoolTx(req.body);
    console.log('[PumpSwapRoutes] Create pool transaction built successfully');
    res.json(result);
  } catch (error: any) {
    console.error('[PumpSwapRoutes] Error in POST /build-create-pool:', error);
    console.error('[PumpSwapRoutes] Error stack:', error.stack);
    const errorMessage = error.message || 'Error building create pool transaction';
    
    // Send a more descriptive error to client
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        name: error.name
      } : undefined
    });
  }
});

/**
 * Simulate a swap
 * @route POST /api/pump-swap/simulate-swap
 */
router.post('/simulate-swap', async (req: Request, res: Response) => {
  console.log('[PumpSwapRoutes] Received request to /simulate-swap');
  
  try {
    console.log('[PumpSwapRoutes] Calling pumpSwapClient.simulateSwap');
    const result = await pumpSwapClient.simulateSwap(req.body);
    console.log('[PumpSwapRoutes] Swap simulation completed successfully');
    res.json(result);
  } catch (error: any) {
    console.error('[PumpSwapRoutes] Error in POST /simulate-swap:', error);
    console.error('[PumpSwapRoutes] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Error simulating swap',
    });
  }
});

export const pumpSwapRouter = router; 