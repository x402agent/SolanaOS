import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { OtpResponse } from '../../hooks/useTurnkeyWalletLogic';
import { useAppNavigation } from '@/shared/hooks/useAppNavigation';

interface TurnkeyOtpScreenProps {
  otpResponse: OtpResponse;
  onVerify: (otpCode: string) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

const TurnkeyOtpScreen: React.FC<TurnkeyOtpScreenProps> = ({
  otpResponse,
  onVerify,
  onCancel,
  loading,
}) => {
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Array<TextInput | null>>([null, null, null, null, null, null, null, null, null]);
  const navigation = useAppNavigation();

  // When otpCode changes, move focus to the next input
  useEffect(() => {
    if (otpCode.length === 9) {
      // When all characters are entered, verify the OTP
      handleVerify();
    }
  }, [otpCode]);

  const handleInputChange = (text: string, index: number) => {
    // Accept any alphanumeric character (removed digit-only check)
    // Convert to uppercase for consistency
    const upperText = text.toUpperCase();

    // Update the OTP code
    const newOtpCode = otpCode.split('');
    newOtpCode[index] = upperText;
    setOtpCode(newOtpCode.join(''));

    // Move focus to the next input if text was entered
    if (upperText && index < 8) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && index > 0 && !otpCode[index]) {
      // Move to previous input on backspace if current input is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (otpCode.length !== 9) {
      setError('Please enter the complete verification code');
      return;
    }

    setError(null);
    try {
      await onVerify(otpCode);
    } catch (err: any) {
      setError(err.message || 'Failed to verify code');
      // Reset OTP code on error
      setOtpCode('');
      // Focus on the first input
      inputRefs.current[0]?.focus();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Enter Verification Code</Text>
        <Text style={styles.subtitle}>
          Please enter the code sent to your email
        </Text>

        <View style={styles.otpContainer}>
          {Array(9)
            .fill(0)
            .map((_, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={styles.otpInput}
                value={otpCode[index] || ''}
                onChangeText={(text) => handleInputChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="default"
                autoCapitalize="characters"
                maxLength={1}
                secureTextEntry={false}
                autoFocus={index === 0}
              />
            ))}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.verifyButton, loading && styles.disabledButton]}
            onPress={handleVerify}
            disabled={otpCode.length !== 9 || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 30,
    flexWrap: 'wrap', // Allow wrapping for the longer code
  },
  otpInput: {
    width: 40,
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    fontSize: 22,
    textAlign: 'center',
    margin: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f1f1f1',
  },
  verifyButton: {
    backgroundColor: '#4F46E5',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorText: {
    color: 'red',
    marginBottom: 20,
    textAlign: 'center',
  },
});

export default TurnkeyOtpScreen; 