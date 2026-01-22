/**
 * Chat image service for uploading images to IPFS
 */
import axios from 'axios';
import { SERVER_URL } from '@env';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Uploads a chat image to IPFS
 * 
 * @param userId - User ID for tracking the upload
 * @param imageUri - Local URI of the image to upload
 * @returns Promise that resolves to the IPFS URL of the uploaded image
 */
export async function uploadChatImage(userId: string, imageUri: string): Promise<string> {
  try {
    // Create formData with the image
    const formData = new FormData();
    
    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    if (!fileInfo.exists) {
      throw new Error('Image file does not exist');
    }
    
    // Get filename from URI
    const fileName = imageUri.split('/').pop() || 'chat-image.jpg';
    
    // Add file to form data
    // @ts-ignore: Expo's FormData implementation has a different type
    formData.append('chatImage', {
      uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri,
      name: fileName,
      type: 'image/jpeg', // Assuming JPEG, but could be determined dynamically
    });
    
    // Add userId to track who uploaded the image
    formData.append('userId', userId);

    // Upload to server endpoint
    const response = await axios.post(`${SERVER_URL}/api/chat/images/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.data && response.data.success && response.data.url) {
      return response.data.url;
    } else {
      throw new Error('Failed to get image URL from server');
    }
  } catch (error: any) {
    console.error('Error uploading chat image:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
} 