import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TokenInfo } from '../types/tokenTypes';
import { fetchTokenList, searchTokens, TokenSearchParams, TokenListParams } from '../services/tokenService';

// Timeout for token fetch operations (in milliseconds)
const TOKEN_FETCH_TIMEOUT = 15000;

interface UseTokenSearchResult {
  tokens: TokenInfo[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  loadMore: () => void;
  refresh: () => void;
  isRefreshing: boolean;
}

/**
 * Hook for searching and listing tokens with debounce functionality
 */
export function useTokenSearch(
  initialQuery: string = '', 
  debounceMs: number = 300
): UseTokenSearchResult {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState<string>(initialQuery);
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  
  // Refs to track fetch operations and prevent stale closures
  const isMounted = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchInProgress = useRef<boolean>(false);
  
  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  // Setup debounce mechanism for search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      // Reset pagination when query changes
      setOffset(0);
      setHasMore(true);
    }, debounceMs);
    
    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, debounceMs]);
  
  // Function to fetch tokens based on search query with timeout handling
  const fetchTokens = useCallback(async (isLoadingMore: boolean = false, isRefreshRequest: boolean = false) => {
    // Prevent concurrent fetch operations
    if (fetchInProgress.current) {
      console.log('[useTokenSearch] Fetch already in progress, skipping');
      return;
    }
    
    try {
      fetchInProgress.current = true;
      setError(null);
      
      if (!isLoadingMore) {
        // Only show loading if we're not loading more or refreshing
        if (!isRefreshRequest) {
          setLoading(true);
        } else {
          setIsRefreshing(true);
        }
      }
      
      // Prepare parameters based on search type
      let fetchPromise: Promise<TokenInfo[]>;
      if (debouncedQuery.trim() === '') {
        // If no search query, fetch top tokens sorted by market cap
        const params: TokenListParams = {
          sort_by: 'market_cap',
          sort_type: 'desc',
          offset: isLoadingMore ? offset : 0,
          limit: 20
        };
        
        fetchPromise = fetchTokenList(params);
      } else {
        // If we have a search query, use the search API
        const params: TokenSearchParams = {
          keyword: debouncedQuery,
          sort_by: 'volume_24h_usd',
          sort_type: 'desc',
          offset: isLoadingMore ? offset : 0,
          limit: 20
        };
        
        fetchPromise = searchTokens(params);
      }
      
      // Setup timeout for the fetch operation
      const timeoutPromise = new Promise<TokenInfo[]>((_, reject) => {
        timeoutRef.current = setTimeout(() => {
          reject(new Error('Token fetch timeout, please try again.'));
        }, TOKEN_FETCH_TIMEOUT);
      });
      
      // Race between fetch and timeout
      const result = await Promise.race([fetchPromise, timeoutPromise]);
      
      // Clear timeout if fetch succeeded
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      if (!isMounted.current) return;
      
      // Filter out tokens with invalid or missing required properties
      const validTokens = result.filter(token => 
        token && 
        token.address && 
        (token.symbol !== null && token.symbol !== undefined) &&
        (token.name !== null && token.name !== undefined) &&
        (token.decimals !== null && token.decimals !== undefined)
      );
      
      if (validTokens.length === 0 && !isLoadingMore) {
        // If no results on initial search, show empty state
        setHasMore(false);
        setTokens([]);
      } else if (validTokens.length === 0 && isLoadingMore) {
        // If no more results when loading more, mark as no more
        setHasMore(false);
      } else {
        // If loading more, append to current list; otherwise replace
        setTokens(prev => isLoadingMore ? [...prev, ...validTokens] : validTokens);
        
        // Update offset for pagination
        if (isLoadingMore) {
          setOffset(prev => prev + 20);
        } else if (!isLoadingMore) {
          setOffset(20); // Set to 20 for future load more operations
        }
      }
    } catch (err) {
      if (!isMounted.current) return;
      
      console.error('Error in useTokenSearch:', err);
      
      // Handle error case
      if (err instanceof Error) {
        setError(err.message || 'Failed to fetch tokens');
      } else {
        setError('Failed to fetch tokens, please try again');
      }
      
      // Don't clear tokens on load more failure
      if (!isLoadingMore && tokens.length === 0) {
        // Set some fallback tokens if we couldn't load any
        setTokens([
          {
            address: 'So11111111111111111111111111111111111111112',
            symbol: 'SOL',
            name: 'Solana',
            decimals: 9,
            logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
          },
          {
            address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            symbol: 'USDC',
            name: 'USD Coin',
            decimals: 6,
            logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
          }
        ]);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setIsRefreshing(false);
        fetchInProgress.current = false;
      }
    }
  }, [debouncedQuery, offset, tokens.length]);
  
  // Fetch tokens when debounced query changes
  useEffect(() => {
    fetchTokens();
  }, [debouncedQuery, fetchTokens]);
  
  // Load more tokens (pagination)
  const loadMore = useCallback(() => {
    if (!loading && hasMore && !fetchInProgress.current) {
      fetchTokens(true);
    }
  }, [loading, hasMore, fetchTokens]);
  
  // Refresh the token list
  const refresh = useCallback(() => {
    if (!fetchInProgress.current) {
      setOffset(0);
      setHasMore(true);
      fetchTokens(false, true);
    }
  }, [fetchTokens]);
  
  return useMemo(() => ({
    tokens,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    loadMore,
    refresh,
    isRefreshing
  }), [tokens, loading, error, searchQuery, loadMore, refresh, isRefreshing]);
} 