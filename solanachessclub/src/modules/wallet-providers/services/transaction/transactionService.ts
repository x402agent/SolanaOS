import {
  Connection,
  Transaction,
  VersionedTransaction,
  PublicKey,
  TransactionInstruction,
  Signer,
} from '@solana/web3.js';
import { Buffer } from 'buffer';
import { getDynamicClient } from '../walletProviders/dynamic';
import { useAppSelector } from '@/shared/hooks/useReduxHooks';
import { Platform } from 'react-native';
import { CLUSTER } from '@env';
import { store } from '@/shared/state/store';
import { parseTransactionError, getSuccessMessage } from '@/shared/services/transactions';
import { showSuccessNotification, showErrorNotification } from '@/shared/state/notification/reducer';
import {
  StandardWallet,
  UnifiedWallet,
  AnyTransaction,
  TransactionFormat,
  WalletProvider,
  SendTransactionOptions
} from '../../types';

/**
 * Centralized transaction service for handling all transaction types and providers
 */
export class TransactionService {
  // Enable this for detailed logging
  static DEBUG = true;
  
  // Helper for debug logging
  private static log(...args: any[]) {
    if (this.DEBUG) {
      console.log('[TransactionService]', ...args);
    }
  }

  /**
   * Display a transaction success notification
   */
  static showSuccess(signature: string, type?: 'swap' | 'transfer' | 'stake' | 'nft' | 'token'): void {
    const message = getSuccessMessage(signature, type);
    store.dispatch(showSuccessNotification({ message, signature }));
  }

  /**
   * Display a transaction error notification with parsed message
   */
  static showError(error: any): void {
    const message = parseTransactionError(error);
    store.dispatch(showErrorNotification({ message }));
  }

  /**
   * Helper to filter error messages from status updates
   * This prevents raw error messages from showing in the UI
   */
  static filterStatusUpdate(status: string, callback?: (status: string) => void): void {
    if (!callback) return;
    
    // Don't pass error messages to the UI status
    if (status.startsWith('Error:') || status.includes('failed:') || status.includes('Transaction failed')) {
      callback('Transaction failed');
    } else {
      callback(status);
    }
  }

  /**
   * Signs and sends a transaction using the provided wallet provider
   * @param txFormat - The transaction format (transaction object, base64 encoded, or instructions)
   * @param walletProvider - The wallet provider to use for signing
   * @param options - Additional options for sending the transaction
   * @returns A promise that resolves to the transaction signature
   */
  static async signAndSendTransaction(
    txFormat: TransactionFormat,
    walletProvider: WalletProvider | StandardWallet | UnifiedWallet,
    options: SendTransactionOptions
  ): Promise<string> {
    const { connection, confirmTransaction = true, maxRetries = 3, statusCallback } = options;
    let transaction: AnyTransaction;

    // Create a filtered status callback that won't show raw errors
    const filteredStatusCallback = statusCallback 
      ? (status: string) => this.filterStatusUpdate(status, statusCallback)
      : undefined;

    // Normalize the wallet provider to a standard format
    const normalizedProvider = this.normalizeWalletProvider(walletProvider);
    this.log("Normalized provider type:", normalizedProvider.type);

    // 1. Normalize transaction format
    try {
      // 1. Process transaction format
      if (txFormat.type === 'base64') {
        const txBuffer = Buffer.from(txFormat.data, 'base64');
        try {
          transaction = VersionedTransaction.deserialize(new Uint8Array(txBuffer));
        } catch {
          transaction = Transaction.from(txBuffer);
        }
      } else if (txFormat.type === 'instructions') {
        // Create a transaction from instructions
        const { instructions, feePayer, signers = [] } = txFormat;
        const tx = new Transaction();
        tx.add(...instructions);
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = feePayer;
        
        // If there are additional signers, sign with them first
        if (signers.length > 0) {
          tx.sign(...signers);
        }
        
        transaction = tx;
      } else {
        transaction = txFormat.transaction;
      }
    } catch (error: any) {
      this.showError(error);
      throw error;
    }

    // 2. Sign and send transaction
    let signature: string;
    try {
      // 2. Process wallet provider and sign the transaction
      filteredStatusCallback?.('Sending transaction to wallet for signing...');

      switch (normalizedProvider.type) {
        case 'mwa':
          filteredStatusCallback?.('Opening mobile wallet for transaction approval...');
          this.log("Using MWA transaction flow");
          signature = await this.signAndSendWithMWA(
            transaction,
            connection,
            normalizedProvider.walletAddress
          );
          break;
        case 'standard':
          const wallet = normalizedProvider.wallet;
          if (!wallet) {
            throw new Error('No wallet provided for standard wallet provider');
          }
          
          // Don't try to get provider for MWA wallets
          if (wallet.provider === 'mwa') {
            filteredStatusCallback?.('Opening mobile wallet for transaction approval...');
            this.log("Standard wallet with MWA provider, using MWA flow");
            const walletAddress = wallet.address || wallet.publicKey;
            if (!walletAddress) {
              throw new Error('No wallet address found for MWA wallet');
            }
            signature = await this.signAndSendWithMWA(
              transaction,
              connection,
              walletAddress
            );
          } else {
            // Normal standard wallet flow
            const provider = await wallet.getProvider();
            if (!provider) {
              throw new Error(`No provider available for ${wallet.provider} wallet`);
            }
            
            signature = await this.signAndSendWithProvider(
              transaction,
              connection,
              provider,
              wallet.getWalletInfo?.()
            );
          }
          break;
        case 'privy':
          signature = await this.signAndSendWithPrivy(
            transaction,
            connection,
            normalizedProvider.provider
          );
          break;
        case 'dynamic':
          signature = await this.signAndSendWithDynamic(
            transaction,
            connection,
            normalizedProvider.walletAddress
          );
          break;
        case 'turnkey':
          // Implementation for Turnkey would go here
          throw new Error('Turnkey provider not yet implemented');
          break;
        case 'autodetect':
          // Auto-detect provider type based on the currentProvider value
          if (normalizedProvider.currentProvider === 'mwa') {
            filteredStatusCallback?.('Opening mobile wallet for transaction approval...');
            this.log("Autodetected MWA provider");
            const walletAddress = 
              normalizedProvider.provider.address || 
              normalizedProvider.provider.publicKey;
            
            if (!walletAddress) {
              throw new Error('No wallet address found for MWA provider');
            }
            
            signature = await this.signAndSendWithMWA(
              transaction,
              connection,
              walletAddress
            );
          }
          else if (normalizedProvider.currentProvider === 'privy') {
            signature = await this.signAndSendWithPrivy(
              transaction,
              connection,
              normalizedProvider.provider
            );
          } else if (normalizedProvider.currentProvider === 'dynamic') {
            // For dynamic, we need to get the wallet address from the provider
            if (normalizedProvider.provider && normalizedProvider.provider.address) {
              // If provider has address directly (our standardized object)
              signature = await this.signAndSendWithDynamic(
                transaction,
                connection,
                normalizedProvider.provider.address
              );
            } else {
              // Try to get from Dynamic client
              const dynamicClient = getDynamicClient();
              const wallets = dynamicClient.wallets?.userWallets || [];
              if (!wallets || wallets.length === 0) {
                throw new Error('No Dynamic wallet found');
              }
              const address = wallets[0].address;
              
              signature = await this.signAndSendWithDynamic(
                transaction,
                connection,
                address
              );
            }
          } else if (normalizedProvider.currentProvider === 'mwa') {
            filteredStatusCallback?.('Opening mobile wallet for transaction approval...');
            const walletAddress = 
              normalizedProvider.provider.address || 
              normalizedProvider.provider.publicKey;
            
            if (!walletAddress) {
              throw new Error('No wallet address found for MWA provider');
            }
            
            signature = await this.signAndSendWithMWA(
              transaction,
              connection,
              walletAddress
            );
          } else {
            throw new Error(`Unsupported provider type: ${normalizedProvider.currentProvider}`);
          }
          break;
        default:
          this.showError(new Error('Unsupported wallet provider type'));
          throw new Error('Unsupported wallet provider type');
      }
    } catch (error: any) {
      filteredStatusCallback?.(`Transaction signing failed: ${error.message}`);
      this.showError(error);
      throw error;
    }

    // 3. Confirm transaction if needed
    if (confirmTransaction) {
      filteredStatusCallback?.('Confirming transaction...');
      let retries = 0;
      while (retries < maxRetries) {
        try {
          await connection.confirmTransaction(signature, 'confirmed');
          filteredStatusCallback?.('Transaction confirmed!');
          this.showSuccess(signature);
          break;
        } catch (error) {
          retries++;
          if (retries >= maxRetries) {
            filteredStatusCallback?.('Transaction failed');
            this.showError(new Error('Transaction confirmation failed after maximum retries.'));
            throw new Error('Transaction confirmation failed after maximum retries.');
          }
          filteredStatusCallback?.(`Retrying confirmation (${retries}/${maxRetries})...`);
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } else {
      // Show success even if we don't wait for confirmation
      this.showSuccess(signature);
    }

    return signature;
  }

  /**
   * Normalize any wallet provider into our standard WalletProvider format
   */
  private static normalizeWalletProvider(provider: WalletProvider | StandardWallet | UnifiedWallet): WalletProvider {
    // Add detailed console logging to help with debugging
    this.log("Normalizing provider:", 
      provider ? 
        `type=${typeof provider}, properties=${Object.keys(provider).join(',')}` : 
        'null or undefined'
    );
    
    // First, check for MWA wallet - this should be prioritized
    if (provider && typeof provider === 'object') {
      // Check for special isMWAProvider flag (from our useWallet hook)
      if (provider.isMWAProvider) {
        this.log("Detected special MWA provider from useWallet");
        const walletAddress = provider.address;
        if (!walletAddress) {
          throw new Error('No wallet address found in MWA provider');
        }
        return { 
          type: 'mwa', 
          walletAddress: walletAddress
        };
      }
      
      // Direct check for MWA provider
      if (provider.provider === 'mwa') {
        this.log("Detected MWA wallet by provider property");
        const walletAddress = provider.address || provider.publicKey;
        if (!walletAddress) {
          throw new Error('No wallet address found for MWA provider');
        }
        return { 
          type: 'mwa', 
          walletAddress: walletAddress
        };
      }
      
      // Check via getWalletInfo for MWA
      if (typeof provider.getWalletInfo === 'function') {
        try {
          const walletInfo = provider.getWalletInfo();
          if (walletInfo && walletInfo.walletType === 'MWA') {
            this.log("Detected MWA wallet by wallet info");
            const walletAddress = provider.address || provider.publicKey;
            if (!walletAddress) {
              this.log("MWA wallet detected but no address found, falling back to standard");
              return { 
                type: 'standard', 
                wallet: provider as StandardWallet 
              };
            }
            return { 
              type: 'mwa', 
              walletAddress: walletAddress
            };
          }
        } catch (e) {
          // Ignore errors in getWalletInfo
        }
      }
    }
    
    // If it's already a WalletProvider with a type field, return it as is
    if (provider && typeof provider === 'object' && 'type' in provider) {
      this.log("Detected provider with type field:", provider.type);
      return provider as WalletProvider;
    }
    
    // If it's a StandardWallet, convert it to a standard provider
    if (provider && 
        typeof provider === 'object' && 
        'provider' in provider && 
        'getProvider' in provider && 
        typeof provider.getProvider === 'function') {
      this.log("Detected StandardWallet with provider:", provider.provider);
      
      // Special case for MWA Standard wallet
      if (provider.provider === 'mwa') {
        this.log("Detected StandardWallet with MWA provider");
        const walletAddress = provider.address || provider.publicKey;
        if (!walletAddress) {
          this.log("MWA wallet detected but no address found, falling back to standard");
          return { 
            type: 'standard', 
            wallet: provider as StandardWallet 
          };
        }
        return { 
          type: 'mwa', 
          walletAddress: walletAddress
        };
      }
      
      return { 
        type: 'standard', 
        wallet: provider as StandardWallet 
      };
    }
    
    // If it has a type property indicating it's from a specific wallet provider
    if (provider && typeof provider === 'object') {
      // Detect Privy wallet
      if (provider.type === 'privy' || 
          (provider.provider && provider.provider === 'privy') ||
          // Additional Privy-specific checks
          (provider.wallets && Array.isArray(provider.wallets) && provider.getProvider)) {
        this.log("Detected Privy wallet");
        return { type: 'privy', provider };
      }
      
      // Detect Dynamic wallet
      if (provider.type === 'dynamic' || 
          (provider.provider && provider.provider === 'dynamic') ||
          // Additional Dynamic-specific properties
          provider._dynamicSdk ||
          (provider.wallet && provider.wallet.type === 'dynamic_embedded_wallet')) {
        this.log("Detected Dynamic wallet");
        
        let walletAddress = '';
        
        if ('address' in provider) {
          walletAddress = provider.address;
        } else if (provider.wallets && provider.wallets[0]) {
          walletAddress = provider.wallets[0].publicKey || provider.wallets[0].address;
        }
        
        if (walletAddress) {
          return { type: 'dynamic', walletAddress };
        }
      }
    }
    
    // For backward compatibility - ensure we correctly identify wallet types
    if (provider && typeof provider === 'object') {
      // Special detection for the exact structure provided by useAuth's solanaWallet for Privy
      if (provider.wallets && provider.getProvider && !provider.type && !provider.provider) {
        this.log("Detected classic Privy wallet structure from useAuth");
        return { type: 'privy', provider };
      }
      
      // Special detection for the exact structure provided by Dynamic client
      if ((provider.primary || provider.userWallets) && !provider.type && !provider.provider) {
        this.log("Detected Dynamic client or wallet collection");
        // Try to extract a wallet from primary or userWallets
        const walletToUse = provider.primary || 
                          (provider.userWallets && provider.userWallets.length > 0 ? 
                            provider.userWallets[0] : null);
                            
        if (walletToUse && walletToUse.address) {
          return { type: 'dynamic', walletAddress: walletToUse.address };
        }
      }
    }
    
    // Debug what we received to help identify unknown providers
    this.log("Provider detection defaulting to autodetect:", 
      provider ? 
        `keys=${Object.keys(provider).join(',')}, typeof=${typeof provider}` : 
        'null or undefined');
        
    if (provider && typeof provider === 'object') {
      // If we have a wallets array or a primary/current wallet, this is likely one of our providers
      if (provider.wallets || provider.primary || provider.current) {
        this.log("Provider has wallet collections, treating as dynamic");
        
        // Try to extract a wallet address
        let walletAddress = '';
        if (provider.wallets && provider.wallets[0]) {
          walletAddress = provider.wallets[0].publicKey || provider.wallets[0].address;
        } else if (provider.primary) {
          walletAddress = provider.primary.address;
        }
        
        if (walletAddress) {
          return { type: 'dynamic', walletAddress };
        }
        
        // If we couldn't extract an address, fall back to autodetect but mark as dynamic
        return { 
          type: 'autodetect', 
          provider,
          currentProvider: 'dynamic'
        };
      }
    }
    
    // Default to autodetect with better provider type detection
    const providerType = 
      (provider as any)?.provider || 
      (provider as any)?.type || 
      (provider && typeof provider === 'object' && provider.wallets ? 'privy' : 
       (provider && typeof provider === 'object' && provider.provider === 'mwa' ? 'mwa' : 'unknown'));
      
    this.log("Using autodetect with provider type:", providerType);
      
    return { 
      type: 'autodetect', 
      provider,
      currentProvider: providerType
    };
  }

  /**
   * Generic method to sign and send a transaction using any provider
   * This simplifies the code since most providers follow the same pattern
   */
  private static async signAndSendWithProvider(
    transaction: AnyTransaction,
    connection: Connection,
    provider: any,
    walletInfo?: { walletType: string, address: string | null }
  ): Promise<string> {
    if (!provider) {
      throw new Error('Provider is null or undefined');
    }
    
    // If the provider is actually a wallet with getProvider method, call it to get the actual provider
    if (typeof provider.getProvider === 'function' && !provider.request) {
      this.log('Provider is a wallet object with getProvider method, calling it to get actual provider');
      try {
        provider = await provider.getProvider();
      } catch (err) {
        this.log('Error getting provider from wallet:', err);
        // Continue with original provider if getting the actual one fails
      }
    }

    // If provider doesn't have a request method but has direct signing methods, create a wrapper
    if (typeof provider.request !== 'function') {
      this.log('Provider missing request method, attempting to enhance provider', 
        walletInfo ? `for ${walletInfo.walletType}` : '');
      
      // Check for Dynamic-specific properties
      const isDynamicProvider = 
        provider._dynamicSdk || 
        provider._isDynamicProvider || 
        (provider.wallet && provider.wallet.type === 'dynamic_embedded_wallet') ||
        (walletInfo && walletInfo.walletType === 'Dynamic');
      
      if (isDynamicProvider) {
        this.log('Detected Dynamic provider, fetching Solana signer');
        try {
          // Get Dynamic client
          const dynamicClient = getDynamicClient();
          
          // Try to get the wallet address
          const walletAddress = provider.address || 
                              (provider.wallet && provider.wallet.address) || 
                              (dynamicClient.wallets?.primary?.address) ||
                              (walletInfo && walletInfo.address);
                              
          if (!walletAddress) {
            throw new Error('Could not determine wallet address from Dynamic provider');
          }
          
          // Find the wallet
          let wallet;
          if (dynamicClient.wallets.primary && dynamicClient.wallets.primary.address === walletAddress) {
            wallet = dynamicClient.wallets.primary;
          } else {
            wallet = dynamicClient.wallets.userWallets?.find((w: any) => w.address === walletAddress);
          }
          
          if (!wallet) {
            throw new Error(`No Dynamic wallet found with address ${walletAddress}`);
          }
          
          // Get the Solana signer
          this.log('Getting Dynamic signer for wallet:', wallet.address);
          const signer = await dynamicClient.solana.getSigner({ wallet });
          
          if (!signer) {
            throw new Error('Could not get Solana signer from Dynamic');
          }
          
          // Create provider with request method using the signer
          const enhancedProvider = {
            ...provider,
            _signer: signer, // Store for reference
            request: async ({ method, params }: any) => {
              this.log(`[dynamic enhancedProvider] Method requested: ${method}`);
              
              if (method === 'signAndSendTransaction') {
                const { transaction } = params;
                this.log('[dynamic enhancedProvider] Processing signAndSendTransaction request');
                
                // Try to use the direct signTransaction + sendRawTransaction approach
                try {
                  // 1. Sign transaction
                  const signedTx = await signer.signTransaction(transaction);
                  
                  // 2. Send raw transaction
                  const rawTransaction = signedTx instanceof VersionedTransaction 
                    ? signedTx.serialize()
                    : signedTx.serialize();
                    
                  const signature = await connection.sendRawTransaction(rawTransaction, {
                    skipPreflight: false, 
                    preflightCommitment: 'confirmed',
                    maxRetries: 3
                  });
                  
                  this.log('[dynamic enhancedProvider] Transaction sent with signature:', signature);
                  return { signature };
                } catch (signError) {
                  this.log('[dynamic enhancedProvider] Manual sign+send failed:', signError);
                  
                  // Fallback to signAndSendTransaction if available
                  if (typeof signer.signAndSendTransaction === 'function') {
                    this.log('[dynamic enhancedProvider] Falling back to signAndSendTransaction');
                    try {
                      const result = await signer.signAndSendTransaction(transaction);
                      return { signature: result.signature };
                    } catch (sendError) {
                      this.log('[dynamic enhancedProvider] signAndSendTransaction failed:', sendError);
                      throw sendError;
                    }
                  } else {
                    throw signError;
                  }
                }
              }
              
              throw new Error(`Method ${method} not supported by Dynamic enhanced provider`);
            }
          };
          
          this.log('Successfully enhanced Dynamic provider with request method');
          return this.signAndSendWithProvider(transaction, connection, enhancedProvider);
        } catch (error: any) {
          this.log('Failed to create Dynamic enhanced provider:', error);
          throw error;
        }
      }
      
      // Standard provider enhancement logic - check if provider has direct signing capabilities
      else if (typeof provider.signAndSendTransaction === 'function' || typeof provider.signTransaction === 'function') {
        // Create an enhanced provider with request method
        const enhancedProvider = {
          ...provider,
          request: async ({ method, params }: any) => {
            this.log(`[enhancedProvider] Method requested: ${method}`);
            
            if (method === 'signAndSendTransaction') {
              const { transaction } = params;
              this.log('[enhancedProvider] Processing signAndSendTransaction request');
              
              // Direct signAndSendTransaction if available
              if (typeof provider.signAndSendTransaction === 'function') {
                this.log('[enhancedProvider] Using provider.signAndSendTransaction');
                const result = await provider.signAndSendTransaction(transaction);
                return { signature: result.signature || result };
              } 
              // Fall back to manual sign+send
              else if (typeof provider.signTransaction === 'function') {
                this.log('[enhancedProvider] Using manual sign+send flow');
                
                // 1. Sign transaction
                const signedTx = await provider.signTransaction(transaction);
                
                // 2. Send raw transaction
                const rawTransaction = signedTx instanceof VersionedTransaction 
                  ? signedTx.serialize()
                  : signedTx.serialize();
                  
                const signature = await connection.sendRawTransaction(rawTransaction, {
                  skipPreflight: false, 
                  preflightCommitment: 'confirmed',
                  maxRetries: 3
                });
                
                this.log('[enhancedProvider] Transaction sent with signature:', signature);
                return { signature };
              }
            }
            
            throw new Error(`Method ${method} not supported by enhanced provider`);
          }
        };
        
        this.log('Successfully enhanced provider with request method');
        provider = enhancedProvider;
      } else {
        // Log more information about the provider to help debug
        this.log('Provider lacking required methods. Available methods:', 
          Object.getOwnPropertyNames(provider).filter(p => typeof provider[p] === 'function'));
        
        if (provider.wallet) {
          this.log('Provider wallet methods:', 
            Object.getOwnPropertyNames(provider.wallet).filter(p => typeof provider.wallet[p] === 'function'));
        }
        
        throw new Error('Invalid provider: missing request method and no alternative signing methods');
      }
    }

    // Now use the enhanced or original provider
    const { signature } = await provider.request({
      method: 'signAndSendTransaction',
      params: {
        transaction,
        connection,
      },
    });

    if (!signature) {
      throw new Error('No signature returned from provider');
    }
    return signature;
  }

  /**
   * Private method to sign and send a transaction using Privy
   */
  private static async signAndSendWithPrivy(
    transaction: AnyTransaction,
    connection: Connection,
    provider: any
  ): Promise<string> {
    return this.signAndSendWithProvider(transaction, connection, provider);
  }

  /**
   * Helper to check if a transaction has already been signed
   */
  private static isTransactionSigned(transaction: AnyTransaction): boolean {
    if (transaction instanceof VersionedTransaction) {
      // For versioned transactions, check if there are signatures
      return transaction.signatures.length > 0 && 
        transaction.signatures.some(sig => sig.length > 0);
    } else {
      // For legacy transactions, check the signatures array
      return transaction.signatures.length > 0 && 
        transaction.signatures.some(sig => sig.signature !== null);
    }
  }

  /**
   * Private method to sign and send a transaction using Dynamic
   */
  private static async signAndSendWithDynamic(
    transaction: AnyTransaction,
    connection: Connection,
    walletAddress: string
  ): Promise<string> {
    const dynamicClient = getDynamicClient();
    
    if (!dynamicClient || !dynamicClient.wallets) {
      throw new Error('Dynamic client not initialized');
    }

    try {
      // First identify the wallet to use
      let wallet;
      
      // Try to use the primary wallet first (recommended approach)
      if (dynamicClient.wallets.primary && dynamicClient.wallets.primary.address === walletAddress) {
        wallet = dynamicClient.wallets.primary;
      } else {
        // Fallback: find the wallet with the matching address in userWallets
        wallet = dynamicClient.wallets.userWallets?.find((w: any) => w.address === walletAddress);
      }

      if (!wallet) {
        throw new Error(`No Dynamic wallet found with address ${walletAddress}`);
      }
      
      // Make sure the solana extension is available
      if (!dynamicClient.solana || typeof dynamicClient.solana.getSigner !== 'function') {
        throw new Error('Solana extension not properly initialized in Dynamic client');
      }
      
      // Get the signer using the Solana extension
      this.log('Getting Dynamic signer for wallet:', wallet.address);
      const signer = await dynamicClient.solana.getSigner({ wallet });
      
      // IMPORTANT: ALWAYS use manual signing + sending to bypass Dynamic's UI
      // ====================================================================
      this.log('Transaction type:', transaction instanceof VersionedTransaction ? 'Versioned' : 'Legacy');
      
      let signedTx = transaction;
      let signature: string;
      
      // Clear any existing signatures to prevent verification issues
      if (transaction instanceof VersionedTransaction) {
        transaction.signatures.fill(new Uint8Array(64));
      } else {
        transaction.signatures = [];
      }
      
      // Ensure transaction is properly prepared before signing
      if (!(transaction instanceof VersionedTransaction)) {
        this.log('Preparing legacy transaction...');
        // Get latest blockhash if not set
        if (!transaction.recentBlockhash) {
          const { blockhash } = await connection.getLatestBlockhash('confirmed');
          transaction.recentBlockhash = blockhash;
        }
        
        // Set feePayer if not set
        if (!transaction.feePayer) {
          transaction.feePayer = new PublicKey(walletAddress);
        }
      }
      
      try {
        this.log('Signing transaction...');
        signedTx = await signer.signTransaction(transaction);
        this.log('Transaction successfully signed manually');
        
        // Verify signature before sending
        if (signedTx instanceof VersionedTransaction) {
          const sigVerify = signedTx.signatures.some(sig => sig.length > 0);
          if (!sigVerify) {
            throw new Error('Transaction signature verification failed after signing');
          }
        } else {
          const sigVerify = signedTx.signatures.some(sig => sig.signature !== null);
          if (!sigVerify) {
            throw new Error('Transaction signature verification failed after signing');
          }
        }
      } catch (signError: any) {
        this.log('Error during transaction signing:', signError);
        throw new Error(`Signing failed: ${signError.message}`);
      }
      
      // Send the signed transaction
      this.log('Sending signed transaction to network...');
      try {
        const rawTransaction = signedTx instanceof VersionedTransaction 
          ? signedTx.serialize()
          : signedTx.serialize();
        
        signature = await connection.sendRawTransaction(rawTransaction, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3
        });
        
        this.log('Transaction sent successfully with signature:', signature);
        return signature;
      } catch (sendError: any) {
        this.log('Error sending transaction:', sendError);
        if (sendError.logs) {
          this.log('Transaction logs:', sendError.logs);
        }
        
        // If we get a signature verification error, try one more time with a fresh blockhash
        if (sendError.message.includes('signature verification') && !(transaction instanceof VersionedTransaction)) {
          this.log('Retrying with fresh blockhash...');
          const { blockhash } = await connection.getLatestBlockhash('confirmed');
          transaction.recentBlockhash = blockhash;
          
          // Clear signatures and try again
          transaction.signatures = [];
          signedTx = await signer.signTransaction(transaction);
          
          const retryRawTransaction = signedTx.serialize();
          signature = await connection.sendRawTransaction(retryRawTransaction, {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
            maxRetries: 3
          });
          
          this.log('Retry successful with signature:', signature);
          return signature;
        }
        
        throw new Error(`Send failed: ${sendError.message}`);
      }
    } catch (error: any) {
      this.log('Dynamic transaction error:', error);
      throw new Error(`Failed to process transaction with Dynamic: ${error.message}`);
    }
  }

  /**
   * Signs and sends a transaction using MWA (Mobile Wallet Adapter)
   */
  private static async signAndSendWithMWA(
    transaction: AnyTransaction,
    connection: Connection,
    walletAddress: string
  ): Promise<string> {
    if (Platform.OS !== 'android') {
      throw new Error('MWA is only supported on Android devices');
    }
    
    this.log('Starting MWA transaction flow for address:', walletAddress);
    
    try {
      // Import MWA dynamically to avoid issues on iOS
      let mobileWalletAdapter;
      try {
        mobileWalletAdapter = require('@solana-mobile/mobile-wallet-adapter-protocol-web3js');
      } catch (importError) {
        console.error('Failed to import mobile-wallet-adapter:', importError);
        throw new Error('Mobile Wallet Adapter module not found. Make sure @solana-mobile/mobile-wallet-adapter-protocol-web3js is installed');
      }

      if (!mobileWalletAdapter || !mobileWalletAdapter.transact) {
        throw new Error('Mobile Wallet Adapter module is invalid or missing the transact function');
      }

      const { transact } = mobileWalletAdapter;
      const { Buffer } = require('buffer');

      return await transact(async (wallet: any) => {
        try {
          this.log('Inside MWA transact callback...');
          
          // Authorize with the wallet
          const authResult = await wallet.authorize({
            cluster: CLUSTER || 'mainnet-beta',
            identity: {
              name: 'Solana App Kit',
              uri: 'https://solanaappkit.com',
              icon: 'favicon.ico',
            },
          });
          
          this.log('MWA auth result:', authResult ? 'success' : 'failed');
          
          if (!authResult || !authResult.accounts || !authResult.accounts.length) {
            throw new Error('No accounts returned from MWA authorization');
          }
          
          // Get authorized account
          const selectedAccount = authResult.accounts[0];
          const accountAddress = selectedAccount.address;
          
          this.log('MWA selected account address:', accountAddress);
          
          // Convert base64 to PublicKey if needed
          let userPubkey: PublicKey;
          try {
            // First try to interpret as a base58 string
            userPubkey = new PublicKey(accountAddress);
          } catch (e) {
            // If that fails, try to decode from base64
            try {
              const userPubkeyBytes = Buffer.from(accountAddress, 'base64');
              userPubkey = new PublicKey(userPubkeyBytes);
            } catch (decodeError) {
              this.log('Failed to decode pubkey from base64:', decodeError);
              throw new Error(`Invalid account address format: ${accountAddress}`);
            }
          }
          
          this.log('MWA authorized with public key:', userPubkey.toBase58());
          
          // Get latest blockhash if transaction doesn't have one
          if (transaction instanceof Transaction && !transaction.recentBlockhash) {
            this.log('Getting latest blockhash for transaction');
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            
            // Make sure feePayer is set correctly for legacy transactions
            if (!transaction.feePayer) {
              this.log('Setting feePayer to', userPubkey.toBase58());
              transaction.feePayer = userPubkey;
            }
          }
          
          // Log transaction details for debugging
          if (transaction instanceof VersionedTransaction) {
            this.log('Versioned transaction with', transaction.message.compiledInstructions.length, 'instructions');
          } else {
            this.log('Legacy transaction with', transaction.instructions.length, 'instructions');
          }
          
          // Sign the transaction
          this.log('Calling wallet.signTransactions...');
          const signedTransactions = await wallet.signTransactions({
            transactions: [transaction],
          });
          
          if (!signedTransactions?.length) {
            throw new Error('No signed transactions returned from MWA');
          }
          
          // Send the signed transaction
          const signedTx = signedTransactions[0];
          this.log('Submitting signed transaction to network...');
          const signature = await connection.sendRawTransaction(signedTx.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
            maxRetries: 3
          });
          this.log('Transaction sent with signature:', signature);
          
          return signature;
        } catch (error: any) {
          this.log('MWA transaction error:', error);
          
          // Provide more detailed error information
          let errorMessage = `MWA transaction failed: ${error.message}`;
          if (error.logs) {
            errorMessage += `\nLogs: ${error.logs.slice(0, 3).join('\n')}`;
          }
          
          throw new Error(errorMessage);
        }
      });
    } catch (error: any) {
      this.log('MWA module error:', error);
      throw new Error(`MWA transaction failed: ${error.message}`);
    }
  }
}

/**
 * React hook for using the transaction service with the current wallet provider
 */
export function useTransactionService() {
  // Get the current provider from Redux state
  const currentProvider = useAppSelector(state => state.auth.provider);
  const walletAddress = useAppSelector(state => state.auth.address) || '';

  /**
   * Signs and sends a transaction using the current wallet provider
   */
  const signAndSendTransaction = async (
    txFormat: TransactionFormat,
    provider: any,
    options: SendTransactionOptions
  ): Promise<string> => {
    // If provider is a StandardWallet, use that directly
    if (provider && provider.provider && provider.getProvider) {
      return TransactionService.signAndSendTransaction(
        txFormat,
        { type: 'standard', wallet: provider },
        options
      );
    }
    
    // Otherwise fall back to autodetect
    return TransactionService.signAndSendTransaction(
      txFormat,
      { type: 'autodetect', provider, currentProvider: currentProvider || 'privy' },
      options
    );
  };

  /**
   * Signs and sends a transaction created from instructions
   */
  const signAndSendInstructions = async (
    instructions: TransactionInstruction[],
    feePayer: PublicKey,
    provider: any,
    connection: Connection,
    options?: Partial<SendTransactionOptions>
  ): Promise<string> => {
    const txOptions: SendTransactionOptions = {
      connection,
      ...options,
    };

    return signAndSendTransaction(
      { type: 'instructions', instructions, feePayer },
      provider,
      txOptions
    );
  };

  /**
   * Signs and sends a base64-encoded transaction
   */
  const signAndSendBase64 = async (
    base64Tx: string,
    provider: any,
    connection: Connection,
    options?: Partial<SendTransactionOptions>
  ): Promise<string> => {
    const txOptions: SendTransactionOptions = {
      connection,
      ...options,
    };

    return signAndSendTransaction(
      { type: 'base64', data: base64Tx },
      provider,
      txOptions
    );
  };

  return {
    signAndSendTransaction,
    signAndSendInstructions,
    signAndSendBase64,
    currentProvider,
    walletAddress,
  };
} 