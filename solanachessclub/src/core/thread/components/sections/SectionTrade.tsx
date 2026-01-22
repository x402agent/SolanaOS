import React, { useMemo, useRef, useEffect, useState } from 'react';
import { View, Text, ImageSourcePropType, StyleSheet } from 'react-native';
import { ThreadUser, TradeData } from '../thread.types';
import { DEFAULT_IMAGES } from '@/shared/config/constants';
import { TradeCard } from '@/core/shared-ui/TradeCard';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

interface SectionTradeProps {
  text?: string;
  tradeData?: TradeData;
  user?: ThreadUser;
  createdAt?: string;
  externalRefreshTrigger?: number;
}

// Global cache for user avatars to prevent recreating image sources
const userAvatarCache = new Map<string, ImageSourcePropType>();

// Moved outside component to avoid recreation on each render
function getUserAvatar(u?: ThreadUser): ImageSourcePropType {
  if (!u) return DEFAULT_IMAGES.user;

  // Use user ID as cache key
  const cacheKey = u.id || 'unknown';

  // Check cache first
  if (userAvatarCache.has(cacheKey)) {
    return userAvatarCache.get(cacheKey)!;
  }

  // Create and cache the avatar image source
  let avatarSource: ImageSourcePropType;
  if (u.avatar) {
    if (typeof u.avatar === 'string') {
      avatarSource = { uri: u.avatar };
    } else {
      avatarSource = u.avatar;
    }
  } else {
    avatarSource = DEFAULT_IMAGES.user;
  }

  // Store in cache
  userAvatarCache.set(cacheKey, avatarSource);
  return avatarSource;
}

// Create our own local refresh counter
let refreshCounter = 0;

function SectionTrade({
  text,
  tradeData,
  user,
  createdAt,
  externalRefreshTrigger,
}: SectionTradeProps) {
  // Keep a ref to the previous trade data to avoid unnecessary re-renders
  const prevTradeDataRef = useRef<TradeData | undefined>(tradeData);

  // Local refresh counter to trigger price updates
  const [localRefreshTrigger, setLocalRefreshTrigger] = useState(0);

  // Auto-refresh timer for keeping prices current
  const [autoRefreshCount, setAutoRefreshCount] = useState(0);

  // Keep track if the component is mounted
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    // Set up an interval to refresh prices every 30 seconds
    // This keeps current prices up-to-date for actively viewed trades
    const intervalId = setInterval(() => {
      if (isMountedRef.current) {
        setAutoRefreshCount(prev => prev + 1);
      }
    }, 30000); // 30 seconds

    return () => {
      clearInterval(intervalId);
      isMountedRef.current = false;
    };
  }, []);

  // Update the ref when tradeData changes
  useEffect(() => {
    prevTradeDataRef.current = tradeData;
  }, [tradeData]);

  // When external refresh trigger changes, update our local trigger
  useEffect(() => {
    if (externalRefreshTrigger !== undefined) {
      setLocalRefreshTrigger(current => current + 1);
    }
  }, [externalRefreshTrigger]);

  // If we have missing or placeholder USD values, trigger a refresh
  useEffect(() => {
    if (!tradeData) return;

    const hasMissingOrPlaceholderUsdValues =
      !tradeData.inputUsdValue ||
      !tradeData.outputUsdValue ||
      tradeData.inputUsdValue === '$??' ||
      tradeData.outputUsdValue === '$??';

    if (hasMissingOrPlaceholderUsdValues) {
      // Only do this once per mount to avoid infinite loops
      refreshCounter++;
      setLocalRefreshTrigger(refreshCounter);
    }
  }, [tradeData]);

  // Initial load effect - always trigger a refresh on mount to get latest prices
  useEffect(() => {
    // Trigger fresh price data fetch when component mounts
    if (isMountedRef.current) {
      setTimeout(() => {
        setLocalRefreshTrigger(prev => prev + 1);
      }, 500); // Small delay to allow component to fully render
    }
  }, []);

  // Memoize values to prevent unnecessary re-renders
  const userAvatar = useMemo(() => getUserAvatar(user), [user?.id, user?.avatar]);

  // Only create a new tradeData object if necessary
  const enhancedTradeData = useMemo(() => {
    if (!tradeData) return undefined;

    // Clean up any "$??" placeholders
    const cleanedTradeData = {
      ...tradeData,
      inputUsdValue: tradeData.inputUsdValue === '$??' ? '' : tradeData.inputUsdValue,
      outputUsdValue: tradeData.outputUsdValue === '$??' ? '' : tradeData.outputUsdValue,
      executionTimestamp: tradeData.executionTimestamp || createdAt,
    };

    return cleanedTradeData;
  }, [tradeData, createdAt]);

  // If tradeData is missing, don't render a TradeCard
  if (!enhancedTradeData) {
    return <Text style={styles.errorText}>[Missing trade data]</Text>;
  }

  // Combine all refresh triggers
  const combinedRefreshTrigger = externalRefreshTrigger
    ? externalRefreshTrigger + localRefreshTrigger + autoRefreshCount
    : localRefreshTrigger + autoRefreshCount;

  return (
    <View>
      {!!text && (
        <Text style={styles.textContent}>
          {text}
        </Text>
      )}
      <TradeCard
        tradeData={enhancedTradeData}
        showGraphForOutputToken={true}
        userAvatar={userAvatar}
        externalRefreshTrigger={combinedRefreshTrigger}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  textContent: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.regular),
    color: COLORS.white,
    marginBottom: 6,
  },
  errorText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.errorRed,
  }
});

// Improved deep comparison function for props
function arePropsEqual(
  prev: Readonly<SectionTradeProps>,
  next: Readonly<SectionTradeProps>,
) {
  // Text comparison
  if (prev.text !== next.text) return false;

  // External refresh trigger comparison
  if (prev.externalRefreshTrigger !== next.externalRefreshTrigger) return false;

  // Created at comparison
  if (prev.createdAt !== next.createdAt) return false;

  // User comparison - check ID and avatar specifically since it's what we use
  if (
    (prev.user?.id !== next.user?.id) ||
    (prev.user?.avatar !== next.user?.avatar)
  ) {
    return false;
  }

  // Deep tradeData comparison - only compare if IDs are different
  // This prevents re-rendering for the same trade data
  const p = prev.tradeData;
  const n = next.tradeData;

  // If both are undefined, they're equal
  if (!p && !n) return true;

  // If only one is undefined, they're not equal
  if (!p || !n) return false;

  // Compare all tradeData properties
  if (p.inputMint !== n.inputMint) return false;
  if (p.outputMint !== n.outputMint) return false;
  if (p.inputSymbol !== n.inputSymbol) return false;
  if (p.outputSymbol !== n.outputSymbol) return false;
  if (p.inputQuantity !== n.inputQuantity) return false;
  if (p.outputQuantity !== n.outputQuantity) return false;
  if (p.inputUsdValue !== n.inputUsdValue) return false;
  if (p.outputUsdValue !== n.outputUsdValue) return false;
  if (p.aggregator !== n.aggregator) return false;
  if (p.inputAmountLamports !== n.inputAmountLamports) return false;
  if (p.outputAmountLamports !== n.outputAmountLamports) return false;
  if (p.executionTimestamp !== n.executionTimestamp) return false;
  if (p.message !== n.message) return false;

  return true;
}

export default React.memo(SectionTrade, arePropsEqual);
