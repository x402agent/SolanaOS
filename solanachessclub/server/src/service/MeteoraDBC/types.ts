import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

// Enums to help make code more readable
export enum TokenType {
  SPL = 0,
  Token2022 = 1
}

export enum FeeSchedulerMode {
  Linear = 0,
  Exponential = 1
}

export enum CollectFeeMode {
  OnlyQuote = 0,
  Both = 1
}

export enum ActivationType {
  Slot = 0,
  Timestamp = 1
}

export enum MigrationOption {
  DAMMV1 = 0,
  DAMMV2 = 1
}

export enum MigrationFeeOption {
  FixedBps25 = 0,
  FixedBps30 = 1,
  FixedBps100 = 2,
  FixedBps200 = 3,
  FixedBps400 = 4,
  FixedBps600 = 5
}

// Interface for create config parameters
export interface CreateConfigParam {
  payer: string;
  config: string;
  feeClaimer: string;
  leftoverReceiver: string;
  quoteMint: string;
  poolFees: {
    baseFee: {
      cliffFeeNumerator: string;
      numberOfPeriod: number;
      reductionFactor: string;
      periodFrequency: string;
      feeSchedulerMode: number;
    };
    dynamicFee: {
      binStep: number;
      binStepU128: string;
      filterPeriod: number;
      decayPeriod: number;
      reductionFactor: number;
      variableFeeControl: number;
      maxVolatilityAccumulator: number;
    } | null;
  };
  activationType: number;
  collectFeeMode: number;
  migrationOption: number;
  tokenType: number;
  tokenDecimal: number;
  migrationQuoteThreshold: string;
  partnerLpPercentage: number;
  creatorLpPercentage: number;
  partnerLockedLpPercentage: number;
  creatorLockedLpPercentage: number;
  sqrtStartPrice: string;
  lockedVesting: {
    amountPerPeriod: string;
    cliffDurationFromMigrationTime: string;
    frequency: string;
    numberOfPeriod: string;
    cliffUnlockAmount: string;
  };
  migrationFeeOption: number;
  tokenSupply: {
    preMigrationTokenSupply: string;
    postMigrationTokenSupply: string;
  } | null;
  creatorTradingFeePercentage: number;
  curve: {
    sqrtPrice: string;
    liquidity: string;
  }[];
}

// Interface for build curve and create config parameters
export interface BuildCurveAndCreateConfigParam {
  buildCurveParam: {
    totalTokenSupply: number;
    percentageSupplyOnMigration: number;
    migrationQuoteThreshold: number;
    migrationOption: number;
    tokenBaseDecimal: number;
    tokenQuoteDecimal: number;
    lockedVesting: {
      amountPerPeriod: string;
      cliffDurationFromMigrationTime: string;
      frequency: string;
      numberOfPeriod: string;
      cliffUnlockAmount: string;
    };
    feeSchedulerParam: {
      numberOfPeriod: number;
      reductionFactor: number;
      periodFrequency: number;
      feeSchedulerMode: number;
    };
    baseFeeBps: number;
    dynamicFeeEnabled: boolean;
    activationType: number;
    collectFeeMode: number;
    migrationFeeOption: number;
    tokenType: number;
    partnerLpPercentage: number;
    creatorLpPercentage: number;
    partnerLockedLpPercentage: number;
    creatorLockedLpPercentage: number;
    creatorTradingFeePercentage: number;
  };
  feeClaimer: string;
  leftoverReceiver: string;
  payer: string;
  quoteMint: string;
  config: string;
}

// Interface for build curve by market cap parameters
export interface BuildCurveAndCreateConfigByMarketCapParam {
  buildCurveByMarketCapParam: {
    totalTokenSupply: number;
    initialMarketCap: number;
    migrationMarketCap: number;
    migrationOption: number;
    tokenBaseDecimal: number;
    tokenQuoteDecimal: number;
    lockedVesting: {
      amountPerPeriod: string;
      cliffDurationFromMigrationTime: string;
      frequency: string;
      numberOfPeriod: string;
      cliffUnlockAmount: string;
    };
    feeSchedulerParam: {
      numberOfPeriod: number;
      reductionFactor: number;
      periodFrequency: number;
      feeSchedulerMode: number;
    };
    baseFeeBps: number;
    dynamicFeeEnabled: boolean;
    activationType: number;
    collectFeeMode: number;
    migrationFeeOption: number;
    tokenType: number;
    partnerLpPercentage: number;
    creatorLpPercentage: number;
    partnerLockedLpPercentage: number;
    creatorLockedLpPercentage: number;
    creatorTradingFeePercentage: number;
  };
  feeClaimer: string;
  leftoverReceiver: string;
  payer: string;
  quoteMint: string;
  config: string;
}

// Interface for create partner metadata parameters
export interface CreatePartnerMetadataParam {
  name: string;
  website: string;
  logo: string;
  feeClaimer: string;
  payer: string;
}

// Interface for claim trading fee parameters
export interface ClaimTradingFeeParam {
  pool: string;
  feeClaimer: string;
  maxBaseAmount: string;
  maxQuoteAmount: string;
}

// Interface for withdraw surplus parameters
export interface WithdrawSurplusParam {
  feeClaimer: string;
  virtualPool: string;
}

// Interface for create pool parameters
export interface CreatePoolParam {
  quoteMint: string;
  baseMint?: string;
  config: string;
  baseTokenType: number;
  quoteTokenType: number;
  name: string;
  symbol: string;
  uri: string;
  payer: string;
  poolCreator: string;
}

// Interface for create pool and buy parameters
export interface CreatePoolAndBuyParam {
  createPoolParam: CreatePoolParam;
  buyAmount: string;
  minimumAmountOut: string;
  referralTokenAccount: string | null;
}

// Interface for swap parameters
export interface SwapParam {
  owner: string;
  amountIn: string;
  minimumAmountOut: string;
  swapBaseForQuote: boolean;
  pool: string;
  referralTokenAccount: string | null;
}

// Interface for migration parameters
export interface CreateLockerParam {
  payer: string;
  virtualPool: string;
}

export interface WithdrawLeftoverParam {
  payer: string;
  virtualPool: string;
}

export interface CreateDammV1MigrationMetadataParam {
  payer: string;
  virtualPool: string;
  config: string;
}

export interface MigrateToDammV1Param {
  payer: string;
  virtualPool: string;
  dammConfig: string;
}

export interface DammLpTokenParam {
  payer: string;
  virtualPool: string;
  dammConfig: string;
  isPartner: boolean;
}

export interface CreateDammV2MigrationMetadataParam {
  payer: string;
  virtualPool: string;
  config: string;
}

export interface MigrateToDammV2Param {
  payer: string;
  virtualPool: string;
  dammConfig: string;
}

// Interface for pool metadata parameters
export interface CreatePoolMetadataParam {
  virtualPool: string;
  name: string;
  website: string;
  logo: string;
  creator: string;
  payer: string;
}

export interface ClaimCreatorTradingFeeParam {
  creator: string;
  pool: string;
  maxBaseAmount: string;
  maxQuoteAmount: string;
}

export interface CreatorWithdrawSurplusParam {
  creator: string;
  virtualPool: string;
}

/**
 * API Response interface
 */
export interface ApiResponse {
  success: boolean;
  error?: string;
  transaction?: string;
  baseMintAddress?: string;
  poolAddress?: string;
  configAddress?: string;
  pool?: any;
  config?: any;
  progress?: number;
  metrics?: any;
  [key: string]: any; // Allow additional properties for backward compatibility
} 