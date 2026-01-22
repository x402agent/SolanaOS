import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Platform,
  SectionList,
} from 'react-native';
import ActionDetailModal from './ActionDetailModal';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  formatSolAmount,
  formatTokenAmount,
  truncateAddress,
  getTimeAgo,
  extractAmountFromDescription,
  getTransactionTypeInfo,
} from '../../utils/profileActionsUtils';
import { Action, ActionsPageProps } from '../../types/index';
import { useAppDispatch } from '@/shared/hooks/useReduxHooks';
import { fetchWalletActionsWithCache } from '@/shared/state/profile/reducer';
import COLORS from '@/assets/colors';
import { styles } from './actions.style';
import { format, isToday, isThisWeek, isThisMonth, isAfter, startOfMonth, endOfMonth } from 'date-fns';


interface RawTokenAmount {
  tokenAmount: string;
  decimals: number;
}

interface TokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  fromTokenAccount: string;
  toTokenAccount: string;
  tokenAmount: number;
  mint: string;
  tokenName?: string;
  symbol?: string;
}

interface NativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number;
}

interface TokenDetail {
  userAccount: string;
  tokenAccount: string;
  mint: string;
  rawTokenAmount: RawTokenAmount;
}

interface SwapEvent {
  tokenInputs?: TokenDetail[];
  tokenOutputs?: TokenDetail[];
  tokenFees?: TokenDetail[];
  nativeInput?: { account: string; amount: string | number };
  nativeOutput?: { account: string; amount: string | number };
  nativeFees?: Array<{ account: string; amount: string | number }>;
  innerSwaps?: any[];
}

interface TransactionEvents {
  nft?: any;
  swap?: SwapEvent;
  compressed?: any;
  distributeCompressionRewards?: { amount: number };
  setAuthority?: any;
}

// Extend the Action interface to include blockTime and timeAgo properties
interface ExtendedAction extends Action {
  blockTime?: number;
  timeAgo?: string;
}

/**
 * Parse transaction details to get direction and amount
 */
function getTransactionDetails(
  action: Action,
  walletAddress?: string,
): {
  direction: 'in' | 'out' | 'neutral';
  amount: number;
  symbol: string;
  counterparty?: string;
  rawData?: any;
} {
  if (!walletAddress) {
    return { direction: 'neutral', amount: 0, symbol: 'SOL' };
  }

  // First try to extract from description
  const descriptionAmount = extractAmountFromDescription(action.description);

  // For native transfers (SOL)
  if (action.nativeTransfers && action.nativeTransfers.length > 0) {
    const transfer = action.nativeTransfers[0];

    // Debug the native transfer amount
    console.log('Native transfer amount:', transfer.amount, 'lamports');

    if (transfer.fromUserAccount === walletAddress) {
      return {
        direction: 'out',
        amount: transfer.amount,
        symbol: 'SOL',
        counterparty: truncateAddress(transfer.toUserAccount),
        rawData: transfer,
      };
    }

    if (transfer.toUserAccount === walletAddress) {
      return {
        direction: 'in',
        amount: transfer.amount,
        symbol: 'SOL',
        counterparty: truncateAddress(transfer.fromUserAccount),
        rawData: transfer,
      };
    }

    // If this wallet is not directly involved but we have a description amount
    if (descriptionAmount && descriptionAmount.symbol.toUpperCase() === 'SOL') {
      return {
        direction: transfer.fromUserAccount === action.feePayer ? 'out' : 'in',
        amount: descriptionAmount.amount * 1_000_000_000, // Convert to lamports
        symbol: 'SOL',
        counterparty: truncateAddress(
          transfer.fromUserAccount === action.feePayer
            ? transfer.toUserAccount
            : transfer.fromUserAccount,
        ),
        rawData: transfer,
      };
    }

    // For any wallet, just show the transfer - make sure we use the amount directly
    return {
      direction: 'neutral',
      amount: transfer.amount,
      symbol: 'SOL',
      counterparty: `${truncateAddress(
        transfer.fromUserAccount,
      )} → ${truncateAddress(transfer.toUserAccount)}`,
      rawData: transfer,
    };
  }

  // For token transfers
  if (action.tokenTransfers && action.tokenTransfers.length > 0) {
    const transfer = action.tokenTransfers[0];
    const symbol = transfer.symbol || truncateAddress(transfer.mint);

    if (transfer.fromUserAccount === walletAddress) {
      return {
        direction: 'out',
        amount: transfer.tokenAmount,
        symbol,
        counterparty: truncateAddress(transfer.toUserAccount),
        rawData: transfer,
      };
    }

    if (transfer.toUserAccount === walletAddress) {
      return {
        direction: 'in',
        amount: transfer.tokenAmount,
        symbol,
        counterparty: truncateAddress(transfer.fromUserAccount),
        rawData: transfer,
      };
    }

    // For any wallet, just show the transfer
    return {
      direction: 'neutral',
      amount: transfer.tokenAmount,
      symbol,
      counterparty: `${truncateAddress(
        transfer.fromUserAccount,
      )} → ${truncateAddress(transfer.toUserAccount)}`,
      rawData: transfer,
    };
  }

  // Check account data changes for balance changes
  if (action.accountData && action.accountData.length > 0) {
    const walletData = action.accountData.find(
      data => data.account === walletAddress,
    );
    if (walletData) {
      if (walletData.nativeBalanceChange && walletData.nativeBalanceChange > 0) {
        return {
          direction: 'in',
          amount: walletData.nativeBalanceChange,
          symbol: 'SOL',
          rawData: walletData,
        };
      }

      if (walletData.nativeBalanceChange && walletData.nativeBalanceChange < 0) {
        // Exclude fee payments as direction indicator
        if (
          action.fee !== undefined &&
          walletData.nativeBalanceChange === -action.fee
        ) {
          return { direction: 'neutral', amount: 0, symbol: 'SOL' };
        }

        return {
          direction: 'out',
          amount: Math.abs(walletData.nativeBalanceChange),
          symbol: 'SOL',
          rawData: walletData,
        };
      }
    }

    // If this wallet isn't in accountData but we have a description amount
    if (descriptionAmount && descriptionAmount.symbol.toUpperCase() === 'SOL') {
      const isOutgoing = action.feePayer === walletAddress;

      return {
        direction: isOutgoing ? 'out' : 'in',
        amount: descriptionAmount.amount * 1_000_000_000, // Convert to lamports
        symbol: 'SOL',
      };
    }
  }

  // For swap events
  if (action.events?.swap) {
    const swap = action.events.swap;

    // Check for SOL involved in swap
    if (swap.nativeInput && swap.nativeInput.account === walletAddress) {
      const amount =
        typeof swap.nativeInput.amount === 'string'
          ? parseInt(swap.nativeInput.amount, 10)
          : swap.nativeInput.amount;

      const outputSymbol =
        swap.tokenOutputs && swap.tokenOutputs.length > 0
          ? swap.tokenOutputs[0].rawTokenAmount.tokenAmount
            ? `${formatTokenAmount(
              parseFloat(swap.tokenOutputs[0].rawTokenAmount.tokenAmount),
              parseInt(
                String(swap.tokenOutputs[0].rawTokenAmount.decimals),
                10,
              ),
            )} ${truncateAddress(swap.tokenOutputs[0].mint)}`
            : truncateAddress(swap.tokenOutputs[0].mint)
          : 'tokens';

      return {
        direction: 'out',
        amount,
        symbol: 'SOL',
        counterparty: outputSymbol,
        rawData: swap,
      };
    }

    if (swap.nativeOutput && swap.nativeOutput.account === walletAddress) {
      const amount =
        typeof swap.nativeOutput.amount === 'string'
          ? parseInt(swap.nativeOutput.amount, 10)
          : swap.nativeOutput.amount;

      const inputSymbol =
        swap.tokenInputs && swap.tokenInputs.length > 0
          ? swap.tokenInputs[0].rawTokenAmount.tokenAmount
            ? `${formatTokenAmount(
              parseFloat(swap.tokenInputs[0].rawTokenAmount.tokenAmount),
              parseInt(
                String(swap.tokenInputs[0].rawTokenAmount.decimals),
                10,
              ),
            )} ${truncateAddress(swap.tokenInputs[0].mint)}`
            : truncateAddress(swap.tokenInputs[0].mint)
          : 'tokens';

      return {
        direction: 'in',
        amount,
        symbol: 'SOL',
        counterparty: inputSymbol,
        rawData: swap,
      };
    }

    // Check for tokens involved in swap
    if (swap.tokenInputs && swap.tokenInputs.length > 0) {
      const input = swap.tokenInputs[0];
      if (input.userAccount === walletAddress) {
        const outputSymbol =
          swap.tokenOutputs && swap.tokenOutputs.length > 0
            ? swap.tokenOutputs[0].rawTokenAmount.tokenAmount
              ? `${formatTokenAmount(
                parseFloat(swap.tokenOutputs[0].rawTokenAmount.tokenAmount),
                parseInt(
                  String(swap.tokenOutputs[0].rawTokenAmount.decimals),
                  10,
                ),
              )} ${truncateAddress(swap.tokenOutputs[0].mint)}`
              : truncateAddress(swap.tokenOutputs[0].mint)
            : 'tokens';

        return {
          direction: 'out',
          amount: parseFloat(input.rawTokenAmount.tokenAmount),
          symbol: truncateAddress(input.mint),
          counterparty: outputSymbol,
          rawData: {
            input,
            decimals: parseInt(String(input.rawTokenAmount.decimals), 10),
          },
        };
      }
    }

    if (swap.tokenOutputs && swap.tokenOutputs.length > 0) {
      const output = swap.tokenOutputs[0];
      if (output.userAccount === walletAddress) {
        const inputSymbol =
          swap.tokenInputs && swap.tokenInputs.length > 0
            ? swap.tokenInputs[0].rawTokenAmount.tokenAmount
              ? `${formatTokenAmount(
                parseFloat(swap.tokenInputs[0].rawTokenAmount.tokenAmount),
                parseInt(
                  String(swap.tokenInputs[0].rawTokenAmount.decimals),
                  10,
                ),
              )} ${truncateAddress(swap.tokenInputs[0].mint)}`
              : truncateAddress(swap.tokenInputs[0].mint)
            : 'tokens';

        return {
          direction: 'in',
          amount: parseFloat(output.rawTokenAmount.tokenAmount),
          symbol: truncateAddress(output.mint),
          counterparty: inputSymbol,
          rawData: {
            output,
            decimals: parseInt(String(output.rawTokenAmount.decimals), 10),
          },
        };
      }
    }

    // If we have a swap but couldn't determine direction
    if (descriptionAmount) {
      return {
        direction: 'neutral',
        amount: descriptionAmount.amount,
        symbol: descriptionAmount.symbol,
        rawData: swap,
      };
    }

    return { direction: 'neutral', amount: 0, symbol: 'SWAP', rawData: swap };
  }

  // Try to extract from description as last resort
  if (descriptionAmount) {
    return {
      direction: 'neutral',
      amount:
        descriptionAmount.symbol.toUpperCase() === 'SOL'
          ? descriptionAmount.amount * 1_000_000_000 // Convert to lamports
          : descriptionAmount.amount,
      symbol: descriptionAmount.symbol,
    };
  }

  // Default case
  return { direction: 'neutral', amount: 0, symbol: 'SOL' };
}

/**
 * Get a simple description for the transaction
 */
function getSimpleDescription(action: Action): string {
  // Check for enriched data first
  if (action.enrichedData) {
    const { direction, counterparty } = action.enrichedData;

    // For swap transactions
    if (action.enrichedType === 'SWAP') {
      const { swapType, inputSymbol, outputSymbol } = action.enrichedData;

      if (swapType === 'TOKEN_TO_TOKEN') {
        return `Swapped ${inputSymbol} → ${outputSymbol}`;
      } else if (swapType === 'SOL_TO_TOKEN') {
        return `Swapped SOL → ${outputSymbol}`;
      } else if (swapType === 'TOKEN_TO_SOL') {
        return `Swapped ${inputSymbol} → SOL`;
      }

      return 'Token Swap';
    }

    // For transfer transactions
    if (
      action.enrichedType === 'TRANSFER' ||
      action.enrichedType === 'TOKEN_TRANSFER'
    ) {
      if (direction === 'IN') {
        return counterparty ? `Received from ${counterparty}` : 'Received';
      }

      if (direction === 'OUT') {
        return counterparty ? `Sent to ${counterparty}` : 'Sent';
      }
    }
  }

  // Fall back to previous logic if enriched data not available
  if (action.description) {
    const desc = action.description.toLowerCase();
    if (desc.includes('transfer')) return 'Transfer';
    if (desc.includes('swap')) return 'Swap';
    if (desc.includes('buy')) return 'Buy';
    if (desc.includes('sell')) return 'Sell';
    if (desc.includes('stake')) return 'Stake';
  }

  return 'Transaction';
}

/**
 * Format amount to display with proper units
 */
function displayAmount(action: Action): {
  amount: string;
  symbol: string;
  color: string;
} {
  // Default values
  let amount = '0';
  let symbol = 'SOL';
  let color = COLORS.white; // Neutral color

  // Check for enriched data
  if (action.enrichedData) {
    const { direction } = action.enrichedData;

    // Set color based on direction
    color =
      direction === 'IN' ? COLORS.brandPrimary : direction === 'OUT' ? COLORS.errorRed : COLORS.white;

    // For swap transactions
    if (action.enrichedType === 'SWAP') {
      const { swapType, inputAmount, outputAmount, inputSymbol, outputSymbol } =
        action.enrichedData;

      // Display relevant amount based on direction (what user gained or lost)
      if (direction === 'IN') {
        amount = outputAmount ? outputAmount.toFixed(4) : '?';
        symbol = outputSymbol || 'tokens';
      } else {
        amount = inputAmount ? inputAmount.toFixed(4) : '?';
        symbol = inputSymbol || 'tokens';
      }
    }

    // For transfer transactions
    else if (
      action.enrichedType === 'TRANSFER' ||
      action.enrichedType === 'TOKEN_TRANSFER'
    ) {
      const {
        transferType,
        amount: txAmount,
        tokenSymbol,
        decimals,
      } = action.enrichedData;

      if (transferType === 'SOL') {
        // Format SOL amount
        amount = txAmount ? txAmount.toFixed(4) : '?';
        symbol = 'SOL';
      } else {
        // Format token amount
        amount = txAmount ? txAmount.toString() : '?';
        symbol = tokenSymbol || 'tokens';
      }
    }
  }
  // Fall back to previous logic if enriched data not available
  else if (action.nativeTransfers && action.nativeTransfers.length > 0) {
    const transfer = action.nativeTransfers[0];
    amount = formatSolAmount(transfer.amount);
    symbol = 'SOL';
  } else if (action.tokenTransfers && action.tokenTransfers.length > 0) {
    const transfer = action.tokenTransfers[0];
    amount = transfer.tokenAmount.toString();
    symbol = transfer.symbol || truncateAddress(transfer.mint);
  }

  return { amount, symbol, color };
}

const ActionItem: React.FC<{
  action: Action;
  onPress: () => void;
  walletAddress?: string;
}> = ({ action, onPress, walletAddress }) => {
  // Get transaction type and icon
  const type =
    action.enrichedType ||
    action.type ||
    action.transactionType ||
    'TRANSACTION';
  const { icon, color } = getTransactionTypeInfo(type);

  // Get simplified description
  const description = getSimpleDescription(action);

  // Get formatted amount
  const { amount, symbol, color: amountColor } = displayAmount(action);

  // Time ago
  const timeAgo = action.timestamp ? getTimeAgo(action.timestamp) : '';

  // Direction prefix
  const direction = action.enrichedData?.direction;
  const directionPrefix =
    direction === 'IN' ? '+ ' : direction === 'OUT' ? '- ' : '';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.card}>
      <View style={styles.cardContent}>
        {/* Left - Icon */}
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <FontAwesome5 name={icon} size={16} color={color} />
        </View>

        {/* Middle - Transaction Info */}
        <View style={styles.txInfo}>
          <Text style={styles.description}>{description}</Text>
          <Text style={styles.timeAgo}>{timeAgo}</Text>
        </View>

        {/* Right - Amount */}
        <View style={styles.amountContainer}>
          <Text style={[styles.amount, { color: amountColor }]}>
            {directionPrefix}
            {amount}
          </Text>
          <Text style={styles.symbol}>{symbol}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const ActionsPage: React.FC<ActionsPageProps> = ({
  myActions,
  loadingActions,
  fetchActionsError,
  walletAddress,
}) => {
  const dispatch = useAppDispatch();
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false);

  // Timeout for new wallets to prevent excessive retries
  useEffect(() => {
    if (loadingActions && !isRefreshing && !hasAttemptedLoad) {
      // If we're loading, set a timeout to mark as attempted after 5 seconds
      const timer = setTimeout(() => {
        setHasAttemptedLoad(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [loadingActions, isRefreshing, hasAttemptedLoad]);

  // Mark initial load as complete when actions are loaded or failed
  useEffect(() => {
    if (!loadingActions && !hasCompletedInitialLoad) {
      setHasCompletedInitialLoad(true);
      setHasAttemptedLoad(true);
    }
  }, [loadingActions, hasCompletedInitialLoad]);

  // Prevent additional fetches for new wallets
  useEffect(() => {
    if (hasCompletedInitialLoad && !myActions?.length && !fetchActionsError) {
      // If we've completed an initial load with no actions and no error,
      // consider this a new wallet with no transactions
      setHasAttemptedLoad(true);
    }
  }, [hasCompletedInitialLoad, myActions, fetchActionsError]);

  const handleRefresh = useCallback(async () => {
    if (!walletAddress) return;

    // Set refreshing state
    setIsRefreshing(true);

    try {
      // Explicitly dispatch with forceRefresh to bypass cache
      await dispatch(fetchWalletActionsWithCache({
        walletAddress,
        forceRefresh: true
      })).unwrap();

      // Reset attempted load flags to handle the case where a new wallet gets its first transaction
      setHasAttemptedLoad(true);
      setHasCompletedInitialLoad(true);

      console.log("Actions refreshed successfully");
    } catch (err) {
      console.error('Error refreshing actions:', err);
    } finally {
      // Ensure we always clear the refreshing state
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500); // Small timeout to ensure UI feedback
    }
  }, [walletAddress, dispatch]);

  // If still initial loading and not having attempted to load yet, show loading
  if (loadingActions && !hasAttemptedLoad && !hasCompletedInitialLoad) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.brandBlue} />
        <Text style={styles.emptyText}>Loading transactions...</Text>
      </View>
    );
  }

  if (fetchActionsError) {
    return (
      <View style={styles.centered}>
        <FontAwesome5 name="exclamation-circle" size={32} color={COLORS.errorRed} />
        <Text style={styles.errorText}>{fetchActionsError}</Text>
        <TouchableOpacity
          style={[
            styles.retryButton,
            isRefreshing && { opacity: 0.7 }
          ]}
          onPress={handleRefresh}
          disabled={isRefreshing}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            {isRefreshing ? (
              <>
                <ActivityIndicator size="small" color={COLORS.white} />
                <Text style={[styles.retryButtonText, { marginLeft: 8 }]}>Retrying...</Text>
              </>
            ) : (
              <>
                <FontAwesome5 name="redo" size={14} color={COLORS.white} />
                <Text style={[styles.retryButtonText, { marginLeft: 8 }]}>Retry</Text>
              </>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  if (!myActions || myActions.length === 0) {
    return (
      <View style={styles.centered}>
        <View style={styles.emptyStateIcon}>
          <FontAwesome5 name="history" size={26} color={COLORS.white} />
        </View>
        <Text style={styles.emptyText}>No transactions yet</Text>
        <Text style={[styles.emptyText, { fontSize: 14, marginTop: 8, opacity: 0.7, maxWidth: '80%', textAlign: 'center' }]}>
          Make your first transaction on Solana to see it here
        </Text>

        {/* <TouchableOpacity
          style={[
            styles.refreshButton,
            isRefreshing && { opacity: 0.7 }
          ]}
          onPress={handleRefresh}
          disabled={isRefreshing}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            {isRefreshing ? (
              <>
                <ActivityIndicator size="small" color={COLORS.white} />
                <Text style={[styles.refreshButtonText, { marginLeft: 8 }]}>Refreshing...</Text>
              </>
            ) : (
              <>
                <FontAwesome5 name="sync" size={14} color={COLORS.white} />
                <Text style={[styles.refreshButtonText, { marginLeft: 8 }]}>Refresh</Text>
              </>
            )}
          </View>
        </TouchableOpacity> */}
      </View>
    );
  }

  // Group actions by date periods
  const groupedActions = useMemo(() => {
    if (!myActions || myActions.length === 0) return [];

    // Create date groups
    const today: Action[] = [];
    const thisWeek: Action[] = [];
    const thisMonth: Action[] = [];
    const previousMonths: { [key: string]: Action[] } = {};

    // Sort actions by timestamp (newest first)
    const sortedActions = [...myActions].sort((a, b) => {
      // Extract timestamps - handle different possible formats
      let timestampA: number;
      let timestampB: number;

      // The timestamp might be a string date, unix timestamp, or already a Date object
      if (a.timestamp) {
        if (typeof a.timestamp === 'string') {
          // Try to parse as a date string
          timestampA = new Date(a.timestamp).getTime();
          // If invalid date, try as a unix timestamp (seconds)
          if (isNaN(timestampA)) {
            timestampA = parseFloat(a.timestamp) * 1000;
          }
        } else if (typeof a.timestamp === 'number') {
          // If it's already a number, ensure it's in milliseconds
          timestampA = a.timestamp < 10000000000 ? a.timestamp * 1000 : a.timestamp;
        } else {
          timestampA = 0;
        }
      } else if ((a as ExtendedAction).blockTime) {
        // Fallback to blockTime if available (usually unix timestamp in seconds)
        timestampA = (a as ExtendedAction).blockTime! * 1000;
      } else {
        timestampA = 0;
      }

      if (b.timestamp) {
        if (typeof b.timestamp === 'string') {
          timestampB = new Date(b.timestamp).getTime();
          if (isNaN(timestampB)) {
            timestampB = parseFloat(b.timestamp) * 1000;
          }
        } else if (typeof b.timestamp === 'number') {
          timestampB = b.timestamp < 10000000000 ? b.timestamp * 1000 : b.timestamp;
        } else {
          timestampB = 0;
        }
      } else if ((b as ExtendedAction).blockTime) {
        timestampB = (b as ExtendedAction).blockTime! * 1000;
      } else {
        timestampB = 0;
      }

      return timestampB - timestampA;
    });

    // Helper function to extract date from action
    const getActionDate = (action: Action): Date => {
      let timestamp: number;

      if (action.timestamp) {
        if (typeof action.timestamp === 'string') {
          timestamp = new Date(action.timestamp).getTime();
          if (isNaN(timestamp)) {
            timestamp = parseFloat(action.timestamp) * 1000;
          }
        } else if (typeof action.timestamp === 'number') {
          timestamp = action.timestamp < 10000000000 ? action.timestamp * 1000 : action.timestamp;
        } else {
          timestamp = 0;
        }
      } else if ((action as ExtendedAction).blockTime) {
        timestamp = (action as ExtendedAction).blockTime! * 1000;
      } else {
        // Fallback - use current time minus the relative time from timeAgo if possible
        const timeAgoText = (action as ExtendedAction).timeAgo || getTimeAgo(0); // use function for consistency
        if (timeAgoText.includes('days ago')) {
          const days = parseInt(timeAgoText.split(' ')[0]);
          timestamp = Date.now() - (days * 24 * 60 * 60 * 1000);
        } else if (timeAgoText.includes('hours ago')) {
          const hours = parseInt(timeAgoText.split(' ')[0]);
          timestamp = Date.now() - (hours * 60 * 60 * 1000);
        } else if (timeAgoText.includes('minutes ago')) {
          const minutes = parseInt(timeAgoText.split(' ')[0]);
          timestamp = Date.now() - (minutes * 60 * 1000);
        } else {
          timestamp = Date.now();
        }
      }

      return new Date(timestamp);
    };

    // Function to check if date is today
    const isDateToday = (date: Date): boolean => {
      const today = new Date();
      return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
    };

    // Function to check if date is within this week
    const isDateThisWeek = (date: Date): boolean => {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      startOfWeek.setHours(0, 0, 0, 0);

      return date >= startOfWeek && !isDateToday(date);
    };

    // Function to check if date is within this month
    const isDateThisMonth = (date: Date): boolean => {
      const now = new Date();
      return date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear() &&
        !isDateToday(date) &&
        !isDateThisWeek(date);
    };

    // Group actions by date periods
    sortedActions.forEach(action => {
      const actionDate = getActionDate(action);

      if (isDateToday(actionDate)) {
        today.push(action);
      } else if (isDateThisWeek(actionDate)) {
        thisWeek.push(action);
      } else if (isDateThisMonth(actionDate)) {
        thisMonth.push(action);
      } else {
        // Group by month name
        const monthYear = format(actionDate, 'MMMM yyyy');
        if (!previousMonths[monthYear]) {
          previousMonths[monthYear] = [];
        }
        previousMonths[monthYear].push(action);
      }
    });

    // Convert to sections for SectionList
    const sections = [];

    if (today.length > 0) {
      sections.push({ title: 'Today', data: today });
    }

    if (thisWeek.length > 0) {
      sections.push({ title: 'This Week', data: thisWeek });
    }

    if (thisMonth.length > 0) {
      sections.push({ title: 'This Month', data: thisMonth });
    }

    // Add previous months in chronological order (newest first)
    const monthKeys = Object.keys(previousMonths).sort((a, b) => {
      const [monthA, yearA] = a.split(' ');
      const [monthB, yearB] = b.split(' ');
      const dateA = new Date(`${monthA} 1, ${yearA}`);
      const dateB = new Date(`${monthB} 1, ${yearB}`);
      return dateB.getTime() - dateA.getTime();
    });

    monthKeys.forEach(month => {
      if (previousMonths[month].length > 0) {
        sections.push({ title: month, data: previousMonths[month] });
      }
    });

    return sections;
  }, [myActions]);

  return (
    <View style={styles.container}>
      <SectionList
        sections={groupedActions}
        keyExtractor={(item, index) => item.signature || `action-${index}`}
        renderItem={({ item }) => (
          <ActionItem
            action={item}
            onPress={() => setSelectedAction(item)}
            walletAddress={walletAddress}
          />
        )}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        stickySectionHeadersEnabled={false}
      />

      <ActionDetailModal
        visible={selectedAction !== null}
        action={selectedAction}
        onClose={() => setSelectedAction(null)}
        walletAddress={walletAddress}
      />
    </View>
  );
};

export default ActionsPage;
