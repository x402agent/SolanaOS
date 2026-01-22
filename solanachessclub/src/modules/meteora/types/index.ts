export interface MeteoraTrade {
  inputToken: string;
  outputToken: string;
  amount: string;
  slippage: number;
  minimumAmountOut?: string; // Minimum amount out for slippage protection
}

export interface LiquidityPosition {
  id: string;
  poolAddress: string;
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB: string;
  liquidityAmount: string;
  createdAt: number;
}

export interface MeteoraPool {
  address: string;
  name: string;
  tokenA: {
    symbol: string;
    address: string;
    logoURI?: string;
  };
  tokenB: {
    symbol: string;
    address: string;
    logoURI?: string;
  };
  liquidity: string;
  volume24h: string;
  fee: number;
}

// Enums matching the SDK
export enum TokenType {
  SPL = 0,
  Token2022 = 1
}

export enum FeeSchedulerMode {
  Linear = 0,
  Exponential = 1
}

export enum ActivationType {
  Slot = 0,
  Timestamp = 1
}

export enum CollectFeeMode {
  OnlyQuote = 0,
  Both = 1
}

export enum MigrationOption {
  MeteoraDamm = 0,
  DammV2 = 1
}

export enum MigrationFeeOption {
  FixedBps25 = 0,
  FixedBps30 = 1,
  FixedBps100 = 2,
  FixedBps200 = 3,
  FixedBps400 = 4,
  FixedBps600 = 5
}

// Bonding Curve Config Parameters
export interface CreateConfigParams {
  // Partner wallet info
  feeClaimer: string;
  leftoverReceiver: string;
  quoteMint: string;
  
  // Pool fees
  poolFees: {
    baseFee: {
      cliffFeeNumerator: string;
      numberOfPeriod: number;
      reductionFactor: string;
      periodFrequency: string;
      feeSchedulerMode: FeeSchedulerMode;
    };
    dynamicFee?: {
      binStep: number;
      binStepU128: string;
      filterPeriod: number;
      decayPeriod: number;
      reductionFactor: number;
      variableFeeControl: number;
      maxVolatilityAccumulator: number;
    };
  };
  
  // Configuration options
  activationType: ActivationType;
  collectFeeMode: CollectFeeMode;
  migrationOption: MigrationOption;
  tokenType: TokenType;
  tokenDecimal: number;
  migrationQuoteThreshold: string;
  
  // LP distribution percentages
  partnerLpPercentage: number;
  creatorLpPercentage: number;
  partnerLockedLpPercentage: number;
  creatorLockedLpPercentage: number;
  
  // Price and curve configuration
  sqrtStartPrice: string;
  
  // Locking and vesting settings
  lockedVesting: {
    amountPerPeriod: string;
    cliffDurationFromMigrationTime: string;
    frequency: string;
    numberOfPeriod: string;
    cliffUnlockAmount: string;
  };
  
  // Migration fee option
  migrationFeeOption: MigrationFeeOption;
  
  // Token supply settings
  tokenSupply?: {
    preMigrationTokenSupply: string;
    postMigrationTokenSupply: string;
  };
  
  // Creator fee percentage
  creatorTradingFeePercentage: number;
  
  // Curve points
  curve: {
    sqrtPrice: string;
    liquidity: string;
  }[];
}

// Market cap based curve building
export interface BuildCurveByMarketCapParams {
  totalTokenSupply: number;
  initialMarketCap: number;
  migrationMarketCap: number;
  migrationOption: MigrationOption;
  tokenBaseDecimal: number;
  tokenQuoteDecimal: number;
  
  // Same vesting settings as in CreateConfigParams
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
    feeSchedulerMode: FeeSchedulerMode;
  };
  
  baseFeeBps: number;
  dynamicFeeEnabled: boolean;
  activationType: ActivationType;
  collectFeeMode: CollectFeeMode;
  migrationFeeOption: MigrationFeeOption;
  tokenType: TokenType;
  
  // LP percentage distributions
  partnerLpPercentage: number;
  creatorLpPercentage: number;
  partnerLockedLpPercentage: number;
  creatorLockedLpPercentage: number;
  creatorTradingFeePercentage: number;
}

// Token creation parameters
export interface CreatePoolParams {
  quoteMint: string;
  baseMint: string;
  config: string;
  baseTokenType: TokenType;
  quoteTokenType: TokenType;
  name: string;
  symbol: string;
  uri: string;
}

// Create and buy tokens
export interface CreatePoolAndBuyParams {
  createPoolParam: CreatePoolParams;
  buyAmount: string;
  minimumAmountOut: string;
  referralTokenAccount?: string;
}

// Create pool metadata
export interface CreatePoolMetadataParams {
  virtualPool: string;
  name: string;
  website: string;
  logo: string;
} 