# 🎯 Supabase Integration - Complete! ✅

## Summary

We've successfully migrated your Solana Chess Club backend from Google Cloud Storage to Supabase! Here's everything that's been set up and ready to use.

---

## ✅ What's Been Completed

### 1. **Backend Server Migration** 
- ✅ Replaced `@google-cloud/storage` with `@supabase/supabase-js`
- ✅ Environment variables configured in `server/.env`
- ✅ Created comprehensive utility files:
  - `server/src/utils/supabase-storage.ts` - File storage operations
  - `server/src/utils/supabase-client.ts` - Database operations
  - `server/src/utils/gcs.ts` - Deprecated with migration guide
- ✅ Created API routes in `server/src/routes/upload.ts`:
  - `POST /api/upload/avatar` - User avatars
  - `POST /api/upload/nft` - NFT images
  - `POST /api/upload/game-asset` - Game assets
 - `DELETE /api/upload/:bucket/:path` - File deletion
  - `GET /api/upload/test` - Test endpoint

### 2. **Storage Buckets**
✅ Successfully created 5 storage buckets:
- `uploads` (public, 50MB) - General file uploads
- `profiles` (public, 5MB) - User avatars
- `nfts` (public, 10MB) - NFT metadata/images
- `game-assets` (public, 10MB) - Chess pieces, boards, etc.
- `private-uploads` (private, 50MB) - Private files

### 3. **React Native Integration**
- ✅ Installed `@supabase/supabase-js` in main app
- ✅ Environment variables configured in `.env.local`:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- ✅ Created React Native hooks in `src/modules/chess/hooks/useSupabase.ts`:
  - `useSupabase()` - Get Supabase client
  - `useSupabaseUpload()` - Upload files
  - `useSupabaseQuery()` - Query database
  - `useSupabaseSubscription()` - Real-time updates
  - `useSupabaseMutation()` - Insert/Update/Delete data

### 4. **Documentation**
- ✅ `server/SUPABASE_SETUP.md` - Complete setup guide
- ✅ `server/SUPABASE_MIGRATION.md` - Migration summary
- ✅ Setup script: `server/src/scripts/setup-supabase-storage.ts`

---

## 🚀 Quick Start Usage

### **In React Native (Mobile App)**

```typescript
import { useSupabaseUpload, useSupabaseQuery } from '@/modules/chess/hooks/useSupabase';

// Upload an avatar
function ProfileScreen() {
  const { uploadFile, uploading } = useSupabaseUpload();
  
  const handleUploadAvatar = async (imageUri: string) => {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    const { url } = await uploadFile(
      'profiles',
      `avatars/${userId}.jpg`,
      blob,
      { contentType: 'image/jpeg' }
    );
    
    console.log('Avatar uploaded:', url);
  };
  
  return (/* UI */);
}

// Query chess games
function GamesList() {
  const { data: games, loading } = useSupabaseQuery('chess_games', {
    filters: { status: 'active' },
    orderBy: { column: 'created_at', ascending: false },
    limit: 10
  });
  
  if (loading) return <Loading />;
  return <GamesList games={games} />;
}

// Subscribe to real-time game updates
function GameScreen({ gameId }) {
  useSupabaseSubscription(
    'chess_games',
    'UPDATE',
    (game) => {
      console.log('Game updated:', game);
      // Update local state
    },
    `id=eq.${gameId}`
  );
  
  return (/* Game UI */);
}
```

### **In Express Server**

```typescript
import { uploadFileToSupabase } from './utils/supabase-storage';
import { supabaseAdmin, insertRecord } from './utils/supabase-client';

// Upload a file
const publicUrl = await uploadFileToSupabase(
  'profiles',
  `avatar-${userId}.jpg`,
  fileBuffer,
  'image/jpeg'
);

// Database operations
const user = await insertRecord('users', {
  wallet_address: address,
  username: name,
  avatar_url: publicUrl
});

// Query with joins
const { data } = await supabaseAdmin
  .from('chess_games')
  .select(`
    *,
    player1:users!player1_id(*),
    player2:users!player2_id(*)
  `)
  .eq('status', 'active');
```

---

## 🗄️ Next Steps: Database Setup

### 1. **Create Tables**

Go to your Supabase SQL Editor:
https://supabase.com/dashboard/project/bvpysuatpnoytmcaetxl/sql/new

Run this SQL to create the chess database schema:

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
  wager_amount NUMERIC(20, 9),
  game_state JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
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
  move_san TEXT NOT NULL,
  move_number INTEGER NOT NULL,
  fen TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_games_status ON chess_games(status);
CREATE INDEX idx_games_players ON chess_games(player1_id, player2_id);
CREATE INDEX idx_moves_game ON game_moves(game_id);
```

### 2. **Enable Real-time** (Optional)

```sql
-- Enable real-time for game updates
ALTER PUBLICATION supabase_realtime ADD TABLE chess_games;
ALTER PUBLICATION supabase_realtime ADD TABLE game_moves;
```

### 3. **Set Up Row Level Security (RLS)**

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chess_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_moves ENABLE ROW LEVEL SECURITY;

-- Public read access for users
CREATE POLICY "Users are viewable by everyone"
  ON users FOR SELECT
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid()::text = id::text);
```

---

## 🔍 Testing

### Test the Storage Setup

```bash
cd server
npx tsx src/scripts/setup-supabase-storage.ts
```

### Test Upload Endpoint

```bash
curl -X GET http://localhost:3000/api/upload/test
```

Should return:
```json
{
  "success": true,
  "message": "Upload routes are working",
  "endpoints": { ... },
  "supabaseProject": "bvpysuatpnoytmcaetxl"
}
```

---

## 📊 Supabase Dashboard

Access your project dashboard:
- **Main Dashboard**: https://supabase.com/dashboard/project/bvpysuatpnoytmcaetxl
- **Storage**: https://supabase.com/dashboard/project/bvpysuatpnoytmcaetxl/storage/buckets
- **Database**: https://supabase.com/dashboard/project/bvpysuatpnoytmcaetxl/editor
- **SQL Editor**: https://supabase.com/dashboard/project/bvpysuatpnoytmcaetxl/sql/new

---

## 🎮 Chess Game Integration Checklist

- [ ] Create database tables (see SQL above)
- [ ] Enable real-time subscriptions
- [ ] Set up Row Level Security policies
- [ ] Test file uploads from mobile app
- [ ] Implement user profile with avatar
- [ ] Create game lobby with real-time updates
- [ ] Build chess board UI component
- [ ] Integrate Chess.com API (already set up)
- [ ] Add AI agents (Ralph Wiggum loop)
- [ ] Connect wallet for SOL wagering

---

## 📚 Resources

- **Setup Guide**: `server/SUPABASE_SETUP.md`
- **Migration Guide**: `server/SUPABASE_MIGRATION.md`
- **Supabase Docs**: https://supabase.com/docs
- **Storage Docs**: https://supabase.com/docs/guides/storage
- **Database Docs**: https://supabase.com/docs/guides/database
- **Real-time Docs**: https://supabase.com/docs/guides/realtime

---

## 🆘 Troubleshooting

### Can't connect to Supabase?
- Check that `.env.local` has `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Verify server `.env` has `SUPABASE_SERVICE_ROLE_KEY`

### Upload failing?
- Check bucket exists in dashboard
- Verify bucket is public (or use signed URLs)
- Check file size limits

### Database queries not working?
- Create tables first using SQL above
- Check RLS policies allow your operation
- Verify project is not paused (free tier auto-pauses after 7 days inactivity)

---

**Status**: ✅ **Ready to build your chess game!**

The backend infrastructure is fully set up. You can now focus on building the chess gameplay, UI components, and integrating the Chess.com API features we set up earlier.

Good luck! ♟️🚀
