// FILE: server/src/controllers/UploadMetadataController.ts

import {Request, Response} from 'express';
import {uploadToIpfs} from '../utils/ipfs';

export async function UploadMetadataController(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const {tokenName, tokenSymbol, description, twitter, telegram, website, createdOn} =
      req.body;
    console.log('[UploadMetadataController] req.body =>', req.body);
    if (!tokenName || !tokenSymbol || !description) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields (tokenName, tokenSymbol, description)',
      });
      return;
    }
    
    // Check for the image file - it could be in req.file (from multer) or in req.body.image
    // (from the direct object upload used in mobile apps)
    let imageBuffer;
    
    if (req.file) {
      // Standard file upload via multer
      imageBuffer = req.file.buffer;
    } else if (req.body.image) {
      // Handle the case where image is sent as an object with uri property
      // This is common in React Native when using FormData
      console.log('[UploadMetadataController] Image object received:', 
        typeof req.body.image === 'object' ? 'object' : 'string');
        
      try {
        // If the image is a JSON string (which can happen with FormData), parse it
        const imageData = typeof req.body.image === 'string' 
          ? JSON.parse(req.body.image) 
          : req.body.image;
          
        // Fetch the image from the URI
        const imageUri = imageData.uri;
        console.log('[UploadMetadataController] Fetching image from URI:', imageUri);
        
        const imageResponse = await fetch(imageUri);
        imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      } catch (imageError: any) {
        console.error('[UploadMetadataController] Error processing image:', imageError);
        res.status(400).json({
          success: false,
          error: `Failed to process image: ${imageError.message}`,
        });
        return;
      }
    }
    
    if (!imageBuffer) {
      res.status(400).json({
        success: false,
        error: 'Image is required. Please provide either a file upload or a valid image URI.',
      });
      return;
    }

    const metadataObj = {
      name: tokenName,
      symbol: tokenSymbol,
      description,
      showName: true,
      createdOn: createdOn || 'https://www.solanaappkit.com',
      twitter: twitter || '',
      telegram: telegram || '',
      website: website || '',
    };
    
    console.log('[UploadMetadataController] Uploading to Pump Fun IPFS...');
    const metadataUri = await uploadToIpfs(imageBuffer, metadataObj);

    res.json({
      success: true,
      metadataUri,
    });
  } catch (err: any) {
    console.error('[UploadMetadataController] Error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Unknown error uploading metadata.',
    });
  }
}
