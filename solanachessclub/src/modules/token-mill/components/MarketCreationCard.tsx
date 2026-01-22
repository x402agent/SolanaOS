// File: src/screens/TokenMillScreen/components/MarketCreationCard.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MarketCreationCardProps } from '../types';
import { createMarket } from '../services/tokenMillService';
import COLORS from '@/assets/colors';
import Icons from '@/assets/svgs';

export default function MarketCreationCard({
  connection,
  publicKey,
  solanaWallet,
  setLoading,
  onMarketCreated,
}: MarketCreationCardProps) {
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [metadataUri, setMetadataUri] = useState('https://arweave.net/abc123');
  const [totalSupply, setTotalSupply] = useState('1000000');
  const [creatorFee, setCreatorFee] = useState('4000');
  const [stakingFee, setStakingFee] = useState('4000');
  const [status, setStatus] = useState<string | null>(null);

  const onPressCreateMarket = async () => {
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

      const { txSignature, marketAddress, baseTokenMint } = await createMarket({
        tokenName,
        tokenSymbol,
        metadataUri,
        totalSupply: parseInt(totalSupply, 10),
        creatorFee: parseInt(creatorFee, 10),
        stakingFee: parseInt(stakingFee, 10),
        userPublicKey: publicKey,
        connection,
        solanaWallet,
        onStatusUpdate: (newStatus) => {
          console.log('Create market status:', newStatus);
          setStatus(newStatus);
        }
      });

      setStatus('Market created successfully!');
      onMarketCreated(marketAddress, baseTokenMint);
    } catch (err: any) {
      console.error('Create market error:', err);
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
    <View style={styles.container}>
      <View style={styles.formField}>
        <Text style={styles.fieldLabel}>Token Name</Text>
        <TextInput
          style={styles.input}
          placeholder="..."
          placeholderTextColor={COLORS.greyMid}
          value={tokenName}
          onChangeText={setTokenName}
          editable={!status}
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
          editable={!status}
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
          editable={!status}
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
          editable={!status}
        />
      </View>

      <View style={styles.formField}>
        <Text style={styles.fieldLabel}>Creator Fee</Text>
        <TextInput
          style={styles.input}
          placeholder="3300"
          placeholderTextColor={COLORS.greyMid}
          value={creatorFee}
          onChangeText={setCreatorFee}
          keyboardType="numeric"
          editable={!status}
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
          editable={!status}
        />
      </View>

      <View style={styles.infoBox}>
        <View style={styles.infoHeader}>
          <Icons.NFTIcon width={20} height={20} color={COLORS.brandBlue} />
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
          <ActivityIndicator size="small" color={COLORS.brandBlue} style={styles.loader} />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, status ? styles.disabledButton : {}]}
          onPress={onPressCreateMarket}
          disabled={!!status}>
          <Text style={styles.buttonText}>Create Market</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
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
  buttonRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  button: {
    backgroundColor: COLORS.brandBlue,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 180,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lighterBackground,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  loader: {
    marginRight: 10,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 14,
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
    marginBottom: 8,
  },
  infoHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  infoDivider: {
    height: 1,
    backgroundColor: COLORS.borderDarkColor,
    marginVertical: 8,
  },
  infoContent: {
    // Add appropriate styles for the content container
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  feeIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  infoText: {
    color: COLORS.white,
    fontSize: 14,
  },
  infoTextBold: {
    fontWeight: 'bold',
  },
  ruleContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 8,
  },
  ruleText: {
    color: COLORS.white,
    fontSize: 14,
  },
});
