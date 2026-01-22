import {useCallback} from 'react';
import {useDispatch} from 'react-redux';
import {loginSuccess, logoutSuccess} from '@/shared/state/auth/reducer';
import {usePrivyWalletLogic} from '../services/walletProviders/privy';
import {useCustomization} from '@/shared/config/CustomizationProvider';
import {useAppNavigation} from '@/shared/hooks/useAppNavigation';
import {getDynamicClient} from '../services/walletProviders/dynamic';
import {useAppSelector} from '@/shared/hooks/useReduxHooks';
import {VersionedTransaction, PublicKey} from '@solana/web3.js';
import {useLoginWithOAuth} from '@privy-io/expo';
import { useDynamicWalletLogic } from './useDynamicWalletLogic';
import { useTurnkeyWalletLogic } from './useTurnkeyWalletLogic';
import { StandardWallet, LoginMethod, WalletMonitorParams } from '../types';

/**
 * Summarized usage:
 *  1) Read which provider is set from config.
 *  2) If 'privy', we handle via `usePrivyWalletLogic`.
 *  3) If 'dynamic', we handle via `useDynamicWalletLogic`.
 *  4) If 'turnkey', we handle via `useTurnkeyWalletLogic`.
 */
export function useAuth() {
  const {auth: authConfig} = useCustomization();
  const selectedProvider = authConfig.provider;
  const dispatch = useDispatch();
  const navigation = useAppNavigation();
  const authState = useAppSelector(state => state.auth);

  // Get wallet address and provider from Redux state
  const storedAddress = authState.address;
  const storedProvider = authState.provider;

  /** PRIVY CASE */
  if (selectedProvider === 'privy') {
    const {
      handlePrivyLogin,
      handlePrivyLogout,
      monitorSolanaWallet,
      user,
      solanaWallet,
    } = usePrivyWalletLogic();
    
    // Get the direct Privy OAuth login hook
    const {login: loginWithOAuth} = useLoginWithOAuth();

    // Create a standardized wallet object for Privy
    const standardWallet: StandardWallet | null = solanaWallet?.wallets?.[0] ? {
      provider: 'privy',
      address: solanaWallet.wallets[0].publicKey,
      publicKey: solanaWallet.wallets[0].publicKey,
      rawWallet: solanaWallet.wallets[0],
      getWalletInfo: () => ({
        walletType: 'Privy',
        address: solanaWallet.wallets?.[0]?.publicKey || null,
      }),
      getProvider: async () => {
        if (solanaWallet?.getProvider) {
          return solanaWallet.getProvider();
        }
        throw new Error('Privy wallet provider not available');
      },
    } : null;

    const loginWithGoogle = useCallback(async () => {
      try {
        // Use direct OAuth login instead of handlePrivyLogin
        const result = await loginWithOAuth({ provider: 'google' });
        console.log('[useAuth] OAuth login result:', result);
        
        console.log('[useAuth] Starting Solana wallet monitoring after successful login');
        
        // First try creating the wallet explicitly
        if (solanaWallet && typeof solanaWallet.create === 'function') {
          try {
            console.log('[useAuth] Attempting direct wallet creation first');
            const createResult = await solanaWallet.create();
            console.log('[useAuth] Direct wallet creation result:', createResult);
          } catch (createError) {
            console.log('[useAuth] Direct wallet creation failed (may already exist):', createError);
          }
        }
        
        // Continue monitoring the wallet after login
        await monitorSolanaWallet({
          selectedProvider: 'privy',
          setStatusMessage: (msg) => {
            console.log('[useAuth] Wallet status:', msg);
          },
          onWalletConnected: info => {
            console.log('[useAuth] Wallet connected:', info);
            // Set initial username from the wallet address when logging in
            const initialUsername = info.address.substring(0, 6);
            console.log('[useAuth] Setting initial username:', initialUsername);
            
            dispatch(loginSuccess({
              provider: 'privy', 
              address: info.address,
              username: initialUsername
            }));
            navigation.navigate('MainTabs');
          },
        });
      } catch (error) {
        console.error('[useAuth] Google login error:', error);
      }
    }, [loginWithOAuth, monitorSolanaWallet, solanaWallet, dispatch, navigation]);

    const loginWithApple = useCallback(async () => {
      try {
        console.log('[useAuth] Starting Apple login process...');
        // Use direct OAuth login with proper error handling
        const result = await loginWithOAuth({ 
          provider: 'apple',
          // Don't pass isLegacyAppleIosBehaviorEnabled to use native flow
        });
        
        console.log('[useAuth] Apple OAuth login result:', result);
        
        // Check if we have a valid authentication result before proceeding
        if (!result) {
          console.error('[useAuth] Apple authentication failed - no result returned');
          throw new Error('Apple authentication failed to complete');
        }
        
        console.log('[useAuth] Starting Solana wallet monitoring after successful login');
        
        // First try creating the wallet explicitly
        if (solanaWallet && typeof solanaWallet.create === 'function') {
          try {
            console.log('[useAuth] Attempting direct wallet creation first');
            const createResult = await solanaWallet.create();
            console.log('[useAuth] Direct wallet creation result:', createResult);
          } catch (createError) {
            console.log('[useAuth] Direct wallet creation failed (may already exist):', createError);
          }
        }
        
        // Continue monitoring the wallet after login
        await monitorSolanaWallet({
          selectedProvider: 'privy',
          setStatusMessage: (msg) => {
            console.log('[useAuth] Wallet status:', msg);
          },
          onWalletConnected: info => {
            console.log('[useAuth] Wallet connected:', info);
            // Set initial username from the wallet address when logging in
            const initialUsername = info.address.substring(0, 6);
            console.log('[useAuth] Setting initial username:', initialUsername);
            
            dispatch(loginSuccess({
              provider: 'privy', 
              address: info.address,
              username: initialUsername
            }));
            navigation.navigate('MainTabs');
          },
        });
      } catch (error) {
        console.error('[useAuth] Apple login error:', error);
        throw error; // Re-throw to allow component-level error handling
      }
    }, [loginWithOAuth, monitorSolanaWallet, solanaWallet, dispatch, navigation]);

    const loginWithEmail = useCallback(async () => {
      try {
        console.log('[useAuth] Starting email login process...');
        if (handlePrivyLogin) {
          await handlePrivyLogin({
            loginMethod: 'email',
            setStatusMessage: (msg) => {
              console.log('[useAuth] Auth status:', msg);
            }
          });
          
          console.log('[useAuth] Email auth successful, starting wallet monitoring...');
          await monitorSolanaWallet({
            selectedProvider: 'privy',
            setStatusMessage: (msg) => {
              console.log('[useAuth] Wallet status:', msg);
            },
            onWalletConnected: info => {
              console.log('[useAuth] Wallet connected successfully:', info);
              // Set initial username from the wallet address when logging in
              const initialUsername = info.address.substring(0, 6);
              console.log('[useAuth] Setting initial username:', initialUsername);
              
              dispatch(loginSuccess({
                provider: 'privy', 
                address: info.address,
                username: initialUsername
              }));
              
              navigation.navigate('MainTabs');
            },
          });
        } else {
          throw new Error('Email login not available');
        }
      } catch (error) {
        console.error('[useAuth] Email login error:', error);
        throw error; // Re-throw to allow component-level error handling
      }
    }, [handlePrivyLogin, monitorSolanaWallet, dispatch, navigation]);

    const logout = useCallback(async () => {
      console.log('[useAuth] Attempting Privy logout...');
      try {
        // Wrap the SDK call in a try/catch
        try {
          await handlePrivyLogout(() => {});
          console.log('[useAuth] Privy SDK logout successful.');
        } catch (sdkError) {
          console.error('[useAuth] Error during Privy SDK logout (continuing anyway):', sdkError);
          // Continue with Redux state cleanup even if SDK logout fails
        }
        
        // Always clean up Redux state
        console.log('[useAuth] Dispatching logoutSuccess.');
        dispatch(logoutSuccess());
        console.log('[useAuth] Redux logout dispatched. Resetting navigation.');
        
        // Use setTimeout to allow React to process state changes before navigation
        setTimeout(() => {
          try {
            // Reset navigation to the initial route of the logged-out stack
            navigation.reset({
              index: 0,
              routes: [{ name: 'IntroScreen' }],
            });
          } catch (navError) {
            console.error('[useAuth] Error during navigation reset:', navError);
          }
        }, 50);
      } catch (error) {
        console.error('[useAuth] Error during Privy logout:', error);
      }
    }, [handlePrivyLogout, dispatch, navigation]);

    return {
      status: '',
      loginWithGoogle,
      loginWithApple,
      loginWithEmail,
      logout,
      user,
      solanaWallet, // Keep for backward compatibility
      wallet: standardWallet, // Add standardized wallet
    };
  } else if (selectedProvider === 'dynamic') {
    /** DYNAMIC CASE */
    console.log('[useAuth] Using Dynamic logic.');
    const {
      handleDynamicLogin,
      handleDynamicLogout,
      walletAddress,
      user,
      isAuthenticated,
      monitorDynamicWallet,
    } = useDynamicWalletLogic();

    // Create a standardized wallet object for Dynamic
    let standardWallet: StandardWallet | null = null;
    
    try {
      // Try to get the Dynamic client and user wallets
      const dynamicClient = getDynamicClient();
      if (dynamicClient?.wallets?.userWallets?.length > 0) {
        const wallet = dynamicClient.wallets.userWallets[0];
        standardWallet = {
          provider: 'dynamic',
          address: wallet.address,
          publicKey: wallet.address,
          rawWallet: wallet,
          getWalletInfo: () => ({
            walletType: 'Dynamic',
            address: wallet.address,
          }),
          getProvider: async () => {
            try {
              // Use the proper Dynamic SDK method to get a signer if available
              if (dynamicClient.solana && typeof dynamicClient.solana.getSigner === 'function') {
                // Get the signer
                const signer = await dynamicClient.solana.getSigner({ wallet });
                
                // Create a custom provider that uses signTransaction + manual send
                // instead of signAndSendTransaction (which shows UI)
                return {
                  _dynamicSdk: true, // Marker to help identify this as a Dynamic provider
                  wallet: wallet,
                  address: wallet.address,
                  _signer: signer, // Store original signer for reference
                  request: async ({ method, params }: any) => {
                    if (method === 'signAndSendTransaction') {
                      const { transaction, connection } = params;
                      
                      console.log('Dynamic custom provider: signAndSendTransaction called');
                      
                      try {
                        // Try to use the direct signAndSendTransaction method from Dynamic SDK
                        console.log('Using Dynamic Solana extension signAndSendTransaction directly');
                        const result = await signer.signAndSendTransaction(transaction, {
                          skipPreflight: false,
                          preflightCommitment: 'confirmed',
                          maxRetries: 3
                        });
                        
                        console.log('Dynamic custom provider: Transaction sent with signature:', result.signature);
                        return { signature: result.signature };
                      } catch (directSignError) {
                        console.error('Direct signAndSendTransaction failed, falling back to manual flow:', directSignError);
                        
                        // 1. Sign the transaction without sending
                        // Only sign if not already signed
                        let signedTx = transaction;
                        const isAlreadySigned = transaction instanceof VersionedTransaction 
                          ? transaction.signatures.length > 0 && transaction.signatures.some((sig: Uint8Array) => sig.length > 0)
                          : transaction.signatures.length > 0 && transaction.signatures.some((sig: any) => sig.signature !== null);
                            
                        if (!isAlreadySigned) {
                          console.log('Dynamic custom provider: Transaction not signed, signing now');
                          try {
                            // Make sure legacy transactions have blockhash and feePayer
                            if (!(transaction instanceof VersionedTransaction)) {
                              console.log('Signing legacy transaction');
                              // Make sure feePayer is set correctly
                              if (!transaction.feePayer) {
                                transaction.feePayer = new PublicKey(wallet.address);
                              }
                              
                              // Make sure recent blockhash is set
                              if (!transaction.recentBlockhash) {
                                const { blockhash } = await connection.getLatestBlockhash('confirmed');
                                transaction.recentBlockhash = blockhash;
                              }
                            } else {
                              console.log('Signing versioned transaction');
                            }
                            
                            signedTx = await signer.signTransaction(transaction);
                            console.log('Transaction signed successfully');
                          } catch (signError: any) {
                            console.error('Dynamic custom provider: Error during transaction signing:', signError);
                            throw signError;
                          }
                        } else {
                          console.log('Transaction already signed, using as is');
                        }
                        
                        // 2. Send the signed transaction ourselves
                        console.log('Dynamic custom provider: Sending signed transaction');
                        try {
                          // Serialize the transaction
                          const rawTransaction = signedTx instanceof VersionedTransaction 
                            ? signedTx.serialize()
                            : signedTx.serialize();
                            
                          // 3. Send the signed transaction with explicit options
                          const signature = await connection.sendRawTransaction(rawTransaction, {
                            skipPreflight: false, 
                            preflightCommitment: 'confirmed',
                            maxRetries: 3
                          });
                          
                          console.log('Dynamic custom provider: Transaction sent with signature:', signature);
                          return { signature };
                        } catch (sendError: any) {
                          console.error('Dynamic custom provider: Error sending transaction:', sendError);
                          if (sendError.logs) {
                            console.error('Transaction logs:', sendError.logs);
                          }
                          throw sendError;
                        }
                      }
                    }
                    throw new Error(`Method ${method} not supported by Dynamic signer`);
                  }
                };
              }
              
              // Fallback to wallet's own getProvider if available
              if (wallet.getProvider && typeof wallet.getProvider === 'function') {
                return wallet.getProvider();
              }
              
              throw new Error('Dynamic wallet provider not available');
            } catch (error) {
              console.error('Error getting Dynamic wallet provider:', error);
              throw error;
            }
          }
        };
      } else if (walletAddress) {
        // Fallback if we have walletAddress but can't access userWallets directly
        standardWallet = {
          provider: 'dynamic',
          address: walletAddress,
          publicKey: walletAddress,
          rawWallet: {
            address: walletAddress
          },
          getWalletInfo: () => ({
            walletType: 'Dynamic',
            address: walletAddress,
          }),
          getProvider: async () => {
            try {
              const client = getDynamicClient();
              if (!client) throw new Error('Dynamic client not initialized');
              
              // First try to find the wallet in userWallets
              const wallets = client.wallets?.userWallets || [];
              const wallet = wallets.find((w: any) => w.address === walletAddress);
              
              if (wallet) {
                // Use the proper Dynamic SDK method to get a signer if available
                if (client.solana && typeof client.solana.getSigner === 'function') {
                  const signer = await client.solana.getSigner({ wallet });
                  return {
                    _dynamicSdk: true, // Marker to help identify this as a Dynamic provider
                    wallet: wallet,
                    address: wallet.address,
                    _signer: signer, // Store original signer for reference
                    request: async ({ method, params }: any) => {
                      if (method === 'signAndSendTransaction') {
                        const { transaction, connection } = params;
                        
                        console.log('Dynamic custom provider: signAndSendTransaction called');
                        
                        try {
                          // Try to use the direct signAndSendTransaction method from Dynamic SDK
                          console.log('Using Dynamic Solana extension signAndSendTransaction directly');
                          const result = await signer.signAndSendTransaction(transaction, {
                            skipPreflight: false,
                            preflightCommitment: 'confirmed',
                            maxRetries: 3
                          });
                          
                          console.log('Dynamic custom provider: Transaction sent with signature:', result.signature);
                          return { signature: result.signature };
                        } catch (directSignError) {
                          console.error('Direct signAndSendTransaction failed, falling back to manual flow:', directSignError);
                          
                          // 1. Sign the transaction without sending
                          // Only sign if not already signed
                          let signedTx = transaction;
                          const isAlreadySigned = transaction instanceof VersionedTransaction 
                            ? transaction.signatures.length > 0 && transaction.signatures.some((sig: Uint8Array) => sig.length > 0)
                            : transaction.signatures.length > 0 && transaction.signatures.some((sig: any) => sig.signature !== null);
                            
                          if (!isAlreadySigned) {
                            console.log('Dynamic custom provider: Transaction not signed, signing now');
                            try {
                              // Make sure legacy transactions have blockhash and feePayer
                              if (!(transaction instanceof VersionedTransaction)) {
                                console.log('Signing legacy transaction');
                                // Make sure feePayer is set correctly
                                if (!transaction.feePayer) {
                                  transaction.feePayer = new PublicKey(wallet.address);
                                }
                                
                                // Make sure recent blockhash is set
                                if (!transaction.recentBlockhash) {
                                  const { blockhash } = await connection.getLatestBlockhash('confirmed');
                                  transaction.recentBlockhash = blockhash;
                                }
                              } else {
                                console.log('Signing versioned transaction');
                              }
                              
                              signedTx = await signer.signTransaction(transaction);
                              console.log('Transaction signed successfully');
                            } catch (signError: any) {
                              console.error('Dynamic custom provider: Error during transaction signing:', signError);
                              throw signError;
                            }
                          } else {
                            console.log('Transaction already signed, using as is');
                          }
                          
                          // 2. Send the signed transaction ourselves
                          console.log('Dynamic custom provider: Sending signed transaction');
                          try {
                            // Serialize the transaction
                            const rawTransaction = signedTx instanceof VersionedTransaction 
                              ? signedTx.serialize()
                              : signedTx.serialize();
                              
                            // 3. Send the signed transaction with explicit options
                            const signature = await connection.sendRawTransaction(rawTransaction, {
                              skipPreflight: false, 
                              preflightCommitment: 'confirmed',
                              maxRetries: 3
                            });
                            
                            console.log('Dynamic custom provider: Transaction sent with signature:', signature);
                            return { signature };
                          } catch (sendError: any) {
                            console.error('Dynamic custom provider: Error sending transaction:', sendError);
                            if (sendError.logs) {
                              console.error('Transaction logs:', sendError.logs);
                            }
                            throw sendError;
                          }
                        }
                      }
                      throw new Error(`Method ${method} not supported by Dynamic signer`);
                    }
                  };
                }
                
                // Fallback to wallet's own getProvider if available
                if (wallet.getProvider && typeof wallet.getProvider === 'function') {
                  return wallet.getProvider();
                }
              }
              
              throw new Error('No wallet found with this address or provider not available');
            } catch (error) {
              console.error('Error getting Dynamic wallet provider:', error);
              throw error;
            }
          }
        };
      }
    } catch (e) {
      // Don't throw here, just return null for wallet
      console.warn('Failed to initialize Dynamic wallet:', e);
    }

    const handleSuccessfulLogin = useCallback((info: {provider: 'dynamic', address: string}) => {
      // Set initial username from the wallet address
      const initialUsername = info.address.substring(0, 6);
      console.log('[useAuth] Setting initial username for Dynamic login:', initialUsername);
      
      dispatch(loginSuccess({
        provider: 'dynamic', 
        address: info.address,
        username: initialUsername
      }));
      navigation.navigate('MainTabs');
    }, [dispatch, navigation]);

    const loginWithEmail = useCallback(async () => {
      await handleDynamicLogin({
        loginMethod: 'email',
        setStatusMessage: () => {},
        onSuccess: handleSuccessfulLogin,
      });
    }, [handleDynamicLogin, handleSuccessfulLogin]);

    const loginWithSMS = useCallback(async () => {
      await handleDynamicLogin({
        loginMethod: 'sms',
        setStatusMessage: () => {},
        onSuccess: handleSuccessfulLogin,
      });
    }, [handleDynamicLogin, handleSuccessfulLogin]);

    const loginWithGoogle = useCallback(async () => {
      await handleDynamicLogin({
        loginMethod: 'google',
        setStatusMessage: () => {},
        onSuccess: handleSuccessfulLogin,
        navigation,
      });
    }, [handleDynamicLogin, handleSuccessfulLogin, navigation]);

    const loginWithApple = useCallback(async () => {
      await handleDynamicLogin({
        loginMethod: 'apple',
        setStatusMessage: () => {},
        onSuccess: handleSuccessfulLogin,
        navigation,
      });
    }, [handleDynamicLogin, handleSuccessfulLogin, navigation]);

    const logout = useCallback(async () => {
      console.log('[useAuth] Attempting Dynamic logout...');
      try {
        // Wrap the SDK call in a try/catch
        try {
          await handleDynamicLogout(() => {});
          console.log('[useAuth] Dynamic SDK logout successful.');
        } catch (sdkError) {
          console.error('[useAuth] Error during Dynamic SDK logout (continuing anyway):', sdkError);
          // Continue with Redux state cleanup even if SDK logout fails
        }
        
        // Always clean up Redux state
        console.log('[useAuth] Dispatching logoutSuccess.');
        dispatch(logoutSuccess());
        console.log('[useAuth] Redux logout dispatched. Resetting navigation.');
        
        // Use setTimeout to allow React to process state changes before navigation
        setTimeout(() => {
          try {
            // Reset navigation to the initial route of the logged-out stack
            navigation.reset({
              index: 0,
              routes: [{ name: 'IntroScreen' }],
            });
          } catch (navError) {
            console.error('[useAuth] Error during navigation reset:', navError);
          }
        }, 50);
      } catch (error) {
        console.error('[useAuth] Error during Dynamic logout:', error);
      }
    }, [handleDynamicLogout, dispatch, navigation]);

    // Create a solanaWallet object that mimics the Privy structure for compatibility
    const solanaWallet = standardWallet ? {
      wallets: [{
        publicKey: standardWallet.address,
        address: standardWallet.address
      }],
      getProvider: standardWallet.getProvider
    } : null;

    return {
      status: isAuthenticated ? 'authenticated' : '',
      loginWithEmail,
      loginWithSMS,
      loginWithGoogle,
      loginWithApple,
      logout,
      user: walletAddress ? {id: walletAddress} : user,
      solanaWallet, // Add compatibility object
      wallet: standardWallet, // Add standardized wallet
    };
  } else if (selectedProvider === 'turnkey') {
    /** TURNKEY CASE */
    console.log('[useAuth] Using Turnkey logic.');
    const {
      user,
      walletAddress,
      isAuthenticated,
      loading,
      otpResponse,
      handleInitOtpLogin,
      handleVerifyOtp,
      handleOAuthLogin,
      handleTurnkeyLogout
    } = useTurnkeyWalletLogic();

    // Create a standardized wallet object for Turnkey
    const standardWallet: StandardWallet | null = walletAddress ? {
      provider: 'turnkey',
      address: walletAddress,
      publicKey: walletAddress,
      rawWallet: { address: walletAddress },
      getWalletInfo: () => ({
        walletType: 'Turnkey',
        address: walletAddress,
      }),
      getProvider: async () => {
        try {
          // In a real implementation, we would get a proper provider
          // For now, we'll return a simplified provider structure
          return {
            _turnkeySdk: true,
            address: walletAddress,
            request: async ({ method, params }: any) => {
              if (method === 'signAndSendTransaction') {
                // The actual implementation would use the Turnkey SDK
                // to sign and send the transaction
                throw new Error('Turnkey transaction signing not fully implemented yet');
              }
              throw new Error(`Method ${method} not supported by Turnkey provider`);
            }
          };
        } catch (error) {
          console.error('Error getting Turnkey wallet provider:', error);
          throw error;
        }
      }
    } : null;

    // Create a solanaWallet object that mimics the Privy structure for compatibility
    const solanaWallet = standardWallet ? {
      wallets: [{
        publicKey: standardWallet.address,
        address: standardWallet.address
      }],
      getProvider: standardWallet.getProvider
    } : null;

    // Implement login methods
    const loginWithGoogle = useCallback(async () => {
      try {
        // To be implemented using OAuth
        return await handleOAuthLogin({
          oidcToken: '', // This would be provided by the OAuth flow
          providerName: 'google',
          setStatusMessage: () => {},
          onWalletConnected: (info) => {
            // Set initial username from the wallet address
            const initialUsername = info.address.substring(0, 6);
            console.log('[useAuth] Setting initial username for Turnkey login:', initialUsername);
            
            dispatch(loginSuccess({
              provider: 'turnkey', 
              address: info.address,
              username: initialUsername
            }));
            navigation.navigate('MainTabs');
            return { address: info.address };
          }
        });
      } catch (error) {
        console.error('Google login error:', error);
      }
    }, [handleOAuthLogin, dispatch, navigation]);

    const loginWithApple = useCallback(async () => {
      try {
        // To be implemented using OAuth
        return await handleOAuthLogin({
          oidcToken: '', // This would be provided by the OAuth flow
          providerName: 'apple',
          setStatusMessage: () => {},
          onWalletConnected: (info) => {
            // Set initial username from the wallet address
            const initialUsername = info.address.substring(0, 6);
            console.log('[useAuth] Setting initial username for Turnkey login:', initialUsername);
            
            dispatch(loginSuccess({
              provider: 'turnkey', 
              address: info.address,
              username: initialUsername
            }));
            navigation.navigate('MainTabs');
            return { address: info.address };
          }
        });
      } catch (error) {
        console.error('Apple login error:', error);
      }
    }, [handleOAuthLogin, dispatch, navigation]);

    // Method to initiate email OTP login
    const initEmailOtpLogin = useCallback(async (email: string) => {
      try {
        return await handleInitOtpLogin({
          email,
          setStatusMessage: () => {},
          onSuccess: (info) => {
            dispatch(loginSuccess({provider: 'turnkey', address: info.address}));
            navigation.navigate('MainTabs');
          }
        });
      } catch (error) {
        console.error('Email OTP initiation error:', error);
        throw error;
      }
    }, [handleInitOtpLogin, dispatch, navigation]);

    // Method to verify email OTP
    const verifyEmailOtp = useCallback(async (otpCode: string) => {
      try {
        return await handleVerifyOtp({
          otpCode,
          setStatusMessage: () => {},
          onWalletConnected: (info) => {
            dispatch(loginSuccess({provider: 'turnkey', address: info.address}));
            navigation.navigate('MainTabs');
          }
        });
      } catch (error) {
        console.error('Email OTP verification error:', error);
        throw error;
      }
    }, [handleVerifyOtp, dispatch, navigation]);

    const logout = useCallback(async () => {
      console.log('[useAuth] Attempting Turnkey logout...');
      try {
        // Wrap the SDK call in a try/catch
        try {
          await handleTurnkeyLogout(() => {});
          console.log('[useAuth] Turnkey SDK logout successful.');
        } catch (sdkError) {
          console.error('[useAuth] Error during Turnkey SDK logout (continuing anyway):', sdkError);
          // Continue with Redux state cleanup even if SDK logout fails
        }
        
        // Always clean up Redux state
        console.log('[useAuth] Dispatching logoutSuccess.');
        dispatch(logoutSuccess());
        console.log('[useAuth] Redux logout dispatched. Resetting navigation.');
        
        // Use setTimeout to allow React to process state changes before navigation
        setTimeout(() => {
          try {
            // Reset navigation to the initial route of the logged-out stack
            navigation.reset({
              index: 0,
              routes: [{ name: 'IntroScreen' }],
            });
          } catch (navError) {
            console.error('[useAuth] Error during navigation reset:', navError);
          }
        }, 50);
      } catch (error) {
        console.error('[useAuth] Error during Turnkey logout:', error);
      }
    }, [handleTurnkeyLogout, dispatch, navigation]);

    return {
      status: isAuthenticated ? 'authenticated' : '',
      loginWithGoogle,
      loginWithApple,
      loginWithEmail: () => {}, // Placeholder, will not be used directly
      initEmailOtpLogin,
      verifyEmailOtp,
      loading,
      otpResponse,
      logout,
      user,
      solanaWallet,
      wallet: standardWallet,
    };
  }

  // ADDED: If we're here, check for MWA wallet in Redux state
  if (storedProvider === 'mwa' && storedAddress) {
    console.log('[useAuth] Using MWA logic.');
    // Create standardized wallet object for MWA
    const mwaWallet: StandardWallet = {
      provider: 'mwa',
      address: storedAddress,
      publicKey: storedAddress,
      rawWallet: { address: storedAddress },
      getWalletInfo: () => ({
        walletType: 'MWA',
        address: storedAddress,
      }),
      // For MWA, we don't have a provider as transactions are handled by the Phantom app
      getProvider: async () => {
        // Throw error with useful message about MWA not having a provider
        throw new Error('MWA uses external wallet for signing. This is expected behavior.');
      }
    };

    // Create a solanaWallet object for backward compatibility
    const solanaWallet = {
      wallets: [{
        publicKey: storedAddress,
        address: storedAddress
      }],
      // Same behavior as the standardized wallet
      getProvider: mwaWallet.getProvider
    };

    const logout = useCallback(async () => {
      console.log('[useAuth] Attempting MWA logout (dispatching Redux action only)...');
      try {
        // For MWA, just clean up Redux state since there's no SDK to log out from
        console.log('[useAuth] Dispatching logoutSuccess for MWA.');
        dispatch(logoutSuccess());
        console.log('[useAuth] Redux logout dispatched for MWA. Resetting navigation.');
        
        // Use setTimeout to allow React to process state changes before navigation
        setTimeout(() => {
          try {
            // Reset navigation to the initial route of the logged-out stack
            navigation.reset({
              index: 0,
              routes: [{ name: 'IntroScreen' }],
            });
          } catch (navError) {
            console.error('[useAuth] Error during navigation reset:', navError);
          }
        }, 50);
      } catch (error) {
        console.error('[useAuth] Error during MWA logout dispatch:', error);
      }
    }, [dispatch, navigation]);

    return {
      status: 'authenticated',
      logout,
      user: { id: storedAddress },
      solanaWallet,
      wallet: mwaWallet,
    };
  }

  // If no recognized provider, just return empties with complete API signature
  console.warn('[useAuth] No recognized provider found or MWA not stored. Returning empty auth methods.');
  
  const safeLogout = async () => { 
    console.warn('[useAuth] Logout called but no provider active.');
    // Still dispatch logout action to ensure clean state
    dispatch(logoutSuccess());
    // Navigate to intro screen for safety
    setTimeout(() => {
      try {
        navigation.reset({
          index: 0,
          routes: [{ name: 'IntroScreen' }],
        });
      } catch (navError) {
        console.error('[useAuth] Error during navigation reset:', navError);
      }
    }, 50);
  };
  
  // Create a complete empty interface with all methods that
  // could be called from any component
  return {
    status: '', 
    logout: safeLogout,
    // Auth methods
    loginWithGoogle: async () => {},
    loginWithApple: async () => {},
    loginWithEmail: async () => {},
    loginWithSMS: async () => {},
    initEmailOtpLogin: async () => {},
    verifyEmailOtp: async () => {},
    // Data
    user: null,
    solanaWallet: null,
    wallet: null,
    // State
    loading: false,
    otpResponse: null,
    isAuthenticated: false,
    connected: false
  };
}
