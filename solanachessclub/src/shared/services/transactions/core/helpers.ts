import { store } from '@/shared/state/store';
import { 
  PublicKey,
  Connection,
  TransactionInstruction,
  ComputeBudgetProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { TransactionService } from '@/modules/wallet-providers/services/transaction/transactionService';
import { FeeMapping, FeeTier, TransactionMode, TransactionType, StatusCallback } from './types';
import { DEFAULT_FEE_MAPPING, TRANSACTION_RETRIES } from './constants';

/**
 * Gets the current transaction mode from Redux state
 */
export function getCurrentTransactionMode(): TransactionMode {
  return store.getState().transaction.transactionMode;
}

/**
 * Gets the current fee tier from Redux state
 */
export function getCurrentFeeTier(): FeeTier {
  return store.getState().transaction.selectedFeeTier;
}

/**
 * Gets the microLamports value for the current fee tier
 */
export function getCurrentFeeMicroLamports(feeMapping = DEFAULT_FEE_MAPPING): number {
  const feeTier = getCurrentFeeTier();
  return feeMapping[feeTier] || feeMapping.medium;
}

/**
 * Creates priority fee instructions based on the current fee tier
 */
export function createPriorityFeeInstructions(
  feeMapping = DEFAULT_FEE_MAPPING
): TransactionInstruction[] {
  const feeTier = getCurrentFeeTier();
  const microLamports = feeMapping[feeTier] || feeMapping.medium;
  
  // Set compute unit limit (same for all transactions)
  const computeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 2_000_000,
  });
  
  // Set compute unit price based on selected fee tier
  const computeUnitPriceIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports,
  });
  
  return [computeUnitLimitIx, computeUnitPriceIx];
}

/**
 * Get the latest blockhash with retry logic
 */
export async function getLatestBlockhash(
  connection: Connection,
  retries = TRANSACTION_RETRIES.blockhashAttempts
): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  try {
    return await connection.getLatestBlockhash('confirmed');
  } catch (error: any) {
    if (retries > 0) {
      console.log(`Failed to get latest blockhash, retrying... (${retries} attempts left)`);
      // Wait a short time before retrying
      await new Promise(resolve => setTimeout(resolve, TRANSACTION_RETRIES.blockhashInterval));
      return getLatestBlockhash(connection, retries - 1);
    }
    throw new Error(`Failed to get latest blockhash after multiple attempts: ${error.message}`);
  }
}

/**
 * Create a versioned transaction from instructions
 */
export async function createVersionedTransaction(
  walletPublicKey: PublicKey, 
  instructions: TransactionInstruction[],
  connection: Connection
): Promise<VersionedTransaction> {
  const { blockhash } = await getLatestBlockhash(connection);
  
  const messageV0 = new TransactionMessage({
    payerKey: walletPublicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();
  
  return new VersionedTransaction(messageV0);
}

/**
 * Verify transaction success through various methods
 * Returns: true (success), false (failure), null (inconclusive)
 */
export async function verifyTransactionSuccess(
  signature: string, 
  connection: Connection,
  blockhash?: string,
  lastValidBlockHeight?: number
): Promise<boolean | null> {
  try {
    console.log(`[verifyTransactionSuccess] Checking transaction: ${signature}`);
    
    // 1. Check signature status (fastest)
    try {
      const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
      if (status && status.value) {
        if (!status.value.err) {
          // Success if confirmed or finalized
          if (status.value.confirmationStatus === 'confirmed' || status.value.confirmationStatus === 'finalized') {
            console.log(`[verifyTransactionSuccess] Verified Success (status: ${status.value.confirmationStatus})`);
            return true;
          }
          // Continue to next check
        } else {
          // Explicit error found
          console.error(`[verifyTransactionSuccess] Verified Failure (status error)`, status.value.err);
          return false;
        }
      }
    } catch (e) {
      // Continue to next check
    }

    // 2. Check getTransaction (more reliable)
    try {
      const txResponse = await connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });
      if (txResponse) {
        if (!txResponse.meta?.err) {
          console.log(`[verifyTransactionSuccess] Verified Success (getTransaction)`);
          return true;
        }
        console.error(`[verifyTransactionSuccess] Verified Failure (getTransaction)`, txResponse.meta.err);
        return false;
      }
    } catch (e) {
      // Continue to next check
    }

    // 3. Final attempt: confirmTransaction 
    if (blockhash && lastValidBlockHeight) {
      try {
        const confirmation = await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');
        
        if (!confirmation.value.err) {
          console.log(`[verifyTransactionSuccess] Verified Success (confirmTransaction)`);
          return true;
        }
        console.error(`[verifyTransactionSuccess] Verified Failure (confirmTransaction)`, confirmation.value.err);
        return false;
      } catch (e) {
        // Failed, continue
      }
    }

    // All methods inconclusive
    return null;
  } catch (error) {
    console.error(`[verifyTransactionSuccess] Verification error:`, error);
    return null;
  }
}

/**
 * Wait for transaction to be confirmed with timeout
 */
export async function waitForConfirmation(
  signature: string,
  connection: Connection,
  onStatusUpdate?: StatusCallback,
  maxAttempts = TRANSACTION_RETRIES.maxAttempts,
  interval = TRANSACTION_RETRIES.interval,
  blockhash?: string,
  lastValidBlockHeight?: number
): Promise<boolean | null> {
  // Show transaction as sent (optimistic UI)
  onStatusUpdate?.(`Transaction sent: ${signature.slice(0, 8)}...`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    console.log(`[waitForConfirmation] Attempt ${attempt + 1}/${maxAttempts} for ${signature}`);
    
    // Show verifying status occasionally
    if (attempt > 0 && attempt % 2 === 0) {
      onStatusUpdate?.(`Verifying transaction...`);
    }

    const verificationResult = await verifyTransactionSuccess(
      signature, 
      connection,
      blockhash,
      lastValidBlockHeight
    );
    
    if (verificationResult === true) {
      console.log(`[waitForConfirmation] Transaction verified successfully`);
      onStatusUpdate?.(`Transaction confirmed successfully!`);
      return true;
    } else if (verificationResult === false) {
      console.error(`[waitForConfirmation] Transaction failed verification`);
      onStatusUpdate?.(`Transaction failed. Check explorer for details: ${signature.slice(0, 8)}...`);
      return false;
    }
    
    // If inconclusive (null), wait and retry
    if (attempt < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  console.warn(`[waitForConfirmation] Verification inconclusive after ${maxAttempts} attempts`);
  onStatusUpdate?.(`Transaction sent. Check explorer for status: ${signature.slice(0, 8)}...`);
  return null;
}

/**
 * Creates a filtered status callback that only passes non-error messages
 */
export function createFilteredStatusCallback(
  originalCallback?: StatusCallback
): StatusCallback | undefined {
  if (!originalCallback) return undefined;
  
  return (status: string) => {
    if (!status.startsWith('Error:')) {
      originalCallback(status);
    } else {
      originalCallback('Processing transaction...');
    }
  };
}

/**
 * Extract transaction signature from error message if possible
 */
export function extractSignatureFromError(error: any): string | null {
  if (!error || !error.message) return null;
  
  const signatureMatch = error.message.match(/(\w{32,})/);
  if (signatureMatch && signatureMatch[0]) {
    console.log('[extractSignatureFromError] Extracted signature:', signatureMatch[0]);
    return signatureMatch[0];
  }
  
  if (error.signature && typeof error.signature === 'string') {
    return error.signature;
  }
  
  return null;
}

/**
 * Check if error might be just a confirmation issue rather than a transaction failure
 */
export function isConfirmationError(error: any): boolean {
  if (!error || !error.message) return false;
  
  return error.message.includes('confirmation') || 
    error.message.includes('timeout') ||
    error.message.includes('blockhash') ||
    error.message.includes('retries');
}

/**
 * Handle transaction completion (success, failure, or inconclusive)
 */
export function handleTransactionCompletion(
  signature: string,
  isSuccess: boolean | null,
  txType?: TransactionType
): void {
  if (isSuccess === true) {
    TransactionService.showSuccess(signature, txType);
  } else if (isSuccess === false) {
    console.error(`[handleTransactionCompletion] Explicit failure for ${signature}`);
  } else {
    // Inconclusive (null) - Treat as likely success for better UX
    console.log(`[handleTransactionCompletion] Verification inconclusive for ${signature}, assuming success for UX.`);
    // Show success toast optimistically
    TransactionService.showSuccess(signature, txType);
  }
} 