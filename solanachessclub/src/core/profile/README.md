# Profile Module

The Profile module provides comprehensive functionality for user profiles, including display, editing, and interaction features. It contains components for rendering profile information, hooks for profile data management, and services for profile-related API interactions.

## Structure

- **components**: UI components for profile functionality

  - **Profile**: Main profile component for displaying user profiles
  - **ProfileView**: Alternative view for displaying profiles
  - **ProfileSkeleton**: Loading placeholder for profile data
  - **AccountSettingsDrawer**: Drawer for account settings
  - **actions**: Components for profile-related actions
    - **ActionsPage**: Page displaying user actions
    - **ActionDetailModal**: Modal for detailed action information
  - **buy-card**: Components for token purchase
    - **BuyCard**: Interface for buying tokens or cryptocurrencies
  - **collectibles**: NFT and collectible display components
    - **Collectibles**: Grid display of user's NFT collections
  - **coin-details**: Components for detailed token information
    - Multiple sections for displaying various coin/token information
  - **followers-following-listScreen**: Components for follower management
    - **FollowersFollowingListScreen**: List display of followers/following users
  - **profile-edit-drawer**: Profile editing interface
    - **ProfileEditDrawer**: Drawer component for editing profile information
  - **profile-info**: Profile display components
    - **UserProfileInfo**: Main component for displaying user information
  - **profile-tabs**: Tab navigation for profile sections
    - **ProfileTabs**: Tab navigation for different profile content sections
  - **transfer-balance-button**: Component for transferring tokens
    - **TransferBalanceButton**: Button and interface for balance transfers

- **hooks**: Custom hooks for profile data and state management
  - **useProfileFollow**: Hook for managing follow/unfollow actions
  - **useProfileActions**: Hook for handling profile-related actions
  - **useProfileManagement**: Hook for profile data management operations

- **services**: Services for profile data retrieval and manipulation
  - **profileService**: Core profile data services
  - **profileActions**: Services for profile action operations

- **types**: TypeScript type definitions for profile-related data
  - Comprehensive type definitions for profile entities and states

- **utils**: Helper functions for profile data formatting and processing
  - **profileUtils**: General profile utility functions
  - **profileActionsUtils**: Utilities for profile actions

## Usage

Import components and utilities from the profile module:

```typescript
import { 
  Profile, 
  ProfileEditDrawer, 
  UserProfileInfo, 
  useProfileFollow,
  useProfileManagement
} from '@core/profile';
```

## Integration

The Profile module integrates with:

- Authentication system for user data
- Wallet providers for token and balance information
- NFT modules for collectible display
- Social features for followers and following management
