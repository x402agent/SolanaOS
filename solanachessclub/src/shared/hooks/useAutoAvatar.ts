import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from './useReduxHooks';
import { updateProfilePic } from '../state/auth/reducer';

interface UseAutoAvatarOptions {
  /** Whether to preload the avatar for better UX */
  preload?: boolean;
  /** Whether to update Redux state when avatar is provided */
  updateRedux?: boolean;
}

interface UseAutoAvatarReturn {
  /** The avatar URL to use (existing profile pic only) */
  avatarUrl: string | null;
  /** Whether the avatar is currently being loaded */
  isLoading: boolean;
  /** Any error that occurred */
  error: string | null;
  /** Whether the current avatar is a DiceBear generated one (based on URL) */
  isDiceBearAvatar: boolean;
}

/**
 * Hook for managing user avatars (existing profile pictures only)
 * 
 * @param userId - User ID/wallet address (optional, defaults to current user)
 * @param existingProfilePic - Existing profile picture URL (optional)
 * @param options - Configuration options
 * @returns Avatar management state
 */
export function useAutoAvatar(
  userId?: string,
  existingProfilePic?: string | null,
  options: UseAutoAvatarOptions = {}
): UseAutoAvatarReturn {
  const {
    preload = true,
    updateRedux = true
  } = options;

  const dispatch = useAppDispatch();
  
  // Get current user data from Redux
  const currentUserId = useAppSelector(state => state.auth.address);
  const currentUserProfilePic = useAppSelector(state => state.auth.profilePicUrl);
  
  // Use provided userId or fall back to current user
  const targetUserId = userId || currentUserId;
  const targetProfilePic = existingProfilePic !== undefined ? existingProfilePic : currentUserProfilePic;
  
  // Local state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDiceBearAvatar, setIsDiceBearAvatar] = useState(false);

  /**
   * Preload an image URL for better UX
   */
  const preloadImage = useCallback((imageUrl: string) => {
    if (preload && typeof fetch !== 'undefined') {
      fetch(imageUrl, { method: 'HEAD' }).catch(() => {
        // Silently fail - preloading is not critical
      });
    }
  }, [preload]);

  // Effect to set avatar when component mounts or dependencies change
  useEffect(() => {
    setError(null);
    
    if (targetProfilePic && targetProfilePic.trim() !== '') {
      // User has an existing profile picture - set it immediately
      setAvatarUrl(targetProfilePic);
      
      // Check if this is a DiceBear avatar (contains dicebear.com)
      const isDiceBear = targetProfilePic.includes('dicebear.com');
      setIsDiceBearAvatar(isDiceBear);
      
      // Only set loading state briefly if preloading
      if (preload) {
        setIsLoading(true);
        preloadImage(targetProfilePic);
        // Clear loading state quickly since we already have the URL
        setTimeout(() => setIsLoading(false), 100);
      } else {
        setIsLoading(false);
      }
    } else {
      // No profile picture
      setAvatarUrl(null);
      setIsDiceBearAvatar(false);
      setIsLoading(false);
    }
  }, [targetUserId, targetProfilePic, preloadImage, preload]);

  return {
    avatarUrl,
    isLoading,
    error,
    isDiceBearAvatar
  };
}

/**
 * Simplified hook for just getting an avatar URL
 * 
 * @param userId - User ID/wallet address
 * @param existingProfilePic - Existing profile picture URL
 * @returns Avatar URL or null if none exists
 */
export function useAvatarUrl(userId?: string, existingProfilePic?: string | null): string | null {
  const { avatarUrl } = useAutoAvatar(userId, existingProfilePic, {
    preload: false,
    updateRedux: false
  });
  
  return avatarUrl;
} 