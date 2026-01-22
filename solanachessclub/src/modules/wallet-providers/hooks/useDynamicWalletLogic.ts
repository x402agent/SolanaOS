import {useState, useCallback, useEffect} from 'react';
import {getDynamicClient} from '../services/walletProviders/dynamic';
import {useCustomization} from '@/shared/config/CustomizationProvider';

export function useDynamicWalletLogic() {
  const [user, setUser] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // We can optionally read config if we need it for logging or additional customization
  const {
    auth: {dynamic: dynamicConfig},
  } = useCustomization();

  // Poll for changes to the authenticated user from the dynamic client
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const client = getDynamicClient();
        const authUser = client?.auth?.authenticatedUser;
        if (authUser && (!user || user.id !== authUser.userId)) {
          setUser(authUser);
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error('Failed to get Dynamic client:', e);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [user]);

  // Check if user has a wallet and monitor for changes whenever auth state changes
  useEffect(() => {
    if (isAuthenticated) {
      monitorDynamicWallet({
        setStatusMessage: console.log,
        onWalletConnected: ({address}) => {
          setWalletAddress(address);
        },
      });
    }
  }, [isAuthenticated]);

  // Monitors (or creates) the embedded wallet.
  const monitorDynamicWallet = useCallback(
    async ({
      setStatusMessage,
      onWalletConnected,
    }: {
      setStatusMessage?: (msg: string) => void;
      onWalletConnected?: (info: {
        provider: 'dynamic';
        address: string;
      }) => void;
    }) => {
      let client: any;
      try {
        client = getDynamicClient();
      } catch (e) {
        console.error('Failed to get Dynamic client:', e);
        setStatusMessage?.('Dynamic client not initialized');
        return;
      }

      // Ensure client is properly initialized
      if (!client || !client.auth) {
        console.error('Dynamic client not fully initialized');
        setStatusMessage?.('Dynamic client not properly initialized');
        return;
      }

      try {
        // First check if the user is authenticated
        if (!client.auth?.authenticatedUser) {
          setStatusMessage?.('User not authenticated');
          return;
        }

        // Check for existing wallets with better error handling
        try {
          const wallets = client.wallets?.userWallets || [];
          if (wallets && wallets.length > 0) {
            const addr = wallets[0].address;
            setStatusMessage?.(`Connected to existing wallet: ${addr}`);
            setWalletAddress(addr);
            onWalletConnected?.({provider: 'dynamic', address: addr});
            return;
          }
        } catch (walletError) {
          console.error('Error accessing userWallets:', walletError);
        }

        // If no wallets found, try to create one
        setStatusMessage?.('No wallet found, attempting to create one...');
        
        if (!client.wallets?.embedded?.createWallet) {
          throw new Error('Dynamic embedded wallet creation not available');
        }

        // Create the embedded wallet if none exists
        try {
          // Check if primary wallet is already set
          if (client.wallets.primary) {
            setStatusMessage?.(`Primary wallet already set: ${client.wallets.primary.address}`);
            setWalletAddress(client.wallets.primary.address);
            onWalletConnected?.({provider: 'dynamic', address: client.wallets.primary.address});
            return;
          }
          
          // Create with more explicit parameters for Solana
          const newWallet = await client.wallets.embedded.createWallet({
            chain: 'Sol',
            network: 'mainnet', // or 'devnet' based on your needs
            chainId: 'mainnet-beta', // Explicit chain ID for Solana
            chainName: 'Solana', // Chain name
          });
          
          // If a wallet was created, set it as primary and return
          if (newWallet && newWallet.address) {
            setStatusMessage?.(`Created new wallet: ${newWallet.address}`);
            // Set as primary wallet
            if (typeof client.wallets.setPrimary === 'function') {
              await client.wallets.setPrimary({ walletId: newWallet.id });
              setStatusMessage?.(`Set as primary wallet: ${newWallet.address}`);
            }
            setWalletAddress(newWallet.address);
            onWalletConnected?.({provider: 'dynamic', address: newWallet.address});
            return;
          }
        } catch (createError: any) {
          console.error('Error creating wallet:', createError);
          // If we get a specific error about wallet already existing, we can try to get it again
          if (createError.message?.includes('already exists')) {
            setStatusMessage?.('Wallet already exists, retrieving...');
          } else if (createError.message?.includes('Chain is required')) {
            // Try again with more specific chain parameters
            try {
              setStatusMessage?.('Retrying with explicit chain parameters...');
              const retryWallet = await client.wallets.embedded.createWallet({
                chain: 'Sol',
                network: 'mainnet',
                chainId: 'mainnet-beta', // Try explicit chainId for Solana
              });
              
              if (retryWallet && retryWallet.address) {
                setStatusMessage?.(`Created wallet on retry: ${retryWallet.address}`);
                // Set as primary wallet
                if (typeof client.wallets.setPrimary === 'function') {
                  await client.wallets.setPrimary({ walletId: retryWallet.id });
                  setStatusMessage?.(`Set as primary wallet: ${retryWallet.address}`);
                }
                setWalletAddress(retryWallet.address);
                onWalletConnected?.({provider: 'dynamic', address: retryWallet.address});
                return;
              }
            } catch (retryError: any) {
              console.error('Retry failed:', retryError);
              throw retryError;
            }
          } else {
            throw createError;
          }
        }

        // Check if wallet was created successfully
        try {
          // Try to access wallets from client.wallets.primary first (recommended approach)
          if (client.wallets.primary) {
            const addr = client.wallets.primary.address;
            setStatusMessage?.(`Primary wallet available: ${addr}`);
            setWalletAddress(addr);
            onWalletConnected?.({provider: 'dynamic', address: addr});
            return;
          }
          
          // Fallback to userWallets if no primary wallet is set
          const newWallets = client.wallets?.userWallets || [];
          if (newWallets && newWallets.length > 0) {
            const addr = newWallets[0].address;
            setStatusMessage?.(`Wallet available: ${addr}`);
            // Try to set this as the primary wallet
            if (typeof client.wallets.setPrimary === 'function') {
              await client.wallets.setPrimary({ walletId: newWallets[0].id });
              setStatusMessage?.(`Set as primary wallet: ${addr}`);
            }
            setWalletAddress(addr);
            onWalletConnected?.({provider: 'dynamic', address: addr});
            return;
          }
        } catch (finalError) {
          console.error('Final attempt to get wallet failed:', finalError);
        }
        
        throw new Error('Failed to create or retrieve wallet');
      } catch (error: any) {
        console.error('Dynamic wallet error:', error);
        setStatusMessage?.(`Wallet error: ${error.message}`);
      }
    },
    [],
  );

  // Handles the dynamic login flow by showing the Dynamic auth modal or using social login
  const handleDynamicLogin = useCallback(
    async ({
      loginMethod = 'email',
      setStatusMessage,
      onSuccess,
      navigation,
    }: {
      loginMethod?: 'email' | 'sms' | 'google' | 'apple';
      setStatusMessage?: (msg: string) => void;
      onSuccess?: (info: { provider: 'dynamic'; address: string }) => void;
      navigation?: any;
    }) => {
      let client: any;
      try {
        client = getDynamicClient();
      } catch (e) {
        console.error('Failed to get Dynamic client:', e);
        setStatusMessage?.('Dynamic client not initialized');
        return;
      }

      // Ensure client is properly initialized
      if (!client || !client.auth) {
        console.error('Dynamic client not fully initialized');
        setStatusMessage?.('Dynamic client not properly initialized');
        return;
      }

      try {
        setStatusMessage?.(`Connecting with Dynamic via ${loginMethod}...`);
        
        // Set the UI preferences to disable transaction confirmations
        if (client.settings && typeof client.settings.set === 'function') {
          try {
            // Core settings to disable UI popups
            client.settings.set('disableConfirmationModal', true);
            client.settings.set('noTransactionConfirmationModal', true);
            client.settings.set('autoSignEnabled', true);
            client.settings.set('preventSolanaWalletSelectionModal', true);
            client.settings.set('disableTransactionUI', true);
            client.settings.set('skipConfirmationScreen', true);
            client.settings.set('alwaysShowSignatureBeforeRequest', false);
            
            // Wallet settings
            client.settings.set('walletConnectorsPriorityOrder', ['dynamic_embedded_wallet']);
            client.settings.set('defaultChain', 'Sol');
            client.settings.set('defaultNetwork', 'mainnet');
            
            console.log('Disabled Dynamic transaction UI popups and set wallet priority');
          } catch (settingsError) {
            console.warn('Failed to disable Dynamic UI confirmations:', settingsError);
          }
        }
        
        // Configure Solana extension if needed
        if (client.solana && typeof client.solana.configure === 'function') {
          try {
            client.solana.configure({
              autoVerify: false,  // Don't auto-verify transactions
              autoApprove: true,  // Auto-approve transactions
              disableTransactionModal: true, // Specifically disable transaction modal
              rpcUrls: {
                mainnet: 'https://api.mainnet-beta.solana.com',
                devnet: 'https://api.devnet.solana.com'
              },
            });
            console.log('Configured Solana extension for Dynamic');
          } catch (solanaConfigError) {
            console.warn('Failed to configure Dynamic Solana extension:', solanaConfigError);
          }
        }
        
        // Create a function to handle successful auth
        const onAuthSuccess = () => {
          setIsAuthenticated(true);
          // Automatically create/get wallet and trigger success callback after auth
          monitorDynamicWallet({
            setStatusMessage,
            onWalletConnected: info => {
              if (onSuccess && info.address) {
                onSuccess(info);
              }
            },
          });
          
          // Cleanup the listener if removeListener exists
          if (client.removeListener) {
            client.removeListener('authSuccess', onAuthSuccess);
          }
        };
        
        // Try to use the event system if available
        if (client.on && typeof client.on === 'function') {
          client.on('authSuccess', onAuthSuccess);
        } else {
          console.log('Dynamic client does not support events, using auth state polling');
          // If events aren't supported, we'll fall back to polling for auth state
        }
        
        // Handle different login methods
        if (loginMethod === 'google' && client.auth?.social?.connect) {
          // Use direct social login for Google
          console.log('Using social.connect for Google login');
          try {
            console.log('Provider types available:', 
              client.auth.social ? 
              Object.keys(client.auth.social).join(', ') : 
              'none');
              
            // Try calling social connect with detailed logging
            console.log('Attempting social.connect with Google provider...');
            await client.auth.social.connect({
              provider: 'google',
            });
            console.log('Google social connect call completed');
            
            // After social login completes, monitor for auth success with timeout
            const maxWaitTimeMs = 30000; // 30 seconds
            const checkIntervalMs = 1000; // 1 second
            const startTime = Date.now();
            
            console.log('Starting to poll for authenticated user...');
            const checkInterval = setInterval(() => {
              const elapsed = Date.now() - startTime;
              
              if (client.auth?.authenticatedUser) {
                clearInterval(checkInterval);
                console.log('Google auth user found:', client.auth.authenticatedUser);
                setUser(client.auth.authenticatedUser);
                onAuthSuccess();
              } else if (elapsed >= maxWaitTimeMs) {
                clearInterval(checkInterval);
                console.log('Google auth polling timed out after', elapsed, 'ms');
              } else if (elapsed % 5000 === 0) {
                // Log every 5 seconds
                console.log('Still polling for auth user, elapsed:', elapsed, 'ms');
              }
            }, checkIntervalMs);
          } catch (socialError: any) {
            console.error('Google social login error:', socialError);
            console.error('Error details:', JSON.stringify({
              message: socialError.message,
              name: socialError.name,
              stack: socialError.stack
            }, null, 2));
            setStatusMessage?.(`Google login failed: ${socialError.message}`);
            // Don't throw, just log the error
            // Instead of throwing, we'll now fall back to email if social login fails
            console.log('Falling back to email login after Google social login failure');
            // Show the authentication modal
            if (client.ui?.auth?.show) {
              await client.ui.auth.show();
            }
          }
        } 
        else if (loginMethod === 'apple' && client.auth?.social?.connect) {
          // Use direct social login for Apple
          console.log('Using social.connect for Apple login');
          try {
            console.log('Provider types available:', 
              client.auth.social ? 
              Object.keys(client.auth.social).join(', ') : 
              'none');
              
            // Try calling social connect with detailed logging
            console.log('Attempting social.connect with Apple provider...');
            await client.auth.social.connect({ 
              provider: 'apple',
              // redirectUrl: 'solanaappkit://dynamic-auth' // Explicitly set redirect URL
            });
            console.log('Apple social connect call completed');
            
            // After social login completes, monitor for auth success with timeout
            const maxWaitTimeMs = 30000; // 30 seconds
            const checkIntervalMs = 1000; // 1 second
            const startTime = Date.now();
            
            console.log('Starting to poll for authenticated user...');
            const checkInterval = setInterval(() => {
              const elapsed = Date.now() - startTime;
              
              if (client.auth?.authenticatedUser) {
                clearInterval(checkInterval);
                console.log('Apple auth user found:', client.auth.authenticatedUser);
                setUser(client.auth.authenticatedUser);
                onAuthSuccess();
              } else if (elapsed >= maxWaitTimeMs) {
                clearInterval(checkInterval);
                console.log('Apple auth polling timed out after', elapsed, 'ms');
              } else if (elapsed % 5000 === 0) {
                // Log every 5 seconds
                console.log('Still polling for auth user, elapsed:', elapsed, 'ms');
              }
            }, checkIntervalMs);
          } catch (socialError: any) {
            console.error('Apple social login error:', socialError);
            console.error('Error details:', JSON.stringify({
              message: socialError.message,
              name: socialError.name,
              stack: socialError.stack
            }, null, 2));
            setStatusMessage?.(`Apple login failed: ${socialError.message}`);
            // Don't throw, just log the error
            // Instead of throwing, we'll now fall back to email if social login fails
            console.log('Falling back to email login after Apple social login failure');
            // Show the authentication modal
            if (client.ui?.auth?.show) {
              await client.ui.auth.show();
            }
          }
        }
        else {
          // For email/sms, show the authentication modal
          if (client.ui?.auth?.show) {
            await client.ui.auth.show();
          } else {
            throw new Error('Dynamic client UI methods not available');
          }
          
          // If event system wasn't available, start polling for auth success
          if (!client.on || typeof client.on !== 'function') {
            // Poll for authentication success
            const checkInterval = setInterval(() => {
              if (client.auth?.authenticatedUser) {
                clearInterval(checkInterval);
                setUser(client.auth.authenticatedUser);
                onAuthSuccess();
              }
            }, 1000);
            
            // Clear the interval after 30 seconds to prevent infinite polling
            setTimeout(() => clearInterval(checkInterval), 30000);
          }
        }
      } catch (error: any) {
        console.error('Dynamic auth error:', error);
        setStatusMessage?.(`Connection failed: ${error.message}`);
        throw error;
      }
    },
    [monitorDynamicWallet],
  );

  // Handles logout for the dynamic provider
  const handleDynamicLogout = useCallback(
    async (setStatusMessage?: (msg: string) => void) => {
      let client: any;
      try {
        client = getDynamicClient();
      } catch (e) {
        setStatusMessage?.('Dynamic client not initialized');
        return;
      }

      try {
        if (client.auth.logout) {
          await client.auth.logout();
        }
        setUser(null);
        setWalletAddress(null);
        setIsAuthenticated(false);
        setStatusMessage?.('Logged out successfully');
      } catch (error: any) {
        setStatusMessage?.(error.message || 'Logout failed');
      }
    },
    [],
  );

  return {
    user,
    walletAddress,
    isAuthenticated,
    handleDynamicLogin,
    handleDynamicLogout,
    monitorDynamicWallet,
  };
}
