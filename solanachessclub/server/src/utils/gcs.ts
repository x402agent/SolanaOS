// File: server/src/utils/gcs.ts
// ⚠️ DEPRECATED: This file is no longer used. Migrated to Supabase Storage.
// See: server/src/utils/supabase-storage.ts

/**
 * This file has been replaced with Supabase Storage integration.
 * 
 * Migration Guide:
 * ---------------
 * Old (GCS):
 *   import { uploadFileToGCS } from './utils/gcs';
 *   const url = await uploadFileToGCS(filePath, buffer, mimeType);
 * 
 * New (Supabase):
 *   import { uploadFileToSupabase } from './utils/supabase-storage';
 *   const url = await uploadFileToSupabase('bucket-name', filePath, buffer, mimeType);
 * 
 * Key Differences:
 * 1. Supabase requires specifying a bucket name as the first parameter
 * 2. File paths in Supabase are relative to the bucket
 * 3. Supabase provides additional features like signed URLs and file deletion
 * 
 * Environment Variables Changed:
 * - GCS_BUCKET_NAME → SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * - SERVICE_ACCOUNT_EMAIL → (no longer needed)
 * 
 * For more details, see: /server/src/utils/supabase-storage.ts
 */

export function uploadFileToGCS(): never {
  throw new Error(
    'uploadFileToGCS is deprecated. Use uploadFileToSupabase from ./supabase-storage instead.'
  );
}
