# Profile Services

This directory contains services for profile data retrieval, manipulation, and API interactions.

## Available Services

### profileService
Core service for profile data operations.

**Functionality:**
- Fetch user profile data
- Update profile information
- Handle profile image uploads
- Manage profile settings

### profileActions
Service for handling profile-related actions and events.

**Functionality:**
- Record user activities
- Process interaction events
- Track profile-related actions
- Manage action history

## Integration Points

Profile services integrate with:
- Backend APIs for data persistence
- Authentication services for user validation
- Storage services for profile assets
- Analytics for tracking user behavior

## Usage

```typescript
import { fetchUserProfile, updateProfileInfo } from '@core/profile';
import { recordProfileAction, getActionHistory } from '@core/profile';

// Example: Fetch user profile
const userProfile = await fetchUserProfile(userId);

// Example: Update profile info
await updateProfileInfo({
  displayName: 'New Name',
  bio: 'Updated bio information'
});
```

## Error Handling

All services include proper error handling and return standardized error objects for consistent handling throughout the application. 