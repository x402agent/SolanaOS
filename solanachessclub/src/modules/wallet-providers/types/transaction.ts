/**
 * Transaction-related type definitions for the embeddedWalletProviders module
 */
import { Connection, Transaction, VersionedTransaction, PublicKey, TransactionInstruction, Signer } from '@solana/web3.js';
import { StandardWallet, UnifiedWallet } from './wallet';

/**
 * Transaction type that can be either a Transaction or VersionedTransaction
 */
export type AnyTransaction = Transaction | VersionedTransaction;

/**
 * Transaction format options
 */
export type TransactionFormat = 
  | { type: 'transaction', transaction: AnyTransaction }
  | { type: 'base64', data: string }
  | { type: 'instructions', instructions: TransactionInstruction[], feePayer: PublicKey, signers?: Signer[] };

/**
 * Transaction provider options - updated for better type handling
 */
export type WalletProvider = 
  | { type: 'privy', provider: any }
  | { type: 'dynamic', walletAddress: string }
  | { type: 'turnkey', provider: any }
  | { type: 'standard', wallet: StandardWallet }
  | { type: 'mwa', walletAddress: string }
  | { type: 'autodetect', provider: UnifiedWallet, currentProvider?: string };

/**
 * Options for sending a transaction
 */
export interface SendTransactionOptions {
  connection: Connection;
  confirmTransaction?: boolean;
  maxRetries?: number;
  statusCallback?: (status: string) => void;
} 