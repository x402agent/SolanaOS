// File: src/modules/tokenMill/components/StakingCard.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { StakingCardProps } from '../types';
import { stakeTokens } from '../services/tokenMillService';
import { StakingCardStyles as styles } from './styles/StakingCard.style';

export default function StakingCard({
  marketAddress,
  connection,
  publicKey,
  solanaWallet,
  setLoading,
}: StakingCardProps) {
  const [status, setStatus] = useState<string | null>(null);

  const onPressStake = async () => {
    if (!marketAddress) {
      Alert.alert('No market', 'Please enter or create a market first!');
      return;
    }
    try {
      setLoading(true);
      setStatus('Preparing staking transaction...');

      const txSig = await stakeTokens({
        marketAddress,
        amount: 100,
        userPublicKey: publicKey,
        connection,
        solanaWallet,
        onStatusUpdate: (newStatus) => {
          console.log('Staking status:', newStatus);
          setStatus(newStatus);
        }
      });

      setStatus('Tokens staked successfully!');
    } catch (err: any) {
      console.error('Staking error:', err);
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
      <Text style={styles.sectionTitle}>Staking</Text>
      {status && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.button, status ? { opacity: 0.7 } : {}]}
        onPress={onPressStake}
        disabled={!!status}>
        <Text style={styles.buttonText}>Stake 100 Tokens</Text>
      </TouchableOpacity>
    </View>
  );
}
