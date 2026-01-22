# 📊 Solana Chess Club - Visual Guide

**A comprehensive visual overview of the architecture, data flow, and user experience**

---

## 🎯 Table of Contents

1. [System Architecture](#system-architecture)
2. [Data Flow Diagrams](#data-flow-diagrams)
3. [User Journeys](#user-journeys)
4. [Component Hierarchy](#component-hierarchy)
5. [Database Schema](#database-schema)
6. [API Architecture](#api-architecture)

---

## 🏗️ System Architecture

### **High-Level Overview**

```
┌─────────────────────────────────────────────────────────────────┐
│                      MOBILE APPLICATION                          │
│                     (React Native + Expo)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Chess UI   │  │  Voice Agent │  │ Live Search  │          │
│  │  Components  │  │     Modal    │  │     Bar      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Redux Store (State Management)               │  │
│  │  • Auth  • Chess Games  • Wallet  • AI Responses        │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌───────────────┐  ┌────────────┐  ┌──────────────┐
│  WebSocket    │  │   REST     │  │   Solana     │
│  (Socket.io)  │  │    API     │  │  Blockchain  │
│               │  │            │  │              │
│ • Multiplayer │  │ • Profiles │  │ • Wagering   │
│ • Chat        │  │ • Assets   │  │ • NFTs       │
│ • Real-time   │  │ • Upload   │  │ • Payments   │
└───────────────┘  └────────────┘  └──────────────┘
        │                │                │
        └────────────────┼────────────────┘
                         ▼
              ┌─────────────────────┐
              │   Backend Server    │
              │   (Express.js)      │
              └─────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  PostgreSQL  │  │   Supabase   │  │  External    │
│  (Database)  │  │   Storage    │  │    APIs      │
│              │  │              │  │              │
│ • Users      │  │ • Avatars    │  │ • Grok AI    │
│ • Games      │  │ • NFTs       │  │ • Birdeye    │
│ • Moves      │  │ • Assets     │  │ • Chess.com  │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 🔄 Data Flow Diagrams

### **1. Game Start Flow**

```
USER                   MOBILE APP              SERVER              BLOCKCHAIN
  │                        │                     │                      │
  │ 1. Create Game         │                     │                      │
  ├───────────────────────>│                     │                      │
  │                        │ 2. Request Wager   │                      │
  │                        │────────────────────>│                      │
  │                        │                     │ 3. Init Smart       │
  │                        │                     │    Contract         │
  │                        │                     ├────────────────────>│
  │                        │                     │                      │
  │                        │                     │ 4. Contract Address │
  │                        │                     │<────────────────────│
  │                        │ 5. Game Created    │                      │
  │                        │<────────────────────│                      │
  │ 6. Show Game           │                     │                      │
  │<───────────────────────│                     │                      │
  │                        │                     │                      │
  │ 7. Deposit SOL         │                     │                      │
  ├───────────────────────>│                     │                      │
  │                        │ 8. Send Transaction│                      │
  │                        │────────────────────────────────────────>│
  │                        │                     │                      │
  │                        │ 9. Confirm Deposit  │                     │
  │                        │<────────────────────────────────────────│
  │ 10. Game Ready         │                     │                      │
  │<───────────────────────│                     │                      │
```

### **2. Move Execution Flow**

```
PLAYER A              SERVER               PLAYER B              AI ANALYSIS
   │                    │                      │                      │
   │ 1. Make Move       │                      │                      │
   ├───────────────────>│                      │                      │
   │                    │ 2. Validate Move    │                      │
   │                    │ (Chess.js)          │                      │
   │                    │                      │                      │
   │                    │ 3. Broadcast Move    │                      │
   │                    ├─────────────────────>│                      │
   │                    │                      │ 4. Update Board     │
   │                    │                      │<────────────────────│
   │                    │                      │                      │
   │                    │ 5. Request Analysis  │                      │
   │                    ├──────────────────────────────────────────>│
   │                    │                      │                      │
   │                    │ 6. AI Commentary     │                      │
   │                    │<──────────────────────────────────────────│
   │ 7. Show Analysis   │                      │                      │
   │<───────────────────│                      │                      │
   │                    │ 8. Show Analysis     │                      │
   │                    ├─────────────────────>│                      │
```

### **3. Voice Agent Flow**

```
USER                MOBILE APP           GROK VOICE API         SERVER
  │                     │                      │                   │
  │ 1. Press Voice      │                      │                   │
  │     Button          │                      │                   │
  ├────────────────────>│                      │                   │
  │                     │ 2. Request Token     │                   │
  │                     ├──────────────────────────────────────────>│
  │                     │                      │                   │
  │                     │ 3. Ephemeral Token   │                   │
  │                     │<──────────────────────────────────────────│
  │                     │                      │                   │
  │                     │ 4. WebSocket Connect │                   │
  │                     ├─────────────────────>│                   │
  │                     │                      │                   │
  │                     │ 5. Session Config    │                   │
  │                     │    (Voice: Ara,      │                   │
  │                     │     Audio: PCM16)    │                   │
  │                     ├─────────────────────>│                   │
  │                     │                      │                   │
  │ 6. Speak           │                      │                   │
  │ "What's the best   │                      │                   │
  │ move here?"        │                      │                   │
  ├────────────────────>│                      │                   │
  │                     │ 7. Audio Data        │                   │
  │                     │    (Base64-encoded   │                   │
  │                     │     PCM16)           │                   │
  │                     ├─────────────────────>│                   │
  │                     │                      │                   │
  │                     │ 8. AI Response       │                   │
  │                     │    (Audio + Text)    │                   │
  │                     │<─────────────────────│                   │
  │ 9. Hear Response    │                      │                   │
  │<────────────────────│                      │                   │
```

---

## 👥 User Journeys

### **New User Onboarding**

```
┌────────────────────────────────────────────────────────────────┐
│ STEP 1: Welcome Screen                                        │
│ ┌────────────────────────────────────────────────────────────┐│
│ │                                                            ││
│ │           ♟️  Welcome to Solana Chess Club!               ││
│ │                                                            ││
│ │   Play chess. Wager SOL. Win big.                         ││
│ │                                                            ││
│ │   [Try Demo Mode]    [Connect Wallet]                     ││
│ │                                                            ││
│ └────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────┐
│ STEP 2: Wallet Connection (if chosen)                         │
│ ┌────────────────────────────────────────────────────────────┐│
│ │  Choose Your Wallet:                                       ││
│ │                                                            ││
│ │  [Phantom]  [Solflare]  [Privy]  [Dynamic]               ││
│ │                                                            ││
│ │  Or use:                                                   ││
│ │  [Email Login (Privy)]  [Social Login (Dynamic)]         ││
│ └────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────┐
│ STEP 3: Interactive Tutorial                                  │
│ ┌────────────────────────────────────────────────────────────┐│
│ │  1/5: How to Play                                          ││
│ │  ───────────────                                           ││
│ │                                                            ││
│ │  • Tap a piece to select it                               ││
│ │  • Tap a highlighted square to move                       ││
│ │  • Checkmate your opponent to win!                        ││
│ │                                                            ││
│ │  [Try It!]  (interactive board)                           ││
│ │                          [Next →]                          ││
│ └────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────┐
│ STEP 4: Home Screen                                           │
│ ┌────────────────────────────────────────────────────────────┐│
│ │  🔍 [Live Search Bar]                                      ││
│ │                                                            ││
│ │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    ││
│ │  │ Quick Match  │  │  Create Game │  │   Puzzles    │    ││
│ │  │              │  │   (Wager)    │  │              │    ││
│ │  └──────────────┘  └──────────────┘  └──────────────┘    ││
│ │                                                            ││
│ │  Active Games:                                             ││
│ │  • vs @player123 (Your turn!)                             ││
│ │                                                            ││
│ │                          [🎤] ← Voice Agent Button         ││
│ └────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────┘
```

### **Game Play Journey**

```
START GAME → MAKE MOVES → GET AI HINTS → CHECKMATE → GET PAID
     │            │              │             │          │
     ▼            ▼              ▼             ▼          ▼
  [Setup]    [Chess UI]   [Voice Agent]   [Victory]  [Wallet]
```

---

## 🧩 Component Hierarchy

### **Main App Structure**

```
<App>
  └── <NavigationContainer>
      ├── <AuthStack> (if not logged in)
      │   ├── <IntroScreen>
      │   ├── <LoginScreen>
      │   └── <OnboardingTutorial>
      │
      └── <MainTabs> (if logged in)
          ├── <HomeTab>
          │   ├── <LiveSearchBar>
          │   ├── <QuickActions>
          │   ├── <ActiveGames>
          │   └── <VoiceAgentButton> (floating)
          │
          ├── <GamesTab>
          │   ├── <GamesList>
          │   └── <CreateGameModal>
          │
          ├── <ChessTab>
          │   ├── <ChessBoard>
          │   ├── <MoveHistory>
          │   ├── <GameControls>
          │   └── <AIAnalysis>
          │
          ├── <LeaderboardTab>
          │   ├── <TopPlayers>
          │   └── <YourRank>
          │
          └── <ProfileTab>
              ├── <UserProfile>
              ├── <NFTCollection>
              ├── <WalletBalance>
              └── <Settings>

<Modals>
  ├── <VoiceAgentModal>
  │   ├── <AudioVisualizer>
  │   ├── <Transcript>
  │   └── <VoiceControls>
  │
  ├── <SearchResultsModal>
  │   ├── <SearchBar>
  │   └── <Results>
  │
  └── <WagerModal>
      ├── <Amount Input>
      └── <ConfirmButton>
```

---

## 🗄️ Database Schema

### **PostgreSQL Tables**

```sql
┌─────────────────────────────────────────────────────────────┐
│ USERS                                                       │
├─────────────────────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY                            │
│ wallet_address  TEXT UNIQUE NOT NULL                        │
│ username        TEXT UNIQUE                                 │
│ avatar_url      TEXT                                        │
│ elo_rating      INTEGER DEFAULT 1200                        │
│ games_played    INTEGER DEFAULT 0                           │
│ games_won       INTEGER DEFAULT 0                           │
│ created_at      TIMESTAMPTZ DEFAULT NOW()                   │
│ updated_at      TIMESTAMPTZ DEFAULT NOW()                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ CHESS_GAMES                                                 │
├─────────────────────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY                            │
│ player1_id      UUID → USERS(id)                           │
│ player2_id      UUID → USERS(id)                           │
│ wager_amount    NUMERIC(20, 9)                              │
│ game_state      JSONB NOT NULL                              │
│ status          TEXT DEFAULT 'pending'                      │
│ winner_id       UUID → USERS(id)                           │
│ time_control    TEXT                                        │
│ started_at      TIMESTAMPTZ                                 │
│ completed_at    TIMESTAMPTZ                                 │
│ created_at      TIMESTAMPTZ DEFAULT NOW()                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ GAME_MOVES                                                  │
├─────────────────────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY                            │
│ game_id         UUID → CHESS_GAMES(id) ON DELETE CASCADE   │
│ player_id       UUID → USERS(id)                           │
│ move_san        TEXT NOT NULL                               │
│ move_number     INTEGER NOT NULL                            │
│ fen             TEXT NOT NULL                               │
│ time_taken_ms   INTEGER                                     │
│ timestamp       TIMESTAMPTZ DEFAULT NOW()                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ AI_ANALYSES                                                 │
├─────────────────────────────────────────────────────────────┤
│ id              UUID PRIMARY KEY                            │
│ move_id         UUID → GAME_MOVES(id)                      │
│ analysis        JSONB                                       │
│ best_move       TEXT                                        │
│ evaluation      NUMERIC                                     │
│ commentary      TEXT                                        │
│ created_at      TIMESTAMPTZ DEFAULT NOW()                   │
└─────────────────────────────────────────────────────────────┘
```

### **Relationships**

```
USERS (1) ──< (N) CHESS_GAMES
              │
              └──< (N) GAME_MOVES
                        │
                        └──< (1) AI_ANALYSES
```

---

## 📡 API Architecture

### **REST Endpoints**

```
┌───────────────────────────────────────────────────────────────┐
│ Authentication & User Management                              │
├───────────────────────────────────────────────────────────────┤
│ POST   /api/auth/login           - Login with wallet         │
│ POST   /api/auth/demo            - Demo login                │
│ GET    /api/users/profile        - Get user profile          │
│ PUT    /api/users/profile        - Update profile            │
│ GET    /api/users/:id            - Get user by ID            │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│ Chess Games                                                    │
├───────────────────────────────────────────────────────────────┤
│ GET    /api/games                - List games                 │
│ POST   /api/games                - Create game                │
│ GET    /api/games/:id            - Get game details           │
│ POST   /api/games/:id/move       - Submit move               │
│ POST   /api/games/:id/resign     - Resign game               │
│ GET    /api/games/:id/moves      - Get move history          │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│ File Uploads (Supabase)                                       │
├───────────────────────────────────────────────────────────────┤
│ POST   /api/upload/avatar        - Upload avatar             │
│ POST   /api/upload/nft           - Upload NFT image          │
│ DELETE /api/upload/:bucket/:path - Delete file               │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│ AI & Analysis                                                 │
├───────────────────────────────────────────────────────────────┤
│ POST   /api/ai/analyze           - Analyze position          │
│ POST   /api/ai/suggest           - Get move suggestion       │
│ POST   /api/ai/voice/session     - Get voice token           │
└───────────────────────────────────────────────────────────────┘
```

### **WebSocket Events**

```
┌───────────────────────────────────────────────────────────────┐
│ Client → Server Events                                        │
├───────────────────────────────────────────────────────────────┤
│ 'join_game'          { gameId }                              │
│ 'make_move'          { gameId, move }                        │
│ 'send_message'       { gameId, message }                     │
│ 'user_status'        { status: 'online' | 'offline' }       │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│ Server → Client Events                                        │
├───────────────────────────────────────────────────────────────┤
│ 'game_update'        { game }                                │
│ 'move_made'          { move, player }                        │
│ 'game_over'          { winner, reason }                      │
│ 'opponent_resigned'  { }                                     │
│ 'new_message'        { message }                             │
│ 'user_status_change' { userId, status }                     │
└───────────────────────────────────────────────────────────────┘
```

---

## 🎨 UI/UX Flow

### **Color Palette**

```
Primary Colors:
  • Chess Black: #1a1a1a
  • Chess White: #f5f5f5
  • Solana Green: #14F195
  • Purple Accent: #9945FF

Semantic Colors:
  • Success: #10B981
  • Error: #EF4444
  • Warning: #F59E0B
  • Info: #3B82F6

Gradients:
  • Hero: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
  • Card: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)
```

### **Typography**

```
Headings:
  • H1: 32px, Bold, Inter
  • H2: 24px, SemiBold, Inter
  • H3: 20px, Medium, Inter

Body:
  • Body: 16px, Regular, Inter
  • Small: 14px, Regular, Inter
  • Caption: 12px, Regular, Inter

Special:
  • Code: 14px, Monospace, Fira Code
```

---

## 📊 Performance Metrics

### **Target Metrics**

```
Time to Interactive (TTI):        < 3s
First Contentful Paint (FCP):     < 1.5s
Largest Contentful Paint (LCP):   < 2.5s
Cumulative Layout Shift (CLS):    < 0.1
WebSocket Latency:                < 100ms
Move Submission Time:             < 500ms
```

---

**This visual guide provides a complete overview of the Solana Chess Club architecture and flows. Use it as a reference when developing new features or debugging issues.**

For more detailed documentation, see:
- [README.md](./README.md) - Main documentation
- [USER_GUIDE.md](./USER_GUIDE.md) - User-facing guide
- [API Documentation](./docs/API.md) - Complete API reference
