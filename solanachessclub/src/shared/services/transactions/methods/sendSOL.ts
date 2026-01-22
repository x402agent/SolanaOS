import { Platform } from 'react-native';
import {
  PublicKey,
  Connection,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { TransactionService } from '@/modules/wallet-providers/services/transaction/transactionService';
import {
  SendSOLParams,
  calculateTransferAmountAfterCommission,
  createFilteredStatusCallback,
  extractSignatureFromError,
  isConfirmationError,
  DEFAULT_FEE_MAPPING,
} from '../core';
import { sendPriorityTransactionMWA } from './priority';
import { sendTransactionWithPriorityFee } from './priority';
import { getCurrentTransactionMode } from '../core';

/**
 * Sends SOL to a recipient with the current transaction mode settings
 */
export async function sendSOL({
  wallet,
  recipientAddress,
  amountSol,
  connection,
  includeCommission = false,
  onStatusUpdate,
}: SendSOLParams): Promise<string> {
  // Validate inputs
  if (!wallet) {
    throw new Error('No wallet provided');
  }
  
  if (!recipientAddress) {
    throw new Error('No recipient address provided');
  }
  
  if (!amountSol || amountSol <= 0) {
    throw new Error('Invalid SOL amount');
  }

  onStatusUpdate?.('Preparing SOL transfer...');
  
  try {
    // Create recipient PublicKey
    const recipient = new PublicKey(recipientAddress);
    
    // Convert SOL to lamports
    const totalLamports = Math.floor(amountSol * LAMPORTS_PER_SOL);
    
    // Calculate commission if enabled
    const { transferLamports, commissionLamports } = includeCommission 
      ? calculateTransferAmountAfterCommission(totalLamports) 
      : { transferLamports: totalLamports, commissionLamports: 0 };
    
    if (includeCommission) {
      onStatusUpdate?.(`Sending ${amountSol * (1 - 0.5/100)} SOL to ${recipientAddress.slice(0, 6)}... with 0.5% commission`);
    } else {
      onStatusUpdate?.(`Sending ${amountSol} SOL (${totalLamports} lamports) to ${recipientAddress.slice(0, 6)}...`);
    }
    
    // Get current transaction mode
    const transactionMode = getCurrentTransactionMode();
    
    // Create transfer instruction for main amount (minus commission)
    const fromPubkey = new PublicKey(wallet.address || wallet.publicKey);
    const transferInstruction = SystemProgram.transfer({
      fromPubkey,
      toPubkey: recipient,
      lamports: transferLamports,
    });
    
    let signature: string;
    
    // Special handling for MWA wallet (on Android)
    if (wallet.provider === 'mwa' || Platform.OS === 'android') {
      onStatusUpdate?.('Using Mobile Wallet Adapter...');
      try {
        signature = await sendPriorityTransactionMWA(
          connection,
          recipientAddress,
          totalLamports, // The MWA function handles the commission internally
          DEFAULT_FEE_MAPPING,
          // Filter out error messages from status updates
          createFilteredStatusCallback(onStatusUpdate)
        );
      } catch (error: any) {
        // Check if the error contains a transaction signature
        const extractedSignature = extractSignatureFromError(error);
        if (extractedSignature) {
          // We have a signature, so the transaction was likely submitted
          signature = extractedSignature;
          console.log('[sendSOL] Extracted signature from error:', signature);
          onStatusUpdate?.(`Transaction sent. Check explorer for status: ${signature.slice(0, 8)}...`);
          // Show success to the user
          TransactionService.showSuccess(signature, 'transfer');
          return signature;
        }
        
        // Check if error might be just confirmation-related
        if (isConfirmationError(error)) {
          console.log('[sendSOL] MWA confirmation issue, transaction might still succeed:', error);
          // Don't show an error, just inform the user
          if (error.signature) {
            onStatusUpdate?.(`Transaction sent. Check explorer for status: ${error.signature.slice(0, 8)}...`);
            TransactionService.showSuccess(error.signature, 'transfer');
            return error.signature;
          } else {
            onStatusUpdate?.('Transaction sent, check block explorer for status');
            return 'unknown';
          }
        }
        
        console.error('[sendSOL] MWA transaction failed:', error);
        TransactionService.showError(error);
        throw error;
      }
    } else {
      // For non-MWA wallets, use standard flow with appropriate transaction mode
      try {
        signature = await sendTransactionWithPriorityFee({
          wallet,
          instructions: [transferInstruction],
          connection,
          // Only apply priority fee if in priority mode
          shouldUsePriorityFee: transactionMode === 'priority',
          includeCommission,
          commissionData: includeCommission ? {
            fromPubkey,
            transactionLamports: totalLamports
          } : undefined,
          // Filter out error messages from status updates
          onStatusUpdate: createFilteredStatusCallback(onStatusUpdate),
        });
      } catch (error: any) {
        // Check if the error contains a transaction signature
        const extractedSignature = extractSignatureFromError(error);
        if (extractedSignature) {
          // We have a signature, so the transaction was likely submitted
          signature = extractedSignature;
          console.log('[sendSOL] Extracted signature from error:', signature);
          onStatusUpdate?.(`Transaction sent. Check explorer for status: ${signature.slice(0, 8)}...`);
          // Show success to the user
          TransactionService.showSuccess(signature, 'transfer');
          return signature;
        }
        
        // Check if error might be just confirmation-related
        if (isConfirmationError(error)) {
          console.log('[sendSOL] Confirmation issue, transaction might still succeed:', error);
          // Instead of throwing, return a signature if we have one
          if (error.signature) {
            onStatusUpdate?.(`Transaction sent. Check explorer for status: ${error.signature.slice(0, 8)}...`);
            TransactionService.showSuccess(error.signature, 'transfer');
            return error.signature;
          }
        }
        
        console.error('[sendSOL] Error:', error);
        // Don't send raw error through the status update
        onStatusUpdate?.('Transaction failed');
        TransactionService.showError(error);
        throw error;
      }
    }
    
    // If we reach here, we have a signature
    console.log('[sendSOL] Transaction successful with signature:', signature);
    onStatusUpdate?.(`Transaction sent: ${signature.slice(0, 8)}...`);
    TransactionService.showSuccess(signature, 'transfer');
    return signature;
  } catch (error: any) {
    console.error('[sendSOL] Unhandled error:', error);
    // Don't send raw error through the status update
    onStatusUpdate?.('Transaction failed');
    TransactionService.showError(error);
    throw error;
  }
} 