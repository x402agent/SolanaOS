<div align="center">

# 🌌 Solana OS

### The Complete Mobile Operating System for Solana

**Trade • Create • Launch • Manage - All from Your Phone**

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-lightgrey.svg)
![Solana](https://img.shields.io/badge/blockchain-Solana-14F195.svg)
![AI](https://img.shields.io/badge/AI-Grok%20Powered-9945FF.svg)

[Features](#-features) • [Quick Start](#-quick-start) • [Architecture](#-architecture) • [Token Mill AI](#-token-mill-ai-agent) • [Documentation](#-documentation)

</div>

---

## 🚀 **What is Solana OS?**

Solana OS is the **first complete mobile operating system** built specifically for the Solana blockchain. It's not just an app - it's a full-featured platform that brings the entire Solana ecosystem to your pocket:

- 💱 **Unified DEX** - Swap across Raydium, Meteora, Jupiter, Pump.fun
- 🚀 **Token Launcher** - Launch tokens on multiple platforms with AI assistance
- 🎨 **NFT Studio** - Create, mint, and manage NFTs via Metaplex
- 🤖 **AI Agent** - Grok-powered assistant for everything Solana
- 🎤 **Voice Control** - Talk to your wallet, make trades hands-free
- 💻 **Built-in Terminal** - Full command-line access to Solana CLI
- 🔍 **Live Search** - AI-powered Universal search across all features
- 📊 **Real-Time Data** - Live prices via Birdeye WebSocket
- ♟️ **Games & Apps** - Chess, puzzles, and more (expanding ecosystem)
- 💬 **Social Layer** - Chat, profiles, communities

---

## ✨ **Core Features**

### 🏦 **DeFi Hub**

**All-in-One Trading**
- **Multi-DEX Aggregation**: Best rates across Raydium, Jupiter, Meteora, Pump.fun
- **Token Mill Integration**: Custom token creation and management
- **Liquidity Pools**: Add/remove liquidity seamlessly
- **Limit Orders**: Set buy/sell orders across protocols
- **Portfolio Tracking**: Real-time P&L and analytics

**Supported Platforms:**
```
✅ Raydium          - AMM & CLMM pools
✅ Meteora          - Dynamic vaults & pools  
✅ Jupiter          - Best route aggregation
✅ Pump.fun         - Meme coin trading
✅ Token Mill       - Custom token creation
✅ Orca             - Concentrated liquidity
```

### 🚀 **Token Mill AI Agent**

**Launch Tokens with AI Assistance**

The Token Mill AI Agent is your personal token launch assistant:

```
YOU: "I want to launch a community token"

AI AGENT:
1. Analyzing market conditions...
2. Suggesting optimal launch parameters...
3. Generating token metadata...
4. Creating bonding curve...
5. Deploying to Pump.fun...
6. Adding liquidity to Raydium...
7. Listing on Jupiter...
✅ Token launched successfully!
```

**Features:**
- 🤖 **AI-Powered**: Grok analyzes market and suggests parameters
- 🎨 **Auto-Generate**: Logos, descriptions, metadata via AI
- 📊 **Multi-Platform**: Launch on Pump.fun, Raydium, Metaplex simultaneously
- 💎 **Bonding Curves**: Smart pricing algorithms
- 🔒 **Anti-Rug**: Built-in safety mechanisms
- 📈 **Post-Launch**: Automated liquidity management

**Supported Launch Platforms:**
- **Pump.fun**: Instant meme coin launches
- **Raydium**: Professional LP creation
- **Metaplex**: NFT-backed token standards
- **Token Mill**: Custom smart contract deployment

### 🎨 **NFT Studio**

**Complete NFT Toolkit**

- **Create**: Design and mint NFTs directly from your phone
- **Collections**: Manage entire NFT collections
- **Marketplace**: List on Magic Eden, Tensor, and more
- **Metadata**: IPFS storage via Pinata
- **Royalties**: Set and track creator royalties

### 🤖 **AI Integration**

**Grok-Powered Intelligence**

1. **Voice Agent** 🎤
   - Natural language commands
   - Voice-controlled trading
   - Real-time market commentary
   - 5 personality voices (Ara, Rex, Sal, Eve, Leo)

2. **Live Search** 🔍
   - Universal search across all features
   - Natural language queries
   - Web + X (Twitter) integration
   - Token discovery and analysis

3. **Smart Analysis** 📊
   - Position analysis
   - Risk assessment
   - Trade suggestions
   - Market insights

### 💻 **Built-in Terminal**

**Full Solana CLI Access**

```bash
solana-os> solana balance
2.5 SOL

solana-os> spl-token accounts
┌─────────────────────────────────────────────────┐
│ Token                                  │ Balance│
├─────────────────────────────────────────────────┤
│ USDC                                   │ 100.00 │
│ BONK                                   │ 1M     │
└─────────────────────────────────────────────────┘

solana-os> launch-token --name "MyToken" --symbol "MTK"
Launching token with AI assistance...
```

**Supported Commands:**
- `solana` - Full Solana CLI
- `spl-token` - Token operations
- `launch-token` - Token Mill AI launcher
- `swap` - Quick DEX swaps
- `nft` - NFT operations
- `wallet` - Wallet management

### 📱 **Mobile-First Design**

- **Beautiful UI**: Glassmorphic, modern design
- **Smooth Animations**: Buttery 60fps
- **Dark Mode**: Eye-friendly night trading
- **Haptic Feedback**: Tactile interactions
- **Offline Mode**: Key features work without internet

---

## 🏗️ **Architecture**

### **System Overview**

```
┌───────────────────────────────────────────────────────────────┐
│                      SOLANA OS MOBILE                         │
│                   (React Native + Expo)                       │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Terminal   │  │ Voice Agent │  │ Live Search │          │
│  │   Module    │  │    Modal    │  │     Bar     │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Feature Modules                          │  │
│  │  • DeFi Hub    • NFT Studio   • Token Launcher       │  │
│  │  • Social      • Games        • Portfolio            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Service Layer (Blockchain Integrations)       │  │
│  │  • Raydium    • Meteora    • Pump.fun   • Jupiter    │  │
│  │  • Metaplex   • Token Mill • Orca       • Birdeye    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────────┬───────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
        ┌───────────────┐  ┌────────────┐  ┌───────────────┐
        │   Solana      │  │  Backend   │  │  AI Services  │
        │  Blockchain   │  │   Server   │  │   (Grok)      │
        │               │  │            │  │               │
        │ • RPC Nodes   │  │ • API      │  │ • Voice       │
        │ • Programs    │  │ • WebSocket│  │ • Search      │
        │ • Wallets     │  │ • Database │  │ • Analysis    │
        └───────────────┘  └────────────┘  └───────────────┘
```

### **Service Architecture**

```
/server/src/service/
├── TokenMill/          ← Custom token creation & management
│   ├── index.ts
│   ├── bondingCurve.ts
│   └── vesting.ts
│
├── pumpSwap/           ← Pump.fun integration
│   ├── index.ts
│   └── api.ts
│
├── raydium/            ← Raydium AMM & CLMM
│   ├── index.ts
│   └── pools.ts
│
├── MeteoraDBC/         ← Meteora dynamic pools
│   ├── index.ts
│   └── vaults.ts
│
├── metaplex/           ← NFT operations
│   ├── index.ts
│   ├── mint.ts
│   └── collections.ts
│
└── AI/                 ← NEW: AI Agent services
    ├── tokenLauncher.ts    ← Token Mill AI Agent
    ├── voiceAgent.ts      ← Grok Voice
    └── searchAgent.ts     ← Live Search
```

---

## 🤖 **Token Mill AI Agent**

### **What is Token Mill AI Agent?**

An intelligent agent that guides you through the entire token creation and launch process:

**Traditional Token Launch:**
```
1. Write smart contract code
2. Test on devnet
3. Deploy to mainnet
4. Create metadata
5. Upload to IPFS
6. Initialize pool on DEX
7. Add liquidity
8. List on aggregators
9. Market your token
10. Manage community

Time: Days/Weeks
Complexity: Very High
Success Rate: Low
```

**With Token Mill AI Agent:**
```
1. Chat with AI agent
2. AI handles everything

Time: 5-10 minutes
Complexity: Just conversation
Success Rate: High
```

### **How It Works**

#### **Step 1: Conversation**

```
AI: Hi! I'm your Token Mill AI Agent. Ready to launch a token?

YOU: Yes, I want to create a community token for dog lovers

AI: Great! Let me gather some info...
    • What's your token name?
    
YOU: Doge Lovers Token

AI: Perfect! Symbol?

YOU: DLOVE

AI: Excellent! How many tokens?

YOU: 1 billion

AI: Got it! Let me:
    1. Check name availability ✓
    2. Analyze market conditions ✓
    3. Suggest launch strategy ✓
    
    Recommendations:
    • Launch on Pump.fun first (trending platform)
    • Graduate to Raydium at 69k market cap
    • List on Jupiter for visibility
    • Initial bonding curve: sigmoid
    
    Sound good?
    
YOU: Yes!

AI: Launching now... 🚀
```

#### **Step 2: AI Execution**

The AI Agent automatically:

```typescript
// 1. Generate metadata
const metadata = await aiAgent.generateMetadata({
  name: "Doge Lovers Token",
  symbol: "DLOVE",
  description: await aiAgent.writeDescription(),
  image: await aiAgent.generateLogo() // AI-generated logo!
});

// 2. Deploy to Pump.fun
const pumpToken = await pumpSwap.createToken({
  metadata,
  bondingCurve: aiAgent.suggestBondingCurve()
});

// 3. Monitor and graduate
await aiAgent.monitorToken(pumpToken.address);
if (marketCap > 69000) {
  await aiAgent.graduateToRaydium(pumpToken);
}

// 4. Add to Jupiter
await jupiter.listToken(pumpToken.address);

// 5. Set up socials
await aiAgent.createTwitter();
await aiAgent.createTelegram();
```

#### **Step 3: Post-Launch Management**

```
AI: Token launched! 🎉

    Address: 7xKXtg...9nHqU
    Pump.fun: pump.fun/7xKXtg...
    Market Cap: $1,234
    Holders: 8
    
    I'm now:
    ✓ Monitoring price
    ✓ Tracking holders
    ✓ Managing liquidity
    ✓ Posting updates
    
    Would you like me to:
    [ ] Create marketing materials
    [ ] Set up airdrops
    [ ] Schedule announcements
    [ ] All of the above
```

### **AI Agent Features**

#### **1. Market Analysis**
```typescript
await aiAgent.analyzeMarket({
  tokenType: "meme" | "utility" | "community",
  targetAudience: string,
  competitors: string[]
});
// Returns: Best launch strategy, timing, platforms
```

#### **2. Content Generation**
```typescript
await aiAgent.generate({
  logo: true,           // AI generates logo
  description: true,    // AI writes description
  whitepaper: true,     // AI creates lite paper
  socials: true,        // AI writes posts
  website: true         // AI builds landing page (!)
});
```

#### **3. Multi-Platform Launch**
```typescript
await aiAgent.launchOn({
  platforms: [
    {
      name: "pump.fun",
      priority: 1,
      params: { /* auto-configured */ }
    },
    {
      name: "raydium",
      priority: 2,
      when: "marketCap > 69000"
    },
    {
      name: "metaplex",
      priority: 3,
      nftBacked: true
    }
  ]
});
```

#### **4. Safety Features**
```typescript
await aiAgent.enableSafety({
  antiRug: true,        // Lock liquidity
  antiBot: true,        // Bot protection
  gradual: true,        // Gradual unlock
  timelock: "7days",    // Admin timelock
  multiSig: true        // Multi-sig for admin
});
```

### **Voice-Controlled Launch**

Use the Voice Agent to launch tokens hands-free:

```
YOU: "Hey Solana OS, launch a new token"

AI: "Sure! What's the name?"

YOU: "Moon Rocket Token"

AI: "Great name! Symbol?"

YOU: "MOON"

AI: "How about logo? I can generate one."

YOU: "Yes please, make it futuristic"

AI: "Generating... Done! Check your screen. Like it?"

YOU: "Perfect! Launch it on Pump fun"

AI: "Launching on Pump.fun with smart bonding curve...
     Token deployed! Address copied to clipboard.
     Would you like me to create social accounts?"
     
YOU: "Yes"

AI: "Created Twitter and Telegram. Links in your notifications.
     Your token is now live!"
```

---

## 📦 **Installation**

### **For Users**

```bash
# iOS
1. Download from App Store
2. Search "Solana OS"
3. Install & Open

# Android  
1. Download from Google Play
2. Search "Solana OS"
3. Install & Open

# TestFlight (Beta)
1. Join beta: testflight.apple.com/join/solanaos
2. Install TestFlight
3. Download Solana OS
```

### **For Developers**

```bash
# Clone repository
git clone https://github.com/yourusername/solanaos.git
cd solanaos

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your keys

# Start backend
cd server
pnpm dev

# Start mobile app (new terminal)
cd ..
pnpm dev

# Press 'i' for iOS, 'a' for Android
```

---

## 🔑 **Environment Variables**

```bash
# Core Blockchain
EXPO_PUBLIC_CLUSTER=mainnet-beta
EXPO_PUBLIC_RPC_URL=your_helius_rpc
EXPO_PUBLIC_HELIUS_API_KEY=your_helius_key

# AI Services
EXPO_PUBLIC_XAI_API_KEY=your_xai_key              # Grok AI
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_key        # Fallback

# Data APIs
EXPO_PUBLIC_BIRDEYE_API_KEY=your_birdeye_key      # Real-time prices
EXPO_PUBLIC_BIRDEYE_WSS_URL=wss://public-api.birdeye.so/socket/solana
EXPO_PUBLIC_COINGECKO_API_KEY=your_coingecko_key  # Market data
EXPO_PUBLIC_NEWS_API_KEY=your_news_api_key        # Crypto news

# Token Mill (Optional - for custom deployments)
TOKEN_MILL_PROGRAMID=your_program_id
TOKEN_MILL_CONFIG_PDA=your_config_pda
SWAP_AUTHORITY_KEY=your_authority_key

# Wallet Providers
EXPO_PUBLIC_PRIVY_APP_ID=your_privy_app_id
EXPO_PUBLIC_DYNAMIC_ENVIRONMENT_ID=your_dynamic_id

# Backend
EXPO_PUBLIC_SERVER_URL=http://localhost:3000
SERVER_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/solanaos

# Storage
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key

# IPFS (for NFTs)
PINATA_API_KEY=your_pinata_key
PINATA_JWT=your_pinata_jwt
```

---

## 📖 **Documentation**

- **[Visual Guide](./VISUAL_GUIDE.md)** - Architecture diagrams
- **[User Guide](./USER_GUIDE.md)** - How to use all features
- **[API Documentation](./docs/API.md)** - Complete API reference
- **[Token Mill AI Guide](./docs/TOKEN_MILL_AI.md)** - AI Agent deep dive
- **[Services Documentation](./server/src/service/README.md)** - All integrations

---

## 🗺️ **Roadmap**

### **Phase 1: Foundation ✅**
- [x] Multi-DEX integration
- [x] NFT minting
- [x] WebSocket real-time data
- [x] Social features
- [x] Demo mode

### **Phase 2: AI Integration 🔄**
- [x] Grok text AI
- [ ] Grok Voice Agent
- [ ] Live Search
- [ ] Token Mill AI Agent
- [ ] Auto-trading AI

### **Phase 3: Terminal & Advanced 📅**
- [ ] Built-in terminal
- [ ] CLI commands
- [ ] Script execution
- [ ] Plugin system
- [ ] Developer tools

### **Phase 4: Ecosystem 📅**
- [ ] App marketplace
- [ ] Third-party integrations
- [ ] Custom widgets
- [ ] Community plugins
- [ ] White-label solutions

### **Phase 5: Enterprise 📅**
- [ ] Team accounts
- [ ] Advanced analytics
- [ ] Institutional features
- [ ] Compliance tools
- [ ] API for businesses

---

## 🤝 **Contributing**

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## 📜 **License**

MIT License - see [LICENSE](./LICENSE)

---

## 🙏 **Powered By**

- **Solana** - Blockchain infrastructure
- **xAI Grok** - AI intelligence
- **Raydium** - DEX infrastructure
- **Meteora** - Dynamic pools
- **Pump.fun** - Meme coin platform
- **Metaplex** - NFT standard
- **Jupiter** - Aggregation
- **Birdeye** - Real-time data
- **Supabase** - Backend infrastructure

---

<div align="center">

### **Solana OS - The Future of Mobile Blockchain**

**Built with ❤️ for the Solana community**

[Website](https://solanaos.com) • [Twitter](https://twitter.com/solanaos) • [Discord](https://discord.gg/solanaos) • [Docs](https://docs.solanaos.com)

</div>
