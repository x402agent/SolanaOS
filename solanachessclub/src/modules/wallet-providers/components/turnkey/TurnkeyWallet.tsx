import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import Icons from '@/assets/svgs';
import { useAuth } from '@/modules/wallet-providers/hooks/useAuth';
import { useCustomization } from '@/shared/config/CustomizationProvider';
import {useAppNavigation} from '@/shared/hooks/useAppNavigation';
import {useAppDispatch} from '@/shared/hooks/useReduxHooks';
import {loginSuccess} from '@/shared/state/auth/reducer';
import TurnkeyEmailScreen from './TurnkeyEmailScreen';
import TurnkeyOtpScreen from './TurnkeyOtpScreen';
import { OtpResponse } from '../../hooks/useTurnkeyWalletLogic';

export interface TurnkeyWalletAuthProps {
  onWalletConnected: (info: {
    provider: 'privy' | 'dynamic' | 'turnkey' | 'mwa';
    address: string;
  }) => void;
  authMode?: 'login' | 'signup';
}

const TurnkeyWalletAuth: React.FC<TurnkeyWalletAuthProps> = ({
  onWalletConnected,
  authMode = 'login',
}) => {
  const {
    status,
    loginWithGoogle,
    loginWithApple,
    loginWithEmail,
    initEmailOtpLogin,
    verifyEmailOtp,
    user,
    otpResponse,
    loading,
  } = useAuth();

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  
  const { auth: authConfig } = useCustomization();
  const navigation = useAppNavigation();
  const dispatch = useAppDispatch();

  // Handle successful authentication and navigation
  const handleAuthSuccess = (address: string) => {
    dispatch(
      loginSuccess({
        provider: 'turnkey',
        address: address,
      })
    );
    
    onWalletConnected({
      provider: 'turnkey',
      address: address
    });
    
    // Navigate to MainTabs after a short delay
    setTimeout(() => {
      navigation.navigate('MainTabs' as never);
    }, 100);
  };
  
  // Handle Google authentication
  const handleGoogleLogin = async () => {
    if (loginWithGoogle) {
      try {
        const result = await loginWithGoogle();
        if (result && result.address) {
          handleAuthSuccess(result.address);
        }
      } catch (error) {
        console.error('Google login error:', error);
      }
    }
  };
  
  // Handle Apple authentication
  const handleAppleLogin = async () => {
    if (loginWithApple) {
      try {
        const result = await loginWithApple();
        if (result && result.address) {
          handleAuthSuccess(result.address);
        }
      } catch (error) {
        console.error('Apple login error:', error);
      }
    }
  };
  
  // Show email input modal
  const showEmailInput = () => {
    setShowEmailModal(true);
  };
  
  // Handle email submission for OTP
  const handleEmailSubmit = async (email: string) => {
    try {
      if (!initEmailOtpLogin) {
        throw new Error('Email OTP login not available');
      }
      await initEmailOtpLogin(email);
      setShowEmailModal(false);
      setShowOtpModal(true);
    } catch (error) {
      console.error('Failed to initiate OTP login:', error);
    }
  };
  
  // Handle OTP verification
  const handleOtpVerify = async (otpCode: string) => {
    try {
      if (!verifyEmailOtp) {
        throw new Error('Email OTP verification not available');
      }
      const result = await verifyEmailOtp(otpCode);
      if (result && result.address) {
        setShowOtpModal(false);
        handleAuthSuccess(result.address);
      }
    } catch (error) {
      console.error('Failed to verify OTP:', error);
      throw error;
    }
  };
  
  return (
    <View style={styles.bottomButtonsContainer}>
      <TouchableOpacity style={styles.loginButton} onPress={handleGoogleLogin}>
        <Icons.Google width={24} height={24} />
        <Text style={styles.buttonText}>Continue with Google</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.loginButton} onPress={handleAppleLogin}>
        <Icons.Apple width={24} height={24} />
        <Text style={styles.buttonText}>Continue with Apple</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.loginButton]} onPress={showEmailInput}>
        <Icons.Device width={24} height={24} />
        <Text style={[styles.buttonText]}>Continue with Email</Text>
      </TouchableOpacity>
      
      {/* Email Input Modal */}
      <Modal
        visible={showEmailModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEmailModal(false)}
      >
        <TurnkeyEmailScreen
          onSubmit={handleEmailSubmit}
          onCancel={() => setShowEmailModal(false)}
          loading={loading || false}
        />
      </Modal>
      
      {/* OTP Verification Modal */}
      <Modal
        visible={showOtpModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOtpModal(false)}
      >
        {otpResponse && (
          <TurnkeyOtpScreen
            otpResponse={otpResponse}
            onVerify={handleOtpVerify}
            onCancel={() => setShowOtpModal(false)}
            loading={loading || false}
          />
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomButtonsContainer: {
    width: '100%',
    paddingHorizontal: 16,
    gap: 12,
  },
  loginButton: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  buttonText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TurnkeyWalletAuth; 