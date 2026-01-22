import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { HELIUS_API_KEY, HELIUS_STAKED_API_KEY } from '@env';
import { fetchWalletActionsAsync } from '@/core/profile/services/profileActions';
import { Action } from '@/core/profile/types/index';

interface ProfileState {
  actions: {
    data: Record<string, Action[]>; // Indexed by wallet address - using full Action type
    loading: Record<string, boolean>;
    error: Record<string, string | null>;
    // Track last fetch time to prevent unnecessary fetches
    lastFetched: Record<string, number>;
    // Track if this wallet had zero actions (avoid repeated fetches for new wallets)
    emptyWallets: Record<string, boolean>;
  };
}

const initialState: ProfileState = {
  actions: {
    data: {},
    loading: {},
    error: {},
    lastFetched: {},
    emptyWallets: {},
  },
};

// New thunk with cache logic to prevent unnecessary API calls
export const fetchWalletActionsWithCache = createAsyncThunk(
  'profile/fetchWalletActionsWithCache',
  async (payload: { walletAddress: string; forceRefresh?: boolean }, { getState, rejectWithValue }) => {
    const { walletAddress, forceRefresh = false } = payload;
    
    if (!walletAddress) {
      return rejectWithValue('Wallet address is required');
    }

    // Get current state
    const state = getState() as { profile: ProfileState };
    const lastFetched = state.profile.actions.lastFetched[walletAddress] || 0;
    const currentTime = Date.now();
    
    // Skip fetch if this wallet is known to be empty (no transactions) and it was checked recently
    // Use a longer cache time (5 minutes) for empty wallets to reduce API load
    const isEmptyWallet = state.profile.actions.emptyWallets[walletAddress];
    const emptyWalletCacheTime = 5 * 60 * 1000; // 5 minutes for empty wallets
    const standardCacheTime = 60 * 1000; // 1 minute for wallets with transactions
    
    // Determine which cache time to use
    const cacheTime = isEmptyWallet ? emptyWalletCacheTime : standardCacheTime;
    
    // Skip fetch if within cache time unless force refresh
    const dataExists = !!state.profile.actions.data[walletAddress]?.length;
    const isFresh = currentTime - lastFetched < cacheTime;
    
    if ((dataExists || isEmptyWallet) && isFresh && !forceRefresh) {
      // Return existing data (or empty array for empty wallets) to avoid unnecessary fetch
      return [...(state.profile.actions.data[walletAddress] || [])];
    }
    
    // Otherwise proceed with the fetch
    try {
      // Direct call to profile service to avoid thunk inside thunk issues
      const heliusApiKey = HELIUS_STAKED_API_KEY || HELIUS_API_KEY;
      const heliusUrl = `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${heliusApiKey}&limit=20`;
      const res = await fetch(heliusUrl);
      if (!res.ok) {
        throw new Error(`Helius fetch failed with status ${res.status}`);
      }
      const data = await res.json();
      
      // Use the full actions data
      const enrichedData = await enrichActionTransactions(data, walletAddress);
      return enrichedData || [];
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch wallet actions');
    }
  }
);

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
      const swap = action.events.swap;
      const hasTokenInputs = swap.tokenInputs && swap.tokenInputs.length > 0;
      const hasTokenOutputs = swap.tokenOutputs && swap.tokenOutputs.length > 0;
      
      if (hasTokenInputs && hasTokenOutputs) {
        // Extract token symbols if available
        const inputToken = swap.tokenInputs![0];
        const outputToken = swap.tokenOutputs![0];
        
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
      } else if (swap.nativeInput && hasTokenOutputs) {
        // SOL to token swap
        const outputToken = swap.tokenOutputs![0];
        const outputAmount = outputToken.rawTokenAmount?.tokenAmount
          ? parseFloat(outputToken.rawTokenAmount.tokenAmount) / Math.pow(10, outputToken.rawTokenAmount.decimals || 0)
          : 0;
          
        action.enrichedData = {
          swapType: 'SOL_TO_TOKEN',
          inputSymbol: 'SOL',
          outputSymbol: truncateAddress(outputToken.mint),
          inputAmount: Number(swap.nativeInput.amount) / 1_000_000_000, // lamports to SOL
          outputAmount,
          direction: swap.nativeInput.account === walletAddress ? 'OUT' : 'IN'
        };
      } else if (hasTokenInputs && swap.nativeOutput) {
        // Token to SOL swap
        const inputToken = swap.tokenInputs![0];
        const inputAmount = inputToken.rawTokenAmount?.tokenAmount
          ? parseFloat(inputToken.rawTokenAmount.tokenAmount) / Math.pow(10, inputToken.rawTokenAmount.decimals || 0)
          : 0;
          
        action.enrichedData = {
          swapType: 'TOKEN_TO_SOL',
          inputSymbol: truncateAddress(inputToken.mint),
          outputSymbol: 'SOL',
          inputAmount,
          outputAmount: Number(swap.nativeOutput.amount) / 1_000_000_000, // lamports to SOL
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
      const transfer = action.tokenTransfers[0];
      
      action.enrichedData = {
        transferType: 'TOKEN',
        tokenSymbol: transfer.symbol || truncateAddress(transfer.mint),
        amount: transfer.tokenAmount,
        direction: transfer.fromUserAccount === walletAddress ? 'OUT' : 'IN',
        counterparty: transfer.fromUserAccount === walletAddress 
          ? truncateAddress(transfer.toUserAccount)
          : truncateAddress(transfer.fromUserAccount)
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

/**
 * Profile slice for Redux store - manages profile-related data like actions
 */
const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    // Manually clear the actions cache for a wallet
    clearActionsCache: (state, action: PayloadAction<string>) => {
      const walletAddress = action.payload;
      state.actions.lastFetched[walletAddress] = 0;
    },
    
    // Clear errors for better UI recovery
    clearActionErrors: (state, action: PayloadAction<string>) => {
      const walletAddress = action.payload;
      state.actions.error[walletAddress] = null;
    },

    // Clean up old data to prevent state bloat
    pruneOldActionData: (state) => {
      const currentTime = Date.now();
      // Remove data older than 5 minutes
      const expiryTime = 5 * 60 * 1000; 
      
      Object.keys(state.actions.lastFetched).forEach(walletAddress => {
        if (currentTime - state.actions.lastFetched[walletAddress] > expiryTime) {
          delete state.actions.data[walletAddress];
          delete state.actions.lastFetched[walletAddress];
          delete state.actions.loading[walletAddress];
          delete state.actions.error[walletAddress];
        }
      });
    }
  },
  extraReducers: (builder) => {
    // Regular fetch wallet actions
    builder.addCase(fetchWalletActionsAsync.pending, (state, action) => {
      const walletAddress = action.meta.arg;
      state.actions.loading[walletAddress] = true;
      state.actions.error[walletAddress] = null;
    });
    
    builder.addCase(fetchWalletActionsAsync.fulfilled, (state, action) => {
      const walletAddress = action.meta.arg;
      // Store full action data
      state.actions.data[walletAddress] = action.payload;
      state.actions.loading[walletAddress] = false;
      // Update last fetched time
      state.actions.lastFetched[walletAddress] = Date.now();
    });
    
    builder.addCase(fetchWalletActionsAsync.rejected, (state, action) => {
      const walletAddress = action.meta.arg;
      state.actions.loading[walletAddress] = false;
      state.actions.error[walletAddress] = action.error.message || 'Failed to fetch wallet actions';
    });
    
    // Cache-aware fetch wallet actions
    builder.addCase(fetchWalletActionsWithCache.pending, (state, action) => {
      const walletAddress = action.meta.arg.walletAddress;
      state.actions.loading[walletAddress] = true;
      state.actions.error[walletAddress] = null;
    });
    
    builder.addCase(fetchWalletActionsWithCache.fulfilled, (state, action) => {
      const walletAddress = action.meta.arg.walletAddress;
      // Only update if we actually got new data from the API
      // This check prevents unnecessary state updates when using cached data
      if (!arraysEqual(action.payload, state.actions.data[walletAddress] || [])) {
        state.actions.data[walletAddress] = action.payload;
      }
      state.actions.loading[walletAddress] = false;
      state.actions.lastFetched[walletAddress] = Date.now();
      
      // Mark this wallet as empty if it has no actions (for better caching)
      state.actions.emptyWallets[walletAddress] = action.payload.length === 0;
    });
    
    builder.addCase(fetchWalletActionsWithCache.rejected, (state, action) => {
      const walletAddress = action.meta.arg.walletAddress;
      state.actions.loading[walletAddress] = false;
      state.actions.error[walletAddress] = action.error.message || 'Failed to fetch wallet actions';
    });
  },
});

// Helper function to compare arrays before updating state
// This helps prevent unnecessary re-renders when data hasn't changed
function arraysEqual(a: Action[], b: Action[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  
  // Compare by signature or other unique identifier
  for (let i = 0; i < a.length; i++) {
    if (a[i].signature !== b[i].signature) {
      return false;
    }
  }
  
  return true;
}

// Export actions
export const { clearActionsCache, clearActionErrors, pruneOldActionData } = profileSlice.actions;

export default profileSlice.reducer; 