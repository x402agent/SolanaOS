/**
 * File: src/services/profileService.ts
 *
 * Handles profile-related server requests and logic.
 */

import {SERVER_URL} from '@env';

/**
 * Upload a profile avatar image for a given user.
 *
 * @param userWallet   The user's wallet address (unique ID)
 * @param localFileUri Local file URI of the image
 * @returns New remote avatar URL
 * @throws Error on failure
 */
export async function uploadProfileAvatar(
  userWallet: string,
  localFileUri: string,
): Promise<string> {
  if (!userWallet || !localFileUri || !SERVER_URL) {
    throw new Error('Missing data to upload avatar');
  }

  const formData = new FormData();
  formData.append('userId', userWallet);
  // Append the image under "profilePic"
  formData.append('profilePic', {
    uri: localFileUri,
    type: 'image/jpeg',
    name: `profile_${Date.now()}.jpg`,
  } as any);

  const response = await fetch(`${SERVER_URL}/api/profile/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Upload avatar request failed.');
  }

  return data.url as string;
}

/**
 * Fetch a user's followers from the server.
 * @param userId The user's wallet address or ID
 * @returns An array of follower objects
 */
export async function fetchFollowers(userId: string): Promise<any[]> {
  if (!SERVER_URL) {
    console.warn('SERVER_URL not set. Returning empty followers array.');
    return [];
  }
  try {
    const res = await fetch(
      `${SERVER_URL}/api/profile/followers?userId=${userId}`,
    );
    const data = await res.json();
    if (data.success && Array.isArray(data.followers)) {
      return data.followers;
    }
    return [];
  } catch (err) {
    console.warn('Error fetching followers:', err);
    return [];
  }
}

/**
 * Fetch a user's following list from the server.
 * @param userId The user's wallet address or ID
 * @returns An array of following objects
 */
export async function fetchFollowing(userId: string): Promise<any[]> {
  if (!SERVER_URL) {
    console.warn('SERVER_URL not set. Returning empty following array.');
    return [];
  }
  try {
    const res = await fetch(
      `${SERVER_URL}/api/profile/following?userId=${userId}`,
    );
    const data = await res.json();
    if (data.success && Array.isArray(data.following)) {
      return data.following;
    }
    return [];
  } catch (err) {
    console.warn('Error fetching following:', err);
    return [];
  }
}

/**
 * Checks if a target user is in *my* followers list => do they follow me?
 * @param myWallet  My own wallet ID
 * @param userWallet The target user's ID
 * @returns boolean (true => they follow me)
 */
export async function checkIfUserFollowsMe(
  myWallet: string,
  userWallet: string,
): Promise<boolean> {
  if (!SERVER_URL) {
    console.warn(
      'SERVER_URL not set. Returning false for checkIfUserFollowsMe.',
    );
    return false;
  }
  try {
    const res = await fetch(
      `${SERVER_URL}/api/profile/followers?userId=${myWallet}`,
    );
    const data = await res.json();
    if (data.success && Array.isArray(data.followers)) {
      return data.followers.some((f: any) => f.id === userWallet);
    }
    return false;
  } catch (err) {
    console.warn('Error in checkIfUserFollowsMe:', err);
    return false;
  }
}

export const fetchUserProfile = async (userId: string) => {
  try {
    const response = await fetch(`YOUR_API_URL/profile?userId=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch profile');
    const data = await response.json();
    
    return {
      url: data.url,
      username: data.username,
      attachmentData: data.attachmentData || {},
    };
  } catch (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }
};
