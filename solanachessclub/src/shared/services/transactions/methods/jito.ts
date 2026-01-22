import { Platform } from 'react-native';
import {
  PublicKey,
  Connection,
  VersionedTransaction,
  SystemProgram,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { TransactionService } from '@/modules/wallet-providers/services/transaction/transactionService';
import { Buffer } from 'buffer';
import { CLUSTER } from '@env';
import {
  getLatestBlockhash,
  createVersionedTransaction,
  waitForConfirmation,
  createFilteredStatusCallback,
  handleTransactionCompletion,
  JitoBundleResponse,
  JITO_BUNDLE_URL,
  SendJitoBundleParams,
  SendJitoBundleMWAParams,
} from '../core';

/**
 * Sends a bundle of signed transactions to Jito's block engine.
 */
export async function sendJitoBundle(
  transactions: VersionedTransaction[],
): Promise<JitoBundleResponse> {
  console.log('[sendJitoBundle] Preparing to send bundle.');

  if (!JITO_BUNDLE_URL) {
    throw new Error('Jito bundle URL not configured');
  }

  // Convert transactions to base64 strings.
  const base64Txns = transactions.map((tx, index) => {
    const serializedTx = tx.serialize();
    const base64Tx = Buffer.from(serializedTx).toString('base64');
    console.log(
      `[sendJitoBundle] Serialized transaction ${index + 1}: ${base64Tx}`,
    );
    return base64Tx;
  });

  // Prepare the bundle request.
  const bundleRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'sendBundle',
    params: [base64Txns, { encoding: 'base64' }],
  };

  console.log(
    '[sendJitoBundle] Bundle request:',
    JSON.stringify(bundleRequest, null, 2),
  );

  // Send the bundle to Jito's block engine.
  const response = await fetch(JITO_BUNDLE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bundleRequest),
  });

  const responseBody = await response.json();
  console.log(
    '[sendJitoBundle] Response body:',
    JSON.stringify(responseBody, null, 2),
  );

  return responseBody;
}

/**
 * Retrieves Solscan links for each transaction in the bundle.
 * @param bundleId - The bundle ID returned by sendJitoBundle.
 * @returns An array of Solscan transaction links.
 */
export async function getSolscanLinks(bundleId: string): Promise<string[]> {
  if (!JITO_BUNDLE_URL) {
    throw new Error('Jito bundle URL not configured');
  }

  const url = `${JITO_BUNDLE_URL}/api/v1/getBundleStatuses`;
  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getBundleStatuses',
    params: [[bundleId]],
  };

  // We'll try a few times, because there's often a delay before
  // the block engine returns transaction signatures.
  let attempts = 0;
  const maxAttempts = 10;
  const delayMs = 2000; // 2 seconds between polls

  while (attempts < maxAttempts) {
    attempts += 1;
    console.log(`[getSolscanLinks] Attempt ${attempts} of ${maxAttempts}...`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log(
      '[getSolscanLinks] Bundle status response:',
      JSON.stringify(result, null, 2),
    );

    if (
      result &&
      result.result &&
      result.result.value &&
      result.result.value.length > 0
    ) {
      const bundleResult = result.result.value[0];
      // Once we have "transactions", return the links immediately.
      if (bundleResult.transactions && bundleResult.transactions.length > 0) {
        return bundleResult.transactions.map(
          (txSignature: string) => `https://solscan.io/tx/${txSignature}`,
        );
      }
    }

    // If we didn't get any signatures yet, wait and try again
    console.log('[getSolscanLinks] No transaction signatures yet. Retrying...');
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  // If still no signatures, give up and return empty.
  console.warn(
    '[getSolscanLinks] Could not find transaction signatures after polling.',
  );
  return [];
}

/**
 * Sends a transaction via a Jito bundle
 */
export async function sendJitoBundleTransaction({
  provider,
  instructions,
  walletPublicKey,
  connection,
  onStatusUpdate,
}: SendJitoBundleParams): Promise<string> {
  console.log('[sendJitoBundleTransaction] Starting embedded Jito tx...');
  onStatusUpdate?.('Preparing Jito bundle transaction...');
  
  try {
    // Add compute unit limit instruction
    const computeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 2_000_000 });
    const allInstructions = [computeUnitLimitIx, ...instructions];

    // Create transaction
    onStatusUpdate?.('Creating transaction...');
    const transaction = await createVersionedTransaction(walletPublicKey, allInstructions, connection);
    
    // Sign and send transaction
    onStatusUpdate?.('Signing transaction...');
    console.log('[sendJitoBundleTransaction] signAndSendTransaction...');
    const {signature} = await provider.request({
      method: 'signAndSendTransaction',
      params: {
        transaction,
        connection,
      },
    });
    
    console.log('[sendJitoBundleTransaction] signAndSendTransaction returned signature:', signature);
    if (!signature) {
      throw new Error('No signature from signAndSendTransaction');
    }

    // Start confirmation process in background
    onStatusUpdate?.(`Transaction sent: ${signature.slice(0, 8)}...`);
    waitForConfirmation(signature, connection, onStatusUpdate)
      .then(isSuccess => {
        handleTransactionCompletion(signature, isSuccess);
      })
      .catch(error => {
        console.error('[sendJitoBundleTransaction] Error in confirmation:', error);
      });
     
    return signature;
  } catch (error) {
    console.error('[sendJitoBundleTransaction] Error during transaction:', error);
    onStatusUpdate?.('Transaction failed');
    TransactionService.showError(error);
    throw error;
  }
}

/**
 * Sends a transaction via MWA with Jito bundling
 */
export async function sendJitoBundleTransactionMWA({
  connection,
  recipient,
  lamports,
  onStatusUpdate,
}: SendJitoBundleMWAParams): Promise<string> {
  console.log('[sendJitoBundleTransactionMWA] Starting MWA Jito tx, recipient=', recipient, 'lamports=', lamports);
  onStatusUpdate?.('Preparing Jito bundle transaction...');
  
  if (Platform.OS !== 'android') {
    throw new Error('MWA is only supported on Android for Jito as well.');
  }

  const mwaModule = require('@solana-mobile/mobile-wallet-adapter-protocol-web3js');
  const {transact} = mwaModule;

  return await transact(async (mobileWallet: any) => {
    try {
      console.log('[sendJitoBundleTransactionMWA] Inside transact callback, authorizing...');
      onStatusUpdate?.('Authorizing with wallet...');
      
      const authResult = await mobileWallet.authorize({
        cluster: CLUSTER,
        identity: {
          name: 'React Native dApp',
          uri: 'https://yourdapp.com',
          icon: 'favicon.ico',
        },
      });
      console.log('[sendJitoBundleTransactionMWA] Auth result:', authResult);

      const {Buffer} = require('buffer');
      const userEncodedPubkey = authResult.accounts[0].address;
      const userPubkeyBytes = Buffer.from(userEncodedPubkey, 'base64');
      const userPubkey = new PublicKey(userPubkeyBytes);
      console.log('[sendJitoBundleTransactionMWA] userPubkey:', userPubkey.toBase58());
      onStatusUpdate?.(`User public key: ${userPubkey.toBase58().slice(0, 6)}...${userPubkey.toBase58().slice(-4)}`);

      // Build instructions
      onStatusUpdate?.('Building transaction...');
      const computeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 2_000_000,
      });
      const transferIx = SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: new PublicKey(recipient),
        lamports,
      });
      const instructions = [computeUnitLimitIx, transferIx];
      console.log('[sendJitoBundleTransactionMWA] instructions count:', instructions.length);

      // Create transaction
      const { blockhash, lastValidBlockHeight } = await getLatestBlockhash(connection);
      const transaction = await createVersionedTransaction(userPubkey, instructions, connection);
      console.log('[sendJitoBundleTransactionMWA] compiled transaction:', transaction);

      // Sign transaction
      onStatusUpdate?.('Requesting signature from wallet...');
      console.log('[sendJitoBundleTransactionMWA] signTransactions...');
      const signedTxs = await mobileWallet.signTransactions({
        transactions: [transaction],
      });
      console.log('[sendJitoBundleTransactionMWA] signTransactions returned signed transactions');

      if (!signedTxs || !signedTxs.length) {
        throw new Error('No signed transactions returned from signTransactions');
      }
      
      // Submit transaction
      onStatusUpdate?.('Submitting transaction to network...');
      const signedTx = signedTxs[0];
      console.log('[sendJitoBundleTransactionMWA] Submitting signed transaction to network...');
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      console.log('[sendJitoBundleTransactionMWA] signature:', signature);

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
          console.error('[sendJitoBundleTransactionMWA] Error in confirmation:', error);
        });

      return signature;
    } catch (error) {
      console.log('[sendJitoBundleTransactionMWA] Caught error inside transact callback:', error);
      onStatusUpdate?.('Transaction failed');
      TransactionService.showError(error);
      throw error;
    }
  });
} 