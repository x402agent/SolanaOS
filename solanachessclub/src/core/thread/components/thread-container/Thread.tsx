import React, { useState, useRef, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, Animated, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThreadComposer } from '../thread-composer/ThreadComposer';
import { getThreadBaseStyles, headerStyles, tabStyles } from './Thread.styles';
import { mergeStyles } from '../../utils';
import Icons from '../../../../assets/svgs';
import { ThreadProps } from '../../types';
import { ThreadItem } from '../thread-item/ThreadItem';
import { IPFSAwareImage, getValidImageSource } from '@/shared/utils/IPFSImage';
import { useAppSelector } from '@/shared/hooks/useReduxHooks';
import { DEFAULT_IMAGES } from '@/shared/config/constants';
import { Platform } from 'react-native';
import SearchScreen from '@/screens/sample-ui/Threads/SearchScreen';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

export const Thread: React.FC<ThreadProps> = ({
  rootPosts,
  currentUser,
  showHeader = true,
  onPostCreated,
  hideComposer = false,
  onPressPost,
  ctaButtons,
  themeOverrides,
  styleOverrides,
  userStyleSheet,
  refreshing: externalRefreshing,
  onRefresh: externalOnRefresh,
  onPressUser,
  disableReplies = false,
  scrollUI,
}) => {
  // Local fallback for refreshing if not provided
  const [localRefreshing, setLocalRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'search'>('feed');
  const navigation = useNavigation();

  // Scroll-based UI hiding state
  const lastScrollY = useRef(0);
  const scrollDirection = useRef<'up' | 'down'>('up');
  const isUIHidden = useRef(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  // Animation values for hiding/showing UI elements
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const composerTranslateY = useRef(new Animated.Value(0)).current;
  const tabsTranslateY = useRef(new Animated.Value(0)).current;

  // Opacity values to handle visibility
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const composerOpacity = useRef(new Animated.Value(1)).current;
  const tabsOpacity = useRef(new Animated.Value(1)).current;

  // Get the stored profile pic from Redux
  const storedProfilePic = useAppSelector(state => state.auth.profilePicUrl);

  // 1. Get the base styles for this component (doesn't need theme argument anymore)
  const baseComponentStyles = getThreadBaseStyles();

  // 2. Use the utility function to merge base styles, overrides, and user sheet
  const styles = mergeStyles(baseComponentStyles, styleOverrides, userStyleSheet);

  // Local onRefresh if external prop is not provided
  const localOnRefresh = () => {
    setLocalRefreshing(true);
    setTimeout(() => {
      setLocalRefreshing(false);
    }, 800);
  };

  const finalRefreshing =
    externalRefreshing !== undefined ? externalRefreshing : localRefreshing;
  const finalOnRefresh =
    externalOnRefresh !== undefined ? externalOnRefresh : localOnRefresh;

  const handleProfilePress = () => {
    navigation.navigate('ProfileScreen' as never);
  };

  // Handler for wallet icon press
  const handleWalletPress = () => {
    navigation.navigate('WalletScreen' as never);
  };

  // Hide UI elements
  const hideUI = useCallback(() => {
    if (isUIHidden.current) return;
    isUIHidden.current = true;

    console.log('🔽 Hiding UI elements');

    Animated.parallel([
      // Translate elements off screen
      Animated.timing(headerTranslateY, {
        toValue: -80,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(tabsTranslateY, {
        toValue: -48,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(composerTranslateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      // Fade out elements
      Animated.timing(headerOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(tabsOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(composerOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Hide tab bar if scrollUI is available
    if (scrollUI) {
      scrollUI.hideTabBar();
    }
  }, [headerTranslateY, tabsTranslateY, composerTranslateY, headerOpacity, tabsOpacity, composerOpacity, scrollUI]);

  // Show UI elements
  const showUI = useCallback(() => {
    if (!isUIHidden.current) return;
    isUIHidden.current = false;

    console.log('🔼 Showing UI elements');

    Animated.parallel([
      // Translate elements back to original position
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(tabsTranslateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(composerTranslateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      // Fade in elements
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(tabsOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(composerOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Show tab bar if scrollUI is available
    if (scrollUI) {
      scrollUI.showTabBar();
    }
  }, [headerTranslateY, tabsTranslateY, composerTranslateY, headerOpacity, tabsOpacity, composerOpacity, scrollUI]);

  // Handle scroll events for UI hiding/showing
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDiff = currentScrollY - lastScrollY.current;

    // Clear any existing timeout
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }

    // Don't trigger if scroll diff is too small (less than 3px)
    if (Math.abs(scrollDiff) < 3) {
      lastScrollY.current = currentScrollY;
      return;
    }

    const newDirection = scrollDiff > 0 ? 'down' : 'up';

    console.log(`📊 Scroll: ${currentScrollY.toFixed(1)}px, Diff: ${scrollDiff.toFixed(1)}px, Direction: ${newDirection}`);

    // Immediate actions based on scroll position and direction
    if (currentScrollY <= 20) {
      // At the very top - always show UI
      if (isUIHidden.current) {
        showUI();
      }
    } else if (newDirection === 'down' && currentScrollY > 50 && scrollDiff > 3) {
      // Scrolling down with enough momentum - hide UI
      if (!isUIHidden.current) {
        hideUI();
      }
    } else if (newDirection === 'up' && scrollDiff < -3) {
      // Scrolling up with enough momentum - show UI
      if (isUIHidden.current) {
        showUI();
      }
    }

    // Update stored values
    scrollDirection.current = newDirection;
    lastScrollY.current = currentScrollY;

    // Set a timeout to handle edge cases
    scrollTimeout.current = setTimeout(() => {
      if (currentScrollY <= 30 && isUIHidden.current) {
        showUI();
      }
    }, 100);
  }, [hideUI, showUI]);

  // Reset UI state when tab changes
  React.useEffect(() => {
    if (activeTab === 'feed') {
      showUI();
    }
  }, [activeTab, showUI]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  const renderItem = ({ item }: { item: any }) => (
    <ThreadItem
      post={item}
      currentUser={currentUser}
      rootPosts={rootPosts}
      themeOverrides={themeOverrides}
      styleOverrides={styleOverrides}
      userStyleSheet={userStyleSheet}
      onPressPost={onPressPost}
      ctaButtons={ctaButtons}
      onPressUser={onPressUser}
      disableReplies={disableReplies}
    />
  );

  return (
    <View style={styles.threadRootContainer}>
      {showHeader && (
        <Animated.View
          style={[
            styles.header,
            { padding: 16 },
            {
              transform: [{ translateY: headerTranslateY }],
              opacity: headerOpacity,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 1000,
              backgroundColor: COLORS.background,
              height: 80, // Fixed height to prevent layout issues
            }
          ]}
        >
          <View style={headerStyles.container}>
            {/* Left: User Profile Image */}
            <TouchableOpacity onPress={handleProfilePress} style={headerStyles.profileContainer}>
              <IPFSAwareImage
                source={
                  storedProfilePic
                    ? getValidImageSource(storedProfilePic)
                    : currentUser && 'avatar' in currentUser && currentUser.avatar
                      ? getValidImageSource(currentUser.avatar)
                      : DEFAULT_IMAGES.user
                }
                style={headerStyles.profileImage}
                defaultSource={DEFAULT_IMAGES.user}
                key={Platform.OS === 'android' ? `profile-${Date.now()}` : 'profile'}
              />
            </TouchableOpacity>

            {/* Right: Copy and Wallet Icons */}
            <View style={headerStyles.iconsContainer}>
              <TouchableOpacity
                style={headerStyles.iconButton}
                onPress={handleWalletPress}
                activeOpacity={0.7}
              >
                <Icons.walletIcon width={35} height={35} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            {/* Center: App Logo - Using absolute positioning to keep centered */}
            <View style={headerStyles.absoluteLogoContainer}>
              <Icons.AppLogo width={40} height={40} />
            </View>
          </View>
        </Animated.View>
      )}

      {/* Tab Slider */}
      <Animated.View
        style={[
          tabStyles.container,
          {
            transform: [{ translateY: tabsTranslateY }],
            opacity: tabsOpacity,
            position: 'absolute',
            top: showHeader ? 80 : 0,
            left: 0,
            right: 0,
            zIndex: 999,
            backgroundColor: COLORS.background,
            height: 48, // Fixed height to prevent layout issues
          }
        ]}
      >
        <TouchableOpacity
          style={[tabStyles.tab, activeTab === 'feed' && tabStyles.activeTab]}
          onPress={() => setActiveTab('feed')}
        >
          <Text style={[tabStyles.tabText, activeTab === 'feed' && tabStyles.activeTabText]}>
            For You
          </Text>
          {activeTab === 'feed' && <View style={tabStyles.indicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[tabStyles.tab, activeTab === 'search' && tabStyles.activeTab]}
          onPress={() => setActiveTab('search')}
        >
          <Icons.searchIcon
            width={24}
            height={24}
            color={activeTab === 'search' ? COLORS.brandBlue : COLORS.greyMid}
          />
          {activeTab === 'search' && <View style={tabStyles.indicator} />}
        </TouchableOpacity>

        {/* Bottom gradient border */}
        <LinearGradient
          colors={['transparent', COLORS.lightBackground]}
          style={tabStyles.bottomGradient}
        />
      </Animated.View>

      {activeTab === 'feed' ? (
        <View style={{ flex: 1 }}>
          {!hideComposer && (
            <Animated.View
              style={{
                transform: [{ translateY: composerTranslateY }],
                opacity: composerOpacity,
                position: 'absolute',
                top: showHeader ? 128 : 48,
                left: 0,
                right: 0,
                zIndex: 998,
                backgroundColor: COLORS.background,
                minHeight: 120, // Fixed minimum height to prevent layout issues
              }}
            >
              <ThreadComposer
                currentUser={currentUser}
                onPostCreated={onPostCreated}
                themeOverrides={themeOverrides}
                styleOverrides={styleOverrides}
              />
            </Animated.View>
          )}

          <FlatList
            data={rootPosts}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.threadListContainer,
              {
                paddingTop: !hideComposer
                  ? (showHeader ? 248 : 168) // Header(80) + Tabs(48) + Composer(120) + minimal spacing
                  : (showHeader ? 128 : 48), // Header(80) + Tabs(48) OR just Tabs(48)
              }
            ]}
            refreshing={finalRefreshing}
            onRefresh={finalOnRefresh}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          />
        </View>
      ) : (
        <View style={{ flex: 1, paddingTop: showHeader ? 136 : 80 }}>
          <SearchScreen showHeader={false} />
        </View>
      )}
    </View>
  );
}

// Also export as default for backward compatibility
export default Thread;
