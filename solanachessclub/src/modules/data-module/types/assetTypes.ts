/**
 * Asset-related types for the onChainData module
 */

export interface AssetItem {
  id: string;
  content?: {
    json_uri?: string;
    metadata?: any;
    files?: any[];
    links?: any;
  };
  authorities?: any[];
  compression?: {
    compressed: boolean;
    data_hash: string;
    creator_hash: string;
    eligible: boolean;
    leaf_id: number;
    tree_id: string;
  };
  grouping?: any[];
  royalty?: {
    basis_points: number;
    primary_sale_happened: boolean;
    target: string;
  };
  creators?: any[];
  ownership?: {
    owner: string;
    delegate: string;
    delegated: boolean;
    burnt: boolean;
    supply: number;
    mutable: boolean;
  };
  uses?: any;
  supply?: any;
  interface: string;
  links?: any;
  mint: string;
  name: string;
  symbol: string;
  collection?: {
    name?: string;
    family?: string;
  };
  attributes?: any[];
  image?: string;
  description?: string;
  token_info?: {
    symbol: string;
    balance: string;
    decimals: number;
    token_program: string;
    price_info?: {
      price_per_token?: number;
      total_price?: number;
    };
  };
  inscription?: any;
  spl20?: any;
  assetType?: 'token' | 'nft' | 'cnft' | 'defi';
}

export interface PortfolioData {
  items: AssetItem[];
  nativeBalance?: {
    lamports: number;
  };
  total: number;
  limit: number;
  page: number;
  error?: string;
} 