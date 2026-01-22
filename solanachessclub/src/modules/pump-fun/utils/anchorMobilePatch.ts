/**
 * Mobile-friendly patch for Anchor's NodeWallet
 * This file provides React Native compatible alternatives to Node.js specific functionality
 */

import { Keypair } from '@solana/web3.js';
import { Wallet } from '@coral-xyz/anchor';

/**
 * MobileWallet is a replacement for Anchor's NodeWallet
 * that works in React Native environments
 */
export class MobileWallet implements Wallet {
  constructor(readonly payer: Keypair) {}

  static local(): MobileWallet {
    // Generate a new random keypair when needed
    const keypair = Keypair.generate();
    return new MobileWallet(keypair);
  }
  
  // Implement the Wallet interface
  async signTransaction(tx: any): Promise<any> {
    tx.partialSign(this.payer);
    return tx;
  }

  async signAllTransactions(txs: any[]): Promise<any[]> {
    return txs.map((tx) => {
      tx.partialSign(this.payer);
      return tx;
    });
  }

  get publicKey() {
    return this.payer.publicKey;
  }
}

// Export as a way to easily override the NodeWallet
export default MobileWallet; 