import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import TradeCard, { TradeData } from '@/core/shared-ui/TradeCard/TradeCard';
import COLORS from '@/assets/colors';
import { useAppSelector } from '@/shared/hooks/useReduxHooks';
import { useWallet } from '@/modules/wallet-providers/hooks/useWallet';
import { DEFAULT_IMAGES } from '@/shared/config/constants';
import { ThreadUser } from '@/core/thread/components/thread.types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/shared/navigation/RootNavigator';
import { TokenInfo } from '@/modules/data-module';
import TYPOGRAPHY from '@/assets/typography';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SwapScreen'>;

interface MessageTradeCardProps {
  tradeData: TradeData;
  userAvatar?: any;
  isCurrentUser?: boolean;
}

function MessageTradeCard({ tradeData, userAvatar, isCurrentUser }: MessageTradeCardProps) {
  const storedProfilePic = useAppSelector(state => state.auth.profilePicUrl);
  const userName = useAppSelector(state => state.auth.username);
  const { address } = useWallet();
  const navigation = useNavigation<NavigationProp>();

  const userPublicKey = address || null;
  const currentUser: ThreadUser = {
    id: userPublicKey || 'anonymous-user',
    username: userName || 'Anonymous',
    handle: userPublicKey
      ? '@' + userPublicKey.slice(0, 6) + '...' + userPublicKey.slice(-4)
      : '@anonymous',
    verified: true,
    avatar: storedProfilePic ? { uri: storedProfilePic } : DEFAULT_IMAGES.user,
  };

  const handleCopyTrade = () => {
    if (!tradeData) {
      Alert.alert('Error', 'No trade data available for this message.');
      return;
    }

    // Create a more complete TokenInfo object for the input token
    const inputTokenInfo: TokenInfo = {
      address: tradeData.inputMint,
      symbol: tradeData.inputSymbol || 'SOL',
      name: tradeData.inputSymbol || 'Solana', // Use symbol as name if not provided
      decimals: 9, // Default to 9 decimals (SOL)
      logoURI: '', // Leave empty, the SwapScreen will fetch this
    };

    // Create a more complete output token object with image if available
    const outputTokenInfo = {
      address: tradeData.outputMint, // Pass the output token mint address
      symbol: tradeData.outputSymbol || 'Unknown Token', // Pass the token symbol or default
      // Include any additional details that might be available in the trade data
      mint: tradeData.outputMint, // Add explicit mint address
      logoURI: (tradeData as any).outputLogoURI || '', // Add logo URL if available using type assertion
      name: tradeData.outputSymbol || 'Unknown Token', // Add name for display purposes
    };

    console.log('[MessageTradeCard] Copying trade with tokens:', {
      input: inputTokenInfo.symbol,
      output: outputTokenInfo.symbol,
      amount: tradeData.inputQuantity
    });

    // Navigate to the SwapScreen with the trade parameters
    navigation.navigate('SwapScreen', {
      inputToken: inputTokenInfo,
      outputToken: outputTokenInfo,
      inputAmount: tradeData.inputQuantity || '1', // Pass the original trade amount or default to 1
      shouldInitialize: true, // Flag to initialize the swap with our parameters
      showBackButton: true // Add back button to return to chat
    });
  };

  return (
    <View style={[
      styles.container,
      isCurrentUser ? styles.currentUserContainer : styles.otherUserContainer
    ]}>
      <TradeCard
        tradeData={tradeData}
        showGraphForOutputToken={true}
        userAvatar={userAvatar}
        styleOverrides={{
          tradeCardContainer: {
            backgroundColor: COLORS.lighterBackground,
            borderColor: 'rgba(50, 212, 222, 0.2)',
            borderWidth: 1,
            borderRadius: 20,
            width: '100%',
            padding: 16,
            shadowColor: COLORS.black,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 4,
          },
          chartContainer: {
            backgroundColor: 'transparent',
            borderRadius: 12,
            marginTop: 8,
          },
          timeframeButton: {
            backgroundColor: COLORS.darkerBackground,
            borderRadius: 8,
            paddingVertical: 6,
            paddingHorizontal: 12,
          },
          timeframeButtonActive: {
            backgroundColor: COLORS.brandBlue,
            shadowColor: COLORS.brandBlue,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 3,
          }
        }}
      />
      <TouchableOpacity
        style={styles.ctaButton}
        onPress={handleCopyTrade}
        activeOpacity={0.8}
      >
        <Text style={styles.ctaButtonLabel}>Copy Trade</Text>
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    width: '90%',
    borderRadius: 20,
    marginVertical: 8,
    overflow: 'hidden',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(50, 212, 222, 0.2)',
  },
  currentUserContainer: {
    alignSelf: 'flex-end',
  },
  otherUserContainer: {
    alignSelf: 'flex-start',
  },
  ctaButton: {
    backgroundColor: COLORS.brandBlue,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: COLORS.brandBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  ctaButtonLabel: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 15,
    fontFamily: TYPOGRAPHY.fontFamily,
  }
});

export default MessageTradeCard; 