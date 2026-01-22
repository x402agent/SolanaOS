/**
 * File: src/services/threadImageService.ts
 *
 * Handles thread image upload and compression for posts.
 */

import {SERVER_URL} from '@env';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Compresses an image and prepares it for upload
 * 
 * @param imageUri The local URI of the image to compress
 * @returns A compressed image URI
 */
export async function compressImage(imageUri: string): Promise<string> {
  try {
    // Use Expo's ImageManipulator to resize and compress the image
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 1024, height: 1024 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    return manipResult.uri;
  } catch (error) {
    console.error('Error compressing image:', error);
    // Return original if compression fails
    return imageUri;
  }
}

/**
 * Upload a thread image to IPFS
 *
 * @param userId The user's wallet address
 * @param imageUri Local file URI of the image
 * @returns The IPFS URL where the image is stored
 * @throws Error on failure
 */
export async function uploadThreadImage(
  userId: string,
  imageUri: string,
): Promise<string> {
  if (!userId || !imageUri || !SERVER_URL) {
    throw new Error('Missing data for thread image upload');
  }

  try {
    // First compress the image
    const compressedImageUri = await compressImage(imageUri);
    
    const formData = new FormData();
    formData.append('userId', userId);
    // Append the image under "threadImage"
    formData.append('threadImage', {
      uri: compressedImageUri,
      type: 'image/jpeg',
      name: `thread_${Date.now()}.jpg`,
    } as any);

    const response = await fetch(`${SERVER_URL}/api/thread/images/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Upload thread image request failed.');
    }

    return data.url as string;
  } catch (error) {
    console.error('Failed to upload thread image:', error);
    throw error;
  }
} 