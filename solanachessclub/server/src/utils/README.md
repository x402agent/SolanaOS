# Utils Directory

This directory contains utility functions and helpers used throughout the Solana App Kit server. These utilities provide reusable functionality for common tasks such as file storage, IPFS integration, and blockchain interactions.

## Available Utilities

### `gcs.ts`

Google Cloud Storage integration utilities:

- `uploadToGCS`: Uploads files to Google Cloud Storage
- `getGCSPublicUrl`: Generates public URLs for stored files
- `deleteFromGCS`: Removes files from storage
- `getGCSBucket`: Retrieves the GCS bucket instance

These functions handle authentication, file uploads, and URL generation for the GCS bucket specified in the environment variables.

### `ipfs.ts`

IPFS integration via Pinata:

- `uploadToIPFS`: Uploads JSON metadata to IPFS
- `pinFile`: Pins a file to IPFS
- `getIPFSUrl`: Generates gateway URLs for IPFS content
- `uploadMetadata`: Specialized function for uploading token metadata

These utilities abstract away the complexities of working with Pinata's API for IPFS storage.

### `tokenMillHelpers.ts`

Helper functions for TokenMill operations:

- `deriveMarketPDA`: Derives program-derived addresses for markets
- `deriveTokenPositionPDA`: Derives PDAs for token positions
- `buildFeeStructure`: Creates fee structures for token markets
- `convertToLamports`: Converts SOL amounts to lamports
- `convertToTokens`: Converts lamport amounts to token units

These helpers support the TokenMill service by providing common calculations and address derivations.

## Common Patterns

### File Upload Pattern

```typescript
import { uploadToGCS } from '../utils/gcs';

// In a controller function
const fileBuffer = req.file.buffer;
const contentType = req.file.mimetype;
const fileName = `${uuidv4()}.${req.file.originalname.split('.').pop()}`;

const publicUrl = await uploadToGCS(
  fileBuffer,
  fileName,
  contentType
);

return publicUrl;
```

### IPFS Metadata Upload Pattern

```typescript
import { uploadMetadata } from '../utils/ipfs';

// In a controller function
const metadata = {
  name: "Token Name",
  symbol: "TKN",
  description: "Token description",
  image: imageUrl,
  attributes: [
    { trait_type: "Category", value: "Social" }
  ]
};

const ipfsUrl = await uploadMetadata(metadata);
return ipfsUrl;
```

### TokenMill PDA Derivation Pattern

```typescript
import { deriveMarketPDA } from '../utils/tokenMillHelpers';

// In a service function
const [marketPda, marketBump] = await deriveMarketPDA(
  marketIndex,
  tokenMillProgramId
);
```

## Adding New Utilities

When adding new utility functions:

1. Group related functions in a single file with a descriptive name
2. Document all functions with JSDoc comments
3. Implement error handling for robust operation
4. Export all functions that will be used outside the file
5. Keep functions pure and focused on a single responsibility
6. Write utility functions to be stateless where possible

## Best Practices

- **Error Handling**: Implement robust error handling in utility functions
- **Type Safety**: Use TypeScript types for parameters and return values
- **Documentation**: Document utility functions with JSDoc comments
- **Testability**: Design utilities to be easily testable
- **Reusability**: Make utilities generic enough to be used in multiple contexts
- **Immutability**: Avoid modifying input parameters
- **Configuration**: Use environment variables for configuration where appropriate
- **Logging**: Include appropriate logging for errors and operations

## Example Utility Function

```typescript
/**
 * Uploads a file buffer to Google Cloud Storage and returns the public URL
 * @param fileBuffer - The buffer containing file data
 * @param fileName - The desired file name (including extension)
 * @param contentType - The MIME type of the file
 * @returns A Promise resolving to the public URL of the uploaded file
 * @throws Error if the upload fails
 */
export async function uploadToGCS(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  try {
    const bucket = getGCSBucket();
    const file = bucket.file(fileName);
    
    // Upload file
    await file.save(fileBuffer, {
      metadata: {
        contentType,
      },
    });
    
    // Make file publicly accessible
    await file.makePublic();
    
    // Return public URL
    return `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/${fileName}`;
  } catch (error) {
    console.error('Error uploading to GCS:', error);
    throw new Error(`Failed to upload file to Google Cloud Storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```
