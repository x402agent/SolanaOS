/**
 * Token-related types for the onChainData module
 */

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI: string;
  // Additional properties from Birdeye API
  price?: number;
  marketCap?: number;
  volume24h?: number;
  priceChange24h?: number;
  liquidity?: number;
}

export interface TokenPriceInfo {
  price: number;
  lastUpdated?: number;
  source?: string;
}

export type TokenEntry = {
  accountPubkey: string;
  mintPubkey: string;
  uiAmount: number;
  decimals: number;
}; 