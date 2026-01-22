import { COMMISSION_WALLET } from '@env';
import { FeeMapping } from './types';
import { ENDPOINTS } from '@/shared/config/constants';

/**
 * Default fee mapping for priority transactions
 */
export const DEFAULT_FEE_MAPPING: FeeMapping = {
  'low': 1_000,
  'medium': 10_000,
  'high': 100_000,
  'very-high': 1_000_000,
};

/**
 * Commission wallet to receive percentage of transaction amounts
 */
export const COMMISSION_WALLET_ADDRESS = COMMISSION_WALLET;

/**
 * Commission percentage (0.5%)
 */
export const COMMISSION_PERCENTAGE = 0.5;

/**
 * Jito bundling endpoint URL
 */
export const JITO_BUNDLE_URL = ENDPOINTS.jito?.blockEngine || '';

/**
 * Retry configuration for transaction operations
 */
export const TRANSACTION_RETRIES = {
  maxAttempts: 6,
  interval: 1500,
  confirmationAttempts: 3,
  confirmationInterval: 1000,
  blockhashAttempts: 3,
  blockhashInterval: 500,
}; 