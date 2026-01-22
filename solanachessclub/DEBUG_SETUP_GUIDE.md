# 🔧 Complete Setup & Debug Guide

## 🚨 Current Issues

Based on your logs, here are the critical issues:

1. **Metro Cache** - Demo login fix not applied (base58 errors)
2. **Server Not Running** - Network request failures
3. **Missing API Keys** - CoinGecko (401), Birdeye (401)
4. **SERVER_URL undefined** - Socket connection failures
5. **Missing Token Mill Configuration**

---

## 📋 Step-by-Step Fix

### **Step 1: Clear Metro Cache & Restart**

```bash
# Kill all existing metro processes
killall node
# Or press Ctrl+C in the Metro terminal

# Clear cache and restart
npx expo start --clear

# Then press 'i' for iOS or 'a' for Android
```

This will fix the `[useWallet] Invalid publicKey` errors from the demo login.

---

### **Step 2: Fix SERVER_URL Issue**

The logs show `SERVER_URL undefined`. Update your `.env.local`:

```bash
# Make sure this line exists in .env.local
EXPO_PUBLIC_SERVER_URL=http://localhost:3000

# For server-side (also in .env.local)
SERVER_URL=http://localhost:3000
```

---

### **Step 3: Start the Backend Server**

```bash
# Navigate to server directory
cd server

# Make sure dependencies are installed
pnpm install

# Start the server
pnpm dev

# Or with npm
npm run dev
```

The server should start on `http://localhost:3000`

---

### **Step 4: Get Token Mill Credentials**

Token Mill is a custom token launchpad. Here's how to get the credentials:

#### **Option A: Deploy Your Own Token Mill Program**

1. **Clone the Token Mill repo** (if you have access):
   ```bash
   git clone <token-mill-repo>
   cd token-mill
   ```

2. **Deploy the program**:
   ```bash
   # Build the program
   anchor build
   
   # Deploy to devnet/mainnet
   anchor deploy --provider.cluster mainnet
   ```

3. **Get the Program ID**:
   ```bash
   # After deployment, copy the program ID
   # It will be in target/deploy/token_mill-keypair.json
   solana address -k target/deploy/token_mill-keypair.json
   ```

4. **Get Config PDA**:
   ```typescript
   // In your server code, calculate the PDA:
   import { PublicKey } from '@solana/web3.js';
   
   const [configPda] = PublicKey.findProgramAddressSync(
     [Buffer.from('config')],
     new PublicKey('YOUR_PROGRAM_ID')
   );
   ```

#### **Option B: Use Existing Token Mill Instance**

If someone already deployed Token Mill, ask them for:
- `TOKEN_MILL_PROGRAMID` - The deployed program address
- `TOKEN_MILL_CONFIG_PDA` - The configuration PDA
- `SWAP_AUTHORITY_KEY` - The authority keypair for swaps

#### **Option C: Skip Token Mill (For Now)**

If you don't need Token Mill immediately, you can leave these empty:

```bash
# In server/.env
TOKEN_MILL_PROGRAMID=""
TOKEN_MILL_CONFIG_PDA=""
SWAP_AUTHORITY_KEY=""
```

The app will still work with other features like:
- Pump.fun
- Raydium
- Meteora
- Jupiter Swaps
- NFTs

---

### **Step 5: Fix API Keys**

Update your `.env.local` with valid API keys:

#### **CoinGecko API Key**
```bash
# Get free API key from: https://www.coingecko.com/en/api/pricing
EXPO_PUBLIC_COINGECKO_API_KEY=your_valid_key_here
COINGECKO_API_KEY=your_valid_key_here
```

#### **Birdeye API Key**
```bash
# Get free API key from: https://docs.birdeye.so/docs/authentication-api-keys
EXPO_PUBLIC_BIRDEYE_API_KEY=your_valid_key_here
BIRDEYE_API_KEY=your_valid_key_here
```

#### **Other Required Keys**

1. **Helius** (for RPC):
   ```bash
   # Get from: https://www.helius.dev/
   EXPO_PUBLIC_HELIUS_API_KEY=your_helius_key
   EXPO_PUBLIC_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your_helius_key
   ```

2. **Tensor** (for NFTs - optional):
   ```bash
   # Get from: https://www.tensor.trade/
   EXPO_PUBLIC_TENSOR_API_KEY=your_tensor_key
   ```

---

### **Step 6: Complete Environment Setup**

Here's a minimal working `.env.local`:

```bash
# ========================================
# EXPO CLIENT VARIABLES (EXPO_PUBLIC_ prefix required)
# ========================================

# Blockchain Configuration
EXPO_PUBLIC_CLUSTER=mainnet-beta
EXPO_PUBLIC_SOLANA_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY
EXPO_PUBLIC_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY

# Wallet Providers - Privy (Optional, skip for demo mode)
EXPO_PUBLIC_PRIVY_APP_ID=
EXPO_PUBLIC_PRIVY_CLIENT_ID=

# API Services
EXPO_PUBLIC_HELIUS_API_KEY=YOUR_HELIUS_KEY
EXPO_PUBLIC_COINGECKO_API_KEY=YOUR_COINGECKO_KEY
EXPO_PUBLIC_BIRDEYE_API_KEY=YOUR_BIRDEYE_KEY

# Supabase (Already configured)
EXPO_PUBLIC_SUPABASE_URL=https://bvpysuatpnoytmcaetxl.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Backend Server
EXPO_PUBLIC_SERVER_URL=http://localhost:3000

# ========================================
# SERVER-SIDE ONLY VARIABLES
# ========================================

# Blockchain (server-side)
CLUSTER=mainnet-beta
RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY

# Token Mill (Optional - leave empty if not using)
WALLET_PRIVATE_KEY=
TOKEN_MILL_PROGRAMID=
TOKEN_MILL_CONFIG_PDA=
SWAP_AUTHORITY_KEY=

# Supabase (server-side)
SUPABASE_URL=https://bvpysuatpnoytmcaetxl.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase (Already configured in server/.env)
DATABASE_URL=postgresql://...

# Backend Server
SERVER_URL=http://localhost:3000
```

---

## 🎨 Integrating Custom UI (Sample UI)

The sample UI screens are already in your project at:
- `/src/screens/sample-ui/chat/` - Chat interface
- `/src/screens/sample-ui/Threads/` - Social feed (similar to Twitter/Threads)

### **How to Use Sample UI**

These screens are already integrated! They're part of your MainTabs navigation:

1. **Feed Screen** - The main social feed (currently active)
2. **Chat** - Direct messaging between users
3. **Search** - Token and user search
4. **Profile** - User profiles with NFTs

### **Customizing Sample UI for Chess**

You can adapt the sample UI patterns for your chess module:

```typescript
// Example: Create a chess lobby similar to chat list
// src/modules/chess/screens/GameLobbyScreen.tsx

import React from 'react';
import { View, FlatList, TouchableOpacity, Text } from 'react-native';
import { useSupabaseQuery } from '../hooks/useSupabase';

export const GameLobbyScreen = () => {
  const { data: games, loading } = useSupabaseQuery('chess_games', {
    filters: { status: 'waiting' },
    orderBy: { column: 'created_at', ascending: false },
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Text style={{ color: '#fff', fontSize: 24, padding: 20 }}>
        ♟️ Game Lobby
      </Text>
      <FlatList
        data={games}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={{ padding: 15, borderBottomWidth: 1 }}>
            <Text style={{ color: '#fff' }}>
              {item.player1_id} vs {item.player2_id || 'Waiting...'}
            </Text>
            <Text style={{ color: '#888' }}>
              Wager: {item.wager_amount} SOL
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};
```

---

## 🚀 Quick Start Checklist

- [ ] **Clear Metro cache** (`npx expo start --clear`)
- [ ] **Start backend server** (`cd server && pnpm dev`)
- [ ] **Fix SERVER_URL** in `.env.local`
- [ ] **Get valid API keys** (Helius, CoinGecko, Birdeye)
- [ ] **Use demo login** (Skip wallet auth for now)
- [ ] **Test app** - Should load without base58 errors

---

## 🔍 Verification

After following these steps, you should see:

✅ **No base58 errors** (demo login working)
✅ **Server connected** (no network request failed)
✅ **API calls working** (no 401 errors)
✅ **Socket connected** (no startsWith errors)

---

## 📚 Next Steps

Once everything is running:

1. **Set up Convex** for real-time chess
2. **Build chess board component** using chess.js
3. **Integrate wallet** when ready
4. **Create game lobby** using sample UI patterns
5. **Add AI agents** (Ralph Wiggum loop)

---

## 🆘 Still Having Issues?

Common problems and solutions:

### Problem: "Port 8081 already in use"
```bash
# Kill existing Metro process
killall node
# Or find and kill specific process
lsof -ti:8081 | xargs kill -9
```

### Problem: "Module not found: @supabase/supabase-js"
```bash
# Install in main project
pnpm add @supabase/supabase-js

# Install in server
cd server && pnpm add @supabase/supabase-js
```

### Problem: "Cannot connect to server"
```bash
# Make sure server is running on port 3000
cd server && pnpm dev

# Check if it's running
curl http://localhost:3000/api/upload/test
```

---

**Ready to build! 🚀♟️**
