/***************************************************
 * FILE: src/state/users/reducer.ts
 ***************************************************/

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { SERVER_URL } from '@env';

// For local fallback
const SERVER_BASE_URL = SERVER_URL || 'http://localhost:3000';

// Debug environment variable loading
console.log('[Users Reducer] SERVER_URL from @env:', SERVER_URL);
console.log('[Users Reducer] SERVER_BASE_URL resolved to:', SERVER_BASE_URL);

export interface UserProfile {
  id: string;               // user's wallet address
  username: string | null;
  profilePicUrl: string | null;
  followers: string[];      // array of userIds who follow this user
  following: string[];      // array of userIds this user is following

  // Convenient booleans for "follows you" or "you are following them"
  followsYou?: boolean;     // if the user has your ID in their "following" list
  isFollowing?: boolean;    // if your ID is in your "following" list
}

interface UsersState {
  byId: Record<string, UserProfile>;
  loading: boolean;
  error: string | null;
}

// Initial state
const initialState: UsersState = {
  byId: {},
  loading: false,
  error: null,
};

/**
 * Fetch a user's profile from the server, plus followers/following arrays.
 * We can optionally pass the currentUserId to check "followsYou" or "isFollowing."
 */
export const fetchUserFullProfile = createAsyncThunk<
  // Return type of fulfilled
  { userId: string; data: Partial<UserProfile> },
  // Argument
  { userId: string; currentUserId?: string }
>(
  'users/fetchUserFullProfile',
  async ({ userId, currentUserId }, { rejectWithValue }) => {
    try {
      // 1) Basic user info
      const profileResp = await fetch(`${SERVER_BASE_URL}/api/profile?userId=${userId}`);
      const profileData = await profileResp.json();
      if (!profileData.success) {
        return rejectWithValue(profileData.error || 'Failed to fetch user profile');
      }

      // 2) Followers
      const followersResp = await fetch(
        `${SERVER_BASE_URL}/api/profile/followers?userId=${userId}`,
      );
      const followersData = await followersResp.json();
      let followerIds: string[] = [];
      if (followersData.success) {
        followerIds = followersData.followers.map((f: any) => f.id);
      }

      // 3) Following
      const followingResp = await fetch(
        `${SERVER_BASE_URL}/api/profile/following?userId=${userId}`,
      );
      const followingData = await followingResp.json();
      let followingIds: string[] = [];
      if (followingData.success) {
        followingIds = followingData.following.map((f: any) => f.id);
      }

      // Check "followsYou" if we have currentUserId => see if userId's "following" array includes currentUserId
      let followsYou = false;
      let isFollowing = false;

      if (currentUserId) {
        // userId "follows you" if your ID is in userId's following list => means userId is following currentUserId
        // Actually we want to check if "currentUserId" is in userId's "followers," or equivalently,
        // userId is in "currentUserId's following." But the simplest is we just also fetch the "following" of userId above.
        // If userId's following includes currentUserId => userId is following me => "followsYou = true"
        if (followingIds.includes(currentUserId)) {
          followsYou = true;
        }

        // "isFollowing" if the currentUserId is following userId => means currentUserId's following includes userId
        // But we only fetched userId's following. So we might do a separate fetch for currentUserId's following
        // or rely on a single approach. For simplicity, we can do an additional small fetch:
        const yourFollowingResp = await fetch(
          `${SERVER_BASE_URL}/api/profile/following?userId=${currentUserId}`,
        );
        const yourFollowingData = await yourFollowingResp.json();
        if (yourFollowingData.success) {
          const yourFollowing: string[] = yourFollowingData.following.map((f: any) => f.id);
          if (yourFollowing.includes(userId)) {
            isFollowing = true;
          }
        }
      }

      return {
        userId,
        data: {
          id: userId,
          username: profileData.username,
          profilePicUrl: profileData.url,
          followers: followerIds,
          following: followingIds,
          followsYou,
          isFollowing,
        },
      };
    } catch (err: any) {
      console.error('[fetchUserFullProfile] Error:', err);
      return rejectWithValue(err.message || 'Unknown error');
    }
  },
);

/**
 * Follow a user
 */
export const followUser = createAsyncThunk<
  { followingId: string; followerId: string },
  { followingId: string; followerId: string }
>('users/followUser', async ({ followingId, followerId }, { rejectWithValue }) => {
  try {
    const resp = await fetch(`${SERVER_BASE_URL}/api/profile/follow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followerId, followingId }),
    });
    const data = await resp.json();
    if (!data.success) {
      return rejectWithValue(data.error || 'Failed to follow user');
    }
    return { followingId, followerId };
  } catch (err: any) {
    console.error('[followUser] Error:', err);
    return rejectWithValue(err.message || 'Unknown error');
  }
});

/**
 * Unfollow a user
 */
export const unfollowUser = createAsyncThunk<
  { followingId: string; followerId: string },
  { followingId: string; followerId: string }
>('users/unfollowUser', async ({ followingId, followerId }, { rejectWithValue }) => {
  try {
    const resp = await fetch(`${SERVER_BASE_URL}/api/profile/unfollow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followerId, followingId }),
    });
    const data = await resp.json();
    if (!data.success) {
      return rejectWithValue(data.error || 'Failed to unfollow user');
    }
    return { followingId, followerId };
  } catch (err: any) {
    console.error('[unfollowUser] Error:', err);
    return rejectWithValue(err.message || 'Unknown error');
  }
});

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {},
  extraReducers: builder => {
    // fetchUserFullProfile
    builder.addCase(fetchUserFullProfile.pending, state => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchUserFullProfile.fulfilled, (state, action) => {
      state.loading = false;
      const { userId, data } = action.payload;
      state.byId[userId] = {
        // Merge existing data if present
        ...state.byId[userId],
        ...data,
      } as UserProfile;
    });
    builder.addCase(fetchUserFullProfile.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'Failed to fetch user profile';
    });

    // followUser
    builder.addCase(followUser.fulfilled, (state, action) => {
      const { followerId, followingId } = action.payload;
      // Follower now has followingId in their "following"
      if (!state.byId[followerId]) {
        state.byId[followerId] = {
          id: followerId,
          username: null,
          profilePicUrl: null,
          followers: [],
          following: [],
        };
      }
      if (!state.byId[followerId].following.includes(followingId)) {
        state.byId[followerId].following.push(followingId);
      }

      // Following user now has followerId in their "followers"
      if (!state.byId[followingId]) {
        state.byId[followingId] = {
          id: followingId,
          username: null,
          profilePicUrl: null,
          followers: [],
          following: [],
        };
      }
      if (!state.byId[followingId].followers.includes(followerId)) {
        state.byId[followingId].followers.push(followerId);
      }
    });

    // unfollowUser
    builder.addCase(unfollowUser.fulfilled, (state, action) => {
      const { followerId, followingId } = action.payload;
      // Remove followingId from followerId's "following"
      const followerObj = state.byId[followerId];
      if (followerObj) {
        followerObj.following = followerObj.following.filter(u => u !== followingId);
      }

      // Remove followerId from followingId's "followers"
      const followingObj = state.byId[followingId];
      if (followingObj) {
        followingObj.followers = followingObj.followers.filter(u => u !== followerId);
      }
    });
  },
});

export default usersSlice.reducer;
