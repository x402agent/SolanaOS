import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, Platform, Animated, Easing, TouchableOpacity } from 'react-native';
import { useMoonPaySdk } from '@moonpay/react-native-moonpay-sdk';
import COLORS from '@/assets/colors';
import { useWallet } from '@/modules/wallet-providers/hooks/useWallet';
import 'react-native-url-polyfill/auto';

import { MoonPayWidgetProps } from '../../types';
import { parseErrorMessage, getDefaultParameters } from '../../utils/moonpayUtils';
import { styles } from './styles';

/**
 * MoonPay widget component for adding funds
 * Implements the WebView approach directly within the app with no redirection
 */
function MoonPayWidget({
  apiKey,
  environment = 'sandbox',
  parameters = {},
  onOpen,
  onError,
  height = 500,
  onRetry,
  onTransactionCompleted,
  onClose,
}: MoonPayWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { address } = useWallet();
  const [loadingAnimation] = useState(new Animated.Value(0));
  
  // Setup loading animation
  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(loadingAnimation, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(loadingAnimation, {
            toValue: 0.6,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      loadingAnimation.stopAnimation();
    }
    
    return () => {
      loadingAnimation.stopAnimation();
    };
  }, [loading, loadingAnimation]);
  
  const pulseStyle = {
    opacity: loadingAnimation,
    transform: [
      {
        scale: loadingAnimation.interpolate({
          inputRange: [0.6, 1],
          outputRange: [0.96, 1.04],
        })
      }
    ]
  };

  // Prepare MoonPay parameters with Solana defaults
  const solanaDefaults = getDefaultParameters('solana');
  const moonpayParams = {
    // Start with Solana defaults
    ...solanaDefaults,
    // Use wallet address if provided or from wallet context
    ...(parameters.walletAddress || address ? { 
      walletAddress: parameters.walletAddress || address 
    } : {}),
    // Override with brand styling
    theme: 'dark',
    colorCode: COLORS.brandBlue.replace('#', ''),
    showWalletAddressForm: false,
    // Override with any custom parameters provided
    ...parameters,
    // Ensure apiKey is always present (this will override any accidental override)
    apiKey: apiKey,
  };

  // Remove undefined values and convert boolean to string where needed
  const cleanedParams = Object.entries(moonpayParams).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      // Convert booleans to strings for MoonPay API
      if (typeof value === 'boolean') {
        acc[key] = value.toString();
      } else {
        acc[key] = value;
      }
    }
    return acc;
  }, {} as any);

  // Initialize MoonPay SDK
  const { MoonPayWebViewComponent } = useMoonPaySdk({
    sdkConfig: {
      flow: 'buy',
      environment: environment,
      params: cleanedParams,
    },
  });

  // Setup callback handlers
  useEffect(() => {
    // The component is now available for rendering
    console.log('MoonPay widget initialized successfully with params:', cleanedParams);
  }, [MoonPayWebViewComponent]);

  // Initialize the widget with a timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      if (onOpen) {
        onOpen();
      }
    }, 2000); // Slightly longer loading for better UX
    
    return () => clearTimeout(timer);
  }, [onOpen]);

  // Handle the retry action
  const handleRetry = () => {
    setError(null);
    setLoading(true);
    if (onRetry) onRetry();
    
    // Reset after a short delay
    setTimeout(() => {
      setLoading(false);
    }, 1500);
  };

  // Show loading state while initializing
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { height }]}>
        <Animated.View style={[styles.loaderWrapper, pulseStyle]}>
          <ActivityIndicator size="large" color={COLORS.brandBlue} />
        </Animated.View>
        <Text style={styles.loadingText}>Preparing Payment Gateway</Text>
        <Text style={styles.loadingSubtext}>
          Setting up a secure connection...
        </Text>
      </View>
    );
  }
  
  // Show error state if there was a problem
  if (error) {
    const errorMessage = parseErrorMessage(error);
    
    return (
      <View style={[styles.errorContainer, { height }]}>
        <View style={styles.errorIconContainer}>
          <Text style={{ fontSize: 24, color: COLORS.errorRed }}>!</Text>
        </View>
        <Text style={styles.errorTitle}>Connection Error</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.8}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Render MoonPayWebViewComponent if available
  if (MoonPayWebViewComponent) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.webViewWrapper}>
          <MoonPayWebViewComponent />
        </View>
      </View>
    );
  }

  // Fallback message if no WebView or URL is available
  return (
    <View style={[styles.errorContainer, { height }]}>
      <View style={styles.errorIconContainer}>
        <Text style={{ fontSize: 24, color: COLORS.errorRed }}>!</Text>
      </View>
      <Text style={styles.errorTitle}>Configuration Error</Text>
      <Text style={styles.errorText}>
        The MoonPay payment gateway cannot be loaded. This could be due to an invalid API key or a network issue.
      </Text>
      <TouchableOpacity style={styles.retryButton} onPress={handleRetry} activeOpacity={0.8}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

export default MoonPayWidget; 