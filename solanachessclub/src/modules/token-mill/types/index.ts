import { Connection } from '@solana/web3.js';
import { StyleSheet } from 'react-native';
import BN from 'bn.js';

// Component props types
export interface BondingCurveCardProps {
  marketAddress: string;
  connection: Connection;
  publicKey: string;
  solanaWallet: any;
  setLoading: (val: boolean) => void;
  styleOverrides?: Partial<typeof StyleSheet.create>;
  onCurveChange?: (pricePoints: BN[], parameters: any) => void;
}

export interface BondingCurveConfiguratorProps {
  /** Callback function that receives updated price points */
  onCurveChange: (
    pricePoints: BN[], 
    parameters?: {
      curveType?: string;
      basePrice?: number;
      topPrice?: number;
      points?: number;
      feePercent?: number;
      power?: number;
    }
  ) => void;
  /** Optional style overrides to customize the UI */
  styleOverrides?: Partial<typeof StyleSheet.create>;
  /** Whether the configurator is disabled */
  disabled?: boolean;
}

export interface ExistingAddressesCardProps {
  marketAddress: string;
  setMarketAddress: (addr: string) => void;
  baseTokenMint: string;
  setBaseTokenMint: (mint: string) => void;
  vestingPlanAddress: string;
  setVestingPlanAddress: (addr: string) => void;
}

export interface FundMarketCardProps {
  marketAddress: string;
  connection: Connection;
  publicKey: string;
  solanaWallet: any;
  setLoading: (val: boolean) => void;
}

export interface FundUserCardProps {
  connection: Connection;
  publicKey: string;
  solanaWallet: any;
  setLoading: (val: boolean) => void;
}

export interface MarketCreationCardProps {
  connection: Connection;
  publicKey: string;
  solanaWallet: any;
  setLoading: (val: boolean) => void;
  onMarketCreated: (marketAddr: string, baseMint: string) => void;
}

export interface StakingCardProps {
  marketAddress: string;
  connection: Connection;
  publicKey: string;
  solanaWallet: any;
  setLoading: (val: boolean) => void;
}

export interface SwapCardProps {
  marketAddress: string;
  connection: Connection;
  publicKey: string;
  solanaWallet: any;
  setLoading: (val: boolean) => void;
}

export interface VestingCardProps {
  marketAddress: string;
  baseTokenMint: string;
  vestingPlanAddress: string;
  setVestingPlanAddress: (addr: string) => void;
  connection: Connection;
  publicKey: string;
  solanaWallet: any;
  setLoading: (val: boolean) => void;
}

// Service types
export type CurveType = 'linear' | 'power' | 'exponential' | 'logarithmic';
export type SwapType = 'buy' | 'sell';

export interface TokenMillServiceParams {
  connection: Connection;
  solanaWallet: any;
  onStatusUpdate?: (status: string) => void;
}

export interface FundUserWithWSOLParams extends TokenMillServiceParams {
  solAmount: number;
  signerPublicKey: string;
}

export interface CreateMarketParams extends TokenMillServiceParams {
  tokenName: string;
  tokenSymbol: string;
  metadataUri: string;
  totalSupply: number;
  creatorFee: number;
  stakingFee: number;
  userPublicKey: string;
}

export interface StakeTokensParams extends TokenMillServiceParams {
  marketAddress: string;
  amount: number;
  userPublicKey: string;
}

export interface CreateVestingParams extends TokenMillServiceParams {
  marketAddress: string;
  baseTokenMint: string;
  vestingAmount: number;
  userPublicKey: string;
}

export interface ReleaseVestingParams extends TokenMillServiceParams {
  marketAddress: string;
  vestingPlanAddress: string;
  baseTokenMint: string;
  userPublicKey: string;
}

export interface SwapTokensParams extends TokenMillServiceParams {
  marketAddress: string;
  swapType: SwapType;
  swapAmount: number;
  userPublicKey: string;
}

export interface FundMarketParams extends TokenMillServiceParams {
  marketAddress: string;
  userPublicKey: string;
}

export interface SetBondingCurveParams extends TokenMillServiceParams {
  marketAddress: string;
  askPrices: number[];
  bidPrices: number[];
  userPublicKey: string;
} 