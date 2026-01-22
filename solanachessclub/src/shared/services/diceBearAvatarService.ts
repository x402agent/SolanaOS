/**
 * DiceBear Avatar Service
 * 
 * Automatically generates and manages DiceBear pixel art avatars for users who don't have profile images.
 * Uses only pixel art style with different variations to ensure consistency across the app.
 * Stores the generated avatar URL in local cache for consistency across sessions.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Pixel art style variations - using only available options from DiceBear pixel-art API
// The pixel-art style has limited customization compared to other styles

// Background colors for variation
const BACKGROUND_COLORS = [
  'b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf',
  'a8e6cf', 'dcedc1', 'ffd3a5', 'fd9853', 'c7ceea',
  'f8b195', 'f67280', 'c06c84', '6c5b7b', '355c7d'
];

// Rotation values for variation (0-360 degrees)
const ROTATION_VALUES = [0, 45, 90, 135, 180, 225, 270, 315];

// Scale values for slight size variation (50-200)
const SCALE_VALUES = [80, 90, 100, 110, 120];

// Radius values for corner rounding (0-50)
const RADIUS_VALUES = [0, 5, 10, 15, 20];

// Cache key prefix for storing avatar URLs locally
const AVATAR_CACHE_PREFIX = 'dicebear_avatar_';
const CACHE_VERSION_KEY = 'dicebear_cache_version';
const CURRENT_CACHE_VERSION = '3.0'; // Increment this when avatar generation logic changes

/**
 * Check if cache needs to be cleared due to version change
 */
async function checkAndClearOldCache(): Promise<void> {
  try {
    const storedVersion = await AsyncStorage.getItem(CACHE_VERSION_KEY);
    
    if (storedVersion !== CURRENT_CACHE_VERSION) {
      console.log('[DiceBearService] Cache version changed, clearing old avatars...');
      await clearAllCachedAvatars();
      await AsyncStorage.setItem(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
      console.log('[DiceBearService] Cache cleared and version updated to', CURRENT_CACHE_VERSION);
    }
  } catch (error) {
    console.error('[DiceBearService] Error checking cache version:', error);
  }
}

// Force cache clear on service initialization
checkAndClearOldCache().catch(console.error);

/**
 * Clear all cached avatars (useful when avatar generation logic changes)
 */
export async function clearAllCachedAvatars(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const avatarKeys = allKeys.filter(key => key.startsWith(AVATAR_CACHE_PREFIX));
    
    if (avatarKeys.length > 0) {
      await AsyncStorage.multiRemove(avatarKeys);
      console.log(`[DiceBearService] Cleared ${avatarKeys.length} cached avatars`);
    }
  } catch (error) {
    console.error('[DiceBearService] Error clearing all cached avatars:', error);
  }
}

/**
 * Generate pixel art variation parameters based on user seed
 * Using only the parameters actually available in DiceBear pixel-art API
 */
function getPixelArtVariation(seed: string): { 
  backgroundColor: string;
  flip: boolean;
  rotate: number;
  scale: number;
  radius: number;
} {
  // Create a simple hash from the seed for consistent variation selection
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use different parts of the hash for different parameters
  const bgIndex = Math.abs(hash) % BACKGROUND_COLORS.length;
  const rotationIndex = Math.abs(hash >> 4) % ROTATION_VALUES.length;
  const scaleIndex = Math.abs(hash >> 8) % SCALE_VALUES.length;
  const radiusIndex = Math.abs(hash >> 12) % RADIUS_VALUES.length;
  const flipValue = Math.abs(hash >> 16) % 2 === 0;
  
  return {
    backgroundColor: BACKGROUND_COLORS[bgIndex],
    flip: flipValue,
    rotate: ROTATION_VALUES[rotationIndex],
    scale: SCALE_VALUES[scaleIndex],
    radius: RADIUS_VALUES[radiusIndex]
  };
}

/**
 * Generate a DiceBear pixel art avatar URL with variations
 * 
 * @param seed - Unique seed for the avatar (usually user ID/wallet address)
 * @returns DiceBear pixel art avatar URL with unique variations
 */
export function generateDiceBearAvatarUrl(seed: string): string {
  try {
    // Validate input
    if (!seed || typeof seed !== 'string' || seed.trim() === '') {
      throw new Error('Invalid seed provided for avatar generation');
    }

    // Clean the seed to ensure it's URL-safe
    const cleanSeed = seed.trim();
    
    const baseUrl = 'https://api.dicebear.com/9.x';
    const variation = getPixelArtVariation(cleanSeed);
    
    // Use the user's seed so each user gets a different pixel art character
    // All will be pixel art style, but different characters
    
    // Build URL with pixel art style and variation parameters
    const params = new URLSearchParams({
      seed: cleanSeed, // Use cleaned seed for different pixel art characters
      size: '256',
      backgroundColor: variation.backgroundColor,
      flip: variation.flip.toString(),
      rotate: variation.rotate.toString(),
      scale: variation.scale.toString(),
      radius: variation.radius.toString(),
    });
    
    // Use PNG format for React Native Image component compatibility
    const avatarUrl = `${baseUrl}/pixel-art/png?${params.toString()}`;
    
    // Validate the generated URL
    if (!avatarUrl.includes('dicebear.com') || !avatarUrl.includes('pixel-art')) {
      throw new Error('Generated URL validation failed');
    }
    
    // Debug logging
    console.log('[DiceBearService] Generated PNG avatar URL:', {
      seed: cleanSeed.substring(0, 8) + '...',
      url: avatarUrl,
      variation: variation
    });
    
    return avatarUrl;
  } catch (error) {
    console.error('[DiceBearService] Error generating DiceBear URL:', error);
    
    // Fallback to minimal URL that should always work
    const safeSeed = typeof seed === 'string' ? seed.trim() : 'fallback';
    const fallbackUrl = `https://api.dicebear.com/9.x/pixel-art/png?seed=${encodeURIComponent(safeSeed)}&size=256`;
    
    console.warn('[DiceBearService] Using fallback URL:', fallbackUrl);
    return fallbackUrl;
  }
}

/**
 * Get cached avatar URL from local storage
 * 
 * @param userId - User ID/wallet address
 * @returns Cached avatar URL or null if not found
 */
async function getCachedAvatarUrl(userId: string): Promise<string | null> {
  try {
    const cacheKey = `${AVATAR_CACHE_PREFIX}${userId}`;
    return await AsyncStorage.getItem(cacheKey);
  } catch (error) {
    console.error('[DiceBearService] Error getting cached avatar:', error);
    return null;
  }
}

/**
 * Cache avatar URL in local storage
 * 
 * @param userId - User ID/wallet address
 * @param avatarUrl - Avatar URL to cache
 */
async function setCachedAvatarUrl(userId: string, avatarUrl: string): Promise<void> {
  try {
    const cacheKey = `${AVATAR_CACHE_PREFIX}${userId}`;
    await AsyncStorage.setItem(cacheKey, avatarUrl);
  } catch (error) {
    console.error('[DiceBearService] Error caching avatar:', error);
  }
}

/**
 * Generate and store a DiceBear pixel art avatar for a user
 * 
 * @param userId - User ID/wallet address
 * @param forceRegenerate - Whether to force regeneration even if avatar exists
 * @returns Generated avatar URL
 */
export async function generateAndStoreAvatar(
  userId: string, 
  forceRegenerate: boolean = false
): Promise<string> {
  try {

    if (!userId || userId.trim() === '') {
      throw new Error('Invalid user ID provided');
    }

    // Check and clear old cache if version changed
    await checkAndClearOldCache();
    
    // Check if we already have a cached avatar and don't want to force regenerate
    if (!forceRegenerate) {
      const cachedUrl = await getCachedAvatarUrl(userId);
      if (cachedUrl) {
        if (cachedUrl.includes('dicebear.com') && cachedUrl.includes(userId)) {
          return cachedUrl;
        } else {
          console.warn('[DiceBearService] Cached URL appears invalid, regenerating...');
        }
      }
    }

    // Generate new pixel art avatar URL with retry logic
    let avatarUrl: string;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        avatarUrl = generateDiceBearAvatarUrl(userId);
        
        // Validate the generated URL
        if (!avatarUrl || !avatarUrl.includes('dicebear.com')) {
          throw new Error('Generated URL is invalid');
        }
        
        break; // Success, exit retry loop
      } catch (urlError) {
        attempts++;
        console.warn(`[DiceBearService] Avatar URL generation attempt ${attempts} failed:`, urlError);
        
        if (attempts >= maxAttempts) {
          // Last attempt failed, create a very simple fallback URL
          console.error('[DiceBearService] All generation attempts failed, using simple fallback');
          avatarUrl = `https://api.dicebear.com/9.x/pixel-art/png?seed=${encodeURIComponent(userId)}&size=256`;
        }
      }
    }

    // Cache the avatar URL locally with error handling
    try {
      await setCachedAvatarUrl(userId, avatarUrl!);
    } catch (cacheError) {
      console.warn('[DiceBearService] Failed to cache avatar URL:', cacheError);
      // Don't fail the whole operation for cache errors
    }

    return avatarUrl!;
  } catch (error) {
    console.error('[DiceBearService] Error generating avatar:', error);
    
    // Ultimate fallback: create a minimal URL that should always work
    const fallbackUrl = `https://api.dicebear.com/9.x/pixel-art/png?seed=${encodeURIComponent(userId)}&size=256`;
    console.log('[DiceBearService] Using ultimate fallback avatar:', fallbackUrl);
    
    // Try to cache the fallback too
    try {
      await setCachedAvatarUrl(userId, fallbackUrl);
    } catch (cacheError) {
      console.warn('[DiceBearService] Failed to cache fallback avatar:', cacheError);
    }
    
    return fallbackUrl;
  }
}

/**
 * Get avatar URL for a user - either existing profile picture or generate DiceBear pixel art avatar
 * 
 * @param userId - User ID/wallet address
 * @param existingProfilePic - Existing profile picture URL (if any)
 * @returns Avatar URL to use
 */
export async function getAvatarUrl(
  userId: string, 
  existingProfilePic?: string | null
): Promise<string> {
  try {
    // Validate inputs
    if (!userId || userId.trim() === '') {
      throw new Error('Invalid user ID provided to getAvatarUrl');
    }

    // If user already has a profile picture, validate and use it
    if (existingProfilePic && existingProfilePic.trim() !== '') {
      // Basic URL validation
      if (existingProfilePic.startsWith('http://') || existingProfilePic.startsWith('https://')) {
        return existingProfilePic;
      } else {
        console.warn('[DiceBearService] Invalid profile picture URL format:', existingProfilePic);
        // Continue to generate avatar instead of failing
      }
    }

    // If no profile picture or invalid profile picture, generate/get DiceBear pixel art avatar
    return await generateAndStoreAvatar(userId);
  } catch (error) {
    console.error('[DiceBearService] Error in getAvatarUrl:', error);
    
    // Fallback: try to generate a simple avatar directly
    try {
      return generateDiceBearAvatarUrl(userId);
    } catch (fallbackError) {
      console.error('[DiceBearService] Even fallback avatar generation failed:', fallbackError);
      
      // Ultimate fallback
      return `https://api.dicebear.com/9.x/pixel-art/png?seed=${encodeURIComponent(userId)}&size=256`;
    }
  }
}

/**
 * Clear cached avatar for a user (useful when user uploads their own profile picture)
 * 
 * @param userId - User ID/wallet address
 */
export async function clearCachedAvatar(userId: string): Promise<void> {
  try {
    const cacheKey = `${AVATAR_CACHE_PREFIX}${userId}`;
    await AsyncStorage.removeItem(cacheKey);
  } catch (error) {
    console.error('[DiceBearService] Error clearing cached avatar:', error);
  }
}

/**
 * Preload an avatar image for better UX
 * 
 * @param avatarUrl - Avatar URL to preload
 */
export function preloadAvatar(avatarUrl: string): void {
  // In React Native, we can preload images using Image.prefetch
  // This is a no-op if the image is already cached
  try {
    // Note: Using expo-image prefetch for better compatibility
    // Image.prefetch is not available in web environment
    if (typeof fetch !== 'undefined') {
      // Simple prefetch using fetch (works across platforms)
      fetch(avatarUrl, { method: 'HEAD' }).catch(() => {
        // Silently fail - preloading is not critical
      });
    }
  } catch (error) {
    // Silently fail - preloading is not critical
  }
}

/**
 * Debug function to force clear all caches and regenerate avatars
 * Call this if you're still seeing old avatar styles
 */
export async function debugClearAllCaches(): Promise<void> {
  try {
    console.log('[DiceBearService] DEBUG: Force clearing all caches...');
    await clearAllCachedAvatars();
    await AsyncStorage.removeItem(CACHE_VERSION_KEY);
    await AsyncStorage.setItem(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
    console.log('[DiceBearService] DEBUG: All caches cleared successfully');
  } catch (error) {
    console.error('[DiceBearService] DEBUG: Error clearing caches:', error);
  }
}

/**
 * Generate a simple DiceBear avatar URL for testing (without custom parameters)
 * 
 * @param seed - Unique seed for the avatar
 * @returns Simple DiceBear avatar URL
 */
export function generateSimpleDiceBearAvatarUrl(seed: string): string {
  const baseUrl = 'https://api.dicebear.com/9.x';
  
  // Simple URL with just seed and size
  const simpleUrl = `${baseUrl}/pixel-art/png?seed=${encodeURIComponent(seed)}&size=256`;
  
  console.log('[DiceBearService] Generated simple avatar URL:', simpleUrl);
  
  return simpleUrl;
}

/**
 * Debug function to test different avatar URLs
 */
export function debugTestAvatarUrls(userId: string): void {
  console.log('[DiceBearService] Testing avatar URLs for user:', userId.substring(0, 8) + '...');
  
  // Test 1: Simple URL
  const simpleUrl = generateSimpleDiceBearAvatarUrl(userId);
  console.log('Test 1 - Simple URL:', simpleUrl);
  
  // Test 2: Complex URL with our parameters
  const complexUrl = generateDiceBearAvatarUrl(userId);
  console.log('Test 2 - Complex URL:', complexUrl);
  
  // Test 3: Fixed seed URL
  const fixedUrl = generateSimpleDiceBearAvatarUrl('test123');
  console.log('Test 3 - Fixed seed URL:', fixedUrl);
}

/**
 * Debug function to force regenerate all avatars with PNG format
 * Call this to clear cache and test new PNG URLs
 */
export async function debugForceRegenerateAllAvatars(): Promise<void> {
  try {
    console.log('[DiceBearService] DEBUG: Force clearing cache and regenerating avatars...');
    
    // Clear all caches
    await clearAllCachedAvatars();
    await AsyncStorage.removeItem(CACHE_VERSION_KEY);
    await AsyncStorage.setItem(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
    
    console.log('[DiceBearService] DEBUG: Cache cleared. New avatars will be PNG format.');
    console.log('[DiceBearService] DEBUG: Test URL example:', generateDiceBearAvatarUrl('test123'));
    
  } catch (error) {
    console.error('[DiceBearService] DEBUG: Error in force regenerate:', error);
  }
} 