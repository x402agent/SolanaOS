// File: src/screens/TokenMillScreen/components/FundMarketCard.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { FundMarketCardProps } from '../types';
import { fundMarket } from '../services/tokenMillService';
import { FundMarketCardStyles as styles } from './styles/FundMarketCard.style';

export default function FundMarketCard({
  marketAddress,
  connection,
  publicKey,
  solanaWallet,
  setLoading,
}: FundMarketCardProps) {
  const [status, setStatus] = useState<string | null>(null);

  const onPressFund = async () => {
    try {
      setLoading(true);
      setStatus('Preparing transaction...');

      const txSig = await fundMarket({
        marketAddress,
        userPublicKey: publicKey,
        connection,
        solanaWallet,
        onStatusUpdate: (newStatus) => {
          console.log('Market funding status:', newStatus);
          setStatus(newStatus);
        }
      });

      setStatus('Transaction successful!');
    } catch (err: any) {
      console.error('Fund market error:', err);
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
      <Text style={styles.sectionTitle}>Fund Market</Text>
      {status && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.button, status ? { opacity: 0.7 } : {}]}
        onPress={onPressFund}
        disabled={!!status}>
        <Text style={styles.buttonText}>Fund Market with 0.1 SOL</Text>
      </TouchableOpacity>
    </View>
  );
}
