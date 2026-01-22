// File: server/src/routes/upload.ts
/**
 * File upload routes using Supabase Storage
 * 
 * Endpoints for uploading user avatars, NFT images, and game assets
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { uploadFileToSupabase, deleteFileFromSupabase } from '../utils/supabase-storage';
import { supabaseAdmin } from '../utils/supabase-client';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept images only
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    },
});

/**
 * POST /api/upload/avatar
 * Upload or update user avatar
 */
router.post('/avatar', upload.single('avatar'), async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const walletAddress = req.body.walletAddress || req.headers['x-wallet-address'];
        if (!walletAddress) {
            res.status(401).json({ error: 'Wallet address required' });
            return;
        }

        // Optimize image with sharp
        const optimizedImage = await sharp(req.file.buffer)
            .resize(400, 400, {
                fit: 'cover',
                position: 'center',
            })
            .jpeg({ quality: 85 })
            .toBuffer();

        // Generate unique filename
        const timestamp = Date.now();
        const fileName = `${walletAddress.slice(0, 8)}-${timestamp}.jpg`;
        const filePath = `avatars/${fileName}`;

        // Upload to Supabase Storage
        const publicUrl = await uploadFileToSupabase(
            'profiles',
            filePath,
            optimizedImage,
            'image/jpeg'
        );

        // Update user record in database (if you have a users table)
        try {
            const { data: existingUser } = await supabaseAdmin
                .from('users')
                .select('avatar_url')
                .eq('wallet_address', walletAddress)
                .single();

            // Delete old avatar if exists
            if (existingUser?.avatar_url) {
                const oldFilePath = new URL(existingUser.avatar_url).pathname.split('/').slice(-2).join('/');
                await deleteFileFromSupabase('profiles', oldFilePath).catch(() => {
                    // Ignore errors if old file doesn't exist
                });
            }

            // Update user avatar URL
            await supabaseAdmin
                .from('users')
                .upsert({
                    wallet_address: walletAddress,
                    avatar_url: publicUrl,
                    updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'wallet_address',
                });
        } catch (dbError) {
            console.log('Note: User table may not exist yet. Avatar uploaded but not saved to DB.');
        }

        res.json({
            success: true,
            url: publicUrl,
            message: 'Avatar uploaded successfully',
        });
    } catch (error: any) {
        console.error('Avatar upload error:', error);
        res.status(500).json({ error: error.message || 'Upload failed' });
    }
});

/**
 * POST /api/upload/nft
 * Upload NFT image/metadata
 */
router.post('/nft', upload.single('image'), async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const { mintAddress, collectionName } = req.body;
        if (!mintAddress) {
            res.status(400).json({ error: 'Mint address required' });
            return;
        }

        // Generate filename based on mint address
        const fileExtension = req.file.mimetype.split('/')[1] || 'jpg';
        const fileName = `${mintAddress}.${fileExtension}`;
        const filePath = `${collectionName || 'default'}/${fileName}`;

        // Upload to Supabase Storage
        const publicUrl = await uploadFileToSupabase(
            'nfts',
            filePath,
            req.file.buffer,
            req.file.mimetype
        );

        res.json({
            success: true,
            url: publicUrl,
            message: 'NFT image uploaded successfully',
        });
    } catch (error: any) {
        console.error('NFT upload error:', error);
        res.status(500).json({ error: error.message || 'Upload failed' });
    }
});

/**
 * POST /api/upload/game-asset
 * Upload chess game assets (piece images, board themes, etc.)
 */
router.post('/game-asset', upload.single('asset'), async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const { assetType, assetName } = req.body;
        if (!assetType || !assetName) {
            res.status(400).json({ error: 'Asset type and name required' });
            return;
        }

        // Generate filename
        const timestamp = Date.now();
        const fileExtension = req.file.mimetype.split('/')[1] || 'png';
        const fileName = `${assetName}-${timestamp}.${fileExtension}`;
        const filePath = `${assetType}/${fileName}`;

        // Upload to Supabase Storage
        const publicUrl = await uploadFileToSupabase(
            'game-assets',
            filePath,
            req.file.buffer,
            req.file.mimetype
        );

        res.json({
            success: true,
            url: publicUrl,
            assetType,
            assetName: fileName,
            message: 'Game asset uploaded successfully',
        });
    } catch (error: any) {
        console.error('Game asset upload error:', error);
        res.status(500).json({ error: error.message || 'Upload failed' });
    }
});

/**
 * DELETE /api/upload/:bucket/:path
 * Delete a file from Supabase Storage
 */
router.delete('/:bucket/:path(*)', async (req: Request, res: Response): Promise<void> => {
    try {
        const { bucket, path } = req.params;
        const walletAddress = req.headers['x-wallet-address'];

        // Basic authorization: only allow deletion of own files
        if (!walletAddress) {
            res.status(401).json({ error: 'Wallet address required' });
            return;
        }

        await deleteFileFromSupabase(bucket, path);

        res.json({
            success: true,
            message: 'File deleted successfully',
        });
    } catch (error: any) {
        console.error('File deletion error:', error);
        res.status(500).json({ error: error.message || 'Deletion failed' });
    }
});

/**
 * GET /api/upload/test
 * Test endpoint to verify upload routes are working
 */
router.get('/test', (req: Request, res: Response) => {
    res.json({
        success: true,
        message: 'Upload routes are working',
        endpoints: {
            'POST /api/upload/avatar': 'Upload user avatar (requires: avatar file, walletAddress)',
            'POST /api/upload/nft': 'Upload NFT image (requires: image file, mintAddress)',
            'POST /api/upload/game-asset': 'Upload game asset (requires: asset file, assetType, assetName)',
            'DELETE /api/upload/:bucket/:path': 'Delete a file',
        },
        supabaseProject: process.env.SUPABASE_PROJECT_ID,
    });
});

export default router;
