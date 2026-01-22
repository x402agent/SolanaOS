// FILE: src/state/thread/reducer.ts
import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import type {
  ThreadPost,
  ThreadSection,
} from '@/core/thread/components/thread.types';
import {allposts as fallbackPosts} from '../../mocks/posts';
import {SERVER_URL} from '@env';

const SERVER_BASE_URL = SERVER_URL || 'http://localhost:3000';

// Debug environment variable loading
console.log('[Thread Reducer] SERVER_URL from @env:', SERVER_URL);
console.log('[Thread Reducer] SERVER_BASE_URL resolved to:', SERVER_BASE_URL);

// fetchAllPosts
export const fetchAllPosts = createAsyncThunk(
  'thread/fetchAllPosts',
  async (userId: string | undefined, {rejectWithValue}) => {
    try {
      const url = userId
        ? `${SERVER_BASE_URL}/api/posts?userId=${encodeURIComponent(userId)}`
        : `${SERVER_BASE_URL}/api/posts`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.success) {
        return rejectWithValue(data.error || 'Failed to fetch posts');
      }
      return data.data.length > 0 ? data.data : fallbackPosts;
    } catch (error: any) {
      console.error('Fetch posts error, using fallback posts:', error.message);
      return fallbackPosts;
    }
  },
);

/**
 * createRootPostAsync
 * Instead of passing a full user object, we pass userId only.
 *
 * NOTE: We now also support an optional `localId` that references the local post's ID.
 * This helps remove any local duplicates if we already inserted a local post.
 */
export const createRootPostAsync = createAsyncThunk(
  'thread/createRootPost',
  async (payload: {
    userId: string;
    sections: ThreadSection[];
    localId?: string;
  }) => {
    const {userId, sections} = payload;
    const res = await fetch(`${SERVER_BASE_URL}/api/posts`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({userId, sections}),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to create post');
    return data.data;
  },
);

/**
 * createReplyAsync
 * Pass userId, sections, parentId.
 */
export const createReplyAsync = createAsyncThunk(
  'thread/createReply',
  async (payload: {
    parentId: string;
    userId: string;
    sections: ThreadSection[];
  }) => {
    const res = await fetch(`${SERVER_BASE_URL}/api/posts/reply`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to create reply');
    return data.data;
  },
);

/**
 * createRetweetAsync
 * Pass userId, retweetOf, and optionally sections.
 * If sections are included, it's a quote retweet.
 */
export const createRetweetAsync = createAsyncThunk(
  'thread/createRetweet',
  async (
    payload: {
      retweetOf: string;
      userId: string;
      sections?: ThreadSection[];
    },
    {getState},
  ) => {
    const state = getState() as {thread: ThreadState};

    // Get the target post
    const targetPost = state.thread.allPosts.find(
      p => p.id === payload.retweetOf,
    );

    // Error checks

    // Check if user already retweeted this post
    const existingRetweet = state.thread.allPosts.find(
      p =>
        p.retweetOf?.id === payload.retweetOf && p.user.id === payload.userId,
    );

    const hasAlreadyRetweeted = existingRetweet !== undefined;

    // Check if target post is the user's own retweet (direct retweet, not quote)
    const isTargetPostOwnRetweet =
      targetPost?.retweetOf &&
      targetPost.user.id === payload.userId &&
      (!targetPost.sections || targetPost.sections.length === 0);

    // For quote retweets, different rules apply
    const isQuoteRetweet = payload.sections && payload.sections.length > 0;

    // If already retweeted and we're doing a direct retweet again, prevent duplicate
    if (hasAlreadyRetweeted && !isQuoteRetweet) {
      throw new Error('You have already retweeted this post');
    }

    // If retweeting own retweet (direct retweet), suggest using the original post
    if (isTargetPostOwnRetweet && !isQuoteRetweet) {
      throw new Error(
        'This is already your retweet. Try retweeting the original post instead.',
      );
    }

    // If we're quoting an already retweeted post, update the existing retweet
    if (hasAlreadyRetweeted && isQuoteRetweet && existingRetweet) {
      // For API, we should update the existing retweet instead of creating a new one
      const updateRes = await fetch(`${SERVER_BASE_URL}/api/posts/update`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          postId: existingRetweet.id,
          sections: payload.sections,
        }),
      });

      const updateData = await updateRes.json();
      if (!updateData.success) {
        throw new Error(updateData.error || 'Failed to update quote retweet');
      }

      // Return the updated post
      return updateData.data as ThreadPost;
    }

    // Normal case: create a new retweet
    const res = await fetch(`${SERVER_BASE_URL}/api/posts/retweet`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to retweet');
    return data.data as ThreadPost;
  },
);

// updatePostAsync
export const updatePostAsync = createAsyncThunk(
  'thread/updatePost',
  async ({postId, sections}: {postId: string; sections: ThreadSection[]}) => {
    const res = await fetch(`${SERVER_BASE_URL}/api/posts/update`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({postId, sections}),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update post');
    return data.data as ThreadPost;
  },
);

/**
 * deletePostAsync
 * Now returns an object with postId, retweetOf, and parentId.
 */
export const deletePostAsync = createAsyncThunk(
  'thread/deletePost',
  async (postId: string, {getState}) => {
    // Get post info before deleting for proper state updates
    const state = getState() as {thread: ThreadState};
    const postToDelete = state.thread.allPosts.find(p => p.id === postId);
    const retweetOf = postToDelete?.retweetOf?.id;
    const parentId = postToDelete?.parentId;

    const res = await fetch(`${SERVER_BASE_URL}/api/posts/${postId}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to delete post');

    // Return with explicit post information for reducer handling
    return {
      ...data,
      postId,
      retweetOf,
      parentId,
    };
  },
);

// addReactionAsync
export const addReactionAsync = createAsyncThunk(
  'thread/addReaction',
  async ({
    postId,
    reactionEmoji,
    userId,
  }: {
    postId: string;
    reactionEmoji: string;
    userId: string;
  }) => {
    const res = await fetch(`${SERVER_BASE_URL}/api/posts/${postId}/reaction`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({reactionEmoji, userId}),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to add reaction');
    return data.data; // updated post from server
  },
);

interface ThreadState {
  allPosts: ThreadPost[];
  loading: boolean;
  error: string | null;
  activeReactionTrayPostId: string | null;
}

const initialState: ThreadState = {
  allPosts: fallbackPosts,
  loading: false,
  error: null,
  activeReactionTrayPostId: null,
};

function removePostRecursive(
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
 * Utility to check if a user has already retweeted a post
 */
function checkIfAlreadyRetweeted(
  state: ThreadState,
  userId: string,
  postId: string,
): boolean {
  // 1. Check if any post is a retweet of the target post by this user
  return state.allPosts.some(
    p => p.retweetOf?.id === postId && p.user.id === userId,
  );
}

/**
 * Utility to find a user's retweet of a specific post
 */
function findRetweetByUser(
  state: ThreadState,
  userId: string,
  postId: string,
): ThreadPost | undefined {
  return state.allPosts.find(
    p => p.retweetOf?.id === postId && p.user.id === userId,
  );
}

/**
 * Update retweet count on a post
 */
function updateRetweetCount(
  posts: ThreadPost[],
  postId: string,
  increment: boolean,
): boolean {
  for (const p of posts) {
    if (p.id === postId) {
      if (increment) {
        // Increment count (default to 0 if undefined)
        p.retweetCount = (p.retweetCount || 0) + 1;
      } else {
        // Decrement count (but never below 0)
        p.retweetCount = Math.max(0, (p.retweetCount || 0) - 1);
      }
      return true;
    }

    // Check in replies
    if (p.replies.length > 0) {
      if (updateRetweetCount(p.replies, postId, increment)) {
        return true;
      }
    }
  }
  return false;
}

export const threadSlice = createSlice({
  name: 'thread',
  initialState,
  reducers: {
    /**
     * Allows creating a post locally if offline or in fallback scenario.
     */
    addPostLocally: (state, action: PayloadAction<ThreadPost>) => {
      state.allPosts.unshift(action.payload);
    },
    /**
     * Allows adding a reply locally.
     */
    addReplyLocally: (
      state,
      action: PayloadAction<{parentId: string; reply: ThreadPost}>,
    ) => {
      const {parentId, reply} = action.payload;
      function addReply(posts: ThreadPost[]): boolean {
        for (const post of posts) {
          if (post.id === parentId) {
            post.replies.unshift(reply);
            post.quoteCount += 1;
            return true;
          }
          if (post.replies && post.replies.length > 0) {
            if (addReply(post.replies)) return true;
          }
        }
        return false;
      }
      addReply(state.allPosts);
    },
    /**
     * Allows adding a retweet locally.
     */
    addRetweetLocally: (state, action: PayloadAction<ThreadPost>) => {
      // First check if this user already retweeted this post to prevent duplicates
      const newRetweet = action.payload;
      const originalPostId = newRetweet.retweetOf?.id;
      const userId = newRetweet.user.id;

      if (!originalPostId || !userId) {
        return; // Invalid data, don't proceed
      }

      // Determine if this is a quote retweet
      const isQuoteRetweet =
        newRetweet.sections && newRetweet.sections.length > 0;

      // Check if user already retweeted this post
      const alreadyRetweeted = checkIfAlreadyRetweeted(
        state,
        userId,
        originalPostId,
      );

      // Check if target post is the user's own retweet
      const targetPost = state.allPosts.find(p => p.id === originalPostId);
      const isTargetPostOwnRetweet =
        targetPost?.retweetOf && targetPost.user.id === userId;

      // If it's a direct retweet and user already retweeted, don't add duplicate
      if (alreadyRetweeted && !isQuoteRetweet) {
        return;
      }

      // Don't allow retweeting own retweets
      if (isTargetPostOwnRetweet && !isQuoteRetweet) {
        return;
      }

      // Add the retweet to the posts
      state.allPosts.unshift(newRetweet);

      // Update the original post's retweet count
      if (originalPostId) {
        updateRetweetCount(state.allPosts, originalPostId, true);
      }
    },
    /**
     * Manually undo a retweet (when Redux direct access is needed)
     */
    undoRetweetLocally: (
      state,
      action: PayloadAction<{userId: string; originalPostId: string}>,
    ) => {
      const {userId, originalPostId} = action.payload;

      // Find the retweet post to remove
      const retweet = findRetweetByUser(state, userId, originalPostId);

      if (retweet) {
        // Remove the retweet
        state.allPosts = state.allPosts.filter(p => p.id !== retweet.id);

        // Decrement the original post's retweet count
        updateRetweetCount(state.allPosts, originalPostId, false);
      }
    },
    /**
     * Set which post's reaction tray is currently active (open)
     * Pass null to close all reaction trays
     */
    setActiveReactionTray: (state, action: PayloadAction<string | null>) => {
      state.activeReactionTrayPostId = action.payload;
    },
    /**
     * Close the reaction tray for a specific post
     */
    closeReactionTray: (state, action: PayloadAction<string>) => {
      if (state.activeReactionTrayPostId === action.payload) {
        state.activeReactionTrayPostId = null;
      }
    },
  },
  extraReducers: builder => {
    // fetchAllPosts
    builder.addCase(fetchAllPosts.pending, state => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchAllPosts.fulfilled, (state, action) => {
      state.loading = false;
      state.allPosts = action.payload;
    });
    builder.addCase(fetchAllPosts.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch posts';
    });

    // createRootPostAsync
    builder.addCase(createRootPostAsync.fulfilled, (state, action) => {
      // If there's a local ID, remove the local post to avoid duplication
      const localId = action.meta.arg.localId;
      if (localId && localId.startsWith('local-')) {
        state.allPosts = state.allPosts.filter(p => p.id !== localId);
      }
      // Now unshift the new "official" post from server
      state.allPosts.unshift(action.payload);
    });

    // createReplyAsync
    builder.addCase(createReplyAsync.fulfilled, (state, action) => {
      const newReply = action.payload;
      const parentId = newReply.parentId;
      function insertReply(posts: ThreadPost[]): boolean {
        for (const post of posts) {
          if (post.id === parentId) {
            post.replies.unshift(newReply);
            post.quoteCount += 1;
            return true;
          }
          if (post.replies.length > 0) {
            if (insertReply(post.replies)) return true;
          }
        }
        return false;
      }
      insertReply(state.allPosts);
    });

    // createRetweetAsync
    builder.addCase(createRetweetAsync.fulfilled, (state, action) => {
      const newRetweet = action.payload;

      // If there's no retweetOf property, something is wrong
      if (!newRetweet.retweetOf?.id) {
        return;
      }

      // Determine if this is a quote retweet (has sections)
      const isQuoteRetweet = newRetweet.sections.length > 0;

      // Check if we're updating an existing retweet (for quotes)
      const existingRetweetIndex = state.allPosts.findIndex(
        p => p.id === newRetweet.id,
      );

      if (existingRetweetIndex >= 0) {
        // Update the existing retweet with new sections
        state.allPosts[existingRetweetIndex] = newRetweet;
      } else {
        // For direct retweets, check if the user already retweeted this post
        if (!isQuoteRetweet) {
          const existingRetweet = findRetweetByUser(
            state,
            newRetweet.user.id,
            newRetweet.retweetOf.id,
          );

          if (existingRetweet) {
            // If there's a duplicate, remove it first (handles edge cases)
            state.allPosts = state.allPosts.filter(
              p => p.id !== existingRetweet.id,
            );
          }
        }

        // Add the new retweet
        state.allPosts.unshift(newRetweet);

        // For both quote and direct retweets, increment the retweetCount
        updateRetweetCount(state.allPosts, newRetweet.retweetOf.id, true);
      }

      // We no longer increment quoteCount for quote retweets, as they are not considered replies
    });
    builder.addCase(createRetweetAsync.rejected, (state, action) => {
      state.error = action.error.message || 'Failed to retweet.';
    });

    // updatePostAsync
    builder.addCase(updatePostAsync.fulfilled, (state, action) => {
      const updatedPost = action.payload;
      function updatePostRecursively(posts: ThreadPost[]): ThreadPost[] {
        return posts.map(p => {
          if (p.id === updatedPost.id) {
            // If this is updating a retweet post with a quote, preserve all other fields
            if (p.retweetOf) {
              return {
                ...p,
                sections: updatedPost.sections,
              };
            }
            // Normal case - just update sections
            return {...p, sections: updatedPost.sections};
          }
          if (p.replies.length > 0) {
            p.replies = updatePostRecursively(p.replies);
          }
          return p;
        });
      }
      state.allPosts = updatePostRecursively(state.allPosts);
    });

    // deletePostAsync
    builder.addCase(deletePostAsync.fulfilled, (state, action) => {
      const {postId, retweetOf, parentId} = action.payload;

      // Remove the post
      state.allPosts = removePostRecursive(state.allPosts, postId);

      // If this post is a retweet, decrement the original post's retweetCount
      if (retweetOf) {
        updateRetweetCount(state.allPosts, retweetOf, false);
      }

      // If this post is a reply, decrement the parent's quoteCount
      // Helper function moved outside the if block
      const decrementQuote = (posts: ThreadPost[]): boolean => {
        for (const p of posts) {
          if (p.id === parentId) {
            if (p.quoteCount > 0) p.quoteCount -= 1;
            return true;
          }
          if (p.replies.length > 0) {
            if (decrementQuote(p.replies)) return true;
          }
        }
        return false;
      };

      if (parentId) {
        decrementQuote(state.allPosts);
      }
    });

    // addReactionAsync - optimistic update on pending
    builder.addCase(addReactionAsync.pending, (state, action) => {
      const {postId, reactionEmoji, userId} = action.meta.arg;

      function updatePostOptimistically(posts: ThreadPost[]): ThreadPost[] {
        return posts.map(p => {
          if (p.id === postId) {
            const currentReactions = {...(p.reactions || {})};
            const currentUserReaction = p.userReaction;
            let newReactionCount = p.reactionCount || 0;
            let newUserReaction: string | null = null;

            // If user already has a reaction
            if (currentUserReaction) {
              if (currentUserReaction === reactionEmoji) {
                // Same reaction - remove it
                if (currentReactions[reactionEmoji] > 1) {
                  currentReactions[reactionEmoji] -= 1;
                } else {
                  delete currentReactions[reactionEmoji];
                }
                newReactionCount = Math.max(0, newReactionCount - 1);
                newUserReaction = null;
              } else {
                // Different reaction - update it
                // Remove old reaction
                if (currentReactions[currentUserReaction] > 1) {
                  currentReactions[currentUserReaction] -= 1;
                } else {
                  delete currentReactions[currentUserReaction];
                }
                // Add new reaction
                currentReactions[reactionEmoji] =
                  (currentReactions[reactionEmoji] || 0) + 1;
                // Count stays same (remove + add = 0 net change)
                newUserReaction = reactionEmoji;
              }
            } else {
              // No existing reaction - add new one
              currentReactions[reactionEmoji] =
                (currentReactions[reactionEmoji] || 0) + 1;
              newReactionCount += 1;
              newUserReaction = reactionEmoji;
            }

            return {
              ...p,
              reactions: currentReactions,
              reactionCount: newReactionCount,
              userReaction: newUserReaction,
            };
          }
          if (p.replies.length > 0) {
            p.replies = updatePostOptimistically(p.replies);
          }
          return p;
        });
      }

      state.allPosts = updatePostOptimistically(state.allPosts);
    });

    // addReactionAsync - update with server response
    builder.addCase(addReactionAsync.fulfilled, (state, action) => {
      const updatedPost = action.payload as ThreadPost & {
        userReaction?: string | null;
      };
      function replacePost(posts: ThreadPost[]): ThreadPost[] {
        return posts.map(p => {
          if (p.id === updatedPost.id) {
            // Always use server response as the source of truth
            return {
              ...p,
              reactionCount: updatedPost.reactionCount,
              reactions: updatedPost.reactions || {},
              userReaction: updatedPost.userReaction,
            };
          }
          if (p.replies.length > 0) {
            p.replies = replacePost(p.replies);
          }
          return p;
        });
      }
      state.allPosts = replacePost(state.allPosts);
    });

    // addReactionAsync - handle errors by reverting optimistic update
    builder.addCase(addReactionAsync.rejected, (state, action) => {
      // In case of error, revert the optimistic update by refetching
      console.warn('Reaction failed:', action.error.message);
      state.error = action.error.message || 'Failed to add reaction';

      // Note: In a production app, you might want to revert the optimistic update here
      // For now, we'll let the user try again or refresh to get the correct state
    });
  },
});

export const {
  addPostLocally, 
  addReplyLocally, 
  addRetweetLocally, 
  undoRetweetLocally,
  setActiveReactionTray,
  closeReactionTray
} = threadSlice.actions;
export default threadSlice.reducer;
