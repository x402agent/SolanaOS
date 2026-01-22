/**
 * Auth-related type definitions for the embeddedWalletProviders module
 */

/**
 * Login method types supported by wallet providers
 */
export type LoginMethod = 'email' | 'sms' | 'google' | 'apple';

/**
 * Common interface for provider-specific login handlers
 */
export interface LoginHandlerParams {
  loginMethod: LoginMethod;
  setStatusMessage?: (msg: string) => void;
  onSuccess?: (info: {provider: string, address: string}) => void;
  navigation?: any;
}

/**
 * Parameters for wallet monitoring functions
 */
export interface WalletMonitorParams {
  selectedProvider?: string;
  setStatusMessage?: (msg: string) => void;
  onWalletConnected?: (info: {provider: string, address: string}) => void;
}

/**
 * Parameters for wallet recovery
 */
export interface WalletRecoveryParams {
  recoveryMethod: 'user-passcode' | 'google-drive' | 'icloud';
  password: string;
  setStatusMessage?: (msg: string) => void;
  onWalletRecovered?: (info: {provider: string, address: string}) => void;
} 