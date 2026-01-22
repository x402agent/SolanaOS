// File: src/screens/TokenMillScreen/components/VestingCard.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { VestingCardProps } from '../types';
import { createVesting, releaseVesting } from '../services/tokenMillService';
import { VestingCardStyles as styles } from './styles/VestingCard.style';

export default function VestingCard({
  marketAddress,
  baseTokenMint,
  vestingPlanAddress,
  setVestingPlanAddress,
  connection,
  publicKey,
  solanaWallet,
  setLoading,
}: VestingCardProps) {
  const [vestingAmount, setVestingAmount] = useState('10000');
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [releaseStatus, setReleaseStatus] = useState<string | null>(null);

  const onPressCreateVesting = async () => {
    if (!marketAddress) {
      Alert.alert('No market', 'Please enter or create a market first!');
      return;
    }
    if (!baseTokenMint) {
      Alert.alert('No token', 'Please enter or create a token first!');
      return;
    }
    try {
      setLoading(true);
      setCreateStatus('Preparing vesting transaction...');

      const { txSignature, ephemeralVestingPubkey } = await createVesting({
        marketAddress,
        baseTokenMint,
        vestingAmount: parseInt(vestingAmount, 10),
        userPublicKey: publicKey,
        connection,
        solanaWallet,
        onStatusUpdate: (newStatus) => {
          console.log('Create vesting status:', newStatus);
          setCreateStatus(newStatus);
        }
      });

      setCreateStatus('Vesting plan created successfully!');
      setVestingPlanAddress(ephemeralVestingPubkey);
    } catch (err: any) {
      console.error('Create vesting error:', err);
      // Don't show raw error in UI
      setCreateStatus('Transaction failed');
    } finally {
      setTimeout(() => {
        setLoading(false);
        setCreateStatus(null);
      }, 2000);
    }
  };

  const onPressReleaseVesting = async () => {
    if (!marketAddress) {
      Alert.alert('No market', 'Please enter or create a market first!');
      return;
    }
    if (!baseTokenMint) {
      Alert.alert('No token', 'Please enter or create a token first!');
      return;
    }
    if (!vestingPlanAddress) {
      Alert.alert('No vesting plan', 'Please create a vesting plan first!');
      return;
    }
    try {
      setLoading(true);
      setReleaseStatus('Preparing release transaction...');

      const txSig = await releaseVesting({
        marketAddress,
        vestingPlanAddress,
        baseTokenMint,
        userPublicKey: publicKey,
        connection,
        solanaWallet,
        onStatusUpdate: (newStatus) => {
          console.log('Release vesting status:', newStatus);
          setReleaseStatus(newStatus);
        }
      });

      setReleaseStatus('Vesting released successfully!');
    } catch (err: any) {
      console.error('Release vesting error:', err);
      // Don't show raw error in UI
      setReleaseStatus('Transaction failed');
    } finally {
      setTimeout(() => {
        setLoading(false);
        setReleaseStatus(null);
      }, 2000);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Vesting</Text>
      <TextInput
        style={styles.input}
        placeholder="Vesting Amount"
        value={vestingAmount}
        onChangeText={setVestingAmount}
        editable={!createStatus && !releaseStatus}
      />

      {createStatus && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>{createStatus}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, createStatus ? { opacity: 0.7 } : {}]}
        onPress={onPressCreateVesting}
        disabled={!!createStatus || !!releaseStatus}>
        <Text style={styles.buttonText}>Create Vesting Plan</Text>
      </TouchableOpacity>

      {vestingPlanAddress ? (
        <View style={styles.vestingDetails}>
          <Text style={styles.vestingDetailsText}>
            Vesting Plan: {vestingPlanAddress.slice(0, 12)}...
          </Text>

          {releaseStatus && (
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>{releaseStatus}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.releaseButton, releaseStatus ? { opacity: 0.7 } : {}]}
            onPress={onPressReleaseVesting}
            disabled={!!createStatus || !!releaseStatus}>
            <Text style={styles.buttonText}>Release Vesting</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
