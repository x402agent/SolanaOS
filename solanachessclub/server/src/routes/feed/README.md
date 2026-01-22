# Feed Routes

This directory contains Express.js routes related to the social feed functionality for the Solana App Kit server. These endpoints handle thread creation, retrieval, interactions, and feed generation.

## API Endpoints

### Thread Management

- **POST `/api/feed/thread`**: Create a new thread
  - Creates social post with content and optional attachments
  - Links to user profile
  - Supports text, images, and links
  - Returns the created thread

- **GET `/api/feed/thread/:id`**: Get a specific thread
  - Retrieves detailed thread information by ID
  - Includes author details, content, attachments, and interaction counts

- **PUT `/api/feed/thread/:id`**: Update a thread
  - Updates thread content or metadata
  - Limited to the thread author
  - Returns the updated thread

- **DELETE `/api/feed/thread/:id`**: Delete a thread
  - Removes a thread and its attachments
  - Limited to the thread author or moderators

### Thread Interactions

- **POST `/api/feed/thread/:id/like`**: Like a thread
  - Adds like interaction from the current user
  - Updates like count
  - Returns updated interaction status

- **DELETE `/api/feed/thread/:id/like`**: Unlike a thread
  - Removes like interaction from the current user
  - Updates like count
  - Returns updated interaction status

- **POST `/api/feed/thread/:id/comment`**: Comment on a thread
  - Adds a comment to the thread
  - Links to user profile
  - Returns the created comment

- **GET `/api/feed/thread/:id/comments`**: Get thread comments
  - Returns comments for a specific thread
  - Supports pagination and sorting
  - Includes comment author information

### Feed Generation

- **GET `/api/feed`**: Get main feed
  - Returns personalized feed for the authenticated user
  - Combines followed users, trending content, and recommended threads
  - Supports pagination and filtering

- **GET `/api/feed/trending`**: Get trending threads
  - Returns currently trending threads
  - Based on recent interactions and engagement metrics
  - Supports pagination

- **GET `/api/feed/user/:userId`**: Get user-specific feed
  - Returns threads created by a specific user
  - Supports pagination and filtering

- **GET `/api/feed/token/:tokenAddress`**: Get token-specific feed
  - Returns threads related to a specific token
  - Filters by token mentions or attachments
  - Supports pagination

### Thread Images

- **POST `/api/feed/thread/images`**: Upload thread images
  - Accepts image file uploads
  - Processes and optimizes images
  - Stores to Google Cloud Storage
  - Returns image URLs for attachment to threads

- **GET `/api/feed/thread/:id/images`**: Get thread images
  - Returns all images attached to a specific thread
  - Includes metadata and URLs

## Implementation Pattern

Routes follow a consistent implementation pattern:

```typescript
import express, { Request, Response } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { threadController } from '../../controllers/threadController';

const router = express.Router();

// Public route to get a thread
router.get('/thread/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const thread = await threadController.getThreadById(id);
    
    return res.status(200).json({
      success: true,
      data: thread
    });
  } catch (error) {
    console.error('Error fetching thread:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Protected route to create a thread
router.post('/thread', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user.id; // Set by requireAuth middleware
    const newThread = await threadController.createThread({
      ...req.body,
      userId
    });
    
    return res.status(201).json({
      success: true,
      data: newThread
    });
  } catch (error) {
    console.error('Error creating thread:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
```

## Authentication

Feed routes use authentication middleware for protected operations:

- **Public routes**: Thread retrieval, feed browsing, comment viewing
- **Protected routes**: Thread creation, likes, comments, thread updates/deletion
- **Owner-only routes**: Thread editing and deletion

## Database Integration

Feed routes interact with the database to store and retrieve social content:

- Threads stored in `threads` table
- Comments stored in `thread_comments` table
- Likes stored in `thread_likes` table
- Images metadata in `thread_images` table

## Media Storage

The feed system uses multiple storage solutions:

- Images stored in Google Cloud Storage
- Metadata linked to threads in the database
- Content delivery optimized for speed and reliability

## Best Practices

When working with feed routes:

1. Implement pagination for all listing endpoints
2. Cache frequently accessed feeds and trending content
3. Implement rate limiting to prevent spam
4. Validate and sanitize all user input
5. Use proper authorization checks for protected operations
6. Optimize image uploads with compression and sizing
7. Implement proper error handling
8. Document all endpoints thoroughly 