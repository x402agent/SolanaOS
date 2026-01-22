// Components
export { default as EmbeddedWalletAuth } from './components/wallet/EmbeddedWallet';
export { default as TurnkeyWalletAuth } from './components/turnkey/TurnkeyWallet';
export { createWalletStyles as WalletStyles } from './components/wallet/wallet.styles';
export { WALLET_DEFAULT_THEME as WalletTheme } from './components/wallet/wallet.theme';

// Hooks
export { useAuth } from './hooks/useAuth';
export { useWallet } from './hooks/useWallet';
export { useTurnkeyWalletLogic } from './hooks/useTurnkeyWalletLogic';
export { useDynamicWalletLogic } from './hooks/useDynamicWalletLogic';

// Services
export {
  getDynamicClient,
  initDynamicClient,
  isDynamicWallet
} from './services/walletProviders/dynamic';

export {
  default as initPrivyClient,
  default as getPrivyClient
} from './services/walletProviders/privy';

export { handleTurnkeyConnect } from './services/walletProviders/turnkey';

export {
  TransactionService,
  useTransactionService
} from './services/transaction/transactionService';

// Types
export type {
  // Wallet types
  StandardWallet,
  UnifiedWallet,
  
  // Auth types
  WalletMonitorParams,
  
  // Transaction types
  WalletProvider,
  TransactionFormat,
  SendTransactionOptions,
  
  // Provider types
  WalletProviderType,
  WalletProvidersConfig,
  DynamicClientConfig,
  TurnkeyClientConfig,
  PrivyClientConfig
} from './types';
