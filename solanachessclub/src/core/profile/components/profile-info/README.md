# Profile Info Components

This directory contains components for displaying user profile information.

## Components

### UserProfileInfo
The main component for displaying user profile information, including:
- Profile picture and cover image
- User name and handle
- Bio and description
- Follower/following counts
- User tokens and balances
- Verification status

## Styling

Styling for these components can be found in:
- `UserProfileInfo.style.ts`: Main styling for the profile info component
- `profileInfoTokenModal.style.ts`: Styling for token information modals

## Usage

```typescript
import { UserProfileInfo } from '@core/profile';

function ProfileScreen({ userId }) {
  return (
    <SafeAreaView>
      <UserProfileInfo 
        userId={userId}
        showFollowButton={true}
        enableTokenDisplay={true}
      />
    </SafeAreaView>
  );
}
```

## Customization

These components accept style overrides and theme props for customizing their appearance to match different design requirements. 