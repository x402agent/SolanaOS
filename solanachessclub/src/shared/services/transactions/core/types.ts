import { PublicKey, Connection, Transaction, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
import { StandardWallet } from '@/modules/wallet-providers/types';

/**
 * Transaction modes available in the app
 */
export type TransactionMode = 'jito' | 'priority';

/**
 * Fee tiers for priority transactions
 */
export type FeeTier = 'low' | 'medium' | 'high' | 'very-high';

/**
 * Fee mapping for priority transactions
 */
export interface FeeMapping {
  [key: string]: number;
}

/**
 * Transaction type for success messages
 */
export type TransactionType = 'swap' | 'transfer' | 'stake' | 'nft' | 'token';

/**
 * Status update callback
 */
export type StatusCallback = (status: string) => void;

/**
 * Parameters for sendTransactionWithPriorityFee
 */
export interface SendTransactionParams {
  wallet: StandardWallet | any;
  instructions: TransactionInstruction[];
  connection: Connection;
  shouldUsePriorityFee?: boolean;
  includeCommission?: boolean;
  commissionData?: {
    fromPubkey: PublicKey;
    transactionLamports: number;
  };
  onStatusUpdate?: StatusCallback;
}

/**
 * Parameters for sendSOL
 */
export interface SendSOLParams {
  wallet: StandardWallet | any;
  recipientAddress: string;
  amountSol: number;
  connection: Connection;
  includeCommission?: boolean;
  onStatusUpdate?: StatusCallback;
}

/**
 * Parameters for sending Jito bundle transactions
 */
export interface SendJitoBundleParams {
  provider: any;
  instructions: TransactionInstruction[];
  walletPublicKey: PublicKey;
  connection: Connection;
  onStatusUpdate?: StatusCallback;
}

/**
 * Parameters for Jito bundle MWA
 */
export interface SendJitoBundleMWAParams {
  connection: Connection;
  recipient: string;
  lamports: number;
  onStatusUpdate?: StatusCallback;
}

/**
 * Transaction data for Privy signing
 */
export type TransactionData = {
  type: 'transaction';
  transaction: Transaction | VersionedTransaction;
};

/**
 * Response from Jito bundle API
 */
export interface JitoBundleResponse {
  jsonrpc: string;
  result: string;
  id: number;
} 