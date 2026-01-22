import {createClient} from '@dynamic-labs/client';
import {ReactNativeExtension} from '@dynamic-labs/react-native-extension';
import {SolanaExtension} from '@dynamic-labs/solana-extension';

let dynamicClient: any | null = null;

/**
 * Initialize the dynamic client once.
 * @param environmentId The environment ID from your config.
 * @param appName (optional) The name of your app, also from config.
 * @param appLogoUrl (optional) The logo URL for your app.
 */
export function initDynamicClient(
  environmentId: string,
  appName?: string,
  appLogoUrl?: string,
) {
  if (!environmentId) {
    throw new Error(
      'initDynamicClient: environmentId is required but was not provided!',
    );
  }
  // If already created, skip re-creation.
  if (dynamicClient) {
    return dynamicClient;
  }

  try {
    // Use any type for client config to bypass TS errors with new properties
    const clientConfig: any = {
      environmentId,
      displayName: appName || 'Solana App Kit',
      appLogoUrl: appLogoUrl || '', // We may need to provide a default logo URL
      walletConnectors: ['dynamic_embedded_wallet'],
      evmNetworks: [],
      // Add Solana chain configuration
      settings: {
        chains: {
          solana: {
            enabled: true,
            mainnet: true, // or false for devnet
          },
        },
        defaultChain: 'Sol', // Set default chain to Solana
        defaultNetwork: 'mainnet', // Set default network 
        // Disable UI confirmations for transactions - set multiple ways to ensure it works
        disableConfirmationModal: true,
        noTransactionConfirmationModal: true, // Alternative name 
        autoSignEnabled: true,
        preventSolanaWalletSelectionModal: true,
        disableTransactionUI: true, // Additional setting to disable transaction UI
        skipConfirmationScreen: true, // Another way to disable confirmation screen
        // Additional settings to ensure proper transaction handling
        walletConnectorsPriorityOrder: ['dynamic_embedded_wallet', 'wallet_connect'], 
        enableVisitTrackingOnConnectOnly: false,
        enableAnalytics: false,
        // Add additional settings for no-UI experience
        alwaysShowSignatureBeforeRequest: false,
        // Enable social providers
        socialProvidersConfig: {
          google: {
            enabled: true,
          },
          apple: {
            enabled: true,
          },
        },
        // Add deeplink configuration for social login - proper format
        deepLinkConfig: {
          url: 'solanaappkit://dynamic-auth',
        },
      },
      eventsCallbacks: {
        onAuthSuccess: (data: any) => console.log('Dynamic auth success', data),
        onAuthFailure: (error: any) => console.error('Dynamic auth failure', error),
        onLogout: () => console.log('Dynamic logout'),
        onEmbeddedWalletCreated: (data: any) => console.log('Dynamic embedded wallet created', data),
        // Add social auth callbacks
        onSocialAuthSuccess: (data: any) => console.log('Social auth success', data),
        onSocialAuthFailure: (error: any) => console.error('Social auth failure', error),
      },
      // Add more configuration for permissions and events
      storageStrategy: {
        prefer: 'localStorage',
        fallback: 'memory',
      },
      flow: {
        defaultScreen: 'login',
      },
      debug: true, // This helps with diagnosing issues
    };

    // Make sure we're extending the client with both ReactNative and Solana extensions
    dynamicClient = createClient(clientConfig)
      .extend(ReactNativeExtension({
        // Use a dummy URL here just for initialization, we don't actually use this
        appOrigin: 'https://app.example.com',
      }))
      .extend(SolanaExtension());

    // After initialization, configure the Solana extension settings
    if (dynamicClient && dynamicClient.solana) {
      try {
        // Configure Solana extension specifically
        dynamicClient.solana.configure({
          rpcUrls: {
            mainnet: 'https://api.mainnet-beta.solana.com',
            devnet: 'https://api.devnet.solana.com'
          },
          autoVerify: false, // Don't auto-verify transactions
          autoApprove: true,  // Auto-approve transactions
          disableTransactionModal: true, // Specifically disable transaction modal for Solana
        });
        console.log('Solana extension configured successfully');
      } catch (configError) {
        console.warn('Failed to configure Solana extension:', configError);
      }
    }

    // After initialization, set configuration options
    if (dynamicClient && dynamicClient.settings && typeof dynamicClient.settings.set === 'function') {
      try {
        // Critical settings to disable UI popups that cause problems in React Native
        console.log('Configuring Dynamic client settings...');
        dynamicClient.settings.set('disableConfirmationModal', true);
        dynamicClient.settings.set('noTransactionConfirmationModal', true);
        dynamicClient.settings.set('autoSignEnabled', true);
        dynamicClient.settings.set('preventSolanaWalletSelectionModal', true);
        dynamicClient.settings.set('disableTransactionUI', true);
        dynamicClient.settings.set('skipConfirmationScreen', true);
        dynamicClient.settings.set('alwaysShowSignatureBeforeRequest', false);
        
        // Set Solana as default
        dynamicClient.settings.set('defaultChain', 'Sol');
        dynamicClient.settings.set('defaultNetwork', 'mainnet');
        
        // Make sure embedded wallet is prioritized
        dynamicClient.settings.set('walletConnectorsPriorityOrder', ['dynamic_embedded_wallet']);
        
        // Enable social providers
        dynamicClient.settings.set('socialProvidersConfig', {
          google: { enabled: true },
          apple: { enabled: true },
        });
        
        // Set deeplink configuration 
        dynamicClient.settings.set('deepLinkConfig', {
          url: 'solanaappkit://dynamic-auth',
        });
        
        console.log('Dynamic transaction UI settings configured');
      } catch (settingsError) {
        console.error('Failed to configure Dynamic settings:', settingsError);
        // Don't throw here, as we can still use the client even if settings fail
      }
    } else {
      console.warn('Dynamic client settings are not available, skipping configuration');
    }

    // Log successful initialization
    console.log('Dynamic client successfully initialized');

    return dynamicClient;
  } catch (error) {
    console.error('Failed to initialize Dynamic client:', error);
    // Additional detailed logging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

/**
 * Get the previously initialized dynamic client.
 * If the client was never initialized, this throws an error.
 */
export function getDynamicClient() {
  if (!dynamicClient) {
    throw new Error(
      'Dynamic client not initialized. Call initDynamicClient first.',
    );
  }
  return dynamicClient;
}

/**
 * Utility function to check if a wallet is a Dynamic wallet
 */
export function isDynamicWallet(wallet: any): boolean {
  if (!wallet) return false;
  
  // Check if it's a Dynamic wallet by checking properties
  return (
    // Has Dynamic-specific properties
    (wallet.address && wallet.id && wallet.type === 'dynamic_embedded_wallet') ||
    // Or is explicitly marked as dynamic
    wallet.provider === 'dynamic'
  );
}
