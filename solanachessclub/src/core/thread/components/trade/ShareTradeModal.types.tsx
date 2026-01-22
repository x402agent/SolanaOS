import { TokenInfo } from '@/modules/data-module/types/tokenTypes';
import { SwapTransaction } from '@/modules/data-module/services/swapTransactions';
import { ThreadUser } from '../thread.types';

/**
 * Ref handle for the ShareTradeModal component
 * @interface ShareTradeModalRef
 */
export interface ShareTradeModalRef {
  forceRefresh: () => void;
}

/**
 * Available tab options in the TradeModal
 * @type {'PAST_SWAPS'}
 */
export type TabOption = 'PAST_SWAPS';

/**
 * Screen states for the modal flow
 * @type {'SWAP_SELECTION' | 'MESSAGE_INPUT'}
 */
export type ModalScreen = 'SWAP_SELECTION' | 'MESSAGE_INPUT';

// Birdeye API response types
export interface BirdeyeSwapToken {
  symbol: string;
  address: string;
  decimals: number;
  price: number;
  amount: string;
  ui_amount: number;
  ui_change_amount: number;
  type_swap: 'from' | 'to';
}

export interface BirdeyeSwapTransaction {
  base: BirdeyeSwapToken;
  quote: BirdeyeSwapToken;
  tx_type: string;
  tx_hash: string;
  ins_index: number;
  inner_ins_index: number;
  block_unix_time: number;
  block_number: number;
  volume_usd: number;
  volume: number;
  pool_id: string;
  owner: string;
  source: string;
  interacted_program_id: string;
}

export interface BirdeyeSwapResponse {
  data: {
    items: BirdeyeSwapTransaction[];
  };
}

// Extend the SwapTransaction type to include uniqueId
export interface EnhancedSwapTransaction extends SwapTransaction {
  uniqueId?: string;
  volumeUsd?: number;
  isMultiHop?: boolean;
  hopCount?: number;
  childTransactions?: EnhancedSwapTransaction[];
}

export interface UpdatedTradeModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback fired when the modal is closed */
  onClose: () => void;
  /** Current user information */
  currentUser: ThreadUser;
  /** Generic callback fired when a trade is ready to be shared */
  onShare: (data: TradeData) => void;
  /** Initial input token for the trade */
  initialInputToken?: Partial<TokenInfo>;
  /** Initial output token for the trade */
  initialOutputToken?: Partial<TokenInfo>;
  /** Whether to disable tab switching */
  disableTabs?: boolean;
  /** Initial active tab to show */
  initialActiveTab?: TabOption;
}

// Define TradeData here as it's used in UpdatedTradeModalProps
// This was previously defined in thread.types.ts but seems more specific to this modal's onShare
export interface TradeData {
  inputMint: string;
  outputMint: string;
  aggregator?: string;
  inputSymbol: string;
  inputQuantity: string;
  inputUsdValue: string;
  outputSymbol: string;
  inputAmountLamports: string;
  outputAmountLamports: string;
  outputQuantity: string;
  outputUsdValue: string;
  executionTimestamp: number;
  message?: string; // Added message field here
} 