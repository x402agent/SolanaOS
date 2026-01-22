import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  getCoinList,
  getCoinMarkets,
  getCoinOHLC,
} from '../services/coingeckoService';

/** Timeframe type used for chart data */
export type Timeframe = '1H' | '1D' | '1W' | '1M' | 'All';

// Cache data for up to 5 minutes (in milliseconds)
const CACHE_TTL = 5 * 60 * 1000;

// Shorter cache time for price data to keep it more current
const PRICE_CACHE_TTL = 1 * 60 * 1000; // 1 minute

// Cache for coin data to avoid refetching
interface CacheEntry {
  timestamp: number;
  data: any;
}

// Global cache to persist between hook instances
const coinDataCache = new Map<string, CacheEntry>();

export function useCoingecko() {
  // ------------------------------------------
  // A) Full Coin List + Searching
  // ------------------------------------------
  const [coinList, setCoinList] = useState<
    Array<{
      id: string;
      symbol: string;
      name: string;
    }>
  >([]);
  const [loadingCoinList, setLoadingCoinList] = useState(false);
  const [coinListError, setCoinListError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; symbol: string; name: string }>
  >([]);

  const famousCoins = new Set([
    'bitcoin',
    'ethereum',
    'solana',
    'tether',
    'binancecoin',
    'ripple',
    'cardano',
    'dogecoin',
    'usd-coin',
  ]);

  // Track if mount is complete to avoid unnecessary fetches
  const isMounted = useRef(false);

  // Fetch full coin list once - with caching
  const fetchCoinList = useCallback(async () => {
    // Check cache first
    const cacheKey = 'coinList';
    const cachedData = coinDataCache.get(cacheKey);
    
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      setCoinList(cachedData.data);
      return;
    }
    
    setLoadingCoinList(true);
    setCoinListError(null);
    
    try {
      const data = await getCoinList();
      setCoinList(data);
      
      // Update cache
      coinDataCache.set(cacheKey, {
        timestamp: Date.now(),
        data
      });
    } catch (err: any) {
      setCoinListError(err.message || 'Unknown error fetching coin list');
    } finally {
      setLoadingCoinList(false);
    }
  }, []);

  useEffect(() => {
    if (!isMounted.current) {
      fetchCoinList();
      isMounted.current = true;
    }
  }, [fetchCoinList]);

  // Local search among coinList - memoized to avoid recalculation
  const searchCoins = useCallback(
    (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      const lower = query.toLowerCase();
      let filtered = coinList.filter(
        coin =>
          coin.name.toLowerCase().includes(lower) ||
          coin.symbol.toLowerCase().includes(lower),
      );
      // Sort => "famous" first
      filtered.sort((a, b) => {
        const aFamous = famousCoins.has(a.id) ? 1 : 0;
        const bFamous = famousCoins.has(b.id) ? 1 : 0;
        if (bFamous !== aFamous) {
          return bFamous - aFamous;
        }
        return a.name.localeCompare(b.name);
      });
      setSearchResults(filtered);
    },
    [coinList],
  );

  // ------------------------------------------
  // B) Single Coin + Timeframe
  // ------------------------------------------
  const [selectedCoinId, setSelectedCoinId] = useState<string>('');
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');

  // Market data
  const [marketCap, setMarketCap] = useState(0);
  const [fdv, setFdv] = useState(0);
  const [liquidityScore, setLiquidityScore] = useState(0);

  // OHLC chart data
  const [graphData, setGraphData] = useState<number[]>([]);
  const [timestamps, setTimestamps] = useState<number[]>([]);
  const [timeframePrice, setTimeframePrice] = useState(0);
  const [timeframeChangeUsd, setTimeframeChangeUsd] = useState(0);
  const [timeframeChangePercent, setTimeframeChangePercent] = useState(0);

  // Loading states & errors
  const [loadingMarketData, setLoadingMarketData] = useState(false);
  const [loadingOHLC, setLoadingOHLC] = useState(false);
  const [coinError, setCoinError] = useState<string | null>(null);

  // Track previous coin ID and timeframe to avoid duplicate fetches
  const prevCoinIdRef = useRef<string>('');
  const prevTimeframeRef = useRef<Timeframe>('1D');
  
  // Track if a fetch is in progress
  const fetchingRef = useRef<boolean>(false);
  
  // Debounce timer
  const timerRef = useRef<any>(null);

  // ------------------------------------------
  // Fetch logic - with improved caching
  // ------------------------------------------
  const fetchMarketData = useCallback(async (coinId: string): Promise<any> => {
    if (!coinId) return null;
    
    const cacheKey = `market:${coinId}`;
    const cachedData = coinDataCache.get(cacheKey);
    
    // Use shorter cache TTL for market data since it contains current prices
    if (cachedData && Date.now() - cachedData.timestamp < PRICE_CACHE_TTL) {
      return cachedData.data;
    }
    
    setLoadingMarketData(true);
    setCoinError(null);
    
    try {
      const market = await getCoinMarkets(coinId);
      
      // Update cache
      coinDataCache.set(cacheKey, {
        timestamp: Date.now(),
        data: market
      });
      
      return market;
    } catch (err: any) {
      setCoinError(err.message || 'Error fetching market data');
      return null;
    } finally {
      setLoadingMarketData(false);
    }
  }, []);

  const fetchOhlcData = useCallback(
    async (coinId: string, selectedTf: Timeframe): Promise<any> => {
      if (!coinId) return null;
      
      const cacheKey = `ohlc:${coinId}:${selectedTf}`;
      const cachedData = coinDataCache.get(cacheKey);
      
      // Use shorter cache TTL for price-related data to keep it current
      const cacheTtl = selectedTf === '1H' ? PRICE_CACHE_TTL : CACHE_TTL;
      if (cachedData && Date.now() - cachedData.timestamp < cacheTtl) {
        return cachedData.data;
      }
      
      setLoadingOHLC(true);
      setCoinError(null);

      let days: string;
      switch (selectedTf) {
        case '1H':
        case '1D':
          days = '1';
          break;
        case '1W':
          days = '7';
          break;
        case '1M':
          days = '30';
          break;
        case 'All':
          days = 'max';
          break;
        default:
          days = '1';
          break;
      }

      try {
        const rawData = await getCoinOHLC(coinId, days);
        
        // Update cache
        coinDataCache.set(cacheKey, {
          timestamp: Date.now(),
          data: rawData
        });
        
        return rawData;
      } catch (err: any) {
        setCoinError(err.message || 'Error fetching OHLC data');
        return null;
      } finally {
        setLoadingOHLC(false);
      }
    },
    [],
  );

  // ------------------------------------------
  // Combined fetch for market and OHLC data
  // ------------------------------------------
  const fetchCoinData = useCallback(async (coinId: string, tf: Timeframe) => {
    if (!coinId || fetchingRef.current) return;
    
    fetchingRef.current = true;
    setCoinError(null);
    
    try {
      // Fetch market data
      const market = await fetchMarketData(coinId);
      if (market) {
        setMarketCap(market.market_cap || 0);
        let computedFdv = market.fully_diluted_valuation;
        if (computedFdv == null) {
          if (market.total_supply && market.current_price) {
            computedFdv = market.total_supply * market.current_price;
          } else {
            computedFdv = market.market_cap;
          }
        }
        setFdv(computedFdv || 0);

        if (market.market_cap && market.total_volume) {
          const liquidity = (market.total_volume / market.market_cap) * 100;
          setLiquidityScore(liquidity);
        } else {
          setLiquidityScore(0);
        }
      }
      
      // Fetch OHLC data
      const rawData = await fetchOhlcData(coinId, tf);
      if (rawData && rawData.length > 0) {
        const closeValues = rawData.map((arr: number[]) => arr[4]);
        const timeValues = rawData.map((arr: number[]) => arr[0]);

        setGraphData(closeValues);
        setTimestamps(timeValues);

        if (closeValues.length > 1) {
          const openPrice = closeValues[0];
          const finalPrice = closeValues[closeValues.length - 1];
          const absChange = finalPrice - openPrice;
          const pctChange = openPrice === 0 ? 0 : (absChange / openPrice) * 100;

          setTimeframePrice(finalPrice);
          setTimeframeChangeUsd(absChange);
          setTimeframeChangePercent(pctChange);
        } else {
          // Only 1 data point
          setTimeframePrice(closeValues[0] || 0);
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
      prevCoinIdRef.current = coinId;
      prevTimeframeRef.current = tf;
      
    } catch (err) {
      console.error('Error in fetchCoinData:', err);
    } finally {
      fetchingRef.current = false;
    }
  }, [fetchMarketData, fetchOhlcData]);

  // ------------------------------------------
  // Debounced coin ID handler
  // ------------------------------------------
  useEffect(() => {
    if (!selectedCoinId) return;
    
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    // Skip fetch if coin ID and timeframe haven't changed
    if (
      selectedCoinId === prevCoinIdRef.current && 
      timeframe === prevTimeframeRef.current
    ) {
      return;
    }
    
    // Debounce the fetch - wait 300ms before fetching
    timerRef.current = setTimeout(() => {
      fetchCoinData(selectedCoinId, timeframe);
    }, 300);
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [selectedCoinId, timeframe, fetchCoinData]);

  // ------------------------------------------
  // Manual refresh - exposed to components
  // ------------------------------------------
  const refreshCoinData = useCallback(async () => {
    if (!selectedCoinId) return;
    
    // Skip debouncing for manual refresh
    await fetchCoinData(selectedCoinId, timeframe);
  }, [selectedCoinId, timeframe, fetchCoinData]);

  // ------------------------------------------
  // Clear data when coin ID changes completely
  // ------------------------------------------
  useEffect(() => {
    // If switching to a completely different coin, clear data immediately
    if (selectedCoinId && selectedCoinId !== prevCoinIdRef.current) {
      setGraphData([]);
      setTimestamps([]);
      setTimeframePrice(0);
    }
  }, [selectedCoinId]);

  // Memoized value to prevent rerenders on reference equality checks
  const value = useMemo(() => ({
    // (A) Coin list searching
    coinList,
    loadingCoinList,
    coinListError,
    searchResults,
    searchCoins,
    fetchCoinList,

    // (B) Single coin + timeframe
    selectedCoinId,
    setSelectedCoinId,
    timeframe,
    setTimeframe,

    // Market data
    marketCap,
    liquidityScore,
    fdv,

    // OHLC data + derived
    graphData,
    timestamps,
    timeframePrice,
    timeframeChangeUsd,
    timeframeChangePercent,

    // Loading + error
    loadingMarketData,
    loadingOHLC,
    coinError,

    // Refresh
    refreshCoinData,
  }), [
    coinList, 
    loadingCoinList, 
    coinListError,
    searchResults,
    searchCoins,
    fetchCoinList,
    selectedCoinId,
    timeframe,
    marketCap,
    liquidityScore,
    fdv,
    graphData,
    timestamps,
    timeframePrice,
    timeframeChangeUsd,
    timeframeChangePercent,
    loadingMarketData,
    loadingOHLC,
    coinError,
    refreshCoinData
  ]);

  return value;
}
