// server/src/utils/ipfs.ts
import fs from 'fs';
import path from 'path';
// import fetch from 'node-fetch';
import FormData from 'form-data';
import { PinataSDK } from 'pinata';
import axios from 'axios';

// Use environment variables for API keys
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;

export async function uploadToIpfs(
  imagePathOrBuffer: string | Buffer,
  metadata: Record<string, any>,
): Promise<string> {
  const { default: fetch } = await import('node-fetch');
  
  // Get file buffer either from path or directly from buffer
  let fileBuffer: Buffer;
  if (typeof imagePathOrBuffer === 'string') {
    // It's a file path, read the file
    const resolvedPath = path.resolve(imagePathOrBuffer);
    fileBuffer = fs.readFileSync(resolvedPath);
  } else {
    // It's already a buffer
    fileBuffer = imagePathOrBuffer;
  }

  // 2) Create FormData with all required fields
  const formData = new FormData();

  // Add the image file to FormData
  const fileName = `image-${Date.now()}.png`;
  formData.append('file', fileBuffer, {filename: fileName, contentType: 'image/png'});

  // Add metadata fields to FormData
  formData.append('name', metadata.name || '');
  formData.append('symbol', metadata.symbol || '');
  formData.append('description', metadata.description || '');

  // Add optional social links and other metadata if provided
  if (metadata.twitter) formData.append('twitter', metadata.twitter);
  if (metadata.telegram) formData.append('telegram', metadata.telegram);
  if (metadata.website) formData.append('website', metadata.website);
  if (metadata.createdOn) formData.append('createdOn', 'https://www.solanaappkit.com');
  formData.append('showName', metadata.showName?.toString() || 'true');

  // 3) Upload to Pump Fun IPFS API
  const metadataResponse = await fetch('https://pump.fun/api/ipfs', {
    method: 'POST',
    body: formData,
  });

  if (!metadataResponse.ok) {
    throw new Error(
      `Failed to upload to Pump Fun IPFS: ${metadataResponse.statusText}`,
    );
  }

  // 4) Extract and return the metadata URI
  const metadataResponseJSON = await metadataResponse.json() as { metadataUri: string };
  const metadataUri = metadataResponseJSON.metadataUri;

  console.log('Metadata URI:', metadataUri);
  return metadataUri;
}

/**
 * Upload response type from Pinata
 */
export type PinataUploadResponse = {
  id: string;
  name: string;
  cid: string;
  size: number;
  created_at: string;
  number_of_files: number;
  mime_type: string;
  group_id: string | null;
  keyvalues: {
    [key: string]: string;
  };
  vectorized: boolean;
  network: string;
};

/**
 * Upload image and metadata to Pinata IPFS
 * @param imagePathOrBuffer - Path to image file or buffer containing image data
 * @param metadata - Token metadata to include with the image
 * @returns - The IPFS URI for the uploaded metadata
 */
export async function uploadToPinata(
  imagePathOrBuffer: string | Buffer,
  metadata: Record<string, any>,
): Promise<string> {
  const { default: fetch } = await import('node-fetch');

  // Get file buffer either from path or directly from buffer
  let fileBuffer: Buffer;
  if (typeof imagePathOrBuffer === 'string') {
    // It's a file path, read the file
    const resolvedPath = path.resolve(imagePathOrBuffer);
    fileBuffer = fs.readFileSync(resolvedPath);
  } else {
    // It's already a buffer
    fileBuffer = imagePathOrBuffer;
  }

  // Initialize Pinata SDK with environment variables
  const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT!,
    pinataGateway: process.env.PINATA_GATEWAY,
  });
  
  console.log('Uploading image to Pinata...');
  
  // Create a temp file to upload using FormData
  const fileName = `image-${Date.now()}.png`;
  const tempFilePath = path.join(process.cwd(), fileName);
  fs.writeFileSync(tempFilePath, fileBuffer);
  
  try {
    // Use low-level API with FormData to upload the image
    const formData = new FormData();
    const readStream = fs.createReadStream(tempFilePath);
    formData.append('file', readStream, { filename: fileName });
    
    // Upload to Pinata using FormData
    const imageResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PINATA_JWT}`
      },
      body: formData,
    });
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to upload image to Pinata: ${imageResponse.statusText}`);
    }
    
    const imageUploadData = await imageResponse.json() as { IpfsHash: string };
    const imageUri = `https://ipfs.io/ipfs/${imageUploadData.IpfsHash}`;
    console.log('Image uploaded to Pinata, CID:', imageUploadData.IpfsHash);
    
    // Create the metadata object with the image URI
    const metadataObject = {
      name: metadata.name || '',
      symbol: metadata.symbol || '',
      description: metadata.description || '',
      image: imageUri,
      showName: metadata.showName !== undefined ? metadata.showName : true,
      createdOn: metadata.createdOn || 'https://raydium.io/',
      twitter: metadata.twitter || '',
      telegram: metadata.telegram || '',
      website: metadata.website || '',
    };
    
    console.log('Uploading metadata to Pinata...');
    
    // Upload the metadata JSON using direct API call instead of the SDK
    // This avoids the "File is not defined" error in the Node.js environment
    const jsonResponse = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PINATA_JWT}`
      },
      body: JSON.stringify(metadataObject)
    });
    
    if (!jsonResponse.ok) {
      throw new Error(`Failed to upload metadata to Pinata: ${jsonResponse.statusText}`);
    }
    
    const jsonData = await jsonResponse.json() as { IpfsHash: string };
    
    // Return the IPFS link to the metadata
    const metadataUri = `https://${process.env.PINATA_GATEWAY}/ipfs/${jsonData.IpfsHash}`;
    
    console.log('Metadata uploaded to Pinata, URI:', metadataUri);
    return metadataUri;
  } finally {
    // Clean up the temporary file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

/**
 * Fallback function that creates a JSON metadata file and hosts it on the server
 * This is used when Pinata/IPFS integration is not available
 */
export async function createLocalMetadata(metadata: any): Promise<string> {
  try {
    // In a real implementation, this would save the file and return a URL
    // For now, we'll just return a mock URL
    console.log('Creating local metadata:', metadata);
    return `https://meteora.ag/metadata/${Date.now()}.json`;
  } catch (error) {
    console.error('Error creating local metadata:', error);
    throw new Error('Failed to create metadata');
  }
}

