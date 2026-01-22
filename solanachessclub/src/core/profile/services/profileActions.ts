/**
 * File: src/services/profileActions.ts
 *
 * Service for fetching and handling profile actions/transactions.
 */

import { HELIUS_API_KEY, HELIUS_STAKED_API_KEY } from '@env';
import { createAsyncThunk } from '@reduxjs/toolkit';
import { Action, TokenTransfer, SwapEvent } from '../types/index';

/**
 * Redux thunk for fetching wallet actions
 */
export const fetchWalletActionsAsync = createAsyncThunk(
  'profile/fetchWalletActions',
  async (walletAddress: string, { rejectWithValue }) => {
    if (!walletAddress) {
      return rejectWithValue('Wallet address is required');
    }

    const heliusApiKey = HELIUS_STAKED_API_KEY || HELIUS_API_KEY;
    if (!heliusApiKey) {
      return rejectWithValue('Helius API key is not configured');
    }

    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Fetching actions for wallet: ${walletAddress} (attempt ${attempt}/${maxRetries})`);
        const heliusUrl = `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${heliusApiKey}&limit=20`;

        const controller = new AbortController();
        // Increase timeout to 30 seconds
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
          const res = await fetch(heliusUrl, { 
            signal: controller.signal,
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          clearTimeout(timeoutId);

          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Helius API error: ${res.status} - ${errorText}`);
          }

          const data = await res.json();
          console.log(`Data received successfully, items: ${data?.length || 0}`);
          
          // Enrich the data with better formatted information
          const enrichedData = await enrichActionTransactions(data, walletAddress);
          return enrichedData || [];
        } catch (err: any) {
          clearTimeout(timeoutId);
          if (err.name === 'AbortError') {
            throw new Error(`Request timed out after 30 seconds (attempt ${attempt}/${maxRetries})`);
          }
          throw err;
        }
      } catch (err: any) {
        lastError = err;
        console.error(`Attempt ${attempt} failed:`, err.message);
        
        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          return rejectWithValue(err.message || 'Failed to fetch actions after multiple attempts');
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    return rejectWithValue(lastError?.message || 'Failed to fetch actions');
  }
);

/**
 * Fetch recent blockchain actions for a wallet
 * 
 * @param walletAddress The wallet address to fetch actions for
 * @param limit Number of actions to fetch (default 20)
 * @returns Array of action objects
 */
export const fetchWalletActions = async (walletAddress: string, limit: number = 20) => {
  if (!walletAddress) {
    throw new Error('Wallet address is required');
  }

  try {
    console.log('Fetching actions for wallet:', walletAddress);
    const heliusUrl = `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(heliusUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Helius fetch failed with status ${res.status}`);
    }

    const data = await res.json();
    console.log('Data received, items:', data?.length || 0);
    
    // Enrich the data with better formatted information
    const enrichedData = await enrichActionTransactions(data, walletAddress);
    return enrichedData || [];
  } catch (err: any) {
    console.error('Error fetching actions:', err.message);
    throw new Error(err.message || 'Failed to fetch actions');
  }
}; 

/**
 * Enrich transaction data with more usable information
 */
export const enrichActionTransactions = async (actions: Action[], walletAddress: string) => {
  if (!actions || actions.length === 0) return [];
  
  return actions.map(action => {
    // Determine transaction type with more specificity
    let enrichedType = action.type || action.transactionType || 'UNKNOWN';
    
    // Process swap transactions
    if (action.events?.swap) {
      enrichedType = 'SWAP';
      
      // Extract swap details if available
      const swap = action.events.swap as SwapEvent;
      const hasTokenInputs = swap.tokenInputs && swap.tokenInputs.length > 0;
      const hasTokenOutputs = swap.tokenOutputs && swap.tokenOutputs.length > 0;
      
      if (hasTokenInputs && hasTokenOutputs && swap.tokenInputs && swap.tokenOutputs) {
        // Extract token symbols if available
        const inputToken = swap.tokenInputs[0];
        const outputToken = swap.tokenOutputs[0];
        
        const inputAmount = inputToken.rawTokenAmount?.tokenAmount 
          ? parseFloat(inputToken.rawTokenAmount.tokenAmount) / Math.pow(10, inputToken.rawTokenAmount.decimals || 0)
          : 0;
          
        const outputAmount = outputToken.rawTokenAmount?.tokenAmount
          ? parseFloat(outputToken.rawTokenAmount.tokenAmount) / Math.pow(10, outputToken.rawTokenAmount.decimals || 0)
          : 0;
          
        // Add enriched info
        action.enrichedData = {
          swapType: 'TOKEN_TO_TOKEN',
          inputSymbol: truncateAddress(inputToken.mint),
          outputSymbol: truncateAddress(outputToken.mint),
          inputAmount,
          outputAmount,
          direction: inputToken.userAccount === walletAddress ? 'OUT' : 'IN'
        };
      } else if (swap.nativeInput && hasTokenOutputs && swap.tokenOutputs) {
        // SOL to token swap
        const outputToken = swap.tokenOutputs[0];
        const outputAmount = outputToken.rawTokenAmount?.tokenAmount
          ? parseFloat(outputToken.rawTokenAmount.tokenAmount) / Math.pow(10, outputToken.rawTokenAmount.decimals || 0)
          : 0;
          
        const nativeAmount = typeof swap.nativeInput.amount === 'string' 
          ? parseFloat(swap.nativeInput.amount) 
          : swap.nativeInput.amount;
          
        action.enrichedData = {
          swapType: 'SOL_TO_TOKEN',
          inputSymbol: 'SOL',
          outputSymbol: truncateAddress(outputToken.mint),
          inputAmount: nativeAmount / 1_000_000_000, // lamports to SOL
          outputAmount,
          direction: swap.nativeInput.account === walletAddress ? 'OUT' : 'IN'
        };
      } else if (hasTokenInputs && swap.nativeOutput && swap.tokenInputs) {
        // Token to SOL swap
        const inputToken = swap.tokenInputs[0];
        const inputAmount = inputToken.rawTokenAmount?.tokenAmount
          ? parseFloat(inputToken.rawTokenAmount.tokenAmount) / Math.pow(10, inputToken.rawTokenAmount.decimals || 0)
          : 0;
          
        const nativeAmount = typeof swap.nativeOutput.amount === 'string' 
          ? parseFloat(swap.nativeOutput.amount) 
          : swap.nativeOutput.amount;
          
        action.enrichedData = {
          swapType: 'TOKEN_TO_SOL',
          inputSymbol: truncateAddress(inputToken.mint),
          outputSymbol: 'SOL',
          inputAmount,
          outputAmount: nativeAmount / 1_000_000_000, // lamports to SOL
          direction: inputToken.userAccount === walletAddress ? 'OUT' : 'IN'
        };
      }
    }
    
    // Process transfer transactions
    else if (action.nativeTransfers && action.nativeTransfers.length > 0) {
      enrichedType = 'TRANSFER';
      const transfer = action.nativeTransfers[0];
      
      action.enrichedData = {
        transferType: 'SOL',
        amount: transfer.amount / 1_000_000_000, // lamports to SOL
        direction: transfer.fromUserAccount === walletAddress ? 'OUT' : 'IN',
        counterparty: transfer.fromUserAccount === walletAddress 
          ? truncateAddress(transfer.toUserAccount)
          : truncateAddress(transfer.fromUserAccount)
      };
    }
    
    // Process token transfers
    else if (action.tokenTransfers && action.tokenTransfers.length > 0) {
      enrichedType = 'TOKEN_TRANSFER';
      const transfer = action.tokenTransfers[0] as TokenTransfer;
      
      action.enrichedData = {
        transferType: 'TOKEN',
        tokenSymbol: transfer.symbol || truncateAddress(transfer.mint),
        amount: transfer.tokenAmount,
        direction: transfer.fromUserAccount === walletAddress ? 'OUT' : 'IN',
        counterparty: transfer.fromUserAccount === walletAddress 
          ? truncateAddress(transfer.toUserAccount)
          : truncateAddress(transfer.fromUserAccount),
        decimals: transfer.decimals || 0
      };
    }
    
    return {
      ...action,
      enrichedType
    };
  });
};

/**
 * Helper to truncate addresses for display
 */
function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return address.slice(0, 4) + '...' + address.slice(-4);
} 