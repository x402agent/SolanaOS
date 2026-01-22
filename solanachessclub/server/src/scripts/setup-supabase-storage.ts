#!/usr/bin/env tsx
/**
 * Supabase Storage Setup Script
 * 
 * This script creates the necessary storage buckets for the Solana Chess Club app.
 * Run with: npx tsx src/scripts/setup-supabase-storage.ts
 */

// Load environment variables first
import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env from server directory
config({ path: resolve(__dirname, '../../.env') });

// Initialize Supabase client after env is loaded
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables');
    console.log('Please ensure your .env file contains:');
    console.log('  SUPABASE_URL="https://..."');
    console.log('  SUPABASE_SERVICE_ROLE_KEY="eyJ..."');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

interface BucketConfig {
    name: string;
    public: boolean;
    fileSizeLimit?: number;
    allowedMimeTypes?: string[];
}

const BUCKETS: BucketConfig[] = [
    {
        name: 'uploads',
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: ['image/*', 'video/*', 'application/pdf'],
    },
    {
        name: 'profiles',
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    },
    {
        name: 'nfts',
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/*', 'application/json'],
    },
    {
        name: 'game-assets',
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/*', 'audio/*'],
    },
    {
        name: 'private-uploads',
        public: false,
        fileSizeLimit: 52428800, // 50MB
    },
];

async function createBucket(config: BucketConfig) {
    const { name, public: isPublic, fileSizeLimit, allowedMimeTypes } = config;

    try {
        // Check if bucket already exists
        const { data: existingBuckets } = await supabaseAdmin.storage.listBuckets();
        const bucketExists = existingBuckets?.some((b) => b.name === name);

        if (bucketExists) {
            console.log(`✓ Bucket '${name}' already exists`);

            // Update bucket if needed
            const { error: updateError } = await supabaseAdmin.storage.updateBucket(name, {
                public: isPublic,
                fileSizeLimit,
                allowedMimeTypes,
            });

            if (updateError) {
                console.warn(`⚠️  Warning: Could not update bucket '${name}':`, updateError.message);
            } else {
                console.log(`  Updated settings for '${name}'`);
            }
        } else {
            // Create new bucket
            const { error: createError } = await supabaseAdmin.storage.createBucket(name, {
                public: isPublic,
                fileSizeLimit,
                allowedMimeTypes,
            });

            if (createError) {
                console.error(`✗ Failed to create bucket '${name}':`, createError.message);
            } else {
                console.log(`✓ Created bucket '${name}' (${isPublic ? 'public' : 'private'})`);
            }
        }
    } catch (error: any) {
        console.error(`✗ Error processing bucket '${name}':`, error.message);
    }
}

async function setupStoragePolicies() {
    console.log('\n📋 Setting up storage policies...');
    console.log('Note: You may need to configure Row Level Security policies manually in the Supabase Dashboard');
    console.log('Dashboard URL: https://supabase.com/dashboard/project/bvpysuatpnoytmcaetxl/storage/policies\n');

    // Example policies to apply manually:
    const policyExamples = [
        {
            bucket: 'uploads',
            policy: 'Allow public read access',
            sql: `
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING ( bucket_id = 'uploads' );
      `.trim(),
        },
        {
            bucket: 'profiles',
            policy: 'Allow public read, authenticated insert',
            sql: `
CREATE POLICY "Public Read" ON storage.objects
FOR SELECT USING ( bucket_id = 'profiles' );

CREATE POLICY "Authenticated Insert" ON storage.objects
FOR INSERT WITH CHECK ( 
  bucket_id = 'profiles' AND 
  auth.role() = 'authenticated' 
);
      `.trim(),
        },
    ];

    console.log('Example policies you can apply in the SQL Editor:\n');
    policyExamples.forEach(({ bucket, policy, sql }) => {
        console.log(`${bucket}: ${policy}`);
        console.log('```sql');
        console.log(sql);
        console.log('```\n');
    });
}

async function main() {
    console.log('🚀 Setting up Supabase Storage for Solana Chess Club\n');

    try {
        // Create all buckets
        console.log('Creating storage buckets...\n');
        for (const bucket of BUCKETS) {
            await createBucket(bucket);
        }

        // Show policy setup instructions
        await setupStoragePolicies();

        console.log('✅ Storage setup complete!\n');
        console.log('Next steps:');
        console.log('1. Review buckets in Dashboard: https://supabase.com/dashboard/project/bvpysuatpnoytmcaetxl/storage/buckets');
        console.log('2. Configure RLS policies if needed');
        console.log('3. Test uploads using the utility functions in src/utils/supabase-storage.ts\n');
    } catch (error: any) {
        console.error('❌ Setup failed:', error.message);
        process.exit(1);
    }
}

// Run the setup
main();
