import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, Platform, Alert, ActivityIndicator, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/shared/navigation/RootNavigator';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useReduxHooks';
import Profile from '@/core/profile/components/profile';
import ProfileSkeleton from '@/core/profile/components/ProfileSkeleton';
import { ThreadPost } from '@/core/thread/components/thread.types';
import { fetchAllPosts } from '@/shared/state/thread/reducer';
import COLORS from '@/assets/colors';
import { SERVER_URL } from '@env';
import { flattenPosts } from '@/core/thread/components/thread.utils';
import { useFetchNFTs } from '@/modules/nft';

const SERVER_BASE_URL = SERVER_URL || 'http://localhost:3000';

type OtherProfileRouteProp = RouteProp<RootStackParamList, 'OtherProfile'>;

export default function OtherProfileScreen() {
  const route = useRoute<OtherProfileRouteProp>();
  const { userId } = route.params; // The user's wallet address or ID from the route
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dispatch = useAppDispatch();

  // Get current wallet provider from Redux
  const provider = useAppSelector(state => state.auth.provider);
  const myWallet = useAppSelector(state => state.auth.address);

  // Data from Redux
  const allPosts = useAppSelector(state => state.thread.allPosts);
  const [myPosts, setMyPosts] = useState<ThreadPost[]>([]);
  const [username, setUsername] = useState('Loading...');
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [attachmentData, setAttachmentData] = useState<any>({});
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track the current profile ID to handle navigation between profiles
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);

  // Check if the user we're trying to view is ourselves
  const isOwnProfile = useMemo(() => {
    if (!myWallet || !userId) return false;
    return myWallet.toLowerCase() === userId.toLowerCase();
  }, [myWallet, userId]);

  // If it's our own profile, redirect to ProfileScreen
  useEffect(() => {
    if (isOwnProfile) {
      navigation.navigate('ProfileScreen' as never);
    }
  }, [isOwnProfile, navigation]);

  // Reset user data when userId changes, especially when navigating between different users
  useEffect(() => {
    if (userId !== currentProfileId) {
      // Clear previous user data when viewing a different user
      setUsername('Loading...');
      setProfilePicUrl(null);
      setAttachmentData({});
      setCurrentProfileId(userId);
      setLoading(true);
    }
  }, [userId, currentProfileId]);

  // Refetch when screen comes into focus to ensure fresh data
  useFocusEffect(
    React.useCallback(() => {
      // Only fetch if we have a userId and it doesn't match the current profile
      if (userId && (!currentProfileId || userId !== currentProfileId)) {
        const fetchUserData = async () => {
          setLoading(true);
          await fetchData();
        };
        fetchUserData();
      }
      return () => {
        // Cleanup if needed
      };
    }, [userId, currentProfileId])
  );

  // Fetch user profile from server directly, not through auth reducer
  const fetchData = async () => {
    if (!userId) {
      setError('No user ID provided');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Fetch profile directly from API instead of using auth reducer
      const response = await fetch(
        `${SERVER_BASE_URL}/api/profile?userId=${userId}`,
      );
      const data = await response.json();

      if (data.success) {
        if (data.url) {
          setProfilePicUrl(data.url);
        }
        if (data.username) {
          setUsername(data.username);
        }
        if (data.attachmentData) {
          setAttachmentData(data.attachmentData);
        }
        if (data.description) {
          setDescription(data.description);
        }
      } else {
        throw new Error(data.error || 'Failed to fetch user profile');
      }
    } catch (err: any) {
      console.warn('Failed to fetch user profile for other user:', err);
      setError(`Couldn't load profile data: ${err.message || 'Unknown error'}`);
      // Don't show the error to the user, just set default values
      setUsername('Unknown User');
    } finally {
      setLoading(false);
    }
  };

  // Initial profile fetch
  useEffect(() => {
    fetchData();
  }, [userId]); // Remove provider dependency

  // Fetch all posts so we can filter
  useEffect(() => {
    dispatch(fetchAllPosts()).catch(err => {
      console.warn('Failed to fetch posts:', err);
    });
  }, [dispatch]);

  // Filter posts belonging to userId
  useEffect(() => {
    if (!userId) {
      setMyPosts([]);
      return;
    }

    try {
      // Use the flattenPosts utility to get all posts including nested replies
      const flattenedPosts = flattenPosts(allPosts);

      // Filter for posts by this user
      const userPosts = flattenedPosts.filter(
        (p: ThreadPost) => p.user?.id?.toLowerCase() === userId.toLowerCase()
      );

      // Sort by creation date, newest first
      userPosts.sort((a: ThreadPost, b: ThreadPost) => (new Date(b.createdAt) > new Date(a.createdAt) ? 1 : -1));

      setMyPosts(userPosts);
    } catch (error) {
      console.error('Error filtering posts:', error);
      setMyPosts([]);
    }
  }, [allPosts, userId]);

  // Custom useFetchNFTs hook with error handling for Dynamic wallet
  const {
    nfts,
    loading: loadingNfts,
    error: nftsError
  } = useFetchNFTs(userId, { providerType: provider });

  // Handle go back
  const handleGoBack = () => {
    navigation.goBack();
  };

  // Handle post press
  const handlePostPress = (post: ThreadPost) => {
    navigation.navigate('PostThread', { postId: post.id });
  };

  // Show a loading spinner while profile data is being fetched
  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          Platform.OS === 'android' && styles.androidSafeArea,
        ]}>
        <ProfileSkeleton />
      </SafeAreaView>
    );
  }

  // Show error message if something went wrong
  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        Platform.OS === 'android' && styles.androidSafeArea,
      ]}>
      <Profile
        isOwnProfile={false}
        user={{
          address: userId,
          profilePicUrl: profilePicUrl || '',
          username: username,
          description: description,
          attachmentData: attachmentData,
        }}
        posts={myPosts}
        nfts={nfts}
        loadingNfts={loadingNfts || loading}
        fetchNftsError={nftsError}
        containerStyle={styles.profileContainer}
        onGoBack={handleGoBack}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  androidSafeArea: {
    paddingTop: 30,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#555',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    padding: 20,
  },
  profileContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
