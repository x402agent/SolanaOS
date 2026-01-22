/**
 * PumpSwap Service
 * 
 * Service layer for interacting with the Pump Swap AMM API
 */

import { PublicKey, Connection } from '@solana/web3.js';
import { 
  SwapParams as OriginalSwapParams, 
  AddLiquidityParams, 
  RemoveLiquidityParams, 
  CreatePoolParams
} from '../types';
import { TransactionService } from '../../wallet-providers/services/transaction/transactionService';
import { StandardWallet } from '../../wallet-providers/types';

// Define Direction enum locally
export enum Direction {
  QuoteToBase = 0,
  BaseToQuote = 1
}

import {SERVER_URL} from '@env';

// Modify SwapParams to accept both local Direction and SDK Direction
export interface SwapParams extends Omit<OriginalSwapParams, 'direction'> {
  direction: Direction | number;
}

const API_BASE_URL = SERVER_URL;
console.log('[pumpSwapService] Top level: API_BASE_URL =', API_BASE_URL); // Log immediately

/**
 * Create a new pool
 */
export async function createPool({
  index,
  baseMint,
  quoteMint,
  baseAmount,
  quoteAmount,
  userPublicKey,
  connection,
  solanaWallet,
  onStatusUpdate,
}: CreatePoolParams & {
  connection: Connection;
  solanaWallet: StandardWallet | any;
  onStatusUpdate?: (status: string) => void;
}): Promise<string> {
  try {
    onStatusUpdate?.('Starting pool creation process...');
    onStatusUpdate?.('Validating token addresses and amounts...');
    
    // Basic validation for display purposes
    if (!baseMint || !quoteMint) {
      throw new Error('Invalid token mint addresses');
    }
    
    if (baseAmount <= 0 || quoteAmount <= 0) {
      throw new Error('Token amounts must be greater than zero');
    }
    
    if (baseMint === quoteMint) {
      throw new Error('Base and quote tokens cannot be the same');
    }
    
    // Identify if any of the tokens are SOL, which requires special handling
    const isBaseSol = baseMint === 'So11111111111111111111111111111111111111112';
    const isQuoteSol = quoteMint === 'So11111111111111111111111111111111111111112';
    
    console.log(`Creating pool: baseMint=${baseMint} (${isBaseSol ? 'SOL' : 'SPL'}), quoteMint=${quoteMint} (${isQuoteSol ? 'SOL' : 'SPL'})`);
    console.log(`Amounts: base=${baseAmount}, quote=${quoteAmount}`);
    
    onStatusUpdate?.(`Creating pool with ${isBaseSol ? 'SOL' : 'SPL'} and ${isQuoteSol ? 'SOL' : 'SPL'}...`);
    
    onStatusUpdate?.('Requesting transaction from server...');
    
    const response = await fetch(`${API_BASE_URL}/api/pump-swap/build-create-pool`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        index,
        baseMint,
        quoteMint,
        baseAmount,
        quoteAmount,
        userPublicKey,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      const serverError = data.error || 'Failed to create pool';
      console.error('Server error:', serverError);
      
      // If server provided detailed error, show it
      if (data.details) {
        console.error('Error details:', data.details);
      }
      
      throw new Error(serverError);
    }
    
    if (!data.data || !data.data.transaction) {
      throw new Error('Server returned invalid transaction data');
    }

    onStatusUpdate?.('Transaction received. Sending to wallet for approval...');
    
    // Create a filtered status callback that prevents error messages
    const filteredCallback = (status: string) => {
      if (!status.startsWith('Error:') && !status.includes('failed:')) {
        onStatusUpdate?.(status);
      } else {
        onStatusUpdate?.('Processing transaction...');
      }
    };

    onStatusUpdate?.('Waiting for transaction approval and confirmation...');
    
    try {
      onStatusUpdate?.('Sending transaction to network...');
      console.log('Sending transaction to network...');
      
      const signature = await TransactionService.signAndSendTransaction(
        { type: 'base64', data: data.data.transaction },
        solanaWallet,
        { 
          connection,
          statusCallback: filteredCallback
        }
      );
      
      onStatusUpdate?.(`Pool created successfully! Tx: ${signature.slice(0, 8)}...${signature.slice(-8)}`);
      return signature;
    } catch (txError) {
      console.error('Transaction Error:', txError);
      
      // Log detailed error for debugging
      console.log('==== Transaction Error Details ====');
      const txErrorMsg = txError instanceof Error ? txError.message : String(txError);
      console.log('Error message:', txErrorMsg);
      
      // Check for specific error patterns to provide better feedback
      const isInsufficientFunds = 
        txErrorMsg.includes('insufficient lamports') || 
        txErrorMsg.includes('0x1') || // Custom program error code for insufficient funds
        txErrorMsg.includes('Attempt to debit an account but found no record of a prior credit');
      
      // Get transaction logs for debugging if available
      if (txError && typeof txError === 'object' && 'logs' in txError) {
        console.log('Transaction logs:', (txError as any).logs);
        
        // Check logs for insufficient funds message
        const logs = (txError as any).logs || [];
        const insufficientLamportsLog = logs.find((log: string) => log.includes('insufficient lamports'));
        if (insufficientLamportsLog) {
          // Extract the required amount from the log message if available
          const matches = insufficientLamportsLog.match(/insufficient lamports (\d+), need (\d+)/);
          if (matches && matches.length === 3) {
            const have = parseInt(matches[1], 10) / 1_000_000_000; // Convert lamports to SOL
            const need = parseInt(matches[2], 10) / 1_000_000_000; // Convert lamports to SOL
            
            const friendlyError = new Error(
              `Insufficient SOL balance for creating pool. You have ${have.toFixed(6)} SOL, but need at least ${need.toFixed(6)} SOL. ` +
              `Please add more SOL to your wallet and try again.`
            );
            onStatusUpdate?.(`Transaction failed: ${friendlyError.message}`);
            throw friendlyError;
          }
        }
      }
      
      // Provide a friendly error message for insufficient funds
      if (isInsufficientFunds) {
        const friendlyError = new Error(
          'Insufficient SOL balance for creating pool. Creating a pool requires approximately 0.03-0.05 SOL to cover the rent for all necessary accounts. ' +
          'Please add more SOL to your wallet and try again.'
        );
        onStatusUpdate?.(`Transaction failed: ${friendlyError.message}`);
        throw friendlyError;
      }
      
      throw txError;
    }
  } catch (error) {
    console.error('Error in createPool:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Don't send raw error through status update
    onStatusUpdate?.(`Transaction failed: ${errorMessage}`);
    TransactionService.showError(error);
    throw error;
  }
}

/**
 * Get deposit quote when base amount changes
 */
export async function getDepositQuoteFromBase(
  pool: string,
  baseAmount: number,
  slippage: number
): Promise<{ quote: number; lpToken: number }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/pump-swap/quote-liquidity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pool,
        baseAmount,
        slippage,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to get deposit quote');
    }

    return data.data;
  } catch (error) {
    console.error('Error in getDepositQuoteFromBase:', error);
    throw error;
  }
}

/**
 * Get deposit quote when quote amount changes
 */
export async function getDepositQuoteFromQuote(
  pool: string,
  quoteAmount: number,
  slippage: number
): Promise<{ base: number; lpToken: number }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/pump-swap/quote-liquidity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pool,
        quoteAmount,
        slippage,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to get deposit quote');
    }

    return data.data;
  } catch (error) {
    console.error('Error in getDepositQuoteFromQuote:', error);
    throw error;
  }
}

/**
 * Add liquidity to a pool
 */
export async function addLiquidity({
  pool,
  baseAmount,
  quoteAmount,
  lpTokenAmount,
  slippage,
  userPublicKey,
  connection,
  solanaWallet,
  onStatusUpdate,
}: {
  pool: string;
  baseAmount: number | null;
  quoteAmount: number | null;
  lpTokenAmount: number;
  slippage: number;
  userPublicKey: string;
  connection: Connection;
  solanaWallet: StandardWallet | any;
  onStatusUpdate?: (status: string) => void;
}): Promise<string> {
  try {
    onStatusUpdate?.('Preparing liquidity addition...');
    
    const response = await fetch(`${API_BASE_URL}/api/pump-swap/build-add-liquidity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pool,
        baseAmount,
        quoteAmount,
        lpTokenAmount,
        slippage,
        userPublicKey,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to add liquidity');
    }

    onStatusUpdate?.('Transaction received, sending to wallet...');
    
    // Create a filtered status callback that prevents error messages
    const filteredCallback = (status: string) => {
      if (!status.startsWith('Error:') && !status.includes('failed:')) {
        onStatusUpdate?.(status);
      } else {
        onStatusUpdate?.('Processing transaction...');
      }
    };

    const signature = await TransactionService.signAndSendTransaction(
      { type: 'base64', data: data.data.transaction },
      solanaWallet,
      { 
        connection,
        statusCallback: filteredCallback
      }
    );
    
    onStatusUpdate?.('Liquidity added successfully!');
    return signature;
  } catch (error) {
    console.error('Error in addLiquidity:', error);
    // Don't send raw error through status update
    onStatusUpdate?.('Transaction failed');
    TransactionService.showError(error);
    throw error;
  }
}

/**
 * Get swap quote from base to quote
 */
export async function getSwapQuoteFromBase(
  pool: string,
  baseAmount: number,
  slippage: number
): Promise<number> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/pump-swap/quote-swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pool,
        inputAmount: baseAmount,
        direction: Direction.BaseToQuote,
        slippage,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to get swap quote');
    }

    return data.data;
  } catch (error) {
    console.error('Error in getSwapQuoteFromBase:', error);
    throw error;
  }
}

/**
 * Get swap quote from quote to base
 */
export async function getSwapQuoteFromQuote(
  pool: string,
  quoteAmount: number,
  slippage: number
): Promise<number> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/pump-swap/quote-swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pool,
        inputAmount: quoteAmount,
        direction: Direction.QuoteToBase,
        slippage,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to get swap quote');
    }

    return data.data;
  } catch (error) {
    console.error('Error in getSwapQuoteFromQuote:', error);
    throw error;
  }
}

/**
 * Perform a token swap
 */
export async function swapTokens({
  pool,
  amount,
  direction,
  slippage,
  userPublicKey,
  connection,
  solanaWallet,
  onStatusUpdate,
}: SwapParams & {
  connection: Connection;
  // Make this more flexible to accept any wallet that can be used with TransactionService
  solanaWallet: StandardWallet | { 
    signAndSendTransaction?: (transaction: any) => Promise<string>;
    request?: (args: { method: string; params: any }) => Promise<any>;
  } | any;
  onStatusUpdate?: (status: string) => void;
}): Promise<string> {
  console.log('[pumpSwapService] --- Entered swapTokens ---');
  console.log('[pumpSwapService] API_BASE_URL:', API_BASE_URL);
  
  try {
    console.log('[pumpSwapService] Step 1: Calling onStatusUpdate');
    onStatusUpdate?.('Preparing swap transaction...');
    
    console.log('[pumpSwapService] Step 2: Preparing request body');
    
    // Convert PublicKey to string if needed
    const userPubkeyString = typeof userPublicKey === 'string' 
      ? userPublicKey 
      : userPublicKey.toString();
    
    console.log('[pumpSwapService] User public key:', userPubkeyString);
    
    const requestBodyPayload = {
      pool,
      inputAmount: amount,
      direction,
      slippage,
      userPublicKey: userPubkeyString
    };
    
    console.log('[pumpSwapService] Step 3: Request payload:', JSON.stringify(requestBodyPayload, null, 2));
    
    try {
      console.log('[pumpSwapService] Step 4: Making API request to:', `${API_BASE_URL}/api/pump-swap/build-swap`);
      const response = await fetch(`${API_BASE_URL}/api/pump-swap/build-swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBodyPayload),
      });
      
      console.log('[pumpSwapService] Step 5: API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[pumpSwapService] API error response:', errorText);
        throw new Error(`Server responded with status ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[pumpSwapService] Step 6: API response received (success =', data.success, ')');
      
      if (!data.success) {
        console.error('[pumpSwapService] API reported failure:', data.error);
        throw new Error(data.error || 'Failed to perform swap');
      }
      
      if (!data.data || !data.data.transaction) {
        console.error('[pumpSwapService] Missing transaction data in response');
        throw new Error('Server returned invalid transaction data');
      }
      
      console.log('[pumpSwapService] Step 7: Received transaction from server, sending to wallet...');
      onStatusUpdate?.('Transaction received, sending to wallet...');
      
      // Create a filtered status callback that prevents error messages
      const filteredCallback = (status: string) => {
        console.log('[pumpSwapService] Transaction status update:', status);
        if (!status.startsWith('Error:') && !status.includes('failed:')) {
          onStatusUpdate?.(status);
        } else {
          console.error('[pumpSwapService] Error status received but filtered from UI:', status);
          onStatusUpdate?.('Processing transaction...');
        }
      };
      
      console.log('[pumpSwapService] Step 8: Calling TransactionService.signAndSendTransaction');
      const signature = await TransactionService.signAndSendTransaction(
        { type: 'base64', data: data.data.transaction },
        solanaWallet,
        { 
          connection,
          statusCallback: filteredCallback
        }
      );
      
      console.log('[pumpSwapService] Step 9: Transaction signature received:', signature);
      onStatusUpdate?.('Swap completed successfully!');
      return signature;
    } catch (fetchError) {
      console.error('[pumpSwapService] Fetch error caught:', fetchError);
      if (fetchError instanceof Error) {
        console.error('[pumpSwapService] Fetch Error Name:', fetchError.name);
        console.error('[pumpSwapService] Fetch Error Message:', fetchError.message);
        if (fetchError.stack) {
          console.error('[pumpSwapService] Fetch Error Stack:', fetchError.stack);
        }
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[pumpSwapService] Error caught in swapTokens:', error);
    if (error instanceof Error) {
      console.error('[pumpSwapService] Error Name:', error.name);
      console.error('[pumpSwapService] Error Message:', error.message);
      if (error.stack) {
        console.error('[pumpSwapService] Error Stack:', error.stack);
      }
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    onStatusUpdate?.(`Transaction failed: ${errorMessage}`);
    throw error;
  }
}

/**
 * Get withdrawal quote
 */
export async function getWithdrawalQuote(
  pool: string,
  lpTokenAmount: number,
  slippage: number
): Promise<{ base: number; quote: number }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/pump-swap/quote-liquidity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pool,
        lpTokenAmount,
        slippage,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to get withdrawal quote');
    }

    return data.data;
  } catch (error) {
    console.error('Error in getWithdrawalQuote:', error);
    throw error;
  }
}

/**
 * Remove liquidity from a pool
 */
export async function removeLiquidity({
  pool,
  lpTokenAmount,
  slippage,
  userPublicKey,
  connection,
  solanaWallet,
  onStatusUpdate,
}: RemoveLiquidityParams & {
  connection: Connection;
  solanaWallet: StandardWallet | any;
  onStatusUpdate?: (status: string) => void;
}): Promise<string> {
  try {
    onStatusUpdate?.('Preparing liquidity removal...');
    
    const response = await fetch(`${API_BASE_URL}/api/pump-swap/build-remove-liquidity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pool,
        lpTokenAmount,
        slippage,
        userPublicKey,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to remove liquidity');
    }

    onStatusUpdate?.('Transaction received, sending to wallet...');
    
    // Create a filtered status callback that prevents error messages
    const filteredCallback = (status: string) => {
      if (!status.startsWith('Error:') && !status.includes('failed:')) {
        onStatusUpdate?.(status);
      } else {
        onStatusUpdate?.('Processing transaction...');
      }
    };

    const signature = await TransactionService.signAndSendTransaction(
      { type: 'base64', data: data.data.transaction },
      solanaWallet,
      { 
        connection,
        statusCallback: filteredCallback
      }
    );
    
    onStatusUpdate?.('Liquidity removed successfully!');
    return signature;
  } catch (error) {
    console.error('Error in removeLiquidity:', error);
    // Don't send raw error through status update
    onStatusUpdate?.('Transaction failed');
    TransactionService.showError(error);
    throw error;
  }
}

/**
 * Returns the PumpSwap AMM SDK instance
 * This function provides access to the PumpSwap AMM functionality
 */
export function getPumpAmmSdk() {
  return {
    createPool,
    addLiquidity,
    removeLiquidity,
    swapTokens,
    getDepositQuoteFromBase,
    getDepositQuoteFromQuote,
    getSwapQuoteFromBase,
    getSwapQuoteFromQuote,
    getWithdrawalQuote
  };
}

/**
 * Get swap quote based on specified parameters
 */
export function getSwapQuote(
  pool: string, 
  amount: number, 
  direction: Direction, 
  slippage: number
): Promise<number> {
  return direction === Direction.BaseToQuote 
    ? getSwapQuoteFromBase(pool, amount, slippage)
    : getSwapQuoteFromQuote(pool, amount, slippage);
}

/**
 * Get liquidity quote based on specified parameters
 */
export function getLiquidityQuote(
  pool: string,
  baseAmount: number | null,
  quoteAmount: number | null,
  slippage: number
): Promise<{ base?: number; quote?: number; lpToken: number }> {
  if (baseAmount !== null) {
    return getDepositQuoteFromBase(pool, baseAmount, slippage)
      .then(result => ({ quote: result.quote, lpToken: result.lpToken }));
  } else if (quoteAmount !== null) {
    return getDepositQuoteFromQuote(pool, quoteAmount, slippage)
      .then(result => ({ base: result.base, lpToken: result.lpToken }));
  }
  
  throw new Error('Either baseAmount or quoteAmount must be provided');
} 