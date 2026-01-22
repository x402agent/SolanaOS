// File: src/screens/TokenMillScreen/components/SwapCard.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { SwapCardProps, SwapType } from '../types';
import { swapTokens } from '../services/tokenMillService';
import { SwapCardStyles as styles } from './styles/SwapCard.style';

export default function SwapCard({
  marketAddress,
  connection,
  publicKey,
  solanaWallet,
  setLoading,
}: SwapCardProps) {
  const [amount, setAmount] = useState('1');
  const [swapType, setSwapType] = useState<SwapType>('buy');
  const [status, setStatus] = useState<string | null>(null);

  const onPressSwap = async () => {
    if (!marketAddress) {
      Alert.alert('No market', 'Please enter or create a market first!');
      return;
    }
    try {
      setLoading(true);
      setStatus('Preparing transaction...');

      const txSig = await swapTokens({
        marketAddress,
        swapType,
        swapAmount: parseFloat(amount),
        userPublicKey: publicKey,
        connection,
        solanaWallet,
        onStatusUpdate: (newStatus) => {
          console.log('Swap status:', newStatus);
          setStatus(newStatus);
        }
      });

      setStatus('Swap completed successfully!');
    } catch (err: any) {
      console.error('Swap error:', err);
      // Don't show raw error in UI
      setStatus('Transaction failed');
    } finally {
      setTimeout(() => {
        setLoading(false);
        setStatus(null);
      }, 2000);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Swap</Text>

      <TextInput
        style={styles.input}
        placeholder="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        editable={!status}
      />

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, swapType === 'buy' && styles.selectedTab]}
          onPress={() => setSwapType('buy')}
          disabled={!!status}>
          <Text
            style={[
              styles.tabText,
              swapType === 'buy' && styles.selectedTabText,
            ]}>
            Buy
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, swapType === 'sell' && styles.selectedTab]}
          onPress={() => setSwapType('sell')}
          disabled={!!status}>
          <Text
            style={[
              styles.tabText,
              swapType === 'sell' && styles.selectedTabText,
            ]}>
            Sell
          </Text>
        </TouchableOpacity>
      </View>

      {status && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, status ? { opacity: 0.7 } : {}]}
        onPress={onPressSwap}
        disabled={!!status}>
        <Text style={styles.buttonText}>
          {swapType === 'buy' ? 'Buy Tokens' : 'Sell Tokens'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
