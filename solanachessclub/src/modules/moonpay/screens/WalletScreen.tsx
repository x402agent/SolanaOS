import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Clipboard,
  Platform,
  StatusBar,
  Animated,
  Easing,
  ActivityIndicator,
  RefreshControl,
  ViewStyle,
  StyleProp,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Connection, PublicKey } from '@solana/web3.js';
import { HELIUS_STAKED_URL } from '@env';
import { useWallet } from '@/modules/wallet-providers/hooks/useWallet';
import COLORS from '@/assets/colors';
import Icons from '@/assets/svgs';
import AppHeader from '@/core/shared-ui/AppHeader';
import QRCodeModal from '../components/QRCodeModal';
import { styles } from './WalletScreen.style';
import { RootStackParamList } from '@/shared/navigation/RootNavigator';
import { StackNavigationProp } from '@react-navigation/stack';
import LuloRebalancingYieldCard from './LuloRebalancingYieldCard';

const SOL_DECIMAL = 1000000000; // 1 SOL = 10^9 lamports

// Component to show a skeleton loading line
interface SkeletonLineProps {
  width: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

function SkeletonLine({ width, height = 20, style }: SkeletonLineProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: COLORS.lighterBackground,
          borderRadius: height / 2,
          opacity,
        },
        style,
      ]}
    />
  );
}

interface WalletScreenProps {
  /**
   * Function to handle on-ramp (add funds) action
   */
  onOnrampPress?: () => void;

  /**
   * Callback for refresh action
   */
  onRefresh?: () => void;

  /**
   * Whether the wallet data is currently refreshing
   */
  refreshing?: boolean;
}

/**
 * WalletScreen component to display wallet information and actions
 */
function WalletScreen({
  onOnrampPress,
  onRefresh,
  refreshing,
}: WalletScreenProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [copied, setCopied] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  // Use the wallet hook to get the address
  const { address } = useWallet();
  const walletAddress = address;

  // State for balance and loading
  const [nativeBalance, setNativeBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Animation for loading spinner
  const spinValue = useRef(new Animated.Value(0)).current;

  // Start spinner animation
  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [loading, spinValue]);

  // Interpolate for spin animation
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Format wallet balance for display
  const walletBalance = nativeBalance !== null
    ? `${(nativeBalance / SOL_DECIMAL).toFixed(4)} SOL`
    : '0.00 SOL';

  // Function to fetch balance
  const fetchBalance = async () => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create a connection to the Solana cluster
      const connection = new Connection(HELIUS_STAKED_URL, 'confirmed');

      // Get the wallet public key
      const publicKey = new PublicKey(walletAddress);

      // Fetch the balance
      const balance = await connection.getBalance(publicKey);
      console.log("balance", balance)
      console.log('[WalletScreen] SOL balance in lamports:', balance);

      // Update state with the balance
      setNativeBalance(balance);
      setLoading(false);
    } catch (err: any) {
      console.error('[WalletScreen] Error fetching balance:', err);
      setError('Failed to fetch wallet balance. Please try again.');
      setLoading(false);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    if (onRefresh) {
      onRefresh();
    }
    await fetchBalance();
  };

  // Handle onramp (add funds) press
  const handleOnrampPress = () => {
    if (onOnrampPress) {
      onOnrampPress();
    } else {
      // Navigate to OnrampScreen
      navigation.navigate('OnrampScreen' as never);
    }
  };

  // Fetch balance on mount and when wallet address changes
  useEffect(() => {
    fetchBalance();
  }, [walletAddress]);

  // Animation values
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const checkmarkOpacityAnim = useRef(new Animated.Value(0)).current;

  // Handle copy animation
  useEffect(() => {
    if (copied) {
      // Animate copy icon out
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.5,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }),
      ]).start(() => {
        // Animate checkmark in
        Animated.parallel([
          Animated.timing(checkmarkOpacityAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
            easing: Easing.elastic(1.2),
          }),
        ]).start();

        // After a delay, revert back to copy icon
        setTimeout(() => {
          // Animate checkmark out
          Animated.parallel([
            Animated.timing(checkmarkOpacityAnim, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 0.5,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start(() => {
            // Reset rotation
            rotateAnim.setValue(0);

            // Animate copy icon back in
            Animated.parallel([
              Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
              }),
              Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
                easing: Easing.elastic(1.2),
              }),
            ]).start(() => {
              setCopied(false);
            });
          });
        }, 1500);
      });
    }
  }, [copied, opacityAnim, scaleAnim, rotateAnim, checkmarkOpacityAnim]);

  // Interpolate rotation value
  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const copyToClipboard = () => {
    if (!copied && walletAddress) {
      Clipboard.setString(walletAddress);
      setCopied(true);
    }
  };

  const handleQRPress = () => {
    if (walletAddress) {
      setQrModalVisible(true);
    }
  };

  // Show loading state while fetching data
  if (loading && !nativeBalance) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <AppHeader title="Wallet" showDefaultRightIcons={false} />

        <View style={styles.skeletonContainer}>
          {/* Wallet Balance Skeleton */}
          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Balance</Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
              <SkeletonLine width={120} height={36} style={{ marginTop: 8 }} />
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <View style={styles.loadingIconContainer}>
                  <Icons.walletIcon
                    width={24}
                    height={24}
                    color={COLORS.brandBlue}
                  />
                </View>
              </Animated.View>
            </View>
          </View>

          {/* Wallet Address Skeleton */}
          <View style={[styles.addressContainer, { marginTop: 24 }]}>
            <Text style={styles.addressLabel}>Wallet Address</Text>
            <View
              style={[styles.addressCard, { justifyContent: 'space-between' }]}>
              <View style={{ flex: 0.7 }}>
                <SkeletonLine
                  width={100}
                  height={20}
                  style={{ marginVertical: 8 }}
                />
              </View>
              <View style={styles.skeletonCopyButton}>
                <Icons.copyIcon width={16} height={16} color={COLORS.white} />
              </View>
            </View>
          </View>

          {/* Actions Skeleton */}
          <View style={[styles.actionsContainer, { marginTop: 24 }]}>
            <Text style={styles.actionsLabel}>Actions</Text>

            {/* Action Button Skeletons */}
            <View style={[styles.actionButton, { marginTop: 12 }]}>
              <View
                style={[
                  styles.actionIconContainer,
                  { backgroundColor: COLORS.brandBlue },
                ]}>
                <Icons.AddFundsIcon
                  width={24}
                  height={24}
                  color={COLORS.white}
                />
                <View style={styles.plusOverlayContainer}>
                  <Icons.PlusCircleIcon
                    width={16}
                    height={16}
                    color={COLORS.brandGreen}
                  />
                </View>
              </View>
              <View style={styles.actionTextContainer}>
                <SkeletonLine
                  width={80}
                  height={18}
                  style={{ marginBottom: 8 }}
                />
                <SkeletonLine width={160} height={14} />
              </View>
            </View>
          </View>

          <View style={styles.loadingTextContainer}>
            <Text style={styles.loadingText}>Loading wallet data</Text>
            <View style={styles.loadingDotsContainer}>
              <Animated.View
                style={[styles.loadingDot, { opacity: spinValue }]}
              />
              <Animated.View
                style={[
                  styles.loadingDot,
                  { opacity: spinValue, marginHorizontal: 4 },
                ]}
              />
              <Animated.View
                style={[styles.loadingDot, { opacity: spinValue }]}
              />
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Show error state if there was a problem
  if (error && !nativeBalance) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <AppHeader
          title="Wallet"
          showDefaultRightIcons={false}
        />
        <View style={styles.errorContainer}>
          <View style={styles.errorIconContainer}>
            <Icons.walletIcon width={48} height={48} color={COLORS.errorRed} />
            <View style={styles.errorBadge}>
              <Text style={styles.errorBadgeText}>!</Text>
            </View>
          </View>
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchBalance}
            activeOpacity={0.7}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[
      styles.container,
      { paddingTop: insets.top }
    ]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <AppHeader
        title="Wallet"
        showDefaultRightIcons={false}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || false}
            onRefresh={handleRefresh}
            colors={[COLORS.brandBlue]}
            tintColor={COLORS.brandBlue}
          />
        }
      >
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Balance</Text>
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.balanceValue}>{walletBalance}</Text>
              <ActivityIndicator
                size="small"
                color={COLORS.brandBlue}
                style={{ marginLeft: 10 }}
              />
            </View>
          ) : (
            <Text style={styles.balanceValue}>{walletBalance}</Text>
          )}
        </View>

        <View style={styles.addressContainer}>
          <Text style={styles.addressLabel}>Wallet Address</Text>
          <View style={styles.addressCard}>
            <Text style={styles.addressValue}>
              {walletAddress && walletAddress.length > 10
                ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`
                : walletAddress || 'No address found'}
            </Text>
            <View style={styles.addressActions}>
              <TouchableOpacity
                onPress={handleQRPress}
                style={styles.qrIconButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
                disabled={!walletAddress}
              >
                <Icons.QrCodeIcon width={20} height={20} color={COLORS.white} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={copyToClipboard}
                style={styles.copyIconButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
                disabled={copied}
              >
                <View style={styles.iconContainer}>
                  {/* Copy Icon (animated) */}
                  <Animated.View style={{
                    opacity: opacityAnim,
                    transform: [{ scale: scaleAnim }, { rotate }],
                    position: 'absolute',
                  }}>
                    <Icons.copyIcon width={20} height={20} color={COLORS.white} />
                  </Animated.View>

                  {/* Checkmark (animated) */}
                  <Animated.View style={{
                    opacity: checkmarkOpacityAnim,
                    transform: [{ scale: scaleAnim }],
                    position: 'absolute',
                  }}>
                    <View style={styles.checkmarkContainer}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  </Animated.View>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <Text style={styles.actionsLabel}>Actions</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleOnrampPress}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: COLORS.brandBlue }]}>
              <Icons.AddFundsIcon width={24} height={24} color={COLORS.white} />
              <View style={styles.plusOverlayContainer}>
                <Icons.PlusCircleIcon width={16} height={16} color={COLORS.brandGreen} />
              </View>
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionText}>Add Funds</Text>
              <Text style={styles.actionSubtext}>Deposit SOL to your wallet</Text>
            </View>
            <View style={styles.actionBadge}>
              <Text style={styles.actionBadgeText}>MoonPay</Text>
            </View>
          </TouchableOpacity>

          {/* Lulo Rebalancing Yield Card */}
          <LuloRebalancingYieldCard />
        </View>

        {/* Legal Links Section */}
        <View style={styles.legalLinksContainer}>
          <TouchableOpacity
            style={styles.legalLinkButton}
            onPress={() => navigation.navigate('WebViewScreen', {
              uri: 'https://www.solanaappkit.com/privacy',
              title: 'Privacy Policy'
            })}
            activeOpacity={0.7}
          >
            <Text style={styles.legalLinkText}>Privacy Policy</Text>
            <Icons.arrowRIght width={16} height={16} color={COLORS.greyDark} />
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.legalLinkButton}
            onPress={() => navigation.navigate('WebViewScreen', {
              uri: 'https://www.solanaappkit.com/tnc',
              title: 'Terms & Conditions'
            })}
            activeOpacity={0.7}
          >
            <Text style={styles.legalLinkText}>Terms & Conditions</Text>
            <Icons.arrowRIght width={16} height={16} color={COLORS.greyDark} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* QR Code Modal */}
      <QRCodeModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
        walletAddress={walletAddress || ''}
      />
    </View>
  );
}

export default WalletScreen; 