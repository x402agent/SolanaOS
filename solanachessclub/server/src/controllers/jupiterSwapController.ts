import {Request, Response, NextFunction} from 'express';
// import fetch from 'node-fetch';

/**
 * jupiterSwapHandler
 * A controller to call Jupiter's Swap API.
 *
 * Expects request body to have:
 * {
 *   quoteResponse: any;        // The entire quote response object from Jupiter's /quote
 *   userPublicKey: string;     // e.g. from the connected wallet
 *   feeAccount?: string;       // optional
 *   destinationTokenAccount?: string; // optional
 * }
 */
export async function jupiterSwapHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Extract parameters from the body
    const { default: fetch } = await import('node-fetch');
    const {quoteResponse, userPublicKey, feeAccount, destinationTokenAccount} =
      req.body;

    if (!quoteResponse || !userPublicKey) {
      res.status(400).json({
        success: false,
        error: 'Missing quoteResponse or userPublicKey in request body.',
      });
      return;
    }

    // Call Jupiter Swap API:
    const jupiterUrl = 'https://api.jup.ag/swap/v1/swap';

    const jupiterReqBody = {
      quoteResponse,
      userPublicKey,
      feeAccount,
      destinationTokenAccount,
    };

    const response = await fetch(jupiterUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // If using an API key, include it here:
        // 'x-api-key': process.env.JUPITER_API_KEY || '',
      },
      body: JSON.stringify(jupiterReqBody),
    });

    const data = await response.json() as { error?: string };

    if (!response.ok) {
      res.status(response.status).json({
        success: false,
        error: data.error || 'Jupiter swap failed.',
      });
      return;
    }

    // Send the response directly from Jupiter
    res.json(data);
  } catch (err: any) {
    console.error('[jupiterSwapHandler] Error:', err);
    next(err);
  }
}
