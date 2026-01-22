import React, { useEffect, useState, useRef, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  StatusBar,
  Animated,
  Easing,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { styles } from '../screens/SwapScreen.styles';
import COLORS from '@/assets/colors';
import Icons from '@/assets/svgs';
import { TokenInfo } from '@/modules/data-module';
import { SwapProvider } from '../services/tradeService';

const { width } = Dimensions.get('window');

// Enhanced Shimmer effect component for loading states
export const Shimmer = ({
  width: componentWidth,
  height,
  style,
  borderRadius = 4
}: {
  width: number | string,
  height: number | string,
  style?: any,
  borderRadius?: number
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const actualWidth = typeof componentWidth === 'number' ? componentWidth : 100;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: false
      })
    );

    shimmerAnimation.start();

    return () => {
      shimmerAnimation.stop();
      animatedValue.setValue(0);
    };
  }, []);

  // Create a more smooth gradient effect
  const shimmerOpacity = animatedValue.interpolate({
    inputRange: [0, 0.3, 0.6, 1],
    outputRange: [0.1, 0.2, 0.1, 0.1]
  });

  // Create a smoother horizontal movement
  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-actualWidth * 1.5, actualWidth * 1.5]
  });

  return (
    <View
      style={[
        {
          width: componentWidth,
          height,
          backgroundColor: COLORS.darkerBackground,
          overflow: 'hidden',
          borderRadius: borderRadius
        },
        style
      ]}
    >
      <Animated.View
        style={{
          width: '150%',
          height: '100%',
          transform: [{ translateX }],
          opacity: shimmerOpacity,
          backgroundColor: COLORS.greyDark,
          position: 'absolute',
          left: '-25%',
          top: 0
        }}
      />
    </View>
  );
};

// Enhanced TokenSkeleton for cohesive loading state
const TokenRowSkeleton = ({ isInput = true }: { isInput?: boolean }) => (
  <View style={styles.tokenRow}>
    {/* Token icon placeholder */}
    <Shimmer width={36} height={36} borderRadius={18} />

    <View style={styles.tokenInfo}>
      {/* Token symbol placeholder */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Shimmer
          width={80}
          height={20}
          borderRadius={8}
          style={{ marginBottom: 8, marginLeft: 8 }}
        />
        <Ionicons
          name="chevron-down"
          size={16}
          color={COLORS.greyMid}
          style={{ marginLeft: 6, marginBottom: 8 }}
        />
      </View>

      {/* Balance placeholder - only show for input token */}
      {isInput && (
        <Shimmer
          width={120}
          height={14}
          borderRadius={8}
          style={{ marginLeft: 8 }}
        />
      )}
    </View>

    <View style={styles.valueContainer}>
      {/* Value label placeholder */}
      <Text style={styles.valueLabel}>{isInput ? 'You Pay' : 'You Receive'}</Text>

      {/* Token value placeholder - made smaller */}
      <Shimmer
        width={90}
        height={22}
        borderRadius={8}
        style={{ marginVertical: 4 }}
      />

      {/* Fiat value placeholder - made smaller */}
      <Shimmer
        width={60}
        height={12}
        borderRadius={8}
      />
    </View>
  </View>
);

// Provider Selection Component
export const ProviderSelector = ({
  providers,
  activeProvider,
  setActiveProvider,
  isProviderAvailable
}: {
  providers: SwapProvider[];
  activeProvider: SwapProvider;
  setActiveProvider: (provider: SwapProvider) => void;
  isProviderAvailable: (provider: SwapProvider) => boolean;
}) => (
  <View style={styles.providerButtons}>
    {providers.map(provider => (
      <TouchableOpacity
        key={provider}
        style={[
          styles.providerButton,
          activeProvider === provider && {
            backgroundColor: COLORS.lightBackground,
            borderWidth: 1,
            borderColor: provider === 'Raydium' ? COLORS.brandPrimary : COLORS.white
          },
          !isProviderAvailable(provider) && { opacity: 0.5 }
        ]}
        onPress={() => {
          if (isProviderAvailable(provider)) {
            setActiveProvider(provider);
          } else {
            // Alert is handled in the main component
          }
        }}
      >
        <Text
          style={[
            styles.providerButtonText,
            activeProvider === provider && {
              color: provider === 'Raydium' ? COLORS.brandPrimary : COLORS.white
            }
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {provider === 'JupiterUltra' ? 'Jupiter' : provider}{!isProviderAvailable(provider) ? ' (soon)' : ''}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

// PumpSwap Pool Address Component
export const PumpSwapControls = ({
  poolAddress,
  setPoolAddress,
  slippage,
  setSlippage
}: {
  poolAddress: string;
  setPoolAddress: (address: string) => void;
  slippage: number;
  setSlippage: (slippage: number) => void;
}) => (
  <>
    <View style={styles.poolAddressContainer}>
      <Text style={styles.poolAddressLabel}>Pool Address</Text>
      <TextInput
        style={styles.poolAddressInput}
        placeholder="Enter PumpSwap pool address"
        placeholderTextColor={COLORS.greyDark}
        value={poolAddress}
        onChangeText={setPoolAddress}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
    <View style={styles.poolAddressContainer}>
      <Text style={styles.poolAddressLabel}>Slippage Tolerance</Text>
      <View style={styles.slippageButtonsContainer}>
        {[1, 3, 5, 10, 15, 20, 25, 30].map((value) => (
          <TouchableOpacity
            key={`slippage-${value}`}
            style={[
              styles.slippageButton,
              slippage === value && styles.slippageButtonActive
            ]}
            onPress={() => setSlippage(value)}
          >
            <Text
              style={[
                styles.slippageButtonText,
                slippage === value && styles.slippageButtonTextActive
              ]}
            >
              {value}%
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.pumpSwapWarningContainer}>
        <Text style={styles.pumpSwapWarningText}>
          ⚠️ Warning: This pool may have very high price impact. Trades are executed with extreme slippage tolerance for successful execution.
        </Text>
      </View>
    </View>
  </>
);

// Token Selection Row Component (memoized to prevent re-renders)
export const TokenRow = memo(({
  token,
  balance,
  isInput,
  value,
  fiatValue,
  onPress,
  connected,
  isLoading = false
}: {
  token: TokenInfo | null;
  balance: number | null;
  isInput: boolean;
  value: string;
  fiatValue: string;
  onPress: () => void;
  connected?: boolean;
  isLoading?: boolean;
}) => {
  // If loading, render the skeleton version
  if (isLoading) {
    return (
      <TokenRowSkeleton isInput={isInput} />
    );
  }

  // Render the full content when loaded
  return (
    <TouchableOpacity style={styles.tokenRow} onPress={onPress}>
      {token?.logoURI ? (
        <Image source={{ uri: token.logoURI }} style={styles.tokenIcon} />
      ) : (
        <View style={[styles.tokenIcon, { backgroundColor: COLORS.lighterBackground, justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: COLORS.white, fontWeight: 'bold', fontSize: 10 }}>
            {token?.symbol?.charAt(0) || '?'}
          </Text>
        </View>
      )}
      <View style={styles.tokenInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.tokenSymbol} numberOfLines={1} ellipsizeMode="tail">
            {token?.symbol || 'Select'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={16}
            color={COLORS.greyMid}
            style={{ marginLeft: 6 }}
          />
        </View>
        {isInput && (
          <Text style={styles.tokenBalance} numberOfLines={1} ellipsizeMode="tail">
            {balance !== null
              ? `Balance: ${balance.toFixed(6)} ${token?.symbol || ''}`
              : 'Loading...'}
          </Text>
        )}
      </View>
      <View style={styles.valueContainer}>
        <Text style={styles.valueLabel}>{isInput ? 'You Pay' : 'You Receive'}</Text>
        <Text style={isInput ? styles.tokenValue : styles.receiveValue} numberOfLines={1} ellipsizeMode="tail">
          {!isInput && '+'}
          {value}
        </Text>
        <Text style={styles.fiatValue} numberOfLines={1} ellipsizeMode="tail">
          {fiatValue}
        </Text>
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these props actually changed
  return (
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.token?.address === nextProps.token?.address &&
    prevProps.balance === nextProps.balance &&
    prevProps.value === nextProps.value &&
    prevProps.fiatValue === nextProps.fiatValue
  );
});

// Swap Info Component
export const SwapInfo = ({
  conversionRate,
  solscanTxSig,
  activeProvider,
  onViewTransaction
}: {
  conversionRate: string;
  solscanTxSig: string;
  activeProvider: SwapProvider;
  onViewTransaction: () => void;
}) => (
  <View style={styles.swapInfoContainer}>
    <View style={styles.swapInfoRow}>
      <Text style={styles.swapInfoLabel}>Rate</Text>
      <Text style={styles.swapInfoValue} numberOfLines={1} ellipsizeMode="tail">
        {conversionRate}
      </Text>
    </View>
    <View style={styles.swapInfoRow}>
      <Text style={styles.swapInfoLabel}>Network Fee</Text>
      <Text style={styles.swapInfoValue}>~0.00005 SOL</Text>
    </View>
    <View style={styles.swapInfoRow}>
      <Text style={styles.swapInfoLabel}>Price Impact</Text>
      <Text style={styles.swapInfoValue}>
        <Text style={{ color: COLORS.brandPrimary }}>~0.05%</Text>
      </Text>
    </View>
    <View style={styles.swapInfoRow}>
      <Text style={styles.swapInfoLabel}>Provider</Text>
      <Text style={[styles.swapInfoValue, { color: COLORS.brandPrimary }]}>
        {activeProvider}
      </Text>
    </View>
    {solscanTxSig && (
      <View style={styles.swapInfoRow}>
        <Text style={styles.swapInfoLabel}>Transaction</Text>
        <TouchableOpacity onPress={onViewTransaction}>
          <Text style={[styles.swapInfoValue, { color: COLORS.brandPrimary }]}>
            View on Solscan
          </Text>
        </TouchableOpacity>
      </View>
    )}
  </View>
);

// Status Display Component
export const StatusDisplay = ({
  loading,
  resultMsg,
  errorMsg
}: {
  loading: boolean;
  resultMsg: string;
  errorMsg: string;
}) => (
  <>
    {loading && (
      <View style={styles.statusContainer}>
        <ActivityIndicator size="small" color={COLORS.brandPrimary} />
        <Text style={styles.statusText} numberOfLines={2} ellipsizeMode="tail">
          {resultMsg || 'Processing...'}
        </Text>
      </View>
    )}

    {errorMsg ? (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText} numberOfLines={2} ellipsizeMode="tail">
          {errorMsg}
        </Text>
      </View>
    ) : null}
  </>
);

// Keypad Component
export const Keypad = ({ onKeyPress }: { onKeyPress: (key: string) => void }) => (
  <View style={styles.keypadContainer}>
    <View style={styles.keypadRow}>
      <TouchableOpacity style={styles.keypadButton} onPress={() => onKeyPress('1')}>
        <Text style={styles.keypadButtonText}>1</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.keypadButton} onPress={() => onKeyPress('2')}>
        <Text style={styles.keypadButtonText}>2</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.keypadButton} onPress={() => onKeyPress('3')}>
        <Text style={styles.keypadButtonText}>3</Text>
      </TouchableOpacity>
    </View>
    <View style={styles.keypadRow}>
      <TouchableOpacity style={styles.keypadButton} onPress={() => onKeyPress('4')}>
        <Text style={styles.keypadButtonText}>4</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.keypadButton} onPress={() => onKeyPress('5')}>
        <Text style={styles.keypadButtonText}>5</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.keypadButton} onPress={() => onKeyPress('6')}>
        <Text style={styles.keypadButtonText}>6</Text>
      </TouchableOpacity>
    </View>
    <View style={styles.keypadRow}>
      <TouchableOpacity style={styles.keypadButton} onPress={() => onKeyPress('7')}>
        <Text style={styles.keypadButtonText}>7</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.keypadButton} onPress={() => onKeyPress('8')}>
        <Text style={styles.keypadButtonText}>8</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.keypadButton} onPress={() => onKeyPress('9')}>
        <Text style={styles.keypadButtonText}>9</Text>
      </TouchableOpacity>
    </View>
    <View style={styles.keypadRow}>
      <TouchableOpacity style={styles.keypadButton} onPress={() => onKeyPress('.')}>
        <Text style={styles.keypadButtonText}>.</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.keypadButton} onPress={() => onKeyPress('0')}>
        <Text style={styles.keypadButtonText}>0</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.keypadButton} onPress={() => onKeyPress('delete')}>
        <Ionicons name="backspace-outline" size={22} color={COLORS.white} />
      </TouchableOpacity>
    </View>
  </View>
);

// Android-specific styles
export const androidStyles = StyleSheet.create({
  statusBarPlaceholder: {
    height: StatusBar.currentHeight || 24,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    paddingTop: 8, // Additional padding for Android camera hole
  },
  swapActionButton: {
    marginBottom: 80, // Increased bottom margin for Android to avoid overlap with navigation bar
  }
}); 