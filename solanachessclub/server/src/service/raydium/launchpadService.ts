import {
  TxVersion,
  LAUNCHPAD_PROGRAM,
  DEV_LAUNCHPAD_PROGRAM,
  getPdaLaunchpadConfigId,
  LaunchpadConfig,
  Raydium,
  getPdaLaunchpadPoolId,
  PlatformConfig
} from '@raydium-io/raydium-sdk-v2';
import { Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { NATIVE_MINT } from '@solana/spl-token';
import BN from 'bn.js';
import axios from 'axios';
import base58 from 'bs58';
import { initSdk } from './config';
import { uploadToIpfs } from '../../utils/ipfs';
import FormData from 'form-data';

// Environment configurations
const CLUSTER = process.env.SOLANA_CLUSTER || 'mainnet-beta';
const IS_DEVNET = CLUSTER === 'devnet';
const PROGRAM_ID = IS_DEVNET ? DEV_LAUNCHPAD_PROGRAM : LAUNCHPAD_PROGRAM;

// Types for metadata
interface TokenMetadata {
  name: string;
  symbol: string;
  description?: string;
  image?: string;
  external_url?: string;
  twitter?: string;
  telegram?: string;
  createdOn?: string;
  website?: string;
}

// Token creation parameters
interface CreateLaunchpadTokenParams {
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
  metadataUri: string;
  quoteTokenMint: string;
  tokenSupply: string;
  solRaised: string;
  bondingCurvePercentage: string;
  poolMigration: string;
  vestingPercentage: string;
  vestingDuration?: string;  // In months
  vestingCliff?: string;     // In months
  vestingTimeUnit?: string;  // 'day', 'week', 'month', or 'year'
  enableFeeSharingPost?: boolean;
  userPublicKey: string;
  mode: 'justSendIt' | 'launchLab'; // Mode to identify which creation path to use
  createOnly?: boolean; // Option to only create token without buying
  initialBuyAmount?: string; // Amount of SOL for initial buy (if createOnly is false)
  migrateType?: 'amm' | 'cpmm'; // AMM for standard pool, CPMM for fee sharing
  shareFeeReceiver?: string; // Address receiving share fees
  shareFeeRate?: number; // Rate for fee sharing
  platformFeeRate?: number; // Platform fee rate
  slippageBps?: number; // Slippage tolerance in basis points
  computeBudgetConfig?: {
    units?: number;
    microLamports?: number;
  };
}

export class RaydiumLaunchpadService {
  /**
   * Create a new token and launchpad pool
   */
  static async createLaunchpadToken(params: CreateLaunchpadTokenParams): Promise<{
    transaction: string;
    mintAddress: string;
    poolId: string;
  }> {
    try {
      console.log('[RaydiumLaunchpadService] Starting token creation');
      console.log('[RaydiumLaunchpadService] User public key:', params.userPublicKey);
      
      const raydium = await initSdk(params.userPublicKey);
      
      // Get program ID based on environment
      const programId = PROGRAM_ID;
      
      // Generate a keypair for the token mint
      const pair = Keypair.generate();
      const mintA = pair.publicKey;
      
      // Define the quote token (SOL by default)
      const mintB = new PublicKey(params.quoteTokenMint || NATIVE_MINT.toString());
      
      // Parse the user's public key
      const userPublicKey = new PublicKey(params.userPublicKey);
      
      // Get configId for the default (SOL) pair
      const configId = getPdaLaunchpadConfigId(programId, mintB, 0, 0).publicKey;
      
      console.log(`Using config ID: ${configId.toString()}`);
      
      // Get config info from chain
      const configData = await raydium.connection.getAccountInfo(configId);
      if (!configData) throw new Error('Launchpad config not found');
      
      const configInfo = LaunchpadConfig.decode(configData.data);
      const mintBInfo = await raydium.token.getTokenInfo(configInfo.mintB);
      
      // Apply different settings based on the mode
      let bondingCurvePercent: number;
      let solRaisedFloat: number;
      
      if (params.mode === 'justSendIt') {
        // JustSendIt mode - use standard settings according to Raydium docs
        console.log('[RaydiumLaunchpadService] Using JustSendIt mode with standard settings');
        // Standard is 85 SOL threshold and 50% on bonding curve
        bondingCurvePercent = 50;
        solRaisedFloat = 85;
      } else {
        // LaunchLab mode - use custom settings
        console.log('[RaydiumLaunchpadService] Using LaunchLab mode with custom settings');
        
        // Parse bonding curve percentage
        bondingCurvePercent = parseInt(params.bondingCurvePercentage);
        
        // Validate bonding curve percentage (20-80%)
        if (bondingCurvePercent < 20 || bondingCurvePercent > 80) {
          throw new Error('Bonding curve percentage must be between 20% and 80%');
        }
        
        // Convert SOL raised to lamports
        solRaisedFloat = parseFloat(params.solRaised);
        
        // Validate minimum SOL raised (30 SOL)
        if (solRaisedFloat < 30) {
          throw new Error('Minimum SOL raised must be at least 30 SOL');
        }
      }
      
      // Create a BN for buyAmount (in lamports)
      let buyAmount=new BN(0);

      if (params.createOnly) {
        // Use a minimal value for buyAmount when createOnly is true
        console.log(`Using minimal buyAmount for createOnly mode`);
        buyAmount = new BN(1); // Minimal value
      } else if (params.initialBuyAmount) {
        // Use the specified initialBuyAmount if provided (in SOL)
        const initialBuyFloat = parseFloat(params.initialBuyAmount);
        console.log(`Using specified initialBuyAmount: ${initialBuyFloat} SOL`);
        buyAmount = new BN(initialBuyFloat * 1e9);
      }
      
      console.log(`Token name: ${params.tokenName}`);
      console.log(`Token symbol: ${params.tokenSymbol}`);
      console.log(`Token decimals: 6`); // Using 6 decimals as in the example
      console.log(`Buy amount in SOL: ${solRaisedFloat}`);
      console.log(`Bonding curve percentage: ${bondingCurvePercent}%`);
      console.log(`Fee payer: ${userPublicKey.toString()}`);
      
      // Get the most recent blockhash for the transaction
      const { blockhash } = await raydium.connection.getLatestBlockhash();

      // Convert fee rates to BN if needed
      const shareFeeRateBN = params.shareFeeRate ? new BN(params.shareFeeRate) : new BN(10000);
      const platformFeeRateBN = params.platformFeeRate ? new BN(params.platformFeeRate) : undefined;
      
      // Prepare create launchpad call
      const { transactions, execute, extInfo } = await raydium.launchpad.createLaunchpad({
        programId,
        mintA,
        decimals: 6, // Use 6 decimals as shown in the example
        name: params.tokenName,
        symbol: params.tokenSymbol,
        uri: params.metadataUri || 'https://raydium.io/',
        migrateType: params.migrateType || (params.enableFeeSharingPost ? 'cpmm' : 'amm'),
        
        configId,
        configInfo, // Using the retrieved config info
        mintBDecimals: mintBInfo.decimals,
        txVersion: TxVersion.V0,
        slippage: new BN(params.slippageBps || 100), // Default to 1% slippage
        buyAmount,
        createOnly: params.createOnly !== false, // Default to true unless explicitly set to false
        extraSigners: [pair], // Include the token mint keypair
        
        // Handle vesting configuration
        ...(params.vestingPercentage && parseInt(params.vestingPercentage) > 0 ? {
          vesting: {
            lockedPercent: parseInt(params.vestingPercentage),
            cliff: params.vestingCliff ? parseInt(params.vestingCliff) : 0,
            duration: params.vestingDuration ? parseInt(params.vestingDuration) : 0,
            timeUnit: params.vestingTimeUnit || 'month', // Default to month
          }
        } : {}),
        
        // Add fee configuration if provided
        ...(params.shareFeeReceiver ? {
          shareFeeReceiver: new PublicKey(params.shareFeeReceiver),
          shareFeeRate: shareFeeRateBN,
        } : {}),
        
        // Add platform fee if provided
        ...(params.platformFeeRate ? {
          platformFeeRate: platformFeeRateBN,
        } : {}),
        
        // Add compute budget if provided
        ...(params.computeBudgetConfig ? {
          computeBudgetConfig: params.computeBudgetConfig,
        } : {}),
      });
      
      // Get the transaction we need to send
      const transaction = transactions[0];
      
      // Ensure the user's public key is set as the fee payer
      if (transaction) {
        // First, let's identify what kind of transaction we're dealing with
        if (transaction instanceof Transaction) {
          // It's a legacy Transaction
          console.log('[RaydiumLaunchpadService] Working with legacy Transaction');
          transaction.feePayer = userPublicKey;
          transaction.recentBlockhash = blockhash;
        } else if ('version' in transaction) {
          // It's a VersionedTransaction
          console.log('[RaydiumLaunchpadService] Working with VersionedTransaction');
          // For versioned transactions, the fee payer is set in the message header
          // and we don't need to explicitly set it here
        } else {
          console.log('[RaydiumLaunchpadService] Unknown transaction type, attempting to set fee payer');
          // Try to set fee payer if possible, but don't crash if we can't
          try {
            (transaction as any).feePayer = userPublicKey;
            (transaction as any).recentBlockhash = blockhash;
          } catch (e) {
            console.warn('[RaydiumLaunchpadService] Could not set fee payer on transaction', e);
          }
        }
      }
      
      // Calculate the expected pool ID
      const poolId = getPdaLaunchpadPoolId(
        programId,
        mintA,
        mintB
      ).publicKey.toString();
      
      // Convert the transaction to base64 for sending to the client
      const txBuffer = Buffer.from(transaction.serialize());
      const serializedTx = txBuffer.toString('base64');
      
      console.log('[RaydiumLaunchpadService] Successfully created transaction');
      console.log('[RaydiumLaunchpadService] Transaction serialized to base64');
      
      return {
        transaction: serializedTx,
        mintAddress: mintA.toString(),
        poolId
      };
    } catch (error) {
      console.error('[RaydiumLaunchpadService] Error creating token:', error);
      throw error;
    }
  }
} 