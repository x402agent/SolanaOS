/**
 * PumpFun Module
 * 
 * This module provides components and utilities for interacting with the Pump.fun platform,
 * allowing users to buy, sell, and launch tokens through a user-friendly interface.
 */

import { PumpSwapScreen } from './screens';
import { PumpSwapNavigator } from './navigation';
import * as PumpSwapServices from './services/pumpSwapService';
import * as PumpSwapUtils from './utils/pumpSwapUtils';

// Components
export { default as PumpfunBuySection } from './components/PumpfunBuySection';
export { default as PumpfunSellSection } from './components/PumpfunSellSection';
export { default as PumpfunLaunchSection } from './components/PumpfunLaunchSection';
export { default as PumpfunCard } from './components/PumpfunCard';
export * from './components/pump-swap'; // Exports SwapSection, LiquidityAddSection, etc.

// Screens
export { default as PumpfunScreen } from './screens/pumpfunScreen';
export { default as PumpSwapScreen } from './screens/PumpSwapScreen';

// Hooks
export { usePumpFun } from './hooks/usePumpFun';

// Services
export * from './services/pumpfunService';
export { 
    createPool, 
    getDepositQuoteFromBase, 
    getDepositQuoteFromQuote, 
    addLiquidity, 
    getSwapQuoteFromBase, 
    getSwapQuoteFromQuote, 
    swapTokens, 
    getWithdrawalQuote, 
    removeLiquidity, 
    getPumpAmmSdk, 
    getSwapQuote, // already exported from pumpfunUtils, but this one is specific to pumpSwapService
    getLiquidityQuote,
    Direction as PumpSwapDirection, // Alias to avoid conflict
    SwapParams as PumpSwapParams // Alias to avoid conflict
} from './services/pumpSwapService';
export * from './services/types'; // Types specific to services (CreateAndBuyTokenParams etc)

// Types
// General module types are in ./types/index.ts
// Avoid re-exporting Direction and SwapParams if they are the same as from pumpSwapService
export {
    PumpfunCardProps,
    PumpfunBuySectionProps,
    SelectedToken,
    PumpfunSellSectionProps,
    PumpfunLaunchSectionProps,
    PumpfunBuyParams,
    PumpfunSellParams,
    PumpfunLaunchParams,
    RaydiumSwapTransactionParams,
    PumpFunBondingBuyParams,
    PumpFunBondingSellParams,
    TokenEntry,
    BasePumpSwapProps,
    PumpSwapCardProps,
    PumpSwapSectionProps,
    LiquidityAddSectionProps,
    LiquidityRemoveSectionProps,
    PoolCreationSectionProps,
    TokenPair,
    LiquidityQuoteParams,
    LiquidityQuoteResult,
    // SwapParams, // Already exported with alias from pumpSwapService
    AddLiquidityParams,
    RemoveLiquidityParams,
    CreatePoolParams,
    PumpSwapContextType
    // Direction // Already exported with alias from pumpSwapService
} from './types';

// Utils
export * from './utils/pumpfunUtils'; // This also exports getSwapQuote (for Raydium)
export * from './utils/pumpSwapUtils';
export { MobileWallet as AnchorMobileWallet } from './utils/anchorMobilePatch'; // Renamed for clarity

// Navigation
export { default as PumpSwapNavigator } from './navigation/pumpSwapNavigator';
export * from './navigation/pumpSwapNavigator'; // Export ParamList

// This is the public API for the Pump.fun module
