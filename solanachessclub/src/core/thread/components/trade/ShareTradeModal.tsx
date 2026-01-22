import React, { useEffect, useState, useCallback, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Animated,
  Easing,
  Dimensions,
  TextInput,
  ScrollView,
} from 'react-native';
import { useWallet } from '@/modules/wallet-providers/hooks/useWallet';
import styles from './ShareTradeModal.style';
import PastSwapItem from './PastSwapItem';
import { FontAwesome5 } from '@expo/vector-icons';
import { TransactionService } from '@/modules/wallet-providers/services/transaction/transactionService';
import { TokenInfo } from '@/modules/data-module/types/tokenTypes';
import {
  DEFAULT_SOL_TOKEN,
  DEFAULT_USDC_TOKEN,
  estimateTokenUsdValue,
  ensureCompleteTokenInfo
} from '../../../../modules/data-module';
import { useAppDispatch } from '@/shared/hooks/useReduxHooks';
import COLORS from '../../../../assets/colors';
import {
  ShareTradeModalRef,
  TabOption,
  EnhancedSwapTransaction,
  UpdatedTradeModalProps,
  TradeData,
  ModalScreen
} from './ShareTradeModal.types';
import { SkeletonSwapList } from './ShareTradeModal.skeleton';
import { usePastSwaps } from '../../hooks/usePastSwaps';
import { useTokenMetadata } from '../../hooks/useTokenMetadata';

// Get screen dimensions
const { height } = Dimensions.get('window');

/**
 * A modal component for sharing trade history on the feed.
 * Features a smooth, intuitive two-step flow with excellent UX.
 */
export const ShareTradeModal = forwardRef<ShareTradeModalRef, UpdatedTradeModalProps>(({
  visible,
  onClose,
  currentUser,
  onShare,
  initialInputToken,
  initialOutputToken,
  disableTabs,
  initialActiveTab,
}, ref) => {
  const dispatch = useAppDispatch();
  const { publicKey: userPublicKey, connected } = useWallet();
  const [selectedTab, setSelectedTab] = useState<TabOption>(() =>
    initialActiveTab ?? 'PAST_SWAPS'
  );
  const [currentScreen, setCurrentScreen] = useState<ModalScreen>('SWAP_SELECTION');

  const [inputToken, setInputToken] = useState<TokenInfo>(DEFAULT_SOL_TOKEN);
  const [outputToken, setOutputToken] = useState<TokenInfo>(DEFAULT_USDC_TOKEN);
  const [tokensInitialized, setTokensInitialized] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resultMsg, setResultMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [messageText, setMessageText] = useState('');
  const [selectedPastSwap, setSelectedPastSwap] = useState<EnhancedSwapTransaction | null>(null);

  const walletAddress = useMemo(() =>
    userPublicKey ? userPublicKey.toString() : null,
    [userPublicKey]
  );

  const {
    swaps,
    initialLoading,
    refreshing,
    apiError,
    refreshSwaps: forceRefreshPastSwaps,
    setSwaps,
    setApiError
  } = usePastSwaps({ walletAddress, visible });

  const {
    getTokenLogoUrl,
    fetchMetadataForTokens,
    loading: metadataLoading,
    error: metadataError
  } = useTokenMetadata();

  const isMounted = useRef(true);
  const pendingTokenOps = useRef<{ input: boolean, output: boolean }>({ input: false, output: false });

  // Animation refs for smooth transitions
  const bottomActionAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(0)).current;

  const hasBirdeyeApiKey = useMemo(() => {
    return true;
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnimation, {
        toValue: 1,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnimation]);

  // Animate bottom action bar when swap is selected
  useEffect(() => {
    if (selectedPastSwap && currentScreen === 'SWAP_SELECTION') {
      Animated.spring(bottomActionAnimation, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(bottomActionAnimation, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedPastSwap, currentScreen, bottomActionAnimation]);

  // Fetch token metadata when swaps are loaded
  useEffect(() => {
    if (swaps.length > 0) {
      const tokenAddresses: string[] = [];

      swaps.forEach(swap => {
        if (swap.inputToken?.mint) {
          tokenAddresses.push(swap.inputToken.mint);
        }
        if (swap.outputToken?.mint) {
          tokenAddresses.push(swap.outputToken.mint);
        }
      });

      // Remove duplicates
      const uniqueAddresses = [...new Set(tokenAddresses)];

      if (uniqueAddresses.length > 0) {
        fetchMetadataForTokens(uniqueAddresses)
          .catch((error) => {
            console.error('[ShareTradeModal] Error fetching token metadata:', error);
          });
      }
    }
  }, [swaps, fetchMetadataForTokens]);

  const translateY = slideAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
    extrapolate: 'clamp'
  });

  const bottomActionTranslateY = bottomActionAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0],
    extrapolate: 'clamp'
  });

  const bottomActionOpacity = bottomActionAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp'
  });

  useEffect(() => {
    isMounted.current = true;
    return () => {
      console.log('[TradeModal] Component unmounting, cleaning up');
      isMounted.current = false;
      pendingTokenOps.current = { input: false, output: false };
    };
  }, []);

  const initializeTokens = useCallback(async () => {
    if (!isMounted.current || (pendingTokenOps.current.input && pendingTokenOps.current.output)) {
      return;
    }
    try {
      pendingTokenOps.current = { input: true, output: true };
      console.log('[TradeModal] Initializing tokens...');
      const completeInputToken = initialInputToken?.address ? await ensureCompleteTokenInfo(initialInputToken) : DEFAULT_SOL_TOKEN;
      const completeOutputToken = initialOutputToken?.address ? await ensureCompleteTokenInfo(initialOutputToken) : DEFAULT_USDC_TOKEN;
      if (isMounted.current) {
        setInputToken(completeInputToken);
        setOutputToken(completeOutputToken);
        pendingTokenOps.current = { input: false, output: false };
        setTokensInitialized(true);
      }
    } catch (error) {
      console.error('[TradeModal] Error initializing tokens:', error);
      pendingTokenOps.current = { input: false, output: false };
    }
  }, [initialInputToken, initialOutputToken]);

  useEffect(() => {
    if (visible) {
      if (isMounted.current) {
        setResultMsg('');
        setErrorMsg('');
        setCurrentScreen('SWAP_SELECTION');
      }
      if (!tokensInitialized) {
        initializeTokens();
      }
    }
  }, [visible, tokensInitialized, initializeTokens]);

  const handleClose = useCallback(() => {
    setSelectedTab(initialActiveTab ?? 'PAST_SWAPS');
    setResultMsg('');
    setErrorMsg('');
    setSelectedPastSwap(null);
    setMessageText('');
    setCurrentScreen('SWAP_SELECTION');
    if (setApiError) setApiError(null);
    onClose();
  }, [onClose, initialActiveTab, setApiError]);

  const handleBackToSwapSelection = useCallback(() => {
    setCurrentScreen('SWAP_SELECTION');
    setMessageText('');
  }, []);

  const handleContinueToMessage = useCallback(() => {
    if (!selectedPastSwap) {
      Alert.alert('No swap selected', 'Please select a swap to continue.');
      return;
    }
    setCurrentScreen('MESSAGE_INPUT');
  }, [selectedPastSwap]);

  const createTradeDataFromSwap = useCallback(async (swap: EnhancedSwapTransaction): Promise<TradeData> => {
    // Validate swap data
    if (!swap || !swap.inputToken || !swap.outputToken) {
      throw new Error('Invalid swap data: missing token information');
    }

    if (!swap.inputToken.mint || !swap.outputToken.mint) {
      throw new Error('Invalid swap data: missing token mint addresses');
    }

    if (typeof swap.inputToken.amount !== 'number' || typeof swap.outputToken.amount !== 'number') {
      throw new Error('Invalid swap data: token amounts must be numbers');
    }

    if (typeof swap.inputToken.decimals !== 'number' || typeof swap.outputToken.decimals !== 'number') {
      throw new Error('Invalid swap data: token decimals must be numbers');
    }

    try {
      const inputQty = swap.inputToken.amount / Math.pow(10, swap.inputToken.decimals);
      const outputQty = swap.outputToken.amount / Math.pow(10, swap.outputToken.decimals);
      const timestampMs = swap.timestamp < 10000000000 ? swap.timestamp * 1000 : swap.timestamp;

      let inputUsdValue: string;
      let outputUsdValue: string;

      if ('volumeUsd' in swap && swap.volumeUsd !== undefined && typeof swap.volumeUsd === 'number' && swap.volumeUsd > 0) {
        inputUsdValue = `$${swap.volumeUsd.toFixed(2)}`;
        outputUsdValue = `$${swap.volumeUsd.toFixed(2)}`;
      } else {
        try {
          inputUsdValue = await estimateTokenUsdValue(
            swap.inputToken.amount,
            swap.inputToken.decimals,
            swap.inputToken.mint,
            swap.inputToken.symbol
          );
          outputUsdValue = await estimateTokenUsdValue(
            swap.outputToken.amount,
            swap.outputToken.decimals,
            swap.outputToken.mint,
            swap.outputToken.symbol
          );
        } catch (error) {
          console.warn('[ShareTradeModal] Failed to estimate USD values:', error);
          inputUsdValue = '$0.00';
          outputUsdValue = '$0.00';
        }
      }

      const tradeData = {
        inputMint: swap.inputToken.mint,
        outputMint: swap.outputToken.mint,
        aggregator: 'Jupiter',
        inputSymbol: swap.inputToken.symbol || 'Unknown',
        inputQuantity: inputQty.toFixed(4),
        inputUsdValue,
        outputSymbol: swap.outputToken.symbol || 'Unknown',
        inputAmountLamports: String(swap.inputToken.amount),
        outputAmountLamports: String(swap.outputToken.amount),
        outputQuantity: outputQty.toFixed(4),
        outputUsdValue,
        executionTimestamp: timestampMs,
      };

      return tradeData;

    } catch (error) {
      console.error('[ShareTradeModal] Error creating trade data:', error);
      throw new Error(`Failed to process swap data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  const handlePastSwapSelected = useCallback((swap: EnhancedSwapTransaction) => {
    setSelectedPastSwap(swap);
    if (setApiError) setApiError(null);
  }, [setApiError]);

  useEffect(() => {
    if (swaps.length > 0 && !selectedPastSwap) {
      setSelectedPastSwap(swaps[0]);
    }
  }, [swaps, selectedPastSwap]);

  useImperativeHandle(ref, () => ({
    forceRefresh: forceRefreshPastSwaps,
  }));

  const handleSharePastSwap = useCallback(async (withMessage: boolean = true) => {
    if (!selectedPastSwap) {
      Alert.alert('No swap selected', 'Please select a swap to share.');
      return;
    }

    if (isMounted.current) {
      setLoading(true);
      setResultMsg('Sharing trade...');
      setErrorMsg('');
    }

    try {
      const tradeDataForShare = await createTradeDataFromSwap(selectedPastSwap);
      const finalTradeData = {
        ...tradeDataForShare,
        message: withMessage ? messageText.trim() || undefined : undefined,
      };

      console.log('[ShareTradeModal] Sharing trade with data:', JSON.stringify(finalTradeData, null, 2));

      if (onShare) {
        await onShare(finalTradeData);
      } else {
        console.error('[ShareTradeModal] No onShare handler provided');
        throw new Error('No onShare handler provided');
      }

      if (isMounted.current) {
        setResultMsg('Trade shared successfully!');
        // Auto-close after a short delay
        setTimeout(handleClose, 1000);
      }
    } catch (err: any) {
      console.error('[handleSharePastSwap] Error =>', err);
      const errorMessage = err?.message || 'Failed to share trade. Please try again.';
      if (isMounted.current) {
        setErrorMsg(errorMessage);
        Alert.alert('Error Sharing Trade', errorMessage, [{ text: 'OK' }]);
      }
      TransactionService.showError(err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [selectedPastSwap, onShare, handleClose, createTradeDataFromSwap, messageText]);

  const handleQuickShare = useCallback(async () => {
    await handleSharePastSwap(false);
  }, [handleSharePastSwap]);

  const formatSwapTimestamp = useCallback((timestamp: number) => {
    const date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    } else {
      return `${Math.floor(diffHours / 24)}d ago`;
    }
  }, []);

  const renderSwapsList = () => {
    // Show skeletons during initial loading
    if (initialLoading && swaps.length === 0) {
      return <SkeletonSwapList count={7} />;
    }

    // Show error state
    if (apiError && swaps.length === 0) {
      return (
        <View style={styles.emptySwapsList}>
          <View style={[styles.emptySwapsIcon, { backgroundColor: COLORS.errorRed }]}>
            <FontAwesome5 name="exclamation-triangle" size={24} color={COLORS.white} />
          </View>
          <Text style={styles.emptySwapsText}>Error Loading Swaps</Text>
          <Text style={styles.emptySwapsSubtext}>{apiError}</Text>
          <TouchableOpacity
            style={styles.emptyStateRefreshButton}
            onPress={forceRefreshPastSwaps}
            disabled={refreshing}>
            <FontAwesome5 name="sync-alt" size={12} color={COLORS.white} />
            <Text style={styles.emptyStateRefreshText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Show empty state
    if (swaps.length === 0 && !initialLoading) {
      return (
        <View style={styles.emptySwapsList}>
          <View style={styles.emptySwapsIcon}>
            <FontAwesome5 name="exchange-alt" size={24} color={COLORS.white} />
          </View>
          <Text style={styles.emptySwapsText}>No Swap History</Text>
          <Text style={styles.emptySwapsSubtext}>Complete a token swap to see it here</Text>
          <TouchableOpacity
            style={styles.emptyStateRefreshButton}
            onPress={forceRefreshPastSwaps}
            disabled={refreshing}>
            <FontAwesome5 name="sync-alt" size={12} color={COLORS.white} />
            <Text style={styles.emptyStateRefreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Show skeletons during refresh OR actual content
    return (
      <View style={{ flex: 1 }}>
        {refreshing && swaps.length > 0 ? (
          // Show skeletons during refresh
          <SkeletonSwapList count={7} />
        ) : (
          // Show actual content
          <FlatList
            data={swaps}
            renderItem={({ item, index }) => {
              const isSelected = selectedPastSwap?.uniqueId === item?.uniqueId;

              // Ensure we have valid item data
              if (!item || !item.inputToken || !item.outputToken) {
                return null;
              }

              // Additional validation
              if (!item.inputToken.mint || !item.outputToken.mint) {
                return null;
              }

              return (
                <View style={styles.swapItemWrapper}>
                  <TouchableOpacity
                    style={[
                      isSelected ? styles.swapItemSelected : styles.swapItemUnselected,
                      { position: 'relative' },
                      refreshing && { opacity: 0.6 }
                    ]}
                    onPress={() => {
                      handlePastSwapSelected(item);
                    }}
                    activeOpacity={0.7}
                    disabled={refreshing}>

                    {isSelected && (
                      <View style={styles.swapItemCheckmark}>
                        <FontAwesome5 name="check" size={12} color={COLORS.white} />
                      </View>
                    )}

                    <View style={{ padding: 16 }}>
                      <PastSwapItem
                        swap={item}
                        onSelect={() => { }}
                        selected={isSelected}
                        inputTokenLogoURI={getTokenLogoUrl(item.inputToken?.mint) || undefined}
                        outputTokenLogoURI={getTokenLogoUrl(item.outputToken?.mint) || undefined}
                        isMultiHop={item.isMultiHop}
                        hopCount={item.hopCount}
                      />
                    </View>
                  </TouchableOpacity>
                </View>
              );
            }}
            keyExtractor={(item, index) => {
              // Improved key extraction with fallbacks
              if (item?.uniqueId) return item.uniqueId;
              if (item?.signature) return item.signature;
              return `swap-${index}-${item?.timestamp || Date.now()}`;
            }}
            contentContainerStyle={styles.swapsList}
            showsVerticalScrollIndicator={true}
            initialNumToRender={5}
            onRefresh={forceRefreshPastSwaps}
            refreshing={false}
            ListHeaderComponent={
              <View style={styles.listHeaderContainer}>
                <Text style={styles.swapsCountText}>
                  {swaps.length > 0 ? `${swaps.length} ${swaps.length === 1 ? 'swap' : 'swaps'} found` : ''}
                  {apiError && swaps.length > 0 ? ' (Error loading more)' : ''}
                  {metadataLoading ? ' • Loading token info...' : ''}
                </Text>
                {swaps.length > 0 && <View style={styles.swapsListDivider} />}
              </View>
            }
            ListEmptyComponent={
              !initialLoading && !refreshing ? (
                <View style={styles.emptySwapsList}>
                  <View style={styles.emptySwapsIcon}>
                    <FontAwesome5 name="exchange-alt" size={24} color={COLORS.white} />
                  </View>
                  <Text style={styles.emptySwapsText}>No Swaps Available</Text>
                  <Text style={styles.emptySwapsSubtext}>Unable to load swap data</Text>
                </View>
              ) : null
            }
          />
        )}
      </View>
    );
  };

  const renderBottomActionBar = () => {
    if (!selectedPastSwap || currentScreen !== 'SWAP_SELECTION') return null;

    return (
      <Animated.View
        style={[
          styles.bottomActionBar,
          {
            transform: [{ translateY: bottomActionTranslateY }],
            opacity: bottomActionOpacity,
          },
        ]}>
        {loading ? (
          <View style={styles.bottomActionLoading}>
            <ActivityIndicator
              size="small"
              color={COLORS.brandBlue}
              style={styles.loadingSpinner}
            />
            <Text style={styles.selectedSwapTokens}>Sharing trade...</Text>
          </View>
        ) : (
          <View style={styles.bottomActionContent}>
            <View style={styles.selectedSwapSummary}>
              <Text style={styles.selectedSwapTokens}>
                {selectedPastSwap.inputToken.symbol} → {selectedPastSwap.outputToken.symbol}
              </Text>
              <Text style={styles.selectedSwapTimestamp}>
                {formatSwapTimestamp(selectedPastSwap.timestamp)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                style={styles.quickShareButton}
                onPress={handleQuickShare}
                disabled={loading}>
                <FontAwesome5 name="share" size={12} color={COLORS.brandBlue} />
                <Text style={styles.quickShareButtonText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.continueButton}
                onPress={handleContinueToMessage}
                disabled={loading}>
                <FontAwesome5 name="edit" size={12} color={COLORS.white} />
                <Text style={styles.continueButtonText}>Add Message</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>
    );
  };

  const renderSelectedSwapPreview = () => {
    if (!selectedPastSwap) return null;

    return (
      <View style={styles.selectedSwapPreview}>
        <Text style={styles.selectedSwapHeader}>Selected Swap</Text>
        <PastSwapItem
          swap={selectedPastSwap}
          onSelect={() => { }}
          selected={true}
          inputTokenLogoURI={getTokenLogoUrl(selectedPastSwap.inputToken?.mint) || undefined}
          outputTokenLogoURI={getTokenLogoUrl(selectedPastSwap.outputToken?.mint) || undefined}
        />
      </View>
    );
  };

  const renderSwapSelectionScreen = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Select Trade</Text>
        <TouchableOpacity
          style={styles.headerClose}
          onPress={handleClose}>
          <Text style={styles.headerCloseText}>✕</Text>
        </TouchableOpacity>
        {walletAddress && (
          <TouchableOpacity
            style={styles.refreshIcon}
            onPress={forceRefreshPastSwaps}
            disabled={refreshing || initialLoading}>
            <FontAwesome5
              name="sync"
              size={14}
              color={COLORS.accessoryDarkColor}
              style={[
                (refreshing || initialLoading) && {
                  transform: [{ rotate: '45deg' }]
                },
                refreshing && { opacity: 0.7 }
              ]}
            />
          </TouchableOpacity>
        )}
      </View>
      <View style={[styles.pastSwapsContainer, { flex: 1 }]}>
        {walletAddress ? (
          <View style={styles.pastSwapsContent}>
            {renderSwapsList()}
          </View>
        ) : (
          <View style={styles.walletNotConnected}>
            <View style={styles.connectWalletIcon}>
              <FontAwesome5 name="wallet" size={20} color={COLORS.accessoryDarkColor} />
            </View>
            <Text style={styles.walletNotConnectedText}>
              Please connect your wallet to view your past swaps
            </Text>
          </View>
        )}
      </View>
      {renderBottomActionBar()}
    </>
  );

  const renderMessageInputScreen = () => (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={handleBackToSwapSelection}>
          <FontAwesome5 name="arrow-left" size={14} color={COLORS.accessoryDarkColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Message</Text>
        <TouchableOpacity
          style={styles.headerClose}
          onPress={handleClose}>
          <Text style={styles.headerCloseText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        {renderSelectedSwapPreview()}

        <View style={styles.messageInputContainer}>
          <Text style={styles.messageInputLabel}>Message (Optional)</Text>
          <View style={{ position: 'relative', flex: 1 }}>
            <TextInput
              style={styles.messageInput}
              placeholder="Share your thoughts about this trade..."
              placeholderTextColor={COLORS.accessoryDarkColor}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={280}
              returnKeyType="done"
              textAlignVertical="top"
              autoFocus
              keyboardAppearance="dark"
            />
            {messageText.length > 0 && (
              <Text style={styles.characterCount}>
                {messageText.length}/280
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.messageInputBottomSection}>
        <TouchableOpacity
          style={styles.skipMessageButton}
          onPress={() => handleSharePastSwap(false)}
          disabled={loading}>
          <Text style={styles.skipMessageButtonText}>
            Share without message
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => handleSharePastSwap(true)}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.shareButtonText}>
              {messageText.trim() ? 'Share with Message' : 'Share Trade'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}>
      <View style={styles.flexFill}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.darkOverlay} />
        </TouchableWithoutFeedback>
        <View style={styles.centeredWrapper}>
          <Animated.View
            style={[
              styles.modalContentContainer,
              { transform: [{ translateY }] },
            ]}>
            <TouchableWithoutFeedback>
              <View style={{ flex: 1 }}>
                <View style={styles.dragHandle} />
                {currentScreen === 'SWAP_SELECTION'
                  ? renderSwapSelectionScreen()
                  : renderMessageInputScreen()
                }
                {!!resultMsg && (
                  <Text style={styles.resultText}>{resultMsg}</Text>
                )}
                {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
              </View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
});

export default ShareTradeModal;
