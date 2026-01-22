// FILE: src/components/thread/thread.utils.ts
import {ThreadPost} from './thread.types';

/**
 * Gathers the ancestor chain for a given post.
 *
 * This function is used to climb upward and find a post’s parent,
 * its parent’s parent, etc. until we reach a post with no parent.
 *
 * NOTE: Because the original code is structured around 'all root posts',
 * you may need to flatten or just pass the entire array of posts. This
 * function tries to find the parent from within the same hierarchy.
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
 * **Utility**: Flattens all nested replies into a single array.
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
 * **New**: Gathers *all* descendants (nested replies) of a particular post
 * in a flat array. This is useful for listing all replies to a given post
 * in chronological order, similar to Twitter’s approach.
 *
 * @param postId The post whose replies (and sub-replies) we want
 * @param allPosts All posts in a flat array
 * @returns A flat array of *all* descendants
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
