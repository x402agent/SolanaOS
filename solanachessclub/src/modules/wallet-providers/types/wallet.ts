/**
 * Wallet-related type definitions for the embeddedWalletProviders module
 */

/**
 * Interface for a standardized wallet object returned by useAuth
 * This ensures that regardless of provider, components get a consistent interface
 */
export interface StandardWallet {
  provider: 'privy' | 'dynamic' | 'turnkey' | 'mwa' | string;
  address: string | null;
  publicKey: string | null;
  /**
   * The raw provider-specific wallet object.
   * This is useful if you need to access provider-specific features.
   */
  rawWallet: any;
  /**
   * Get the provider instance for this wallet
   * This is used for signing transactions
   */
  getProvider: () => Promise<any>;
  /**
   * Get wallet identifier info for debugging
   */
  getWalletInfo: () => { 
    walletType: string;
    address: string | null;
  };
}

/**
 * A unified wallet type that can be used in place of different provider-specific wallets
 */
export type UnifiedWallet = StandardWallet | any; 