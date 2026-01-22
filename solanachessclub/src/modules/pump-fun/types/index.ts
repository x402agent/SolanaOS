/**
 * Types for the PumpFun module
 */

/**
 * Props for the PumpfunCard component
 * @interface PumpfunCardProps
 */
export interface PumpfunCardProps {
  /** Optional style override for the card container */
  containerStyle?: StyleProp<ViewStyle>;
  /** Child elements to render inside the card */
  children: React.ReactNode;
}

/**
 * Props for the PumpfunBuySection component
 * @interface PumpfunBuySectionProps
 */
export interface PumpfunBuySectionProps {
  /** Optional style override for the container */
  containerStyle?: StyleProp<ViewStyle>;
  /** Optional style override for the input fields */
  inputStyle?: StyleProp<TextStyle>;
  /** Optional style override for the buy button */
  buttonStyle?: StyleProp<ViewStyle>;
  /** Custom label for the buy button (defaults to 'Buy via Pump.fun') */
  buyButtonLabel?: string;
}

/**
 * Interface representing a token selected for selling
 * @interface SelectedToken
 */
export interface SelectedToken {
  /** The public key of the token's mint account */
  mintPubkey: string;
  /** The available token amount in UI format (decimal) */
  uiAmount: number;
}

/**
 * Props for the PumpfunSellSection component
 * @interface PumpfunSellSectionProps
 */
export interface PumpfunSellSectionProps {
  /** Optional pre-selected token to sell */
  selectedToken?: SelectedToken | null;
  /** Optional style override for the container */
  containerStyle?: StyleProp<ViewStyle>;
  /** Optional style override for the input fields */
  inputStyle?: StyleProp<TextStyle>;
  /** Optional style override for the sell button */
  buttonStyle?: StyleProp<ViewStyle>;
  /** Custom label for the sell button (defaults to 'Sell Token') */
  sellButtonLabel?: string;
}

/**
 * Props for the PumpfunLaunchSection component
 * @interface PumpfunLaunchSectionProps
 */
export interface PumpfunLaunchSectionProps {
  /** Optional style override for the container */
  containerStyle?: StyleProp<ViewStyle>;
  /** Optional style override for the input fields */
  inputStyle?: StyleProp<TextStyle>;
  /** Optional style override for the launch button */
  buttonStyle?: StyleProp<ViewStyle>;
  /** Custom label for the launch button (defaults to 'Launch Token') */
  launchButtonLabel?: string;
}

/**
 * Types for the services
 */
export interface PumpfunBuyParams {
  /** The buyer's public key */
  buyerPublicKey: string;
  /** The token address to buy */
  tokenAddress: string;
  /** The amount of SOL to spend */
  solAmount: number;
  /** The wallet to use for the transaction */
  solanaWallet: any;
  /** Optional callback for status updates */
  onStatusUpdate?: (status: string) => void;
}

export interface PumpfunSellParams {
  /** The seller's public key */
  sellerPublicKey: string;
  /** The token address to sell */
  tokenAddress: string;
  /** The amount of tokens to sell */
  tokenAmount: number;
  /** The wallet to use for the transaction */
  solanaWallet: any;
  /** Optional callback for status updates */
  onStatusUpdate?: (status: string) => void;
}

export interface PumpfunLaunchParams {
  /** The user's public key */
  userPublicKey: string;
  /** The name of the token to create */
  tokenName: string;
  /** The symbol for the token */
  tokenSymbol: string;
  /** Description of the token */
  description: string;
  /** Twitter handle */
  twitter?: string;
  /** Telegram handle */
  telegram?: string;
  /** Website URL */
  website?: string;
  /** URI of the token image */
  imageUri: string;
  /** Initial SOL amount to buy */
  solAmount: number;
  /** Slippage basis points (optional) */
  slippageBasisPoints?: bigint;
  /** The wallet to use for the transaction */
  solanaWallet: any;
  /** Optional callback for status updates */
  onStatusUpdate?: (status: string) => void;
  /** Add verification options */
  verifyToken?: boolean;
  dataIntegrityAccepted?: boolean;
  termsAccepted?: boolean;
}

// Raydium and PumpFun SDK specific types
export interface RaydiumSwapTransactionParams {
  swapResponse: any;
  computeUnitPriceMicroLamports: string;
  userPubkey: string;
  unwrapSol: boolean;
  wrapSol: boolean;
  txVersion?: string;
  inputAccount?: string;
}

export interface PumpFunBondingBuyParams {
  payerPubkey: PublicKey;
  tokenMint: PublicKey;
  lamportsToBuy: bigint;
  slippageBasis?: bigint;
  sdk: PumpFunSDK;
  connection: Connection;
}

export interface PumpFunBondingSellParams {
  sellerPubkey: PublicKey;
  tokenMint: PublicKey;
  lamportsToSell: bigint;
  slippageBasis?: bigint;
  sdk: PumpFunSDK;
  connection: Connection;
}

// Types from React Native and external libraries that are used in interfaces
import { StyleProp, ViewStyle, TextStyle } from 'react-native';
import { PublicKey, Connection } from '@solana/web3.js';
import { PumpFunSDK } from 'pumpdotfun-sdk';

// Re-export TokenEntry from common utils for convenience
export { TokenEntry } from '../../data-module/types/tokenTypes';

/**
 * Types for the PumpSwap module
 */


import { StandardWallet } from '../../wallet-providers/types';
import { Pool as SDKPool, Direction as SDKDirection } from '@pump-fun/pump-swap-sdk'; // Import with alias

// Re-export SDK types with potential alias or directly if no conflict
export { SDKPool as Pool, SDKDirection as Direction };


/**
 * Base props interface for common PumpSwap section styling
 * @interface BasePumpSwapProps
 */
export interface BasePumpSwapProps {
  /** Optional style override for the main container */
  containerStyle?: StyleProp<ViewStyle>;
  /** Optional style override for input elements */
  inputStyle?: StyleProp<TextStyle>; // Changed from ViewStyle to TextStyle for inputs
  /** Optional style override for button elements */
  buttonStyle?: StyleProp<ViewStyle>;
}


/**
 * Props for the PumpSwapCard component
 * @interface PumpSwapCardProps
 */
export interface PumpSwapCardProps {
  /** Optional style override for the card container */
  containerStyle?: StyleProp<ViewStyle>;
  /** Child elements to render inside the card */
  children: React.ReactNode;
}

/**
 * Props for the PumpSwapSection component
 * @interface PumpSwapSectionProps
 */
export interface PumpSwapSectionProps extends BasePumpSwapProps {
  /** Custom label for the swap button (defaults to 'Swap Tokens') */
  swapButtonLabel?: string;
}

/**
 * Props for the LiquidityAddSection component
 * @interface LiquidityAddSectionProps
 */
export interface LiquidityAddSectionProps extends BasePumpSwapProps {
  /** Custom label for the add liquidity button (defaults to 'Add Liquidity') */
  addLiquidityButtonLabel?: string;
}

/**
 * Props for the LiquidityRemoveSection component
 * @interface LiquidityRemoveSectionProps
 */
export interface LiquidityRemoveSectionProps extends BasePumpSwapProps {
  /** Custom label for the remove liquidity button (defaults to 'Remove Liquidity') */
  removeLiquidityButtonLabel?: string;
}

/**
 * Props for the PoolCreationSection component
 * @interface PoolCreationSectionProps
 */
export interface PoolCreationSectionProps extends BasePumpSwapProps {
  /** Custom label for the create pool button (defaults to 'Create Pool') */
  createPoolButtonLabel?: string;
}

/**
 * Interface representing a token pair for identifying a pool
 * @interface TokenPair
 */
export interface TokenPair {
  /** The base token mint address */
  baseMint: string;
  /** The quote token mint address */
  quoteMint: string;
}


/**
 * Swap quote request parameters
 */
export interface SwapQuoteParams {
  pool: SDKPool; // Use aliased SDK type
  inputAmount: number;
  direction: SDKDirection; // Use aliased SDK type
  slippage?: number;
}

/**
 * Liquidity quote request parameters
 */
export interface LiquidityQuoteParams {
  pool: SDKPool; // Use aliased SDK type
  baseAmount?: number;
  quoteAmount?: number;
  slippage?: number;
}

/**
 * Liquidity quote response
 */
export interface LiquidityQuoteResult {
  base?: number;
  quote?: number;
  lpToken: number;
}


/**
 * Common parameters for transaction functions
 */
interface BaseTxParams {
   /** The user's public key */
   userPublicKey: PublicKey; // Use PublicKey type
   /** Solana Wallet object */
   solanaWallet: StandardWallet; // Use StandardWallet type
   /** Solana Connection object */
   connection: Connection;
   /** Optional callback for status updates */
   onStatusUpdate?: (status: string) => void;
   /** The slippage tolerance in percentage */
   slippage?: number; // Made optional as in quotes
}


/**
 * Parameters for the swap transaction
 * @interface SwapParams
 */
export interface SwapParams extends BaseTxParams {
  /** The pool address to swap in */
  pool: string; // Pool address string
  /** The amount to swap */
  amount: number;
  /** The direction of the swap */
  direction: SDKDirection; // Use aliased SDK type
}

/**
 * Parameters for adding liquidity transaction
 * @interface AddLiquidityParams
 */
export interface AddLiquidityParams extends BaseTxParams {
  /** The pool address to add liquidity to */
  pool: string; // Pool address string
  /** The base token amount (optional, provide one or LP amount) */
  baseAmount?: number | null; // Keep null possibility from original types.ts
  /** The quote token amount (optional, provide one or LP amount) */
  quoteAmount?: number | null; // Keep null possibility from original types.ts
  /** The desired LP token amount (alternative to base/quote) */
  lpTokenAmount?: number; // Added optional lpTokenAmount
}

/**
 * Parameters for removing liquidity transaction
 * @interface RemoveLiquidityParams
 */
export interface RemoveLiquidityParams extends BaseTxParams {
  /** The pool address to remove liquidity from */
  pool: string; // Pool address string
  /** The LP token amount to burn */
  lpTokenAmount: number;
}

/**
 * Parameters for creating a pool transaction
 * @interface CreatePoolParams
 */
export interface CreatePoolParams extends BaseTxParams {
  /** The index for the pool (specific to pump-swap?) */
  index: number;
  /** The base token mint */
  baseMint: string; // Mint address string
  /** The quote token mint */
  quoteMint: string; // Mint address string
  /** The initial base token amount */
  baseAmount: number;
  /** The initial quote token amount */
  quoteAmount: number;
}

/**
 * Context type defining the state and actions for the PumpSwap module
 * @interface PumpSwapContextType
 */
export interface PumpSwapContextType {
  /** Whether data is currently loading */
  isLoading: boolean;
  /** The Solana Connection object */
  connection: Connection | null;
  /** Array of available liquidity pools */
  pools: SDKPool[]; // Use aliased SDK type
  /** Function to perform a token swap */
  swap: (params: SwapParams) => Promise<string>;
  /** Function to add liquidity to a pool */
  addLiquidity: (params: AddLiquidityParams) => Promise<string>;
  /** Function to remove liquidity from a pool */
  removeLiquidity: (params: RemoveLiquidityParams) => Promise<string>;
  /** Function to create a new liquidity pool */
  createPool: (params: CreatePoolParams) => Promise<string>;
  /** Function to refresh the list of available pools */
  refreshPools: () => Promise<void>;
  /** Function to get a swap quote */
  getSwapQuote: (params: SwapQuoteParams) => Promise<number>;
  /** Function to get a liquidity add/remove quote */
  getLiquidityQuote: (params: LiquidityQuoteParams) => Promise<LiquidityQuoteResult>;
}


// Removed conflicting re-export and duplicate/redundant types