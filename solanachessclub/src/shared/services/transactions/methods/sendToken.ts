import { Platform } from 'react-native';
import {
  PublicKey,
  Connection,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { TransactionService } from '@/modules/wallet-providers/services/transaction/transactionService';
import { TokenInfo } from '@/modules/data-module';
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

export interface SendTokenParams {
  wallet: any;
  recipientAddress: string;
  amount: number;
  tokenInfo: TokenInfo;
  connection: Connection;
  includeCommission?: boolean;
  onStatusUpdate?: (status: string) => void;
}

/**
 * Sends tokens (SOL or SPL) to a recipient with the current transaction mode settings
 */
export async function sendToken({
  wallet,
  recipientAddress,
  amount,
  tokenInfo,
  connection,
  includeCommission = false,
  onStatusUpdate,
}: SendTokenParams): Promise<string> {
  // Validate inputs
  if (!wallet) {
    throw new Error('No wallet provided');
  }
  
  if (!recipientAddress) {
    throw new Error('No recipient address provided');
  }
  
  if (!amount || amount <= 0) {
    throw new Error('Invalid token amount');
  }

  if (!tokenInfo) {
    throw new Error('No token info provided');
  }

  onStatusUpdate?.(`Preparing ${tokenInfo.symbol} transfer...`);
  
  try {
    // Check if it's SOL or SPL token
    const isSOL = tokenInfo.symbol === 'SOL' || 
                  tokenInfo.address === 'So11111111111111111111111111111111111111112';

    if (isSOL) {
      // Use existing SOL transfer logic
      const { sendSOL } = require('./sendSOL');
      return await sendSOL({
        wallet,
        recipientAddress,
        amountSol: amount,
        connection,
        includeCommission,
        onStatusUpdate,
      });
    } else {
      // Handle SPL token transfer
      return await sendSPLToken({
        wallet,
        recipientAddress,
        amount,
        tokenInfo,
        connection,
        includeCommission,
        onStatusUpdate,
      });
    }
  } catch (err: any) {
    console.error('Error during token transfer:', err);
    
    // Extract transaction signature from error if available
    const signature = extractSignatureFromError(err);
    if (signature) {
      onStatusUpdate?.('Transaction submitted, confirming...');
      
      try {
        // Wait for confirmation with polling
        const { waitForConfirmation } = require('../core/helpers');
        await waitForConfirmation(signature, connection, onStatusUpdate);
        onStatusUpdate?.('Transaction confirmed!');
        return signature;
      } catch (confirmErr: any) {
        if (isConfirmationError(confirmErr)) {
          onStatusUpdate?.('Transaction confirmed (timeout reached)!');
          return signature;
        }
        throw confirmErr;
      }
    }
    
    throw err;
  }
}

/**
 * Sends SPL tokens to a recipient
 */
async function sendSPLToken({
  wallet,
  recipientAddress,
  amount,
  tokenInfo,
  connection,
  includeCommission = false,
  onStatusUpdate,
}: SendTokenParams): Promise<string> {
  try {
    // Create recipient PublicKey
    const recipient = new PublicKey(recipientAddress);
    const fromPubkey = new PublicKey(wallet.address || wallet.publicKey);
    const mintPubkey = new PublicKey(tokenInfo.address);
    
    // Convert amount to token lamports (considering token decimals)
    const tokenLamports = Math.floor(amount * Math.pow(10, tokenInfo.decimals));
    
    // Calculate commission if enabled
    const { transferLamports, commissionLamports } = includeCommission 
      ? calculateTransferAmountAfterCommission(tokenLamports) 
      : { transferLamports: tokenLamports, commissionLamports: 0 };
    
    if (includeCommission) {
      onStatusUpdate?.(`Sending ${amount * (1 - 0.5/100)} ${tokenInfo.symbol} to ${recipientAddress.slice(0, 6)}... with 0.5% commission`);
    } else {
      onStatusUpdate?.(`Sending ${amount} ${tokenInfo.symbol} to ${recipientAddress.slice(0, 6)}...`);
    }
    
    // Get token accounts
    const fromTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      fromPubkey
    );
    
    const toTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      recipient
    );
    
    // Create transaction
    const transaction = new Transaction();
    
    // Check if recipient token account exists
    const recipientAccountInfo = await connection.getAccountInfo(toTokenAccount);
    if (!recipientAccountInfo) {
      onStatusUpdate?.(`Creating token account for recipient...`);
      // Create associated token account for recipient
      const createAccountInstruction = createAssociatedTokenAccountInstruction(
        fromPubkey, // payer
        toTokenAccount, // ata
        recipient, // owner
        mintPubkey // mint
      );
      transaction.add(createAccountInstruction);
    }
    
    // Create transfer instruction for main amount (minus commission)
    const transferInstruction = createTransferInstruction(
      fromTokenAccount, // source
      toTokenAccount, // destination
      fromPubkey, // owner
      transferLamports // amount
    );
    transaction.add(transferInstruction);
    
    // Add commission transfer if enabled (in SOL)
    if (includeCommission && commissionLamports > 0) {
      const commissionInstruction = SystemProgram.transfer({
        fromPubkey,
        toPubkey: new PublicKey(process.env.COMMISSION_WALLET || 'YOUR_COMMISSION_WALLET'),
        lamports: Math.floor(commissionLamports * LAMPORTS_PER_SOL / Math.pow(10, tokenInfo.decimals)), // Convert back to SOL lamports
      });
      transaction.add(commissionInstruction);
    }
    
    // Get current transaction mode
    const transactionMode = getCurrentTransactionMode();
    
    let signature: string;
    
    // Create filtered status callback
    const filteredCallback = createFilteredStatusCallback(onStatusUpdate);
    
    // Set blockhash and fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;
    
    // Send transaction using the transaction service
    onStatusUpdate?.('Sending transaction for approval...');
    signature = await TransactionService.signAndSendTransaction(
      { type: 'transaction', transaction },
      wallet,
      { 
        connection,
        statusCallback: filteredCallback
      }
    );
    
    onStatusUpdate?.('Transaction confirmed!');
    return signature;
    
  } catch (err: any) {
    console.error('Error in sendSPLToken:', err);
    throw err;
  }
} 