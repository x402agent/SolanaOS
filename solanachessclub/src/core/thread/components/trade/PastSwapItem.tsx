import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { format } from 'date-fns';
import { FontAwesome5 } from '@expo/vector-icons';
import { SwapTransaction, TokenMetadata } from '../../../../modules/data-module/services/swapTransactions';
import COLORS from '../../../../assets/colors';
import TYPOGRAPHY from '../../../../assets/typography';

// Import the enhanced type or define it here
interface EnhancedSwapTransaction extends SwapTransaction {
  uniqueId?: string;
  volumeUsd?: number;
  isMultiHop?: boolean;
  hopCount?: number;
  childTransactions?: EnhancedSwapTransaction[];
}

const { width } = Dimensions.get('window');

interface PastSwapItemProps {
  swap: EnhancedSwapTransaction;
  onSelect: (swap: EnhancedSwapTransaction) => void;
  selected: boolean;
  inputTokenLogoURI?: string; // New prop for input token logo
  outputTokenLogoURI?: string; // New prop for output token logo
  isMultiHop?: boolean; // Indicates if this is a multi-hop transaction
  hopCount?: number; // Number of hops in the transaction
}

/**
 * Format token amount with proper decimals
 */
function formatTokenAmount(amount: number, decimals: number): string {
  if (decimals === 0) return amount.toString();
  
  try {
    const divisor = Math.pow(10, decimals);
    const result = amount / divisor;

    // Handle very small amounts
    if (result < 0.000001) {
      return '< 0.000001';
    } else if (result < 0.001) {
      return result.toFixed(6);
    } else if (result < 0.01) {
      return result.toFixed(5);
    } else if (result < 1) {
      return result.toFixed(4);
    } else if (result < 1000) {
      return result.toFixed(2);
    } else if (result < 1000000) {
      return (result / 1000).toFixed(1) + 'K';
    } else {
      return (result / 1000000).toFixed(1) + 'M';
    }
  } catch (error) {
    console.warn('[formatTokenAmount] Error formatting amount:', { amount, decimals, error });
    return '0';
  }
}

/**
 * Format date for display
 */
function formatDate(timestamp: number): string {
  try {
    // Convert to Date object (support both seconds and milliseconds formats)
    const date = new Date(
      timestamp >= 1000000000000 ? timestamp : timestamp * 1000,
    );

    // Ensure the date is valid
    if (isNaN(date.getTime())) {
      console.warn('[formatDate] Invalid timestamp:', timestamp);
      return 'Invalid date';
    }

    return format(date, 'MMM d, h:mm a');
  } catch (error) {
    console.warn('[formatDate] Error formatting date:', { timestamp, error });
    return 'Unknown date';
  }
}

/**
 * Component for displaying a past swap transaction item with Jupiter-inspired UI
 */
const PastSwapItem: React.FC<PastSwapItemProps> = ({
  swap,
  onSelect,
  selected,
  inputTokenLogoURI,
  outputTokenLogoURI,
  isMultiHop,
  hopCount,
}) => {
  const { inputToken, outputToken, timestamp } = swap;

  // Validate required data
  if (!inputToken || !outputToken || !swap?.signature) {
    console.warn('[PastSwapItem] Missing required swap data:', swap);
    return null;
  }

  // Additional validation for token data
  if (!inputToken.mint || !outputToken.mint) {
    console.warn('[PastSwapItem] Missing token mint addresses:', { inputToken, outputToken });
    return null;
  }

  // Format the token amounts with proper decimals
  const formattedInputAmount = formatTokenAmount(
    inputToken.amount || 0,
    inputToken.decimals || 0,
  );
  const formattedOutputAmount = formatTokenAmount(
    outputToken.amount || 0,
    outputToken.decimals || 0,
  );

  // Determine image sources with clean fallbacks
  const inputImageSource =
    inputTokenLogoURI || inputToken?.logoURI || inputToken?.image;
  const outputImageSource =
    outputTokenLogoURI || outputToken?.logoURI || outputToken?.image;

  return (
    <View style={[styles.swapItem, selected && styles.selectedSwapItem]}>
      <View style={styles.swapHeader}>
        <Text style={styles.dateText}>{formatDate(timestamp)}</Text>

        <View style={styles.headerRightContainer}>
          {/* Multi-hop indicator */}
          {(isMultiHop || swap.isMultiHop) && (hopCount || swap.hopCount) && (
            <View style={styles.multiHopBadge}>
              <Text style={styles.multiHopText}>{hopCount || swap.hopCount}-hop</Text>
            </View>
          )}

          {/* Signature badge */}
          <View style={styles.signatureBadge}>
            <Text style={styles.signatureText}>
              {swap.signature.slice(0, 4)}...{swap.signature.slice(-4)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.tokensContainer}>
        {/* Input Token */}
        <View style={styles.tokenSide}>
          <View style={styles.tokenIconContainer}>
            {inputImageSource ? (
              <Image
                source={{ uri: inputImageSource }}
                style={styles.tokenIcon}
                resizeMode="contain"
                onError={(error) => {
                  console.warn('[PastSwapItem] Failed to load input token image:', inputImageSource, error);
                }}
              />
            ) : (
              <View style={[styles.tokenIcon, styles.placeholderIcon]}>
                <Text style={styles.placeholderText}>
                  {inputToken.symbol?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.tokenInfo}>
            <Text
              style={styles.tokenAmount}
              numberOfLines={1}
              ellipsizeMode="tail">
              {formattedInputAmount}
            </Text>
            <Text
              style={styles.tokenSymbol}
              numberOfLines={1}
              ellipsizeMode="tail">
              {inputToken.symbol || 'Unknown'}
            </Text>
          </View>
        </View>

        {/* Arrow */}
        <View style={styles.arrowContainer}>
          <FontAwesome5
            name={(isMultiHop || swap.isMultiHop) ? "route" : "arrow-right"}
            size={12}
            color={COLORS.brandBlue}
          />
        </View>

        {/* Output Token */}
        <View style={styles.tokenSide}>
          <View style={styles.tokenIconContainer}>
            {outputImageSource ? (
              <Image
                source={{ uri: outputImageSource }}
                style={styles.tokenIcon}
                resizeMode="contain"
                onError={(error) => {
                  console.warn('[PastSwapItem] Failed to load output token image:', outputImageSource, error);
                }}
              />
            ) : (
              <View style={[styles.tokenIcon, styles.placeholderIcon]}>
                <Text style={styles.placeholderText}>
                  {outputToken.symbol?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.tokenInfo}>
            <Text
              style={styles.tokenAmount}
              numberOfLines={1}
              ellipsizeMode="tail">
              {formattedOutputAmount}
            </Text>
            <Text
              style={styles.tokenSymbol}
              numberOfLines={1}
              ellipsizeMode="tail">
              {outputToken.symbol || 'Unknown'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  swapItem: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    marginVertical: 0,
    padding: 0,
    position: 'relative',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  selectedSwapItem: {
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  swapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    alignItems: 'center',
  },
  dateText: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.accessoryDarkColor,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signatureBadge: {
    backgroundColor: COLORS.darkerBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  signatureText: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.accessoryDarkColor,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
  },
  multiHopBadge: {
    backgroundColor: COLORS.brandBlue + '30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  multiHopText: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.brandBlue,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
  },
  tokensContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tokenSide: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    maxWidth: (width - 100) / 2,
  },
  tokenIconContainer: {
    marginRight: 8,
  },
  tokenIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
  },
  placeholderIcon: {
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
    color: COLORS.accessoryDarkColor,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenAmount: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    color: COLORS.white,
    marginBottom: 2,
  },
  tokenSymbol: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.accessoryDarkColor,
  },
  arrowContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  selectedIndicator: {
    display: 'none',
  },
});

export default PastSwapItem;
