/**
 * Provider-specific type definitions for the embeddedWalletProviders module
 */

/**
 * Supported wallet provider types
 */
export type WalletProviderType = 'privy' | 'dynamic' | 'turnkey' | 'mwa';

/**
 * Dynamic client configuration
 */
export interface DynamicClientConfig {
  environmentId: string;
  appName?: string;
  appLogoUrl?: string;
}

/**
 * Privy client configuration
 */
export interface PrivyClientConfig {
  appId: string;
  clientId: string;
}

/**
 * Turnkey client configuration
 */
export interface TurnkeyClientConfig {
  apiUrl: string;
  apiKey: string;
}

/**
 * Unified wallet provider configuration
 */
export interface WalletProvidersConfig {
  provider: WalletProviderType;
  privy?: PrivyClientConfig;
  dynamic?: DynamicClientConfig;
  turnkey?: TurnkeyClientConfig;
} 