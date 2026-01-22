/**
 * Utility functions for token-related operations
 */
import { TokenInfo } from '../types/tokenTypes';

// Cache for Jupiter token metadata to avoid duplicate fetches
const jupiterTokenCache = new Map<string, any>();

/**
 * Fetch token metadata from Jupiter API
 * @param mint Token mint address
 * @returns Token metadata
 */
export async function fetchJupiterTokenData(mint: string): Promise<any> {
  // Return from cache if available
  if (jupiterTokenCache.has(mint)) {
    return jupiterTokenCache.get(mint);
  }
  
  try {
    const response = await fetch(`https://api.jup.ag/tokens/v1/token/${mint}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch token data for ${mint}`);
    }
    const data = await response.json();
    // Store in cache
    jupiterTokenCache.set(mint, data);
    return data;
  } catch (err) {
    console.error('Jupiter token fetch error:', err);
    return null;
  }
}

/**
 * Get token logo URL or fall back to a default
 * @param tokenData Token data from Jupiter API
 * @returns Logo URL
 */
export function getTokenLogo(tokenData: any): string {
  if (!tokenData) return '';
  
  // Return the logo URI if it exists
  if (tokenData.logoURI) return tokenData.logoURI;
  
  // Special case for SOL
  if (tokenData.symbol === 'SOL' || tokenData.mint === 'So11111111111111111111111111111111111111112') {
    return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png';
  }
  
  // Special case for USDC
  if (tokenData.symbol === 'USDC' || tokenData.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
    return 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png';
  }
  
  return '';
}

/**
 * Format a token amount with appropriate decimals
 * @param amount Raw token amount
 * @param decimals Token decimals
 * @returns Formatted amount string
 */
export function formatTokenAmount(amount: number, decimals: number): string {
  if (isNaN(amount) || isNaN(decimals)) return '0';
  
  const tokenAmount = amount / Math.pow(10, decimals);
  
  // For very small amounts, show more decimals
  if (tokenAmount < 0.001 && tokenAmount > 0) {
    return tokenAmount.toExponential(4);
  }
  
  // For larger amounts, limit decimals based on size
  if (tokenAmount >= 1000) {
    return tokenAmount.toFixed(2);
  } else if (tokenAmount >= 1) {
    return tokenAmount.toFixed(4);
  } else {
    return tokenAmount.toFixed(6);
  }
}

/**
 * Formats a token balance for display with symbol
 */
export function formatTokenWithSymbol(amount: number, decimals: number, symbol: string): string {
  return `${formatTokenAmount(amount, decimals)} ${symbol}`;
}

/**
 * Formats a USD value from a token amount
 */
export function formatUsdValue(tokenAmount: number, tokenPrice: number): string {
  if (!tokenAmount || !tokenPrice) return '$0.00';
  
  const usdValue = tokenAmount * tokenPrice;
  
  if (usdValue < 0.01) {
    return '<$0.01';
  }
  
  if (usdValue >= 1000000) {
    return `$${(usdValue / 1000000).toFixed(2)}M`;
  }
  
  if (usdValue >= 1000) {
    return `$${(usdValue / 1000).toFixed(2)}K`;
  }
  
  return `$${usdValue.toFixed(2)}`;
} 