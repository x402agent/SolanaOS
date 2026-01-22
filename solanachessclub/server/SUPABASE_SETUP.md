# Supabase Integration Guide

This guide explains how to set up and use Supabase for storage and database operations in the Solana Chess Club backend.

## 🎯 Overview

We've migrated from Google Cloud Storage (GCS) to Supabase for both storage and database operations. Supabase provides:

- **Storage**: File storage with public/private buckets, signed URLs, and S3-compatible API
- **Database**: PostgreSQL database with real-time capabilities
- **Auth**: Built-in authentication (optional, can be used for future features)
- **Edge Functions**: Serverless functions for backend logic

## 📦 Environment Configuration

The following environment variables are configured in `server/.env`:

```bash
# Supabase Configuration
SUPABASE_PROJECT_ID="bvpysuatpnoytmcaetxl"
SUPABASE_URL="https://bvpysuatpnoytmcaetxl.supabase.co"
SUPABASE_ANON_KEY="eyJhbGci..."  # For client-side operations
SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."  # For server-side operations (elevated permissions)
SUPABASE_STORAGE_URL="https://bvpysuatpnoytmcaetxl.supabase.co/storage/v1"
SUPABASE_S3_URL="https://bvpysuatpnoytmcaetxl.storage.supabase.co/storage/v1/s3"
SUPABASE_ACCESS_KEY="0f05520c7aec885de54b83ca637afae3"
SUPABASE_SECRET_ACCESS_KEY="ec9c575e..."
SUPABASE_REGION="us-west-2"
```

## 🗂️ Storage Buckets Setup

### Creating Buckets

Before using storage, you need to create buckets in the Supabase Dashboard:

1. Go to https://supabase.com/dashboard/project/bvpysuatpnoytmcaetxl/storage/buckets
2. Create the following buckets:

#### Recommended Buckets:
- **`uploads`** - For general file uploads
- **`profiles`** - For user profile images/avatars
- **`nfts`** - For NFT metadata and images
- **`game-assets`** - For chess game-related assets

### Bucket Configuration

For each bucket, configure:
- ✅ **Public bucket** (if files should be publicly accessible)
- 📏 **File size limit**: 50MB (recommended)
- 📝 **Allowed MIME types**: Configure based on your needs

Example bucket policies (in Supabase Dashboard → Storage → Policies):

```sql
-- Allow public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'uploads' );

-- Allow authenticated uploads
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'uploads' );
```

## 💻 Usage Examples

### Storage Operations

```typescript
import { 
  uploadFileToSupabase, 
  deleteFileFromSupabase,
  createSignedUrl 
} from './utils/supabase-storage';

// Upload a file
const fileUrl = await uploadFileToSupabase(
  'profiles',  // bucket name
  `${userId}/avatar-${Date.now()}.jpg`,  // file path
  fileBuffer,  // file buffer
  'image/jpeg'  // mime type
);

// Delete a file
await deleteFileFromSupabase('profiles', `${userId}/avatar-123456.jpg`);

// Create a temporary signed URL (for private files)
const signedUrl = await createSignedUrl(
  'private-uploads',
  'sensitive-document.pdf',
  3600  // expires in 1 hour
);
```

### Database Operations

```typescript
import { 
  supabaseAdmin,
  insertRecord,
  updateRecord,
  getRecords 
} from './utils/supabase-client';

// Insert a record
const newUser = await insertRecord('users', {
  wallet_address: '...',
  username: 'player123',
  created_at: new Date().toISOString()
});

// Update a record
const updatedUser = await updateRecord('users', userId, {
  avatar_url: imageUrl,
  updated_at: new Date().toISOString()
});

// Query records
const activePlayers = await getRecords('users', {
  filters: { status: 'active' },
  orderBy: { column: 'created_at', ascending: false },
  limit: 10
});

// Advanced queries using supabaseAdmin directly
const { data, error } = await supabaseAdmin
  .from('chess_games')
  .select('*, player1:users!player1_id(*), player2:users!player2_id(*)')
  .eq('status', 'active')
  .order('created_at', { ascending: false });
```

## 🗄️ Database Schema Setup

### Chess Game Tables

You can create the necessary tables using the Supabase SQL Editor:

```sql
-- Users/Players table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  avatar_url TEXT,
  elo_rating INTEGER DEFAULT 1200,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chess games table
CREATE TABLE IF NOT EXISTS chess_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player1_id UUID REFERENCES users(id),
  player2_id UUID REFERENCES users(id),
  wager_amount NUMERIC(20, 9),  -- SOL amount
  game_state JSONB NOT NULL,  -- Chess.js game state
  status TEXT DEFAULT 'pending',  -- pending, active, completed, abandoned
  winner_id UUID REFERENCES users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game moves history
CREATE TABLE IF NOT EXISTS game_moves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES chess_games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES users(id),
  move_san TEXT NOT NULL,  -- Move in Standard Algebraic Notation
  move_number INTEGER NOT NULL,
  fen TEXT NOT NULL,  -- Board state after move
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Leaderboard (materialized view for performance)
CREATE MATERIALIZED VIEW leaderboard AS
SELECT 
  id,
  wallet_address,
  username,
  elo_rating,
  games_played,
  games_won,
  ROUND((games_won::NUMERIC / NULLIF(games_played, 0)) * 100, 2) as win_rate
FROM users
WHERE games_played > 0
ORDER BY elo_rating DESC;

-- Refresh leaderboard function
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW leaderboard;
END;
$$ LANGUAGE plpgsql;
```

### Enable Real-time (Optional)

For real-time game updates:

```sql
-- Enable real-time for chess_games table
ALTER PUBLICATION supabase_realtime ADD TABLE chess_games;
ALTER PUBLICATION supabase_realtime ADD TABLE game_moves;
```

Then subscribe in your client code:

```typescript
import { supabase } from './utils/supabase-storage';

// Subscribe to game updates
const gameSubscription = supabase
  .channel('game-updates')
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'chess_games' },
    (payload) => {
      console.log('Game updated:', payload);
      // Handle game state update
    }
  )
  .subscribe();
```

## 🔐 Security Best Practices

1. **Service Role Key**: Only use in server-side code, NEVER expose to clients
2. **Row Level Security (RLS)**: Enable RLS on all tables and create appropriate policies
3. **Storage Policies**: Configure bucket policies to restrict access as needed
4. **API Rate Limiting**: Monitor usage in Supabase Dashboard

## 🚀 Migration from GCS

### Before (GCS):
```typescript
import { uploadFileToGCS } from './utils/gcs';
const url = await uploadFileToGCS(filePath, buffer, mimeType);
```

### After (Supabase):
```typescript
import { uploadFileToSupabase } from './utils/supabase-storage';
const url = await uploadFileToSupabase('uploads', filePath, buffer, mimeType);
```

### Key Differences:
- Supabase requires specifying a bucket name
- File paths are relative to the bucket
- Additional features: signed URLs, file deletion, listing

## 📊 Monitoring & Analytics

Access Supabase Dashboard for:
- Storage usage and bandwidth
- Database query performance
- Real-time connections
- API logs and errors

Dashboard URL: https://supabase.com/dashboard/project/bvpysuatpnoytmcaetxl

## 🔧 Troubleshooting

### Common Issues:

1. **"Missing SUPABASE_URL" error**
   - Ensure `.env` file is properly loaded
   - Check that all required variables are set

2. **Upload fails with 401**
   - Verify SERVICE_ROLE_KEY is correct
   - Check bucket policies allow uploads

3. **Public URL not accessible**
   - Ensure bucket is set to public
   - Check storage policies

4. **Database connection issues**
   - Verify project is not paused (free tier pauses after 7 days inactivity)
   - Check connection pooling settings

## 📚 Additional Resources

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Supabase Database Documentation](https://supabase.com/docs/guides/database)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
