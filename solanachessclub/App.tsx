// App.tsx
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;

// Add a global dev mode flag that can be used anywhere in the app
import AsyncStorage from '@react-native-async-storage/async-storage';

// Declare global type for TypeScript
declare global {
  namespace NodeJS {
    interface Global {
      __DEV_MODE__: boolean;
    }
  }
  var __DEV_MODE__: boolean;
}

// Set a global __DEV_MODE__ flag during app initialization
global.__DEV_MODE__ = global.__DEV_MODE__ || false;

// Function to explicitly set dev mode for Expo Go
const forceDevMode = async () => {
  try {
    // Check if we're running yarn start --dev by looking at the app launch URL
    // This code will run before any React component mounts
    if (__DEV__) {
      // Check for dev mode in storage
      const storedDevMode = await AsyncStorage.getItem('devMode');

      // HACK: We know when start.js was run with --dev, we created a file
      // Try to read this manually from AsyncStorage which persists between runs
      const isInDevMode = storedDevMode === 'true';

      // Set the global flag
      global.__DEV_MODE__ = isInDevMode;

      console.log('[DEV MODE] Direct detection at startup:', {
        isInDevMode,
        storedDevMode,
      });

      if (isInDevMode) {
        // FORCE DEV MODE WHEN DETECTED
        console.log('🟢 FORCE-ENABLING DEV MODE AT APP STARTUP');
      }
    }
  } catch (error) {
    console.error('[DEV MODE] Error in direct detection:', error);
  }
};

// Run this immediately at app startup
forceDevMode().catch(console.error);

import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/shared/navigation/RootNavigator';
import { navigationRef } from './src/shared/hooks/useAppNavigation';
import { store, persistor } from './src/shared/state/store';
import './src/shared/utils/polyfills';
import COLORS from './src/assets/colors';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { PersistGate } from 'redux-persist/integration/react';

import { PrivyProvider, PrivyElements } from '@privy-io/expo';
import { TurnkeyProvider } from '@turnkey/sdk-react-native';

// Dynamic client initialization
import {
  getDynamicClient,
  initDynamicClient,
} from './src/modules/wallet-providers/services/walletProviders/dynamic';
import TransactionNotification from './src/core/shared-ui/TransactionNotification';

// Import DevMode components
import DevDrawer from './src/core/dev-mode/DevDrawer';

// Import Environment Error provider and new components
import DevModeStatusBar from './src/core/dev-mode/DevModeStatusBar';
import { DevModeProvider, useDevMode } from '@/shared/context/DevModeContext';
import { DefaultCustomizationConfig } from '@/shared/config';
import { CustomizationProvider } from '@/shared/config/CustomizationProvider';
import { EnvErrorProvider, useEnvError } from '@/shared/context/EnvErrorContext';
import { EnvWarningDrawer } from './src/core/dev-mode';

// Import notification service
import notificationService from './src/shared/services/notificationService';

// Component that conditionally renders dev tools
const DevModeComponents = () => {
  const { isDevMode } = useDevMode();

  if (!isDevMode) return null;

  return (
    <>
      <DevModeStatusBar />
      <DevDrawer />
    </>
  );
};

// Component that conditionally renders standard mode warnings
const StandardModeComponents = () => {
  const { isDevMode } = useDevMode();
  const { hasMissingEnvVars } = useEnvError();

  // Only render in standard mode (not dev mode) when there are missing env vars
  if (isDevMode || !hasMissingEnvVars) return null;

  return (
    <EnvWarningDrawer />
  );
};

// Loading component for PersistGate
const PersistLoading = () => (
  <View
    style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: COLORS.background,
    }}>
    <ActivityIndicator size="large" color={COLORS.brandPrimary} />
  </View>
);

export default function App() {
  const config = DefaultCustomizationConfig;
  const [dynamicInitialized, setDynamicInitialized] = useState(false);

  useEffect(() => {
    if (config.auth.provider === 'dynamic') {
      try {
        initDynamicClient(
          config.auth.dynamic.environmentId,
          config.auth.dynamic.appName,
          config.auth.dynamic.appLogoUrl,
        );
        setDynamicInitialized(true);
      } catch (error) {
        console.error('Failed to initialize Dynamic client:', error);
      }
    }
  }, [config.auth.provider]);

  // Initialize notification service
  useEffect(() => {
    const initNotifications = async () => {
      try {
        await notificationService.initialize();
        console.log('🔔 Notification service ready');
      } catch (error) {
        console.error('❌ Failed to initialize notifications:', error);
      }
    };

    initNotifications();

    // Cleanup on unmount
    return () => {
      notificationService.cleanup();
    };
  }, []);

  // Get Dynamic client after initialization is complete
  const getDynamicWebView = () => {
    if (!dynamicInitialized) return null;

    try {
      const client = getDynamicClient();
      return client?.reactNative?.WebView ? (
        <client.reactNative.WebView />
      ) : null;
    } catch (error) {
      console.error('Error getting Dynamic WebView:', error);
      return null;
    }
  };

  // Component to render notification and any other global UI elements
  const GlobalUIElements = () => (
    <>
      <TransactionNotification />
    </>
  );

  // Configure Turnkey session
  const turnkeySessionConfig = {
    apiBaseUrl: config.auth.turnkey.baseUrl,
    organizationId: config.auth.turnkey.organizationId,
  };

  // Wrap the app with EnvErrorProvider for global env variable error handling
  return (
    <CustomizationProvider config={config}>
      <SafeAreaProvider>
        <StatusBar backgroundColor={COLORS.background} barStyle="light-content" translucent={true} />
        <ReduxProvider store={store}>
          <PersistGate loading={<PersistLoading />} persistor={persistor}>
            <DevModeProvider>
              <EnvErrorProvider>
                <View style={{ flex: 1, backgroundColor: COLORS.background }}>
                  {config.auth.provider === 'privy' ? (
                    <PrivyProvider
                      appId={config.auth.privy.appId}
                      clientId={config.auth.privy.clientId}
                      config={{
                        embedded: {
                          solana: {
                            createOnLogin: 'users-without-wallets',
                          },
                        },
                      }}>
                      <NavigationContainer ref={navigationRef}>
                        <RootNavigator />
                      </NavigationContainer>
                      {getDynamicWebView()}
                      <GlobalUIElements />
                      <PrivyElements />
                    </PrivyProvider>
                  ) : config.auth.provider === 'turnkey' ? (
                    <TurnkeyProvider config={turnkeySessionConfig}>
                      <NavigationContainer ref={navigationRef}>
                        <RootNavigator />
                      </NavigationContainer>
                      {getDynamicWebView()}
                      <GlobalUIElements />
                    </TurnkeyProvider>
                  ) : (
                    <>
                      <NavigationContainer ref={navigationRef}>
                        <RootNavigator />
                      </NavigationContainer>
                      {getDynamicWebView()}
                      <GlobalUIElements />
                    </>
                  )}

                  {/* DevMode components will only render in dev mode */}
                  <DevModeComponents />

                  {/* Standard mode warnings will only render in standard mode */}
                  <StandardModeComponents />
                </View>
              </EnvErrorProvider>
            </DevModeProvider>
          </PersistGate>
        </ReduxProvider>
      </SafeAreaProvider>
    </CustomizationProvider>
  );
}
