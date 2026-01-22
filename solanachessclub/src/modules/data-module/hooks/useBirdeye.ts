import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { fetchPriceHistory, getBirdeyeTimeParams } from '../services/tokenDetailsService';
import { PriceHistoryItem } from '../types/tokenDetails.types';

/** Timeframe type used for chart data */
export type Timeframe = '1H' | '1D' | '1W' | '1M' | 'ALL';

// Cache data for up to 5 minutes (in milliseconds)
const CACHE_TTL = 5 * 60 * 1000;

// Shorter cache time for price data to keep it more current
const PRICE_CACHE_TTL = 1 * 60 * 1000; // 1 minute

// Cache for token data to avoid refetching
interface CacheEntry {
  timestamp: number;
  data: any;
}

// Global cache to persist between hook instances
const tokenDataCache = new Map<string, CacheEntry>();

export function useBirdeye() {
  // ------------------------------------------
  // Token selection and timeframe
  // ------------------------------------------
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>('');
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');

  // Price history data
  const [graphData, setGraphData] = useState<number[]>([]);
  const [timestamps, setTimestamps] = useState<number[]>([]);
  const [timeframePrice, setTimeframePrice] = useState(0);
  const [timeframeChangeUsd, setTimeframeChangeUsd] = useState(0);
  const [timeframeChangePercent, setTimeframeChangePercent] = useState(0);

  // Loading states & errors
  const [loadingOHLC, setLoadingOHLC] = useState(false);
  const [coinError, setCoinError] = useState<string | null>(null);

  // Track previous token address and timeframe to avoid duplicate fetches
  const prevTokenAddressRef = useRef<string>('');
  const prevTimeframeRef = useRef<Timeframe>('1D');
  
  // Track if a fetch is in progress
  const fetchingRef = useRef<boolean>(false);
  
  // Debounce timer
  const timerRef = useRef<any>(null);

  // ------------------------------------------
  // Fetch logic - with improved caching
  // ------------------------------------------
  const fetchTokenPriceHistory = useCallback(
    async (tokenAddress: string, selectedTf: Timeframe): Promise<PriceHistoryItem[]> => {
      if (!tokenAddress) return [];
      
      const cacheKey = `price:${tokenAddress}:${selectedTf}`;
      const cachedData = tokenDataCache.get(cacheKey);
      
      // Use shorter cache TTL for price-related data to keep it current
      const cacheTtl = selectedTf === '1H' ? PRICE_CACHE_TTL : CACHE_TTL;
      if (cachedData && Date.now() - cachedData.timestamp < cacheTtl) {
        return cachedData.data;
      }
      
      setLoadingOHLC(true);
      setCoinError(null);

      try {
        const rawData = await fetchPriceHistory(tokenAddress, selectedTf);
        
        // Update cache
        tokenDataCache.set(cacheKey, {
          timestamp: Date.now(),
          data: rawData
        });
        
        return rawData;
      } catch (err: any) {
        setCoinError(err.message || 'Error fetching price data');
        return [];
      } finally {
        setLoadingOHLC(false);
      }
    },
    [],
  );

  // ------------------------------------------
  // Combined fetch for price history data
  // ------------------------------------------
  const fetchTokenData = useCallback(async (tokenAddress: string, tf: Timeframe) => {
    if (!tokenAddress || fetchingRef.current) return;
    
    fetchingRef.current = true;
    setCoinError(null);
    
    try {
      // Fetch price history data
      const rawData = await fetchTokenPriceHistory(tokenAddress, tf);
      
      if (rawData && rawData.length > 0) {
        const priceValues = rawData.map((item: PriceHistoryItem) => item.value);
        const timeValues = rawData.map((item: PriceHistoryItem) => item.unixTime * 1000); // Convert to milliseconds

        setGraphData(priceValues);
        setTimestamps(timeValues);

        if (priceValues.length > 1) {
          const openPrice = priceValues[0];
          const finalPrice = priceValues[priceValues.length - 1];
          const absChange = finalPrice - openPrice;
          const pctChange = openPrice === 0 ? 0 : (absChange / openPrice) * 100;

          setTimeframePrice(finalPrice);
          setTimeframeChangeUsd(absChange);
          setTimeframeChangePercent(pctChange);
        } else {
          // Only 1 data point
          setTimeframePrice(priceValues[0] || 0);
          setTimeframeChangeUsd(0);
          setTimeframeChangePercent(0);
        }
      } else {
        // No data returned
        setGraphData([]);
        setTimestamps([]);
        setTimeframePrice(0);
        setTimeframeChangeUsd(0);
        setTimeframeChangePercent(0);
      }
      
      // Update refs for tracking changes
      prevTokenAddressRef.current = tokenAddress;
      prevTimeframeRef.current = tf;
      
    } catch (err) {
      console.error('Error in fetchTokenData:', err);
    } finally {
      fetchingRef.current = false;
    }
  }, [fetchTokenPriceHistory]);

  // ------------------------------------------
  // Debounced token address handler
  // ------------------------------------------
  useEffect(() => {
    if (!selectedTokenAddress) return;
    
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    // Skip fetch if token address and timeframe haven't changed
    if (
      selectedTokenAddress === prevTokenAddressRef.current && 
      timeframe === prevTimeframeRef.current
    ) {
      return;
    }
    
    // Debounce the fetch - wait 300ms before fetching
    timerRef.current = setTimeout(() => {
      fetchTokenData(selectedTokenAddress, timeframe);
    }, 300);
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [selectedTokenAddress, timeframe, fetchTokenData]);

  // ------------------------------------------
  // Manual refresh - exposed to components
  // ------------------------------------------
  const refreshTokenData = useCallback(async () => {
    if (!selectedTokenAddress) return;
    
    // Skip debouncing for manual refresh
    await fetchTokenData(selectedTokenAddress, timeframe);
  }, [selectedTokenAddress, timeframe, fetchTokenData]);

  // ------------------------------------------
  // Clear data when token address changes completely
  // ------------------------------------------
  useEffect(() => {
    // If switching to a completely different token, clear data immediately
    if (selectedTokenAddress && selectedTokenAddress !== prevTokenAddressRef.current) {
      setGraphData([]);
      setTimestamps([]);
      setTimeframePrice(0);
    }
  }, [selectedTokenAddress]);

  // Memoized value to prevent rerenders on reference equality checks
  const value = useMemo(() => ({
    // Token selection
    selectedTokenAddress,
    setSelectedTokenAddress,
    timeframe,
    setTimeframe,

    // Price history data
    graphData,
    timestamps,
    timeframePrice,
    timeframeChangeUsd,
    timeframeChangePercent,

    // Loading + error
    loadingOHLC,
    coinError,

    // Refresh
    refreshTokenData,
  }), [
    selectedTokenAddress,
    timeframe,
    graphData,
    timestamps,
    timeframePrice,
    timeframeChangeUsd,
    timeframeChangePercent,
    loadingOHLC,
    coinError,
    refreshTokenData
  ]);

  return value;
} 