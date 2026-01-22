// FILE: src/services/tokenMill/tokenMillService.ts

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {Buffer} from 'buffer';
import {SERVER_URL} from '@env';
import {createSyncNativeInstruction} from '@solana/spl-token';
import * as spl from '@solana/spl-token';
import { PUBLIC_KEYS } from '@/shared/config/constants';
import { TransactionService } from '@/modules/wallet-providers/services/transaction/transactionService';
import { StandardWallet } from '@/modules/wallet-providers/types';

/**
 * fundUserWithWSOL
 */
export async function fundUserWithWSOL({
  solAmount,
  connection,
  signerPublicKey,
  solanaWallet,
  onStatusUpdate,
}: {
  solAmount: number;
  connection: Connection;
  signerPublicKey: string;
  solanaWallet: StandardWallet | any;
  onStatusUpdate?: (status: string) => void;
}): Promise<string> {
  try {
    const wSolMint = new PublicKey(PUBLIC_KEYS.wSolMint);
    const userPubkey = new PublicKey(signerPublicKey);
    const userQuoteAta = spl.getAssociatedTokenAddressSync(wSolMint, userPubkey);

    onStatusUpdate?.('Preparing WSOL transaction...');

    const ataInfo = await connection.getAccountInfo(userQuoteAta);
    const tx = new Transaction();
    if (!ataInfo) {
      const createIx = spl.createAssociatedTokenAccountInstruction(
        userPubkey,
        userQuoteAta,
        userPubkey,
        wSolMint,
      );
      tx.add(createIx);
    }

    const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    const transferIx = SystemProgram.transfer({
      fromPubkey: userPubkey,
      toPubkey: userQuoteAta,
      lamports,
    });
    tx.add(transferIx);

    const syncIx = createSyncNativeInstruction(userQuoteAta);
    tx.add(syncIx);

    const {blockhash} = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPubkey;

    onStatusUpdate?.('Sending transaction to wallet...');

    // Create a filtered status callback that prevents error messages
    const filteredCallback = (status: string) => {
      if (!status.startsWith('Error:') && !status.includes('failed:')) {
        onStatusUpdate?.(status);
      } else {
        onStatusUpdate?.('Processing transaction...');
      }
    };

    const signature = await TransactionService.signAndSendTransaction(
      { type: 'transaction', transaction: tx },
      solanaWallet,
      { 
        connection,
        statusCallback: filteredCallback
      }
    );
    
    onStatusUpdate?.('Transaction successful!');
    return signature;
  } catch (error) {
    console.error('Error in fundUserWithWSOL:', error);
    // Don't send raw error through status update
    onStatusUpdate?.('Transaction failed');
    TransactionService.showError(error);
    throw error;
  }
}

/**
 * createMarket
 */
export async function createMarket({
  tokenName,
  tokenSymbol,
  metadataUri,
  totalSupply,
  creatorFee,
  stakingFee,
  userPublicKey,
  connection,
  solanaWallet,
  onStatusUpdate,
}: {
  tokenName: string;
  tokenSymbol: string;
  metadataUri: string;
  totalSupply: number;
  creatorFee: number;
  stakingFee: number;
  userPublicKey: string;
  connection: Connection;
  solanaWallet: StandardWallet | any;
  onStatusUpdate?: (status: string) => void;
}): Promise<{
  txSignature: string;
  marketAddress: string;
  baseTokenMint: string;
}> {
  try {
    onStatusUpdate?.('Preparing market creation...');
    
    const body = {
      name: tokenName,
      symbol: tokenSymbol,
      uri: metadataUri,
      totalSupply,
      creatorFeeShare: creatorFee,
      stakingFeeShare: stakingFee,
      userPublicKey,
    };

    onStatusUpdate?.('Requesting transaction from server...');
    const resp = await fetch(`${SERVER_URL}/api/markets`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    const json = await resp.json();
    if (!json.success) {
      throw new Error(json.error || 'Market creation failed');
    }

    onStatusUpdate?.('Transaction received, sending to wallet...');
    // Create a filtered status callback that prevents error messages
    const filteredCallback = (status: string) => {
      if (!status.startsWith('Error:') && !status.includes('failed:')) {
        onStatusUpdate?.(status);
      } else {
        onStatusUpdate?.('Processing transaction...');
      }
    };

    const txSignature = await TransactionService.signAndSendTransaction(
      { type: 'base64', data: json.transaction },
      solanaWallet,
      { 
        connection,
        statusCallback: filteredCallback
      }
    );

    onStatusUpdate?.('Market created successfully!');
    
    return {
      txSignature,
      marketAddress: json.marketAddress,
      baseTokenMint: json.baseTokenMint,
    };
  } catch (error) {
    console.error('Error in createMarket:', error);
    // Don't send raw error through status update
    onStatusUpdate?.('Transaction failed');
    TransactionService.showError(error);
    throw error;
  }
}

/**
 * stakeTokens
 */
export async function stakeTokens({
  marketAddress,
  amount,
  userPublicKey,
  connection,
  solanaWallet,
  onStatusUpdate,
}: {
  marketAddress: string;
  amount: number;
  userPublicKey: string;
  connection: Connection;
  solanaWallet: StandardWallet | any;
  onStatusUpdate?: (status: string) => void;
}): Promise<string> {
  try {
    onStatusUpdate?.('Preparing stake transaction...');
    
    const resp = await fetch(`${SERVER_URL}/api/stake`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        marketAddress,
        amount,
        userPublicKey,
      }),
    });
    const json = await resp.json();
    if (!json.success) {
      throw new Error(json.error || 'Stake failed');
    }

    onStatusUpdate?.('Transaction received, sending to wallet...');
    
    // Create a filtered status callback that prevents error messages
    const filteredCallback = (status: string) => {
      if (!status.startsWith('Error:') && !status.includes('failed:')) {
        onStatusUpdate?.(status);
      } else {
        onStatusUpdate?.('Processing transaction...');
      }
    };

    const signature = await TransactionService.signAndSendTransaction(
      { type: 'base64', data: json.data },
      solanaWallet,
      { 
        connection,
        statusCallback: filteredCallback
      }
    );
    
    onStatusUpdate?.('Tokens staked successfully!');
    return signature;
  } catch (error) {
    console.error('Error in stakeTokens:', error);
    // Don't send raw error through status update
    onStatusUpdate?.('Transaction failed');
    TransactionService.showError(error);
    throw error;
  }
}

/**
 * createVesting
 */
export async function createVesting({
  marketAddress,
  baseTokenMint,
  vestingAmount,
  userPublicKey,
  connection,
  solanaWallet,
  onStatusUpdate,
}: {
  marketAddress: string;
  baseTokenMint: string;
  vestingAmount: number;
  userPublicKey: string;
  connection: Connection;
  solanaWallet: StandardWallet | any;
  onStatusUpdate?: (status: string) => void;
}): Promise<{txSignature: string; ephemeralVestingPubkey: string}> {
  try {
    onStatusUpdate?.('Preparing vesting transaction...');
    
    const resp = await fetch(`${SERVER_URL}/api/vesting`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        marketAddress,
        recipient: userPublicKey,
        amount: vestingAmount,
        startTime: Math.floor(Date.now() / 1000),
        duration: 3600,
        cliffDuration: 1800,
        baseTokenMint,
        userPublicKey,
      }),
    });
    const data = await resp.json();
    if (!data.success) {
      throw new Error(data.error || 'Vesting creation failed');
    }

    onStatusUpdate?.('Transaction received, sending to wallet...');
    
    // Create a filtered status callback that prevents error messages
    const filteredCallback = (status: string) => {
      if (!status.startsWith('Error:') && !status.includes('failed:')) {
        onStatusUpdate?.(status);
      } else {
        onStatusUpdate?.('Processing transaction...');
      }
    };

    const txSignature = await TransactionService.signAndSendTransaction(
      { type: 'base64', data: data.data.transaction },
      solanaWallet,
      { 
        connection,
        statusCallback: filteredCallback
      }
    );

    onStatusUpdate?.('Vesting created successfully!');
    
    return {
      txSignature,
      ephemeralVestingPubkey: data.data.ephemeralVestingPubkey,
    };
  } catch (error) {
    console.error('Error in createVesting:', error);
    // Don't send raw error through status update
    onStatusUpdate?.('Transaction failed');
    TransactionService.showError(error);
    throw error;
  }
}

/**
 * releaseVesting
 */
export async function releaseVesting({
  marketAddress,
  vestingPlanAddress,
  baseTokenMint,
  userPublicKey,
  connection,
  solanaWallet,
  onStatusUpdate,
}: {
  marketAddress: string;
  vestingPlanAddress: string;
  baseTokenMint: string;
  userPublicKey: string;
  connection: Connection;
  solanaWallet: StandardWallet | any;
  onStatusUpdate?: (status: string) => void;
}): Promise<string> {
  try {
    onStatusUpdate?.('Preparing vesting release...');
    
    const resp = await fetch(`${SERVER_URL}/api/vesting/release`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        marketAddress,
        vestingPlanAddress,
        baseTokenMint,
        userPublicKey,
      }),
    });
    const data = await resp.json();
    if (!data.success) {
      throw new Error(data.error || 'Release vesting failed');
    }

    onStatusUpdate?.('Transaction received, sending to wallet...');
    
    // Create a filtered status callback that prevents error messages
    const filteredCallback = (status: string) => {
      if (!status.startsWith('Error:') && !status.includes('failed:')) {
        onStatusUpdate?.(status);
      } else {
        onStatusUpdate?.('Processing transaction...');
      }
    };

    const signature = await TransactionService.signAndSendTransaction(
      { type: 'base64', data: data.data },
      solanaWallet,
      { 
        connection,
        statusCallback: filteredCallback
      }
    );
    
    onStatusUpdate?.('Vesting released successfully!');
    return signature;
  } catch (error) {
    console.error('Error in releaseVesting:', error);
    // Don't send raw error through status update
    onStatusUpdate?.('Transaction failed');
    TransactionService.showError(error);
    throw error;
  }
}

/**
 * swapTokens
 */
export async function swapTokens({
  marketAddress,
  swapType,
  swapAmount,
  userPublicKey,
  connection,
  solanaWallet,
  onStatusUpdate,
}: {
  marketAddress: string;
  swapType: 'buy' | 'sell';
  swapAmount: number;
  userPublicKey: string;
  connection: Connection;
  solanaWallet: StandardWallet | any;
  onStatusUpdate?: (status: string) => void;
}): Promise<string> {
  try {
    onStatusUpdate?.(`Preparing ${swapType} transaction...`);
    
    const resp = await fetch(`${SERVER_URL}/api/swap`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        market: marketAddress,
        quoteTokenMint: PUBLIC_KEYS.wSolMint,
        action: swapType,
        tradeType: swapType === 'buy' ? 'exactOutput' : 'exactInput',
        amount: Math.floor(swapAmount * 1_000_000),
        otherAmountThreshold: swapType === 'buy' ? 1_000_000_000 : 0,
        userPublicKey,
      }),
    });
    const data = await resp.json();
    if (!data.success) {
      throw new Error(data.error || 'Swap failed');
    }

    onStatusUpdate?.('Transaction received, sending to wallet...');
    
    // Create a filtered status callback that prevents error messages
    const filteredCallback = (status: string) => {
      if (!status.startsWith('Error:') && !status.includes('failed:')) {
        onStatusUpdate?.(status);
      } else {
        onStatusUpdate?.('Processing transaction...');
      }
    };

    const signature = await TransactionService.signAndSendTransaction(
      { type: 'base64', data: data.transaction },
      solanaWallet,
      { 
        connection,
        statusCallback: filteredCallback
      }
    );
    
    onStatusUpdate?.('Swap completed successfully!');
    return signature;
  } catch (error) {
    console.error('Error in swapTokens:', error);
    // Don't send raw error through status update
    onStatusUpdate?.('Transaction failed');
    TransactionService.showError(error);
    throw error;
  }
}

/**
 * fundMarket
 */
export async function fundMarket({
  marketAddress,
  userPublicKey,
  connection,
  solanaWallet,
  onStatusUpdate,
}: {
  marketAddress: string;
  userPublicKey: string;
  connection: Connection;
  solanaWallet: StandardWallet | any;
  onStatusUpdate?: (status: string) => void;
}): Promise<string> {
  try {
    onStatusUpdate?.('Preparing market funding...');
    
    const marketPubkey = new PublicKey(marketAddress);
    const quoteTokenMint = new PublicKey(PUBLIC_KEYS.wSolMint);
    const marketQuoteTokenAta = spl.getAssociatedTokenAddressSync(
      quoteTokenMint,
      marketPubkey,
      true,
    );

    const ataInfo = await connection.getAccountInfo(marketQuoteTokenAta);
    const tx = new Transaction();

    if (!ataInfo) {
      const createATAIx = spl.createAssociatedTokenAccountInstruction(
        new PublicKey(userPublicKey),
        marketQuoteTokenAta,
        marketPubkey,
        quoteTokenMint,
      );
      tx.add(createATAIx);
    }

    // deposit 0.1 SOL
    const lamportsToDeposit = Math.floor(0.1 * LAMPORTS_PER_SOL);
    const transferIx = SystemProgram.transfer({
      fromPubkey: new PublicKey(userPublicKey),
      toPubkey: marketQuoteTokenAta,
      lamports: lamportsToDeposit,
    });
    tx.add(transferIx);

    const syncIx = createSyncNativeInstruction(marketQuoteTokenAta);
    tx.add(syncIx);

    const {blockhash} = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = new PublicKey(userPublicKey);

    onStatusUpdate?.('Transaction created, sending to wallet...');
    
    // Create a filtered status callback that prevents error messages
    const filteredCallback = (status: string) => {
      if (!status.startsWith('Error:') && !status.includes('failed:')) {
        onStatusUpdate?.(status);
      } else {
        onStatusUpdate?.('Processing transaction...');
      }
    };

    const signature = await TransactionService.signAndSendTransaction(
      { type: 'transaction', transaction: tx },
      solanaWallet,
      { 
        connection,
        statusCallback: filteredCallback
      }
    );
    
    onStatusUpdate?.('Market funded successfully!');
    return signature;
  } catch (error) {
    console.error('Error in fundMarket:', error);
    // Don't send raw error through status update
    onStatusUpdate?.('Transaction failed');
    TransactionService.showError(error);
    throw error;
  }
}

/**
 * setBondingCurve
 */
export async function setBondingCurve({
  marketAddress,
  askPrices,
  bidPrices,
  userPublicKey,
  connection,
  solanaWallet,
  onStatusUpdate,
}: {
  marketAddress: string;
  askPrices: number[];
  bidPrices: number[];
  userPublicKey: string;
  connection: Connection;
  solanaWallet: StandardWallet | any;
  onStatusUpdate?: (status: string) => void;
}): Promise<string> {
  try {
    onStatusUpdate?.('Preparing bonding curve setup...');
    
    const body = {
      market: marketAddress,
      userPublicKey,
      askPrices,
      bidPrices,
    };

    const resp = await fetch(`${SERVER_URL}/api/set-curve`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    const json = await resp.json();
    if (!json.success) {
      throw new Error(json.error || 'Set curve failed');
    }

    onStatusUpdate?.('Transaction received, sending to wallet...');
    
    // Create a filtered status callback that prevents error messages
    const filteredCallback = (status: string) => {
      if (!status.startsWith('Error:') && !status.includes('failed:')) {
        onStatusUpdate?.(status);
      } else {
        onStatusUpdate?.('Processing transaction...');
      }
    };

    const signature = await TransactionService.signAndSendTransaction(
      { type: 'base64', data: json.transaction },
      solanaWallet,
      { 
        connection,
        statusCallback: filteredCallback
      }
    );
    
    onStatusUpdate?.('Bonding curve set successfully!');
    return signature;
  } catch (error) {
    console.error('Error in setBondingCurve:', error);
    // Don't send raw error through status update
    onStatusUpdate?.('Transaction failed');
    TransactionService.showError(error);
    throw error;
  }
}
