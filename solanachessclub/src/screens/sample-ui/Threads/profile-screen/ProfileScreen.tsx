import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, StatusBar, Platform, SafeAreaView } from 'react-native';
import Profile from '@/core/profile/components/profile';
import ProfileSkeleton from '@/core/profile/components/ProfileSkeleton';
import { ThreadPost } from '@/core/thread/components/thread.types';
import { useWallet } from '@/modules/wallet-providers/hooks/useWallet';
import { flattenPosts } from '@/core/thread/components/thread.utils';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { fetchFollowers, fetchFollowing } from '@/core/profile/services/profileService';
import { useFetchNFTs } from '@/modules/nft';
import { useAppSelector } from '@/shared/hooks/useReduxHooks';
import COLORS from '@/assets/colors';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/shared/navigation/RootNavigator';

export default function ProfileScreen() {
  // Get user data from Redux
  const storedProfilePic = useAppSelector(state => state.auth.profilePicUrl);
  const storedUsername = useAppSelector(state => state.auth.username);
  const storedDescription = useAppSelector(state => state.auth.description);
  const attachmentData = useAppSelector(state => state.auth.attachmentData || {});

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Use the wallet hook to get the user's address
  const { address: userWallet } = useWallet();

  // Ensure we have the wallet address and log for debugging
  useEffect(() => {
    console.log('[ProfileScreen] User wallet address:', userWallet);
    console.log('[ProfileScreen] Stored username:', storedUsername);
  }, [userWallet, storedUsername]);

  // State for loading and counts
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Main loading state for the skeleton
  const [isLoading, setIsLoading] = useState(true);
  // Specific loading state for profile details (followers, following)
  const [isProfileDetailsLoading, setIsProfileDetailsLoading] = useState(true);

  // Get all posts from Redux
  const allPosts = useAppSelector(state => state.thread.allPosts);

  // Get the status bar height for Android
  const STATUSBAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0;

  // Filter posts belonging to the current user, including replies
  const myPosts = useMemo(() => {
    if (!userWallet) return [];
    const flattenedPosts = flattenPosts(allPosts);
    const userPosts = flattenedPosts.filter(
      (p: ThreadPost) => p.user.id.toLowerCase() === userWallet.toLowerCase()
    );
    userPosts.sort((a: ThreadPost, b: ThreadPost) =>
      (new Date(b.createdAt) > new Date(a.createdAt) ? 1 : -1)
    );
    return userPosts;
  }, [userWallet, allPosts]);

  // Fetch NFT data using our custom hook
  const {
    nfts,
    loading: loadingNfts,
    error: fetchNftsError,
  } = useFetchNFTs(userWallet || undefined);

  // Build the user object with safe fallbacks
  const user = useMemo(() => ({
    address: userWallet || '',
    profilePicUrl: storedProfilePic || '',
    username: storedUsername || (userWallet ? userWallet.substring(0, 6) : 'New User'),
    description: storedDescription || 'Welcome to my profile!',
    attachmentData,
    followersCount,
    followingCount
  }), [userWallet, storedProfilePic, storedUsername, storedDescription, attachmentData, followersCount, followingCount]);

  // Handle go back for the profile
  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Function to navigate to the delete account confirmation screen
  const handleNavigateToDeleteConfirmation = useCallback(() => {
    navigation.navigate('DeleteAccountConfirmationScreen');
  }, [navigation]);

  // Refresh follower/following counts when the profile screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (!userWallet) {
        console.log('[ProfileScreen] No wallet address, skipping profile details fetch');
        setIsProfileDetailsLoading(false);
        return;
      }

      console.log('[ProfileScreen] Screen focused, fetching profile details');
      const fetchProfileData = async () => {
        setIsProfileDetailsLoading(true);
        try {
          const [followers, following] = await Promise.all([
            fetchFollowers(userWallet),
            fetchFollowing(userWallet),
          ]);
          console.log('[ProfileScreen] Updated followers count:', followers.length);
          setFollowersCount(followers.length);
          console.log('[ProfileScreen] Updated following count:', following.length);
          setFollowingCount(following.length);
        } catch (err) {
          console.error('[ProfileScreen] Error fetching profile data:', err);
        } finally {
          setIsProfileDetailsLoading(false);
        }
      };

      fetchProfileData();
    }, [userWallet])
  );

  // Combined effect to set the main isLoading state for the skeleton
  useEffect(() => {
    if (!userWallet) {
      // If there's no user wallet, nothing should be loading.
      setIsLoading(false);
      return;
    }
    // The main skeleton is shown if either profile details OR NFTs are loading.
    setIsLoading(isProfileDetailsLoading || loadingNfts);
  }, [userWallet, isProfileDetailsLoading, loadingNfts]);

  return (
    <>
      {Platform.OS === 'android' && <View style={{ height: STATUSBAR_HEIGHT, backgroundColor: COLORS.background }} />}
      <SafeAreaView style={[styles.container, Platform.OS === 'android' && androidStyles.container]}>
        {isLoading ? (
          <ProfileSkeleton />
        ) : (
          <Profile
            isOwnProfile={true}
            user={user}
            posts={myPosts}
            nfts={nfts}
            loadingNfts={loadingNfts}
            fetchNftsError={fetchNftsError}
            onGoBack={handleGoBack}
            isScreenLoading={false}
            onDeleteAccountPress={handleNavigateToDeleteConfirmation}
          />
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});

// Android-specific styles to handle camera cutout/notch areas
const androidStyles = StyleSheet.create({
  container: {
    paddingTop: 0,
  },
});
