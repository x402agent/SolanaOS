import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
  Dimensions,
  Linking,
} from 'react-native';
import { Connection, PublicKey } from '@solana/web3.js';
import { HELIUS_STAKED_URL, SERVER_URL } from '@env';
import { useWallet } from '@/modules/wallet-providers/hooks/useWallet';
import COLORS from '@/assets/colors';
import Icons from '@/assets/svgs';
import { Keypad } from '@/modules/swap/components/SwapComponents';
import { fetchTokenBalance } from '@/modules/data-module/services/tokenService';
import { TokenInfo } from '@/modules/data-module/types/tokenTypes';
import Slider from '@react-native-community/slider';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useReduxHooks';
import { showSuccessNotification, showErrorNotification } from '@/shared/state/notification/reducer';
import TYPOGRAPHY from '@/assets/typography';

const connection = new Connection(
  HELIUS_STAKED_URL || 'https://api.mainnet-beta.solana.com',
  'confirmed'
);

const LuloRebalancingYieldCard = () => {
  const { address, connected, sendBase64Transaction } = useWallet();
  const dispatch = useAppDispatch();
  const [modalContent, setModalContent] = useState<'hidden' | 'details' | 'amount' | 'pending_list'>('hidden');
  const [isProcessingTransaction, setIsProcessingTransaction] = useState(false);

  // Lulo data states
  const [luloApy, setLuloApy] = useState<{
    regular: {
      CURRENT: number;
      '1HR': number;
      '1YR': number;
      '24HR': number;
      '30DAY': number;
      '7DAY': number;
    };
    protected: {
      CURRENT: number;
      '1HR': number;
      '1YR': number;
      '24HR': number;
      '30DAY': number;
      '7DAY': number;
    };
  } | null>(null);
  const [luloBalance, setLuloBalance] = useState<number>(0);
  const [luloLoading, setLuloLoading] = useState(false);
  const mountedRef = useRef(true);
  const [modalType, setModalType] = useState<'deposit' | 'withdraw' | null>(null);
  const [amount, setAmount] = useState('');
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [autoCompleteAlertShown, setAutoCompleteAlertShown] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [sliderValue, setSliderValue] = useState(0);

  const USDC_TOKEN_INFO: TokenInfo = {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
  };

  const fetchUSDCBalance = useCallback(async () => {
    if (!address) return;
    try {
      const balance = await fetchTokenBalance(new PublicKey(address), USDC_TOKEN_INFO);
      if (mountedRef.current) {
        setUsdcBalance(balance);
      }
    } catch (e) {
      console.error('Failed to fetch USDC balance', e);
      if (mountedRef.current) {
        setUsdcBalance(0);
      }
    }
  }, [address]);

  const fetchPendingWithdrawals = useCallback(async () => {
    if (!address) return;
    try {
      const url = `${SERVER_URL}/api/lulo/pending-withdrawals/${address}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.withdrawals)) {
        setPendingWithdrawals(json.withdrawals);
      } else {
        setPendingWithdrawals([]);
      }
    } catch (e) {
      setPendingWithdrawals([]);
    }
  }, [address]);

  // Fetch Lulo data
  const fetchLuloData = useCallback(async () => {
    if (!address) return;
    setLuloLoading(true);
    try {
      const apyRes = await fetch(`${SERVER_URL}/api/lulo/apy`);
      const apyJson = await apyRes.json();
      if (apyJson.success) setLuloApy(apyJson.apy);

      const balRes = await fetch(`${SERVER_URL}/api/lulo/balance/${address}`);
      const balJson = await balRes.json();
      if (balJson.success) setLuloBalance(balJson.balance?.totalUsdValue ?? 0);
    } catch (e) {
      dispatch(showErrorNotification({ message: 'Failed to fetch Lulo data.' }));
    } finally {
      setLuloLoading(false);
    }
  }, [address, dispatch]);

  const handleCompleteWithdraw = useCallback(async (withdrawalToComplete: any) => {
    if (!address || !withdrawalToComplete?.nativeAmount) {
      dispatch(showErrorNotification({ message: 'No pending withdrawal amount found to complete.' }));
      return;
    }

    setIsProcessingTransaction(true);
    try {
      // Complete withdraw
      const res = await fetch(`${SERVER_URL}/api/lulo/complete-withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPublicKey: address,
          amount: withdrawalToComplete.nativeAmount,
        })
      });
      if (!mountedRef.current) return;

      const data = await res.json();
      if (!mountedRef.current) return;

      if (!data.success || !data.transaction) {
        throw new Error(data.error || 'Failed to get transaction for complete withdraw');
      }

      dispatch(showSuccessNotification({ message: 'Please approve the transaction in your wallet to complete the withdrawal.' }));

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Transaction approval timed out. Please try again.')), 30000)
      );

      const transactionPromise = sendBase64Transaction(data.transaction, connection);
      const signature = await Promise.race([transactionPromise, timeoutPromise]);

      if (!mountedRef.current) return;

      if (signature) {
          // Update UI
          await fetchLuloData();
          if (!mountedRef.current) return;
          await fetchPendingWithdrawals();
          if (!mountedRef.current) return;

          setModalContent('details'); // Go back to details
          dispatch(showSuccessNotification({ message: 'Your withdrawal has been completed successfully.' }));
      }

    } catch (e: any) {
      if (mountedRef.current) {
        if (e.message.includes('timeout')) {
            dispatch(showErrorNotification({ message: 'Transaction approval timed out. Please try again and make sure to approve the transaction in your wallet.' }));
        } else {
            dispatch(showErrorNotification({ message: e.message || 'Withdraw completion failed. Please try again.' }));
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsProcessingTransaction(false);
      }
    }
  }, [address, fetchLuloData, fetchPendingWithdrawals, sendBase64Transaction, dispatch]);

  const getWithdrawCountdown = useCallback((withdrawal: any) => {
    if (!withdrawal?.createdTimestamp) return { total: -1, text: null };
    
    const now = Date.now() / 1000;
    const secondsLeft = (24 * 3600) - (now - withdrawal.createdTimestamp);

    if (secondsLeft <= 0) return { total: 0, text: null };

    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    
    return { total: secondsLeft, text: `${hours}h ${minutes}m remaining` };
  }, []);

  // All useEffects moved here to ensure dependencies are declared first.
  useEffect(() => {
    if (address) {
      fetchLuloData();
      fetchUSDCBalance();
    }
  }, [address, fetchLuloData, fetchUSDCBalance]);

  useEffect(() => {
    if (modalContent === 'details') {
      fetchLuloData();
      fetchPendingWithdrawals();
      setAutoCompleteAlertShown(false); // Reset alert flag when modal opens
    }
    if (modalContent === 'amount') {
      fetchUSDCBalance();
    }
  }, [modalContent, fetchLuloData, fetchPendingWithdrawals, fetchUSDCBalance]);

  useEffect(() => {
    const { total: countdownTotal } = getWithdrawCountdown(pendingWithdrawals[0]);
    if (pendingWithdrawals.length > 0 && countdownTotal === 0 && !autoCompleteAlertShown) {
      Alert.alert(
        "Complete Withdrawal",
        "Your pending withdrawal is ready to be completed. Press OK to proceed.",
        [{ text: "OK", onPress: () => handleCompleteWithdraw(pendingWithdrawals[0])}]
      );
      setAutoCompleteAlertShown(true);
    }
  }, [pendingWithdrawals, autoCompleteAlertShown, getWithdrawCountdown, handleCompleteWithdraw]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const openAmountScreen = (type: 'deposit' | 'withdraw') => {
    setModalType(type);
    setAmount('');
    setModalContent('amount');
  };

  const closeModals = () => {
    setModalContent('hidden');
    setModalType(null);
  };

  const handleKeyPress = (key: string) => {
    if (isProcessingTransaction) return;

    if (key === 'delete') {
      setAmount(prev => (prev.length > 0 ? prev.slice(0, -1) : ''));
    } else if (key === '.') {
      if (!amount.includes('.')) {
        setAmount(prev => (prev === '' ? '0.' : prev + '.'));
      }
    } else if (amount === '0' && key !== '.') {
      setAmount(key);
    } else {
      if (amount.includes('.') && amount.split('.')[1].length >= 2) return;
      setAmount(prev => prev + key);
    }
  };

  const handlePercentageSelect = (percentage: number) => {
    const balance = modalType === 'deposit' ? usdcBalance : luloBalance;
    if (balance === null) return;
    const value = balance * percentage;
    setAmount(value.toFixed(2));
    setSliderValue(percentage);
  };

  // Handle deposit
  const handleDeposit = async () => {
    const depositValue = parseFloat(amount);
    if (!address || !amount || isNaN(depositValue) || depositValue <= 0) {
      dispatch(showErrorNotification({ message: 'Please enter a valid deposit amount.' }));
      return;
    }

    if (!connected) {
      dispatch(showErrorNotification({ message: 'Please connect your wallet first.' }));
      return;
    }

    setIsProcessingTransaction(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/lulo/lend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPublicKey: address, amount: depositValue })
      });
      
      console.log('res', res);

      if (!mountedRef.current) return;
      const data = await res.json();
      if (!mountedRef.current) return;

      if (!data.success || !data.transaction) {
        throw new Error(data.error || 'Failed to get transaction for deposit');
      }

      console.log('data', data);

      dispatch(showSuccessNotification({ message: 'Please approve the transaction to deposit.' }));
      if (!mountedRef.current) return;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Transaction approval timed out. Please try again.')), 30000)
      );

      const transactionPromise = sendBase64Transaction(data.transaction, connection);
      const signature = await Promise.race([transactionPromise, timeoutPromise]);

      if (!mountedRef.current) return;
      if (signature) {
        await fetchLuloData();
        if (!mountedRef.current) return;
        dispatch(showSuccessNotification({ message: 'Your deposit has been processed successfully.' }));
        setModalContent('details');
        setAmount('');
      }
    } catch (e) {
      if (mountedRef.current) {
        if (e instanceof Error) {
          if (e.message.includes('timeout')) {
            dispatch(showErrorNotification({ message: 'Transaction approval timed out. Please try again and make sure to approve the transaction in your wallet.' }));
          } else if (e.message.includes('wallets:connect')) {
            dispatch(showErrorNotification({ message: 'Wallet connection lost. Please reconnect your wallet and try again.' }));
          } else {
            dispatch(showErrorNotification({ message: e.message || 'Deposit failed. Please try again.' }));
          }
        } else {
          dispatch(showErrorNotification({ message: 'An unknown error occurred during deposit. Please try again.' }));
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsProcessingTransaction(false);
      }
    }
  };

  const handleInitiateWithdraw = async () => {
    const withdrawValue = parseFloat(amount);
    if (!address || !amount || isNaN(withdrawValue) || withdrawValue <= 0) {
      dispatch(showErrorNotification({ message: 'Please enter a valid withdrawal amount.' }));
      return;
    }
    if (withdrawValue < 1) {
      dispatch(showErrorNotification({ message: 'Withdrawal amount must be at least 1 USDC.' }));
      return;
    }

    setIsProcessingTransaction(true);
    try {
      const res1 = await fetch(`${SERVER_URL}/api/lulo/initiate-withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPublicKey: address, amount: withdrawValue })
      });

      if (!mountedRef.current) return;
      const data1 = await res1.json();
      
      if (!data1.success || !data1.transaction) {
        throw new Error(data1.error || 'Failed to get transaction for initiate withdraw');
      }

      dispatch(showSuccessNotification({ message: 'Please approve the transaction to initiate withdrawal.' }));
      if (!mountedRef.current) return;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Transaction approval timed out. Please try again.')), 30000)
      );

      const transactionPromise = sendBase64Transaction(data1.transaction, connection);
      const signature = await Promise.race([transactionPromise, timeoutPromise]);

      if (!mountedRef.current) return;
      if (signature) {
        await fetchLuloData();
        if (!mountedRef.current) return;
        await fetchPendingWithdrawals();
        if (!mountedRef.current) return;
        dispatch(showSuccessNotification({ message: 'Your withdrawal has been initiated. You must wait 24 hours to complete it.' }));
        setModalContent('details');
        setAmount('');
      }
    } catch (e: any) {
      if (mountedRef.current) {
        if (e.message.includes('timeout')) {
          dispatch(showErrorNotification({ message: 'Transaction approval timed out. Please try again and make sure to approve the transaction in your wallet.' }));
        } else {
          dispatch(showErrorNotification({ message: e.message || 'Withdraw initiation failed. Please try again.' }));
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsProcessingTransaction(false);
      }
    }
  };

  const renderModalContent = () => {
    if (modalContent === 'details') {
      const firstPending = pendingWithdrawals.length > 0 ? pendingWithdrawals[0] : null;
      const countdown = getWithdrawCountdown(firstPending);

      return (
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={closeModals}
              style={styles.backButton}
            >
              <Icons.ArrowLeft width={24} height={24} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Rebalancing Yield</Text>
            <View style={styles.providerContainer}>
              <Text style={styles.providedByText}>Provided by</Text>
              <Image
                source={require('@/assets/images/lulolog.jpg')}
                style={styles.providerLogo}
                resizeMode="contain"
              />
              <Text style={styles.providerName}>Lulo</Text>
            </View>
          </View>

          <ScrollView 
            style={styles.modalScroll}
            contentContainerStyle={styles.scrollContent}
          >
            {/* See how it works section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>See how it works</Text>
              <View style={styles.simulationCard}>
                <Text style={styles.depositLabel}>You Deposit</Text>
                <View style={styles.amountContainer}>
                  <Icons.CryptoIcon width={32} height={32} color={COLORS.brandBlue} />
                  <Text style={styles.amountInput}>
                    {luloLoading
                      ? <ActivityIndicator size="small" color={COLORS.white} />
                      : getBalanceText()
                    }
                  </Text>
                </View>
                <View style={styles.yieldBadge}>
                  <Text style={styles.yieldText}>
                    Simulated Yield {luloApy?.protected?.CURRENT ? `${luloApy.protected.CURRENT.toFixed(2)}%` : '0.00%'}
                  </Text>
                </View>
                <View style={styles.balanceContainer}>
                  <Text style={styles.balanceLabel}>Your Balance</Text>
                  <Text style={styles.balanceValue}>
                    {luloLoading
                      ? <ActivityIndicator size="small" color={COLORS.white} />
                      : getBalanceText()
                    }
                  </Text>
                </View>

                {pendingWithdrawals.length > 0 && (
                  <TouchableOpacity
                    style={styles.pendingWithdrawalsButton}
                    onPress={() => setModalContent('pending_list')}
                  >
                    <Text style={styles.pendingWithdrawalsButtonText}>
                      View Pending Withdrawals ({pendingWithdrawals.length})
                    </Text>
                  </TouchableOpacity>
                )}
                
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                  <TouchableOpacity
                    style={styles.withdrawButton}
                    onPress={() => openAmountScreen('withdraw')}
                  >
                    <Text style={styles.actionButtonText}>Withdraw</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.depositButton}
                    onPress={() => openAmountScreen('deposit')}
                  >
                    <Text style={styles.actionButtonText}>Deposit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Available pools section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Available pools</Text>
              <View style={styles.poolCard}>
                <View style={styles.poolInfo}>
                  <Icons.CryptoIcon width={24} height={24} color={COLORS.brandBlue} />
                  <Text style={styles.poolName}>USDC</Text>
                </View>
                <Text style={styles.apyText}>
                  APY <Text style={styles.apyValue}>
                    {luloApy?.protected?.CURRENT ? `${luloApy.protected.CURRENT.toFixed(2)}%` : '0.00%'}
                  </Text>
                </Text>
              </View>
            </View>

            {/* Powered by Lulo section */}
            <View style={styles.poweredByContainer}>
              <View style={styles.poweredByLine}>
                <Text style={styles.poweredByText}>Powered by </Text>
                <TouchableOpacity onPress={() => Linking.openURL('https://lulo.fi').catch(err => console.error("Couldn't load page", err))}>
                  <Text style={styles.luloLinkText}>Lulo</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.poweredBySubtitle}>
                Best yields, dynamically rebalanced across Solana yield protocols.
              </Text>
            </View>

            {/* Add bottom padding to account for fixed button */}
            <View style={styles.bottomPadding} />
          </ScrollView>

          {/* Fixed Deposit Button */}
          <View style={styles.fixedButtonContainer}>
          </View>
        </View>
      );
    }

    if (modalContent === 'amount') {
      const balance = modalType === 'deposit' ? usdcBalance : luloBalance;

      return (
        <View style={styles.amountModalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setModalContent('details')}
              style={styles.backButton}
            >
              <Icons.ArrowLeft width={24} height={24} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{modalType === 'deposit' ? 'Deposit' : 'Withdraw'}</Text>
            <View style={styles.providerContainer}>
               <Image
                source={require('@/assets/images/lulolog.jpg')}
                style={styles.providerLogo}
                resizeMode="contain"
              />
              <Text style={styles.providerName}>Rebalancing Yield</Text>
            </View>
          </View>
          
          <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
            <View style={styles.amountDisplayContainer}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Icons.CryptoIcon width={32} height={32} color={COLORS.brandBlue} />
                <Text style={styles.usdcText}>USDC</Text>
              </View>
              <Text style={styles.amountText} numberOfLines={1} adjustsFontSizeToFit>{amount || '0'}</Text>
              <View style={styles.maxButtonContainer}>
                <TouchableOpacity style={styles.maxButton} onPress={() => handlePercentageSelect(1)}>
                  <Text style={styles.maxButtonText}>MAX</Text>
                </TouchableOpacity>
                <Text style={styles.balanceText}>
                  {balance !== null ? `Balance: ${balance.toFixed(4)}` : <ActivityIndicator size="small" color={COLORS.greyMid} />}
                </Text>
              </View>
            </View>

            <View style={styles.sliderContainer}>
              <Slider
                style={{width: '100%', height: 40}}
                minimumValue={0}
                maximumValue={1}
                value={sliderValue}
                onValueChange={(value) => {
                  const balance = modalType === 'deposit' ? usdcBalance : luloBalance;
                  if (balance !== null) {
                    setAmount((balance * value).toFixed(2));
                  }
                  setSliderValue(value);
                }}
                minimumTrackTintColor={COLORS.brandBlue}
                maximumTrackTintColor={COLORS.greyDark}
                thumbTintColor="transparent"
              />
              <View style={styles.sliderTrack}>
                {[...Array(21)].map((_, i) => (
                  <View key={i} style={[styles.tick, i % 5 === 0 ? styles.majorTick : styles.minorTick]} />
                ))}
              </View>
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderText}>0%</Text>
                <Text style={styles.sliderText}>25%</Text>
                <Text style={styles.sliderText}>50%</Text>
                <Text style={styles.sliderText}>75%</Text>
                <Text style={styles.sliderText}>100%</Text>
              </View>
            </View>
            <View style={{flex: 1}} />
          </ScrollView>

          <View style={styles.bottomContainer}>
             <TouchableOpacity
              style={[
                styles.confirmButton,
                { backgroundColor: modalType === 'deposit' ? '#049FB4' : COLORS.errorRed },
                (isProcessingTransaction || !amount) && styles.disabledButton
              ]}
              onPress={() => {
                if (modalType === 'deposit') handleDeposit();
                else handleInitiateWithdraw();
              }}
              disabled={isProcessingTransaction || !amount}
            >
              {isProcessingTransaction ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.actionButtonText}>{modalType === 'deposit' ? 'Deposit' : 'Initiate Withdraw'}</Text>}
            </TouchableOpacity>
            <Keypad onKeyPress={handleKeyPress} />
          </View>
        </View>
      );
    }

    if (modalContent === 'pending_list') {
      return (
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setModalContent('details')}
              style={styles.backButton}
            >
              <Icons.ArrowLeft width={24} height={24} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Pending Withdrawals</Text>
            <View style={{ width: 24 }} />
          </View>

          <FlatList
            data={pendingWithdrawals}
            keyExtractor={(item) => item.withdrawalId.toString()}
            renderItem={({ item }) => {
              const countdown = getWithdrawCountdown(item);
              const isReady = countdown.total === 0;
              const date = new Date(item.createdTimestamp * 1000);
              const formattedDate = `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
              const formattedAmount = (parseInt(item.nativeAmount) / 1_000_000).toFixed(2);

              return (
                <View style={styles.withdrawalItem}>
                  <View>
                    <Text style={styles.withdrawalAmount}>${formattedAmount} USDC</Text>
                    <Text style={styles.withdrawalDate}>Initiated: {formattedDate}</Text>
                  </View>
                  <View>
                    {isReady ? (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.completeButton, { paddingVertical: 8, marginTop: 0 }]}
                        onPress={() => handleCompleteWithdraw(item)}
                        disabled={isProcessingTransaction}
                      >
                        <Text style={styles.actionButtonText}>
                          {isProcessingTransaction ? '...' : 'Complete'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.countdownText}>{countdown.text}</Text>
                    )}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: COLORS.greyDark, fontSize: 16 }}>No pending withdrawals.</Text>
              </View>
            }
          />
        </View>
      );
    }
    return null;
  };

  const getBalanceText = () => {
    if (luloLoading) {
      return <ActivityIndicator size="small" color={COLORS.white} />;
    }
    return `$${luloBalance.toFixed(2)}`;
  };

  return (
    <>
      <TouchableOpacity 
        style={styles.actionButton}
        onPress={() => setModalContent('details')}
      >
        <View style={styles.actionIconContainer}>
          <View style={styles.logoBox}>
            <Image
              source={require('@/assets/images/lulolog.jpg')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>
        <View style={styles.actionTextContainer}>
          <Text style={styles.actionText}>Rebalancing Yield</Text>
          <Text style={styles.actionSubtext}>
            Lulo dynamically allocates your deposits across four integrated DeFi apps.
          </Text>
        </View>
        <View style={styles.apyBadge}>
          <Text style={styles.apyBadgeText}>
            {luloLoading ? (
              <ActivityIndicator size="small" color={COLORS.brandGreen} />
            ) : (
              `${luloApy?.protected?.CURRENT ? luloApy.protected.CURRENT.toFixed(2) : '0.00'}% APY`
            )}
          </Text>
        </View>
      </TouchableOpacity>
      
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalContent !== 'hidden'}
        onRequestClose={closeModals}
      >
        <View style={styles.modalContainer}>
          {renderModalContent()}
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  actionButton: {
    backgroundColor: COLORS.lightBackground,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  logoBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F5EFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  actionSubtext: {
    color: COLORS.greyDark,
    fontSize: 14,
  },
  apyBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  apyBadgeText: {
    color: COLORS.brandGreen,
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightBackground,
  },
  backButton: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 8,
  },
  providerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providedByText: {
    color: COLORS.greyDark,
    fontSize: 14,
    marginRight: 8,
  },
  providerLogo: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 4,
  },
  providerName: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  modalScroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightBackground,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
    marginBottom: 16,
  },
  simulationCard: {
    backgroundColor: COLORS.lightBackground,
    borderRadius: 16,
    padding: 16,
  },
  depositLabel: {
    color: COLORS.greyDark,
    fontSize: 14,
    marginBottom: 8,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  amountInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 32,
    fontWeight: '700',
    marginLeft: 8,
  },
  yieldBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 24,
  },
  yieldText: {
    color: COLORS.brandGreen,
    fontSize: 14,
    fontWeight: '600',
  },
  balanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.lightBackground,
    marginTop: 20,
  },
  balanceLabel: {
    fontSize: 16,
    color: COLORS.greyDark,
    fontWeight: '600',
  },
  balanceValue: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  poolCard: {
    backgroundColor: COLORS.lightBackground,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  poolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  poolName: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  apyText: {
    color: COLORS.greyDark,
    fontSize: 14,
  },
  apyValue: {
    color: COLORS.brandGreen,
    fontWeight: '600',
  },
  aboutText: {
    color: COLORS.greyDark,
    fontSize: 14,
    lineHeight: 20,
  },
  bottomPadding: {
    height: 80, // Height of the fixed button container
  },
  fixedButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightBackground,
  },
  actionButtonText: {
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.weights.bold,
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  completeButton: {
    backgroundColor: COLORS.brandGreen,
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 16,
  },
  pendingNotice: {
    marginTop: 20,
    padding: 12,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: 8,
    alignItems: 'center',
  },
  pendingText: {
    color: '#F97316',
    fontSize: 14,
    textAlign: 'center',
  },
  countdownText: {
    color: '#F97316',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  withdrawalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightBackground,
  },
  withdrawalAmount: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  withdrawalDate: {
    color: COLORS.greyDark,
    fontSize: 12,
  },
  amountModalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'space-between',
  },
  amountDisplayContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    alignItems: 'center',
  },
  usdcText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 8
  },
  amountText: {
    color: COLORS.white,
    fontSize: 72,
    fontWeight: 'bold',
    marginVertical: 12,
    textAlign: 'center'
  },
  maxButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  maxButton: {
    backgroundColor: COLORS.lightBackground,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  maxButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  balanceText: {
    color: COLORS.greyMid,
    fontSize: 14,
  },
  sliderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginVertical: 32,
    position: 'relative',
  },
  sliderTrack: {
    position: 'absolute',
    top: 20,
    left: 24,
    right: 24,
    height: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tick: {
    backgroundColor: COLORS.greyDark,
  },
  majorTick: {
    width: 2,
    height: 10,
  },
  minorTick: {
    width: 1,
    height: 5,
  },
  sliderLabels: {
    position: 'absolute',
    bottom: -5,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLine: {
    height: 1,
    backgroundColor: COLORS.greyDark,
    flex: 1,
    marginHorizontal: 4,
  },
  sliderText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  bottomContainer: {
    paddingBottom: 20,
  },
  errorBanner: {
    backgroundColor: COLORS.errorRed,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 24,
    marginBottom: 12,
    alignItems: 'center',
  },
  errorBannerText: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  confirmButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 12,
  },
  disabledButton: {
    backgroundColor: COLORS.greyMid,
  },
  poweredByContainer: {
    paddingTop: 10,
    paddingBottom: 24,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  poweredByLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  poweredByText: {
    color: COLORS.white,
    fontSize: 16,
  },
  luloLinkText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  poweredBySubtitle: {
    color: COLORS.greyDark,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: '80%',
  },
  modalActionButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  pendingWithdrawalsButton: {
    backgroundColor: COLORS.lightBackground,
    borderWidth: 1,
    borderColor: '#049FB4',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  pendingWithdrawalsButtonText: {
    color: '#049FB4',
    fontWeight: TYPOGRAPHY.weights.bold,
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  withdrawButton: {
    flex: 1,
    backgroundColor: COLORS.lightBackground,
    borderWidth: 1,
    borderColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  depositButton: {
    flex: 1,
    backgroundColor: '#049FB4',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
});

export default LuloRebalancingYieldCard;