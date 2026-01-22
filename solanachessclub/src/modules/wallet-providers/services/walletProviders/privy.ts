// File: /src/services/walletProviders/privy.ts
import {
  useLogin,
  usePrivy,
  useEmbeddedSolanaWallet,
  useRecoverEmbeddedWallet,
  isNotCreated,
  needsRecovery,
  useLoginWithOAuth,
} from '@privy-io/expo';
import {useCallback} from 'react';
import {useCustomization} from '@/shared/config/CustomizationProvider';

export function usePrivyWalletLogic() {
  const {login} = useLogin();
  const {login: loginWithOAuth} = useLoginWithOAuth();
  const {user, isReady, logout} = usePrivy();
  const solanaWallet = useEmbeddedSolanaWallet();
  const {recover} = useRecoverEmbeddedWallet();

  // For example, if you needed the config:
  const {
    auth: {privy: privyConfig},
  } = useCustomization();

  const handlePrivyLogin = useCallback(
    async ({
      loginMethod = 'email',
      setStatusMessage,
    }: {
      loginMethod?: 'email' | 'sms' | 'apple' | 'google';
      setStatusMessage?: (msg: string) => void;
    }) => {
      if (user) {
        setStatusMessage?.(`You are already logged in as ${user?.id}`);
        return;
      }
      try {
        setStatusMessage?.(`Connecting with privy via ${loginMethod}...`);
        
        // For Apple and Google, use the OAuth method directly 
        if (loginMethod === 'apple' || loginMethod === 'google') {
          const result = await loginWithOAuth({ 
            provider: loginMethod,
            // For Apple, don't set isLegacyAppleIosBehaviorEnabled to use native flow
          });
          
          console.log(`Privy ${loginMethod} login result:`, result);
          
          if (!result) {
            const errorMsg = `${loginMethod} authentication did not complete successfully`;
            console.error(errorMsg);
            throw new Error(errorMsg);
          }
          
          if (result) {
            setStatusMessage?.(`Connected via ${loginMethod}`);
            return result;
          }
        } else {
          // For email and other methods, use the regular login 
          const session = await login({
            loginMethods: [loginMethod],
            appearance: {logo: ''},
          });
          if (session?.user) {
            setStatusMessage?.(`Connected user: ${session.user.id}`);
            return session;
          }
        }
      } catch (error: any) {
        console.error('Privy Login Error:', error);
        setStatusMessage?.(`Connection failed: ${error.message}`);
        throw error; // Re-throw to allow component-level error handling
      }
    },
    [user, login, loginWithOAuth],
  );

  const monitorSolanaWallet = useCallback(
    async ({
      selectedProvider,
      setStatusMessage,
      onWalletConnected,
    }: {
      selectedProvider: string;
      setStatusMessage?: (msg: string) => void;
      onWalletConnected?: (info: {provider: 'privy'; address: string}) => void;
    }) => {
      if (selectedProvider !== 'privy') {
        console.log('Not using Privy provider, skipping wallet monitoring');
        return;
      }

      if (!user) {
        console.log('No user logged in, cannot monitor wallet');
        return;
      }

      if (!isReady) {
        console.log('Privy SDK not ready, cannot monitor wallet');
        return;
      }

      if (!solanaWallet) {
        console.log('Solana wallet object not available');
        return;
      }

      console.log('Monitoring Solana wallet, status:', solanaWallet.status);
      console.log('Wallet object:', JSON.stringify(solanaWallet, null, 2));

      try {
        // First check if the wallet already exists and is connected
        if (solanaWallet.status === 'connected' && solanaWallet.wallets && solanaWallet.wallets.length > 0) {
          const connectedWallet = solanaWallet.wallets[0];
          setStatusMessage?.(
            `Connected to existing wallet: ${connectedWallet.publicKey}`,
          );
          onWalletConnected?.({
            provider: 'privy',
            address: connectedWallet.publicKey,
          });
          return;
        }

        // Check if wallet needs recovery
        if (needsRecovery(solanaWallet)) {
          console.log('Wallet needs recovery, skipping auto-creation');
          setStatusMessage?.('Wallet needs recovery');
          return;
        }

        // If wallet doesn't exist, create it
        if (isNotCreated(solanaWallet)) {
          console.log('Wallet not created, creating new wallet');
          setStatusMessage?.('Creating new Solana wallet...');
          
          try {
            // Using the create method directly from the Solana wallet
            const result = await solanaWallet.create();
            console.log('Wallet creation result:', result);
            
            // Verify wallet was created successfully
            if (solanaWallet.wallets && solanaWallet.wallets.length > 0) {
              const newWallet = solanaWallet.wallets[0];
              console.log(`Created new wallet with address: ${newWallet.publicKey}`);
              setStatusMessage?.(`Created wallet: ${newWallet.publicKey}`);
              onWalletConnected?.({
                provider: 'privy',
                address: newWallet.publicKey,
              });
            } else {
              console.error('Wallet creation completed but no wallet found in wallets array');
              setStatusMessage?.('Wallet creation failed: No wallet detected after creation');
            }
          } catch (createError: any) {
            console.error('Error creating Solana wallet:', createError);
            setStatusMessage?.(`Wallet creation failed: ${createError.message}`);
          }
          return;
        }

        // For any other wallet status, try to use getProvider to connect
        try {
          console.log('Attempting to connect to wallet via getProvider');
          if (solanaWallet.getProvider) {
            const provider = await solanaWallet.getProvider();
            if (provider && solanaWallet.wallets && solanaWallet.wallets.length > 0) {
              const wallet = solanaWallet.wallets[0];
              console.log(`Connected to wallet: ${wallet.publicKey}`);
              setStatusMessage?.(`Connected to wallet: ${wallet.publicKey}`);
              onWalletConnected?.({
                provider: 'privy',
                address: wallet.publicKey,
              });
            } else {
              console.error('Provider available but no wallet found in wallets array');
              setStatusMessage?.('Provider available but no wallet found');
            }
          } else {
            console.warn('solanaWallet.getProvider is undefined, cannot connect');
            setStatusMessage?.('Cannot connect to wallet: Provider method unavailable');
          }
        } catch (providerError) {
          console.error('Error getting wallet provider:', providerError);
          setStatusMessage?.('Failed to connect to wallet provider');
        }
      } catch (error: any) {
        console.error('Error in monitorSolanaWallet:', error);
        setStatusMessage?.(`Wallet monitoring error: ${error.message}`);
      }
    },
    [isReady, solanaWallet, user],
  );

  const handleWalletRecovery = useCallback(
    async ({
      recoveryMethod,
      password,
      setStatusMessage,
      onWalletRecovered,
    }: {
      recoveryMethod: 'user-passcode' | 'google-drive' | 'icloud';
      password: string;
      setStatusMessage?: (msg: string) => void;
      onWalletRecovered?: (info: {provider: 'privy'; address: string}) => void;
    }) => {
      try {
        setStatusMessage?.('Recovering wallet...');
        await recover({recoveryMethod, password});
        const provider = solanaWallet.getProvider
          ? await solanaWallet.getProvider().catch(() => null)
          : null;
        if (
          provider &&
          solanaWallet.wallets &&
          solanaWallet.wallets.length > 0
        ) {
          const recoveredWallet = solanaWallet.wallets[0];
          setStatusMessage?.(`Recovered wallet: ${recoveredWallet.publicKey}`);
          onWalletRecovered?.({
            provider: 'privy',
            address: recoveredWallet.publicKey,
          });
        } else {
          setStatusMessage?.('Wallet recovery failed: Provider not available');
        }
      } catch (error: any) {
        console.error('Wallet recovery error:', error);
        setStatusMessage?.(`Wallet recovery failed: ${error.message}`);
      }
    },
    [recover, solanaWallet],
  );

  const handlePrivyLogout = useCallback(
    async (setStatusMessage?: (msg: string) => void) => {
      try {
        await logout();
        setStatusMessage?.('Logged out successfully');
      } catch (error: any) {
        setStatusMessage?.(error.message || 'Logout failed');
      }
    },
    [logout],
  );

  return {
    user,
    isReady,
    solanaWallet,
    handlePrivyLogin,
    handlePrivyLogout,
    monitorSolanaWallet,
    handleWalletRecovery,
  };
}

export default usePrivyWalletLogic;
