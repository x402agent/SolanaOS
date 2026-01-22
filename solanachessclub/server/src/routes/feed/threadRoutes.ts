import {Router, Request, Response, NextFunction} from 'express';
import {
  getAllPosts,
  createRootPost,
  createReply,
  deletePost,
  addReaction,
  createRetweet,
  updatePost,
} from '../../controllers/threadController';

const threadRouter = Router();

// Utility wrapper for async route handlers
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// GET all posts
threadRouter.get('/posts', asyncHandler(getAllPosts));

// Create a root post
// Body: { userId, sections }
threadRouter.post('/posts', asyncHandler(createRootPost));

// Create a reply
// Body: { parentId, userId, sections }
threadRouter.post('/posts/reply', asyncHandler(createReply));

// Delete a post
threadRouter.delete('/posts/:postId', asyncHandler(deletePost));

// Add a reaction to a post
// Body: { reactionEmoji }
threadRouter.patch('/posts/:postId/reaction', asyncHandler(addReaction));

// Retweet
// Body: { retweetOf, userId, sections? }
threadRouter.post('/posts/retweet', asyncHandler(createRetweet));

// Update a post's sections
// Body: { postId, sections }
threadRouter.patch('/posts/update', asyncHandler(updatePost));

export {threadRouter};
