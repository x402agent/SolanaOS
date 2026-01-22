import express, { Request, Response } from 'express';
import { TokenMillClient } from '../../service/TokenMill/tokenMill';
import {
  MarketParams,
  StakingParams,
  SwapParams,
  TokenParams,
  VestingParams,
  FreeMarketParams,
} from '../../types/interfaces';
import { PublicKey } from '@solana/web3.js';

const router = express.Router();
const tokenMill = new TokenMillClient();

/**
 * Create a new TokenMill configuration
 * @route POST /config
 */
router.post('/config', async (req: Request, res: Response) => {
  try {
    const {
      authority,
      protocolFeeRecipient,
      protocolFeeShare,
      referralFeeShare,
    } = req.body;
    const result = await tokenMill.createConfig(
      new PublicKey(authority),
      new PublicKey(protocolFeeRecipient),
      protocolFeeShare,
      referralFeeShare,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get token badge quote
 * @route POST /quote-token-badge
 */
router.post('/quote-token-badge', async (req: Request, res: Response) => {
  try {
    const result = await tokenMill.getTokenBadge(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Create a new market
 * @route POST /markets
 */
router.post(
  '/markets',
  async (req: Request<{}, {}, MarketParams>, res: Response) => {
    try {
      const result = await tokenMill.buildCreateMarketTx(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

/**
 * Free a market
 * @route POST /free-market
 */
router.post(
  '/free-market',
  async (req: express.Request, res: express.Response): Promise<any> => {
    try {
      const { market } = req.body as FreeMarketParams;
      if (!market) {
        return res.status(400).json({
          success: false,
          message: 'Market address is required',
        });
      }
      const tokenMillClient = new TokenMillClient();
      const result = await tokenMillClient.freeMarket(market);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error('Free market error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to free market',
        error: error.message,
      });
    }
  },
);

/**
 * Create a new token
 * @route POST /tokens
 */
router.post(
  '/tokens',
  async (req: Request<{}, {}, TokenParams>, res: Response) => {
    try {
      const result = await tokenMill.createToken();
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

/**
 * Swap tokens
 * @route POST /swap
 */
router.post('/swap', async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      market,
      quoteTokenMint,
      action,
      tradeType,
      amount,
      otherAmountThreshold,
      userPublicKey,
    } = req.body;
    const result = await tokenMill.buildSwapTx({
      market,
      quoteTokenMint,
      action,
      tradeType,
      amount,
      otherAmountThreshold,
      userPublicKey,
    });
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Swap failed',
      });
    }
    return res.status(200).json({
      success: true,
      transaction: result.data?.transaction,
    });
  } catch (error: any) {
    console.error('[POST /swap] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
});

/**
 * Create a new staking position
 * @route POST /stake
 */
router.post(
  '/stake',
  async (
    req: Request<{}, {}, StakingParams & { userPublicKey: string }>,
    res: Response,
  ) => {
    try {
      const result = await tokenMill.buildStakeTx(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

/**
 * Create a new vesting schedule
 * @route POST /vesting
 */
router.post(
  '/vesting',
  async (req: Request<{}, {}, VestingParams>, res: Response) => {
    try {
      const result = await tokenMill.buildCreateVestingTxWithAutoPositionAndATA(
        req.body,
      );
      res.json(result);
    } catch (error: any) {
      console.error('[POST /vesting] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Unknown error',
      });
    }
  },
);

/**
 * Claim vested tokens for a specific market
 * @route POST /vesting/release
 */
router.post('/vesting/release', async (req: any, res: any) => {
  try {
    const {
      marketAddress,
      vestingPlanAddress,
      baseTokenMint,
      userPublicKey,
    } = req.body;
    const result = await tokenMill.buildReleaseVestingTx({
      marketAddress,
      vestingPlanAddress,
      baseTokenMint,
      userPublicKey,
    });
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('[POST /vesting/release] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
});

/**
 * Set market curve parameters
 * @route POST /set-curve
 */
router.post('/set-curve', async (req: Request, res: Response): Promise<any> => {
  try {
    const { market, userPublicKey, askPrices, bidPrices } = req.body;
    if (!market || !userPublicKey || !askPrices || !bidPrices) {
      return res.status(400).json({
        success: false,
        error:
          'Missing required fields: market, userPublicKey, askPrices, bidPrices',
      });
    }
    const result = await tokenMill.buildSetCurveTx({
      market,
      userPublicKey,
      askPrices,
      bidPrices,
    });
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    return res.status(200).json({
      success: true,
      transaction: result.data?.transaction,
    });
  } catch (error: any) {
    console.error('[POST /set-curve] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error in set-curve',
    });
  }
});

/**
 * Get quote for a swap
 * @route POST /quote-swap
 */
router.post(
  '/quote-swap',
  async (req: Request, res: Response): Promise<any> => {
    try {
      const result = await tokenMill.quoteSwap(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

/**
 * Get asset metadata
 * @route POST /get-asset
 */
router.post(
  '/get-asset',
  async (req: Request, res: Response): Promise<any> => {
    const { assetId } = req.body;
    if (!assetId) {
      return res.status(400).json({ error: 'Asset ID is required' });
    }
    try {
      const metadata = await tokenMill.getAssetMetadata(assetId);
      res.json(metadata);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
);

/**
 * Get graduation information for a market
 * @route GET /graduation
 */
router.get(
  '/graduation',
  async (req: Request, res: Response): Promise<any> => {
    try {
      const result = await tokenMill.getGraduation(req.body.market);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

export default router; 