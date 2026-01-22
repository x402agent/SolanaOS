# User Routes

This directory contains Express.js routes related to user profile management for the Solana App Kit server. These endpoints handle user profile creation, retrieval, updates, and wallet connections.

## API Endpoints

### Profile Management

- **POST `/api/user/profile`**: Create a new user profile
  - Creates or updates user profile information
  - Stores username, bio, and other profile details
  - Returns the created profile

- **GET `/api/user/profile/:id`**: Get a user profile by ID
  - Retrieves detailed profile information
  - Includes username, bio, image URLs, and stats

- **GET `/api/user/profile/wallet/:walletAddress`**: Get profile by wallet address
  - Finds user profile associated with the specified wallet
  - Returns profile details or 404 if not found

- **PUT `/api/user/profile`**: Update a user profile
  - Updates profile information for the authenticated user
  - Supports partial updates
  - Returns the updated profile

### Profile Images

- **POST `/api/user/profile/image`**: Upload a profile image
  - Accepts image file uploads
  - Processes and optimizes images
  - Stores to Google Cloud Storage
  - Updates profile with image URL

- **GET `/api/user/profile/image/:id`**: Get a profile image
  - Retrieves the profile image URL for a user
  - Supports different size variants

- **DELETE `/api/user/profile/image`**: Delete a profile image
  - Removes the current profile image
  - Updates profile to use default image

### Wallet Management

- **POST `/api/user/wallet/connect`**: Connect a wallet to profile
  - Associates a Solana wallet with the user profile
  - Verifies wallet ownership via signature
  - Updates profile with wallet information

- **GET `/api/user/wallet/connected`**: Get connected wallets
  - Lists all wallets connected to the user's profile
  - Includes wallet types and addresses

- **DELETE `/api/user/wallet/:address`**: Disconnect a wallet
  - Removes a wallet association from the user profile
  - Requires ownership verification

### User Settings

- **GET `/api/user/settings`**: Get user settings
  - Retrieves application preferences and settings
  - Returns theme, notification settings, etc.

- **PUT `/api/user/settings`**: Update user settings
  - Updates application preferences
  - Supports partial updates
  - Returns updated settings

### Social Connections

- **POST `/api/user/follow`**: Follow a user
  - Creates a following relationship between users
  - Updates follower/following counts
  - Supports notifications

- **DELETE `/api/user/follow/:id`**: Unfollow a user
  - Removes a following relationship
  - Updates follower/following counts

- **GET `/api/user/followers/:id`**: Get user followers
  - Returns list of users following the specified user
  - Supports pagination and filtering

- **GET `/api/user/following/:id`**: Get users being followed
  - Returns list of users that the specified user follows
  - Supports pagination and filtering

## Implementation Pattern

Routes follow a consistent implementation pattern:

```typescript
import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { profileController } from '../../controllers/profileController';

const router = express.Router();

// Public route
router.get('/profile/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profile = await profileController.getProfileById(id);
    
    return res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Protected route requiring authentication
router.put('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user.id; // Set by requireAuth middleware
    const updatedProfile = await profileController.updateProfile(userId, req.body);
    
    return res.status(200).json({
      success: true,
      data: updatedProfile
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
```

## Authentication

Many user routes require authentication. Protected routes use authentication middleware:

- **Public routes**: Profile retrieval and other read-only operations
- **Protected routes**: Profile updates, wallet connections, and social actions
- **Owner-only routes**: Sensitive operations restricted to the profile owner

## Database Integration

User routes interact with the database to store and retrieve user information:

- Profile details stored in `users` and `profiles` tables
- Social connections stored in `follows` table
- Settings stored in `user_settings` table

## Best Practices

When working with user routes:

1. Always protect routes that modify user data with authentication
2. Implement proper validation for all input
3. Use pagination for listing endpoints
4. Apply proper caching for frequently accessed profiles
5. Sanitize user input to prevent XSS attacks
6. Include appropriate error handling
7. Document all endpoints
8. Implement rate limiting for sensitive operations 