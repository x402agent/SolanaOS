# Profile Types

This directory contains TypeScript type definitions for profile-related data structures used throughout the Profile module.

## Core Types

### Profile Types
- `Profile`: Main profile interface with all user information
- `ProfileSettings`: User profile settings and preferences
- `ProfileStats`: Statistical information about the profile

### Social Types
- `FollowRelationship`: Types for follow/following relationships
- `FollowerInfo`: Information about followers
- `FollowingInfo`: Information about accounts being followed

### Content Types
- `ProfileAction`: User actions and activities
- `CollectibleItem`: NFT and collectible item structure
- `CoinDetails`: Token and cryptocurrency details

### UI Types
- `ProfileComponentProps`: Props for profile UI components
- `ProfileTabItem`: Tab navigation item structure
- `ProfileEditState`: State structure for profile editing

## Usage

Import types directly from the profile module:

```typescript
import { 
  Profile, 
  ProfileAction, 
  FollowRelationship 
} from '@core/profile';

// Example: Typed function
function updateUserProfile(profile: Profile): Promise<boolean> {
  // Implementation
}

// Example: Typed component props
interface UserCardProps {
  profile: Profile;
  actions: ProfileAction[];
  onFollow: (relationship: FollowRelationship) => void;
}
```

## Type Extensions

The types in this directory can be extended for specific use cases without modifying the base definitions, maintaining backward compatibility. 