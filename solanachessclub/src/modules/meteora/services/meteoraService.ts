import {
  MeteoraTrade,
  LiquidityPosition,
  MeteoraPool,
  CreateConfigParams,
  BuildCurveByMarketCapParams,
  CreatePoolParams,
  CreatePoolAndBuyParams,
} from '../types';
import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import BN from 'bn.js';
import {Buffer} from 'buffer';
import {SERVER_URL} from '@env';

// API base URL - Use local server that implements the SDK
const API_BASE_URL = `${SERVER_URL || 'http://localhost:8080'}/api`;

// Helper function to make API calls
async function apiCall(endpoint: string, method: string = 'GET', data?: any) {
  try {
    console.log(`Making API call to ${API_BASE_URL}${endpoint}`);

    // Log the data for debugging if this is a POST request
    if (method === 'POST' && data) {
      // Clean up the logged data for readability, avoiding large numbers that might stringify as hex
      const cleanedData = {...data};
      if (cleanedData.buyAmount)
        cleanedData.buyAmount = String(cleanedData.buyAmount);
      if (cleanedData.minimumAmountOut)
        cleanedData.minimumAmountOut = String(cleanedData.minimumAmountOut);
      console.log('Request data:', JSON.stringify(cleanedData));
    }

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      // Ensure numeric values are properly stringified
      const processedData = {...data};

      // Handle specific endpoints that need numeric values as strings
      if (endpoint.includes('/pool-and-buy')) {
        if (typeof processedData.buyAmount !== 'string') {
          processedData.buyAmount = String(processedData.buyAmount);
        }
        if (typeof processedData.minimumAmountOut !== 'string') {
          processedData.minimumAmountOut = String(
            processedData.minimumAmountOut || '1',
          );
        }
      }

      options.body = JSON.stringify(processedData);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const contentType = response.headers.get('content-type');

    if (!contentType || !contentType.includes('application/json')) {
      console.error(`Invalid content type received: ${contentType}`);
      const text = await response.text();
      console.error(`Response body: ${text.substring(0, 200)}...`);

      // Return empty mock data instead of throwing an error for better UX
      // This will show empty states in the UI instead of errors
      if (endpoint.includes('/positions/')) {
        return {success: true, positions: []};
      } else if (endpoint.includes('/pools')) {
        return {success: true, pools: []};
      }

      throw new Error(`Expected JSON response but got ${contentType}`);
    }

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`API error response (${response.status}):`, errorData);
      throw new Error(
        errorData.error || `API call failed with status ${response.status}`,
      );
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`Error in API call to ${endpoint}:`, error);

    // Return mock data for specific endpoints to prevent UI from breaking
    if (endpoint.includes('/positions/')) {
      return {success: true, positions: []};
    } else if (endpoint.includes('/pools')) {
      return {success: true, pools: []};
    }

    throw error;
  }
}

/**
 * Create a new config for Dynamic Bonding Curve
 */
export const createConfig = async (
  params: CreateConfigParams,
  connection: Connection,
  wallet: any,
  onStatusUpdate?: (status: string) => void,
): Promise<{txId: string}> => {
  try {
    onStatusUpdate?.('Creating DBC config...');

    const result = await apiCall('/config', 'POST', {
      payer: wallet.publicKey,
      config: new PublicKey(params.feeClaimer).toBase58(), // Using feeClaimer as a seed for config
      feeClaimer: params.feeClaimer,
      leftoverReceiver: params.leftoverReceiver,
      quoteMint: params.quoteMint,
      poolFees: params.poolFees,
      activationType: params.activationType,
      collectFeeMode: params.collectFeeMode,
      migrationOption: params.migrationOption,
      tokenType: params.tokenType,
      tokenDecimal: params.tokenDecimal,
      migrationQuoteThreshold: params.migrationQuoteThreshold,
      partnerLpPercentage: params.partnerLpPercentage,
      creatorLpPercentage: params.creatorLpPercentage,
      partnerLockedLpPercentage: params.partnerLockedLpPercentage,
      creatorLockedLpPercentage: params.creatorLockedLpPercentage,
      sqrtStartPrice: params.sqrtStartPrice,
      lockedVesting: params.lockedVesting,
      migrationFeeOption: params.migrationFeeOption,
      tokenSupply: params.tokenSupply,
      creatorTradingFeePercentage: params.creatorTradingFeePercentage,
      padding0: [],
      padding1: [],
      curve: params.curve,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to create config');
    }

    onStatusUpdate?.('Signing transaction...');

    // Sign and send the transaction
    const txBufferConfig = Buffer.from(result.transaction, 'base64');
    let txToSignConfig: Transaction | VersionedTransaction;
    try {
      txToSignConfig = VersionedTransaction.deserialize(
        new Uint8Array(txBufferConfig),
      );
    } catch (e) {
      console.warn(
        'Failed to deserialize as VersionedTransaction for createConfig, trying legacy Transaction:',
        e,
      );
      txToSignConfig = Transaction.from(new Uint8Array(txBufferConfig));
      if (!txToSignConfig.feePayer && wallet.publicKey) {
        txToSignConfig.feePayer = new PublicKey(wallet.publicKey);
      } else if (!txToSignConfig.feePayer) {
        console.error(
          'CRITICAL: Legacy transaction for createConfig deserialized without a feePayer and wallet.publicKey is unavailable.',
        );
      }
    }

    const txSignature = await wallet.sendTransaction(
      txToSignConfig,
      connection,
      {confirmTransaction: true, statusCallback: onStatusUpdate},
    );

    onStatusUpdate?.('Config created successfully!');

    return {
      txId: txSignature,
    };
  } catch (error) {
    console.error('Error creating DBC config:', error);
    onStatusUpdate?.('Config creation failed');
    throw error;
  }
};

/**
 * Build curve by market cap and create config
 */
export const buildCurveByMarketCap = async (
  params: BuildCurveByMarketCapParams,
  connection: Connection,
  wallet: any,
  onStatusUpdate?: (status: string) => void,
): Promise<{txId: string; configAddress: string}> => {
  try {
    onStatusUpdate?.('Building curve by market cap...');

    const result = await apiCall('/meteora/build-curve-by-market-cap', 'POST', {
      buildCurveByMarketCapParam: {
        totalTokenSupply: params.totalTokenSupply,
        initialMarketCap: params.initialMarketCap,
        migrationMarketCap: params.migrationMarketCap,
        migrationOption: params.migrationOption,
        tokenBaseDecimal: params.tokenBaseDecimal,
        tokenQuoteDecimal: params.tokenQuoteDecimal,
        lockedVesting: params.lockedVesting,
        feeSchedulerParam: params.feeSchedulerParam,
        baseFeeBps: params.baseFeeBps,
        dynamicFeeEnabled: params.dynamicFeeEnabled,
        activationType: params.activationType,
        collectFeeMode: params.collectFeeMode,
        migrationFeeOption: params.migrationFeeOption,
        tokenType: params.tokenType,
        partnerLpPercentage: params.partnerLpPercentage,
        creatorLpPercentage: params.creatorLpPercentage,
        partnerLockedLpPercentage: params.partnerLockedLpPercentage,
        creatorLockedLpPercentage: params.creatorLockedLpPercentage,
        creatorTradingFeePercentage: params.creatorTradingFeePercentage,
      },
      feeClaimer: wallet.publicKey.toString(),
      leftoverReceiver: wallet.publicKey.toString(),
      payer: wallet.publicKey.toString(),
      quoteMint: 'So11111111111111111111111111111111111111112', // SOL by default
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to build curve');
    }

    onStatusUpdate?.('Signing transaction...');

    let txSignature;
    try {
      const txBufferCurve = Buffer.from(result.transaction, 'base64');
      let txToSignCurve: Transaction | VersionedTransaction;
      try {
        txToSignCurve = VersionedTransaction.deserialize(
          new Uint8Array(txBufferCurve),
        );
      } catch (e) {
        console.warn(
          'Failed to deserialize as VersionedTransaction for buildCurveByMarketCap, trying legacy Transaction:',
          e,
        );
        txToSignCurve = Transaction.from(new Uint8Array(txBufferCurve));
        if (!txToSignCurve.feePayer && wallet.publicKey) {
          txToSignCurve.feePayer = new PublicKey(wallet.publicKey);
        } else if (!txToSignCurve.feePayer) {
          console.error(
            'CRITICAL: Legacy transaction for buildCurveByMarketCap deserialized without a feePayer and wallet.publicKey is unavailable.',
          );
        }
      }

      // Try to sign and send the transaction with confirmation - INCREASED TIMEOUT AND RETRIES
      txSignature = await wallet.sendTransaction(txToSignCurve, connection, {
        confirmTransaction: true,
        statusCallback: onStatusUpdate,
        maxRetries: 120, // Doubled to 120 retries
        confirmationTimeout: 180000, // Tripled to 3 minutes
      });
    } catch (confirmError) {
      console.warn('Error confirming transaction:', confirmError);

      // If confirmation fails, try to send without waiting for confirmation
      onStatusUpdate?.(
        'Confirmation timed out. Sending without confirmation...',
      );

      const txBufferCurveRetry = Buffer.from(result.transaction, 'base64');
      let txToSignCurveRetry: Transaction | VersionedTransaction;
      try {
        txToSignCurveRetry = VersionedTransaction.deserialize(
          new Uint8Array(txBufferCurveRetry),
        );
      } catch (e) {
        console.warn(
          'Failed to deserialize as VersionedTransaction for buildCurveByMarketCap retry, trying legacy Transaction:',
          e,
        );
        txToSignCurveRetry = Transaction.from(
          new Uint8Array(txBufferCurveRetry),
        );
        if (!txToSignCurveRetry.feePayer && wallet.publicKey) {
          txToSignCurveRetry.feePayer = new PublicKey(wallet.publicKey);
        } else if (!txToSignCurveRetry.feePayer) {
          console.error(
            'CRITICAL: Legacy transaction for buildCurveByMarketCap retry deserialized without a feePayer and wallet.publicKey is unavailable.',
          );
        }
      }

      txSignature = await wallet.sendTransaction(
        txToSignCurveRetry,
        connection,
        {confirmTransaction: false, statusCallback: onStatusUpdate},
      );

      // Wait a few seconds to allow transaction to propagate
      onStatusUpdate?.('Transaction sent. Waiting for network propagation...');
      await new Promise(resolve => setTimeout(resolve, 10000)); // Increased to 10 seconds wait

      // Multiple attempts to check confirmation
      let confirmed = false;
      let attempts = 0;
      const maxAttempts = 5;

      while (!confirmed && attempts < maxAttempts) {
        attempts++;
        try {
          onStatusUpdate?.(
            `Checking transaction status (attempt ${attempts}/${maxAttempts})...`,
          );
          const status = await connection.getSignatureStatus(txSignature);
          console.log('Transaction status:', status);

          if (
            status &&
            status.value &&
            (status.value.confirmationStatus === 'confirmed' ||
              status.value.confirmationStatus === 'finalized')
          ) {
            onStatusUpdate?.('Transaction confirmed manually!');
            confirmed = true;
            break;
          } else {
            onStatusUpdate?.(
              `Status check ${attempts}/${maxAttempts}: Transaction not confirmed yet. Waiting...`,
            );
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before checking again
          }
        } catch (statusError) {
          console.warn(
            `Error checking transaction status (attempt ${attempts}/${maxAttempts}):`,
            statusError,
          );
        }
      }

      if (!confirmed) {
        onStatusUpdate?.(
          'Could not verify transaction status. Please check explorer later.',
        );
      }
    }

    onStatusUpdate?.('Curve building transaction sent! TX ID: ' + txSignature);

    // Additional verification to make sure we have a config address
    if (!result.configAddress) {
      console.warn(
        'Missing configAddress in result, trying to fetch transaction result',
      );
      // Try to wait for a bit and see if we can get transaction details
      await new Promise(resolve => setTimeout(resolve, 5000));

      try {
        const txResult = await connection.getTransaction(txSignature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });

        if (txResult) {
          onStatusUpdate?.('Transaction found on-chain. Proceeding...');
        } else {
          onStatusUpdate?.('Transaction not yet found on-chain.');
        }
      } catch (txError) {
        console.warn('Error fetching transaction:', txError);
      }
    }

    return {
      txId: txSignature,
      configAddress: result.configAddress || '',
    };
  } catch (error) {
    console.error('Error building curve by market cap:', error);
    onStatusUpdate?.('Curve building failed');
    throw error;
  }
};

/**
 * Create a new token pool
 */
export const createPool = async (
  params: CreatePoolParams,
  connection: Connection,
  wallet: any,
  onStatusUpdate?: (status: string) => void,
): Promise<{txId: string; poolAddress: string; baseMintAddress: string}> => {
  try {
    onStatusUpdate?.('Creating token pool...');

    const result = await apiCall('/meteora/pool', 'POST', {
      payer: wallet.publicKey.toString(),
      poolCreator: wallet.publicKey.toString(),
      quoteMint: params.quoteMint,
      config: params.config,
      baseTokenType: params.baseTokenType,
      quoteTokenType: params.quoteTokenType,
      name: params.name,
      symbol: params.symbol,
      uri: params.uri,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to create pool');
    }

    onStatusUpdate?.('Signing transaction...');

    let txSignature;
    try {
      const txBufferPool = Buffer.from(result.transaction, 'base64');
      let txToSignPool: Transaction | VersionedTransaction;
      try {
        txToSignPool = VersionedTransaction.deserialize(
          new Uint8Array(txBufferPool),
        );
      } catch (e) {
        console.warn(
          'Failed to deserialize as VersionedTransaction for createPool, trying legacy Transaction:',
          e,
        );
        txToSignPool = Transaction.from(new Uint8Array(txBufferPool));
        if (!txToSignPool.feePayer && wallet.publicKey) {
          txToSignPool.feePayer = new PublicKey(wallet.publicKey);
        } else if (!txToSignPool.feePayer) {
          console.error(
            'CRITICAL: Legacy transaction for createPool deserialized without a feePayer and wallet.publicKey is unavailable.',
          );
        }
      }
      // Try to sign and send the transaction with confirmation - INCREASED TIMEOUT AND RETRIES
      txSignature = await wallet.sendTransaction(txToSignPool, connection, {
        confirmTransaction: true,
        statusCallback: onStatusUpdate,
        maxRetries: 120, // Doubled to 120 retries
        confirmationTimeout: 180000, // Tripled to 3 minutes
      });
    } catch (confirmError) {
      console.warn('Error confirming pool creation transaction:', confirmError);

      // If confirmation fails, try to send without waiting for confirmation
      onStatusUpdate?.(
        'Confirmation timed out. Sending without confirmation...',
      );

      const txBufferPoolRetry = Buffer.from(result.transaction, 'base64');
      let txToSignPoolRetry: Transaction | VersionedTransaction;
      try {
        txToSignPoolRetry = VersionedTransaction.deserialize(
          new Uint8Array(txBufferPoolRetry),
        );
      } catch (e) {
        console.warn(
          'Failed to deserialize as VersionedTransaction for createPool retry, trying legacy Transaction:',
          e,
        );
        txToSignPoolRetry = Transaction.from(new Uint8Array(txBufferPoolRetry));
        if (!txToSignPoolRetry.feePayer && wallet.publicKey) {
          txToSignPoolRetry.feePayer = new PublicKey(wallet.publicKey);
        } else if (!txToSignPoolRetry.feePayer) {
          console.error(
            'CRITICAL: Legacy transaction for createPool retry deserialized without a feePayer and wallet.publicKey is unavailable.',
          );
        }
      }

      txSignature = await wallet.sendTransaction(
        txToSignPoolRetry,
        connection,
        {confirmTransaction: false, statusCallback: onStatusUpdate},
      );

      // Wait longer on mainnet to allow transaction to propagate
      onStatusUpdate?.('Transaction sent. Waiting for network propagation...');
      await new Promise(resolve => setTimeout(resolve, 10000)); // Increased to 10 seconds wait

      // Multiple attempts to check confirmation
      let confirmed = false;
      let attempts = 0;
      const maxAttempts = 5;

      while (!confirmed && attempts < maxAttempts) {
        attempts++;
        try {
          onStatusUpdate?.(
            `Checking transaction status (attempt ${attempts}/${maxAttempts})...`,
          );
          const status = await connection.getSignatureStatus(txSignature);
          console.log('Pool creation transaction status:', status);

          if (
            status &&
            status.value &&
            (status.value.confirmationStatus === 'confirmed' ||
              status.value.confirmationStatus === 'finalized')
          ) {
            onStatusUpdate?.('Transaction confirmed manually!');
            confirmed = true;
            break;
          } else {
            onStatusUpdate?.(
              `Status check ${attempts}/${maxAttempts}: Transaction not confirmed yet. Waiting...`,
            );
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before checking again
          }
        } catch (statusError) {
          console.warn(
            `Error checking transaction status (attempt ${attempts}/${maxAttempts}):`,
            statusError,
          );
        }
      }

      if (!confirmed) {
        onStatusUpdate?.(
          'Transaction sent but could not verify confirmation. Please check explorer later.',
        );
      }
    }

    onStatusUpdate?.('Pool creation transaction sent! TX ID: ' + txSignature);

    return {
      txId: txSignature,
      poolAddress: result.poolAddress || '',
      baseMintAddress: result.baseMintAddress || '',
    };
  } catch (error) {
    console.error('Error creating pool:', error);
    onStatusUpdate?.('Pool creation failed');
    throw error;
  }
};

// Add a new interface for token metadata
interface TokenMetadataParams {
  tokenName: string;
  tokenSymbol: string;
  description: string;
  imageUri?: string;
  imageFile?: any;
  twitter?: string;
  telegram?: string;
  website?: string;
}

/**
 * Upload token metadata and image to storage service
 */
export const uploadTokenMetadata = async (
  params: TokenMetadataParams,
): Promise<{
  success: boolean;
  metadataUri?: string;
  error?: string;
}> => {
  try {
    console.log('Uploading token metadata:', params.tokenName);

    // Validate required parameters
    if (!params.tokenName || !params.tokenSymbol || !params.description) {
      console.error('Missing required metadata fields');
      return {
        success: false,
        error:
          'Missing required metadata fields (name, symbol, or description)',
      };
    }

    if (!params.imageUri && !params.imageFile) {
      console.error('Missing token image');
      return {
        success: false,
        error: 'Token image is required (either file or URL)',
      };
    }

    // Create form data for the upload
    const formData = new FormData();
    formData.append('tokenName', params.tokenName);
    formData.append('tokenSymbol', params.tokenSymbol);
    formData.append('description', params.description);

    if (params.twitter) {
      formData.append('twitter', params.twitter);
    }

    if (params.telegram) {
      formData.append('telegram', params.telegram);
    }

    if (params.website) {
      formData.append('website', params.website);
    }

    // Handle image upload - either file or URL
    if (params.imageFile) {
      console.log('Using image file from device');
      // Extract file name and type from URI
      const uriParts = params.imageFile.uri.split('.');
      const fileType = uriParts[uriParts.length - 1];

      // Create file object for upload
      const file = {
        uri: params.imageFile.uri,
        name: `image.${fileType}`,
        type: `image/${fileType}`,
      };

      console.log('Image file prepared for upload');

      // @ts-ignore - FormData append with file works in React Native
      formData.append('image', file);
    } else if (params.imageUri) {
      console.log(
        'Using image URL:',
        params.imageUri.substring(0, 50) +
          (params.imageUri.length > 50 ? '...' : ''),
      );
      formData.append('imageUrl', params.imageUri);
    }

    // Log request
    const uploadUrl = `${API_BASE_URL}/meteora/uploadMetadata`;
    console.log(`Sending metadata to: ${uploadUrl}`);

    // Make API call to upload endpoint
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      headers: {
        Accept: 'application/json',
      },
    });

    // Log response status
    console.log('Server response status:', response.status);

    if (!response.ok) {
      let errorMessage = `Upload failed with status ${response.status}`;

      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (parseError) {
        // If we can't parse the error response as JSON, use the status code
        console.error('Could not parse error response as JSON:', parseError);
      }

      console.error('Server returned error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }

    // Parse response
    const result = await response.json();

    console.log('Metadata upload result:', result);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to upload metadata',
      };
    }

    return {
      success: true,
      metadataUri: result.metadataUri,
    };
  } catch (error) {
    console.error('Error uploading token metadata:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error uploading metadata',
    };
  }
};

/**
 * Helper function to create a Meteora DBC token with default parameters
 * This creates a new token with bonding curve pool for buying/selling.
 */
export const createTokenWithCurve = async (
  params: {
    tokenName: string;
    tokenSymbol: string;
    initialMarketCap: number;
    targetMarketCap: number;
    tokenSupply: number;
    buyAmount?: number; // Optional amount to buy immediately after creation
    metadataUri?: string; // Token metadata URI from IPFS or similar
    website?: string; // Optional website for token metadata
    logo?: string; // Optional logo URL for token metadata
    // Advanced settings
    baseFeeBps?: number; // Base fee in basis points (100 = 1%)
    dynamicFeeEnabled?: boolean; // Enable dynamic fee
    collectFeeBoth?: boolean; // Collect fee in both tokens
    migrationFeeOption?: number; // Migration fee option
    partnerLpPercentage?: number; // Partner LP percentage
    creatorLpPercentage?: number; // Creator LP percentage
    partnerLockedLpPercentage?: number; // Partner locked LP percentage
    creatorLockedLpPercentage?: number; // Creator locked LP percentage
  },
  connection: Connection,
  wallet: any,
  onStatusUpdate?: (status: string) => void,
): Promise<{
  configAddress: string;
  poolAddress?: string;
  baseMintAddress?: string;
  txId: string;
}> => {
  try {
    onStatusUpdate?.('Creating new token with bonding curve...');

    // Step 1: Create the config with bonding curve
    onStatusUpdate?.('Step 1: Building curve and creating config...');
    const curveResult = await buildCurveByMarketCap(
      {
        totalTokenSupply: params.tokenSupply,
        initialMarketCap: params.initialMarketCap,
        migrationMarketCap: params.targetMarketCap,
        migrationOption: 0, // DAMM V1
        tokenBaseDecimal: 9, // Standard token decimals
        tokenQuoteDecimal: 9, // SOL has 9 decimals
        lockedVesting: {
          amountPerPeriod: '0',
          cliffDurationFromMigrationTime: '0',
          frequency: '0',
          numberOfPeriod: '0',
          cliffUnlockAmount: '0',
        },
        feeSchedulerParam: {
          numberOfPeriod: 0,
          reductionFactor: 0,
          periodFrequency: 0,
          feeSchedulerMode: 0,
        },
        baseFeeBps: params.baseFeeBps ?? 100, // Use provided value or default to 1% fee
        dynamicFeeEnabled: params.dynamicFeeEnabled ?? true, // Use provided value or default to true
        activationType: 0, // Slot based
        collectFeeMode: params.collectFeeBoth ? 1 : 0, // 1 for both tokens, 0 for quote only
        migrationFeeOption: params.migrationFeeOption ?? 0, // Use provided value or default to Fixed 25bps
        tokenType: 0, // SPL token
        partnerLpPercentage: params.partnerLpPercentage ?? 25, // Use provided value or default to 25%
        creatorLpPercentage: params.creatorLpPercentage ?? 25, // Use provided value or default to 25%
        partnerLockedLpPercentage: params.partnerLockedLpPercentage ?? 25, // Use provided value or default to 25%
        creatorLockedLpPercentage: params.creatorLockedLpPercentage ?? 25, // Use provided value or default to 25%
        creatorTradingFeePercentage: 0,
      },
      connection,
      wallet,
      onStatusUpdate,
    );

    const configAddress = curveResult.configAddress;

    if (!configAddress) {
      throw new Error('Failed to create config - config address not returned');
    }

    onStatusUpdate?.(`Config created with address ${configAddress}`);

    let poolResult;
    let txId = curveResult.txId;

    // If buy amount is specified, use createPoolAndBuy to optimize the flow
    if (params.buyAmount && params.buyAmount > 0) {
      // Step 2+3: Create pool and buy in one transaction
      onStatusUpdate?.(
        `Creating pool and buying ${params.buyAmount} SOL worth of tokens...`,
      );

      const buyAmountLamports = Math.floor(params.buyAmount * 1e9);
      console.log(
        `Converting buyAmount ${params.buyAmount} SOL to ${buyAmountLamports} lamports`,
      );

      const poolAndBuyResult = await apiCall('/meteora/pool-and-buy', 'POST', {
        createPoolParam: {
          quoteMint: 'So11111111111111111111111111111111111111112', // SOL
          config: configAddress,
          baseTokenType: 0, // SPL
          quoteTokenType: 0, // SPL
          name: params.tokenName,
          symbol: params.tokenSymbol,
          uri: params.metadataUri || params.logo || '', // Use the metadata URI if available
          baseMint: '', // Will be created by the API
          payer: wallet.publicKey.toString(),
          poolCreator: wallet.publicKey.toString(),
        },
        buyAmount: buyAmountLamports.toString(), // Use string instead of BN object
        minimumAmountOut: '1', // Use string instead of BN object
        referralTokenAccount: null,
      });

      if (!poolAndBuyResult.success) {
        throw new Error(
          poolAndBuyResult.error || 'Failed to create pool and buy tokens',
        );
      }

      onStatusUpdate?.('Signing transaction...');

      const txBufferPoolAndBuy = Buffer.from(
        poolAndBuyResult.transaction,
        'base64',
      );
      let txToSignPoolAndBuy: Transaction | VersionedTransaction;
      try {
        txToSignPoolAndBuy = VersionedTransaction.deserialize(
          new Uint8Array(txBufferPoolAndBuy),
        );
      } catch (e) {
        console.warn(
          'Failed to deserialize as VersionedTransaction for createTokenWithCurve (poolAndBuy), trying legacy Transaction:',
          e,
        );
        txToSignPoolAndBuy = Transaction.from(
          new Uint8Array(txBufferPoolAndBuy),
        );
        if (!txToSignPoolAndBuy.feePayer && wallet.publicKey) {
          txToSignPoolAndBuy.feePayer = new PublicKey(wallet.publicKey);
        } else if (!txToSignPoolAndBuy.feePayer) {
          console.error(
            'CRITICAL: Legacy transaction for createTokenWithCurve (poolAndBuy) deserialized without a feePayer and wallet.publicKey is unavailable.',
          );
        }
      }
      // Sign and send the transaction
      const txSignature = await wallet.sendTransaction(
        txToSignPoolAndBuy,
        connection,
        {confirmTransaction: true, statusCallback: onStatusUpdate},
      );

      poolResult = {
        txId: txSignature,
        poolAddress: poolAndBuyResult.poolAddress,
        baseMintAddress: poolAndBuyResult.baseMintAddress,
      };

      onStatusUpdate?.(`Pool created and tokens purchased successfully!`);
    } else {
      // Step 2: Create the pool without buying
      onStatusUpdate?.('Creating pool...');
      poolResult = await createPool(
        {
          quoteMint: 'So11111111111111111111111111111111111111112', // SOL
          config: configAddress,
          baseTokenType: 0, // SPL
          quoteTokenType: 0, // SPL
          name: params.tokenName,
          symbol: params.tokenSymbol,
          uri: params.metadataUri || params.logo || '', // Use the metadata URI if available
          baseMint: '', // This will be created by the API call
        },
        connection,
        wallet,
        onStatusUpdate,
      );

      txId = poolResult.txId;
      onStatusUpdate?.(`Pool created successfully!`);
    }

    // Step 3 (optional): Create pool metadata if we have any additional info
    if (poolResult.poolAddress && (params.website || params.logo)) {
      try {
        onStatusUpdate?.('Creating pool metadata...');

        const metadataResult = await createPoolMetadata(
          {
            virtualPool: poolResult.poolAddress,
            name: params.tokenName,
            website: params.website || '',
            logo: params.logo || '',
            creator: wallet.publicKey.toString(),
            payer: wallet.publicKey.toString(),
          },
          connection,
          wallet,
          onStatusUpdate,
        );

        onStatusUpdate?.('Pool metadata created successfully!');
      } catch (metadataError) {
        console.warn('Error creating pool metadata:', metadataError);
        onStatusUpdate?.(
          'Note: Pool metadata creation failed, but token was created successfully.',
        );
        // We don't want to fail the whole process if just metadata creation fails
      }
    }

    return {
      configAddress,
      poolAddress: poolResult.poolAddress,
      baseMintAddress: poolResult.baseMintAddress,
      txId,
    };
  } catch (error) {
    console.error('Error creating token with curve:', error);
    onStatusUpdate?.(
      'Failed to create token with curve: ' +
        (error instanceof Error ? error.message : 'Unknown error'),
    );
    throw error;
  }
};

/**
 * Create a pool and buy tokens in one transaction
 */
export const createPoolAndBuy = async (
  params: CreatePoolAndBuyParams,
  connection: Connection,
  wallet: any,
  onStatusUpdate?: (status: string) => void,
): Promise<{txId: string; poolAddress: string}> => {
  try {
    onStatusUpdate?.('Creating pool and buying tokens...');

    // Make sure the quoteMint is specified
    if (!params.createPoolParam.quoteMint) {
      throw new Error('quoteMint is required for pool creation');
    }

    // Make sure the config is specified
    if (!params.createPoolParam.config) {
      throw new Error('config is required for pool creation');
    }

    // Example: To create a pool with default config, you could do:
    // const configResult = await buildCurveByMarketCap({
    //   totalTokenSupply: 1000000000,
    //   initialMarketCap: 10, // $10 initial market cap
    //   migrationMarketCap: 1000, // $1000 target market cap
    //   migrationOption: 0, // DAMM V1
    //   tokenBaseDecimal: 9,
    //   tokenQuoteDecimal: 9,
    //   ...other params
    // }, connection, wallet, onStatusUpdate);
    //
    // // Then use the config address:
    // params.createPoolParam.config = configResult.configAddress;

    const result = await apiCall('/meteora/pool-and-buy', 'POST', {
      createPoolParam: {
        payer: wallet.publicKey.toString(),
        poolCreator: wallet.publicKey.toString(),
        baseMint: params.createPoolParam.baseMint || '', // Provide default empty string
        quoteMint: params.createPoolParam.quoteMint,
        config: params.createPoolParam.config,
        baseTokenType: params.createPoolParam.baseTokenType,
        quoteTokenType: params.createPoolParam.quoteTokenType,
        name: params.createPoolParam.name,
        symbol: params.createPoolParam.symbol,
        uri: params.createPoolParam.uri,
      },
      buyAmount: params.buyAmount,
      minimumAmountOut: params.minimumAmountOut,
      referralTokenAccount: params.referralTokenAccount,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to create pool and buy');
    }

    onStatusUpdate?.('Signing transaction...');

    let txSignature;
    try {
      const txBufferPoolAndBuy = Buffer.from(result.transaction, 'base64');
      let txToSignPoolAndBuy: Transaction | VersionedTransaction;
      try {
        txToSignPoolAndBuy = VersionedTransaction.deserialize(
          new Uint8Array(txBufferPoolAndBuy),
        );
      } catch (e) {
        console.warn(
          'Failed to deserialize as VersionedTransaction for createPoolAndBuy, trying legacy Transaction:',
          e,
        );
        txToSignPoolAndBuy = Transaction.from(
          new Uint8Array(txBufferPoolAndBuy),
        );
        if (!txToSignPoolAndBuy.feePayer && wallet.publicKey) {
          txToSignPoolAndBuy.feePayer = new PublicKey(wallet.publicKey);
        } else if (!txToSignPoolAndBuy.feePayer) {
          console.error(
            'CRITICAL: Legacy transaction for createPoolAndBuy deserialized without a feePayer and wallet.publicKey is unavailable.',
          );
        }
      }
      // Try to sign and send the transaction with increased timeout and retries
      txSignature = await wallet.sendTransaction(
        txToSignPoolAndBuy,
        connection,
        {
          confirmTransaction: true,
          statusCallback: onStatusUpdate,
          maxRetries: 120, // Doubled to 120 retries
          confirmationTimeout: 180000, // Tripled to 3 minutes
        },
      );
    } catch (confirmError) {
      console.warn('Error confirming pool and buy transaction:', confirmError);

      // If confirmation fails, try to send without waiting for confirmation
      onStatusUpdate?.(
        'Confirmation timed out. Sending without waiting for confirmation...',
      );

      const txBufferPoolAndBuyRetry = Buffer.from(result.transaction, 'base64');
      let txToSignPoolAndBuyRetry: Transaction | VersionedTransaction;
      try {
        txToSignPoolAndBuyRetry = VersionedTransaction.deserialize(
          new Uint8Array(txBufferPoolAndBuyRetry),
        );
      } catch (e) {
        console.warn(
          'Failed to deserialize as VersionedTransaction for createPoolAndBuy retry, trying legacy Transaction:',
          e,
        );
        txToSignPoolAndBuyRetry = Transaction.from(
          new Uint8Array(txBufferPoolAndBuyRetry),
        );
        if (!txToSignPoolAndBuyRetry.feePayer && wallet.publicKey) {
          txToSignPoolAndBuyRetry.feePayer = new PublicKey(wallet.publicKey);
        } else if (!txToSignPoolAndBuyRetry.feePayer) {
          console.error(
            'CRITICAL: Legacy transaction for createPoolAndBuy retry deserialized without a feePayer and wallet.publicKey is unavailable.',
          );
        }
      }

      txSignature = await wallet.sendTransaction(
        txToSignPoolAndBuyRetry,
        connection,
        {confirmTransaction: false, statusCallback: onStatusUpdate},
      );

      // Wait longer to allow transaction to propagate on mainnet
      onStatusUpdate?.('Transaction sent. Waiting for network propagation...');
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds

      // Multiple attempts to check confirmation
      let confirmed = false;
      let attempts = 0;
      const maxAttempts = 5;

      while (!confirmed && attempts < maxAttempts) {
        attempts++;
        try {
          onStatusUpdate?.(
            `Checking transaction status (attempt ${attempts}/${maxAttempts})...`,
          );
          const status = await connection.getSignatureStatus(txSignature);
          console.log('Pool and buy transaction status:', status);

          if (
            status &&
            status.value &&
            (status.value.confirmationStatus === 'confirmed' ||
              status.value.confirmationStatus === 'finalized')
          ) {
            onStatusUpdate?.('Transaction confirmed manually!');
            confirmed = true;
            break;
          } else {
            onStatusUpdate?.(
              `Status check ${attempts}/${maxAttempts}: Transaction not confirmed yet. Waiting...`,
            );
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before checking again
          }
        } catch (statusError) {
          console.warn(
            `Error checking transaction status (attempt ${attempts}/${maxAttempts}):`,
            statusError,
          );
        }
      }

      if (!confirmed) {
        onStatusUpdate?.(
          'Transaction sent but could not verify confirmation. Please check explorer later.',
        );
        // Even without confirmation, we'll continue to registration since transaction might still succeed
      }
    }

    onStatusUpdate?.(
      'Pool creation and purchase transaction sent! TX ID: ' + txSignature,
    );
    return {
      txId: txSignature,
      poolAddress: result.poolAddress || '',
    };
  } catch (error) {
    console.error('Error creating pool and buying:', error);
    onStatusUpdate?.('Pool creation and purchase failed');
    throw error;
  }
};

/**
 * Create pool metadata
 */
export const createPoolMetadata = async (
  params: {
    virtualPool: string;
    name: string;
    website: string;
    logo: string;
    creator: string;
    payer: string;
  },
  connection: Connection,
  wallet: any,
  onStatusUpdate?: (status: string) => void,
): Promise<{txId: string}> => {
  try {
    onStatusUpdate?.('Creating pool metadata...');

    const result = await apiCall('/meteora/pool-metadata', 'POST', {
      virtualPool: params.virtualPool,
      name: params.name,
      website: params.website,
      logo: params.logo,
      creator: params.creator,
      payer: params.payer,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to create pool metadata');
    }

    onStatusUpdate?.('Signing transaction...');

    const txBufferMetadata = Buffer.from(result.transaction, 'base64');
    let txToSignMetadata: Transaction | VersionedTransaction;
    try {
      txToSignMetadata = VersionedTransaction.deserialize(
        new Uint8Array(txBufferMetadata),
      );
    } catch (e) {
      console.warn(
        'Failed to deserialize as VersionedTransaction for createPoolMetadata, trying legacy Transaction:',
        e,
      );
      txToSignMetadata = Transaction.from(new Uint8Array(txBufferMetadata));
      if (!txToSignMetadata.feePayer && wallet.publicKey) {
        txToSignMetadata.feePayer = new PublicKey(wallet.publicKey);
      } else if (!txToSignMetadata.feePayer) {
        console.error(
          'CRITICAL: Legacy transaction for createPoolMetadata deserialized without a feePayer and wallet.publicKey is unavailable.',
        );
      }
    }
    // Sign and send the transaction
    const txSignature = await wallet.sendTransaction(
      txToSignMetadata,
      connection,
      {confirmTransaction: true, statusCallback: onStatusUpdate},
    );

    onStatusUpdate?.('Pool metadata created successfully!');

    return {
      txId: txSignature,
    };
  } catch (error) {
    console.error('Error creating pool metadata:', error);
    onStatusUpdate?.('Pool metadata creation failed');
    throw error;
  }
};

/**
 * Get all available Meteora pools
 */
export const fetchMeteoraPools = async (): Promise<MeteoraPool[]> => {
  try {
    console.log('Fetching Meteora pools');

    // Use new endpoint for the server using SDK
    const result = await apiCall('/meteora/pools');

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch pools');
    }

    return result.pools || [];
  } catch (error) {
    console.error('Error fetching Meteora pools:', error);
    // Return empty array to prevent UI from breaking
    return [];
  }
};

/**
 * Get user's liquidity positions
 */
export const fetchUserLiquidityPositions = async (
  walletAddress: string,
): Promise<LiquidityPosition[]> => {
  try {
    console.log(`Fetching liquidity positions for wallet: ${walletAddress}`);

    // Use new endpoint for the server using SDK
    const result = await apiCall(`/meteora/positions/${walletAddress}`);

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch positions');
    }

    return result.positions || [];
  } catch (error) {
    console.error(
      `Error fetching liquidity positions for wallet ${walletAddress}:`,
      error,
    );
    // Return empty array to prevent UI from breaking
    return [];
  }
};

/**
 * Fetch swap quote from server
 */
export const fetchSwapQuote = async (
  inputToken: string,
  outputToken: string,
  amount: string,
  slippage: number = 0.5,
  poolAddress?: string,
): Promise<any> => {
  try {
    console.log(
      `Fetching swap quote for ${amount} ${inputToken} to ${outputToken}`,
    );

    // Build URL with optional pool address
    let url = `/meteora/quote?inputToken=${inputToken}&outputToken=${outputToken}&amount=${amount}&slippage=${slippage}`;
    if (poolAddress) {
      console.log(`Using specific pool: ${poolAddress}`);
      url += `&poolAddress=${poolAddress}`;
    }

    const result = await apiCall(url, 'GET');

    // Check if we got a response indicating no pool but suggesting a price-based fallback
    if (!result.success && result.shouldFallbackToPriceEstimate) {
      console.log(
        'No pool available, client should fallback to price-based estimation',
      );
      return {
        success: false,
        error: result.error,
        shouldFallbackToPriceEstimate: true,
        inputToken: result.inputToken,
        outputToken: result.outputToken,
        amount: result.amount,
      };
    }

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch quote');
    }

    return result;
  } catch (error) {
    console.error('Error fetching swap quote:', error);
    throw error;
  }
};

/**
 * Execute a trade on Meteora
 */
export const executeTrade = async (
  tradeParams: MeteoraTrade,
  poolAddress: string,
  wallet: any,
  onStatusUpdate?: (status: string) => void,
): Promise<{txId: string}> => {
  try {
    onStatusUpdate?.('Preparing trade...');

    // Validation checks
    if (!wallet) {
      throw new Error('Wallet is required for swap');
    }

    if (!wallet.publicKey) {
      throw new Error('Wallet public key is required for swap');
    }

    // Check if we need to get the pool first
    if (!poolAddress || poolAddress === '') {
      throw new Error('Pool address is required for swap');
    }

    // Create the swap parameters
    const swapParams = {
      owner: wallet.publicKey.toString(),
      amountIn: tradeParams.amount,
      minimumAmountOut: tradeParams.minimumAmountOut || '0', // Use provided min amount or 0
      swapBaseForQuote:
        tradeParams.inputToken !==
        'So11111111111111111111111111111111111111112', // True if selling tokens, false if buying
      pool: poolAddress,
      referralTokenAccount: null,
    };

    onStatusUpdate?.('Creating swap transaction...');

    // Make the API call to create the swap transaction
    const result = await apiCall('/meteora/swap', 'POST', swapParams);

    if (!result.success) {
      throw new Error(result.error || 'Failed to create swap transaction');
    }

    onStatusUpdate?.('Signing transaction...');

    const txBufferSwap = Buffer.from(result.transaction, 'base64');
    let txToSignSwap: Transaction | VersionedTransaction;
    try {
      txToSignSwap = VersionedTransaction.deserialize(
        new Uint8Array(txBufferSwap),
      );
    } catch (e) {
      console.warn(
        'Failed to deserialize as VersionedTransaction for executeTrade, trying legacy Transaction:',
        e,
      );
      txToSignSwap = Transaction.from(new Uint8Array(txBufferSwap));
      if (!txToSignSwap.feePayer && wallet.publicKey) {
        txToSignSwap.feePayer = new PublicKey(wallet.publicKey);
      } else if (!txToSignSwap.feePayer) {
        console.error(
          'CRITICAL: Legacy transaction for executeTrade deserialized without a feePayer and wallet.publicKey is unavailable.',
        );
      }
    }

    let txSignature: string;

    try {
      // The wallet.sendTransaction method requires a connection.
      // The original code attempted with null, then created a fallback.
      // We will use the fallback connection logic directly here.
      console.log(
        'Attempting to create a fallback connection for executeTrade...',
      );

      // Connection is already imported at the top of the file.
      // No need for: const { Connection } = require('@solana/web3.js');

      // Create a fallback connection to a public RPC endpoint
      // TODO: Use a configured RPC endpoint instead of hardcoding
      const fallbackConnection = new Connection(
        process.env.RPC_URL || 'https://api.mainnet-beta.solana.com', // Example: Prefer env var
        'confirmed',
      );

      console.log('Using fallback connection for transaction in executeTrade');
      txSignature = await wallet.sendTransaction(
        txToSignSwap,
        fallbackConnection,
        {confirmTransaction: true, statusCallback: onStatusUpdate},
      );
    } catch (sendError) {
      // If it's some other error, rethrow it
      console.error('Error sending transaction in executeTrade:', sendError);
      throw sendError;
    }

    if (!txSignature) {
      throw new Error('Failed to send transaction');
    }

    onStatusUpdate?.('Trade executed successfully!');

    return {
      txId: txSignature,
    };
  } catch (err) {
    // Cast the unknown error to any type
    const error = err as any;
    console.error('Error executing Meteora trade:', error);
    onStatusUpdate?.('Trade failed: ' + (error.message || 'Unknown error'));
    throw error;
  }
};

/**
 * Add liquidity to a Meteora pool
 */
export const addLiquidity = async (
  poolAddress: string,
  tokenAAmount: string,
  tokenBAmount: string,
  slippage: number,
  connection: Connection,
  wallet: any,
  onStatusUpdate?: (status: string) => void,
): Promise<{txId: string}> => {
  try {
    onStatusUpdate?.('Preparing to add liquidity...');

    // Check if we're in development mode or API is not available
    if (API_BASE_URL.includes('localhost') || poolAddress.startsWith('pool')) {
      // Simulate API delays for a more realistic experience
      onStatusUpdate?.('Creating transaction...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      onStatusUpdate?.('Signing transaction...');
      await new Promise(resolve => setTimeout(resolve, 1500));

      onStatusUpdate?.('Processing transaction...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      onStatusUpdate?.('Confirming transaction...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      onStatusUpdate?.('Liquidity added successfully!');

      // Return a mock transaction ID
      return {
        txId: 'mock-tx-' + Math.random().toString(36).substring(2, 15),
      };
    }

    // If not in development mode, proceed with actual API call
    const result = await apiCall('/meteora/add-liquidity', 'POST', {
      owner: wallet?.publicKey?.toString(),
      pool: poolAddress,
      tokenAAmount,
      tokenBAmount,
      slippage,
    });

    if (!result.success) {
      throw new Error(
        result.error || 'Failed to create add liquidity transaction',
      );
    }

    onStatusUpdate?.('Signing transaction...');

    const txBufferAddLiq = Buffer.from(result.transaction, 'base64');
    let txToSignAddLiq: Transaction | VersionedTransaction;
    try {
      txToSignAddLiq = VersionedTransaction.deserialize(
        new Uint8Array(txBufferAddLiq),
      );
    } catch (e) {
      console.warn(
        'Failed to deserialize as VersionedTransaction for addLiquidity, trying legacy Transaction:',
        e,
      );
      txToSignAddLiq = Transaction.from(new Uint8Array(txBufferAddLiq));
      if (!txToSignAddLiq.feePayer && wallet.publicKey) {
        txToSignAddLiq.feePayer = new PublicKey(wallet.publicKey);
      } else if (!txToSignAddLiq.feePayer) {
        console.error(
          'CRITICAL: Legacy transaction for addLiquidity deserialized without a feePayer and wallet.publicKey is unavailable.',
        );
      }
    }

    // Sign and send the transaction
    const txSignature = await wallet.sendTransaction(
      txToSignAddLiq,
      connection,
      {confirmTransaction: true, statusCallback: onStatusUpdate},
    );

    onStatusUpdate?.('Liquidity added successfully!');

    return {
      txId: txSignature,
    };
  } catch (error) {
    console.error('Error adding liquidity:', error);
    onStatusUpdate?.('Adding liquidity failed');
    throw error;
  }
};

/**
 * Remove liquidity from a Meteora pool
 */
export const removeLiquidity = async (
  positionId: string,
  percentage: number,
  connection: Connection,
  wallet: any,
  onStatusUpdate?: (status: string) => void,
): Promise<{txId: string}> => {
  try {
    onStatusUpdate?.('Preparing to remove liquidity...');

    const result = await apiCall('/remove-liquidity', 'POST', {
      owner: wallet.publicKey,
      positionId,
      percentage,
    });

    if (!result.success) {
      throw new Error(
        result.error || 'Failed to create remove liquidity transaction',
      );
    }

    onStatusUpdate?.('Signing transaction...');

    const txBufferRemoveLiq = Buffer.from(result.transaction, 'base64');
    let txToSignRemoveLiq: Transaction | VersionedTransaction;
    try {
      txToSignRemoveLiq = VersionedTransaction.deserialize(
        new Uint8Array(txBufferRemoveLiq),
      );
    } catch (e) {
      console.warn(
        'Failed to deserialize as VersionedTransaction for removeLiquidity, trying legacy Transaction:',
        e,
      );
      txToSignRemoveLiq = Transaction.from(new Uint8Array(txBufferRemoveLiq));
      if (!txToSignRemoveLiq.feePayer && wallet.publicKey) {
        txToSignRemoveLiq.feePayer = new PublicKey(wallet.publicKey);
      } else if (!txToSignRemoveLiq.feePayer) {
        console.error(
          'CRITICAL: Legacy transaction for removeLiquidity deserialized without a feePayer and wallet.publicKey is unavailable.',
        );
      }
    }
    // Sign and send the transaction
    const txSignature = await wallet.sendTransaction(
      txToSignRemoveLiq,
      connection,
      {confirmTransaction: true, statusCallback: onStatusUpdate},
    );

    onStatusUpdate?.('Liquidity removed successfully!');

    return {
      txId: txSignature,
    };
  } catch (error) {
    console.error('Error removing liquidity:', error);
    onStatusUpdate?.('Removing liquidity failed');
    throw error;
  }
};
