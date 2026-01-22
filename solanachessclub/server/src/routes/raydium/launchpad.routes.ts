import express, { Request, Response } from 'express';
import {RaydiumLaunchpadService} from '../../service/raydium/launchpadService';
import multer from 'multer';
import {uploadToIpfs, uploadToPinata} from '../../utils/ipfs';

const router = express.Router();
// Use memory storage for uploaded files
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @route   POST /api/raydium/launchpad/uploadMetadata
 * @desc    Upload token metadata and image to IPFS (supports both Pump.fun and Pinata)
 * @access  Public
 */
router.post('/uploadMetadata', upload.single('image'), async (req: any, res: any) => {
  try {
    const {tokenName, tokenSymbol, description, twitter, telegram, website} = req.body;
    
    if (!tokenName || !tokenSymbol || !description) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields (tokenName, tokenSymbol, description)',
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Image file is required. (Form field name: "image")',
      });
    }

    // Upload image and metadata to IPFS via selected provider (defaults to Pump.fun)
    const imageBuffer = req.file.buffer;
    if (!imageBuffer) {
      return res.status(400).json({
        success: false,
        error: 'Image buffer is missing from the uploaded file',
      });
    }

    const metadataObj = {
      name: tokenName,
      symbol: tokenSymbol,
      description,
      showName: true,
      twitter: twitter || '',
      telegram: telegram || '',
      website: website || '',
      createdOn: 'https://raydium.io/',
    };
    
    const metadataUri = await uploadToPinata(imageBuffer, metadataObj);

    return res.json({
      success: true,
      metadataUri,
      provider: 'pinata',
    });
  } catch (err: any) {
    console.error('[RaydiumLaunchpad] Upload Metadata Error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Unknown error uploading metadata.',
    });
  }
});

/**
 * @route   POST /api/raydium/launchpad/uploadMetadataPinata
 * @desc    Upload token metadata and image to IPFS via Pinata
 * @access  Public
 */
router.post('/uploadMetadataPinata', upload.single('image'), async (req: any, res: any) => {
  try {
    const {tokenName, tokenSymbol, description, twitter, telegram, website} = req.body;
    
    if (!tokenName || !tokenSymbol || !description) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields (tokenName, tokenSymbol, description)',
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Image file is required. (Form field name: "image")',
      });
    }

    // Upload image and metadata to IPFS via Pinata
    const imageBuffer = req.file.buffer;
    if (!imageBuffer) {
      return res.status(400).json({
        success: false,
        error: 'Image buffer is missing from the uploaded file',
      });
    }

    const metadataObj = {
      name: tokenName,
      symbol: tokenSymbol,
      description,
      showName: true,
      twitter: twitter || '',
      telegram: telegram || '',
      website: website || '',
      createdOn: 'https://raydium.io/',
    };
    
    const metadataUri = await uploadToPinata(imageBuffer, metadataObj);

    return res.json({
      success: true,
      metadataUri,
      provider: 'pinata'
    });
  } catch (err: any) {
    console.error('[RaydiumLaunchpad] Upload Metadata Error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Unknown error uploading metadata.',
    });
  }
});

/**
 * @route   POST /api/raydium/launchpad/create
 * @desc    Create and launch a token on Raydium
 * @access  Public
 */
router.post('/create', async (req: any, res: any) => {
  try {
    const {
      tokenName,
      tokenSymbol,
      decimals, // We'll override this with 9
      description,
      uri, // This can now come from the uploadMetadata endpoint
      twitter,
      telegram,
      website,
      imageData,
      quoteTokenMint,
      tokenSupply,
      solRaised,
      bondingCurvePercentage,
      poolMigration,
      vestingPercentage,
      vestingDuration,
      vestingCliff,
      vestingTimeUnit,
      enableFeeSharingPost,
      userPublicKey,
      mode, // Extract the mode parameter
      createOnly, // Extract createOnly parameter (boolean)
      initialBuyAmount, // Extract initialBuyAmount parameter
      migrateType, // Add migrateType parameter ('amm' or 'cpmm')
      shareFeeReceiver, // Address receiving share fees
      shareFeeRate, // Rate for fee sharing
      platformFeeRate, // Platform fee rate
      slippageBps, // Slippage tolerance in basis points
      computeBudgetConfig, // Compute budget settings
    } = req.body;

    // Validate required fields
    if (!tokenName || !tokenSymbol || !userPublicKey || !uri) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters (tokenName, tokenSymbol, userPublicKey)',
      });
    }

    console.log('[RaydiumLaunchpad] Creating token with metadataUri:', uri);

    // Generate and return the transaction
    const result = await RaydiumLaunchpadService.createLaunchpadToken({
      tokenName,
      tokenSymbol,
      decimals: 9, // Always use 9 decimals for Solana tokens regardless of input
      metadataUri: uri,
      quoteTokenMint,
      tokenSupply: tokenSupply?.toString() || '1000000000',
      solRaised: solRaised?.toString() || '85',
      bondingCurvePercentage: bondingCurvePercentage?.toString() || '50',
      poolMigration: poolMigration?.toString() || '30',
      vestingPercentage: vestingPercentage?.toString() || '0',
      vestingDuration: vestingDuration?.toString(),
      vestingCliff: vestingCliff?.toString(),
      vestingTimeUnit,
      enableFeeSharingPost: enableFeeSharingPost === true,
      userPublicKey,
      mode: mode || 'justSendIt', // Default to justSendIt if not specified
      createOnly: createOnly === true, // Pass createOnly parameter explicitly as boolean
      initialBuyAmount: initialBuyAmount?.toString(), // Pass initialBuyAmount parameter
      migrateType: migrateType || 'amm', // Default to 'amm' if not specified
      shareFeeReceiver: shareFeeReceiver || userPublicKey, // Default to user's address if not specified
      shareFeeRate: shareFeeRate || 10000, // Default to 10000 (as per Raydium docs)
      platformFeeRate: platformFeeRate || 0, // Default to 0
      slippageBps: slippageBps || 100, // Default to 1% slippage
      computeBudgetConfig, // Pass compute budget settings
    });

    // Return the result to the client
    return res.json({
      success: true,
      transaction: result.transaction,
      mintAddress: result.mintAddress,
      poolId: result.poolId,
    });
  } catch (error: any) {
    console.error('[RaydiumLaunchpad] Create Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while creating the token',
    });
  }
});

export default router;
