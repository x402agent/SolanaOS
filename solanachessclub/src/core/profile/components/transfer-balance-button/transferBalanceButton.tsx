import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableWithoutFeedback,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { styles, modalOverlayStyles } from './transferBalanceButton.style';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useReduxHooks';
import { Cluster, Connection, clusterApiUrl, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  sendSOL,
  sendToken,
  COMMISSION_PERCENTAGE,
} from '@/shared/services/transactions';
import { useWallet } from '@/modules/wallet-providers/hooks/useWallet';
import {
  setSelectedFeeTier as setFeeTier,
  setTransactionMode as setMode
} from '@/shared/state/transaction/reducer';
import { CLUSTER, HELIUS_STAKED_URL } from '@env';
import { TransactionService } from '@/modules/wallet-providers/services/transaction/transactionService';
import { TokenInfo, fetchTokenBalance, DEFAULT_SOL_TOKEN } from '@/modules/data-module';
import SelectTokenModal from '@/modules/swap/components/SelectTokenModal';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import { ENDPOINTS } from '@/shared/config/constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: windowHeight } = Dimensions.get('window');

export interface TransferBalanceButtonProps {
  amIFollowing?: boolean;
  areTheyFollowingMe?: boolean;
  onPressFollow?: () => void;
  onPressUnfollow?: () => void;
  onSendToWallet?: () => void;
  recipientAddress?: string;
  showOnlyTransferButton?: boolean;
  showCustomWalletInput?: boolean;
  buttonLabel?: string;
  externalModalVisible?: boolean;
  externalSetModalVisible?: (visible: boolean) => void;
}

const TransferBalanceButton: React.FC<TransferBalanceButtonProps> = ({
  amIFollowing = false,
  areTheyFollowingMe = false,
  onPressFollow = () => {},
  onPressUnfollow = () => {},
  onSendToWallet,
  recipientAddress = '',
  showOnlyTransferButton = false,
  showCustomWalletInput = false,
  buttonLabel = 'Send to Wallet',
  externalModalVisible,
  externalSetModalVisible,
}) => {
  const dispatch = useAppDispatch();
  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'jito' | 'priority' | null>(
    null,
  );
  const [selectedFeeTier, setSelectedFeeTier] = useState<
    'low' | 'medium' | 'high' | 'very-high'
  >('low');
  const [amountSol, setAmountSol] = useState('');
  const [transactionStatus, setTransactionStatus] = useState<string | null>(
    null,
  );
  const [customWalletAddress, setCustomWalletAddress] = useState(recipientAddress);
  const [walletAddressError, setWalletAddressError] = useState('');
  const [fetchingBalance, setFetchingBalance] = useState(false);
  
  // Token-related state
  const [selectedToken, setSelectedToken] = useState<TokenInfo>(() => {
    console.log('[TransferBalanceButton] Initializing with DEFAULT_SOL_TOKEN:', DEFAULT_SOL_TOKEN.symbol);
    return DEFAULT_SOL_TOKEN;
  });
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [currentTokenPrice, setCurrentTokenPrice] = useState<number | null>(null);
  const [showSelectTokenModal, setShowSelectTokenModal] = useState(false);
  const [loadingTokenData, setLoadingTokenData] = useState(false);

  // Debug: Log current selected token whenever it changes
  useEffect(() => {
    console.log('[TransferBalanceButton] Selected token changed to:', selectedToken?.symbol);
  }, [selectedToken]);

  const modalRef = useRef<View | null>(null);
  const keyboardAvoidingRef = useRef<KeyboardAvoidingView | null>(null);

  const currentProvider = useAppSelector(state => state.auth.provider);
  const transactionState = useAppSelector(state => state.transaction);

  const {wallet, address, isMWA} = useWallet();

  const insets = useSafeAreaInsets();

  // --- Drag-to-dismiss state ---
  const drawerTranslateY = useRef(new Animated.Value(windowHeight)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) {
          drawerTranslateY.setValue(dy);
        }
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 150 || vy > 0.5) {
          // Animate out (close)
          Animated.timing(drawerTranslateY, {
            toValue: windowHeight,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setSendModalVisible(false);
            drawerTranslateY.setValue(windowHeight);
          });
        } else {
          // Snap back to open
          Animated.timing(drawerTranslateY, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (sendModalVisible) {
      drawerTranslateY.setValue(0);
    } else {
      drawerTranslateY.setValue(windowHeight);
    }
  }, [sendModalVisible, drawerTranslateY]);

  useEffect(() => {
    if (externalModalVisible !== undefined && externalModalVisible !== sendModalVisible) {
      setSendModalVisible(externalModalVisible);
    }
  }, [externalModalVisible]);

  useEffect(() => {
    if (externalSetModalVisible) {
      externalSetModalVisible(sendModalVisible);
    }
  }, [sendModalVisible, externalSetModalVisible]);

  useEffect(() => {
    if (sendModalVisible) {
      setSelectedMode(transactionState.transactionMode);
      setSelectedFeeTier(transactionState.selectedFeeTier);
      setTransactionStatus(null);
      setWalletAddressError('');
      
      if (!showCustomWalletInput) {
        setCustomWalletAddress(recipientAddress);
      } else if (!customWalletAddress) {
        setCustomWalletAddress('');
      }
    }
  }, [sendModalVisible, transactionState, recipientAddress, showCustomWalletInput]);

  let followLabel = 'Follow';
  if (amIFollowing) {
    followLabel = 'Following';
  } else if (!amIFollowing && areTheyFollowingMe) {
    followLabel = 'Follow Back';
  }

  const handlePressFollowButton = () => {
    if (amIFollowing) {
      onPressUnfollow();
    } else {
      onPressFollow();
    }
  };

  const validateSolanaAddress = (address: string): boolean => {
    try {
      if (!address || address.trim() === '') return false;
      
      new PublicKey(address);
      return true;
    } catch (error) {
      return false;
    }
  };

  const handlePressSendToWallet = () => {
    if (!showCustomWalletInput && !recipientAddress) {
      Alert.alert('Error', 'No recipient address available');
      return;
    }

    if (onSendToWallet) {
      onSendToWallet();
    }

    setSendModalVisible(true);
  };

  const handleWalletAddressChange = (text: string) => {
    setCustomWalletAddress(text);
    setWalletAddressError('');
  };

  // Handle token selection
  const handleTokenSelected = useCallback((token: TokenInfo) => {
    console.log('[TransferBalanceButton] Token selected:', token.symbol);
    
    setSelectedToken(token);
    setShowSelectTokenModal(false);
    setAmountSol(''); // Reset amount when token changes
    setCurrentBalance(null); // Reset balance when token changes
  }, []); // Remove dependencies that cause stale closures

  const handleSendTransaction = async () => {
    try {
      if (!selectedMode) {
        Alert.alert('Error', "Please select 'Priority' or 'Jito' first.");
        return;
      }

      const finalRecipientAddress = showCustomWalletInput ? customWalletAddress : recipientAddress;
      
      if (!validateSolanaAddress(finalRecipientAddress)) {
        setWalletAddressError('Please enter a valid Solana wallet address');
        return;
      }

      if (!finalRecipientAddress || !amountSol) {
        Alert.alert('Error', 'Please provide recipient address and amount.');
        return;
      }
      
      const parsedAmount = parseFloat(amountSol);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        Alert.alert('Error', `Invalid ${selectedToken.symbol} amount.`);
        return;
      }

      if (!wallet) {
        Alert.alert('Error', 'Wallet not connected');
        return;
      }

      if (!selectedToken) {
        Alert.alert('Error', 'No token selected');
        return;
      }

      if (selectedMode) {
        dispatch(setMode(selectedMode));

        if (selectedMode === 'priority' && selectedFeeTier) {
          dispatch(setFeeTier(selectedFeeTier));
        }
      }
      
      const rpcUrl =
        HELIUS_STAKED_URL ||
        ENDPOINTS.helius ||
        clusterApiUrl(CLUSTER as Cluster);
      const connection = new Connection(rpcUrl, 'confirmed');

      setTransactionStatus('Preparing transaction...');

      const signature = await sendToken({
        wallet,
        recipientAddress: finalRecipientAddress,
        amount: parsedAmount,
        tokenInfo: selectedToken,
        connection,
        onStatusUpdate: status => {
          if (!status.startsWith('Error:')) {
            console.log(`[TransferBalanceButton] ${status}`);
            setTransactionStatus(status);
          } else {
            setTransactionStatus('Processing transaction...');
          }
        },
      });

      console.log(`[TransferBalanceButton] sendToken returned signature: ${signature}`);

      setTimeout(() => {
        setSendModalVisible(false);
        setSelectedMode(null);
        setAmountSol('');
        setTransactionStatus(null);
        if (showCustomWalletInput) {
          setCustomWalletAddress('');
        }
      }, 3000);
    } catch (err: any) {
      console.error('Error during transaction initiation:', err);

      setTransactionStatus('Transaction failed');

      TransactionService.showError(err);

      setTimeout(() => {
        setSendModalVisible(false);
        setSelectedMode(null);
        setAmountSol('');
        setTransactionStatus(null);
      }, 2000);
    }
  };

  // Use refs to prevent re-rendering loops
  const fetchingRef = useRef(false);
  const lastFetchRef = useRef<{ wallet: string | null; token: TokenInfo | null }>({ wallet: null, token: null });

  // Manual fetch for specific cases (like MAX button)
  const fetchTokenBalanceData = async () => {
    if (!wallet || !selectedToken || fetchingRef.current) {
      return;
    }

    try {
      fetchingRef.current = true;
      setLoadingTokenData(true);
      
      const addr = (wallet as any).address || (wallet as any).publicKey;
      if (!addr) {
        console.error('No wallet address available');
        return;
      }

      const walletAddrString = typeof addr === 'string' ? addr : addr.toString();
      const publicKey = typeof addr === 'string' 
        ? new PublicKey(addr)
        : addr;
        
      const balance = await fetchTokenBalance(publicKey, selectedToken);
      setCurrentBalance(balance);
      
      // For price, we can use the price from token info if available
      if (selectedToken.price !== undefined) {
        setCurrentTokenPrice(selectedToken.price);
      }

      // Update last fetch reference
      lastFetchRef.current = { wallet: walletAddrString, token: selectedToken };
      
    } catch (error) {
      console.error('Error fetching token balance:', error);
      setCurrentBalance(0);
    } finally {
      setLoadingTokenData(false);
      fetchingRef.current = false;
    }
  };

  const fetchMaxBalance = async () => {
    console.log('[TransferBalanceButton] MAX clicked for token:', selectedToken?.symbol);
    
    if (!wallet || !selectedToken) {
      Alert.alert('Error', 'Wallet or token not available');
      return;
    }

    try {
      setFetchingBalance(true);
      
      // Get fresh balance
      const addr = (wallet as any).address || (wallet as any).publicKey;
      if (!addr) {
        Alert.alert('Error', 'No wallet address available');
        setFetchingBalance(false);
        return;
      }

      const publicKey = typeof addr === 'string' ? new PublicKey(addr) : addr;
      const freshBalance = await fetchTokenBalance(publicKey, selectedToken);
      
      console.log('[TransferBalanceButton] MAX balance for', selectedToken.symbol, ':', freshBalance);
      
      if (!freshBalance || freshBalance <= 0) {
        Alert.alert('Insufficient Balance', `Your wallet does not have enough ${selectedToken.symbol} to transfer.`);
        setFetchingBalance(false);
        return;
      }

      // Update the current balance state with fresh data
      setCurrentBalance(freshBalance);
      
      // For SOL, reserve some for fees
      let maxTransferAmount = freshBalance;
      if (selectedToken.symbol === 'SOL' || 
          selectedToken.address === 'So11111111111111111111111111111111111111112') {
        maxTransferAmount = Math.max(0, freshBalance - 0.001); // Reserve 0.001 SOL for fees
      }
      
      if (maxTransferAmount <= 0) {
        Alert.alert('Insufficient Balance', `Your wallet does not have enough ${selectedToken.symbol} to transfer after fees.`);
        setFetchingBalance(false);
        return;
      }
      
      const formattedAmount = maxTransferAmount.toFixed(Math.min(9, maxTransferAmount.toString().split('.')[1]?.length || 9));
      setAmountSol(formattedAmount);
      
      setFetchingBalance(false);
    } catch (error) {
      console.error('[TransferBalanceButton] Error setting max balance:', error);
      Alert.alert('Error', 'Failed to set max balance. Please try again.');
      setFetchingBalance(false);
    }
  };

  // Memoize wallet address to prevent unnecessary re-renders
  const walletAddress = useMemo(() => {
    if (!wallet) return null;
    const addr = (wallet as any).address || (wallet as any).publicKey;
    if (!addr) return null;
    return typeof addr === 'string' ? addr : addr.toString();
  }, [wallet]);

  // Fetch token balance when selected token or wallet address changes
  useEffect(() => {
    if (!selectedToken || !walletAddress || fetchingRef.current) {
      return;
    }

    // Prevent duplicate fetches for the same wallet/token combination
    const lastFetch = lastFetchRef.current;
    if (lastFetch.wallet === walletAddress && 
        lastFetch.token?.address === selectedToken.address) {
      return;
    }

    const fetchBalance = async () => {
      try {
        fetchingRef.current = true;
        setLoadingTokenData(true);
        
        const publicKey = typeof walletAddress === 'string' 
          ? new PublicKey(walletAddress)
          : walletAddress;
          
        const balance = await fetchTokenBalance(publicKey, selectedToken);
        setCurrentBalance(balance);
        
        // For price, we can use the price from token info if available
        if (selectedToken.price !== undefined) {
          setCurrentTokenPrice(selectedToken.price);
        }

        // Update last fetch reference
        lastFetchRef.current = { wallet: walletAddress, token: selectedToken };
        
      } catch (error) {
        console.error('[TransferBalanceButton] Error fetching token balance:', error);
        setCurrentBalance(0);
      } finally {
        setLoadingTokenData(false);
        fetchingRef.current = false;
      }
    };

    fetchBalance();
  }, [selectedToken?.address, walletAddress]); // Only depend on token address and wallet address

  const showSendToWalletButton =
    (currentProvider === 'privy' ||
    currentProvider === 'dynamic' ||
    currentProvider === 'mwa') && !showOnlyTransferButton;

  return (
    <View style={styles.container}>
      {!showOnlyTransferButton && (
        <TouchableOpacity style={styles.btn} onPress={handlePressFollowButton}>
          <Text style={styles.text}>{followLabel}</Text>
        </TouchableOpacity>
      )}

      {(showSendToWalletButton || showOnlyTransferButton) && (
        <TouchableOpacity 
          style={[styles.btn, showOnlyTransferButton && styles.fullWidthBtn]} 
          onPress={handlePressSendToWallet}
        >
          <Text style={styles.text}>{buttonLabel}</Text>
        </TouchableOpacity>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={sendModalVisible}
        onRequestClose={() => setSendModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setSendModalVisible(false)}>
          <View style={modalOverlayStyles.overlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
              ref={keyboardAvoidingRef}
            >
              <TouchableWithoutFeedback onPress={() => {}}>
                <Animated.View
                  style={[
                    modalOverlayStyles.drawerContainer,
                    { paddingBottom: insets.bottom, transform: [{ translateY: drawerTranslateY }] },
                  ]}
                  ref={modalRef}
                >
                  <View
                    style={modalOverlayStyles.dragHandle}
                    {...panResponder.panHandlers}
                  />
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={modalOverlayStyles.scrollContent}
                  >
                    <Text style={modalOverlayStyles.title}>Send {selectedToken.symbol}</Text>

                    {/* Token Selection Row */}
                    <TouchableOpacity
                      style={modalOverlayStyles.tokenRow}
                      onPress={() => setShowSelectTokenModal(true)}
                    >
                      {selectedToken.logoURI ? (
                        <Image source={{ uri: selectedToken.logoURI }} style={modalOverlayStyles.tokenIcon} />
                      ) : (
                        <View style={[modalOverlayStyles.tokenIcon, { backgroundColor: COLORS.lighterBackground, justifyContent: 'center', alignItems: 'center' }]}>
                          <Text style={{ color: COLORS.white, fontWeight: 'bold', fontSize: 10 }}>
                            {selectedToken.symbol?.charAt(0) || '?'}
                          </Text>
                        </View>
                      )}
                      <View style={modalOverlayStyles.tokenInfo}>
                        <Text style={modalOverlayStyles.tokenSymbol} numberOfLines={1} ellipsizeMode="tail">
                          {selectedToken.symbol}
                        </Text>
                        {currentBalance !== null && (
                          <Text style={modalOverlayStyles.tokenBalance} numberOfLines={1} ellipsizeMode="tail">
                            Balance: {currentBalance.toFixed(6)} {selectedToken.symbol}
                          </Text>
                        )}
                        {loadingTokenData && (
                          <Text style={modalOverlayStyles.tokenBalance}>Loading balance...</Text>
                        )}
                      </View>
                      <View style={modalOverlayStyles.changeTokenButton}>
                        <Text style={modalOverlayStyles.changeTokenText}>Change</Text>
                      </View>
                    </TouchableOpacity>

                    {showCustomWalletInput && (
                      <View style={modalOverlayStyles.inputContainer}>
                        <Text style={modalOverlayStyles.label}>Recipient Wallet Address</Text>
                        <TextInput
                          style={[modalOverlayStyles.input, walletAddressError ? modalOverlayStyles.inputError : null]}
                          value={customWalletAddress}
                          onChangeText={handleWalletAddressChange}
                          placeholder="Enter Solana wallet address"
                          placeholderTextColor={COLORS.textHint}
                        />
                        {walletAddressError ? (
                          <Text style={modalOverlayStyles.errorText}>{walletAddressError}</Text>
                        ) : null}
                      </View>
                    )}

                    <View style={modalOverlayStyles.modeContainer}>
                      <View style={modalOverlayStyles.buttonRow}>
                        <TouchableOpacity
                          style={[
                            modalOverlayStyles.modeButton,
                            selectedMode === 'priority' &&
                              modalOverlayStyles.selectedBtn,
                          ]}
                          onPress={() => setSelectedMode('priority')}>
                          <Text
                            style={[
                              modalOverlayStyles.modeButtonText,
                              selectedMode === 'priority' &&
                                modalOverlayStyles.selectedBtnText,
                            ]}>
                            Priority
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            modalOverlayStyles.modeButton,
                            selectedMode === 'jito' && modalOverlayStyles.selectedBtn,
                          ]}
                          onPress={() => setSelectedMode('jito')}>
                          <Text
                            style={[
                              modalOverlayStyles.modeButtonText,
                              selectedMode === 'jito' &&
                                modalOverlayStyles.selectedBtnText,
                            ]}>
                            Jito
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {selectedMode === 'priority' && (
                      <View style={modalOverlayStyles.tierContainer}>
                        <Text style={modalOverlayStyles.sectionTitle}>
                          Priority Fee Tier:
                        </Text>
                        <View style={modalOverlayStyles.tierButtonRow}>
                          {(['low', 'medium', 'high', 'very-high'] as const).map(
                            tier => (
                              <TouchableOpacity
                                key={tier}
                                style={[
                                  modalOverlayStyles.tierButton,
                                  selectedFeeTier === tier &&
                                    modalOverlayStyles.selectedBtn,
                                ]}
                                onPress={() => setSelectedFeeTier(tier)}>
                                <Text
                                  style={[
                                    modalOverlayStyles.tierButtonText,
                                    selectedFeeTier === tier &&
                                      modalOverlayStyles.selectedBtnText,
                                  ]}>
                                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                                </Text>
                              </TouchableOpacity>
                            ),
                          )}
                        </View>
                      </View>
                    )}

                    <View style={modalOverlayStyles.inputContainer}>
                      <View style={modalOverlayStyles.amountLabelRow}>
                        <Text style={modalOverlayStyles.label}>Amount ({selectedToken.symbol})</Text>
                        <TouchableOpacity 
                          style={modalOverlayStyles.maxButton}
                          onPress={fetchMaxBalance}
                          disabled={fetchingBalance}
                        >
                          {fetchingBalance ? (
                            <ActivityIndicator size="small" color={COLORS.white} />
                          ) : (
                            <Text style={modalOverlayStyles.maxButtonText}>MAX</Text>
                          )}
                        </TouchableOpacity>
                      </View>

                      {selectedToken.symbol === 'SOL' && (
                        <View style={modalOverlayStyles.presetButtonsRow}>
                          <TouchableOpacity
                            style={modalOverlayStyles.presetButton}
                            onPress={() => setAmountSol('1')}>
                            <Text style={modalOverlayStyles.presetButtonText}>
                              1 SOL
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={modalOverlayStyles.presetButton}
                            onPress={() => setAmountSol('5')}>
                            <Text style={modalOverlayStyles.presetButtonText}>
                              5 SOL
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={modalOverlayStyles.presetButton}
                            onPress={() => setAmountSol('10')}>
                            <Text style={modalOverlayStyles.presetButtonText}>
                              10 SOL
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      <View style={modalOverlayStyles.amountControlContainer}>
                        <TouchableOpacity
                          style={modalOverlayStyles.controlButton}
                          onPress={() => {
                            const currentVal = parseFloat(amountSol) || 0;
                            if (currentVal > 0) {
                              setAmountSol((currentVal - 1).toString());
                            }
                          }}>
                          <Text style={modalOverlayStyles.controlButtonText}>−</Text>
                        </TouchableOpacity>

                        <TextInput
                          style={modalOverlayStyles.amountInput}
                          value={amountSol}
                          onChangeText={setAmountSol}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={COLORS.textHint}
                          textAlign="center"
                        />

                        <TouchableOpacity
                          style={modalOverlayStyles.controlButton}
                          onPress={() => {
                            const currentVal = parseFloat(amountSol) || 0;
                            setAmountSol((currentVal + 1).toString());
                          }}>
                          <Text style={modalOverlayStyles.controlButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {transactionStatus && (
                      <View style={modalOverlayStyles.statusContainer}>
                        <Text style={modalOverlayStyles.statusText}>
                          {transactionStatus}
                        </Text>
                      </View>
                    )}

                    {/* Action Buttons moved inside ScrollView */}
                    <View style={[modalOverlayStyles.buttonRow, { marginTop: 24 }]}>
                      <TouchableOpacity
                        style={[
                          modalOverlayStyles.modalButton,
                          {backgroundColor: COLORS.lightBackground},
                        ]}
                        onPress={() => setSendModalVisible(false)}
                        disabled={
                          !!transactionStatus && !transactionStatus.includes('Error')
                        }>
                        <Text style={modalOverlayStyles.modalButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          modalOverlayStyles.modalButton,
                          {backgroundColor: COLORS.brandBlue},
                          !!transactionStatus && {opacity: 0.5},
                        ]}
                        onPress={handleSendTransaction}
                        disabled={!!transactionStatus}>
                        <Text style={modalOverlayStyles.modalButtonText}>Send</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </Animated.View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Token Selection Modal */}
      <SelectTokenModal
        visible={showSelectTokenModal}
        onClose={() => setShowSelectTokenModal(false)}
        onTokenSelected={handleTokenSelected}
      />
    </View>
  );
};

export default TransferBalanceButton;
