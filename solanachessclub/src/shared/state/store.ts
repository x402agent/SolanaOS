import {configureStore} from '@reduxjs/toolkit';
import threadReducer from './thread/reducer';
import authReducer from './auth/reducer';
import transactionReducer from './transaction/reducer';
import usersReducer from './users/reducer';
import notificationReducer from './notification/reducer';
import profileReducer from './profile/reducer';
import chatReducer from './chat/slice';

// Redux persist imports
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers } from 'redux';

// Configure Redux Persist for auth reducer
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  // Only persist the auth state to keep login info
  whitelist: ['auth'],
};

// Combine all reducers
const rootReducer = combineReducers({
  thread: threadReducer,
  auth: authReducer,
  transaction: transactionReducer,
  users: usersReducer,
  notification: notificationReducer,
  profile: profileReducer,
  chat: chatReducer,
});

// Create persisted reducer (only for auth)
const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Increase tolerance thresholds to prevent warnings with large state
      serializableCheck: {
        // Increase the threshold to 200ms to prevent warnings with large state
        warnAfter: 200,
        // Ignore specific Redux paths that might contain large data
        ignoredPaths: ['profile.actions.data'],
        // Ignore Redux persist actions
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
      // Increase immutability check threshold
      immutableCheck: {
        warnAfter: 200,
      },
    }),
});

// Create persistor
export const persistor = persistStore(store);

// Define our root state type, including both regular state and _persist property
export type RootState = ReturnType<typeof rootReducer> & {
  _persist?: { version: number; rehydrated: boolean };
};
export type AppDispatch = typeof store.dispatch;
