/**
 * File: server/src/routes/profileImageRoutes.ts
 *
 * A router that handles:
 * - Uploading profile images (stored on IPFS via uploadToIpfs)
 * - Basic profile fetch/update (username, attach coin, follow/unfollow, etc.)
 */

import {Router, Request, Response, NextFunction} from 'express';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import os from 'os';
import knex from '../../db/knex';
import {uploadToIpfs, uploadToPinata} from '../../utils/ipfs';
// import fetch from 'node-fetch';

// Assuming userController and requireAuth are structured like this
// import * as userController from '../../controllers/userController'; // This line is removed
// import { requireAuth } from '../../middleware/requireAuth'; // Assuming path - REMOVED

// Import the new user service function
import { deleteUserAccount as deleteUserAccountService } from '../../service/userService'; 

const profileImageRouter = Router();
const upload = multer({storage: multer.memoryStorage()});

/**
 * ------------------------------------------
 *  EXISTING: Upload profile image logic
 * ------------------------------------------
 */
profileImageRouter.post(
  '/upload',
  upload.single('profilePic'),
  async (req: any, res: any) => {
    try {
      console.log('[Profile Upload] Route handler started');
      const userId = req.body.userId;
      console.log(`[Profile Upload] Request received for userId: ${userId}`);
      
      if (!userId) {
        console.error('[Profile Upload] Error: Missing userId in request');
        return res.status(400).json({success: false, error: 'Missing userId'});
      }
      if (!req.file) {
        console.error('[Profile Upload] Error: No file uploaded');
        return res
          .status(400)
          .json({success: false, error: 'No file uploaded'});
      }

      console.log(`[Profile Upload] Processing image for userId: ${userId}. Original size: ${req.file.size} bytes`);
      
      // 1) Compress the image using sharp
      console.log('[Profile Upload] Step 1: Compressing image with sharp');
      const outputFormat = 'jpeg';
      const compressedBuffer = await sharp(req.file.buffer)
        .resize({width: 1024, withoutEnlargement: true})
        .toFormat(outputFormat, {quality: 80})
        .toBuffer();
      console.log(`[Profile Upload] Image compressed successfully. New size: ${compressedBuffer.length} bytes (${Math.round((compressedBuffer.length / req.file.size) * 100)}% of original)`);

      // 2) Write to a temp file
      console.log('[Profile Upload] Step 2: Writing compressed image to temp file');
      const tempFileName = `profile-${userId}-${Date.now()}.${outputFormat}`;
      const tempFilePath = path.join(os.tmpdir(), tempFileName);
      await fs.promises.writeFile(tempFilePath, compressedBuffer);
      console.log(`[Profile Upload] Temp file created at: ${tempFilePath}`);

      // 3) Prepare IPFS metadata
      console.log('[Profile Upload] Step 3: Preparing IPFS metadata');
      const metadata = {
        name: 'Profile Picture',
        symbol: 'PFP',
        description: `Profile picture for user ${userId}`,
        showName: false,
      };
      console.log(`[Profile Upload] Metadata prepared: ${JSON.stringify(metadata)}`);

      // 4) Upload image and metadata to Pinata
      console.log('[Profile Upload] Step 4: Uploading to Pinata IPFS');
      const pinataResult = await uploadToPinata(tempFilePath, metadata);
      console.log(`[Profile Upload] Pinata upload successful. Metadata URI: ${pinataResult}`);

      // 5) Clean up temp file
      console.log('[Profile Upload] Step 5: Cleaning up temp file');
      await fs.promises.unlink(tempFilePath);
      console.log(`[Profile Upload] Temp file removed: ${tempFilePath}`);

      // 6) Attempt to fetch the image URL from the returned Pinata metadata JSON
      console.log('[Profile Upload] Step 6: Fetching image URL from Pinata metadata');
      let imageUrl = pinataResult; // Default to metadata URI if image extraction fails
      const {default: fetch} = await import('node-fetch');
      console.log(`[Profile Upload] Fetching metadata from: ${pinataResult}`);
      const metadataResponse = await fetch(pinataResult); // Fetch the metadata from Pinata
      
      if (metadataResponse.ok) {
        console.log(`[Profile Upload] Metadata fetch successful. Status: ${metadataResponse.status}`);
        const metadataJson: any = await metadataResponse.json();
        console.log(`[Profile Upload] Metadata parsed: ${JSON.stringify(metadataJson)}`);
        if (metadataJson.image) {
          imageUrl = metadataJson.image; // Extract the direct image URL
          console.log(`[Profile Upload] Extracted image URL: ${imageUrl}`);
        } else {
          console.warn('[Profile Upload] Image URL not found in metadata, using metadata URI instead');
        }
      } else {
        console.error(`[Profile Upload] Failed to fetch metadata. Status: ${metadataResponse.status}`);
      }

      // 7) Upsert user in "users" table, setting profile_picture_url
      console.log('[Profile Upload] Step 7: Updating user record in database');
      const existingUser = await knex('users').where({id: userId}).first();
      if (!existingUser) {
        console.log(`[Profile Upload] User ${userId} not found, creating new record`);
        await knex('users').insert({
          id: userId,
          username: userId, // default
          handle: '@' + userId.slice(0, 6),
          profile_picture_url: imageUrl, // Use the extracted image URL
          created_at: new Date(),
          updated_at: new Date(),
        });
        console.log(`[Profile Upload] New user record created for ${userId}`);
      } else {
        console.log(`[Profile Upload] Updating existing user ${userId} with new profile image`);
        await knex('users').where({id: userId}).update({
          profile_picture_url: imageUrl, // Use the extracted image URL
          updated_at: new Date(),
        });
        console.log(`[Profile Upload] User record updated successfully`);
      }

      console.log(`[Profile Upload] Process completed successfully for userId: ${userId}`);
      return res.json({success: true, url: imageUrl}); // Return the direct image URL
    } catch (error: any) {
      console.error('[Profile Upload] Error:', error);
      console.error('[Profile Upload] Error stack:', error.stack);
      return res.status(500).json({success: false, error: error.message});
    }
  },
);

/**
 * ------------------------------------------
 *  EXISTING: Fetch user's profile data
 * ------------------------------------------
 */
profileImageRouter.get('/', async (req: any, res: any) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({success: false, error: 'Missing userId'});
    }

    const user = await knex('users').where({id: userId}).first();
    if (!user) {
      return res.status(404).json({success: false, error: 'User not found'});
    }

    // Return the user's data, including the attachment_data field.

    console.log(user , "user.attachment_data");
    return res.json({
      success: true,
      url: user.profile_picture_url,
      username: user.username,
      description: user.description || '',
      attachmentData: user.attachment_data || {}, // e.g., { coin: { mint, symbol, name, image, description } }
    });
  } catch (error: any) {
    console.error('[Profile fetch error]', error);
    return res.status(500).json({success: false, error: error.message});
  }
});

/**
 * ------------------------------------------
 *  EXISTING: Update user's username
 * ------------------------------------------
 */
profileImageRouter.post('/updateUsername', async (req: any, res: any) => {
  try {
    const {userId, username} = req.body;
    if (!userId || !username) {
      return res
        .status(400)
        .json({success: false, error: 'Missing userId or username'});
    }

    const existingUser = await knex('users').where({id: userId}).first();
    if (!existingUser) {
      await knex('users').insert({
        id: userId,
        username,
        handle: '@' + userId.slice(0, 6),
        profile_picture_url: null,
        created_at: new Date(),
        updated_at: new Date(),
      });
    } else {
      await knex('users').where({id: userId}).update({
        username,
        updated_at: new Date(),
      });
    }

    return res.json({success: true, username});
  } catch (error: any) {
    console.error('[updateUsername error]', error);
    return res.status(500).json({success: false, error: error.message});
  }
});

/**
 * ------------------------------------------
 *  NEW: Follow a user
 *  Body: { followerId, followingId }
 * ------------------------------------------
 */
profileImageRouter.post('/follow', async (req: any, res: any) => {
  try {
    const {followerId, followingId} = req.body;
    if (!followerId || !followingId) {
      return res
        .status(400)
        .json({success: false, error: 'Missing followerId or followingId'});
    }
    if (followerId === followingId) {
      return res
        .status(400)
        .json({success: false, error: 'Cannot follow yourself'});
    }

    // Ensure both users exist
    const followerExists = await knex('users').where({id: followerId}).first();
    const followingExists = await knex('users')
      .where({id: followingId})
      .first();
    if (!followerExists || !followingExists) {
      return res
        .status(404)
        .json({success: false, error: 'Follower or following user not found'});
    }

    // Insert into follows if not already present
    await knex('follows')
      .insert({
        follower_id: followerId,
        following_id: followingId,
      })
      .onConflict(['follower_id', 'following_id'])
      .ignore();

    return res.json({success: true});
  } catch (error: any) {
    console.error('[Follow user error]', error);
    return res.status(500).json({success: false, error: error.message});
  }
});

/**
 * ------------------------------------------
 *  NEW: Unfollow a user
 *  Body: { followerId, followingId }
 * ------------------------------------------
 */
profileImageRouter.post('/unfollow', async (req: any, res: any) => {
  try {
    const {followerId, followingId} = req.body;
    if (!followerId || !followingId) {
      return res
        .status(400)
        .json({success: false, error: 'Missing followerId or followingId'});
    }

    // Delete from follows table
    await knex('follows')
      .where({follower_id: followerId, following_id: followingId})
      .del();

    return res.json({success: true});
  } catch (error: any) {
    console.error('[Unfollow user error]', error);
    return res.status(500).json({success: false, error: error.message});
  }
});

/**
 * ------------------------------------------
 *  NEW: GET list of a user's followers
 *  Query param: ?userId=xxx
 * ------------------------------------------
 */
profileImageRouter.get('/followers', async (req: any, res: any) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res
        .status(400)
        .json({success: false, error: 'Missing userId param'});
    }

    const rows = await knex('follows')
      .select('follower_id')
      .where({following_id: userId});

    const followerIds = rows.map(r => r.follower_id);

    // Optional: fetch user details
    const followers = await knex('users').whereIn('id', followerIds);

    return res.json({
      success: true,
      followers,
    });
  } catch (error: any) {
    console.error('[Get followers error]', error);
    return res.status(500).json({success: false, error: error.message});
  }
});

/**
 * ------------------------------------------
 *  NEW: GET list of a user's following
 *  Query param: ?userId=xxx
 * ------------------------------------------
 */
profileImageRouter.get('/following', async (req: any, res: any) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res
        .status(400)
        .json({success: false, error: 'Missing userId param'});
    }

    const rows = await knex('follows')
      .select('following_id')
      .where({follower_id: userId});

    const followingIds = rows.map(r => r.following_id);

    // Optional: fetch user details
    const following = await knex('users').whereIn('id', followingIds);

    return res.json({
      success: true,
      following,
    });
  } catch (error: any) {
    console.error('[Get following error]', error);
    return res.status(500).json({success: false, error: error.message});
  }
});

/**
 * ------------------------------------------
 *  NEW: Attach or update a coin on the user's profile
 *  Body: { userId, attachmentData } where attachmentData = {
 *    coin: { mint: string; symbol?: string; name?: string; image?: string; description?: string; }
 *  }
 * ------------------------------------------
 */
profileImageRouter.post('/attachCoin', async (req: any, res: any) => {
  try {
    const {userId, attachmentData} = req.body;
    /**
     * Example of attachmentData:
     * {
     *   coin: {
     *     mint: string;
     *     symbol?: string;
     *     name?: string;
     *     image?: string;       // from Helius
     *     description?: string; // user-provided
     *   }
     * }
     */
    if (
      !userId ||
      !attachmentData ||
      !attachmentData.coin ||
      !attachmentData.coin.mint
    ) {
      return res.status(400).json({
        success: false,
        error:
          'Missing userId or valid attachmentData (must include coin with mint)',
      });
    }

    // Ensure user exists
    const existingUser = await knex('users').where({id: userId}).first();
    if (!existingUser) {
      return res.status(404).json({success: false, error: 'User not found'});
    }

    // We store the entire object under "attachment_data" => { coin: {...} }
    await knex('users').where({id: userId}).update({
      attachment_data: attachmentData,
      updated_at: new Date(),
    });

    return res.json({
      success: true,
      attachmentData,
    });
  } catch (error: any) {
    console.error('[AttachCoin error]', error);
    return res.status(500).json({success: false, error: error.message});
  }
});

/**
 * ------------------------------------------
 *  Remove an attached coin from the user's profile
 *  Body: { userId }
 * ------------------------------------------
 */
profileImageRouter.post('/removeAttachedCoin', async (req: any, res: any) => {
  try {
    const {userId} = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId',
      });
    }

    // Ensure user exists
    const existingUser = await knex('users').where({id: userId}).first();
    if (!existingUser) {
      return res.status(404).json({success: false, error: 'User not found'});
    }

    // Get current attachment data
    const currentAttachmentData = existingUser.attachment_data || {};

    // Remove the coin property from the attachment data
    if (currentAttachmentData.coin) {
      delete currentAttachmentData.coin;
    }

    // Update the user record
    await knex('users').where({id: userId}).update({
      attachment_data: currentAttachmentData,
      updated_at: new Date(),
    });

    return res.json({
      success: true,
    });
  } catch (error: any) {
    console.error('[RemoveAttachedCoin error]', error);
    return res.status(500).json({success: false, error: error.message});
  }
});

profileImageRouter.get('/search', async (req: any, res: any) => {
  try {
    const searchQuery = req.query.q;
    let users;

    if (searchQuery) {
      // Search by username if query parameter is provided
      users = await knex('users')
        .where('username', 'ilike', `%${searchQuery}%`)
        .select('id', 'username', 'profile_picture_url')
        .orderBy('username', 'asc');
    } else {
      // Return all users if no query parameter
      users = await knex('users')
        .select('id', 'username', 'profile_picture_url')
        .orderBy('username', 'asc');
    }

    return res.json({
      success: true,
      users,
    });
  } catch (error: any) {
    console.error('[User search error]', error);
    return res.status(500).json({success: false, error: error.message});
  }
});

/**
 * ------------------------------------------
 *  NEW: Create a new user
 *  Body: { userId, username, handle }
 * ------------------------------------------
 */
profileImageRouter.post('/createUser', async (req: any, res: any) => {
  try {
    const { userId, username, handle, description } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'Missing userId' });
    }

    // Check if user already exists
    const existingUser = await knex('users').where({ id: userId }).first();
    if (existingUser) {
      // User already exists, just return success
      return res.json({ success: true, user: existingUser });
    }

    // Create new user with minimal data
    const newUser = {
      id: userId,
      username: username || userId, // Default to userId if username not provided
      handle: handle || '@' + userId.slice(0, 6), // Default handle if not provided
      description: description || '', // Default empty description if not provided
      profile_picture_url: null,
      attachment_data: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await knex('users').insert(newUser);

    return res.json({ success: true, user: newUser });
  } catch (error: any) {
    console.error('[Create user error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * ------------------------------------------
 *  NEW: Update user's description
 * ------------------------------------------
 */
profileImageRouter.post('/updateDescription', async (req: any, res: any) => {
  try {
    const {userId, description} = req.body;
    if (!userId) {
      return res
        .status(400)
        .json({success: false, error: 'Missing userId'});
    }

    const existingUser = await knex('users').where({id: userId}).first();
    if (!existingUser) {
      await knex('users').insert({
        id: userId,
        username: userId,
        handle: '@' + userId.slice(0, 6),
        description: description || '',
        profile_picture_url: null,
        created_at: new Date(),
        updated_at: new Date(),
      });
    } else {
      await knex('users').where({id: userId}).update({
        description: description || '',
        updated_at: new Date(),
      });
    }

    return res.json({success: true, description: description || ''});
  } catch (error: any) {
    console.error('[updateDescription error]', error);
    return res.status(500).json({success: false, error: error.message});
  }
});

/**
 * ------------------------------------------
 *  NEW: Update user's profile picture URL directly
 *  Body: { userId, profilePicUrl }
 * ------------------------------------------
 */
profileImageRouter.post('/updateProfilePic', async (req: any, res: any) => {
  try {
    const { userId, profilePicUrl } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing userId' 
      });
    }
    
    if (!profilePicUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing profilePicUrl' 
      });
    }

    console.log(`[updateProfilePic] Updating profile picture for userId: ${userId}`);
    console.log(`[updateProfilePic] New profile picture URL: ${profilePicUrl}`);

    // Check if user exists
    const existingUser = await knex('users').where({ id: userId }).first();
    
    if (!existingUser) {
      // Create new user if doesn't exist
      console.log(`[updateProfilePic] User ${userId} not found, creating new record`);
      await knex('users').insert({
        id: userId,
        username: userId.slice(0, 6), // Default username
        handle: '@' + userId.slice(0, 6), // Default handle
        profile_picture_url: profilePicUrl,
        created_at: new Date(),
        updated_at: new Date(),
      });
      console.log(`[updateProfilePic] New user created with profile picture`);
    } else {
      // Update existing user
      console.log(`[updateProfilePic] Updating existing user ${userId}`);
      await knex('users').where({ id: userId }).update({
        profile_picture_url: profilePicUrl,
        updated_at: new Date(),
      });
      console.log(`[updateProfilePic] Profile picture updated successfully`);
    }

    return res.json({ 
      success: true, 
      profilePicUrl: profilePicUrl,
      message: 'Profile picture updated successfully'
    });
  } catch (error: any) {
    console.error('[updateProfilePic error]', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Simple authentication middleware for delete-account route
const requireAuthForDelete = async (req: any, res: any, next: NextFunction) => {
  try {
    const { userId } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required. Please log in.' 
      });
    }

    // Get the token from the Authorization header
    const token = authHeader.split(' ')[1];
    
    // Verify the token and get the user's address
    // This assumes the token contains the user's wallet address
    const userAddress = token; // In a real implementation, you would verify the JWT token

    // Ensure the authenticated user can only delete their own account
    if (userAddress.toLowerCase() !== userId.toLowerCase()) {
      return res.status(403).json({ 
        success: false, 
        error: 'You can only delete your own account.' 
      });
    }

    // Add the verified user address to the request for use in the route handler
    req.userAddress = userAddress;
    next();
  } catch (error: any) {
    console.error('[Auth Middleware Error]', error);
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication failed.' 
    });
  }
};

/**
 * ------------------------------------------
 *  NEW: Delete user account
 *  Protected by requireAuthForDelete middleware
 * ------------------------------------------
 */
profileImageRouter.delete(
  '/delete-account',
  requireAuthForDelete,
  async (req: any, res: any, next: NextFunction) => {
    console.log(`[Route /delete-account] Received request. Body:`, req.body);
    try {
      const { userId } = req.body;
      
      console.log(`[Route /delete-account] Extracted userId: ${userId}`);

      if (!userId) {
        console.error('[Route /delete-account] Error: userId is missing from request body.');
        return res.status(400).json({ success: false, error: 'userId is required in the request body.' });
      }

      console.log(`[Route /delete-account] Calling deleteUserAccountService for userId: ${userId}`);
      await deleteUserAccountService(userId);
      
      console.log(`[Route /delete-account] Successfully deleted account for userId: ${userId}`);
      return res.status(200).json({ success: true, message: 'Account deleted successfully.' });
    } catch (error: any) {
      console.error('[Delete Account Route Error]', error);
      if (error.message.includes('User not found')) {
        return res.status(404).json({ success: false, error: error.message });
      }
      return res.status(500).json({ success: false, error: error.message || 'Failed to delete account.' });
    }
  },
);

export default profileImageRouter;
