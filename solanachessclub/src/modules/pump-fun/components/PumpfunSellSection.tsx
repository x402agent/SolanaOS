import React, { useState, useEffect } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleProp,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { usePumpFun } from '../hooks/usePumpFun';
import { PumpfunSellStyles } from './Pumpfun.styles';
import PumpfunCard from './PumpfunCard';
import { TransactionService } from '../../wallet-providers/services/transaction/transactionService';
import { PumpfunSellSectionProps } from '../types';


export const PumpfunSellSection: React.FC<PumpfunSellSectionProps> = ({
  selectedToken,
  containerStyle,
  inputStyle,
  buttonStyle,
  sellButtonLabel = 'Sell Token',
}) => {
  const { sellToken } = usePumpFun();

  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenAmount, setTokenAmount] = useState('0.0');
  const [estimatedFee, setEstimatedFee] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (selectedToken) {
      setTokenAddress(selectedToken.mintPubkey);
    }
  }, [selectedToken]);

  useEffect(() => {
    // Only calculate fee when we have a valid number and not on every keystroke
    const amount = parseFloat(tokenAmount);
    if (!isNaN(amount) && amount > 0) {
      // Use a fixed base fee instead of random values
      const baseFeeInLamports = 5000;
      // Small deterministic adjustment based on token amount (if needed)
      const adjustedFee = baseFeeInLamports + (amount * 100);
      const estimateSol = adjustedFee / 1e9;
      setEstimatedFee(estimateSol);
    }
  }, [tokenAmount]);

  const handleSell = async () => {
    if (!tokenAddress) {
      Alert.alert('Error', 'Please enter or select a token address');
      return;
    }
    if (!tokenAmount || Number(tokenAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid token amount');
      return;
    }

    setIsLoading(true);
    setStatus('Preparing transaction...');

    try {
      await sellToken({
        tokenAddress,
        tokenAmount: Number(tokenAmount),
        onStatusUpdate: (newStatus) => {
          console.log('Sell token status:', newStatus);
          // Use TransactionService to filter raw error messages
          TransactionService.filterStatusUpdate(newStatus, setStatus);
        }
      });
      setStatus('Sale successful!');
      // Success message will be handled by TransactionService
    } catch (error) {
      console.error('Error selling token:', error);
      // Don't show raw error in UI
      setStatus('Transaction failed');
      // Error notification will be handled by TransactionService
    } finally {
      setTimeout(() => {
        setIsLoading(false);
        setStatus(null);
      }, 2000);
    }
  };

  const handleMax = () => {
    if (selectedToken) {
      setTokenAmount(String(selectedToken.uiAmount));
    }
  };

  return (
    <PumpfunCard containerStyle={containerStyle}>
      <Text style={PumpfunSellStyles.sectionTitle}>Sell Token</Text>

      {!selectedToken && (
        <>
          <Text style={PumpfunSellStyles.label}>Token Address</Text>
          <TextInput
            style={[PumpfunSellStyles.input, inputStyle]}
            placeholder="e.g. 5tMi..."
            value={tokenAddress}
            onChangeText={setTokenAddress}
            editable={!isLoading}
            keyboardAppearance="dark"
          />
        </>
      )}

      <Text style={PumpfunSellStyles.label}>Amount to Sell</Text>
      <TextInput
        style={[PumpfunSellStyles.input, inputStyle]}
        placeholder="1.0"
        value={tokenAmount}
        onChangeText={setTokenAmount}
        keyboardType="decimal-pad"
        editable={!isLoading}
        keyboardAppearance="dark"
      />
      {selectedToken && (
        <TouchableOpacity
          style={[PumpfunSellStyles.maxButton, isLoading && { opacity: 0.5 }]}
          onPress={handleMax}
          disabled={isLoading}>
          <Text style={PumpfunSellStyles.maxButtonText}>Max</Text>
        </TouchableOpacity>
      )}

      {estimatedFee !== null && (
        <Text style={PumpfunSellStyles.feeEstimate}>
          Estimated Network Fee: ~{estimatedFee.toFixed(6)} SOL
        </Text>
      )}

      {status && (
        <Text style={PumpfunSellStyles.statusText}>{status}</Text>
      )}

      <TouchableOpacity
        style={[PumpfunSellStyles.sellButton, buttonStyle, isLoading && { opacity: 0.7 }]}
        onPress={handleSell}
        disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={PumpfunSellStyles.sellButtonText}>{sellButtonLabel}</Text>
        )}
      </TouchableOpacity>
    </PumpfunCard>
  );
};

export default PumpfunSellSection;
