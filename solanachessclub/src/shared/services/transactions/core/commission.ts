import { PublicKey, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { COMMISSION_PERCENTAGE, COMMISSION_WALLET_ADDRESS } from './constants';

/**
 * Calculates commission amount in lamports based on the transaction amount
 */
export function calculateCommissionLamports(transactionLamports: number): number {
  return Math.floor(transactionLamports * (COMMISSION_PERCENTAGE / 100));
}

/**
 * Creates an instruction to transfer the commission to the commission wallet
 */
export function createCommissionInstruction(
  fromPubkey: PublicKey,
  transactionLamports: number
): TransactionInstruction {
  const commissionLamports = calculateCommissionLamports(transactionLamports);
  
  return SystemProgram.transfer({
    fromPubkey,
    toPubkey: new PublicKey(COMMISSION_WALLET_ADDRESS),
    lamports: commissionLamports,
  });
}

/**
 * Calculates the amount to transfer after commission
 */
export function calculateTransferAmountAfterCommission(
  totalLamports: number
): { transferLamports: number; commissionLamports: number } {
  const commissionLamports = calculateCommissionLamports(totalLamports);
  const transferLamports = totalLamports - commissionLamports;
  
  return {
    transferLamports,
    commissionLamports
  };
} 