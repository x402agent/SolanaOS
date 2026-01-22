// File: server/src/utils/supabase-storage.ts
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role for server-side operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

/**
 * Upload a file buffer to Supabase Storage and return a public URL.
 * 
 * @param bucket     The Supabase storage bucket name (e.g., "profiles", "uploads")
 * @param filePath   Path within the bucket, e.g., "profiles/<userId>-<timestamp>.jpg"
 * @param fileBuffer The file buffer (from multer or any source)
 * @param mimeType   The file's MIME type (e.g., "image/jpeg")
 * @returns A public URL to the uploaded file
 */
export async function uploadFileToSupabase(
    bucket: string,
    filePath: string,
    fileBuffer: Buffer,
    mimeType: string,
): Promise<string> {
    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, fileBuffer, {
            contentType: mimeType,
            upsert: true, // Overwrite if file exists
        });

    if (error) {
        throw new Error(`Failed to upload file to Supabase: ${error.message}`);
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

    return urlData.publicUrl;
}

/**
 * Delete a file from Supabase Storage
 * 
 * @param bucket   The Supabase storage bucket name
 * @param filePath Path to the file within the bucket
 */
export async function deleteFileFromSupabase(
    bucket: string,
    filePath: string,
): Promise<void> {
    const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);

    if (error) {
        throw new Error(`Failed to delete file from Supabase: ${error.message}`);
    }
}

/**
 * List files in a Supabase Storage bucket at a given path
 * 
 * @param bucket The Supabase storage bucket name
 * @param path   Path within the bucket (optional, defaults to root)
 * @returns Array of file objects
 */
export async function listFilesInSupabase(
    bucket: string,
    path: string = '',
) {
    const { data, error } = await supabase.storage
        .from(bucket)
        .list(path);

    if (error) {
        throw new Error(`Failed to list files from Supabase: ${error.message}`);
    }

    return data;
}

/**
 * Create a signed URL for temporary access to a private file
 * 
 * @param bucket       The Supabase storage bucket name
 * @param filePath     Path to the file within the bucket
 * @param expiresIn    Expiration time in seconds (default: 3600 = 1 hour)
 * @returns A signed URL for temporary access
 */
export async function createSignedUrl(
    bucket: string,
    filePath: string,
    expiresIn: number = 3600,
): Promise<string> {
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, expiresIn);

    if (error) {
        throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
}

/**
 * Get download URL for a file (useful for private buckets)
 * 
 * @param bucket   The Supabase storage bucket name
 * @param filePath Path to the file within the bucket
 * @returns Download URL
 */
export async function getDownloadUrl(
    bucket: string,
    filePath: string,
): Promise<string> {
    const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

    return data.publicUrl;
}

// Export the Supabase client for advanced usage
export { supabase };
