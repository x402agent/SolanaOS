import { useAuth } from './useAuth';
import { useTransactionService } from '../services/transaction/transactionService';
import { Connection, Transaction, VersionedTransaction, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { useMemo, useEffect, useRef } from 'react';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useReduxHooks';
import { Platform } from 'react-native';
import { fetchUserProfile } from '@/shared/state/auth/reducer';
import { StandardWallet } from '../types';

/**
 * A hook that provides wallet and transaction capabilities
 * across different wallet providers (Privy, Dynamic, etc.)
 */
export function useWallet() {
  // Get Redux auth state
  const authState = useAppSelector(state => state.auth);
  const dispatch = useAppDispatch();
  
  // Use a ref to track mount status
  const isMounted = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Get wallet from useAuth - wrap in try/catch to handle any errors during logout
  let auth;
  try {
    auth = useAuth();
  } catch (error) {
    console.warn('[useWallet] Error getting auth:', error);
    auth = { wallet: null, solanaWallet: null };
  }
  
  const wallet = auth?.wallet || null;
  const solanaWallet = auth?.solanaWallet || null;
  
  // Get transaction service - must be called in all render paths
  const { 
    signAndSendTransaction,
    signAndSendInstructions,
    signAndSendBase64,
    currentProvider 
  } = useTransactionService();

  // Add an effect to ensure profile data is loaded if we have a wallet address
  // but no profile info (prevents "flashing" anonymous state)
  useEffect(() => {
    // We need a stable flag to track if we should fetch
    let shouldFetch = false;
    
    // Check if we need to fetch profile data
    if (authState.isLoggedIn && authState.address) {
      // Only fetch if we're missing profile data
      if (!authState.username || !authState.profilePicUrl) {
        shouldFetch = true;
      }
    }
    
    // Use a timeout to debounce multiple profile fetch requests
    // and avoid multiple fetches during app initialization
    if (shouldFetch && isMounted.current) {
      const timer = setTimeout(() => {
        // Check if component is still mounted before dispatching
        if (isMounted.current) {
          // Explicitly pass the current user's address to ensure we only fetch their profile
          // This prevents fetching other users' profiles
          const userAddress = authState.address;
          if (userAddress) {
            dispatch(fetchUserProfile(userAddress));
          }
        }
      }, 300); // Small delay to allow for auth state to stabilize
      
      return () => clearTimeout(timer);
    }
  }, [authState.isLoggedIn, authState.address, authState.username, authState.profilePicUrl, dispatch]);

  // Create a standardized wallet object for MWA if needed
  const mwaWallet = useMemo(() => {
    // Only create MWA wallet on Android
    if (authState.provider === 'mwa' && authState.address && Platform.OS === 'android') {
      return {
        provider: 'mwa' as const,
        address: authState.address,
        publicKey: authState.address,
        rawWallet: { address: authState.address },
        getWalletInfo: () => ({
          walletType: 'MWA',
          address: authState.address,
        }),
        // For MWA, we don't have a provider as transactions are handled by the Phantom app
        getProvider: async () => {
          // Now we don't immediately throw, but return a special MWA provider
          return {
            type: 'mwa',
            provider: 'mwa',
            address: authState.address,
            // This will be used by transactionService
            isMWAProvider: true
          };
        }
      } as StandardWallet;
    }
    return null;
  }, [authState.provider, authState.address]);

  // Get the best available wallet - prefer StandardWallet but fall back to mwaWallet if available
  const getWallet = () => {
    if (wallet) return wallet;
    if (mwaWallet) return mwaWallet;
    if (solanaWallet) return solanaWallet;
    return null;
  };

  // Get the wallet that is currently in use
  const currentWallet = useMemo(() => {
    return getWallet();
  }, [wallet, mwaWallet, solanaWallet]);

  /**
   * Signs and sends a transaction using the current wallet
   */
  const sendTransaction = async (
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options?: { confirmTransaction?: boolean; statusCallback?: (status: string) => void }
  ): Promise<string> => {
    // Check if component is still mounted
    if (!isMounted.current) {
      console.warn('[useWallet] sendTransaction called after component unmounted');
      throw new Error('Component unmounted');
    }
    
    const availableWallet = getWallet();
    if (!availableWallet) {
      throw new Error('No wallet connected');
    }

    return signAndSendTransaction(
      { type: 'transaction', transaction },
      availableWallet,
      { connection, ...options }
    );
  };

  /**
   * Signs and sends a transaction from instructions using the current wallet
   */
  const sendInstructions = async (
    instructions: TransactionInstruction[],
    feePayer: PublicKey,
    connection: Connection,
    options?: { confirmTransaction?: boolean; statusCallback?: (status: string) => void }
  ): Promise<string> => {
    // Check if component is still mounted
    if (!isMounted.current) {
      console.warn('[useWallet] sendInstructions called after component unmounted');
      throw new Error('Component unmounted');
    }
    
    const availableWallet = getWallet();
    if (!availableWallet) {
      throw new Error('No wallet connected');
    }

    return signAndSendInstructions(
      instructions,
      feePayer,
      availableWallet,
      connection,
      options
    );
  };

  /**
   * Signs and sends a base64-encoded transaction using the current wallet
   */
  const sendBase64Transaction = async (
    base64Tx: string,
    connection: Connection,
    options?: { confirmTransaction?: boolean; statusCallback?: (status: string) => void }
  ): Promise<string> => {
    // Check if component is still mounted
    if (!isMounted.current) {
      console.warn('[useWallet] sendBase64Transaction called after component unmounted');
      throw new Error('Component unmounted');
    }
    
    const availableWallet = getWallet();
    if (!availableWallet) {
      throw new Error('No wallet connected');
    }

    return signAndSendBase64(
      base64Tx,
      availableWallet,
      connection,
      options
    );
  };

  // Helper to check if we're using Dynamic wallet
  const isDynamic = (): boolean => {
    if (wallet) {
      return wallet.provider === 'dynamic';
    }
    if (currentProvider) {
      return currentProvider === 'dynamic';
    }
    return false;
  };

  // Helper to check if we're using Privy wallet
  const isPrivy = (): boolean => {
    if (wallet) {
      return wallet.provider === 'privy';
    }
    if (currentProvider) {
      return currentProvider === 'privy';
    }
    return false;
  };
  
  // Helper to check if we're using MWA wallet
  const isMWA = (): boolean => {
    if (wallet?.provider === 'mwa') {
      return true;
    }
    return authState.provider === 'mwa';
  };

  // Convert string public key to PublicKey object when available
  const publicKey = useMemo(() => {
    // First try to get from StandardWallet
    if (wallet?.publicKey) {
      try {
        return new PublicKey(wallet.publicKey);
      } catch (e) {
        console.error('[useWallet] Invalid publicKey in StandardWallet:', e);
      }
    }
    
    // Then try from legacy wallet
    if (solanaWallet?.wallets?.[0]?.publicKey) {
      try {
        return new PublicKey(solanaWallet.wallets[0].publicKey);
      } catch (e) {
        console.error('[useWallet] Invalid publicKey in legacy wallet:', e);
      }
    }
    
    // Fallback to Redux state address (especially for MWA)
    if (authState.address) {
      try {
        return new PublicKey(authState.address);
      } catch (e) {
        console.error('[useWallet] Invalid publicKey in Redux state:', e);
      }
    }
    
    return null;
  }, [wallet, solanaWallet, authState.address]);
  
  // Get wallet address as string
  const address = useMemo(() => {
    return wallet?.address || 
           wallet?.publicKey || 
           solanaWallet?.wallets?.[0]?.publicKey || 
           solanaWallet?.wallets?.[0]?.address || 
           authState.address ||
           null;
  }, [wallet, solanaWallet, authState.address]);

  // Determine if a wallet is connected
  const connected = useMemo(() => {
    return !!wallet || !!solanaWallet || !!authState.address;
  }, [wallet, solanaWallet, authState.address]);

  // Signing functions from the connected wallet (required by SolanaAgentKit)
  const signTransaction = async (transaction: Transaction | VersionedTransaction) => {
    const availableWallet = getWallet();
    if (!availableWallet) throw new Error('Wallet not connected');
    // Check if the wallet has the signTransaction method before calling it
    if ('signTransaction' in availableWallet && typeof availableWallet.signTransaction === 'function') {
      return availableWallet.signTransaction(transaction);
    } else {
      throw new Error('Connected wallet does not support signTransaction');
    }
  };

  const signAllTransactions = async (transactions: (Transaction | VersionedTransaction)[]) => {
    const availableWallet = getWallet();
    if (!availableWallet) throw new Error('Wallet not connected');
    // Check if the wallet has the signAllTransactions method before calling it
    if ('signAllTransactions' in availableWallet && typeof availableWallet.signAllTransactions === 'function') {
      return availableWallet.signAllTransactions(transactions);
    } else {
      throw new Error('Connected wallet does not support signAllTransactions');
    }
  };

  const signMessage = async (message: Uint8Array) => {
    const availableWallet = getWallet();
    if (!availableWallet) throw new Error('Wallet not connected');
    // Check if the wallet has the signMessage method before calling it
    if ('signMessage' in availableWallet && typeof availableWallet.signMessage === 'function') {
      return availableWallet.signMessage(message);
    } else {
      throw new Error('Connected wallet does not support signMessage');
    }
  };

  return {
    wallet: currentWallet,    // The best available wallet (from any provider)
    solanaWallet,             // Legacy wallet (for backward compatibility)
    publicKey,
    address,
    connected,
    sendTransaction,          // Send transaction with current wallet
    sendInstructions,         // Send instructions with current wallet
    sendBase64Transaction,    // Send base64 transaction with current wallet
    provider: currentProvider || authState.provider,
    signTransaction,          // Expose signTransaction
    signAllTransactions,      // Expose signAllTransactions
    signMessage,              // Expose signMessage
    isDynamic,                // Check if using Dynamic
    isPrivy,                  // Check if using Privy
    isMWA,                    // Check if using MWA
  };
} 