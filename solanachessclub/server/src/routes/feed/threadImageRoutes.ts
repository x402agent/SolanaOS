/**
 * File: server/src/routes/threadImageRoutes.ts
 *
 * A router that handles uploading thread images to IPFS
 */

import {Router} from 'express';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import os from 'os';
import knex from '../../db/knex';
import {uploadToPinata} from '../../utils/ipfs';

const threadImageRouter = Router();
const upload = multer({storage: multer.memoryStorage()});

/**
 * Upload a thread image to IPFS
 */
threadImageRouter.post(
  '/upload',
  upload.single('threadImage'),
  async (req: any, res: any) => {
    try {
      const userId = req.body.userId;
      if (!userId) {
        return res.status(400).json({success: false, error: 'Missing userId'});
      }
      if (!req.file) {
        return res
          .status(400)
          .json({success: false, error: 'No file uploaded'});
      }

      // 1) Compress the image using sharp
      const outputFormat = 'jpeg';
      const compressedBuffer = await sharp(req.file.buffer)
        .resize({width: 1024, withoutEnlargement: true})
        .toFormat(outputFormat, {quality: 80})
        .toBuffer();

      // 2) Write to a temp file
      const tempFileName = `thread-${userId}-${Date.now()}.${outputFormat}`;
      const tempFilePath = path.join(os.tmpdir(), tempFileName);
      await fs.promises.writeFile(tempFilePath, compressedBuffer);

      // 3) Prepare IPFS metadata
      const metadata = {
        name: 'Thread Image',
        symbol: 'IMG',
        description: `Thread image uploaded by user ${userId}`,
        showName: false,
      };

      // 4) Upload image to Pinata IPFS
      const ipfsResult = await uploadToPinata(tempFilePath, metadata);

      // 5) Clean up temp file
      await fs.promises.unlink(tempFilePath);

      // 6) Attempt to fetch the returned metadata JSON
      let ipfsImageUrl = ipfsResult;
      const {default: fetch} = await import('node-fetch');
      const metadataResponse = await fetch(ipfsResult);
      if (metadataResponse.ok) {
        const metadataJson: any = await metadataResponse.json();
        if (metadataJson.image) {
          ipfsImageUrl = metadataJson.image;
        }
      }

      return res.json({success: true, url: ipfsImageUrl});
    } catch (error: any) {
      console.error('[Thread image upload error]', error);
      return res.status(500).json({success: false, error: error.message});
    }
  },
);

export {threadImageRouter}; 