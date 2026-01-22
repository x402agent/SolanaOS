import { Connection, clusterApiUrl, Cluster, PublicKey } from '@solana/web3.js';
import { CLUSTER, HELIUS_STAKED_URL, BIRDEYE_API_KEY } from '@env';
import { TokenInfo } from '../types/tokenTypes';
import { useCallback } from 'react';
import { ENDPOINTS } from '@/shared/config/constants';

/**
 * Default token entries
 */
export const DEFAULT_SOL_TOKEN: TokenInfo = {
  address: 'So11111111111111111111111111111111111111112',
  symbol: 'SOL',
  name: 'Solana',
  decimals: 9,
  logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
};

export const DEFAULT_USDC_TOKEN: TokenInfo = {
  address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
};

/**
 * Fetches the balance for a specific token
 */
export async function fetchTokenBalance(
  walletPublicKey: PublicKey,
  tokenInfo: TokenInfo | null
): Promise<number | null> {
  // Return null if token is null
  if (!tokenInfo) {
    console.error('[TokenService] Cannot fetch balance: Token info is null');
    return null;
  }

  try {
    const rpcUrl = HELIUS_STAKED_URL || ENDPOINTS.helius || clusterApiUrl(CLUSTER as Cluster);
    const connection = new Connection(rpcUrl, 'confirmed');

    if (
      tokenInfo.symbol === 'SOL' ||
      tokenInfo.address === 'So11111111111111111111111111111111111111112'
    ) {
      // For native SOL
      const balance = await connection.getBalance(walletPublicKey);
      console.log("[TokenService] SOL balance in lamports:", balance);
      
      // Convert lamports to SOL
      const SOL_DECIMALS = 9;
      
      // For very small SOL amounts (less than 0.001 SOL), return the full balance
      // without reserving any for fees, since the user likely just wants to see what they have
      if (balance < 1_000_000) { // 0.001 SOL in lamports
        const fullSolBalance = balance / Math.pow(10, SOL_DECIMALS);
        console.log("[TokenService] SOL balance is very small, returning full amount:", fullSolBalance);
        return fullSolBalance;
      }
      
      // Otherwise, reserve a small amount for fees
      const MIN_SOL_RESERVE = 0.0005; // 0.0005 SOL reserved for fees (500,000 lamports)
      const MIN_LAMPORTS_RESERVE = MIN_SOL_RESERVE * Math.pow(10, SOL_DECIMALS);
      
      // Calculate usable balance
      const usableBalance = Math.max(0, balance - MIN_LAMPORTS_RESERVE);
      const solBalance = usableBalance / Math.pow(10, SOL_DECIMALS);
      
      console.log("[TokenService] SOL balance converted to SOL:", solBalance, 
        `(Reserved ${MIN_SOL_RESERVE} SOL for fees, raw balance: ${balance / Math.pow(10, SOL_DECIMALS)} SOL)`);
      
      return solBalance;
    } else {
      // For SPL tokens
      try {
        const tokenPubkey = new PublicKey(tokenInfo.address);
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          walletPublicKey,
          { mint: tokenPubkey }
        );

        if (tokenAccounts.value.length > 0) {
          // Get the token amount from the first account
          const tokenBalance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount;
          const amount = parseFloat(tokenBalance.amount) / Math.pow(10, tokenBalance.decimals);
          console.log(`[TokenService] ${tokenInfo.symbol} balance:`, amount);
          return amount;
        } else {
          console.log(`[TokenService] No ${tokenInfo.symbol} token account found`);
          return 0;
        }
      } catch (err) {
        console.error(`[TokenService] Error fetching ${tokenInfo.symbol} token balance:`, err);
        return 0;
      }
    }
  } catch (err) {
    console.error('[TokenService] Error fetching balance:', err);
    return 0; // Return 0 instead of null to avoid UI issues
  }
}

/**
 * Fetches the price of a token
 */
export async function fetchTokenPrice(tokenInfo: TokenInfo | null): Promise<number | null> {
  // Return null if token is null
  if (!tokenInfo) {
    console.error('[TokenService] Cannot fetch price: Token info is null');
    return null;
  }

  try {
    console.log(`[TokenService] Fetching price for ${tokenInfo.symbol} (${tokenInfo.address})`);
    
    // Use Birdeye API to get token price
    const response = await fetch(`https://public-api.birdeye.so/defi/v3/token/market-data?address=${tokenInfo.address}&chain=solana`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'X-API-KEY': BIRDEYE_API_KEY || ''
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TokenService] Birdeye API error: ${response.status}, ${errorText}`);
      console.log(`[TokenService] Failed to get Birdeye price for ${tokenInfo.symbol}, trying Jupiter as fallback`);
    } else {
      const data = await response.json();
      
      if (data.success && data.data && typeof data.data.price === 'number') {
        console.log(`[TokenService] Birdeye returned price for ${tokenInfo.symbol}: ${data.data.price}`);
        return data.data.price;
      } else {
        console.log(`[TokenService] Birdeye API returned invalid price data:`, JSON.stringify(data));
      }
    }
    
    // If Birdeye fails, try Jupiter API as a last resort
    try {
      console.log(`[TokenService] Trying Jupiter as fallback for ${tokenInfo.symbol}`);
      const jupResponse = await fetch(`https://price.jup.ag/v4/price?ids=${tokenInfo.address}`);
      if (jupResponse.ok) {
        const jupData = await jupResponse.json();
        if (jupData?.data?.[tokenInfo.address]?.price) {
          const price = jupData.data[tokenInfo.address].price;
          console.log(`[TokenService] Jupiter returned price for ${tokenInfo.symbol}: ${price}`);
          return price;
        } else {
          console.log(`[TokenService] Jupiter API returned invalid price data:`, JSON.stringify(jupData));
        }
      }
    } catch (err) {
      console.log(`[TokenService] Error fetching ${tokenInfo.symbol} price from Jupiter`, err);
    }
    
    console.log(`[TokenService] Failed to get price for ${tokenInfo.symbol} from any source`);
    return null;
  } catch (err) {
    console.error('[TokenService] Error fetching token price:', err);
    return null;
  }
}

/**
 * Estimates the USD value of a token amount
 */
export async function estimateTokenUsdValue(
  tokenAmount: number,
  decimals: number,
  tokenMint: string,
  tokenSymbol?: string
): Promise<string> {
  try {
    // Convert to normalized amount
    const normalizedAmount = tokenAmount / Math.pow(10, decimals);

    // Get token price using Birdeye API
    const tokenInfo: TokenInfo = {
      address: tokenMint,
      symbol: tokenSymbol || '',
      name: tokenSymbol || '',
      decimals: decimals,
      logoURI: ''
    };
    
    const price = await fetchTokenPrice(tokenInfo);
    
    if (price && normalizedAmount > 0) {
      const estimatedValue = normalizedAmount * price;
      return `$${estimatedValue.toFixed(2)}`;
    }
    
    return '';
  } catch (err) {
    console.error('Error estimating token value:', err);
    return '';
  }
}

/**
 * Converts a decimal amount to base units (e.g., SOL -> lamports)
 */
export function toBaseUnits(amount: string, decimals: number): number {
  const val = parseFloat(amount);
  if (isNaN(val)) return 0;
  return val * Math.pow(10, decimals);
}

// Birdeye token list API constants
const BIRDEYE_BASE_URL = 'https://public-api.birdeye.so';
const BIRDEYE_HEADERS = {
  'accept': 'application/json',
  'X-API-KEY': BIRDEYE_API_KEY || ''
};

/**
 * TokenListParams interface for Birdeye token list API
 */
export interface TokenListParams {
  sort_by?: string;
  sort_type?: string;
  offset?: number;
  limit?: number;
  min_liquidity?: number;
}

/**
 * Token list item from Birdeye API
 */
export interface BirdeyeTokenItem {
  address: string;
  logo_uri: string;
  name: string;
  symbol: string;
  decimals: number;
  market_cap: number;
  price: number;
  liquidity: number;
  volume_24h_usd: number;
  price_change_24h_percent: number;
  extensions?: {
    website?: string;
    twitter?: string;
    discord?: string;
    description?: string;
  };
}

/**
 * Fetches token list from Birdeye API
 */
export async function fetchTokenList(params: TokenListParams = {}): Promise<TokenInfo[]> {
  try {
    // Default parameters for sorting by market cap high to low
    const defaultParams = {
      chain: 'solana', // Add chain as a query parameter
      sort_by: 'liquidity',
      sort_type: 'asc',
      limit: 100,
      offset: 0,
    };
    
    const finalParams = { ...defaultParams, ...params };
    
    // Build query string
    const queryParams = new URLSearchParams();
    Object.entries(finalParams).forEach(([key, value]) => {
      queryParams.append(key, value.toString());
    });
    
    const url = `${BIRDEYE_BASE_URL}/defi/v3/token/list?${queryParams.toString()}`;
    
    console.log(`[TokenService] Fetching token list with URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: BIRDEYE_HEADERS
    });
    
    if (!response.ok) {
      // Log the error response for debugging
      const errorText = await response.text();
      console.error(`[TokenService] Birdeye API error: ${response.status}, ${errorText}`);
      throw new Error(`Failed to fetch token list: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.data && data.data.items) {
      // Transform Birdeye tokens to TokenInfo format and ensure no null values
      return data.data.items.map((item: BirdeyeTokenItem) => ({
        address: item.address || '',
        symbol: item.symbol || 'Unknown',
        name: item.name || 'Unknown Token',
        decimals: item.decimals !== undefined ? item.decimals : 9,
        logoURI: item.logo_uri || '',
        price: item.price || 0,
        marketCap: item.market_cap || 0,
        volume24h: item.volume_24h_usd || 0,
        priceChange24h: item.price_change_24h_percent || 0,
        liquidity: item.liquidity || 0
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching token list from Birdeye:', error);
    return [];
  }
}

/**
 * Interface for Birdeye search API params
 */
export interface TokenSearchParams {
  keyword: string;
  sort_by?: string;
  sort_type?: string;
  target?: string;
  search_mode?: string;
  search_by?: string;
  verify_token?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Searches for tokens using Birdeye search API
 */
export async function searchTokens(params: TokenSearchParams): Promise<TokenInfo[]> {
  try {
    if (!params.keyword || params.keyword.trim() === '') {
      return [];
    }
    
    // Default parameters based on API documentation
    const defaultParams = {
      chain: 'solana',
      keyword: params.keyword, // Use the provided keyword
      target: 'all',
      search_mode: 'fuzzy', // Changed from 'exact' to 'fuzzy' for better name search
      search_by: 'combination', // Changed from 'symbol' to 'both' to search by both name and symbol
      sort_by: 'marketcap',
      sort_type: 'desc',
      verify_token: true,
      offset: 0,
      limit: 20
    };
    
    // Remove keyword from params to avoid duplication
    const { keyword, ...restParams } = params;
    
    const finalParams = { ...defaultParams, ...restParams };
    
    // Build query string
    const queryParams = new URLSearchParams();
    Object.entries(finalParams).forEach(([key, value]) => {
      if (typeof value === 'boolean') {
        queryParams.append(key, value ? 'true' : 'false');
      } else if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });
    
    const url = `${BIRDEYE_BASE_URL}/defi/v3/search?${queryParams.toString()}`;
    
    console.log(`[TokenService] Searching tokens with URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: BIRDEYE_HEADERS
    });
    
    if (!response.ok) {
      // Log the error response for debugging
      const errorText = await response.text();
      console.error(`[TokenService] Birdeye API error: ${response.status}, ${errorText}`);
      throw new Error(`Failed to search tokens: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.data && data.data.items) {
      const tokens: TokenInfo[] = [];
      
      // Find the token results
      const tokenResults = data.data.items.find((item: any) => item.type === 'token');
      
      if (tokenResults && tokenResults.result) {
        // Transform Birdeye tokens to TokenInfo format and ensure no null values
        return tokenResults.result.map((item: any) => ({
          address: item.address || '',
          symbol: item.symbol || 'Unknown',
          name: item.name || 'Unknown Token',
          decimals: item.decimals !== undefined ? item.decimals : 9,
          logoURI: item.logo_uri || '',
          price: item.price || 0,
          marketCap: item.market_cap || 0,
          volume24h: item.volume_24h_usd || 0,
          priceChange24h: item.price_change_24h_percent || 0,
          liquidity: item.liquidity || 0
        }));
      }
    }
    
    return [];
  } catch (error) {
    console.error('Error searching tokens from Birdeye:', error);
    return [];
  }
}

/**
 * Fetches complete token metadata for a given token
 */
export async function fetchTokenMetadata(tokenAddress: string): Promise<TokenInfo | null> {
  try {
    const url = `${BIRDEYE_BASE_URL}/defi/v3/token/meta-data/single?address=${tokenAddress}&chain=solana`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: BIRDEYE_HEADERS
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TokenService] Birdeye API error: ${response.status}, ${errorText}`);
      throw new Error(`Failed to fetch token metadata: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success && data.data) {
      const tokenData = data.data;
      
      // Get market data as well
      const marketData = await fetchTokenMarketData(tokenAddress);
      
      // Ensure no null values in the token data
      return {
        address: tokenAddress,
        symbol: tokenData.symbol || 'Unknown',
        name: tokenData.name || 'Unknown Token',
        decimals: tokenData.decimals !== undefined ? tokenData.decimals : 9,
        logoURI: tokenData.logo_uri || '',
        price: (marketData && marketData.price) || 0,
        marketCap: (marketData && marketData.market_cap) || 0,
        volume24h: (marketData && marketData.volume_24h_usd) || 0,
        priceChange24h: (marketData && marketData.price_change_24h_percent) || 0,
        liquidity: (marketData && marketData.liquidity) || 0
      };
    }
    
    // If we can't fetch the data, return a basic token with the address
    return {
      address: tokenAddress,
      symbol: 'Unknown',
      name: 'Unknown Token',
      decimals: 9,
      logoURI: '',
      price: 0,
      marketCap: 0,
      volume24h: 0,
      priceChange24h: 0,
      liquidity: 0
    };
  } catch (error) {
    console.error('Error fetching token metadata from Birdeye:', error);
    // Return a basic token rather than null to prevent errors
    return {
      address: tokenAddress,
      symbol: 'Unknown',
      name: 'Unknown Token',
      decimals: 9,
      logoURI: '',
      price: 0,
      marketCap: 0,
      volume24h: 0,
      priceChange24h: 0,
      liquidity: 0
    };
  }
}

/**
 * Fetches token market data from Birdeye
 */
async function fetchTokenMarketData(tokenAddress: string): Promise<any | null> {
  try {
    const url = `${BIRDEYE_BASE_URL}/defi/v3/token/market-data?address=${tokenAddress}&chain=solana`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: BIRDEYE_HEADERS
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TokenService] Birdeye API error: ${response.status}, ${errorText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.success && data.data) {
      return data.data;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching token market data from Birdeye:', error);
    return null;
  }
}

/**
 * Ensures a token has complete metadata
 */
export async function ensureCompleteTokenInfo(token: Partial<TokenInfo>): Promise<TokenInfo> {
  // Initialize with default values to ensure no nulls
  const defaultToken: TokenInfo = {
    address: token.address || '',
    symbol: token.symbol || 'Unknown',
    name: token.name || 'Unknown Token',
    decimals: token.decimals !== undefined ? token.decimals : 9,
    logoURI: token.logoURI || '',
    price: token.price || 0,
    marketCap: token.marketCap || 0,
    volume24h: token.volume24h || 0,
    priceChange24h: token.priceChange24h || 0,
    liquidity: token.liquidity || 0
  };

  // Only if we have an address, try to fetch complete metadata
  if (token.address) {
    try {
      const metadata = await fetchTokenMetadata(token.address);
    if (metadata) {
        // Merge fetched data with existing data, preferring existing non-null values
      return {
        ...metadata,
          symbol: token.symbol || metadata.symbol,
          name: token.name || metadata.name,
          decimals: token.decimals !== undefined ? token.decimals : metadata.decimals,
          logoURI: token.logoURI || metadata.logoURI
        };
      }
    } catch (error) {
      console.error('Error in ensureCompleteTokenInfo:', error);
      // Continue with default token if fetch fails
    }
  }

  // Return the token with default values for any missing fields
  return defaultToken;
} 