import { useState, useCallback, useRef, useEffect } from 'react';
import { BIRDEYE_API_KEY } from '@env';

interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  extensions?: {
    coingeckoId?: string;
  };
}

interface BirdeyeTokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo_uri?: string;
  extensions?: {
    coingecko_id?: string;
  };
}

interface BirdeyeTokenMetadataResponse {
  success: boolean;
  data: {
    [address: string]: BirdeyeTokenMetadata;
  };
}

// Cache to store token metadata globally - NO HARDCODED DATA
const tokenMetadataCache = new Map<string, TokenMetadata>();

/**
 * Fetches token metadata from Birdeye API for multiple addresses
 */
const fetchTokenMetadata = async (addresses: string[]): Promise<Map<string, TokenMetadata>> => {
  if (!BIRDEYE_API_KEY) {
    throw new Error('Birdeye API key is missing');
  }

  if (addresses.length === 0) {
    return new Map();
  }

  // Filter out addresses we already have in cache
  const addressesToFetch = addresses.filter(addr => !tokenMetadataCache.has(addr));
  
  if (addressesToFetch.length === 0) {
    const result = new Map<string, TokenMetadata>();
    addresses.forEach(addr => {
      const cached = tokenMetadataCache.get(addr);
      if (cached) result.set(addr, cached);
    });
    return result;
  }

  try {
    // Birdeye API supports up to 50 addresses at once
    const chunks = [];
    for (let i = 0; i < addressesToFetch.length; i += 50) {
      chunks.push(addressesToFetch.slice(i, i + 50));
    }

    const results = new Map<string, TokenMetadata>();

    for (const chunk of chunks) {
      const addressParam = chunk.join(',');
      const url = `https://public-api.birdeye.so/defi/v3/token/meta-data/multiple?list_address=${addressParam}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-chain': 'solana',
          'x-api-key': BIRDEYE_API_KEY,
        },
      });

      if (!response.ok) {
        console.error(`[useTokenMetadata] Birdeye metadata API error: ${response.status} ${response.statusText}`);
        continue; // Continue with other chunks
      }

      const result: BirdeyeTokenMetadataResponse = await response.json();

      if (result.success && result.data) {
        Object.entries(result.data).forEach(([address, metadata]) => {
          if (!metadata) {
            console.warn(`[useTokenMetadata] No metadata for address: ${address}`);
            return;
          }

          const tokenMetadata: TokenMetadata = {
            address: metadata.address,
            symbol: metadata.symbol || 'Unknown',
            name: metadata.name || 'Unknown Token',
            decimals: metadata.decimals || 0,
            logoURI: metadata.logo_uri,
            extensions: metadata.extensions ? {
              coingeckoId: metadata.extensions.coingecko_id,
            } : undefined,
          };

          // Cache the result
          tokenMetadataCache.set(address, tokenMetadata);
          results.set(address, tokenMetadata);
        });
      }
    }

    // Also include any previously cached tokens that were requested
    addresses.forEach(addr => {
      if (!results.has(addr)) {
        const cached = tokenMetadataCache.get(addr);
        if (cached) {
          results.set(addr, cached);
        }
      }
    });

    return results;

  } catch (error) {
    console.error('[useTokenMetadata] Error fetching token metadata:', error);
    // Return cached data for requested addresses if available
    const fallbackResults = new Map<string, TokenMetadata>();
    addresses.forEach(addr => {
      const cached = tokenMetadataCache.get(addr);
      if (cached) fallbackResults.set(addr, cached);
    });
    
    return fallbackResults;
  }
};

export interface UseTokenMetadataReturn {
  tokenMetadata: Map<string, TokenMetadata>;
  loading: boolean;
  error: string | null;
  fetchMetadataForTokens: (addresses: string[]) => Promise<void>;
  getTokenLogoUrl: (address: string) => string | null;
  getTokenMetadata: (address: string) => TokenMetadata | null;
}

/**
 * Hook for managing token metadata with caching and batch fetching
 */
export function useTokenMetadata(): UseTokenMetadataReturn {
  const [tokenMetadata, setTokenMetadata] = useState<Map<string, TokenMetadata>>(new Map(tokenMetadataCache));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const fetchingRef = useRef(new Set<string>());

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchMetadataForTokens = useCallback(async (addresses: string[]) => {
    if (!isMounted.current || addresses.length === 0) return;

    // Filter out addresses we're already fetching
    const newAddresses = addresses.filter(addr => !fetchingRef.current.has(addr));
    if (newAddresses.length === 0) return;

    // Mark addresses as being fetched
    newAddresses.forEach(addr => fetchingRef.current.add(addr));

    setLoading(true);
    setError(null);

    try {
      const fetchedMetadata = await fetchTokenMetadata(newAddresses);
      
      if (isMounted.current) {
        // Update the local state with new metadata
        setTokenMetadata(new Map(tokenMetadataCache));
      }
    } catch (err: any) {
      if (isMounted.current) {
        setError(err.message || 'Failed to fetch token metadata');
      }
    } finally {
      // Remove addresses from fetching set
      newAddresses.forEach(addr => fetchingRef.current.delete(addr));
      
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  const getTokenLogoUrl = useCallback((address: string): string | null => {
    const metadata = tokenMetadataCache.get(address);
    return metadata?.logoURI || null;
  }, []);

  const getTokenMetadata = useCallback((address: string): TokenMetadata | null => {
    return tokenMetadataCache.get(address) || null;
  }, []);

  return {
    tokenMetadata,
    loading,
    error,
    fetchMetadataForTokens,
    getTokenLogoUrl,
    getTokenMetadata,
  };
} 