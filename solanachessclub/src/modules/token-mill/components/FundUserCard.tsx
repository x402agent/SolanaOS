// File: src/screens/TokenMillScreen/components/FundUserCard.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { FundUserCardProps } from '../types';
import { fundUserWithWSOL } from '../services/tokenMillService';
import { FundUserCardStyles as styles } from './styles/FundUserCard.style';

export default function FundUserCard({
  connection,
  publicKey,
  solanaWallet,
  setLoading,
}: FundUserCardProps) {
  const [status, setStatus] = useState<string | null>(null);

  const onPressFund = async () => {
    try {
      setLoading(true);
      setStatus('Preparing transaction...');

      // Call the service with the full wallet object
      const txSig = await fundUserWithWSOL({
        solAmount: 0.5,
        connection,
        signerPublicKey: publicKey,
        solanaWallet, // Pass the full wallet object
        onStatusUpdate: (newStatus) => {
          console.log('Fund user status:', newStatus);
          setStatus(newStatus);
        }
      });

      setStatus('Transaction successful!');
    } catch (err: any) {
      console.error('Fund user error:', err);
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
      <Text style={styles.sectionTitle}>Fund User wSOL</Text>
      {status && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.button, status ? { opacity: 0.7 } : {}]}
        onPress={onPressFund}
        disabled={!!status}>
        <Text style={styles.buttonText}>Fund User with 0.5 SOL - wSOL</Text>
      </TouchableOpacity>
    </View>
  );
}
