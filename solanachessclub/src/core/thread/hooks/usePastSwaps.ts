import { useState, useCallback, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import {
  EnhancedSwapTransaction,
  BirdeyeSwapTransaction,
  BirdeyeSwapResponse,
} from '../components/trade/ShareTradeModal.types';
import { BIRDEYE_API_KEY } from '@env';

/**
 * Validates a converted swap transaction
 */
const validateSwapTransaction = (swap: EnhancedSwapTransaction): boolean => {
  try {
    // Check basic structure
    if (!swap || typeof swap !== 'object') {
      console.warn('[validateSwapTransaction] Invalid swap object');
      return false;
    }

    // Check required fields
    if (!swap.signature || typeof swap.signature !== 'string') {
      console.warn('[validateSwapTransaction] Invalid signature');
      return false;
    }

    if (!swap.timestamp || typeof swap.timestamp !== 'number') {
      console.warn('[validateSwapTransaction] Invalid timestamp');
      return false;
    }

    // Check token data
    if (!swap.inputToken || !swap.outputToken) {
      console.warn('[validateSwapTransaction] Missing token data');
      return false;
    }

    // Check token mints
    if (!swap.inputToken.mint || !swap.outputToken.mint) {
      console.warn('[validateSwapTransaction] Missing token mint addresses');
      return false;
    }

    // Check token amounts
    if (typeof swap.inputToken.amount !== 'number' || typeof swap.outputToken.amount !== 'number') {
      console.warn('[validateSwapTransaction] Invalid token amounts');
      return false;
    }

    if (swap.inputToken.amount <= 0 || swap.outputToken.amount <= 0) {
      console.warn('[validateSwapTransaction] Token amounts must be positive');
      return false;
    }

    // Check decimals
    if (typeof swap.inputToken.decimals !== 'number' || typeof swap.outputToken.decimals !== 'number') {
      console.warn('[validateSwapTransaction] Invalid token decimals');
      return false;
    }

    if (swap.inputToken.decimals < 0 || swap.outputToken.decimals < 0) {
      console.warn('[validateSwapTransaction] Token decimals must be non-negative');
      return false;
    }

    return true;
  } catch (error) {
    console.error('[validateSwapTransaction] Validation error:', error);
    return false;
  }
};

/**
 * Converts a Birdeye swap transaction to our app's SwapTransaction format.
 */
const convertBirdeyeToSwapTransaction = (
  birdeyeSwap: BirdeyeSwapTransaction,
  index: number
): EnhancedSwapTransaction => {
  let inputToken, outputToken;

  if (birdeyeSwap.base.type_swap === 'from') {
    inputToken = birdeyeSwap.base;
    outputToken = birdeyeSwap.quote;
  } else if (birdeyeSwap.quote.type_swap === 'from') {
    inputToken = birdeyeSwap.quote;
    outputToken = birdeyeSwap.base;
  } else {
    if (birdeyeSwap.base.ui_change_amount < 0) {
      inputToken = birdeyeSwap.base;
      outputToken = birdeyeSwap.quote;
    } else {
      inputToken = birdeyeSwap.quote;
      outputToken = birdeyeSwap.base;
    }
  }

  if (!inputToken || !outputToken || !inputToken.address || !outputToken.address) {
    console.warn('[convertBirdeyeToSwapTransaction] Invalid token data:', birdeyeSwap);
    throw new Error('Invalid token data in swap transaction');
  }

  const inputAmount = Math.abs(parseInt(inputToken.amount, 10));
  const outputAmount = Math.abs(parseInt(outputToken.amount, 10));

  if (isNaN(inputAmount) || isNaN(outputAmount) || inputAmount <= 0 || outputAmount <= 0) {
    console.warn('[convertBirdeyeToSwapTransaction] Invalid amounts:', { inputAmount, outputAmount, birdeyeSwap });
    throw new Error('Invalid token amounts in swap transaction');
  }

  const convertedSwap: EnhancedSwapTransaction = {
    signature: birdeyeSwap.tx_hash,
    timestamp: birdeyeSwap.block_unix_time,
    inputToken: {
      mint: inputToken.address,
      symbol: inputToken.symbol || 'Unknown',
      name: inputToken.symbol || 'Unknown Token',
      decimals: inputToken.decimals || 0,
      amount: inputAmount,
    },
    outputToken: {
      mint: outputToken.address,
      symbol: outputToken.symbol || 'Unknown',
      name: outputToken.symbol || 'Unknown Token',
      decimals: outputToken.decimals || 0,
      amount: outputAmount,
    },
    success: true, // Birdeye only returns successful transactions
    volumeUsd: birdeyeSwap.volume_usd || 0,
    uniqueId: `${birdeyeSwap.tx_hash}-${birdeyeSwap.ins_index || 0}-${birdeyeSwap.inner_ins_index || 0}-${index}`,
  };

  // Validate the converted swap
  if (!validateSwapTransaction(convertedSwap)) {
    throw new Error('Converted swap failed validation');
  }

  return convertedSwap;
};

/**
 * Fetches swap transactions using Birdeye API.
 */
const fetchSwapsWithBirdeyeInternal = async (
  ownerAddress: string
): Promise<EnhancedSwapTransaction[]> => {
  if (!ownerAddress) {
    throw new Error('Wallet address is required');
  }

  if (!BIRDEYE_API_KEY) {
    console.error('[usePastSwaps] Birdeye API key is missing');
    throw new Error('Birdeye API key is missing. Please check your environment variables.');
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const daysToFetch = 28;
    const startTime = now - daysToFetch * 24 * 60 * 60;

    const url = `https://public-api.birdeye.so/defi/v3/txs?offset=0&limit=50&sort_by=block_unix_time&sort_type=desc&tx_type=swap&owner=${ownerAddress}&after_time=${startTime}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-chain': 'solana',
        'x-api-key': BIRDEYE_API_KEY,
      },
    });

    if (!response.ok) {
      console.error(`[usePastSwaps] Birdeye API error: ${response.status} ${response.statusText}`);
      const errorBody = await response.text();
      console.error(`[usePastSwaps] Birdeye API error body: ${errorBody}`);
      throw new Error(`Birdeye API error: ${response.status} ${response.statusText}`);
    }

    const result: BirdeyeSwapResponse = await response.json();

    if (!result.data || !result.data.items || !Array.isArray(result.data.items)) {
      console.warn('[usePastSwaps] No swap data found in response');
      return [];
    }

    // Convert and filter valid transactions
    const convertedSwaps: EnhancedSwapTransaction[] = [];
    
    result.data.items.forEach((item, index) => {
      try {
        const converted = convertBirdeyeToSwapTransaction(item, index);
        convertedSwaps.push(converted);
      } catch (error) {
        console.warn(`[usePastSwaps] Failed to convert swap ${index}:`, error);
        // Continue with other swaps instead of failing entirely
      }
    });

    return convertedSwaps;

  } catch (error) {
    console.error('[usePastSwaps] Error fetching swaps from Birdeye:', error);
    throw error;
  }
};

/**
 * Groups related swaps by timestamp and transaction to show first input → last output
 */
const groupRelatedSwapsInternal = (
  swaps: EnhancedSwapTransaction[]
): EnhancedSwapTransaction[] => {
  if (!swaps.length) return [];

  // Group by transaction hash and timestamp (within 10 seconds)
  const groups = new Map<string, EnhancedSwapTransaction[]>();
  const TIME_WINDOW = 10; // seconds

  swaps.forEach(swap => {
    // Create a group key based on transaction hash or timestamp window
    let groupKey = swap.signature;
    
    // If same transaction, group together
    if (groups.has(groupKey)) {
      groups.get(groupKey)!.push(swap);
      return;
    }

    // Check if this swap should be grouped with nearby swaps (same timestamp window)
    let foundGroup = false;
    for (const [existingKey, existingGroup] of groups.entries()) {
      const timeDiff = Math.abs(swap.timestamp - existingGroup[0].timestamp);
      if (timeDiff <= TIME_WINDOW) {
        // Add to existing group
        existingGroup.push(swap);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      groups.set(groupKey, [swap]);
    }
  });

  const groupedSwaps: EnhancedSwapTransaction[] = [];

  groups.forEach((groupSwaps, groupKey) => {
    if (groupSwaps.length === 1) {
      // Single swap - add as is
      groupedSwaps.push(groupSwaps[0]);
    } else {
      // Multi-hop swap - find first input and last output
      // Sort by instruction index and inner instruction index to get correct order
      const sortedSwaps = groupSwaps.sort((a, b) => {
        // Extract instruction indices from uniqueId
        const aIndices = a.uniqueId?.split('-');
        const bIndices = b.uniqueId?.split('-');
        
        if (aIndices && bIndices && aIndices.length >= 3 && bIndices.length >= 3) {
          const aInsIndex = parseInt(aIndices[1]) || 0;
          const bInsIndex = parseInt(bIndices[1]) || 0;
          const aInnerIndex = parseInt(aIndices[2]) || 0;
          const bInnerIndex = parseInt(bIndices[2]) || 0;
          
          if (aInsIndex !== bInsIndex) {
            return aInsIndex - bInsIndex;
          }
          return aInnerIndex - bInnerIndex;
        }
        
        // Fallback to timestamp
        return a.timestamp - b.timestamp;
      });

      const firstSwap = sortedSwaps[0];
      const lastSwap = sortedSwaps[sortedSwaps.length - 1];

      // Create combined swap showing first input → last output
      const combinedSwap: EnhancedSwapTransaction = {
        ...firstSwap,
        outputToken: lastSwap.outputToken, // Use last output token
        uniqueId: `${firstSwap.uniqueId}-combined`,
        isMultiHop: true,
        hopCount: sortedSwaps.length,
        childTransactions: sortedSwaps,
        volumeUsd: sortedSwaps.reduce((sum, swap) => sum + (swap.volumeUsd || 0), 0) / sortedSwaps.length, // Average volume
      };

      groupedSwaps.push(combinedSwap);
    }
  });

  // Sort by timestamp (newest first)
  const finalSwaps = groupedSwaps.sort((a, b) => b.timestamp - a.timestamp);
  
  return finalSwaps;
};

interface UsePastSwapsProps {
  walletAddress: string | null;
  visible: boolean; // To trigger initial fetch when modal becomes visible
}

export function usePastSwaps({ walletAddress, visible }: UsePastSwapsProps) {
  const [swaps, setSwaps] = useState<EnhancedSwapTransaction[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const isRefreshingRef = useRef(false);
  const hasLoadedInitialDataRef = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchAndProcessSwaps = useCallback(async (isForceRefresh = false) => {
    if (!isMounted.current) return;
    setApiError(null);

    if (!walletAddress) {
      setInitialLoading(false);
      setRefreshing(false);
      setApiError("Please connect your wallet to view your swap history");
      return;
    }

    if (!BIRDEYE_API_KEY) {
      console.error('[usePastSwaps] BIRDEYE_API_KEY is missing');
      setInitialLoading(false);
      setRefreshing(false);
      setApiError("API configuration error. Please contact support.");
      return;
    }

    if (isRefreshingRef.current && !isForceRefresh) {
      return;
    }

    isRefreshingRef.current = true;
    
    if (!hasLoadedInitialDataRef.current && !isForceRefresh) {
      setInitialLoading(true);
      setRefreshing(false);
    } else {
      setRefreshing(true);
      setInitialLoading(false);
    }

    try {
      const birdeyeSwaps = await fetchSwapsWithBirdeyeInternal(walletAddress);
      const groupedSwaps = groupRelatedSwapsInternal(birdeyeSwaps);
      
      if (isMounted.current) {
        setSwaps(groupedSwaps);
      }
    } catch (err: any) {
      console.error('[usePastSwaps] Error fetching past swaps:', err);
      if (isMounted.current) {
        setApiError(err.message || "Failed to fetch swap history");
        if (swaps.length === 0) {
          Alert.alert(
            "Error Loading Swaps",
            "There was a problem loading your swap history. Please try again later."
          );
        }
      }
    } finally {
      if (isMounted.current) {
        setRefreshing(false);
        setInitialLoading(false);
      }
      isRefreshingRef.current = false;
      hasLoadedInitialDataRef.current = true;
    }
  }, [walletAddress, swaps.length]);

  useEffect(() => {
    if (visible && walletAddress && !hasLoadedInitialDataRef.current) {
      fetchAndProcessSwaps();
    }
  }, [visible, walletAddress, fetchAndProcessSwaps]);

  useEffect(() => {
    if (visible && !hasLoadedInitialDataRef.current) {
      setInitialLoading(true);
    }
  }, [visible]);

  const refreshSwaps = useCallback(() => {
    if (!walletAddress) {
      return;
    }
    fetchAndProcessSwaps(true);
  }, [walletAddress, fetchAndProcessSwaps]);

  return {
    swaps,
    initialLoading,
    refreshing,
    apiError,
    refreshSwaps,
    setSwaps,
    setApiError
  };
} 