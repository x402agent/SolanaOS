import { Request, Response, NextFunction } from 'express';
import { PublicKey } from '@solana/web3.js';

// Environment variables for Jupiter Ultra API - using lite API endpoints
const JUPITER_API_URL_GET_ORDER = process.env.JUPITER_API_URL_GET_ORDER || "https://lite-api.jup.ag/ultra/v1/order";
const JUPITER_API_URL_EXECUTE_ORDER = process.env.JUPITER_API_URL_EXECUTE_ORDER || "https://lite-api.jup.ag/ultra/v1/execute";
const JUPITER_ULTRA_API_BASE_URL = process.env.JUPITER_ULTRA_API_BASE_URL || 'https://lite-api.jup.ag/ultra/v1';

/**
 * Jupiter Ultra API Controller
 * Provides methods for interacting with Jupiter Ultra API for swap orders
 */
export class JupiterUltraController {
  /**
   * Get a swap order from Jupiter Ultra API
   */
  static async getSwapOrder(
    inputMint: string,
    outputMint: string,
    amount: string | number,
    taker?: string
  ) {
    try {
      // Validate input parameters
      if (!inputMint || !outputMint || amount === undefined) {
        throw new Error('inputMint, outputMint, and amount are required');
      }

      // Ensure amount is a valid number and convert to string
      const amountStr = amount.toString();
      if (isNaN(Number(amountStr)) || Number(amountStr) <= 0) {
        throw new Error('amount must be a positive number');
      }

      // Validate mint addresses format
      try {
        new PublicKey(inputMint);
        new PublicKey(outputMint);
      } catch (e) {
        throw new Error('Invalid mint address format');
      }

      // Validate taker address if provided
      if (taker) {
        try {
          new PublicKey(taker);
        } catch (e) {
          throw new Error('Invalid taker address format');
        }
      }

      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amountStr,
        ...(taker && { taker })
      });

      console.log('Requesting swap order with params:', {
        inputMint,
        outputMint,
        amount: amountStr,
        taker
      });

      const response = await fetch(
        `${JUPITER_API_URL_GET_ORDER}?${params.toString()}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Jupiter Ultra API error response:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(
          `Failed to get swap order: ${response.statusText}${
            errorData ? ` - ${JSON.stringify(errorData)}` : ''
          }`
        );
      }

      const data = await response.json();
      
      if (!data || !data.requestId) {
        console.error('Invalid Jupiter Ultra API response:', data);
        throw new Error('Invalid response from Jupiter Ultra API');
      }

      return data;
    } catch (error) {
      console.error('Jupiter Ultra swap order error:', error);
      throw new Error(`Failed to get swap order: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute a swap order via Jupiter Ultra API
   */
  static async executeSwapOrder(
    signedTransaction: string,
    requestId: string
  ) {
    try {
      if (!signedTransaction || !requestId) {
        throw new Error('signedTransaction and requestId are required');
      }

      console.log('Executing swap order with requestId:', requestId);

      const response = await fetch(JUPITER_API_URL_EXECUTE_ORDER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signedTransaction,
          requestId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Jupiter Ultra execute error response:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(
          `Failed to execute swap: ${response.statusText}${
            errorData ? ` - ${JSON.stringify(errorData)}` : ''
          }`
        );
      }

      const data = await response.json();
      console.log('Jupiter Ultra execute response:', data);
      
      return data;
    } catch (error) {
      console.error('Jupiter Ultra execute error:', error);
      throw new Error(`Failed to execute swap: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Express handler for getting a Jupiter Ultra swap order
 */
export async function getUltraSwapOrderHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { inputMint, outputMint, amount, taker } = req.body;

    if (!inputMint || !outputMint || amount === undefined) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters: inputMint, outputMint, and amount are required.',
      });
      return;
    }

    const orderData = await JupiterUltraController.getSwapOrder(
      inputMint,
      outputMint,
      amount,
      taker
    );

    res.json({
      success: true,
      data: orderData
    });
  } catch (err: any) {
    console.error('[getUltraSwapOrderHandler] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to get swap order'
    });
  }
}

/**
 * Express handler for executing a Jupiter Ultra swap order
 */
export async function executeUltraSwapOrderHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { signedTransaction, requestId } = req.body;

    if (!signedTransaction || !requestId) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters: signedTransaction and requestId are required.',
      });
      return;
    }

    const executeData = await JupiterUltraController.executeSwapOrder(
      signedTransaction,
      requestId
    );

    res.json({
      success: true,
      data: executeData
    });
  } catch (err: any) {
    console.error('[executeUltraSwapOrderHandler] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to execute swap order'
    });
  }
}

/**
 * Express handler for getting token balances via Jupiter Ultra API
 */
export async function getUltraBalancesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { wallet } = req.query;

    if (!wallet || typeof wallet !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Missing required parameter: wallet address is required.',
      });
      return;
    }

    // Validate wallet address format
    try {
      new PublicKey(wallet);
    } catch (e) {
      res.status(400).json({
        success: false,
        error: 'Invalid wallet address format.',
      });
      return;
    }

    const balancesUrl = `${JUPITER_ULTRA_API_BASE_URL}/balances?wallet=${wallet}`;
    
    const response = await fetch(balancesUrl);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('Jupiter Ultra balances error response:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      res.status(response.status).json({
        success: false,
        error: `Failed to get balances: ${response.statusText}${
          errorData ? ` - ${JSON.stringify(errorData)}` : ''
        }`
      });
      return;
    }

    const data = await response.json();

    res.json({
      success: true,
      data
    });
  } catch (err: any) {
    console.error('[getUltraBalancesHandler] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to get balances'
    });
  }
} 