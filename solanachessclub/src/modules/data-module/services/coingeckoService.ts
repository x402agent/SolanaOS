// FILE: src/services/coingeckoService.ts
import {COINGECKO_API_KEY} from '@env';

/**
 * A collection of asynchronous functions to interface with the CoinGecko API.
 * All fetch logic resides here to keep business logic separate from hooks/components.
 */

const BASE_URL = 'https://pro-api.coingecko.com/api/v3';

// Common headers for all requests
const getHeaders = () => ({
  Accept: 'application/json',
  'x-cg-pro-api-key': COINGECKO_API_KEY || '',
});

// Implement request with retry and timeout
async function fetchWithRetry(url: string, options = {}, maxRetries = 2) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const signal = controller.signal;
      
      // Set 10 second timeout for each request
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, { 
        ...options, 
        signal,
        headers: {
          ...getHeaders(),
          ...(options as any)?.headers,
        }
      });
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '1', 10) * 1000;
          await new Promise(resolve => setTimeout(resolve, attempt === 0 ? retryAfter : retryAfter * 2));
          continue;
        }
        
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (err: any) {
      lastError = err;
      
      // Only retry on network errors or rate limits, not on other errors
      if (err.name === 'AbortError') {
        console.warn('CoinGecko request timed out, retrying...');
      } else if (!err.message.includes('API error')) {
        console.warn('CoinGecko network error, retrying...', err.message);
      } else {
        // Don't retry other API errors
        throw err;
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  
  throw lastError || new Error('Failed to fetch data from CoinGecko');
}

/**
 * Fetch the full coin list.
 * NOTE: The raw list can be large, so be mindful of performance.
 */
export async function getCoinList(): Promise<
  Array<{
    id: string;
    symbol: string;
    name: string;
  }>
> {
  const url = `${BASE_URL}/coins/list`;
  try {
    const data = await fetchWithRetry(url);
    if (!Array.isArray(data)) {
      throw new Error('CoinGecko list response was not an array.');
    }
    return data;
  } catch (err: any) {
    console.error('Failed to fetch coin list:', err.message);
    throw new Error(`CoinGecko list fetch failed: ${err.message}`);
  }
}

/**
 * Fetch market data for a specific coin (price, market cap, FDV, image, etc).
 * Typically used for the "coin detail" screen.
 */
export async function getCoinMarkets(coinId: string) {
  if (!coinId) {
    throw new Error('No coin ID provided for market data');
  }
  
  const url = `${BASE_URL}/coins/markets?vs_currency=usd&ids=${coinId}`;
  
  try {
    const data = await fetchWithRetry(url);
    
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`No market data available for coinId=${coinId}.`);
    }
    
    // Add a normalized name field to avoid inconsistencies
    if (data[0]) {
      data[0].normalized_name = data[0].name?.toLowerCase();
    }
    
    return data[0]; // Return the first (and likely only) object
  } catch (err: any) {
    console.error('Failed to fetch market data:', err.message);
    
    // Create a fallback response with minimal data if possible
    if (coinId) {
      return {
        id: coinId,
        name: coinId.charAt(0).toUpperCase() + coinId.slice(1),
        normalized_name: coinId.toLowerCase(),
        symbol: coinId.substring(0, 3).toUpperCase(),
        current_price: 0,
        market_cap: 0,
        price_change_percentage_24h: 0,
      };
    }
    
    throw err;
  }
}

/**
 * Fetch OHLC (open-high-low-close) data for the specified coin and time duration.
 * `days` can be '1', '7', '30', 'max', etc.
 */
export async function getCoinOHLC(coinId: string, days: string) {
  if (!coinId) {
    throw new Error('No coin ID provided for OHLC data');
  }
  
  const url = `${BASE_URL}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
  
  try {
    const rawData = await fetchWithRetry(url);
    
    if (!Array.isArray(rawData)) {
      throw new Error(`OHLC data for coinId=${coinId} is not an array.`);
    }
    
    return rawData;
  } catch (err: any) {
    console.error('Failed to fetch OHLC data:', err.message);
    
    // Return empty array instead of throwing to allow graceful degradation
    if (err.message.includes('404')) {
      console.warn(`No OHLC data found for coinId=${coinId} (404).`);
      return [];
    }
    
    throw err;
  }
}

// Batch fetch multiple coins' market data in one request to reduce API calls
export async function getBatchCoinMarkets(coinIds: string[]) {
  if (!coinIds || coinIds.length === 0) {
    return [];
  }
  
  // CoinGecko limits to 100 ids per request
  const idsParam = coinIds.slice(0, 100).join(',');
  const url = `${BASE_URL}/coins/markets?vs_currency=usd&ids=${idsParam}`;
  
  try {
    return await fetchWithRetry(url);
  } catch (err: any) {
    console.error('Failed to batch fetch coin markets:', err.message);
    throw err;
  }
}
