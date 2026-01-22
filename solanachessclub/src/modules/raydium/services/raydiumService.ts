import {
  Connection,
  Transaction,
  VersionedTransaction,
  PublicKey,
} from '@solana/web3.js';
import {ENDPOINTS} from '@/shared/config/constants';
import {CLUSTER, HELIUS_STAKED_URL, SERVER_URL} from '@env';
import {TransactionService} from '../../wallet-providers/services/transaction/transactionService';
import {TokenInfo} from '../../data-module/types/tokenTypes';
import {Buffer} from 'buffer';

// Constants
const DEFAULT_SLIPPAGE_BPS = 300; // 2% default slippage for Raydium

// Types
export interface RaydiumSwapResponse {
  success: boolean;
  signature?: string;
  error?: Error | string;
  inputAmount: number;
  outputAmount: number;
}

export interface RaydiumSwapCallback {
  statusCallback?: (status: string) => void;
  isComponentMounted?: () => boolean;
}

// Launchpad Types
export interface LaunchpadTokenData {
  name: string;
  symbol: string;
  decimals: number;
  description?: string;
  uri?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  imageData?: string;
  imageUri?: string; // New field for image URI
}

export interface LaunchpadConfigData {
  quoteTokenMint?: string;
  tokenSupply?: string;
  solRaised?: string;
  bondingCurvePercentage?: string;
  poolMigration?: string;
  vestingPercentage?: string;
  vestingDuration?: string;
  vestingCliff?: string;
  vestingTimeUnit?: string;
  enableFeeSharingPost?: boolean;
  mode: 'justSendIt' | 'launchLab';
  migrateType?: 'amm' | 'cpmm';
  shareFeeRate?: number;
  slippageBps?: number;
  createOnly?: boolean; // Whether to only create token without executing initial buy
  initialBuyAmount?: string; // Amount of SOL for initial token purchase
  // Fee configuration
  shareFeeReceiver?: string; // Address receiving share fees
  platformFeeRate?: number; // Platform fee rate
  computeBudgetConfig?: {
    units?: number; // Compute units
    microLamports?: number; // Price per compute unit
  };
}

export interface LaunchpadResponse {
  success: boolean;
  signature?: string;
  error?: Error | string;
  poolId?: string;
  mintAddress?: string;
}

/**
 * RaydiumService - Client-side service for executing Raydium swaps
 *
 * This is just a thin wrapper around the server API. All logic is on the server.
 */
export class RaydiumService {
  /**
   * Convert amount to base units (e.g., SOL -> lamports)
   */
  static toBaseUnits(amount: string, decimals: number): number {
    const val = parseFloat(amount);
    if (isNaN(val)) return 0;
    return Math.floor(val * Math.pow(10, decimals));
  }

  /**
   * Upload token metadata and image to IPFS
   */
  static async uploadTokenMetadata({
    tokenName,
    tokenSymbol,
    description,
    twitter,
    telegram,
    website,
    imageUri,
  }: {
    tokenName: string;
    tokenSymbol: string;
    description: string;
    twitter?: string;
    telegram?: string;
    website?: string;
    imageUri: string;
  }): Promise<string> {
    console.log('[RaydiumService] Uploading token metadata with image:', {
      tokenName,
      tokenSymbol,
      imageUri: imageUri ? `${imageUri.substring(0, 20)}...` : undefined,
    });

    try {
      const uploadEndpoint = `${SERVER_URL}/api/raydium/launchpad/uploadMetadata`;
      const formData = new FormData();
      
      // Add metadata fields
      formData.append('tokenName', tokenName);
      formData.append('tokenSymbol', tokenSymbol);
      formData.append('description', description);
      formData.append('twitter', twitter || '');
      formData.append('telegram', telegram || '');
      formData.append('website', website || '');
      
      // Add image
      formData.append('image', {
        uri: imageUri,
        name: 'token.png',
        type: 'image/png',
      } as any);

      const uploadResponse = await fetch(uploadEndpoint, {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Metadata upload failed: ${errorText}`);
      }
      
      const uploadJson = await uploadResponse.json();
      if (!uploadJson?.success || !uploadJson.metadataUri) {
        throw new Error(uploadJson?.error || 'No metadataUri returned');
      }
      
      console.log('[RaydiumService] Metadata URI created:', uploadJson.metadataUri);
      return uploadJson.metadataUri;
    } catch (error: any) {
      console.error('[RaydiumService] Error uploading metadata:', error);
      throw new Error(`Failed to upload metadata: ${error.message}`);
    }
  }

  /**
   * Executes a token swap using Raydium API on the server
   */
  static async executeSwap(
    inputToken: TokenInfo,
    outputToken: TokenInfo,
    inputAmount: string,
    walletPublicKey: PublicKey,
    sendTransaction: (
      transaction: Transaction | VersionedTransaction,
      connection: Connection,
      options?: {
        statusCallback?: (status: string) => void;
        confirmTransaction?: boolean;
      },
    ) => Promise<string>,
    callbacks?: RaydiumSwapCallback,
  ): Promise<RaydiumSwapResponse> {
    const safeUpdateStatus = (status: string) => {
      if (!callbacks?.isComponentMounted || callbacks.isComponentMounted()) {
        callbacks?.statusCallback?.(status);
      }
    };

    try {
      const inputLamports = this.toBaseUnits(inputAmount, inputToken.decimals);

      safeUpdateStatus('Preparing swap transaction...');

      const response = await fetch(`${ENDPOINTS.serverBase}/api/raydium/swap`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          inputMint: inputToken.address,
          outputMint: outputToken.address,
          amount: inputLamports,
          userPublicKey: walletPublicKey.toString(),
          slippageBps: DEFAULT_SLIPPAGE_BPS, // Use a higher default slippage to mitigate failures
        }),
      });

      if (callbacks?.isComponentMounted && !callbacks.isComponentMounted()) {
        throw new Error('Component unmounted');
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${errorText || response.statusText}`);
      }

      const swapData = await response.json();

      if (callbacks?.isComponentMounted && !callbacks.isComponentMounted()) {
        throw new Error('Component unmounted');
      }

      if (!swapData.success || !swapData.transaction) {
        throw new Error(
          swapData.error || 'Failed to get transaction from server',
        );
      }

      const outputAmount = swapData.outputAmount || 0;

      safeUpdateStatus('Transaction received, please approve...');
      const txBuffer = Buffer.from(swapData.transaction, 'base64');

      let transaction: Transaction | VersionedTransaction;
      try {
        transaction = VersionedTransaction.deserialize(
          new Uint8Array(txBuffer),
        );
      } catch (e) {
        transaction = Transaction.from(txBuffer);
        transaction.feePayer = walletPublicKey;
      }

      if (callbacks?.isComponentMounted && !callbacks.isComponentMounted()) {
        throw new Error('Component unmounted');
      }

      const rpcUrl =
        HELIUS_STAKED_URL ||
        ENDPOINTS.helius ||
        `https://api.${CLUSTER}.solana.com`;
      const connection = new Connection(rpcUrl, 'confirmed');

      const signature = await sendTransaction(transaction, connection, {
        statusCallback: status => {
          if (
            !callbacks?.isComponentMounted ||
            callbacks.isComponentMounted()
          ) {
            TransactionService.filterStatusUpdate(status, filteredStatus => {
              safeUpdateStatus(filteredStatus);
            });
          }
        },
        confirmTransaction: true,
      });

      if (callbacks?.isComponentMounted && !callbacks.isComponentMounted()) {
        console.log(
          '[RaydiumService] Component unmounted after transaction, but transaction was successful with signature:',
          signature,
        );
        return {
          success: true,
          signature,
          inputAmount: inputLamports,
          outputAmount,
        };
      }

      console.log(
        '[RaydiumService] Transaction sent with signature:',
        signature,
      );
      TransactionService.showSuccess(signature, 'swap');
      safeUpdateStatus('Swap successful!');

      return {
        success: true,
        signature,
        inputAmount: inputLamports,
        outputAmount,
      };
    } catch (err: any) {
      if (err.message === 'Component unmounted') {
        console.log(
          '[RaydiumService] Operation cancelled because component unmounted',
        );
        return {
          success: false,
          error: new Error('Operation cancelled'),
          inputAmount: 0,
          outputAmount: 0,
        };
      }

      console.error('[RaydiumService] Error:', err);

      if (!callbacks?.isComponentMounted || callbacks.isComponentMounted()) {
        TransactionService.showError(err);
      }

      return {
        success: false,
        error: err,
        inputAmount: 0,
        outputAmount: 0,
      };
    }
  }

  /**
   * Creates a new token and launches it on Raydium
   */
  static async createAndLaunchToken(
    tokenData: LaunchpadTokenData,
    walletPublicKey: PublicKey,
    sendTransaction: (
      transaction: Transaction | VersionedTransaction,
      connection: Connection,
      options?: {
        statusCallback?: (status: string) => void;
        confirmTransaction?: boolean;
      },
    ) => Promise<string>,
    callbacks?: RaydiumSwapCallback,
    configData?: LaunchpadConfigData,
  ): Promise<LaunchpadResponse> {
    const safeUpdateStatus = (status: string) => {
      if (!callbacks?.isComponentMounted || callbacks.isComponentMounted()) {
        callbacks?.statusCallback?.(status);
      }
    };

    try {
      safeUpdateStatus('Preparing token launch...');
      
      // If there's an imageUri but no uri, upload the metadata and image first
      let metadataUri = tokenData.uri;
      if (tokenData.imageData && !metadataUri) {
        safeUpdateStatus('Uploading token image and metadata...');
        
        try {
          metadataUri = await this.uploadTokenMetadata({
            tokenName: tokenData.name,
            tokenSymbol: tokenData.symbol,
            description: tokenData.description || '',
            twitter: tokenData.twitter,
            telegram: tokenData.telegram,
            website: tokenData.website,
            imageUri: tokenData.imageData,
          });
          console.log('[RaydiumService] Metadata URI:', metadataUri);
          safeUpdateStatus('Metadata uploaded successfully');
        } catch (uploadError: any) {
          console.error('[RaydiumService] Metadata upload error:', uploadError);
          safeUpdateStatus('Metadata upload failed, using fallback method...');
        }
      }

      // Parse token supply (remove commas)
      const cleanSupply = configData?.tokenSupply?.replace(/,/g, '');

      const response = await fetch(
        `${ENDPOINTS.serverBase}/api/raydium/launchpad/create`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            tokenName: tokenData.name,
            tokenSymbol: tokenData.symbol,
            decimals: tokenData.decimals || 9,
            description: tokenData.description,
            uri: metadataUri, // Use the URI we got from the upload if available
            twitter: tokenData.twitter,
            telegram: tokenData.telegram,
            website: tokenData.website,
            imageData: tokenData.imageData, // Fallback image data if upload failed
            quoteTokenMint: configData?.quoteTokenMint,
            tokenSupply: cleanSupply,
            solRaised: configData?.solRaised,
            bondingCurvePercentage: configData?.bondingCurvePercentage,
            poolMigration: configData?.poolMigration,
            vestingPercentage: configData?.vestingPercentage,
            vestingDuration: configData?.vestingDuration,
            vestingCliff: configData?.vestingCliff,
            vestingTimeUnit: configData?.vestingTimeUnit,
            enableFeeSharingPost: configData?.enableFeeSharingPost,
            userPublicKey: walletPublicKey.toString(),
            mode: configData?.mode,
            createOnly: configData?.createOnly,
            migrateType: configData?.migrateType || 'amm', // Default to 'amm' if not specified
            shareFeeReceiver: configData?.shareFeeReceiver,
            shareFeeRate: configData?.shareFeeRate,
            platformFeeRate: configData?.platformFeeRate,
            slippageBps: configData?.slippageBps,
            initialBuyAmount: configData?.initialBuyAmount,
            computeBudgetConfig: configData?.computeBudgetConfig,
          }),
        },
      );

      if (callbacks?.isComponentMounted && !callbacks.isComponentMounted()) {
        throw new Error('Component unmounted');
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${errorText || response.statusText}`);
      }

      const launchData = await response.json();

      if (callbacks?.isComponentMounted && !callbacks.isComponentMounted()) {
        throw new Error('Component unmounted');
      }

      if (!launchData.success || !launchData.transaction) {
        throw new Error(
          launchData.error || 'Failed to create token launch transaction',
        );
      }

      safeUpdateStatus('Transaction received, please approve...');
      const txBuffer = Buffer.from(launchData.transaction, 'base64');

      let transaction: Transaction | VersionedTransaction;
      try {
        transaction = VersionedTransaction.deserialize(
          new Uint8Array(txBuffer),
        );
      } catch (e) {
        transaction = Transaction.from(txBuffer);
        transaction.feePayer = walletPublicKey;
      }

      if (callbacks?.isComponentMounted && !callbacks.isComponentMounted()) {
        throw new Error('Component unmounted');
      }

      const rpcUrl =
        HELIUS_STAKED_URL ||
        ENDPOINTS.helius ||
        `https://api.${CLUSTER}.solana.com`;
      const connection = new Connection(rpcUrl, 'confirmed');

      const signature = await sendTransaction(transaction, connection, {
        statusCallback: status => {
          if (
            !callbacks?.isComponentMounted ||
            callbacks.isComponentMounted()
          ) {
            TransactionService.filterStatusUpdate(status, filteredStatus => {
              safeUpdateStatus(filteredStatus);
            });
          }
        },
        confirmTransaction: true,
      });

      if (callbacks?.isComponentMounted && !callbacks.isComponentMounted()) {
        console.log(
          '[RaydiumService] Component unmounted after transaction, but token creation was successful with signature:',
          signature,
        );
        return {
          success: true,
          signature,
          poolId: launchData.poolId,
          mintAddress: launchData.mintAddress,
        };
      }

      console.log(
        '[RaydiumService] Token creation transaction sent with signature:',
        signature,
      );
      TransactionService.showSuccess(signature, 'token');
      safeUpdateStatus('Token launched successfully!');

      return {
        success: true,
        signature,
        poolId: launchData.poolId,
        mintAddress: launchData.mintAddress,
      };
    } catch (err: any) {
      if (err.message === 'Component unmounted') {
        console.log(
          '[RaydiumService] Operation cancelled because component unmounted',
        );
        return {
          success: false,
          error: new Error('Operation cancelled'),
        };
      }

      console.error('[RaydiumService] Error:', err);

      if (!callbacks?.isComponentMounted || callbacks.isComponentMounted()) {
        TransactionService.showError(err);
      }

      return {
        success: false,
        error: err,
      };
    }
  }
}
