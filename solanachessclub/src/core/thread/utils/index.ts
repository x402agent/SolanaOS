import { ThreadPost } from '../types';
import { StyleSheet } from 'react-native';

/**
 * Gathers the ancestor chain for a given post.
 *
 * This function is used to climb upward and find a post's parent,
 * its parent's parent, etc. until we reach a post with no parent.
 *
 * Returns an array (chain) from the child to the earliest ancestor.
 */
export function gatherAncestorChain(
  postId: string,
  allPosts: ThreadPost[],
): ThreadPost[] {
  const chain: ThreadPost[] = [];
  let currentId = postId;

  // Find a post in allPosts by ID
  function findById(id: string): ThreadPost | undefined {
    return allPosts.find(p => p.id === id);
  }

  // climb upward until no more parentId
  while (true) {
    const currentPost = findById(currentId);
    if (!currentPost) break;
    chain.push(currentPost);
    if (!currentPost.parentId) {
      break;
    }
    currentId = currentPost.parentId;
  }
  return chain;
}

/**
 * Generates a random ID with a given prefix
 */
export function generateId(prefix: string) {
  return prefix + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Finds a post by its ID within a flat array
 */
export function findPostById(
  posts: ThreadPost[],
  id: string,
): ThreadPost | undefined {
  return posts.find(p => p.id === id);
}

/**
 * Removes a post (and its replies) recursively from an array
 * (Used for local store updates)
 */
export function removePostRecursive(
  posts: ThreadPost[],
  postId: string,
): ThreadPost[] {
  return posts
    .filter(p => p.id !== postId)
    .map(p => {
      if (p.replies.length > 0) {
        p.replies = removePostRecursive(p.replies, postId);
      }
      return p;
    });
}

/**
 * Flattens all nested replies into a single array.
 */
export function flattenPosts(posts: ThreadPost[]): ThreadPost[] {
  const flatList: ThreadPost[] = [];
  function recurse(current: ThreadPost) {
    flatList.push(current);
    if (current.replies && current.replies.length > 0) {
      current.replies.forEach(recurse);
    }
  }
  posts.forEach(recurse);
  return flatList;
}

/**
 * Gathers all descendants (nested replies) of a particular post
 * in a flat array. This is useful for listing all replies to a given post
 * in chronological order.
 *
 * @param postId The post whose replies (and sub-replies) we want
 * @param allPosts All posts in a flat array
 * @returns A flat array of all descendants
 */
export function gatherDescendants(
  postId: string,
  allPosts: ThreadPost[],
): ThreadPost[] {
  const result: ThreadPost[] = [];

  function helper(pid: string) {
    // Find direct children
    const children = allPosts.filter(p => p.parentId === pid);
    for (const child of children) {
      result.push(child);
      helper(child.id);
    }
  }

  helper(postId);
  return result;
}

/**
 * Merges base styles with user-provided overrides and stylesheets.
 * Applies userStyleSheet first, then styleOverrides, ensuring overrides take precedence.
 *
 * @param baseStyles The base StyleSheet object created by StyleSheet.create.
 * @param styleOverrides Optional object containing specific style overrides.
 * @param userStyleSheet Optional object containing a full user-defined stylesheet.
 * @returns A new object with merged styles.
 */
export function mergeStyles(
  baseStyles: {[key: string]: any},
  styleOverrides?: {[key: string]: object},
  userStyleSheet?: {[key: string]: object},
): {[key: string]: any} {
  // Start with a copy of base styles
  let mergedStyles = { ...baseStyles };

  // Merge userStyleSheet if provided
  if (userStyleSheet) {
    Object.keys(userStyleSheet).forEach(key => {
      if (mergedStyles.hasOwnProperty(key)) {
        mergedStyles[key] = StyleSheet.flatten([
          mergedStyles[key],
          userStyleSheet[key],
        ]);
      } else {
        // Add new keys from userStyleSheet if they don't exist in baseStyles
        mergedStyles[key] = userStyleSheet[key];
      }
    });
  }

  // Merge explicit styleOverrides last (they take precedence)
  if (styleOverrides) {
    Object.keys(styleOverrides).forEach(key => {
      if (mergedStyles.hasOwnProperty(key)) {
        mergedStyles[key] = StyleSheet.flatten([
          mergedStyles[key],
          styleOverrides[key],
        ]);
      } else {
        // Add new keys from styleOverrides if they don't exist
        mergedStyles[key] = styleOverrides[key];
      }
    });
  }

  return mergedStyles;
} 