import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, StackActions } from '@react-navigation/native';
import { Cluster, Connection, clusterApiUrl } from '@solana/web3.js';
import BN from 'bn.js';

import { useAuth } from '../../wallet-providers/hooks/useAuth';
import { useWallet } from '../../wallet-providers/hooks/useWallet';
import { ENDPOINTS } from '@/shared/config/constants';
import { CLUSTER } from '@env';
import { useAppSelector } from '@/shared/hooks/useReduxHooks';
import Icons from '@/assets/svgs';
import COLORS from '@/assets/colors';
import { createMarket } from '../services/tokenMillService';
import ExistingAddressesCard from '../components/ExistingAddressCard';
import BondingCurveCard from '../components/BondingCurveCard';
import { AppHeader } from '@/core/shared-ui';

const TokenMillScreen = () => {
  // Auth & connection setup
  const { wallet, address } = useWallet();
  const { solanaWallet } = useAuth();
  const myWallet = useAppSelector(state => state.auth.address);
  const navigation = useNavigation();

  // View selection state
  const [selectedOption, setSelectedOption] = useState('create'); // 'create' or 'existing' or 'bondingCurve'

  // Form state
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Token creation fields
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [metadataUri, setMetadataUri] = useState('https://arweave.net/abc123');
  const [totalSupply, setTotalSupply] = useState('1000000');
  const [creatorFee, setCreatorFee] = useState('4000');  // 40% (out of the 80% available)
  const [stakingFee, setStakingFee] = useState('4000');  // 40% (out of the 80% available)

  // Existing market fields
  const [marketAddress, setMarketAddress] = useState('');
  const [baseTokenMint, setBaseTokenMint] = useState('');

  // Data points modal
  const [showDataPoints, setShowDataPoints] = useState(false);
  const [curveData, setCurveData] = useState<{ points: BN[], parameters: any } | null>(null);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (selectedOption === 'bondingCurve') {
      // If we're in the bonding curve view, go back to the previous view
      setSelectedOption(marketAddress ? 'existing' : 'create');
    } else {
      navigation.goBack();
    }
  }, [navigation, selectedOption, marketAddress]);

  // Get the most appropriate wallet to use for transactions
  const getWalletForTransactions = () => {
    // Prefer the standardized wallet if available
    if (wallet) {
      return wallet;
    }

    // Fall back to solanaWallet if available
    if (solanaWallet) {
      return solanaWallet;
    }

    // If no wallet available, show error
    Alert.alert('Error', 'No wallet is available for transactions');
    return null;
  };

  // Validate wallet connection
  if (!wallet && !solanaWallet?.wallets?.length && !myWallet) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader
          title="Token Mill"
          showBackButton={true}
          onBackPress={handleBack}
          showDefaultRightIcons={true}
        />
        <Text style={styles.errorText}>Wallet not connected</Text>
      </SafeAreaView>
    );
  }

  // Make sure we have a valid public key string
  const publicKey = (myWallet || address || solanaWallet?.wallets?.[0]?.publicKey) || '';
  if (!publicKey) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader
          title="Token Mill"
          showBackButton={true}
          onBackPress={handleBack}
          showDefaultRightIcons={true}
        />
        <Text style={styles.errorText}>No valid wallet public key found</Text>
      </SafeAreaView>
    );
  }

  const rpcUrl = clusterApiUrl(CLUSTER as Cluster) || ENDPOINTS.helius;
  const connection = new Connection(rpcUrl, 'confirmed');
  const walletForTx = getWalletForTransactions();

  // Handle action button press based on selected option
  const handleActionButtonPress = () => {
    if (selectedOption === 'create') {
      handleCreateMarket();
    } else if (selectedOption === 'existing') {
      handleProceedWithExisting();
    } else {
      // Do nothing in bonding curve view - the action is handled by BondingCurveCard
    }
  };

  // Handle create market button press
  const handleCreateMarket = async () => {
    if (!walletForTx) return;

    if (!tokenName.trim()) {
      Alert.alert("Missing Field", "Token Name is required");
      return;
    }

    if (!tokenSymbol.trim()) {
      Alert.alert("Missing Field", "Token Symbol is required");
      return;
    }

    try {
      setLoading(true);
      setStatus('Preparing market creation...');

      const { txSignature, marketAddress: newMarketAddress, baseTokenMint: newBaseTokenMint } = await createMarket({
        tokenName,
        tokenSymbol,
        metadataUri,
        totalSupply: parseInt(totalSupply, 10),
        creatorFee: parseInt(creatorFee, 10),
        stakingFee: parseInt(stakingFee, 10),
        userPublicKey: publicKey,
        connection,
        solanaWallet: walletForTx,
        onStatusUpdate: (newStatus) => {
          console.log('Create market status:', newStatus);
          setStatus(newStatus);
        }
      });

      setStatus('Market created successfully!');

      // Save the new market address and token mint
      setMarketAddress(newMarketAddress);
      setBaseTokenMint(newBaseTokenMint);

      // Navigate to bonding curve configuration
      setTimeout(() => {
        setSelectedOption('bondingCurve');
        setLoading(false);
        setStatus(null);
      }, 1000);

    } catch (err: any) {
      console.error('Create market error:', err);
      setStatus('Transaction failed');
      setTimeout(() => {
        setLoading(false);
        setStatus(null);
      }, 2000);
    }
  };

  // Handle existing market proceed
  const handleProceedWithExisting = () => {
    if (!marketAddress.trim() || !baseTokenMint.trim()) {
      Alert.alert("Missing Fields", "Market address and base token mint are required");
      return;
    }

    // Switch to bonding curve view
    setSelectedOption('bondingCurve');
  };

  // Handler for curve change callback from BondingCurveCard
  const handleCurveChange = useCallback((points: BN[], parameters: any) => {
    console.log('Curve data updated:', points.length, parameters);
    setCurveData({ points, parameters });
  }, []);

  // Toggle data points drawer
  const toggleDataPoints = useCallback(() => {
    setShowDataPoints(prev => !prev);
  }, []);

  // Format price number for display
  const formatPrice = (bn: BN) => {
    try {
      const num = bn.toNumber();
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
      return num.toString();
    } catch (e) {
      return '0';
    }
  };

  // Helper to get the appropriate title for the screen based on selected option
  const getScreenTitle = () => {
    switch (selectedOption) {
      case 'create':
        return 'Create New Token';
      case 'existing':
        return 'Use Existing Market';
      case 'bondingCurve':
        return 'Configure Bonding Curve';
      default:
        return 'Token Mill';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Replace header with AppHeader */}
      <AppHeader
        title="Token Mill"
        showBackButton={true}
        onBackPress={handleBack}
        showDefaultRightIcons={true}
      />

      <View style={styles.container}>
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
          {selectedOption === 'create' ? (
            // Token Creation Form Fields
            <>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Token Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="..."
                  placeholderTextColor={COLORS.greyMid}
                  value={tokenName}
                  onChangeText={setTokenName}
                  editable={!loading}
                  keyboardAppearance="dark"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Token Symbol</Text>
                <TextInput
                  style={styles.input}
                  placeholder="..."
                  placeholderTextColor={COLORS.greyMid}
                  value={tokenSymbol}
                  onChangeText={setTokenSymbol}
                  editable={!loading}
                  keyboardAppearance="dark"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Metadata URI</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://arweave.net/abc123"
                  placeholderTextColor={COLORS.greyMid}
                  value={metadataUri}
                  onChangeText={setMetadataUri}
                  editable={!loading}
                  keyboardAppearance="dark"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Total Supply</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1,000,000"
                  placeholderTextColor={COLORS.greyMid}
                  value={totalSupply}
                  onChangeText={setTotalSupply}
                  keyboardType="numeric"
                  editable={!loading}
                  keyboardAppearance="dark"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Creator Fee</Text>
                <TextInput
                  style={styles.input}
                  placeholder="4000"
                  placeholderTextColor={COLORS.greyMid}
                  value={creatorFee}
                  onChangeText={setCreatorFee}
                  keyboardType="numeric"
                  editable={!loading}
                  keyboardAppearance="dark"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>Staking Fee</Text>
                <TextInput
                  style={styles.input}
                  placeholder="4000"
                  placeholderTextColor={COLORS.greyMid}
                  value={stakingFee}
                  onChangeText={setStakingFee}
                  keyboardType="numeric"
                  editable={!loading}
                  keyboardAppearance="dark"
                />
              </View>

              <View style={styles.infoBox}>
                <View style={styles.infoHeader}>
                  {/* <Icons.NFTIcon width={20} height={20} color={COLORS.brandBlue} /> */}
                  <Text style={styles.infoHeaderText}>Fee Structure Guidelines</Text>
                </View>
                <View style={styles.infoDivider} />
                <View style={styles.infoContent}>
                  <View style={styles.infoRow}>
                    <View style={[styles.feeIndicator, { backgroundColor: COLORS.brandPurple }]} />
                    <Text style={styles.infoText}>
                      <Text style={styles.infoTextBold}>Protocol Fee: </Text>
                      20% (fixed, reserved for the system)
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <View style={[styles.feeIndicator, { backgroundColor: COLORS.brandBlue }]} />
                    <Text style={styles.infoText}>
                      <Text style={styles.infoTextBold}>Creator Fee: </Text>
                      Your share of transaction fees (currently {parseInt(creatorFee) / 100}%)
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <View style={[styles.feeIndicator, { backgroundColor: COLORS.brandPrimary }]} />
                    <Text style={styles.infoText}>
                      <Text style={styles.infoTextBold}>Staking Fee: </Text>
                      Rewards for token stakers (currently {parseInt(stakingFee) / 100}%)
                    </Text>
                  </View>
                  <View style={styles.ruleContainer}>
                    <Text style={styles.ruleText}>
                      Creator Fee + Staking Fee must equal exactly 80%
                    </Text>
                  </View>
                </View>
              </View>

              {status && (
                <View style={styles.statusContainer}>
                  {loading && <ActivityIndicator size="small" color={COLORS.brandBlue} style={styles.loader} />}
                  <Text style={styles.statusText}>{status}</Text>
                </View>
              )}
            </>
          ) : selectedOption === 'existing' ? (
            // Existing Market Form
            <ExistingAddressesCard
              marketAddress={marketAddress}
              setMarketAddress={setMarketAddress}
              baseTokenMint={baseTokenMint}
              setBaseTokenMint={setBaseTokenMint}
            />
          ) : (
            // Bonding Curve Configuration - Pass the handleCurveChange callback
            walletForTx && (
              <View style={styles.bondingCurveContainer}>
                <BondingCurveCard
                  marketAddress={marketAddress}
                  connection={connection}
                  publicKey={publicKey}
                  solanaWallet={walletForTx}
                  setLoading={setLoading}
                  onCurveChange={handleCurveChange}
                />
              </View>
            )
          )}
        </ScrollView>

        {/* Bottom buttons */}
        {selectedOption === 'bondingCurve' ? (
          <View style={styles.bottomButtons}>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={toggleDataPoints}
              disabled={loading}
            >
              <Text style={styles.optionText}>
                Data points
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionButton, styles.optionButtonActive]}
              disabled={loading}
            >
              <Text style={[styles.optionText, styles.optionTextActive]}>
                Set Curve On-Chain
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.bottomButtons}>
            <TouchableOpacity
              style={[styles.optionButton, selectedOption === 'existing' && styles.optionButtonActive]}
              onPress={() => setSelectedOption('existing')}
              disabled={loading}
            >
              <Text style={[styles.optionText, selectedOption === 'existing' && styles.optionTextActive]}>
                Existing market
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionButton, selectedOption === 'create' && styles.optionButtonActive]}
              onPress={handleActionButtonPress}
              disabled={loading}
            >
              <Text style={[styles.optionText, selectedOption === 'create' && styles.optionTextActive]}>
                {selectedOption === 'create' ? 'Create Market' : 'Proceed'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Data Points Modal */}
      <Modal
        visible={showDataPoints}
        transparent={true}
        animationType="slide"
        onRequestClose={toggleDataPoints}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Data Points</Text>
              <TouchableOpacity onPress={toggleDataPoints} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, styles.tableHeaderText]}>Point</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText]}>Ask Price</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText]}>Bid Price</Text>
            </View>

            <FlatList
              data={curveData?.points || []}
              keyExtractor={(_, index) => `point-${index}`}
              renderItem={({ item, index }) => {
                const askPrice = item;
                const feePercent = curveData?.parameters?.feePercent || 2.0;
                const bidPrice = new BN(
                  Math.floor(
                    askPrice.toNumber() * (1 - feePercent / 100)
                  )
                );

                return (
                  <View style={styles.tableRow}>
                    <Text style={styles.tableCell}>{index + 1}</Text>
                    <Text style={styles.tableCell}>{formatPrice(askPrice)}</Text>
                    <Text style={styles.tableCell}>{formatPrice(bidPrice)}</Text>
                  </View>
                );
              }}
              style={styles.tableList}
              ListEmptyComponent={
                <View style={styles.emptyListContainer}>
                  <Text style={styles.emptyListText}>
                    No curve data available. Configure the curve first.
                  </Text>
                </View>
              }
            />

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={toggleDataPoints}
            >
              <Text style={styles.closeModalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    position: 'relative',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100, // Add extra padding for bottom buttons
  },
  formField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    color: COLORS.greyMid,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'transparent',
    color: COLORS.white,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  bottomButtons: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDarkColor,
  },
  optionButton: {
    flex: 1,
    marginHorizontal: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: COLORS.darkerBackground,
  },
  optionButtonActive: {
    backgroundColor: COLORS.brandBlue,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.greyMid,
  },
  optionTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lighterBackground,
    padding: 12,
    borderRadius: 8,
    marginVertical: 16,
  },
  loader: {
    marginRight: 10,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 14,
    flex: 1,
  },
  errorText: {
    color: COLORS.white,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDarkColor,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: COLORS.white,
    fontWeight: '600',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDarkColor,
  },
  tableHeaderText: {
    fontWeight: '700',
    color: COLORS.white,
  },
  tableCell: {
    flex: 1,
    textAlign: 'center',
    color: COLORS.white,
    fontSize: 14,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  tableList: {
    maxHeight: 400,
  },
  closeModalButton: {
    backgroundColor: COLORS.darkerBackground,
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  bondingCurveContainer: {
    marginTop: -15,
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  emptyListContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyListText: {
    color: COLORS.greyMid,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: COLORS.lighterBackground,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
    marginLeft: 10,
  },
  infoDivider: {
    height: 1,
    backgroundColor: COLORS.borderDarkColor,
    flex: 1,
  },
  infoContent: {
    marginTop: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  feeIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  ruleContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 8,
  },
  ruleText: {
    color: COLORS.white,
    fontSize: 14,
  },
  infoText: {
    color: COLORS.white,
    fontSize: 14,
  },
  infoTextBold: {
    fontWeight: '700',
  },
});

export default TokenMillScreen;

