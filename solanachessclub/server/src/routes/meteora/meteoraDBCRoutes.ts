import express, { Request, Response } from 'express';
import { Connection } from '@solana/web3.js';
import { MeteoraDBCService } from '../../service/MeteoraDBC/meteoraDBCService';
import * as types from '../../service/MeteoraDBC/types';
import { getConnection } from '../../utils/connection';
import dotenv from 'dotenv';
import multer from 'multer';
import { uploadToPinata } from '../../utils/ipfs';

// Load environment variables
dotenv.config();

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Upload token metadata and image to IPFS
 * @route POST /api/meteora/uploadMetadata
 */
router.post('/uploadMetadata', upload.single('image'), async (req: any, res: any) => {
  try {
    console.log('[MeteoraDBC] Received metadata upload request');
    
    const {tokenName, tokenSymbol, description, twitter, telegram, website, imageUrl} = req.body;
    
    console.log('[MeteoraDBC] Processing token metadata:', {
      name: tokenName,
      symbol: tokenSymbol,
      hasDescription: !!description,
      hasTwitter: !!twitter,
      hasTelegram: !!telegram,
      hasWebsite: !!website,
      hasImageUrl: !!imageUrl,
      hasFile: !!req.file
    });
    
    if (!tokenName || !tokenSymbol || !description) {
      console.error('[MeteoraDBC] Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields (tokenName, tokenSymbol, description)',
      });
    }
    
    // Image can be either a file upload or a URL
    let imageBuffer;
    let imageSource;
    
    if (req.file) {
      // Process uploaded file
      console.log('[MeteoraDBC] Using uploaded image file:', req.file.originalname || 'unnamed');
      imageBuffer = req.file.buffer;
      imageSource = 'uploaded file';
    } else if (imageUrl) {
      // Use provided URL directly
      console.log('[MeteoraDBC] Using image URL:', imageUrl);
      imageSource = 'url';
    } else {
      console.error('[MeteoraDBC] No image provided');
      return res.status(400).json({
        success: false,
        error: 'Image file or URL is required',
      });
    }

    // Create metadata object
    const metadataObj : any = {
      name: tokenName,
      symbol: tokenSymbol,
      description,
      showName: true,
      twitter: twitter || '',
      telegram: telegram || '',
      website: website || '',
      createdOn: 'https://meteora.ag/',
    };
    
    console.log('[MeteoraDBC] Preparing to upload to IPFS/Pinata');
    
    // Upload to IPFS if we have an image buffer, otherwise use the URL directly
    let metadataUri;
    try {
      if (imageBuffer) {
        console.log('[MeteoraDBC] Uploading image buffer to Pinata');
        metadataUri = await uploadToPinata(imageBuffer, metadataObj);
      } else if (imageUrl) {
        // When using an existing URL, we still create a JSON metadata file but reference the URL
        console.log('[MeteoraDBC] Using existing URL in metadata:', imageUrl);
        metadataObj.image = imageUrl;
        // Create a dummy buffer since uploadToPinata doesn't accept null
        const dummyBuffer = Buffer.from('');
        metadataUri = await uploadToPinata(dummyBuffer, metadataObj);
      }
      
      console.log('[MeteoraDBC] Successfully uploaded metadata, URI:', metadataUri);
    } catch (uploadError) {
      console.error('[MeteoraDBC] IPFS upload error:', uploadError);
      return res.status(500).json({
        success: false,
        error: uploadError instanceof Error ? uploadError.message : 'Error uploading to IPFS',
      });
    }

    return res.json({
      success: true,
      metadataUri,
      imageSource
    });
  } catch (err) {
    console.error('[MeteoraDBC] Upload Metadata Error:', err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error uploading metadata',
    });
  }
});

// Get connection with confirmed commitment level
const connection = getConnection('confirmed');
const meteoraDBCService = new MeteoraDBCService(connection);

/**
 * Create a new config
 * @route POST /api/meteora/config
 */
router.post('/config', async (req: Request<{}, {}, types.CreateConfigParam>, res: Response) => {
  try {
    const result = await meteoraDBCService.createConfig(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in createConfig route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Build curve and create config
 * @route POST /api/meteora/build-curve
 */
router.post('/build-curve', async (req: Request<{}, {}, types.BuildCurveAndCreateConfigParam>, res: Response) => {
  try {
    const result = await meteoraDBCService.buildCurveAndCreateConfig(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in buildCurveAndCreateConfig route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Build curve by market cap and create config
 * @route POST /api/meteora/build-curve-by-market-cap
 */
router.post('/build-curve-by-market-cap', async (req: Request<{}, {}, types.BuildCurveAndCreateConfigByMarketCapParam>, res: Response) => {
  try {
    // We don't need the config parameter as we're generating it on the server
    // but keep all other parameters from the request
    const result = await meteoraDBCService.buildCurveAndCreateConfigByMarketCap(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in buildCurveAndCreateConfigByMarketCap route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Create partner metadata
 * @route POST /api/meteora/partner-metadata
 */
router.post('/partner-metadata', async (req: Request<{}, {}, types.CreatePartnerMetadataParam>, res: Response) => {
  try {
    const result = await meteoraDBCService.createPartnerMetadata(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in createPartnerMetadata route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Claim partner trading fee
 * @route POST /api/meteora/claim-partner-fee
 */
router.post('/claim-partner-fee', async (req: Request<{}, {}, types.ClaimTradingFeeParam>, res: Response) => {
  try {
    const result = await meteoraDBCService.claimPartnerTradingFee(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in claimPartnerTradingFee route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Partner withdraw surplus
 * @route POST /api/meteora/partner-withdraw-surplus
 */
router.post('/partner-withdraw-surplus', async (req: Request<{}, {}, types.WithdrawSurplusParam>, res: Response) => {
  try {
    const result = await meteoraDBCService.partnerWithdrawSurplus(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in partnerWithdrawSurplus route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Create pool
 * @route POST /api/meteora/pool
 */
router.post('/pool', async (req: Request<{}, {}, types.CreatePoolParam>, res: Response) => {
  try {
    const result = await meteoraDBCService.createPool(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in createPool route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Create pool and buy
 * @route POST /api/meteora/pool-and-buy
 */
router.post('/pool-and-buy', async (req: Request<{}, {}, types.CreatePoolAndBuyParam>, res: Response) => {
  try {
    const result = await meteoraDBCService.createPoolAndBuy(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in createPoolAndBuy route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get swap quote
 * @route GET /api/meteora/quote
 */
router.get('/quote', async (req: any, res: any) => {
  try {
    const { inputToken, outputToken, amount, slippage, poolAddress } = req.query;
    
    if (!inputToken || !outputToken || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: inputToken, outputToken, amount',
      });
    }
    
    // Check if this is a SOL-USDC pair (these are common)
    const isSOLUSDCPair = (
      (inputToken.toLowerCase() === 'so11111111111111111111111111111111111111112' && 
       outputToken.toLowerCase() === 'epjfwdd5aufqssqem2qn1xzybapC8G4wEGGkZwyTDt1v') ||
      (outputToken.toLowerCase() === 'so11111111111111111111111111111111111111112' && 
       inputToken.toLowerCase() === 'epjfwdd5aufqssqem2qn1xzybapC8G4wEGGkZwyTDt1v')
    );
    
    if (isSOLUSDCPair) {
      console.log("Attempting to find SOL-USDC pool - this should be available");
    }
    
    // If a specific pool address is provided, use it directly
    if (poolAddress) {
      console.log(`Using specific pool: ${poolAddress}`);
      try {
        // Get quote using the specified pool
        const quote = await meteoraDBCService.getSwapQuote({
          poolAddress: poolAddress as string,
          inputAmount: amount as string,
          slippageBps: slippage ? parseInt(slippage as string) * 100 : 50, // Convert percent to basis points (default 0.5%)
          swapBaseForQuote: true, // This will be determined by the pool structure
        });
        
        return res.json({
          success: true,
          poolAddress: poolAddress,
          estimatedOutput: quote.estimatedOutput,
          minimumAmountOut: quote.minimumAmountOut,
          price: quote.price,
          priceImpact: quote.priceImpact,
        });
      } catch (error) {
        console.error('Error getting quote for specified pool:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to get quote from specified pool',
        });
      }
    }
    
    // Otherwise, find a suitable pool for this token pair
    console.log(`Attempting to find pool for: ${inputToken} <-> ${outputToken}`);
    const pools = await meteoraDBCService.getPoolForTokenPair(
      inputToken as string, 
      outputToken as string
    );
    
    if (!pools || pools.length === 0) {
      console.log(`No pool found for ${inputToken} and ${outputToken}. Returning price-based estimate.`);
      
      // Instead of returning 404, return a special response indicating fallback to price-based estimate
      return res.json({
        success: false,
        error: 'No pool found for this token pair',
        shouldFallbackToPriceEstimate: true,
        inputToken,
        outputToken,
        amount,
        note: isSOLUSDCPair ? 
          "SOL-USDC pair was expected but not found in Meteora. Using price estimation instead." : 
          "No liquidity pool available for this pair. Using price estimation."
      });
    }
    
    console.log(`Found ${pools.length} pools for this pair. Using the first one.`);
    
    // Get the best pool (first one for now, but could implement price comparison)
    const pool = pools[0];
    
    // Get quote
    const quote = await meteoraDBCService.getSwapQuote({
      poolAddress: pool.address,
      inputAmount: amount as string,
      slippageBps: slippage ? parseInt(slippage as string) * 100 : 50, // Convert percent to basis points (default 0.5%)
      swapBaseForQuote: inputToken === pool.baseMint, // True if selling the base token
    });
    
    res.json({
      success: true,
      poolAddress: pool.address,
      baseMint: pool.baseMint,
      estimatedOutput: quote.estimatedOutput,
      minimumAmountOut: quote.minimumAmountOut,
      price: quote.price,
      priceImpact: quote.priceImpact,
    });
  } catch (error) {
    console.error('Error in quote route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Swap tokens
 * @route POST /api/meteora/swap
 */
router.post('/swap', async (req: Request<{}, {}, types.SwapParam>, res: Response) => {
  try {
    const result = await meteoraDBCService.swap(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in swap route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Create locker
 * @route POST /api/meteora/migration/locker
 */
router.post('/migration/locker', async (req: Request<{}, {}, types.CreateLockerParam>, res: Response) => {
  try {
    const result = await meteoraDBCService.createLocker(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in createLocker route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Withdraw leftover
 * @route POST /api/meteora/migration/withdraw-leftover
 */
router.post('/migration/withdraw-leftover', async (req: Request<{}, {}, types.WithdrawLeftoverParam>, res: Response) => {
  try {
    const result = await meteoraDBCService.withdrawLeftover(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in withdrawLeftover route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Create DAMM V1 migration metadata
 * @route POST /api/meteora/migration/damm-v1-metadata
 */
router.post('/migration/damm-v1-metadata', async (req: Request<{}, {}, types.CreateDammV1MigrationMetadataParam>, res: Response) => {
  try {
    const result = await meteoraDBCService.createDammV1MigrationMetadata(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in createDammV1MigrationMetadata route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Migrate to DAMM V1
 * @route POST /api/meteora/migration/damm-v1
 */
router.post('/migration/damm-v1', async (req: Request<{}, {}, types.MigrateToDammV1Param>, res: Response) => {
  try {
    const result = await meteoraDBCService.migrateToDammV1(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in migrateToDammV1 route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Lock DAMM V1 LP token
 * @route POST /api/meteora/migration/lock-damm-v1-lp
 */
router.post('/migration/lock-damm-v1-lp', async (req: Request<{}, {}, types.DammLpTokenParam>, res: Response) => {
  try {
    const result = await meteoraDBCService.lockDammV1LpToken(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in lockDammV1LpToken route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Claim DAMM V1 LP token
 * @route POST /api/meteora/migration/claim-damm-v1-lp
 */
router.post('/migration/claim-damm-v1-lp', async (req: Request<{}, {}, types.DammLpTokenParam>, res: Response) => {
  try {
    const result = await meteoraDBCService.claimDammV1LpToken(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in claimDammV1LpToken route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Create DAMM V2 migration metadata
 * @route POST /api/meteora/migration/damm-v2-metadata
 */
router.post('/migration/damm-v2-metadata', async (req: Request<{}, {}, types.CreateDammV2MigrationMetadataParam>, res: Response) => {
  try {
    const result = await meteoraDBCService.createDammV2MigrationMetadata(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in createDammV2MigrationMetadata route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Migrate to DAMM V2
 * @route POST /api/meteora/migration/damm-v2
 */
router.post('/migration/damm-v2', async (req: Request<{}, {}, types.MigrateToDammV2Param>, res: Response) => {
  try {
    const result = await meteoraDBCService.migrateToDammV2(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in migrateToDammV2 route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Create pool metadata
 * @route POST /api/meteora/pool-metadata
 */
router.post('/pool-metadata', async (req: Request<{}, {}, types.CreatePoolMetadataParam>, res: Response) => {
  try {
    const result = await meteoraDBCService.createPoolMetadata(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in createPoolMetadata route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Claim creator trading fee
 * @route POST /api/meteora/claim-creator-fee
 */
router.post('/claim-creator-fee', async (req: Request<{}, {}, types.ClaimCreatorTradingFeeParam>, res: Response) => {
  try {
    const result = await meteoraDBCService.claimCreatorTradingFee(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in claimCreatorTradingFee route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Creator withdraw surplus
 * @route POST /api/meteora/creator-withdraw-surplus
 */
router.post('/creator-withdraw-surplus', async (req: Request<{}, {}, types.CreatorWithdrawSurplusParam>, res: Response) => {
  try {
    const result = await meteoraDBCService.creatorWithdrawSurplus(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error in creatorWithdrawSurplus route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get pool state
 * @route GET /api/meteora/pool/:poolAddress
 */
router.get('/pool/:poolAddress', async (req: Request, res: Response) => {
  try {
    const { poolAddress } = req.params;
    const result = await meteoraDBCService.getPoolState(poolAddress);
    res.json(result);
  } catch (error) {
    console.error('Error in getPoolState route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get pool config state
 * @route GET /api/meteora/config/:configAddress
 */
router.get('/config/:configAddress', async (req: Request, res: Response) => {
  try {
    const { configAddress } = req.params;
    const result = await meteoraDBCService.getPoolConfigState(configAddress);
    res.json(result);
  } catch (error) {
    console.error('Error in getPoolConfigState route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get pool curve progress
 * @route GET /api/meteora/pool/:poolAddress/progress
 */
router.get('/pool/:poolAddress/progress', async (req: Request, res: Response) => {
  try {
    const { poolAddress } = req.params;
    const result = await meteoraDBCService.getPoolCurveProgress(poolAddress);
    res.json(result);
  } catch (error) {
    console.error('Error in getPoolCurveProgress route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get pool fee metrics
 * @route GET /api/meteora/pool/:poolAddress/fees
 */
router.get('/pool/:poolAddress/fees', async (req: Request, res: Response) => {
  try {
    const { poolAddress } = req.params;
    const result = await meteoraDBCService.getPoolFeeMetrics(poolAddress);
    res.json(result);
  } catch (error) {
    console.error('Error in getPoolFeeMetrics route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get all available pools for a specific token
 * @route GET /api/meteora/available-pools
 */
router.get('/available-pools', async (req: any, res: any) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: token',
      });
    }
    
    console.log(`Fetching all available pools for token: ${token}`);
    
    // Get all pools from Meteora
    const allPools = await meteoraDBCService.getAllPoolsForToken(token as string);
    
    return res.json({
      success: true,
      pools: allPools
    });
  } catch (error) {
    console.error('Error in available-pools route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router; 