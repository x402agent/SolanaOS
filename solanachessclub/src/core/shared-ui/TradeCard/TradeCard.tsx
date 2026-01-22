// FILE: src/components/Common/TradeCard/TradeCard.tsx

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StyleProp,
  ViewStyle,
  ImageSourcePropType,
} from 'react-native';
import styles from './TradeCard.style';
import { useBirdeye, Timeframe } from '@/modules/data-module/hooks/useBirdeye';
import LineGraph from './LineGraph';
import TokenDetailsDrawer from '@/core/shared-ui/TokenDetailsDrawer/TokenDetailsDrawer';
import { fetchJupiterTokenData } from '@/modules/data-module/utils/tokenUtils';

export interface TradeData {
  inputMint: string;
  outputMint: string;
  inputAmountLamports?: string;
  outputAmountLamports?: string;
  aggregator?: string;
  inputSymbol: string;
  inputQuantity: string;
  inputUsdValue?: string;
  outputSymbol: string;
  outputQuantity: string;
  outputUsdValue?: string;
  executionTimestamp?: any;
}

// Cache moved to tokenUtils.ts
// const jupiterTokenCache = new Map();

// Function moved to tokenUtils.ts
// async function fetchJupiterTokenData(mint: string) {...}

export interface TradeCardProps {
  tradeData: TradeData;
  /** Called when the user taps "Trade Now" (optional) */
  onTrade?: () => void;
  /** If true => show a chart for the output token */
  showGraphForOutputToken?: boolean;
  /** Theming overrides */
  themeOverrides?: Partial<Record<string, any>>;
  /** Style overrides for specific keys in the default style. */
  styleOverrides?: { [key: string]: object };
  /** For user-provided custom stylesheet merges */
  userStyleSheet?: { [key: string]: object };
  /** An optional user avatar to show on the chart for execution marker */
  userAvatar?: ImageSourcePropType;

  /**
   * A numeric (or string) value that changes when the parent wants to force a refresh.
   * E.g. you can pass a `refreshCounter` that increments each time
   * the user pulls to refresh in the Profile screen.
   */
  externalRefreshTrigger?: number;
}

/**
 * A card displaying trade info, with optional chart for the output token.
 */
function TradeCard({
  tradeData,
  onTrade,
  showGraphForOutputToken,
  themeOverrides,
  styleOverrides,
  userStyleSheet,
  userAvatar,
  externalRefreshTrigger,
}: TradeCardProps) {
  // --------------------------------------------------
  // Jupiter metadata about input & output tokens
  // --------------------------------------------------
  const [inputTokenMeta, setInputTokenMeta] = useState<any>(null);
  const [outputTokenMeta, setOutputTokenMeta] = useState<any>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [metaFetchFinished, setMetaFetchFinished] = useState(false);

  // --------------------------------------------------
  // Token USD price data
  // --------------------------------------------------
  const [inputUsdPrice, setInputUsdPrice] = useState<number | null>(null);
  const [outputUsdPrice, setOutputUsdPrice] = useState<number | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(false);

  // --------------------------------------------------
  // Token Details Drawer state
  // --------------------------------------------------
  const [showInputTokenDrawer, setShowInputTokenDrawer] = useState(false);
  const [showOutputTokenDrawer, setShowOutputTokenDrawer] = useState(false);

  // For preventing duplicate fetch calls
  const prevMintPairRef = useRef<{ inputMint: string; outputMint: string }>({
    inputMint: '',
    outputMint: '',
  });

  // --------------------------------------------------
  // Birdeye hook
  // --------------------------------------------------
  const {
    timeframe,
    setTimeframe,
    graphData,
    timestamps,
    timeframePrice,
    coinError,
    refreshTokenData,
    loadingOHLC,
    setSelectedTokenAddress,
  } = useBirdeye();

  // Keep track of timeframe changes
  const prevTimeframeRef = useRef<Timeframe>(timeframe);

  // Keep track of external refresh changes
  const prevRefreshTriggerRef = useRef(externalRefreshTrigger);

  // --------------------------------------------------
  // 1) Fetch Jupiter output token metadata - OPTIMIZED
  // --------------------------------------------------
  const fetchTokenMetadata = useCallback(async () => {
    if (
      prevMintPairRef.current.inputMint === tradeData.inputMint &&
      prevMintPairRef.current.outputMint === tradeData.outputMint &&
      metaFetchFinished
    ) {
      return; // Already fetched this pair and completed
    }

    let canceled = false;
    setLoadingMeta(true);

    try {
      // Fetch both input and output token data
      const [inMeta, outMeta] = await Promise.all([
        fetchJupiterTokenData(tradeData.inputMint),
        fetchJupiterTokenData(tradeData.outputMint)
      ]);

      if (!canceled) {
        setInputTokenMeta(inMeta);
        setOutputTokenMeta(outMeta);
        prevMintPairRef.current = {
          inputMint: tradeData.inputMint,
          outputMint: tradeData.outputMint,
        };
        setMetaFetchFinished(true);

        // If user wants a chart => set the token address & fetch data immediately
        if (showGraphForOutputToken) {
          setSelectedTokenAddress(tradeData.outputMint);
        }

        // If we found coingecko IDs in metadata, attempt to fetch prices
        await fetchTokenPrices(inMeta, outMeta);
      }
    } catch (err) {
      console.error('TradeCard: jupiter token fetch error', err);
    } finally {
      if (!canceled) setLoadingMeta(false);
    }

    return () => {
      canceled = true;
    };
  }, [tradeData.outputMint, tradeData.inputMint, showGraphForOutputToken, setSelectedTokenAddress, metaFetchFinished]);

  // --------------------------------------------------
  // 2) Fetch token prices from CoinGecko
  // --------------------------------------------------
  const fetchTokenPrices = useCallback(async (inputMeta: any, outputMeta: any) => {
    // Skip if we already have USD values in the trade data
    if (tradeData.inputUsdValue && tradeData.outputUsdValue &&
      tradeData.inputUsdValue !== '$??' && tradeData.outputUsdValue !== '$??') {
      return;
    }

    setLoadingPrices(true);
    try {
      const ids: string[] = [];
      const idToTokenMap = new Map();

      // Add input token coingecko ID if available
      if (inputMeta?.extensions?.coingeckoId) {
        const id = inputMeta.extensions.coingeckoId.toLowerCase();
        ids.push(id);
        idToTokenMap.set(id, 'input');
      } else if (tradeData.inputSymbol.toLowerCase() === 'sol') {
        // Special case for SOL
        ids.push('solana');
        idToTokenMap.set('solana', 'input');
      }

      // Add output token coingecko ID if available
      if (outputMeta?.extensions?.coingeckoId) {
        const id = outputMeta.extensions.coingeckoId.toLowerCase();
        ids.push(id);
        idToTokenMap.set(id, 'output');
      }

      // If we have any IDs, fetch prices
      if (ids.length > 0) {
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`
        );
        const data = await response.json();

        // Update prices based on what we received
        for (const [id, type] of idToTokenMap.entries()) {
          if (data[id] && data[id].usd) {
            if (type === 'input') {
              setInputUsdPrice(data[id].usd);
            } else if (type === 'output') {
              setOutputUsdPrice(data[id].usd);
            }
          }
        }
      }

      // Try with token symbols as fallback
      if (!idToTokenMap.has('input') && tradeData.inputSymbol) {
        await fetchPriceBySymbol(tradeData.inputSymbol, 'input');
      }
      if (!idToTokenMap.has('output') && tradeData.outputSymbol) {
        await fetchPriceBySymbol(tradeData.outputSymbol, 'output');
      }
    } catch (err) {
      console.error('Error fetching token prices:', err);
    } finally {
      setLoadingPrices(false);
    }
  }, [tradeData]);

  // Helper function to fetch price by token symbol
  const fetchPriceBySymbol = useCallback(async (symbol: string, type: 'input' | 'output') => {
    try {
      // Special case for known tokens
      if (symbol.toUpperCase() === 'USDC' || symbol.toUpperCase() === 'USDT') {
        if (type === 'input') setInputUsdPrice(1);
        else setOutputUsdPrice(1);
        return;
      }

      // Try to fetch from CoinGecko using symbol as ID (works for some tokens)
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd`
      );
      const data = await response.json();

      if (data[symbol.toLowerCase()] && data[symbol.toLowerCase()].usd) {
        if (type === 'input') {
          setInputUsdPrice(data[symbol.toLowerCase()].usd);
        } else {
          setOutputUsdPrice(data[symbol.toLowerCase()].usd);
        }
      }
    } catch (err) {
      console.error(`Error fetching price for ${symbol}:`, err);
    }
  }, []);

  useEffect(() => {
    fetchTokenMetadata();
  }, [fetchTokenMetadata]);

  // --------------------------------------------------
  // 2) Handle timeframe changes - OPTIMIZED
  // --------------------------------------------------
  useEffect(() => {
    if (!showGraphForOutputToken) return;
    if (!tradeData.outputMint) return;

    // Only refresh if timeframe actually changed
    if (timeframe !== prevTimeframeRef.current) {
      prevTimeframeRef.current = timeframe;
      refreshTokenData();
    }
  }, [timeframe, showGraphForOutputToken, tradeData.outputMint, refreshTokenData]);

  // --------------------------------------------------
  // 3) Handle external refresh triggers - OPTIMIZED
  // --------------------------------------------------
  useEffect(() => {
    if (!showGraphForOutputToken) return;
    if (!tradeData.outputMint) return;

    if (externalRefreshTrigger !== prevRefreshTriggerRef.current) {
      prevRefreshTriggerRef.current = externalRefreshTrigger;
      refreshTokenData();

      // Also refresh token prices when external trigger changes
      fetchTokenPrices(inputTokenMeta, outputTokenMeta);
    }
  }, [
    externalRefreshTrigger,
    showGraphForOutputToken,
    tradeData.outputMint,
    inputTokenMeta,
    refreshTokenData,
    fetchTokenPrices,
  ]);

  // --------------------------------------------------
  // Calculate USD values from prices and quantities - MEMOIZED
  // --------------------------------------------------
  const {
    calculatedInputUsdValue,
    calculatedOutputUsdValue,
    currentOutputValue,
    executionPrice,
    executionTimestamp
  } = useMemo(() => {
    let executionPrice: number | undefined;
    let calculatedInputUsdValue = '';
    let calculatedOutputUsdValue = '';
    let currentOutputValue = '';

    // Calculate price if we have both input and output amounts
    if (tradeData.inputAmountLamports && tradeData.outputAmountLamports) {
      const inputLamports = parseFloat(tradeData.inputAmountLamports);
      const outputLamports = parseFloat(tradeData.outputAmountLamports);
      if (inputLamports > 0 && outputLamports > 0) {
        executionPrice = inputLamports / outputLamports;
      }
    } else if (tradeData.inputQuantity && tradeData.outputQuantity) {
      const inputQty = parseFloat(tradeData.inputQuantity);
      const outputQty = parseFloat(tradeData.outputQuantity);
      if (inputQty > 0 && outputQty > 0) {
        executionPrice = inputQty / outputQty;
      }
    }

    // Calculate USD values if we have prices
    if (inputUsdPrice !== null && tradeData.inputQuantity) {
      const inputQty = parseFloat(tradeData.inputQuantity);
      calculatedInputUsdValue = `$${(inputQty * inputUsdPrice).toFixed(2)}`;
    }

    if (outputUsdPrice !== null && tradeData.outputQuantity) {
      const outputQty = parseFloat(tradeData.outputQuantity);
      calculatedOutputUsdValue = `$${(outputQty * outputUsdPrice).toFixed(2)}`;

      // Calculate current value of output tokens (may differ from trade time)
      currentOutputValue = `$${(outputQty * outputUsdPrice).toFixed(2)}`;
    }

    return {
      calculatedInputUsdValue,
      calculatedOutputUsdValue,
      currentOutputValue,
      executionPrice,
      executionTimestamp: tradeData.executionTimestamp,
    };
  }, [
    tradeData,
    inputUsdPrice,
    outputUsdPrice
  ]);

  // --------------------------------------------------
  // Calculate current price vs trade price difference if available
  // --------------------------------------------------
  const priceDifference = useMemo(() => {
    if (!tradeData.outputUsdValue || !currentOutputValue) return null;

    // Skip if we're using placeholders or empty values
    if (
      tradeData.outputUsdValue === '$??' ||
      tradeData.outputUsdValue === '' ||
      currentOutputValue === ''
    ) {
      return null;
    }

    try {
      // Parse values, removing the $ prefix
      const tradeValueStr = tradeData.outputUsdValue.replace('$', '').replace('~', '');
      const currentValueStr = currentOutputValue.replace('$', '');

      const tradeValue = parseFloat(tradeValueStr);
      const currentValueNum = parseFloat(currentValueStr);

      if (isNaN(tradeValue) || isNaN(currentValueNum) || tradeValue === 0) {
        return null;
      }

      const percentChange = ((currentValueNum - tradeValue) / tradeValue) * 100;

      return {
        percentChange,
        isPositive: percentChange > 0,
        formattedChange: `${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%`
      };
    } catch (err) {
      console.error('Error calculating price difference:', err);
      return null;
    }
  }, [tradeData.outputUsdValue, currentOutputValue]);

  // --------------------------------------------------
  // Fallback name/logo from Jupiter metadata - MEMOIZED
  // --------------------------------------------------
  const {
    fallbackInName,
    fallbackInLogo,
    fallbackOutName,
    fallbackOutLogo
  } = useMemo(() => {
    // Use token metadata if available, otherwise fallback to tradeData symbols
    return {
      fallbackInName: inputTokenMeta?.name ?? tradeData.inputSymbol,
      fallbackInLogo: inputTokenMeta?.logoURI ?? '',
      fallbackOutName: outputTokenMeta?.name ?? tradeData.outputSymbol,
      fallbackOutLogo: outputTokenMeta?.logoURI ?? '',
    };
  }, [
    inputTokenMeta,
    outputTokenMeta,
    tradeData.inputSymbol,
    tradeData.outputSymbol
  ]);

  // Memoize the refresh handler to prevent unnecessary re-renders
  const handleRefresh = useCallback(() => {
    refreshTokenData();
    fetchTokenPrices(inputTokenMeta, outputTokenMeta);
  }, [refreshTokenData, fetchTokenPrices, inputTokenMeta, outputTokenMeta]);

  // --------------------------------------------------
  // Handlers for Token Detail Drawer
  // --------------------------------------------------
  const handleOpenInputTokenDetails = useCallback(() => {
    setShowInputTokenDrawer(true);
  }, []);

  const handleOpenOutputTokenDetails = useCallback(() => {
    setShowOutputTokenDrawer(true);
  }, []);

  // Get the display price for the card
  const displayPrice = useMemo(() => {
    if (tradeData.outputUsdValue && tradeData.outputUsdValue !== '$??') {
      return tradeData.outputUsdValue.replace('$', '');
    }
    if (calculatedOutputUsdValue) {
      return calculatedOutputUsdValue.replace('$', '');
    }
    if (timeframePrice) {
      return timeframePrice.toFixed(2);
    }
    return '';
  }, [tradeData.outputUsdValue, calculatedOutputUsdValue, timeframePrice]);

  // Calculate quantity difference if available (+5 SOL example from the image)
  const quantityDiff = useMemo(() => {
    // In a real app this would be calculated from trade history or provided in props
    // For now, just show a positive example if we have output quantity
    if (tradeData.outputQuantity) {
      return `+${tradeData.outputQuantity} ${tradeData.outputSymbol}`;
    }
    return '';
  }, [tradeData.outputQuantity, tradeData.outputSymbol]);

  // Handle loading states
  const isLoading = loadingMeta || loadingOHLC || loadingPrices;

  // More specific loading state for the graph data
  const isGraphDataLoading = loadingOHLC || (showGraphForOutputToken && (!graphData || graphData.length === 0) && !coinError);

  // --------------------------------------------------
  // Render main TradeCard component
  // --------------------------------------------------
  return (
    <>
      <View style={styles.tradeCardContainer}>
        {/* Token Header Section - Always displayed even during loading */}
        <TouchableOpacity
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          onPress={handleOpenOutputTokenDetails}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'column' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image
                source={
                  fallbackOutLogo
                    ? { uri: fallbackOutLogo }
                    : require('@/assets/images/SENDlogo.png')
                }
                style={styles.tradeCardTokenImage}
              />
              <View style={{ flexDirection: 'column' }}>
                <Text style={styles.tradeCardTokenName}>
                  {tradeData.outputSymbol}
                </Text>
                <Text style={styles.tokenSubtitle}>
                  {`Bought at ${tradeData.inputUsdValue || calculatedInputUsdValue || ''}`}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.positiveValue}>
              {quantityDiff}
            </Text>
            <Text style={styles.tradeCardUsdPrice}>
              ${displayPrice}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Chart Section - Always shows the container, loading indicator displayed within */}
        <View style={styles.chartContainer}>
          <LineGraph
            data={graphData && graphData.length > 0 ? graphData : []}
            width={Dimensions.get('window').width - 64}
            executionPrice={executionPrice}
            executionTimestamp={executionTimestamp}
            timestamps={timestamps}
            userAvatar={userAvatar}
            isLoading={isGraphDataLoading}
          />
        </View>

        {/* Timeframe controls - Always displayed even during loading */}
        <View style={styles.timeframeRow}>
          {(['1H', '1D', '1W', '1M', 'ALL'] as Timeframe[]).map(tf => (
            <TouchableOpacity
              key={tf}
              style={[
                styles.timeframeButton,
                timeframe === tf && styles.timeframeButtonActive
              ]}
              onPress={() => setTimeframe(tf)}>
              <Text
                style={[
                  styles.timeframeButtonText,
                  timeframe === tf && styles.timeframeButtonTextActive
                ]}>
                {tf}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Token Details Drawers */}
      <TokenDetailsDrawer
        visible={showInputTokenDrawer}
        onClose={() => setShowInputTokenDrawer(false)}
        tokenMint={tradeData.inputMint}
        initialData={{
          symbol: tradeData.inputSymbol,
          name: fallbackInName,
          logoURI: fallbackInLogo,
        }}
      />

      <TokenDetailsDrawer
        visible={showOutputTokenDrawer}
        onClose={() => setShowOutputTokenDrawer(false)}
        tokenMint={tradeData.outputMint}
        initialData={{
          symbol: tradeData.outputSymbol,
          name: fallbackOutName,
          logoURI: fallbackOutLogo,
        }}
      />
    </>
  );
}

// Memo comparison to skip unnecessary re-renders - OPTIMIZED with deep prop checking
function arePropsEqual(prev: TradeCardProps, next: TradeCardProps) {
  if (prev.showGraphForOutputToken !== next.showGraphForOutputToken) return false;
  if (prev.externalRefreshTrigger !== next.externalRefreshTrigger) return false;

  // Deep compare tradeData objects
  const p = prev.tradeData;
  const n = next.tradeData;

  if (
    p.inputMint !== n.inputMint ||
    p.outputMint !== n.outputMint ||
    p.inputQuantity !== n.inputQuantity ||
    p.outputQuantity !== n.outputQuantity ||
    p.inputSymbol !== n.inputSymbol ||
    p.outputSymbol !== n.outputSymbol ||
    p.inputUsdValue !== n.inputUsdValue ||
    p.outputUsdValue !== n.outputUsdValue ||
    p.aggregator !== n.aggregator ||
    p.inputAmountLamports !== n.inputAmountLamports ||
    p.outputAmountLamports !== n.outputAmountLamports
  ) {
    return false;
  }

  // Compare theme and style references
  if (prev.themeOverrides !== next.themeOverrides) return false;
  if (prev.styleOverrides !== next.styleOverrides) return false;
  if (prev.userStyleSheet !== next.userStyleSheet) return false;

  // If avatar is a string (URI), compare as string
  if (typeof prev.userAvatar === 'string' || typeof next.userAvatar === 'string') {
    return prev.userAvatar === next.userAvatar;
  }

  // Otherwise compare avatar references
  return prev.userAvatar === next.userAvatar;
}

export default React.memo(TradeCard, arePropsEqual);
