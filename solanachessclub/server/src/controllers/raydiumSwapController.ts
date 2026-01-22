import { Request, Response, NextFunction } from 'express';
import { RaydiumService } from '../service/raydium/raydiumService';

/**
 * Single unified endpoint for Raydium swaps
 * This handles the complete swap process:
 * 1. Getting quotes
 * 2. Building transactions
 * 3. Everything needed to prepare a transaction for signing
 */
export async function raydiumSwapHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const {
      inputMint,
      outputMint,
      amount,
      slippageBps,
      userPublicKey,
      inputTokenAccount,
      outputTokenAccount
    } = req.body;

    // Validate required fields
    if (!inputMint || !outputMint || !amount || !userPublicKey) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters: inputMint, outputMint, amount, userPublicKey'
      });
      return;
    }

    // Process the swap through the service
    const swapResult = await RaydiumService.handleSwap({
      inputMint,
      outputMint,
      amount: Number(amount),
      slippageBps: slippageBps ? Number(slippageBps) : 100,
      userPublicKey,
      inputTokenAccount,
      outputTokenAccount
    });

    // Return the result
    res.json(swapResult);
  } catch (err: any) {
    console.error('[raydiumSwapHandler] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'An error occurred processing your swap request'
    });
  }
} 