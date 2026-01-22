# Profile Hooks

This directory contains React hooks that provide functionality for managing profile data and interactions.

## Available Hooks

### useProfileFollow
Manages follow and unfollow actions between users.

**Features:**
- Follow other users
- Unfollow users
- Check follow status
- Get follower/following counts

### useProfileActions
Handles profile-related actions and interactions.

**Features:**
- Handle profile action operations
- Track and manage user activities
- Process interaction events

### useProfileManagement
Core profile data management operations.

**Features:**
- Load profile data
- Update profile information
- Manage profile settings
- Handle profile-specific queries

## Usage

```typescript
import { 
  useProfileFollow, 
  useProfileActions, 
  useProfileManagement 
} from '@core/profile';

// Example: Using follow functionality
function FollowButton({ userId }) {
  const { 
    followUser, 
    unfollowUser, 
    isFollowing, 
    followersCount 
  } = useProfileFollow(userId);

  return (
    isFollowing ? 
      <Button onPress={unfollowUser}>Unfollow ({followersCount})</Button> : 
      <Button onPress={followUser}>Follow ({followersCount})</Button>
  );
}
``` 