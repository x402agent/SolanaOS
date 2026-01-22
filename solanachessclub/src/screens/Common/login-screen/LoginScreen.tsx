import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Text, Dimensions, Alert, Platform, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as Linking from 'expo-linking';
import Icons from '@/assets/svgs/index';
import styles from '@/screens/Common/login-screen/LoginScreen.styles';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '@/shared/hooks/useReduxHooks';
import { useAppNavigation } from '@/shared/hooks/useAppNavigation';
import EmbeddedWalletAuth from '@/modules/wallet-providers/components/wallet/EmbeddedWallet';
import TurnkeyWalletAuth from '@/modules/wallet-providers/components/turnkey/TurnkeyWallet';
import { loginSuccess, fetchUserProfile, updateProfilePic } from '@/shared/state/auth/reducer';
import { RootState } from '@/shared/state/store';
import { useCustomization } from '@/shared/config/CustomizationProvider';
import axios from 'axios';
import { SERVER_URL } from '@env';
import COLORS from '@/assets/colors';
import { useEnvError } from '@/shared/context/EnvErrorContext';
import { useDevMode } from '@/shared/context/DevModeContext';
import { generateAndStoreAvatar } from '@/shared/services/diceBearAvatarService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SERVER_BASE_URL = SERVER_URL || 'http://localhost:3000';

// SVG animation configurations
const SVG_CONFIG = {
  circle: {
    initialPosition: { top: SCREEN_HEIGHT * 0.51, left: SCREEN_WIDTH * 0.06 },
    size: { width: 80, height: 80 },
    animation: { type: 'rotate', duration: 10000 },
  },
  leftStar: {
    initialPosition: { top: SCREEN_HEIGHT * 0.42, left: 80 },
    size: { width: 24, height: 24 },
    animation: { type: 'fadeInOut', duration: 3000 },
  },
  leftEllipse: {
    initialPosition: { top: SCREEN_HEIGHT * 0.23, left: -SCREEN_WIDTH * 0.55 },
    size: { width: 340, height: 340 },
  },
  plus: {
    initialPosition: { top: SCREEN_HEIGHT * 0.3, left: SCREEN_WIDTH * 0.13 },
    size: { width: 80, height: 80 },
    animation: { type: 'jerkyRotate', duration: 3000 },
  },
  rect: {
    initialPosition: { top: SCREEN_HEIGHT * 0.34, left: SCREEN_WIDTH * 0.34 },
    size: { width: 58, height: 58 },
    animation: { type: 'rotate', duration: 6000 },
  },
  yellowBoomerang: {
    initialPosition: { top: SCREEN_HEIGHT * 0.43, left: SCREEN_WIDTH * 0.27 },
    size: { width: 80, height: 80 },
    animation: { type: 'fadeInOut', duration: 5000 },
  },
  setting: {
    initialPosition: { top: SCREEN_HEIGHT * 0.36, left: -63 },
    size: { width: 130, height: 130 },
    animation: { type: 'varyingSpeedRotate', duration: 8000 },
  },
  // Right SVG configurations
  rightRectangle: {
    initialPosition: { top: SCREEN_HEIGHT * 0.53, right: SCREEN_WIDTH * 0.27 },
    size: { width: 60, height: 60 },
    animation: { type: 'rotate', duration: 8000 },
  },
  rightSwap: {
    initialPosition: { top: SCREEN_HEIGHT * 0.5, right: SCREEN_WIDTH * 0.04 },
    size: { width: 100, height: 100 },
    animation: { type: 'jerkyRotate', duration: 4000 },
  },
  rightBoomerang: {
    initialPosition: { top: SCREEN_HEIGHT * 0.4, right: SCREEN_WIDTH * 0.2 },
    size: { width: 80, height: 80 },
    animation: { type: 'fadeInOut', duration: 4500 },
  },
  rightGrid: {
    initialPosition: { top: SCREEN_HEIGHT * 0.25, right: -SCREEN_WIDTH * 0.11 },
    size: { width: 100, height: 100 },
    animation: { type: 'pulseScale', duration: 3000 },
  },
  rightZigzag: {
    initialPosition: { top: SCREEN_HEIGHT * 0.36, right: -SCREEN_WIDTH * 0.25 },
    size: { width: 160, height: 160 },
    animation: { type: 'fadeInOut', duration: 6000 },
  },
  rightEllipse: {
    initialPosition: { top: SCREEN_HEIGHT * 0.23, right: -SCREEN_WIDTH * 0.55 },
    size: { width: 340, height: 340 },
  },
};

export default function LoginScreen() {
  const navigation = useAppNavigation();
  const dispatch = useAppDispatch();
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const { auth: authConfig } = useCustomization();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const { isDevMode } = useDevMode();
  const { hasMissingEnvVars, missingEnvVars } = useEnvError();
  const [showWarning, setShowWarning] = useState(true);

  // State for app info that needs to be loaded asynchronously
  const [appInfo, setAppInfo] = useState({
    bundleId: 'Loading...',
    urlScheme: 'Loading...'
  });

  // Check if we should show the warning banner
  const shouldShowWarning = !isDevMode && hasMissingEnvVars && showWarning;

  // Load app info on component mount
  useEffect(() => {
    const loadAppInfo = async () => {
      try {
        // Platform-specific bundle ID detection
        let detectedBundleId = 'com.sendai.solanaappkit'; // Default fallback

        if (Platform.OS === 'ios') {
          detectedBundleId = Application.applicationId ||
            Constants.expoConfig?.ios?.bundleIdentifier ||
            'com.sendai.solanaappkit';
        } else {
          detectedBundleId = Application.applicationId ||
            Constants.expoConfig?.android?.package ||
            'com.sendai.solanaappkit';
        }

        // Detect URL scheme from native config
        // This is initialized at app startup in App.tsx
        // Just get a URL and extract the scheme part
        let detectedScheme = 'solanaappkit'; // Default fallback
        try {
          const url = Linking.createURL('/');
          const parts = url.split('://');
          if (parts.length > 0 && parts[0] !== 'null' && parts[0] !== 'undefined') {
            detectedScheme = parts[0];
          }
        } catch (error) {
          console.warn('Error detecting URL scheme:', error);
        }

        // Update state with detected values
        setAppInfo({
          bundleId: detectedBundleId,
          urlScheme: detectedScheme
        });

        console.log('App info loaded:', {
          bundleId: detectedBundleId,
          urlScheme: detectedScheme
        });

      } catch (error) {
        console.error('Error loading app info:', error);
        // Set defaults if detection fails
        setAppInfo({
          bundleId: 'com.sendai.solanaappkit',
          urlScheme: 'solanaappkit'
        });
      }
    };

    loadAppInfo();
  }, []);

  // Debug missing env vars
  useEffect(() => {
    console.log('[LoginScreen] Environment Status:', {
      isDevMode,
      hasMissingEnvVars,
      missingEnvVarsCount: missingEnvVars?.length || 0,
      shouldShowWarning,
      showWarning
    });

    if (hasMissingEnvVars) {
      console.log('[LoginScreen] Missing ENV variables found:', missingEnvVars?.slice(0, 5));

      // Force the warning to show after a small delay if conditions are met
      if (!isDevMode) {
        setTimeout(() => {
          setShowWarning(true);
        }, 500);
      }
    }
  }, [isDevMode, hasMissingEnvVars, missingEnvVars, shouldShowWarning, showWarning]);

  // Animation values for SVG elements
  const circleAnim = useRef(new Animated.Value(0)).current;
  const leftStartAnim = useRef(new Animated.Value(0)).current;
  const plusAnim = useRef(new Animated.Value(0)).current;
  const rectAnim = useRef(new Animated.Value(0)).current;
  const yellowBoomerangAnim = useRef(new Animated.Value(1)).current;

  // Animation values for right SVG elements
  const rightRectangleAnim = useRef(new Animated.Value(0)).current;
  const rightSwapAnim = useRef(new Animated.Value(0)).current;
  const rightBoomerangAnim = useRef(new Animated.Value(1)).current;
  const rightZigzagAnim = useRef(new Animated.Value(1)).current;

  // New animation values for the updated animations
  const settingAnim = useRef(new Animated.Value(0)).current;

  // Single animation value for grid scaling
  const gridScaleAnim = useRef(new Animated.Value(1)).current;

  // Immediately check if we're already logged in before any animations
  // or component mounting logic happens
  if (isLoggedIn) {
    console.log('[LoginScreen] User is already logged in, navigating to MainTabs immediately');
    // Use setTimeout to ensure this happens after initial render
    setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    }, 0);
  }

  // Debug the warning banner visibility on mount
  useEffect(() => {
    console.log('[LoginScreen] Mounting with warning banner status:', {
      isDevMode,
      hasMissingEnvVars,
      showWarning,
      shouldShowWarning: !isDevMode && hasMissingEnvVars && showWarning,
    });

    // If we have env errors but the banner isn't showing, force it to show after a delay
    if (hasMissingEnvVars && !isDevMode && !shouldShowWarning) {
      console.log('[LoginScreen] Forcing warning banner to show');
      setTimeout(() => {
        setShowWarning(true);
      }, 800);
    }
  }, []);

  useEffect(() => {
    // Start animations
    startAnimations();

    // If already logged in, navigate to MainTabs immediately
    if (isLoggedIn) {
      console.log('[LoginScreen] User already logged in, navigating to MainTabs');
      // Use navigation.reset to avoid having LoginScreen in the navigation stack
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    }
  }, [isLoggedIn, navigation]);

  const startAnimations = () => {
    // Circle rotation animation
    Animated.loop(
      Animated.timing(circleAnim, {
        toValue: 1,
        duration: SVG_CONFIG.circle.animation.duration,
        useNativeDriver: true,
      })
    ).start();

    // Left start fade animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(leftStartAnim, {
          toValue: 1,
          duration: SVG_CONFIG.leftStar.animation.duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(leftStartAnim, {
          toValue: 0.3,
          duration: SVG_CONFIG.leftStar.animation.duration / 2,
          useNativeDriver: true,
        })
      ])
    ).start();

    // Plus jerky rotation animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(plusAnim, {
          toValue: -0.05,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(plusAnim, {
          toValue: 0.05,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(plusAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(1000)
      ])
    ).start();

    // Rect rotation animation
    Animated.loop(
      Animated.timing(rectAnim, {
        toValue: 1,
        duration: SVG_CONFIG.rect.animation.duration,
        useNativeDriver: true,
      })
    ).start();

    // Yellow boomerang fade animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(yellowBoomerangAnim, {
          toValue: 0.4,
          duration: SVG_CONFIG.yellowBoomerang.animation.duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(yellowBoomerangAnim, {
          toValue: 1,
          duration: SVG_CONFIG.yellowBoomerang.animation.duration / 2,
          useNativeDriver: true,
        })
      ])
    ).start();

    // Setting varying speed rotation animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(settingAnim, {
          toValue: 0.2,
          duration: 2000, // Slow rotation
          useNativeDriver: true,
        }),
        Animated.timing(settingAnim, {
          toValue: 0.4,
          duration: 1000, // Medium rotation
          useNativeDriver: true,
        }),
        Animated.timing(settingAnim, {
          toValue: 1,
          duration: 800, // Fast rotation
          useNativeDriver: true,
        }),
        Animated.timing(settingAnim, {
          toValue: 1.2,
          duration: 1500, // Slowing down
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Right rectangle rotation animation
    Animated.loop(
      Animated.timing(rightRectangleAnim, {
        toValue: 1,
        duration: SVG_CONFIG.rightRectangle.animation.duration,
        useNativeDriver: true,
      })
    ).start();

    // Right swap jerky rotation animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(rightSwapAnim, {
          toValue: 0.2,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(rightSwapAnim, {
          toValue: 0.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(rightSwapAnim, {
          toValue: 0.4,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(rightSwapAnim, {
          toValue: 0.3,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(rightSwapAnim, {
          toValue: 0.7,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(rightSwapAnim, {
          toValue: 0.5,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(rightSwapAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.delay(800),
      ])
    ).start();

    // Right boomerang fade animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(rightBoomerangAnim, {
          toValue: 0.4,
          duration: SVG_CONFIG.rightBoomerang.animation.duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(rightBoomerangAnim, {
          toValue: 1,
          duration: SVG_CONFIG.rightBoomerang.animation.duration / 2,
          useNativeDriver: true,
        })
      ])
    ).start();

    // Right zigzag fade animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(rightZigzagAnim, {
          toValue: 0.5,
          duration: SVG_CONFIG.rightZigzag.animation.duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(rightZigzagAnim, {
          toValue: 1,
          duration: SVG_CONFIG.rightZigzag.animation.duration / 2,
          useNativeDriver: true,
        })
      ])
    ).start();

    // Grid pulse animation (scale only)
    Animated.loop(
      Animated.sequence([
        // Scale animation
        Animated.sequence([
          Animated.timing(gridScaleAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(gridScaleAnim, {
            toValue: 0.9,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(gridScaleAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(1000),
      ])
    ).start();
  };

  // Demo login bypass - generates a random wallet address
  const handleDemoLogin = async () => {
    console.log('[LoginScreen] Demo login initiated - bypassing authentication');
    setIsAuthenticating(true);

    // Generate a valid base58 Solana public key for demo mode
    // Base58 alphabet (Solana uses Bitcoin's base58 alphabet)
    const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

    // Generate a random 44-character base58 string (standard Solana public key length)
    let demoAddress = '';
    for (let i = 0; i < 44; i++) {
      const randomIndex = Math.floor(Math.random() * base58Chars.length);
      demoAddress += base58Chars[randomIndex];
    }

    console.log('[LoginScreen] Demo address generated:', demoAddress);

    try {
      // Try to create user in database (skip if server is unavailable)
      try {
        await axios.post(`${SERVER_BASE_URL}/api/profile/createUser`, {
          userId: demoAddress,
          username: `Demo_${demoAddress.slice(0, 6)}`,
          handle: '@demo_' + demoAddress.slice(0, 6),
        });
      } catch (dbError) {
        console.log('[LoginScreen] Database unavailable for demo user - continuing anyway');
      }

      // Login success with demo provider
      dispatch(
        loginSuccess({
          provider: 'privy', // Use privy as default provider
          address: demoAddress,
          username: `Demo_${demoAddress.slice(0, 6)}`,
        }),
      );

      // Generate avatar for demo user
      try {
        const avatarUrl = await generateAndStoreAvatar(demoAddress);
        dispatch(updateProfilePic(avatarUrl));
      } catch (avatarError) {
        console.log('[LoginScreen] Avatar generation skipped for demo user');
      }

      console.log('[LoginScreen] Demo login successful, navigating to app...');

      // Navigate to main app
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      }, 500);

    } catch (error) {
      console.error('[LoginScreen] Demo login error:', error);
      setIsAuthenticating(false);
      Alert.alert('Demo Login Failed', 'Unable to create demo session. Please try again.');
    }
  };

  const handleWalletConnected = async (info: { provider: string; address: string }) => {
    console.log('Wallet connected:', info);
    setIsAuthenticating(true);
    try {
      // First check if user already exists
      let isNewUser = false;
      try {
        // Try to create the user entry in the database
        const response = await axios.post(`${SERVER_BASE_URL}/api/profile/createUser`, {
          userId: info.address,
          username: info.address.slice(0, 6), // Initially set to wallet address
          handle: '@' + info.address.slice(0, 6),
        });

        console.log('User creation response:', response.data);

        // Check if this was actually a new user creation (not just returning existing user)
        if (response.data?.user && !response.data?.user?.profile_picture_url) {
          isNewUser = true;
        }
      } catch (createError: any) {
        // Log error information once, but don't show response details that might include stack traces
        console.log('User creation error (might be already existing):', createError?.response?.status || createError.message);

        // Only show detailed errors in development
        if (process.env.NODE_ENV === 'development') {
          console.log('Create user error details:', {
            status: createError?.response?.status,
            message: createError?.response?.data?.message || createError.message
          });
        }

        // Don't log the full error object to prevent duplicate verbose errors in console
        // Only log critical errors that aren't related to user already existing
        const isNonCriticalError =
          // User already exists (409)
          createError?.response?.status === 409 ||
          // Server error but likely just user exists (500 from server but with specific message)
          (createError?.response?.status === 500 &&
            (createError?.response?.data?.message?.includes('already exists') ||
              createError?.response?.data?.message?.includes('duplicate key')));

        if (!isNonCriticalError) {
          console.warn('Non-critical error creating user. Login will proceed.');
        }
      }

      // Proceed with login regardless of whether user creation succeeded
      // This way, existing users can still log in
      dispatch(
        loginSuccess({
          provider: info.provider as 'privy' | 'dynamic' | 'turnkey' | 'mwa',
          address: info.address,
        }),
      );

      // After login, fetch user profile to get existing data
      try {
        const profileResult = await dispatch(fetchUserProfile(info.address)).unwrap();

        // Generate DiceBear avatar only for new users without profile pictures
        if (!profileResult?.profilePicUrl) {
          console.log('[LoginScreen] Generating DiceBear avatar for new user...');
          try {
            const avatarUrl = await generateAndStoreAvatar(info.address);

            // Update Redux state
            dispatch(updateProfilePic(avatarUrl));

            // Save the generated avatar URL to the database
            try {
              const saveAvatarResponse = await axios.post(`${SERVER_BASE_URL}/api/profile/updateProfilePic`, {
                userId: info.address,
                profilePicUrl: avatarUrl,
              });

              if (saveAvatarResponse.data.success) {
                console.log('[LoginScreen] DiceBear avatar saved to database successfully');
              } else {
                console.warn('[LoginScreen] Failed to save avatar to database:', saveAvatarResponse.data.error);
              }
            } catch (dbError) {
              console.error('[LoginScreen] Error saving avatar to database:', dbError);
              // Don't fail the login process if database save fails
            }

          } catch (avatarError) {
            console.error('[LoginScreen] Failed to generate DiceBear avatar:', avatarError);
            // Don't fail the login process if avatar generation fails
          }
        }

      } catch (profileError) {
        console.warn('[LoginScreen] Failed to fetch profile after login (non-critical):', profileError);
        // Don't fail the login process if profile fetch fails
        // Generate avatar for new users as fallback
        if (isNewUser) {
          try {
            console.log('[LoginScreen] Generating DiceBear avatar for new user as fallback...');
            const avatarUrl = await generateAndStoreAvatar(info.address);
            dispatch(updateProfilePic(avatarUrl));

            // Save the generated avatar URL to the database
            try {
              const saveAvatarResponse = await axios.post(`${SERVER_BASE_URL}/api/profile/updateProfilePic`, {
                userId: info.address,
                profilePicUrl: avatarUrl,
              });

              if (saveAvatarResponse.data.success) {
                console.log('[LoginScreen] Fallback DiceBear avatar saved to database successfully');
              } else {
                console.warn('[LoginScreen] Failed to save fallback avatar to database:', saveAvatarResponse.data.error);
              }
            } catch (dbError) {
              console.error('[LoginScreen] Error saving fallback avatar to database:', dbError);
              // Don't fail the login process if database save fails
            }

          } catch (fallbackAvatarError) {
            console.warn('[LoginScreen] Failed to generate fallback avatar:', fallbackAvatarError);
          }
        }
      }

    } catch (error) {
      console.error('Error handling wallet connection:', error);
      Alert.alert(
        'Connection Error',
        'Successfully connected to wallet but encountered an error proceeding to the app.',
      );
      setIsAuthenticating(false);
    }
  };

  const renderAuthComponent = () => {
    switch (authConfig.provider) {
      case 'turnkey':
        return <TurnkeyWalletAuth onWalletConnected={handleWalletConnected} />;
      case 'privy':
      case 'dynamic':
      default:
        return <EmbeddedWalletAuth onWalletConnected={handleWalletConnected} />;
    }
  };

  // Background shapes with animations
  const renderBackgroundShapes = () => (
    <View style={styles.shapesBackground}>
      {/* Circle SVG with rotation animation */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: SVG_CONFIG.circle.initialPosition.top,
            left: SVG_CONFIG.circle.initialPosition.left,
            width: SVG_CONFIG.circle.size.width,
            height: SVG_CONFIG.circle.size.height,
            transform: [
              {
                rotate: circleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                }),
              },
            ],
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        <Icons.LeftCircle width="100%" height="100%" />
      </Animated.View>

      {/* LeftStart SVG with fade animation */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: SVG_CONFIG.leftStar.initialPosition.top,
            left: SVG_CONFIG.leftStar.initialPosition.left,
            width: SVG_CONFIG.leftStar.size.width,
            height: SVG_CONFIG.leftStar.size.height,
            opacity: leftStartAnim,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 5,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        <Icons.LeftStar width="100%" height="100%" />
      </Animated.View>

      {/* LeftEllipse SVG with scale animation */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: SVG_CONFIG.leftEllipse.initialPosition.top,
            left: SVG_CONFIG.leftEllipse.initialPosition.left,
            width: SVG_CONFIG.leftEllipse.size.width,
            height: SVG_CONFIG.leftEllipse.size.height,
          },
        ]}
      >
        <Icons.LeftEllipse width="100%" height="100%" />
      </Animated.View>

      {/* Plus SVG with jerky rotation animation */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: SVG_CONFIG.plus.initialPosition.top,
            left: SVG_CONFIG.plus.initialPosition.left,
            width: SVG_CONFIG.plus.size.width,
            height: SVG_CONFIG.plus.size.height,
            transform: [
              {
                rotate: plusAnim.interpolate({
                  inputRange: [-0.05, 0, 0.05],
                  outputRange: ['-10deg', '0deg', '10deg'],
                }),
              },
            ],
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        <Icons.LeftPlus width="100%" height="100%" />
      </Animated.View>

      {/* Rect SVG with rotation animation */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: SVG_CONFIG.rect.initialPosition.top,
            left: SVG_CONFIG.rect.initialPosition.left,
            width: SVG_CONFIG.rect.size.width,
            height: SVG_CONFIG.rect.size.height,
            transform: [
              {
                rotate: rectAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                }),
              },
            ],
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        <Icons.LeftRect width="100%" height="100%" />
      </Animated.View>

      {/* YellowBoomerang SVG with fade animation */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: SVG_CONFIG.yellowBoomerang.initialPosition.top,
            left: SVG_CONFIG.yellowBoomerang.initialPosition.left,
            width: SVG_CONFIG.yellowBoomerang.size.width,
            height: SVG_CONFIG.yellowBoomerang.size.height,
            opacity: yellowBoomerangAnim,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 5,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        <Icons.YellowBoomerang width="100%" height="100%" />
      </Animated.View>

      {/* Setting SVG with varying speed rotation */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: SVG_CONFIG.setting.initialPosition.top,
            left: SVG_CONFIG.setting.initialPosition.left,
            width: SVG_CONFIG.setting.size.width,
            height: SVG_CONFIG.setting.size.height,
            transform: [
              {
                rotate: settingAnim.interpolate({
                  inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2],
                  outputRange: ['0deg', '30deg', '90deg', '180deg', '270deg', '360deg', '420deg'],
                }),
              },
            ],
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        <Icons.Setting width="100%" height="100%" />
      </Animated.View>

      {/* Right Rectangle SVG with rotation animation */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: SVG_CONFIG.rightRectangle.initialPosition.top,
            right: SVG_CONFIG.rightRectangle.initialPosition.right,
            width: SVG_CONFIG.rightRectangle.size.width,
            height: SVG_CONFIG.rightRectangle.size.height,
            transform: [
              {
                rotate: rightRectangleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                }),
              },
            ],
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        <Icons.RightRectangle width="100%" height="100%" />
      </Animated.View>

      {/* Right Swap SVG with jerky rotation animation */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: SVG_CONFIG.rightSwap.initialPosition.top,
            right: SVG_CONFIG.rightSwap.initialPosition.right,
            width: SVG_CONFIG.rightSwap.size.width,
            height: SVG_CONFIG.rightSwap.size.height,
            transform: [
              {
                rotate: rightSwapAnim.interpolate({
                  inputRange: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1],
                  outputRange: ['0deg', '30deg', '10deg', '45deg', '15deg', '90deg', '180deg', '360deg'],
                }),
              },
              {
                scale: rightSwapAnim.interpolate({
                  inputRange: [0, 0.4, 0.7, 1],
                  outputRange: [0.9, 1.05, 0.95, 1],
                }),
              },
            ],
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        <Icons.RightSwap width="100%" height="100%" />
      </Animated.View>

      {/* Right Boomerang SVG with fade animation */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: SVG_CONFIG.rightBoomerang.initialPosition.top,
            right: SVG_CONFIG.rightBoomerang.initialPosition.right,
            width: SVG_CONFIG.rightBoomerang.size.width,
            height: SVG_CONFIG.rightBoomerang.size.height,
            opacity: rightBoomerangAnim,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 5,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        <Icons.RightBoomerang width="100%" height="100%" />
      </Animated.View>

      {/* Right Grid SVG with pulse scale animation (no rotation or glow) */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: SVG_CONFIG.rightGrid.initialPosition.top,
            right: SVG_CONFIG.rightGrid.initialPosition.right,
            width: SVG_CONFIG.rightGrid.size.width,
            height: SVG_CONFIG.rightGrid.size.height,
            transform: [
              { scale: gridScaleAnim }
            ]
          },
        ]}
      >
        <Icons.RightGrid width="100%" height="100%" />
      </Animated.View>

      {/* Right Zigzag SVG with fade animation */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: SVG_CONFIG.rightZigzag.initialPosition.top,
            right: SVG_CONFIG.rightZigzag.initialPosition.right,
            width: SVG_CONFIG.rightZigzag.size.width,
            height: SVG_CONFIG.rightZigzag.size.height,
            opacity: rightZigzagAnim,
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 5,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        <Icons.RightZigzag width="100%" height="100%" />
      </Animated.View>

      {/* Right Ellipse SVG without animation */}
      <View
        style={[
          {
            position: 'absolute',
            top: SVG_CONFIG.rightEllipse.initialPosition.top,
            right: SVG_CONFIG.rightEllipse.initialPosition.right,
            width: SVG_CONFIG.rightEllipse.size.width,
            height: SVG_CONFIG.rightEllipse.size.height,
          },
        ]}
      >
        <Icons.RightEllipse width="100%" height="100%" />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        style="light"
        backgroundColor="transparent"
        translucent={true}
      />
      <View style={styles.container}>
        {renderBackgroundShapes()}

        <View style={styles.headerContainer}>
          <Text style={styles.welcomeText}>Welcome back</Text>
          <Text style={styles.subtitleText}>Sign in to your account</Text>
        </View>

        {renderAuthComponent()}

        {/* Demo Login Bypass Button */}
        <TouchableOpacity
          style={{
            marginTop: 20,
            padding: 16,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.2)',
            alignItems: 'center',
          }}
          onPress={handleDemoLogin}
          disabled={isAuthenticating}
        >
          <Text style={{
            color: '#ffffff',
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 4,
          }}>
            🎮 Skip Login (Demo Mode)
          </Text>
          <Text style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: 12,
          }}>
            Bypass authentication and explore the app
          </Text>
        </TouchableOpacity>

        {/* <View
          style={{
            position: 'absolute',
            bottom: 300,
            padding: 8,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            borderRadius: 5,
            alignItems: 'center',
          }}>
          <Text
            style={{color: '#ffffff', fontSize: 10, fontFamily: 'monospace'}}>
            Bundle ID: {appInfo.bundleId}
          </Text>
          <Text
            style={{color: '#ffffff', fontSize: 10, fontFamily: 'monospace'}}>
            URL Scheme: {appInfo.urlScheme}
          </Text>
        </View> */}
        <Text style={styles.agreementText}>
          By continuing you agree to our t&c and Privacy Policy
        </Text>

        {/* Loading Overlay */}
        {isAuthenticating && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.brandPrimary} />
              <Text style={styles.loadingText}>Connecting to wallet...</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
