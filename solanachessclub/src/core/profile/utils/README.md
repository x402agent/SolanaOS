# Profile Utilities

This directory contains helper functions for profile data formatting, processing, and common operations.

## Available Utilities

### profileUtils
General utility functions for profile data handling.

**Functions:**
- Format profile data for display
- Validate profile information
- Transform data structures
- Handle profile image processing

### profileActionsUtils
Utility functions specific to profile actions and activities.

**Functions:**
- Format action timestamps
- Process action data
- Group and categorize actions
- Calculate action metrics

## Usage

```typescript
import { 
  formatProfileName, 
  validateProfileData, 
  processActionTimestamp, 
  groupActionsByType 
} from '@core/profile';

// Example: Format a profile name
const displayName = formatProfileName(user.firstName, user.lastName, user.username);

// Example: Group actions by type
const groupedActions = groupActionsByType(userActions);
```

## Pure Functions

All utility functions in this directory are implemented as pure functions, ensuring they have no side effects and always produce the same output for a given input. This makes them highly reusable and testable. 