import { Connection, clusterApiUrl } from '@solana/web3.js';

// Use environment variable for RPC URL or fall back to default
export const connection = new Connection(
  process.env.SOLANA_RPC_URL || 
  process.env.HELIUS_STAKED_URL || 
  clusterApiUrl('mainnet-beta')
); 