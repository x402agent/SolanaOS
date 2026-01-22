import React, { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  Clipboard,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { usePumpFun } from '../hooks/usePumpFun';
import { PumpfunBuyStyles } from './Pumpfun.styles';
import PumpfunCard from './PumpfunCard';
import { TransactionService } from '../../wallet-providers/services/transaction/transactionService';
import { PumpfunBuySectionProps } from '../types';

export const PumpfunBuySection: React.FC<PumpfunBuySectionProps> = ({
  containerStyle,
  inputStyle,
  buttonStyle,
  buyButtonLabel = 'Buy via Pump.fun',
}) => {
  const { buyToken } = usePumpFun();

  const [tokenAddress, setTokenAddress] = useState('');
  const [solAmount, setSolAmount] = useState('0.001');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleBuy = async () => {
    if (!tokenAddress) {
      Alert.alert('Error', 'Please enter a token address');
      return;
    }

    setIsLoading(true);
    setStatus('Preparing transaction...');
    try {
      await buyToken({
        tokenAddress,
        solAmount: Number(solAmount),
        onStatusUpdate: (newStatus) => {
          console.log('Buy token status:', newStatus);
          // Use TransactionService to filter raw error messages
          TransactionService.filterStatusUpdate(newStatus, setStatus);
        }
      });
      setStatus('Purchase successful!');
      // Success message will be handled by TransactionService
    } catch (error) {
      console.error('Error buying token:', error);
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

  const pasteFromClipboard = async (field: 'token' | 'amount') => {
    try {
      const clipboardContent = await Clipboard.getString();
      if (field === 'token') {
        setTokenAddress(clipboardContent);
      } else {
        setSolAmount(clipboardContent);
      }
    } catch (error) {
      Alert.alert('Paste failed', 'Could not paste from clipboard');
    }
  };

  return (
    <PumpfunCard containerStyle={containerStyle}>
      <Text style={PumpfunBuyStyles.sectionTitle}>Buy Token</Text>

      <Text style={PumpfunBuyStyles.label}>Token Address</Text>
      <TextInput
        style={[PumpfunBuyStyles.input, inputStyle]}
        placeholder="e.g. 5tMi..."
        value={tokenAddress}
        onChangeText={setTokenAddress}
        textAlignVertical="center"
        editable={!isLoading}
        keyboardAppearance="dark"
      />
      <TouchableOpacity
        style={[PumpfunBuyStyles.pasteButton, isLoading && { opacity: 0.5 }]}
        onPress={() => pasteFromClipboard('token')}
        disabled={isLoading}>
        <Text style={PumpfunBuyStyles.pasteButtonText}>Paste</Text>
      </TouchableOpacity>

      <Text style={PumpfunBuyStyles.label}>SOL Amount</Text>
      <TextInput
        style={[PumpfunBuyStyles.input, inputStyle]}
        placeholder="0.001"
        value={solAmount}
        onChangeText={setSolAmount}
        keyboardType="decimal-pad"
        textAlignVertical="center"
        editable={!isLoading}
        keyboardAppearance="dark"
      />
      <TouchableOpacity
        style={[PumpfunBuyStyles.pasteButton, isLoading && { opacity: 0.5 }]}
        onPress={() => pasteFromClipboard('amount')}
        disabled={isLoading}>
        <Text style={PumpfunBuyStyles.pasteButtonText}>Paste</Text>
      </TouchableOpacity>

      {status && (
        <Text style={PumpfunBuyStyles.statusText}>{status}</Text>
      )}

      <TouchableOpacity
        style={[
          PumpfunBuyStyles.buyButton,
          buttonStyle,
          isLoading && { opacity: 0.7 }
        ]}
        onPress={handleBuy}
        disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={PumpfunBuyStyles.buyButtonText}>{buyButtonLabel}</Text>
        )}
      </TouchableOpacity>
    </PumpfunCard>
  );
};

export default PumpfunBuySection;
