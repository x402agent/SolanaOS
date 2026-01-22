# 🚀 Solana App Kit - Backend Server

<div align="center">

![Solana](https://img.shields.io/badge/Solana-black?style=for-the-badge&logo=solana)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=socketdotio&logoColor=white)

**A comprehensive backend server for the Solana App Kit, providing token management, social features, real-time messaging, and various API endpoints for interacting with the Solana blockchain.**

</div>

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Setup](#-environment-setup)
- [Development](#-development)
- [Deployment](#-deployment)
- [Project Structure](#-project-structure)
- [API Endpoints](#-api-endpoints)
- [Core Services](#-core-services)
- [Database Schema](#-database-schema)
- [WebSocket Implementation](#-websocket-implementation)
- [Contributing](#-contributing)
- [License](#-license)
- [Support](#-support)

## 🔍 Overview

This backend server is built with Express.js and TypeScript, offering a robust API for Solana blockchain interactions, social features, real-time messaging, and comprehensive token management. It serves as the core backend for the Solana App Kit, providing modular, reusable, and easily customizable components for developers.

## ✨ Features

| Category | Features |
|----------|----------|
| **Token Management** | • Token creation via TokenMill<br>• Market creation and management<br>• Bonding curve configuration<br>• Token swapping (buy/sell)<br>• Staking and vesting mechanisms<br>• Market graduation and funding |
| **DEX Integrations** | • Jupiter DEX swapping<br>• Raydium swap integration<br>• Meteora DBC (Dynamic Bonding Curve)<br>• PumpFun token launches<br>• Cross-platform swap quotes |
| **Social Features** | • Thread creation and management<br>• User profiles and authentication<br>• Follow system and user interactions<br>• Image upload and management<br>• User reactions and engagement |
| **Real-time Messaging** | • WebSocket-based chat system<br>• Global chat functionality<br>• Real-time message delivery<br>• Chat image support |
| **Authentication** | • Turnkey API wallet management<br>• Admin authentication system<br>• Secure wallet operations |
| **Storage & Media** | • IPFS integration via Pinata<br>• Google Cloud Storage<br>• Image processing and optimization |
| **Notifications** | • Expo push notifications<br>• Real-time notification delivery |
| **NFT Operations** | • NFT minting and management<br>• Metadata handling |
| **Aura System** | • Aura-based interactions<br>• User reputation management |

## 🏗️ Architecture

The server follows a modular, service-oriented architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Controllers   │◄──►│    Services     │◄──►│   External APIs │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                        ▲                        ▲
         │                        │                        │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Routes      │    │   Utilities     │    │   Blockchain    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                        ▲                        ▲
         │                        │                        │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Express App    │◄──►│   Database      │    │   WebSockets    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📦 Prerequisites

| Requirement | Version/Details |
|-------------|-----------------|
| Node.js | v16 or higher |
| pnpm | Latest version |
| Solana Wallet | With SOL for transactions |
| PostgreSQL | Latest version |
| Google Cloud Storage | Account with bucket setup |
| Pinata | Account for IPFS storage |
| Turnkey | API access for wallet management |

## 🛠️ Installation

1. **Clone the repository:**

```bash
git clone https://github.com/SendArcade/solana-app-kit.git
cd solana-app-kit/server
```

2. **Install dependencies:**

```bash
pnpm install
```

## 🔐 Environment Setup

1. **Create your environment file:**

```bash
cp .env.example .env
```

2. **Configure the following parameters in your `.env` file:**

| Category | Variables |
|----------|-----------|
| **General** | `NODE_ENV`<br>`PORT`<br>`DATABASE_URL` |
| **Solana Network** | `RPC_URL`<br>`WALLET_PRIVATE_KEY`<br>`SWAP_AUTHORITY_KEY`<br>`COMMISSION_WALLET` |
| **TokenMill** | `TOKEN_MILL_PROGRAMID`<br>`TOKEN_MILL_CONFIG_PDA` |
| **Google Cloud Storage** | `GCS_BUCKET_NAME`<br>`SERVICE_ACCOUNT_EMAIL` |
| **Turnkey Wallet API** | `TURNKEY_API_URL`<br>`TURNKEY_ORGANIZATION_ID`<br>`TURNKEY_API_PUBLIC_KEY`<br>`TURNKEY_API_PRIVATE_KEY` |
| **Pinata IPFS** | `PINATA_GATEWAY`<br>`PINATA_JWT`<br>`PINATA_API_SECRET`<br>`PINATA_API_KEY` |
| **WebSocket** | `WEBSOCKET_ENABLED` |

### Environment File Example (.env.example)

```bash
# ===========================================
# GENERAL CONFIGURATION
# ===========================================
NODE_ENV=development
PORT=8080

# ===========================================
# SOLANA NETWORK CONFIGURATION
# ===========================================
# Mainnet RPC URL (replace with your Helius API key)
RPC_URL=https://staked.helius-rpc.com?api-key=YOUR_HELIUS_API_KEY
# Devnet RPC URL for testing
# RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY

# Wallet private key for server operations (Base58 encoded)
WALLET_PRIVATE_KEY=YOUR_WALLET_PRIVATE_KEY_HERE
# Alternative wallet for testing
# WALLET_PRIVATE_KEY=YOUR_TEST_WALLET_PRIVATE_KEY

# Swap authority wallet private key
SWAP_AUTHORITY_KEY=YOUR_SWAP_AUTHORITY_PRIVATE_KEY

# Commission wallet address
COMMISSION_WALLET=YOUR_COMMISSION_WALLET_ADDRESS

# ===========================================
# TOKENMILL CONFIGURATION
# ===========================================
# TokenMill program ID on Solana
TOKEN_MILL_PROGRAMID=YOUR_TOKEN_MILL_PROGRAM_ID

# TokenMill configuration PDA
TOKEN_MILL_CONFIG_PDA=YOUR_TOKEN_MILL_CONFIG_PDA
# Alternative config PDA for testing
# TOKEN_MILL_CONFIG_PDA=YOUR_TEST_CONFIG_PDA

# ===========================================
# DATABASE CONFIGURATION
# ===========================================
# PostgreSQL connection string
DATABASE_URL=postgresql://username:password@host:port/database_name

# ===========================================
# GOOGLE CLOUD STORAGE
# ===========================================
# GCS bucket name for file storage
GCS_BUCKET_NAME=your-gcs-bucket-name

# Service account email for GCS access
SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com

# ===========================================
# TURNKEY WALLET API
# ===========================================
# Turnkey API base URL
TURNKEY_API_URL=https://api.turnkey.com

# Your Turnkey organization ID
TURNKEY_ORGANIZATION_ID=your-organization-id

# Turnkey API public key
TURNKEY_API_PUBLIC_KEY=your-turnkey-public-key

# Turnkey API private key
TURNKEY_API_PRIVATE_KEY=your-turnkey-private-key

# ===========================================
# PINATA IPFS CONFIGURATION
# ===========================================
# Pinata gateway domain
PINATA_GATEWAY=your-gateway.mypinata.cloud

# Pinata JWT token
PINATA_JWT=your-pinata-jwt-token

# Pinata API secret
PINATA_API_SECRET=your-pinata-api-secret

# Pinata API key
PINATA_API_KEY=your-pinata-api-key

# ===========================================
# WEBSOCKET CONFIGURATION
# ===========================================
# Enable/disable WebSocket functionality
WEBSOCKET_ENABLED=true
```

### Important Security Notes

⚠️ **Never commit your actual `.env` file to version control!**

- Keep your `.env` file in `.gitignore`
- Use strong, unique values for all keys and passwords
- Rotate API keys and secrets regularly
- Use different wallets and keys for development vs production
- Consider using environment-specific configuration management for production deployments

## 💻 Development

**Start development server with auto-reload:**

```bash
pnpm dev
```

The server will start on port 8080 (or the port specified in your environment variables) with WebSocket support enabled.

**Build for production:**

```bash
pnpm build
```

**Start production server:**

```bash
pnpm start
```

## 🚢 Deployment

### Google Cloud Platform Deployment

1. **Configure deployment files:**

```bash
cp cloudbuild.yaml.example cloudbuild.yaml
cp deploy.sh.example deploy.sh
chmod +x deploy.sh
```

2. **Deployment options:**

| Method | Command |
|--------|---------|
| Google Cloud Run | `gcloud app deploy` |
| Deployment Script | `./deploy.sh` |

> **Note**: Configuration files (`cloudbuild.yaml` and `deploy.sh`) are included in `.gitignore` to protect sensitive credentials.

## 📁 Project Structure

```
server/
├── src/                          # Source code
│   ├── controllers/              # Controller functions
│   │   ├── threadController.ts   # Social thread management
│   │   ├── chatController.ts     # Real-time chat functionality
│   │   ├── notificationController.ts # Push notifications
│   │   ├── jupiterSwapController.ts   # Jupiter DEX integration
│   │   ├── raydiumSwapController.ts   # Raydium DEX integration
│   │   └── uploadMetadataController.ts # Metadata upload handling
│   ├── db/                       # Database configuration
│   │   ├── migrations/           # Database migration files
│   │   ├── knex.ts              # Knex.js configuration
│   │   └── knexfile.ts          # Database connection settings
│   ├── routes/                   # API route definitions
│   │   ├── auth/                # Authentication routes
│   │   ├── tokenmill/           # TokenMill functionality
│   │   ├── pumpfun/            # PumpFun integration
│   │   ├── swap/               # DEX swap operations
│   │   ├── feed/               # Social feed endpoints
│   │   ├── user/               # User management
│   │   ├── chat/               # Real-time messaging
│   │   ├── aura/               # Aura system
│   │   ├── notifications/      # Push notifications
│   │   ├── meteora/            # Meteora DEX integration
│   │   ├── raydium/            # Raydium launchpad
│   │   └── nft/                # NFT operations
│   ├── service/                 # Service implementations
│   │   ├── TokenMill/          # Core token management
│   │   ├── pumpSwap/           # PumpSwap integration
│   │   ├── MeteoraDBC/         # Meteora DBC service
│   │   ├── metaplex/           # Metaplex integration
│   │   ├── raydium/            # Raydium service
│   │   ├── websocketService.ts # WebSocket management
│   │   └── userService.ts      # User management service
│   ├── services/               # Additional services
│   │   └── expoNotificationService.ts # Expo notifications
│   ├── types/                  # TypeScript definitions
│   │   ├── interfaces.ts       # Core interfaces
│   │   ├── notification.types.ts # Notification types
│   │   └── aura/              # Aura-specific types
│   ├── utils/                  # Utility functions
│   │   ├── connection.ts       # Solana connection setup
│   │   ├── ipfs.ts            # IPFS integration
│   │   ├── gcs.ts             # Google Cloud Storage
│   │   ├── feeUtils.ts        # Fee calculation utilities
│   │   └── tokenMillHelpers.ts # TokenMill helpers
│   └── index.ts                # Main application entry point
├── dist/                       # Compiled JavaScript output
├── uploads/                    # Temporary upload directory
└── configuration files         # .env, package.json, etc.
```

## 🔌 API Endpoints

### Core TokenMill Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/config` | POST | Create TokenMill configuration |
| `/api/quote-token-badge` | POST | Get token badge quote |
| `/api/markets` | POST | Create new token market |
| `/api/free-market` | POST | Free market from restrictions |
| `/api/tokens` | POST | Create new token |
| `/api/swap` | POST | Execute token swaps |
| `/api/stake` | POST | Create staking position |
| `/api/vesting` | POST | Create vesting schedule |
| `/api/vesting/release` | POST | Release vested tokens |
| `/api/set-curve` | POST | Set market curve parameters |
| `/api/quote-swap` | POST | Get swap quotes |
| `/api/get-asset` | POST | Get asset metadata |
| `/api/graduation` | GET | Get market graduation info |

### DEX Integration Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jupiter/*` | Various | Jupiter DEX integration |
| `/api/raydium/swap/*` | Various | Raydium swap operations |
| `/api/raydium/launchpad/*` | Various | Raydium launchpad functionality |
| `/api/meteora/*` | Various | Meteora DBC operations |
| `/api/pump-swap/*` | Various | PumpSwap integration |

### Social & User Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/thread` | Various | Thread management |
| `/api/thread/images` | Various | Thread image operations |
| `/api/profile` | Various | User profile management |
| `/api/chat` | Various | Real-time messaging |
| `/api/notifications` | Various | Push notification management |

### Authentication Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/turnkey/*` | Various | Turnkey wallet authentication |
| `/api/auth/admin/*` | Various | Admin authentication |

### Specialized Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pumpfun/*` | Various | PumpFun token launches |
| `/api/aura/*` | Various | Aura system operations |
| `/api/nft/*` | Various | NFT operations |

### WebSocket & Health Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/socket.io-status` | GET | WebSocket server status |
| `/ws-health` | GET | WebSocket health check |
| `/api/websocket-status` | GET | Detailed WebSocket statistics |

## 🧩 Core Services

### TokenMill Service
Comprehensive token management functionality:
- Token creation and market setup
- Bonding curve configuration
- Swap execution and quotes
- Staking mechanisms
- Vesting plan management
- Market graduation handling

### WebSocket Service
Real-time communication infrastructure:
- Socket.IO integration
- Global chat management
- Real-time message delivery
- Connection management
- Transport optimization

### User Service
User management and authentication:
- Profile management
- Wallet integration
- User data handling

### Notification Service
Push notification delivery:
- Expo push notification integration
- Notification scheduling
- User targeting

### Storage Services
- **IPFS Service**: Pinata integration for decentralized storage
- **GCS Service**: Google Cloud Storage for media files

### DEX Integration Services
- **Jupiter**: Cross-platform swap aggregation
- **Raydium**: Automated market maker integration
- **Meteora**: Dynamic bonding curve operations
- **PumpSwap**: Specialized swap functionality

## 🗄️ Database Schema

The application uses PostgreSQL with the following key tables:

| Table | Purpose |
|-------|---------|
| `users` | User profiles and authentication data |
| `posts` | Social media posts/threads |
| `user_reactions` | User interactions and reactions |
| `follows` | User follow relationships |
| `user_wallets` | Wallet connection data |
| `chat_messages` | Real-time chat messages |
| `chat_rooms` | Chat room management |
| `push_tokens` | Expo push notification tokens |

### Migration Management
- Database migrations are handled automatically on server startup
- Migration files are located in `src/db/migrations/`
- Uses Knex.js for query building and migrations

## 🔌 WebSocket Implementation

The server implements comprehensive WebSocket functionality:

### Features
- Real-time chat messaging
- Global chat rooms
- Message broadcasting
- Connection state management
- Transport fallback (polling/websockets)

### Architecture
- Built on Socket.IO for cross-platform compatibility
- Integrated with Express server
- Health monitoring and debugging endpoints
- Optimized for cloud deployment (App Engine compatible)

### Usage
```typescript
// WebSocket service is available in request context
app.use((req: any, res, next) => {
  req.webSocketService = webSocketService;
  next();
});
```

## 🔒 Security & Best Practices

### Security Measures
- Environment variable protection for sensitive data
- Parameterized database queries
- Transaction signature validation
- CORS configuration for API access
- Error sanitization

### Code Quality
- TypeScript strict mode
- Modular, reusable architecture
- Comprehensive error handling
- Performance optimization (minimal re-renders)
- Functional programming patterns

## 👥 Contributing

We welcome contributions to the Solana App Kit backend server! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed information on how to contribute to this project.

### Development Guidelines
- Follow the TypeScript coding standards
- Write modular, reusable components
- Implement comprehensive error handling
- Document all functions and interfaces
- Use functional programming patterns
- Avoid unnecessary re-renders and optimizations

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support, please open an issue in the repository or contact the maintainers.

---

<div align="center">

**Built with ❤️ for the Solana ecosystem**

</div>
