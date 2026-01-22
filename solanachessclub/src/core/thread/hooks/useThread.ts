import { useState, useCallback, useMemo } from 'react';
import { ThreadPost, ThreadUser } from '../types';
import { createPost, deletePost, updatePost, fetchPosts, addReaction, createRetweet } from '../services';
import { flattenPosts, findPostById, gatherAncestorChain, gatherDescendants } from '../utils';

/**
 * Custom hook for managing thread functionality
 */
export const useThread = (initialPosts: ThreadPost[] = []) => {
  const [posts, setPosts] = useState<ThreadPost[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Memoized flattened posts array for easier querying
  const flattenedPosts = useMemo(() => flattenPosts(posts), [posts]);
  
  /**
   * Add a new post to the thread
   */
  const addPost = useCallback(async (
    newPostData: Partial<ThreadPost>,
    currentUser: ThreadUser
  ) => {
    try {
      setLoading(true);
      setError(null);
      
      // Create the post through the service
      const createdPost = await createPost({
        ...newPostData,
        user: currentUser
      });
      
      // Add post to state 
      setPosts(currentPosts => {
        // If it's a reply, add it to the parent
        if (newPostData.parentId) {
          return currentPosts.map(post => {
            if (post.id === newPostData.parentId) {
              return {
                ...post,
                replies: [...post.replies, createdPost]
              };
            }
            
            // Also check replies recursively
            if (post.replies && post.replies.length > 0) {
              const updatedReplies = addReplyToParent(post.replies, newPostData.parentId!, createdPost);
              if (updatedReplies !== post.replies) {
                return { ...post, replies: updatedReplies };
              }
            }
            
            return post;
          });
        }
        
        // Otherwise add it as a root post
        return [...currentPosts, createdPost];
      });
      
      return createdPost;
    } catch (err: any) {
      setError(err.message || 'Failed to add post');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Helper function to add a reply to its parent post
   */
  const addReplyToParent = (
    replies: ThreadPost[],
    parentId: string,
    newReply: ThreadPost
  ): ThreadPost[] => {
    return replies.map(reply => {
      if (reply.id === parentId) {
        return {
          ...reply,
          replies: [...reply.replies, newReply]
        };
      }
      
      if (reply.replies && reply.replies.length > 0) {
        const updatedChildReplies = addReplyToParent(reply.replies, parentId, newReply);
        if (updatedChildReplies !== reply.replies) {
          return { ...reply, replies: updatedChildReplies };
        }
      }
      
      return reply;
    });
  };
  
  /**
   * Remove a post from the thread
   */
  const removePost = useCallback(async (postId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Delete the post through the service
      await deletePost(postId);
      
      // Update state by filtering out the post
      setPosts(currentPosts => {
        // Check if it's a root post
        const filteredPosts = currentPosts.filter(post => post.id !== postId);
        
        if (filteredPosts.length < currentPosts.length) {
          return filteredPosts;
        }
        
        // If not a root post, find and remove it from replies
        return currentPosts.map(post => {
          if (post.replies && post.replies.length > 0) {
            const updatedReplies = removeReplyRecursive(post.replies, postId);
            if (updatedReplies !== post.replies) {
              return { ...post, replies: updatedReplies };
            }
          }
          return post;
        });
      });
      
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to remove post');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Helper function to remove a reply recursively
   */
  const removeReplyRecursive = (
    replies: ThreadPost[],
    postId: string
  ): ThreadPost[] => {
    // Filter out the post to be removed
    const filteredReplies = replies.filter(reply => reply.id !== postId);
    
    if (filteredReplies.length < replies.length) {
      return filteredReplies;
    }
    
    // Check nested replies
    return replies.map(reply => {
      if (reply.replies && reply.replies.length > 0) {
        const updatedNestedReplies = removeReplyRecursive(reply.replies, postId);
        if (updatedNestedReplies !== reply.replies) {
          return { ...reply, replies: updatedNestedReplies };
        }
      }
      return reply;
    });
  };
  
  /**
   * Update an existing post
   */
  const updateThreadPost = useCallback(async (
    postId: string,
    updateData: Partial<ThreadPost>
  ) => {
    try {
      setLoading(true);
      setError(null);
      
      // Update the post through the service
      const updatedPost = await updatePost(postId, updateData);
      
      // Update state
      setPosts(currentPosts => {
        // Check if it's a root post
        const updatedPosts = currentPosts.map(post => {
          if (post.id === postId) {
            return { ...post, ...updatedPost };
          }
          return post;
        });
        
        if (JSON.stringify(updatedPosts) !== JSON.stringify(currentPosts)) {
          return updatedPosts;
        }
        
        // If not a root post, find and update it in replies
        return currentPosts.map(post => {
          if (post.replies && post.replies.length > 0) {
            const updatedReplies = updateReplyRecursive(post.replies, postId, updateData);
            if (updatedReplies !== post.replies) {
              return { ...post, replies: updatedReplies };
            }
          }
          return post;
        });
      });
      
      return updatedPost;
    } catch (err: any) {
      setError(err.message || 'Failed to update post');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Helper function to update a reply recursively
   */
  const updateReplyRecursive = (
    replies: ThreadPost[],
    postId: string,
    updateData: Partial<ThreadPost>
  ): ThreadPost[] => {
    return replies.map(reply => {
      if (reply.id === postId) {
        return { ...reply, ...updateData };
      }
      
      if (reply.replies && reply.replies.length > 0) {
        const updatedNestedReplies = updateReplyRecursive(reply.replies, postId, updateData);
        if (updatedNestedReplies !== reply.replies) {
          return { ...reply, replies: updatedNestedReplies };
        }
      }
      
      return reply;
    });
  };
  
  /**
   * Add a reaction to a post
   */
  const reactToPost = useCallback(async (
    postId: string,
    reactionType: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      
      // Add reaction through the service
      const newCount = await addReaction(postId, reactionType);
      
      // Update state
      setPosts(currentPosts => {
        const post = findPostById(flattenedPosts, postId);
        
        if (!post) return currentPosts;
        
        const updatedPost = {
          ...post,
          reactionCount: newCount,
          reactions: {
            ...(post.reactions || {}),
            [reactionType]: (post.reactions?.[reactionType] || 0) + 1
          }
        };
        
        return updatePostInTree(currentPosts, updatedPost);
      });
      
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to add reaction');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [flattenedPosts]);
  
  /**
   * Create a retweet of a post
   */
  const retweetPost = useCallback(async (
    originalPostId: string,
    currentUser: ThreadUser,
    quoteText?: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      
      const originalPost = findPostById(flattenedPosts, originalPostId);
      
      if (!originalPost) {
        throw new Error('Original post not found');
      }
      
      // Create retweet through the service
      const createdRetweet = await createRetweet(originalPostId, quoteText);
      
      // Complete the retweet data
      const completeRetweet: ThreadPost = {
        ...createdRetweet,
        user: currentUser,
        retweetOf: originalPost,
        reactions: {}
      };
      
      // Add to state
      setPosts(currentPosts => [...currentPosts, completeRetweet]);
      
      // Update retweet count on original post
      updateThreadPost(originalPostId, {
        retweetCount: originalPost.retweetCount + 1
      });
      
      return completeRetweet;
    } catch (err: any) {
      setError(err.message || 'Failed to retweet post');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [flattenedPosts, updateThreadPost]);
  
  /**
   * Helper function to update a post in the tree structure
   */
  const updatePostInTree = (
    posts: ThreadPost[],
    updatedPost: ThreadPost
  ): ThreadPost[] => {
    return posts.map(post => {
      if (post.id === updatedPost.id) {
        return updatedPost;
      }
      
      if (post.replies && post.replies.length > 0) {
        const updatedReplies = updatePostInTree(post.replies, updatedPost);
        if (updatedReplies !== post.replies) {
          return { ...post, replies: updatedReplies };
        }
      }
      
      return post;
    });
  };
  
  /**
   * Get a post by ID
   */
  const getPostById = useCallback((postId: string) => {
    return findPostById(flattenedPosts, postId);
  }, [flattenedPosts]);
  
  /**
   * Get ancestor posts for a given post
   */
  const getAncestors = useCallback((postId: string) => {
    return gatherAncestorChain(postId, flattenedPosts);
  }, [flattenedPosts]);
  
  /**
   * Get all replies to a post
   */
  const getDescendants = useCallback((postId: string) => {
    return gatherDescendants(postId, flattenedPosts);
  }, [flattenedPosts]);
  
  /**
   * Load posts from the backend
   */
  const loadPosts = useCallback(async (filters?: {
    userId?: string;
    limit?: number;
    offset?: number;
  }) => {
    try {
      setLoading(true);
      setError(null);
      
      const fetchedPosts = await fetchPosts(filters);
      setPosts(fetchedPosts);
      
      return fetchedPosts;
    } catch (err: any) {
      setError(err.message || 'Failed to load posts');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return {
    posts,
    flattenedPosts,
    loading,
    error,
    addPost,
    removePost,
    updatePost: updateThreadPost,
    reactToPost,
    retweetPost,
    getPostById,
    getAncestors,
    getDescendants,
    loadPosts
  };
}; 