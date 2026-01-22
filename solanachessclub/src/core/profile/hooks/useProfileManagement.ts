/**
 * Custom hook for profile management functionality
 */
import { useState, useCallback, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useReduxHooks';
import { 
  updateProfilePic, 
  updateUsername, 
  updateDescription,
  attachCoinToProfile,
  removeAttachedCoin
} from '@/shared/state/auth/reducer';
import { uploadProfileAvatar } from '../services/profileService';
import { ProfileData } from '../types/index';

/**
 * Hook for managing profile data and actions
 * @param initialProfileData Initial profile data
 * @returns Profile management state and functions
 */
export function useProfileManagement(initialProfileData: Partial<ProfileData>) {
  const dispatch = useAppDispatch();
  
  // Get the current user ID from Redux state
  const userId = useAppSelector(state => state.auth.address || '');
  
  // Local state for profile data
  const [profilePicUrl, setProfilePicUrl] = useState<string>(initialProfileData.profilePicUrl || '');
  const [username, setUsername] = useState<string>(initialProfileData.username || 'Anonymous');
  const [description, setDescription] = useState<string>(initialProfileData.description || '');
  const [attachmentData, setAttachmentData] = useState<any>(initialProfileData.attachmentData || {});
  
  // Loading states
  const [isUpdatingProfilePic, setIsUpdatingProfilePic] = useState(false);
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
  const [isUpdatingDescription, setIsUpdatingDescription] = useState(false);
  const [isUpdatingAttachment, setIsUpdatingAttachment] = useState(false);

  // Update profile data when props change
  useEffect(() => {
    if (initialProfileData.profilePicUrl) 
      setProfilePicUrl(initialProfileData.profilePicUrl);
    
    if (initialProfileData.username) 
      setUsername(initialProfileData.username);
    
    if (initialProfileData.description !== undefined) 
      setDescription(initialProfileData.description);
    
    if (initialProfileData.attachmentData)
      setAttachmentData(initialProfileData.attachmentData);
      
  }, [initialProfileData]);

  /**
   * Handle profile picture selection and update
   */
  const handleUpdateProfilePic = useCallback(async () => {
    // Request permissions
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Sorry, we need camera roll permissions to make this work!'
        );
        return;
      }
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedImageUri = result.assets[0].uri;
      setIsUpdatingProfilePic(true);
      
      try {
        // Upload image to storage and get the URL
        const uploadedUrl = await uploadProfileAvatar('current-user', selectedImageUri);
        
        // Update Redux with the new profile pic URL
        await dispatch(updateProfilePic(uploadedUrl));
        
        // Update local state
        setProfilePicUrl(uploadedUrl);
      } catch (error) {
        console.error('Error updating profile picture:', error);
        Alert.alert('Error', 'Failed to update profile picture. Please try again.');
      } finally {
        setIsUpdatingProfilePic(false);
      }
    }
  }, [dispatch]);

  /**
   * Update username in profile
   * @param newUsername New username to set
   */
  const handleUpdateUsername = useCallback(async (newUsername: string) => {
    if (!newUsername.trim()) {
      Alert.alert('Invalid Username', 'Username cannot be empty');
      return;
    }
    
    setIsUpdatingUsername(true);
    try {
      await dispatch(updateUsername({ userId, newUsername }));
      setUsername(newUsername);
    } catch (error) {
      console.error('Error updating username:', error);
      Alert.alert('Error', 'Failed to update username. Please try again.');
    } finally {
      setIsUpdatingUsername(false);
    }
  }, [dispatch, userId]);

  /**
   * Update profile description/bio
   * @param newDescription New description to set
   */
  const handleUpdateDescription = useCallback(async (newDescription: string) => {
    setIsUpdatingDescription(true);
    try {
      await dispatch(updateDescription({ userId, newDescription }));
      setDescription(newDescription);
    } catch (error) {
      console.error('Error updating description:', error);
      Alert.alert('Error', 'Failed to update bio. Please try again.');
    } finally {
      setIsUpdatingDescription(false);
    }
  }, [dispatch, userId]);

  /**
   * Attach a token/coin to profile
   * @param coinData Coin data to attach
   */
  const handleAttachCoin = useCallback(async (coinData: {
    mint: string;
    symbol?: string;
    name?: string;
    image?: string;
    description?: string;
  }) => {
    setIsUpdatingAttachment(true);
    try {
      await dispatch(attachCoinToProfile({
        userId,
        attachmentData: {
          coin: coinData
        }
      }));
      setAttachmentData((prev: any) => ({
        ...prev,
        coin: coinData
      }));
    } catch (error) {
      console.error('Error attaching coin to profile:', error);
      Alert.alert('Error', 'Failed to attach token to profile. Please try again.');
    } finally {
      setIsUpdatingAttachment(false);
    }
  }, [dispatch, userId]);

  /**
   * Remove attached coin from profile
   */
  const handleRemoveAttachedCoin = useCallback(async () => {
    setIsUpdatingAttachment(true);
    try {
      await dispatch(removeAttachedCoin({ userId }));
      setAttachmentData((prev: any) => {
        const newData = { ...prev };
        delete newData.coin;
        return newData;
      });
    } catch (error) {
      console.error('Error removing attached coin:', error);
      Alert.alert('Error', 'Failed to remove token from profile. Please try again.');
    } finally {
      setIsUpdatingAttachment(false);
    }
  }, [dispatch, userId]);

  return {
    // Profile data
    profilePicUrl,
    username,
    description,
    attachmentData,
    
    // Loading states
    isUpdatingProfilePic,
    isUpdatingUsername,
    isUpdatingDescription,
    isUpdatingAttachment,
    
    // Update handlers
    handleUpdateProfilePic,
    handleUpdateUsername,
    handleUpdateDescription,
    handleAttachCoin,
    handleRemoveAttachedCoin,
  };
}