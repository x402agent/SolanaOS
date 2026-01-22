# Profile Components

This directory contains all UI components for the Profile module. These components handle the display, editing, and interaction aspects of user profiles.

## Main Components

- **Profile**: Main profile component for displaying user profiles
- **ProfileView**: Alternative view for displaying profiles
- **ProfileSkeleton**: Loading placeholder for profile data
- **AccountSettingsDrawer**: Drawer for account settings

## Specialized Components

### Profile Information
- **UserProfileInfo**: Main component for displaying user information

### Tab Navigation
- **ProfileTabs**: Tab navigation for different profile content sections

### Profile Editing
- **ProfileEditDrawer**: Drawer component for editing profile information

### Actions
- **ActionsPage**: Page displaying user actions
- **ActionDetailModal**: Modal for detailed action information

### Collectibles
- **Collectibles**: Grid display of user's NFT collections

### Token Management
- **BuyCard**: Interface for buying tokens or cryptocurrencies
- **TransferBalanceButton**: Button and interface for balance transfers

### Social
- **FollowersFollowingListScreen**: List display of followers/following users

### Coin Details
The `coin-details/` directory contains multiple components for displaying various token and coin information, organized into sections.

## Usage

Import components directly from the main profile module:

```typescript
import { 
  Profile, 
  ProfileEditDrawer, 
  UserProfileInfo,
  ProfileTabs 
} from '@core/profile';
``` 