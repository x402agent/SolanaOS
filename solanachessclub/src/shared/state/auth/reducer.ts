import {SERVER_URL} from '@env';
import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';

export interface AuthState {
  provider: 'privy' | 'dynamic' | 'turnkey' | 'mwa' |  null;
  address: string | null;
  isLoggedIn: boolean;
  profilePicUrl: string | null;
  username: string | null; // storing user's chosen display name
  description: string | null; // storing user's bio description
  // NEW: attachmentData object to hold any attached profile data (e.g., coin)
  attachmentData?: {
    coin?: {
      mint: string;
      symbol?: string;
      name?: string;
    };
  };
}

const initialState: AuthState = {
  provider: null,
  address: null,
  isLoggedIn: false,
  profilePicUrl: null,
  username: null,
  description: null,
  attachmentData: {},
};

const SERVER_BASE_URL = SERVER_URL || 'http://localhost:3000';

// Debug environment variable loading
console.log('[Auth Reducer] SERVER_URL from @env:', SERVER_URL);
console.log('[Auth Reducer] SERVER_BASE_URL resolved to:', SERVER_BASE_URL);

/**
 * Fetch the user's profile from the server, including profile pic URL, username,
 * and attachment data.
 */
export const fetchUserProfile = createAsyncThunk(
  'auth/fetchUserProfile',
  async (userId: string, thunkAPI) => {
    const response = await fetch(
      `${SERVER_BASE_URL}/api/profile?userId=${userId}`,
    );
    const data = await response.json();
    if (data.success) {
      return {
        profilePicUrl: data.url,
        username: data.username,
        description: data.description,
        attachmentData: data.attachmentData || {},
      };
    } else {
      return thunkAPI.rejectWithValue(
        data.error || 'Failed to fetch user profile',
      );
    }
  },
);

/**
 * Update the user's username in the database.
 */
export const updateUsername = createAsyncThunk(
  'auth/updateUsername',
  async (
    {userId, newUsername}: {userId: string; newUsername: string},
    thunkAPI,
  ) => {
    try {
      const response = await fetch(
        `${SERVER_BASE_URL}/api/profile/updateUsername`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({userId, username: newUsername}),
        },
      );
      const data = await response.json();
      if (!data.success) {
        return thunkAPI.rejectWithValue(
          data.error || 'Failed to update username',
        );
      }
      return data.username as string;
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error.message || 'Error updating username',
      );
    }
  },
);

/**
 * Update the user's description in the database.
 */
export const updateDescription = createAsyncThunk(
  'auth/updateDescription',
  async (
    {userId, newDescription}: {userId: string; newDescription: string},
    thunkAPI,
  ) => {
    try {
      const response = await fetch(
        `${SERVER_BASE_URL}/api/profile/updateDescription`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({userId, description: newDescription}),
        },
      );
      const data = await response.json();
      if (!data.success) {
        return thunkAPI.rejectWithValue(
          data.error || 'Failed to update description',
        );
      }
      return data.description as string;
    } catch (error: any) {
      return thunkAPI.rejectWithValue(
        error.message || 'Error updating description',
      );
    }
  },
);

/**
 * Attach or update a coin on the user's profile.
 * Now accepts: { userId, attachmentData } where attachmentData = { coin: { mint, symbol, name } }
 */
export const attachCoinToProfile = createAsyncThunk(
  'auth/attachCoinToProfile',
  async (
    {
      userId,
      attachmentData,
    }: {
      userId: string;
      attachmentData: {coin: {mint: string; symbol?: string; name?: string}};
    },
    thunkAPI,
  ) => {
    try {
      const response = await fetch(
        `${SERVER_BASE_URL}/api/profile/attachCoin`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            userId,
            attachmentData,
          }),
        },
      );
      const data = await response.json();
      if (!data.success) {
        return thunkAPI.rejectWithValue(data.error || 'Failed to attach coin');
      }
      return data.attachmentData as {
        coin: {mint: string; symbol?: string; name?: string};
      };
    } catch (err: any) {
      return thunkAPI.rejectWithValue(
        err.message || 'Attach coin request failed.',
      );
    }
  },
);

/**
 * Remove an attached coin from the user's profile.
 */
export const removeAttachedCoin = createAsyncThunk(
  'auth/removeAttachedCoin',
  async (
    {
      userId,
    }: {
      userId: string;
    },
    thunkAPI,
  ) => {
    try {
      const response = await fetch(
        `${SERVER_BASE_URL}/api/profile/removeAttachedCoin`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            userId,
          }),
        },
      );
      const data = await response.json();
      if (!data.success) {
        return thunkAPI.rejectWithValue(data.error || 'Failed to remove coin');
      }
      return data.success;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(
        err.message || 'Remove coin request failed.',
      );
    }
  },
);

/**
 * Delete the current user's account.
 * The server will expect userId in the body since requireAuth was temporarily removed.
 * IMPORTANT: Proper authentication should be reinstated on the server for this endpoint.
 */
export const deleteAccountAction = createAsyncThunk<
  { success: boolean; message: string }, // Expected success response type
  string, // Argument type: userId
  { rejectValue: string } // Type for thunkAPI.rejectWithValue
>(
  'auth/deleteAccount',
  async (userId: string, thunkAPI) => {
    if (!userId) {
      return thunkAPI.rejectWithValue('User ID is required to delete account.');
    }
    try {
      console.log(`[AuthThunk deleteAccountAction] Attempting to delete account for userId: ${userId}`);
      const response = await fetch(
        `${SERVER_BASE_URL}/api/profile/delete-account`,
        {
          method: 'DELETE',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userId}` // Add the user's wallet address as a Bearer token
          },
          body: JSON.stringify({ userId }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        console.error('[AuthThunk deleteAccountAction] API error:', data.error || `HTTP error! status: ${response.status}`);
        return thunkAPI.rejectWithValue(
          data.error || `Failed to delete account. Status: ${response.status}`,
        );
      }
      console.log('[AuthThunk deleteAccountAction] Account deletion successful:', data);
      return data; // Should be { success: true, message: '...' }
    } catch (error: any) {
      console.error('[AuthThunk deleteAccountAction] Network or other error:', error);
      return thunkAPI.rejectWithValue(
        error.message || 'Network error during account deletion.',
      );
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess(
      state,
      action: PayloadAction<{
        provider: 'privy' | 'dynamic' | 'turnkey' | 'mwa';
        address: string;
        profilePicUrl?: string;
        username?: string;
        description?: string;
      }>,
    ) {
      // Preserve existing profile data if available and no new data provided
      state.provider = action.payload.provider;
      state.address = action.payload.address;
      state.isLoggedIn = true;
      
      // Only update these if they are provided or we don't have them
      if (action.payload.profilePicUrl || !state.profilePicUrl) {
        state.profilePicUrl = action.payload.profilePicUrl || state.profilePicUrl;
      }
      
      // For username: 
      // 1. Use provided username if available
      // 2. Keep existing username if we already have one
      // 3. Otherwise use first 6 chars of wallet address
      if (action.payload.username) {
        state.username = action.payload.username;
      } else if (!state.username && action.payload.address) {
        // Default username is first 6 characters of wallet address
        state.username = action.payload.address.substring(0, 6);
        console.log('[AuthReducer] Setting default username from wallet address:', state.username);
      }
      
      if (action.payload.description || !state.description) {
        state.description = action.payload.description || state.description;
      }

      // If no profile picture is set after login, we'll let the fetchUserProfile handle avatar generation
      // This way we don't duplicate avatar generation logic here
    },
    logoutSuccess(state) {
      console.log('[AuthReducer] logoutSuccess: Resetting state.');
      state.provider = null;
      state.address = null;
      state.isLoggedIn = false;
      state.profilePicUrl = null;
      state.username = null;
      state.description = null;
      state.attachmentData = {};
      console.log('[AuthReducer] State after logoutSuccess:', JSON.stringify(state));
    },
    updateProfilePic(state, action: PayloadAction<string>) {
      state.profilePicUrl = action.payload;
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchUserProfile.fulfilled, (state, action) => {
      const {
        profilePicUrl: fetchedProfilePicUrl,
        username: fetchedUsername,
        description: fetchedDescription,
        attachmentData,
      } = action.payload as any;

      // Get the userId that was requested as the argument to the thunk
      const requestedUserId = action.meta.arg;

      // Only update auth state if:
      // 1. We are logged in AND
      // 2. The requested user ID matches the current user's address
      if (state.isLoggedIn && 
          state.address && 
          requestedUserId && 
          requestedUserId.toLowerCase() === state.address.toLowerCase()) {
        state.profilePicUrl = fetchedProfilePicUrl || state.profilePicUrl;
        state.username = fetchedUsername || state.username;
        state.description = fetchedDescription || state.description;
        state.attachmentData = attachmentData || state.attachmentData || {};
      }
      // If the user IDs don't match, we don't update the auth state
      // This prevents other users' profiles from affecting the current user's profile
    });

    builder.addCase(updateUsername.fulfilled, (state, action) => {
      state.username = action.payload;
    });

    builder.addCase(updateDescription.fulfilled, (state, action) => {
      state.description = action.payload;
    });

    builder.addCase(attachCoinToProfile.fulfilled, (state, action) => {
      if (state.address) {
        state.attachmentData = {coin: action.payload.coin};
      }
    });

    builder.addCase(removeAttachedCoin.fulfilled, (state) => {
      if (state.address) {
        // Remove the coin property from attachmentData
        if (state.attachmentData) {
          delete state.attachmentData.coin;
        }
      }
    });

    builder.addCase(deleteAccountAction.pending, (state) => {
      // Optional: Handle pending state, e.g., set a global loading flag if needed
      console.log('[AuthSlice] deleteAccountAction pending...');
    });
    builder.addCase(deleteAccountAction.fulfilled, (state, action) => {
      // On successful account deletion from the server, the client should logout.
      // The logoutSuccess reducer (called by useAuth().logout()) will clear user state.
      // No direct state changes here needed if logout handles it.
      console.log('[AuthSlice] deleteAccountAction fulfilled:', action.payload.message);
    });
    builder.addCase(deleteAccountAction.rejected, (state, action) => {
      // Optional: Handle rejected state, e.g., display a global error
      console.error('[AuthSlice] deleteAccountAction rejected:', action.payload || action.error.message);
    });
  },
});

export const {loginSuccess, logoutSuccess, updateProfilePic} =
  authSlice.actions;
export default authSlice.reducer;
