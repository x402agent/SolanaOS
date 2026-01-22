import React, { useState, useRef, useEffect, useMemo, createContext, useContext } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, TouchableOpacity, View, StyleSheet, Animated, Dimensions, Image, Text } from 'react-native';
import { useNavigation, ParamListBase } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';

import Icons from '@/assets/svgs';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

import AnimatedTabIcon from './AnimatedTabIcon';
import FeedScreen from '@/screens/sample-ui/Threads/feed-screen/FeedScreen';
import SwapScreen from '@/modules/swap/screens/SwapScreen';
import ChessScreen from '@/modules/chess/screens/ChessScreen';

import { ChatListScreen } from '@/screens/sample-ui/chat';
import ModuleScreen from '@/screens/Common/launch-modules-screen/LaunchModules';

// Create context for scroll-based UI hiding
interface ScrollUIContextType {
  hideTabBar: () => void;
  showTabBar: () => void;
}

const ScrollUIContext = createContext<ScrollUIContextType | null>(null);

export const useScrollUI = () => {
  const context = useContext(ScrollUIContext);
  if (!context) {
    throw new Error('useScrollUI must be used within ScrollUIProvider');
  }
  return context;
};

// Platform icons matching PlatformSelectionScreen
const platformIcons = {
  threads: 'https://img.icons8.com/color/96/000000/twitter--v1.png',
  insta: 'https://img.icons8.com/color/96/000000/instagram-new.png',
  chats: 'https://img.icons8.com/color/96/000000/chat--v1.png',
};

const Tab = createBottomTabNavigator();
const { width } = Dimensions.get('window');

// Calculate tab positions based on 5-tab layout
const TAB_WIDTH = width / 5;
const FEED_TAB_CENTER = TAB_WIDTH * 1.5; // Second tab center (0-based index)

const iconStyle = {
  shadowColor: COLORS.black,
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 6,
};

export default function MainTabs() {
  const navigation = useNavigation<BottomTabNavigationProp<ParamListBase>>();
  const [expandedMenu, setExpandedMenu] = useState(false);
  const [currentPlatform, setCurrentPlatform] = useState<'threads' | 'insta' | 'chats'>('threads');
  const [refreshKey, setRefreshKey] = useState(0); // Add a refresh key to force re-render
  const menuAnimation = useRef(new Animated.Value(0)).current;

  // Tab bar animation for scroll-based hiding
  const tabBarTranslateY = useRef(new Animated.Value(0)).current;

  // Function to toggle platform selection menu
  const togglePlatformMenu = () => {
    // Only toggle menu visibility, don't touch anything related to rendering
    setExpandedMenu(!expandedMenu);

    Animated.spring(menuAnimation, {
      toValue: expandedMenu ? 0 : 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  // Function to select a platform and close menu with smoother animation
  const selectPlatform = (platform: 'threads' | 'insta' | 'chats') => {
    // Only update if platform changed
    if (platform !== currentPlatform) {
      setCurrentPlatform(platform);
      // Force a refresh by incrementing the key
      setRefreshKey(prevKey => prevKey + 1);
    }

    // Close the menu
    setExpandedMenu(false);
    Animated.spring(menuAnimation, {
      toValue: 0,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  // Scroll UI context functions
  const hideTabBar = () => {
    console.log('🔽 Hiding tab bar');
    Animated.timing(tabBarTranslateY, {
      toValue: 100, // Hide tab bar by moving it down
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const showTabBar = () => {
    console.log('🔼 Showing tab bar');
    Animated.timing(tabBarTranslateY, {
      toValue: 0, // Show tab bar by moving it back to original position
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const scrollUIContextValue = useMemo(() => ({
    hideTabBar,
    showTabBar,
  }), []);

  // Create a stable component that doesn't rerender on menu toggle         
  const StableFeedComponent = React.useMemo(() => {
    // This component is created once and captured in useMemo
    // It will only update when platformSwitchKey changes
    const Component = () => {
      switch (currentPlatform) {
        case 'threads':
          return <FeedScreen key={`threads-${refreshKey}`} />;
        case 'insta':
          return <FeedScreen key={`insta-${refreshKey}`} />;
        case 'chats':
          // Navigate to ChatListScreen instead of showing ChatScreen directly
          React.useEffect(() => {
            navigation.navigate('ChatListScreen');
          }, []);
          // Return empty view as navigation will handle the rendering
          return <View style={{ flex: 1 }} />;
        default:
          return <FeedScreen key={`threads-${refreshKey}`} />;
      }
    };

    return Component;
  }, [currentPlatform, refreshKey, navigation]);

  // Calculate transformations for the menu with smoother curves
  const menuTranslateY = menuAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [50, 10, 0], // More nuanced movement
  });

  const menuScale = menuAnimation.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.92, 0.98, 1], // Smoother scaling
  });

  const menuOpacity = menuAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.8, 1], // Faster fade in
  });

  return (
    <ScrollUIContext.Provider value={scrollUIContextValue}>
      {/* Platform Selection Menu - appears above tab bar */}
      <Animated.View
        style={[
          platformStyles.menuContainer,
          {
            transform: [
              { translateY: menuTranslateY },
              { scale: menuScale }
            ],
            opacity: menuOpacity,
          }
        ]}
        pointerEvents={expandedMenu ? 'auto' : 'none'}
      >
        <View style={platformStyles.menuContent}>
          {/* Twitter/Threads Option */}
          <TouchableOpacity
            style={[
              platformStyles.platformButton,
              currentPlatform === 'threads' && platformStyles.activePlatform
            ]}
            onPress={() => selectPlatform('threads')}
          >
            <Image
              source={{ uri: platformIcons.threads }}
              style={platformStyles.platformIcon}
            />
          </TouchableOpacity>

          {/* Instagram Option */}
          <TouchableOpacity
            style={[
              platformStyles.platformButton,
              currentPlatform === 'insta' && platformStyles.activePlatform
            ]}
            onPress={() => selectPlatform('insta')}
          >
            <Image
              source={{ uri: platformIcons.insta }}
              style={platformStyles.platformIcon}
            />
          </TouchableOpacity>

          {/* Chat Option */}
          <TouchableOpacity
            style={[
              platformStyles.platformButton,
              currentPlatform === 'chats' && platformStyles.activePlatform
            ]}
            onPress={() => selectPlatform('chats')}
          >
            <Image
              source={{ uri: platformIcons.chats }}
              style={platformStyles.platformIcon}
            />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Tab.Navigator
        initialRouteName="Feed"
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: COLORS.brandPrimary,
          tabBarStyle: [
            {
              paddingTop: Platform.OS === 'android' ? 5 : 10,
              paddingBottom: Platform.OS === 'android' ? 5 : 0,
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              position: 'absolute',
              elevation: 0,
              height: Platform.OS === 'android' ? 55 : 75,
              bottom: Platform.OS === 'android' ? 0 : 0,
              left: 0,
              right: 0,
            },
            {
              transform: [{ translateY: tabBarTranslateY }],
            },
          ],
          tabBarBackground: () => (
            <BlurView
              tint="dark"
              intensity={Platform.OS === 'android' ? 15 : 35}
              style={StyleSheet.absoluteFill}
            >
              <View style={platformStyles.tabBarOverlay} />
            </BlurView>
          ),
        }}>
        <Tab.Screen
          name="Feed"
          component={StableFeedComponent}
          options={{
            tabBarIcon: ({ focused, size }) => (
              <AnimatedTabIcon
                focused={focused}
                size={size * 1.15}
                icon={
                  Icons.FeedIcon as React.ComponentType<{
                    width: number;
                    height: number;
                  }>
                }
                iconSelected={
                  Icons.FeedIconSelected as React.ComponentType<{
                    width: number;
                    height: number;
                  }>
                }
                style={{
                  shadowColor: COLORS.black,
                  shadowOffset: { width: 0, height: 15 },
                  shadowOpacity: 0.6,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Swap"
          component={SwapScreen}
          options={{
            tabBarIcon: ({ focused, size }) => (
              <AnimatedTabIcon
                focused={focused}
                size={size * 1}
                icon={
                  Icons.SwapNavIcon as React.ComponentType<{
                    width: number;
                    height: number;
                  }>
                }
                iconSelected={
                  Icons.SwapNavIconSelected as React.ComponentType<{
                    width: number;
                    height: number;
                  }>
                }
                style={iconStyle}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Chess"
          component={ChessScreen}
          options={{
            tabBarIcon: ({ focused, size }) => (
              <View style={{
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Text style={{
                  fontSize: size * 1.4,
                  textShadowColor: focused ? COLORS.brandPrimary : 'rgba(0,0,0,0.3)',
                  textShadowOffset: { width: 0, height: focused ? 4 : 2 },
                  textShadowRadius: focused ? 8 : 4,
                }}>
                  ♟️
                </Text>
              </View>
            ),
          }}
        />
        <Tab.Screen
          name="Search"
          component={ChatListScreen}
          options={{
            tabBarIcon: ({ focused, size }) => (
              <AnimatedTabIcon
                focused={focused}
                size={size * 1.25}
                icon={
                  Icons.ChatIcon as React.ComponentType<{
                    width: number;
                    height: number;
                  }>
                }
                iconSelected={
                  Icons.ChatIconSelected as React.ComponentType<{
                    width: number;
                    height: number;
                  }>
                }
                style={iconStyle}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Modules"
          component={ModuleScreen}
          options={{
            tabBarIcon: ({ focused, size }) => (
              <AnimatedTabIcon
                focused={focused}
                size={size * 1.2}
                icon={
                  Icons.RocketIcon as React.ComponentType<{
                    width: number;
                    height: number;
                  }>
                }
                iconSelected={
                  Icons.RocketIconSelected as React.ComponentType<{
                    width: number;
                    height: number;
                  }>
                }
                style={iconStyle}
              />
            ),
          }}
        />
      </Tab.Navigator>
    </ScrollUIContext.Provider>
  );
}

const platformStyles = StyleSheet.create({
  menuContainer: {
    position: 'absolute',
    bottom: 90, // Position just above the tab bar
    left: 0,
    right: 0,
    zIndex: 999,
    alignItems: 'center',
  },
  menuContent: {
    flexDirection: 'row',
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
    width: width * 0.58, // Smaller width
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 7,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  platformButton: {
    width: 50, // Smaller buttons
    height: 50, // Smaller buttons
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.darkerBackground,
    marginHorizontal: 4, // Less space between buttons
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  platformIcon: {
    width: 28, // Smaller icons
    height: 28, // Smaller icons
  },
  activePlatform: {
    backgroundColor: `${COLORS.brandPrimary}20`, // 20% opacity
    borderColor: COLORS.brandPrimary,
    transform: [{ scale: 1.06 }], // Slightly less scaling for subtlety
    shadowColor: COLORS.brandPrimary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  tabBarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Platform.OS === 'android'
      ? 'rgba(12, 16, 26, 0.95)' // Much higher opacity for Android
      : 'rgba(12, 16, 26, 0.75)', // Original opacity for iOS
  }
});
