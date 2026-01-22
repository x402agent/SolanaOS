import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, Image } from 'react-native';
import Icons from '@/assets/svgs';
import { useAuth } from '@/modules/wallet-providers/hooks/useAuth';
import styles from '@/screens/Common/login-screen/LoginScreen.styles';
import { useCustomization } from '@/shared/config/CustomizationProvider';
import { useAppNavigation } from '@/shared/hooks/useAppNavigation';
import { useAppDispatch } from '@/shared/hooks/useReduxHooks';
import { loginSuccess } from '@/shared/state/auth/reducer';
import COLORS from '@/assets/colors';

import type { Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import type { Cluster, PublicKey as SolanaPublicKey } from '@solana/web3.js';

// Add Solana Mobile image import
import SolanaMobileImage from '@/assets/images/solana-mobile.jpg';

type TransactFunction = <T>(
  callback: (wallet: Web3MobileWallet) => Promise<T>
) => Promise<T>;

let transact: TransactFunction | undefined;
let PublicKey: typeof SolanaPublicKey | undefined;
let Buffer: { from: (data: string, encoding: string) => Uint8Array } | undefined;

// Only attempt to load Android-specific modules if we're on Android
// And wrap in try/catch to handle Expo Go environment
if (Platform.OS === 'android') {
  try {
    // Attempt to load MWA module
    const mwaModule = require('@solana-mobile/mobile-wallet-adapter-protocol-web3js');
    transact = mwaModule.transact as TransactFunction;
  } catch (error) {
    console.warn('Mobile Wallet Adapter not available:', error);
  }

  try {
    // Attempt to load Web3 module
    const web3Module = require('@solana/web3.js');
    PublicKey = web3Module.PublicKey;
  } catch (error) {
    console.warn('Solana Web3 module not available:', error);
  }

  try {
    // Attempt to load Buffer module
    const bufferModule = require('buffer');
    Buffer = bufferModule.Buffer;
  } catch (error) {
    console.warn('Buffer module not available:', error);
  }
}

export interface EmbeddedWalletAuthProps {
  onWalletConnected: (info: {
    provider: 'privy' | 'dynamic' | 'turnkey' | 'mwa';
    address: string;
  }) => void;
  authMode?: 'login' | 'signup';
}

const EmbeddedWalletAuth: React.FC<EmbeddedWalletAuthProps> = ({
  onWalletConnected,
  authMode = 'login',
}) => {
  const {
    status,
    loginWithGoogle,
    loginWithApple,
    loginWithEmail,
    user,
    solanaWallet,
  } = useAuth();

  const { auth: authConfig } = useCustomization();
  const navigation = useAppNavigation();
  const dispatch = useAppDispatch();

  // For Dynamic, if user is already authenticated, trigger onWalletConnected immediately
  useEffect(() => {
    if (authConfig.provider === 'dynamic' && status === 'authenticated' && user?.id) {
      console.log('User already authenticated with Dynamic, triggering callback and navigating');
      onWalletConnected({ provider: 'dynamic', address: user.id });

      // Navigate to PlatformSelectionScreen after a short delay
      // The delay ensures the onWalletConnected callback has time to complete
      setTimeout(() => {
        navigation.navigate('MainTabs' as never);
      }, 100);
    }
  }, [authConfig.provider, status, user, onWalletConnected, navigation]);

  const loginWithMWA = async () => {
    // Check if we're on Android AND if all required modules are available
    if (Platform.OS !== 'android') {
      Alert.alert('Not Supported', 'Mobile Wallet Adapter is only available on Android devices');
      return;
    }

    // Check if MWA modules are available (might not be in Expo Go)
    if (!transact || !PublicKey || !Buffer) {
      Alert.alert(
        'Not Available',
        'Mobile Wallet Adapter is not available in this environment. Please use another login method.'
      );
      return;
    }

    const APP_IDENTITY = {
      name: 'Solana App Kit',
      uri: 'https://solanaappkit.com',
      icon: 'favicon.ico',
    };

    try {
      const authorizationResult = await transact(async (wallet: Web3MobileWallet) => {
        return await wallet.authorize({
          chain: 'solana:mainnet',
          identity: APP_IDENTITY,
          sign_in_payload: {
            domain: 'solanaappkit.com',
            statement: 'You are signing in to Solana App Kit',
            uri: 'https://solanaappkit.com',
          },
        });
      });

      if (authorizationResult?.accounts?.length) {
        // Convert base64 pubkey to a Solana PublicKey
        const encodedPublicKey = authorizationResult.accounts[0].address;
        const publicKeyBuffer = Buffer.from(encodedPublicKey, 'base64');
        const publicKey = new PublicKey(publicKeyBuffer);
        const base58Address = publicKey.toBase58();

        console.log('MWA connection successful, address:', base58Address);

        // First dispatch the loginSuccess action directly
        // This ensures the address is immediately available in the Redux store
        dispatch(
          loginSuccess({
            provider: 'mwa',
            address: base58Address,
          })
        );

        // Then call the onWalletConnected callback
        onWalletConnected({
          provider: 'mwa',
          address: base58Address,
        });

        // Navigate to MainTabs after a short delay
        setTimeout(() => {
          navigation.navigate('MainTabs' as never);
        }, 100);
      } else {
        Alert.alert('Connection Error', 'No accounts found in wallet');
      }
    } catch (error) {
      console.error('MWA connection error:', error);
      Alert.alert('Connection Error', 'Failed to connect to wallet');
    }
  };

  // If user + solanaWallet are present, it implies a Privy login
  useEffect(() => {
    if (authConfig.provider === 'privy' && user && onWalletConnected) {
      console.log('Checking Privy wallet status after auth...');
      
      if (!solanaWallet) {
        console.log('Solana wallet not available yet');
        return;
      }
      
      // Check if it's the Privy SDK wallet type with status property
      const isPrivySDKWallet = solanaWallet && 'status' in solanaWallet;
      console.log('Is Privy SDK wallet:', isPrivySDKWallet);
      
      // Handle case where wallet isn't created yet (if it's the SDK type)
      if (isPrivySDKWallet && solanaWallet.status === 'not-created') {
        console.log('Wallet not created, waiting for creation...');
        // We'll let the monitorSolanaWallet function in useAuth handle creation
        return;
      }
      
      // If we have a connected wallet with wallets in the array, use it
      if (solanaWallet.wallets && solanaWallet.wallets.length > 0) {
        const wallet = solanaWallet.wallets[0];
        const walletPublicKey = wallet.publicKey;
        
        // Only proceed if we have a valid public key
        if (walletPublicKey) {
          console.log('Found Solana wallet with public key:', walletPublicKey);
          onWalletConnected({ provider: 'privy', address: walletPublicKey });
        } else {
          console.log('Wallet found but public key is null');
        }
      } else if (isPrivySDKWallet && solanaWallet.status === 'connected') {
        console.log('Wallet shows connected but no wallets in array');
        Alert.alert('Wallet Error', 'Wallet appears connected but no addresses found');
      }
    }
  }, [user, onWalletConnected, solanaWallet, authConfig.provider]);

  // Handle login with error handling
  const handleGoogleLogin = async () => {
    try {
      if (loginWithGoogle) {
        console.log('Logging in with Google and passing navigation');
        await loginWithGoogle();
        // Navigation will now be handled inside loginWithGoogle
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Authentication Error', 'Failed to authenticate with Google. Please try again.');
    }
  };

  const handleAppleLogin = async () => {
    try {
      if (loginWithApple) {
        console.log('Starting Apple login in EmbeddedWallet...');
        
        // Check if we're on iOS
        if (Platform.OS !== 'ios') {
          Alert.alert('Warning', 'Native Apple login is only available on iOS devices');
          return;
        }
        
        await loginWithApple();
        // Navigation will now be handled inside loginWithApple
      }
    } catch (error) {
      console.error('Apple login error in EmbeddedWallet:', error);
      
      // Provide more specific error messages based on error type
      if (error instanceof Error) {
        if (error.message.includes('cancelled') || error.message.includes('cancel')) {
          // User cancelled the login, no need to show an error
          console.log('User cancelled Apple login');
          return;
        } else if (error.message.includes('auth') || error.message.includes('verif')) {
          Alert.alert('Authentication Error', 'Failed to authenticate with Apple. Please check your Apple ID and try again.');
        } else if (error.message.includes('network') || error.message.includes('connect')) {
          Alert.alert('Connection Error', 'Network problem detected. Please check your internet connection and try again.');
        } else if (error.message.includes('No tokens') || error.message.includes('failed to complete')) {
          Alert.alert('Authentication Failed', 'The Apple authentication process did not complete successfully. Please make sure you are signed in to your Apple ID on this device.');
        } else {
          Alert.alert('Authentication Error', 'Failed to authenticate with Apple. Please try again later.');
        }
      } else {
        Alert.alert('Authentication Error', 'Failed to authenticate with Apple. Please try again.');
      }
    }
  };

  const handleEmailLogin = async () => {
    try {
      console.log('Starting email login process...');
      if (loginWithEmail) {
        await loginWithEmail();
        console.log('Email login successful, proceeding to wallet monitoring');
        // The onWalletConnected callback in monitorSolanaWallet will handle the next steps
      }
    } catch (error) {
      console.error('Email login error:', error);
      
      // Provide more specific error messages based on error type
      if (error instanceof Error) {
        if (error.message.includes('auth') || error.message.includes('verif')) {
          Alert.alert('Authentication Error', 'Failed to authenticate with Email. Please check your email and password.');
        } else if (error.message.includes('network') || error.message.includes('connect')) {
          Alert.alert('Connection Error', 'Network problem detected. Please check your internet connection and try again.');
        } else {
          Alert.alert('Authentication Error', 'Failed to authenticate with Email. Please try again later.');
        }
      } else {
        Alert.alert('Authentication Error', 'Failed to authenticate with Email. Please try again.');
      }
    }
  };

  // Arrow component for the right side of buttons
  const ArrowIcon = () => (
    <View style={styles.arrowCircle}>
      <Text style={styles.arrowText}>›</Text>
    </View>
  );

  return (
    <View style={styles.bottomButtonsContainer}>
      {Platform.OS === 'android' && transact && PublicKey && Buffer && (
        <TouchableOpacity style={styles.loginButton} onPress={loginWithMWA}>
          <View style={styles.buttonContent}>
            <Image 
              source={SolanaMobileImage} 
              style={{ width: 24, height: 24, borderRadius: 12 }} 
            />
            <Text style={styles.buttonText}>Continue with MWA</Text>
          </View>
          <ArrowIcon />
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.loginButton} onPress={handleGoogleLogin}>
        <View style={styles.buttonContent}>
          <Icons.Google width={24} height={24} />
          <Text style={styles.buttonText}>Continue with Google</Text>
        </View>
        <ArrowIcon />
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <TouchableOpacity style={styles.loginButton} onPress={handleAppleLogin}>
          <View style={styles.buttonContent}>
            <Icons.Apple width={24} height={24} fill={COLORS.white} />
            <Text style={styles.buttonText}>Continue with Apple</Text>
          </View>
          <ArrowIcon />
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.loginButton} onPress={handleEmailLogin}>
        <View style={styles.buttonContent}>
          <Icons.Device width={24} height={24} stroke={COLORS.white} />
          <Text style={styles.buttonText}>Continue with Email</Text>
        </View>
        <ArrowIcon />
      </TouchableOpacity>
    </View>
  );
};

export default EmbeddedWalletAuth;
