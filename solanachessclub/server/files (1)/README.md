# ♟️ Solana Chess - Full Stack Platform

Play real-time chess with Solana wallet integration, leaderboards, lobby chat, and AI agents powered by the Ralph Wiggum recursive learning loop.

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ♜ ♞ ♝ ♛ ♚ ♝ ♞ ♜       SOLANA CHESS PLATFORM                               ║
║   ♟ ♟ ♟ ♟ ♟ ♟ ♟ ♟                                                            ║
║                          🔗 Wallet Connection     💰 SOL Wagering            ║
║   · · · · · · · ·        🏆 Leaderboards         💬 Real-time Chat          ║
║   · · · · · · · ·        🤖 AI Agents            📊 LangSmith Tracing       ║
║                          🔄 Ralph Wiggum Loop    ⚡ Convex Real-time        ║
║   ♙ ♙ ♙ ♙ ♙ ♙ ♙ ♙                                                            ║
║   ♖ ♘ ♗ ♕ ♔ ♗ ♘ ♖       Built by 8bit Labs                                 ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## 🚀 Features

### 🎮 Core Chess Platform
- **Real-time Multiplayer** - Play against other players with instant moves
- **Wallet Integration** - Connect Phantom, Solflare, or any Solana wallet
- **SOL Wagering** - Optional wagers with secure escrow
- **Multiple Time Controls** - 3min, 5min, 10min, 15min games

### 🏆 Competitive Features
- **Global Leaderboard** - Real-time rankings by rating, wins, or SOL won
- **Daily/Weekly/Monthly** - Period-based leaderboards
- **ELO Rating System** - Fair matchmaking based on skill
- **Win Streaks** - Track your best performances

### 💬 Social Features
- **Lobby Chat** - Real-time chat powered by Convex
- **Online Players** - See who's playing
- **Challenges** - Challenge specific players directly
- **Game Chat** - In-game communication

### 🤖 AI Agents (Ralph Wiggum Loop)
- **Self-Improving Agents** - AI that learns from failures iteratively
- **LangChain Integration** - Structured AI reasoning for chess
- **LangSmith Tracing** - Full observability of agent decisions
- **Multi-Agent Tournaments** - Agents compete to improve

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Lobby   │ │  Game    │ │ Leader-  │ │  Chat    │           │
│  │  Screen  │ │  Board   │ │  board   │ │  Panel   │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       │            │            │            │                   │
│       └────────────┴────────────┴────────────┘                   │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│                      Convex (Real-time DB)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Players  │ │  Games   │ │ Lobby    │ │ Leader-  │            │
│  │          │ │          │ │  Chat    │ │  board   │            │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
└───────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│                    AI Agent Layer                                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Ralph Wiggum Loop Controller                   │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │  Iteration 1 → Failure → Analysis → Improvement →    │  │  │
│  │  │  Iteration 2 → Failure → Analysis → Improvement →    │  │  │
│  │  │  ...                                                  │  │  │
│  │  │  Iteration N → SUCCESS! ✅                            │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            │                                      │
│  ┌─────────────────────────┴─────────────────────────────────┐   │
│  │                    LangChain Chess Agent                   │   │
│  │  • Move Selection    • Position Evaluation                 │   │
│  │  • Opening Book      • Endgame Tables                      │   │
│  └───────────────────────────────────────────────────────────┘   │
│                            │                                      │
│  ┌─────────────────────────┴─────────────────────────────────┐   │
│  │                   LangSmith Tracing                        │   │
│  │  • Full observability • Performance metrics                │   │
│  │  • Error tracking     • Improvement history                │   │
│  └───────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│                       Solana Blockchain                           │
│  • Wallet Authentication  • Wager Escrow  • Payouts              │
└───────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
solana-chess-full/
├── app/
│   └── SolanaChessFullApp.tsx    # Main React application
├── convex/
│   ├── schema.ts                  # Database schema
│   ├── players.ts                 # Player & leaderboard functions
│   ├── games.ts                   # Game management functions
│   └── chat.ts                    # Chat & challenges functions
├── agents/
│   ├── ralph-wiggum-loop.ts      # Iterative learning loop
│   └── langchain-chess-agent.ts  # LangChain chess AI
├── package.json
└── README.md
```

## 🛠️ Installation

### Prerequisites
- Node.js 18+
- Convex account
- Anthropic API key (for AI agents)
- LangSmith account (optional, for tracing)

### Setup

```bash
# Install dependencies
npm install

# Initialize Convex
npx convex dev

# Start development server
npm run dev
```

### Environment Variables

```env
# Convex
CONVEX_DEPLOYMENT=your-deployment

# AI Agents
ANTHROPIC_API_KEY=sk-ant-...

# LangSmith (optional)
LANGCHAIN_API_KEY=ls__...
LANGCHAIN_PROJECT=solana-chess-agents
LANGCHAIN_TRACING_V2=true
```

## 🤖 Ralph Wiggum Loop

The Ralph Wiggum methodology is an iterative, failure-driven refinement approach for AI agents. Named after the persistent Simpsons character, it embodies the philosophy: **"Me fail chess? That's unpossible!"**

### How It Works

```typescript
import { RalphWiggumChessLoop } from './agents/ralph-wiggum-loop';

const loop = new RalphWiggumChessLoop({
  agentId: 'chess-agent-001',
  maxIterations: 20,
  targetMetrics: {
    winRate: 60,        // Win 60% of games
    avgMoveTime: 200,   // Max 200ms per move
    maxBlunders: 3,     // At most 3 blunders per game
    minAccuracy: 70,    // 70% move accuracy
  },
  verbose: true,
});

const result = await loop.run();
// Agent keeps iterating until it meets ALL targets
```

### The Loop Cycle

1. **Train** - Play training games
2. **Evaluate** - Measure against success criteria
3. **Fail?** - If not meeting targets, continue
4. **Analyze** - Identify what went wrong
5. **Improve** - Claude suggests specific improvements
6. **Apply** - Implement the improvement
7. **Repeat** - Until success or max iterations

### Success Criteria

Unlike traditional ML training that optimizes a loss function, the Ralph Wiggum loop has **explicit success criteria** that must ALL be met:

```typescript
targetMetrics: {
  winRate: number,      // Minimum win percentage
  avgMoveTime: number,  // Maximum milliseconds per move
  maxBlunders: number,  // Maximum mistakes per game
  minAccuracy: number,  // Minimum move accuracy %
}
```

### LangSmith Integration

Every iteration is traced in LangSmith for full observability:

```
ralph-loop-chess-agent-001
├── iteration-1
│   ├── metrics: { winRate: 30, accuracy: 45 }
│   └── change: "Add opening book for first 5 moves"
├── iteration-2
│   ├── metrics: { winRate: 42, accuracy: 58 }
│   └── change: "Increase search depth for tactical positions"
├── iteration-3
│   ├── metrics: { winRate: 55, accuracy: 67 }
│   └── change: "Add endgame tablebases"
└── iteration-4
    ├── metrics: { winRate: 62, accuracy: 73 }
    └── status: SUCCESS ✅
```

## 💾 Convex Database

### Schema

```typescript
// Players
{
  walletAddress: string,
  username: string,
  rating: number,
  wins: number,
  losses: number,
  draws: number,
  winStreak: number,
  bestWinStreak: number,
  totalWagered: number,
  totalWon: number,
  isOnline: boolean,
}

// Games
{
  code: string,           // 6-char game code
  status: "waiting" | "playing" | "finished",
  whitePlayerId: Id<"players">,
  blackPlayerId: Id<"players">,
  fen: string,           // Current position
  pgn: string,           // Move history
  turn: "w" | "b",
  winner?: "white" | "black" | "draw",
  timeControl: number,
  wagerAmount?: number,
}

// Lobby Chat
{
  playerId: Id<"players">,
  username: string,
  message: string,
  timestamp: number,
  type: "message" | "system" | "challenge",
}
```

### Real-time Queries

```typescript
// Get leaderboard with live updates
const leaderboard = useQuery(api.players.getLeaderboard, { 
  period: 'allTime',
  limit: 50 
});

// Get lobby messages (auto-updates)
const messages = useQuery(api.chat.getLobbyMessages, { 
  limit: 50 
});

// Get available games
const games = useQuery(api.games.getAvailableGames);
```

## 🎮 Game Flow

```
┌─────────────────┐
│ Connect Wallet  │
└────────┬────────┘
         ▼
┌─────────────────┐     ┌─────────────────┐
│     Lobby       │────▶│   Leaderboard   │
└────────┬────────┘     └─────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ Create │ │  Join  │
│  Game  │ │  Game  │
└───┬────┘ └───┬────┘
    │          │
    └────┬─────┘
         ▼
┌─────────────────┐
│  Waiting Room   │
│  (Share Code)   │
└────────┬────────┘
         ▼
┌─────────────────┐
│   Game Board    │
│  (Real-time)    │
└────────┬────────┘
         ▼
┌─────────────────┐
│   Game Over     │
│ (Rating Update) │
└─────────────────┘
```

## 🏆 Leaderboard

### Ranking Criteria

| Period | Calculation |
|--------|-------------|
| All Time | Cumulative rating |
| Monthly | Games in current month |
| Weekly | Games in current week |
| Daily | Games today |

### Sorting Options

- **Rating** - ELO rating (default)
- **Wins** - Total victories
- **Win Streak** - Best consecutive wins
- **SOL Won** - Total SOL earned

## 💰 Wagering System

```
Player A creates game with 1 SOL wager
         │
         ▼
Player B joins, both deposit 1 SOL
         │
         ▼
Escrow holds 2 SOL total
         │
         ▼
    Game plays out
         │
    ┌────┴────┐
    ▼         ▼
  Winner    Loser
  gets       gets
1.95 SOL   0 SOL
(2.5% fee)
```

## 🔧 Configuration

### Time Controls

```typescript
const TIME_CONTROLS = {
  bullet: 60,      // 1 minute
  blitz3: 180,     // 3 minutes
  blitz5: 300,     // 5 minutes
  rapid: 600,      // 10 minutes
  classical: 900,  // 15 minutes
};
```

### AI Agent Styles

```typescript
type AgentStyle = 'aggressive' | 'defensive' | 'balanced';

// Aggressive: Prioritizes attacks and sacrifices
// Defensive: Prioritizes safety and solid play
// Balanced: Objective best moves
```

## 📊 Monitoring

### LangSmith Dashboard

Track AI agent performance:
- Win rates over time
- Average move quality
- Blunder frequency
- Improvement trajectory

### Convex Dashboard

Monitor real-time data:
- Active games
- Online players
- Chat activity
- Database operations

## 🔜 Roadmap

- [ ] Tournament system
- [ ] Spectator mode
- [ ] Opening explorer
- [ ] Game analysis
- [ ] Mobile app
- [ ] Multi-chain support

## 📜 License

MIT License - Built by 8bit Labs

---

**Ready to play? Connect your wallet and make your move! ♟️**
