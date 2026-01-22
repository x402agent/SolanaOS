/**
 * Profile utility functions
 */

import { ThreadPost } from "../../thread/types";


/**
 * Flattens nested threads for display in profile
 * @param posts Array of thread posts
 * @returns Flattened array of posts
 */
export function flattenPosts(posts: ThreadPost[]): ThreadPost[] {
  if (!posts || !posts.length) return [];

  const flattened: ThreadPost[] = [];
  
  // Process each post and its replies
  const processPost = (post: ThreadPost) => {
    flattened.push(post);
    
    // Process replies if they exist
    if (post.replies && post.replies.length > 0) {
      post.replies.forEach(reply => processPost(reply));
    }
  };
  
  // Start with top-level posts
  posts.forEach(post => processPost(post));
  
  // Sort by timestamp, newest first
  return flattened.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Check if a user is the owner of a wallet address
 * @param currentUserWallet Current user's wallet address
 * @param targetWallet Wallet address to check
 * @returns Boolean indicating if the current user owns the target wallet
 */
export function isUserWalletOwner(
  currentUserWallet: string | undefined | null,
  targetWallet: string | undefined | null
): boolean {
  if (!currentUserWallet || !targetWallet) return false;
  return currentUserWallet.toLowerCase() === targetWallet.toLowerCase();
}

/**
 * Format wallet address for display (truncate)
 * @param address Wallet address to format
 * @param startChars Number of characters to show at start
 * @param endChars Number of characters to show at end
 * @returns Formatted wallet address string
 */
export function formatWalletAddress(
  address: string,
  startChars: number = 4,
  endChars: number = 4
): string {
  if (!address || address.length <= startChars + endChars + 3) {
    return address;
  }
  
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Generate a default profile picture URL based on wallet address
 * @param address Wallet address
 * @returns URL for default profile picture
 */
export function getDefaultProfilePicUrl(address: string): string {
  // This could use a service like RoboHash, Dicebear Avatars, etc.
  // For now, returning a simple placeholder
  const hash = address ? address.slice(-8) : Math.random().toString(36).substring(2, 10);
  return `https://robohash.org/${hash}.png?set=set4&size=150x150`;
}

/**
 * Calculate profile stats for display
 * @param posts User's posts
 * @param followersCount Number of followers
 * @param followingCount Number of following
 * @returns Object containing profile stats
 */
export function calculateProfileStats(
  posts: ThreadPost[],
  followersCount: number,
  followingCount: number
): {
  postCount: number;
  followersCount: number;
  followingCount: number;
  likeCount: number;
} {
  // Count total likes across all posts
  const likeCount = posts.reduce((total, post) => total + (post.reactionCount ?? 0), 0);
  
  return {
    postCount: posts.length,
    followersCount,
    followingCount,
    likeCount
  };
} 