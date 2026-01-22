/**
 * File: server/src/routes/chat/chatRoutes.ts
 * 
 * Routes for chat functionality:
 * - Get user's chats
 * - Create chats
 * - Get chat messages
 * - Send messages
 * - Get users for chat creation
 * - Upload images for chat messages
 * - Edit messages
 * - Delete messages
 */
import { Router, Request, Response, NextFunction } from 'express';
import {
  getUserChats,
  createDirectChat,
  createGroupChat,
  getChatMessages,
  sendMessage,
  getUsersForChat,
  editMessage,
  deleteMessage,
} from '../../controllers/chatController';
import { chatImageRouter } from './chatImageRoutes';

const chatRouter = Router();

// Utility wrapper for async route handlers
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Get all chats for a user
chatRouter.get('/users/:userId/chats', asyncHandler(getUserChats));

// Create a direct chat between two users
chatRouter.post('/direct', asyncHandler(createDirectChat));

// Create a group chat
chatRouter.post('/group', asyncHandler(createGroupChat));

// Get messages for a specific chat
chatRouter.get('/chats/:chatId/messages', asyncHandler(getChatMessages));

// Send a message to a chat
chatRouter.post('/messages', asyncHandler(sendMessage));

// Edit a message
chatRouter.put('/messages/:messageId', asyncHandler(editMessage));

// Delete a message
chatRouter.delete('/messages/:messageId', asyncHandler(deleteMessage));

// Get users for chat creation (search)
chatRouter.get('/users', asyncHandler(getUsersForChat));

// Mount the chat image router **AFTER** specific message routes
chatRouter.use('/images', chatImageRouter);

export { chatRouter }; 