import { Platform } from 'react-native';
import {
  PublicKey,
  Connection,
  VersionedTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { TransactionService } from '@/modules/wallet-providers/services/transaction/transactionService';
import { Buffer } from 'buffer';
import {
  createPriorityFeeInstructions,
  getLatestBlockhash,
  createVersionedTransaction,
  verifyTransactionSuccess,
  waitForConfirmation,
  createFilteredStatusCallback,
  extractSignatureFromError,
  isConfirmationError,
  handleTransactionCompletion,
  DEFAULT_FEE_MAPPING,
  COMMISSION_WALLET_ADDRESS,
  calculateCommissionLamports,
  getCurrentFeeTier,
  createCommissionInstruction,
  calculateTransferAmountAfterCommission,
  SendTransactionParams,
} from '../core';

/**
 * Send a transaction directly using MWA (Mobile Wallet Adapter) with priority fees
 */
export async function sendPriorityTransactionMWA(
  connection: Connection,
  recipient: string,
  lamports: number,
  feeMapping: Record<string, number> = DEFAULT_FEE_MAPPING,
  onStatusUpdate?: (status: string) => void,
): Promise<string> {
  onStatusUpdate?.('[sendPriorityTransactionMWA] Starting MWA priority tx');
  console.log(
    '[sendPriorityTransactionMWA] Starting MWA priority tx, recipient=',
    recipient,
    'lamports=',
    lamports
  );

  if (Platform.OS !== 'android') {
    throw new Error('MWA is only supported on Android');
  }

  const mwaModule = require('@solana-mobile/mobile-wallet-adapter-protocol-web3js');
  const {transact} = mwaModule;
  const feeTier = getCurrentFeeTier();
  const microLamports = feeMapping[feeTier] || DEFAULT_FEE_MAPPING.low;

  console.log('[sendPriorityTransactionMWA] microLamports from feeMapping:', microLamports);
  onStatusUpdate?.(`Using ${feeTier} priority fee (${microLamports} microLamports)`);

  return await transact(async (wallet: any) => {
    try {
      console.log('[sendPriorityTransactionMWA] Inside transact callback...');
      onStatusUpdate?.('Authorizing with wallet...');
      
      // Use the correct cluster format with 'solana:' prefix
      const authResult = await wallet.authorize({
        cluster: 'devnet', // Changed from 'solana:devnet' to 'devnet'
        identity: {
          name: 'React Native dApp',
          uri: 'https://yourdapp.com',
          icon: 'favicon.ico',
        },
      });
      console.log('[sendPriorityTransactionMWA] Authorization result:', authResult);

      const {Buffer} = require('buffer');
      const userEncodedPubkey = authResult.accounts[0].address;
      const userPubkeyBytes = Buffer.from(userEncodedPubkey, 'base64');
      const userPubkey = new PublicKey(userPubkeyBytes);
      console.log('[sendPriorityTransactionMWA] userPubkey:', userPubkey.toBase58());
      onStatusUpdate?.(`User public key: ${userPubkey.toBase58().slice(0, 6)}...${userPubkey.toBase58().slice(-4)}`);

      // 2) Build instructions
      console.log('[sendPriorityTransactionMWA] Building instructions...');
      onStatusUpdate?.('Building transaction...');
      const toPublicKey = new PublicKey(recipient);
      
      // Calculate commission amount
      const { transferLamports, commissionLamports } = calculateTransferAmountAfterCommission(lamports);
      
      // Create transfer instruction for the main amount (minus commission)
      const transferIx = SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: toPublicKey,
        lamports: transferLamports,
      });
      
      // Create commission transfer instruction
      const commissionIx = SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: new PublicKey(COMMISSION_WALLET_ADDRESS),
        lamports: commissionLamports,
      });

      // Create priority fee instructions
      const priorityInstructions = createPriorityFeeInstructions(feeMapping);
      
      const instructions = [
        ...priorityInstructions,
        transferIx,
        commissionIx,
      ];
      console.log('[sendPriorityTransactionMWA] Instructions created:', instructions.length);

      // 3) Build transaction with retry logic for blockhash
      console.log('[sendPriorityTransactionMWA] Fetching latest blockhash...');
      
      // Get the latest blockhash
      const { blockhash, lastValidBlockHeight } = await getLatestBlockhash(connection);
      console.log('[sendPriorityTransactionMWA] blockhash:', blockhash);

      // Build the transaction
      const transaction = await createVersionedTransaction(userPubkey, instructions, connection);
      console.log('[sendPriorityTransactionMWA] Compiled transaction (MWA)', transaction);

      // Try using signTransactions first, then manually submit
      console.log('[sendPriorityTransactionMWA] Calling wallet.signTransactions()...');
      onStatusUpdate?.('Requesting signature from wallet...');
      const signedTransactions = await wallet.signTransactions({
        transactions: [transaction],
      });
      console.log('[sendPriorityTransactionMWA] signTransactions returned signed transactions');

      if (!signedTransactions?.length) {
        throw new Error('No signed transactions returned from signTransactions');
      }
      
      // Now submit the signed transaction
      const signedTx = signedTransactions[0];
      console.log('[sendPriorityTransactionMWA] Submitting signed transaction to network...');
      onStatusUpdate?.('Submitting transaction to network...');
      
      // Send transaction with retry logic
      const sendTransaction = async (tx: VersionedTransaction, retries = 3): Promise<string> => {
        try {
          return await connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          });
        } catch (error) {
          if (retries > 0) {
            console.log(`Failed to send transaction, retrying... (${retries} attempts left)`);
            // Wait a short time before retrying
            await new Promise(resolve => setTimeout(resolve, 500));
            return sendTransaction(tx, retries - 1);
          }
          throw error;
        }
      };
      
      const signature = await sendTransaction(signedTx);
      console.log('[sendPriorityTransactionMWA] Got signature:', signature);

      // Start confirmation process in background
      waitForConfirmation(
        signature, 
        connection, 
        onStatusUpdate,
        undefined,
        undefined,
        blockhash,
        lastValidBlockHeight
      )
        .then(isSuccess => {
          handleTransactionCompletion(signature, isSuccess, 'transfer');
        })
        .catch(error => {
          console.error('[sendPriorityTransactionMWA] Error in confirmation:', error);
        });

      return signature;
    } catch (error: any) {
      console.log('[sendPriorityTransactionMWA] Caught error inside transact callback:', error);
      // Don't send raw error details in status update
      onStatusUpdate?.('Transaction failed');
      TransactionService.showError(error);
      throw error;
    }
  });
}

/**
 * Sends a transaction with priority fee settings
 */
export async function sendTransactionWithPriorityFee({
  wallet,
  instructions,
  connection,
  shouldUsePriorityFee = true,
  includeCommission = true,
  commissionData,
  onStatusUpdate,
}: SendTransactionParams): Promise<string> {
  try {
    // 1. Create all instructions
    let allInstructions = [...instructions];
    
    // Add priority fee instructions if requested
    if (shouldUsePriorityFee) {
      const priorityInstructions = createPriorityFeeInstructions();
      allInstructions = [...priorityInstructions, ...allInstructions];
      onStatusUpdate?.(`Using ${getCurrentFeeTier()} priority fee`);
    }
    
    // Add commission instruction if requested and commission data is provided
    if (includeCommission && commissionData) {
      const commissionIx = createCommissionInstruction(
        commissionData.fromPubkey,
        commissionData.transactionLamports
      );
      allInstructions.push(commissionIx);
      onStatusUpdate?.(`Adding 0.5% commission (${calculateCommissionLamports(commissionData.transactionLamports) / LAMPORTS_PER_SOL} SOL)`);
    }
    
    // 2. Get wallet public key
    let walletPublicKey: PublicKey;
    
    if (wallet.publicKey) {
      walletPublicKey = new PublicKey(wallet.publicKey);
    } else if (wallet.address) {
      walletPublicKey = new PublicKey(wallet.address);
    } else {
      throw new Error('No wallet public key or address found');
    }
    
    // 3. Create transaction
    onStatusUpdate?.('Creating transaction...');
    
    // Get blockhash and create versioned transaction
    const { blockhash, lastValidBlockHeight } = await getLatestBlockhash(connection);
    const transaction = await createVersionedTransaction(walletPublicKey, allInstructions, connection);
    
    // 4. Sign and send transaction using TransactionService
    onStatusUpdate?.('Signing transaction...');
    
    // Create a wrapped status callback that filters error messages
    const statusCallback = createFilteredStatusCallback(onStatusUpdate);
    
    // Sign and send the transaction
    console.log('[sendTransactionWithPriorityFee] Sending transaction...');
    const signature = await TransactionService.signAndSendTransaction(
      { type: 'transaction', transaction },
      wallet,
      { 
        connection,
        statusCallback
      }
    );
    
    console.log('[sendTransactionWithPriorityFee] Transaction sent with signature:', signature);
    
    // Start confirmation process in background
    waitForConfirmation(
      signature, 
      connection, 
      onStatusUpdate,
      undefined,
      undefined,
      blockhash,
      lastValidBlockHeight
    )
      .then(isSuccess => {
        handleTransactionCompletion(signature, isSuccess, 'transfer');
      })
      .catch(error => {
        console.error('[sendTransactionWithPriorityFee] Error in confirmation promise:', error);
      });

    // Return the signature immediately for better UX
    return signature;
  } catch (error: any) {
    console.error('[sendTransactionWithPriorityFee] Error:', error);
    
    // Check if we can extract a signature from the error
    const signature = extractSignatureFromError(error);
    if (signature) {
      console.log('[sendTransactionWithPriorityFee] Extracted signature from error:', signature);
      onStatusUpdate?.(`Transaction sent. Check explorer for status: ${signature.slice(0, 8)}...`);
      handleTransactionCompletion(signature, null, 'transfer');
      return signature;
    }
    
    // Check if error might be just confirmation-related
    if (isConfirmationError(error)) {
      if (error.signature) {
        onStatusUpdate?.(`Transaction sent. Check explorer for status: ${error.signature.slice(0, 8)}...`);
        handleTransactionCompletion(error.signature, null, 'transfer');
        return error.signature;
      }
    }
    
    // Only show a generic error in the status update
    onStatusUpdate?.('Transaction failed');
    TransactionService.showError(error);
    throw error;
  }
} 