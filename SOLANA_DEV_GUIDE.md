# Solana OS Developer Guide

Welcome to Solana OS - the blockchain-native operating system for building, deploying, and earning with Solana.

## Table of Contents

1. [Quick Start](#quick-start)
2. [$OS Token](#os-token)
3. [Developer Rewards](#developer-rewards)
4. [Deploying Agents](#deploying-agents)
5. [Deploying Apps](#deploying-apps)
6. [API Reference](#api-reference)
7. [Security Best Practices](#security-best-practices)

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- PostgreSQL database
- Solana wallet with $OS tokens

### Installation

```bash
# Clone the repository
git clone https://github.com/x402agent/SolanaOS.git
cd SolanaOS

# Install dependencies
pnpm install

# Copy environment configuration
cp .env.example .env

# Configure your environment variables (see below)
nano .env

# Start development server
pnpm dev
```

### Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Required: Solana Network
CLUSTER=devnet                    # mainnet-beta for production
HELIUS_API_KEY=your_helius_key    # Get from helius.dev
SOLANA_RPC_URL=https://api.devnet.solana.com

# Required: Authentication (NO DEFAULT VALUES FOR SECURITY)
ADMIN_USERNAME=your_admin_user
ADMIN_PASSWORD_HASH=your_bcrypt_hash
JWT_SECRET=your_32_char_minimum_secret

# Required: Database
DATABASE_URL=postgresql://user:pass@localhost:5432/solana_os
```

**Generate password hash:**
```bash
node -e "console.log(require('bcrypt').hashSync('your_password', 10))"
```

---

## $OS Token

### Overview

The **$OS token** is the native utility token for the Solana OS ecosystem.

| Property | Value |
|----------|-------|
| **Token Name** | Solana OS |
| **Symbol** | $OS |
| **Mint Address** | `DrU9M6SUaXWua49zeaHQWJuwMpcZ4jMDRT3J5Ywpump` |
| **Decimals** | 6 |
| **Network** | Solana Mainnet |

### Token Utilities

1. **Deploy Agents & Apps** - Pay deployment fees in $OS
2. **Earn SOL Rewards** - Holders earn from platform fees
3. **Tier Benefits** - Higher holdings = more features & discounts
4. **Governance** - Vote on protocol decisions

### How to Get $OS

- **Pump.fun**: [DrU9M6SUaXWua49zeaHQWJuwMpcZ4jMDRT3J5Ywpump](https://pump.fun/DrU9M6SUaXWua49zeaHQWJuwMpcZ4jMDRT3J5Ywpump)
- **Jupiter**: Swap SOL for $OS
- **Raydium**: Add liquidity and earn

---

## Developer Rewards

### Reward Tiers

| Tier | Min $OS | SOL Multiplier | Deploy Discount | Max Agents | Max Apps |
|------|---------|----------------|-----------------|------------|----------|
| **Explorer** | 1,000 | 1x | 0% | 1 | 1 |
| **Builder** | 10,000 | 1.5x | 10% | 5 | 3 |
| **Architect** | 50,000 | 2x | 25% | 20 | 10 |
| **Visionary** | 100,000 | 3x | 50% | Unlimited | Unlimited |

### How Rewards Work

1. **Platform Fee Pool**: 30% of all platform fees go to $OS holders
2. **Weighted Distribution**: Your share = (your $OS × tier multiplier) / total weighted $OS
3. **Daily Distribution**: Rewards distributed every 24 hours
4. **Activity Bonuses**: Extra SOL for active developers

### Activity Bonuses (in SOL)

| Activity | Bonus |
|----------|-------|
| Deploy an agent | 0.001 SOL |
| Deploy an app | 0.002 SOL |
| Per unique user | 0.0001 SOL |
| Weekly active | 0.01 SOL |
| Monthly shipping | 0.05 SOL |

### Check Your Rewards

```bash
# Get your tier info
curl https://api.solanaos.io/api/os-token/tier/YOUR_WALLET_ADDRESS

# Estimate your rewards
curl "https://api.solanaos.io/api/os-token/rewards/estimate/YOUR_WALLET_ADDRESS?totalStaked=1000000&poolBalance=10"
```

---

## Deploying Agents

### Agent Types & Fees

| Type | Base Fee ($OS) | Description |
|------|----------------|-------------|
| **Basic** | 100 | Simple chatbot agents |
| **Standard** | 500 | Trading bots, data agents |
| **Advanced** | 1,000 | Multi-tool complex agents |
| **Enterprise** | 5,000 | Custom enterprise solutions |

### Deploy an Agent

```javascript
// Example: Deploy a trading agent
const response = await fetch('https://api.solanaos.io/api/os-token/deploy/agent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    wallet: 'YOUR_WALLET_ADDRESS',
    config: {
      name: 'My Trading Bot',
      description: 'AI-powered Solana trading agent',
      type: 'standard',
      tools: ['jupiter_swap', 'price_feed', 'wallet_balance'],
      model: 'gpt-4',
      systemPrompt: 'You are a trading assistant...',
      publicAccess: true
    }
  })
});

const result = await response.json();
console.log('Agent URL:', result.data.deployment.deploymentUrl);
```

### Agent Configuration

```typescript
interface AgentConfig {
  name: string;           // Display name
  description: string;    // What the agent does
  type: 'basic' | 'standard' | 'advanced' | 'enterprise';
  tools: string[];        // Available tools/actions
  model: 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3' | 'llama-3';
  systemPrompt: string;   // Agent personality/instructions
  publicAccess: boolean;  // List in discovery
  metadata?: object;      // Custom data
}
```

### Available Agent Tools

- `jupiter_swap` - Execute swaps via Jupiter
- `raydium_swap` - Trade on Raydium
- `price_feed` - Get token prices
- `wallet_balance` - Check balances
- `nft_mint` - Create NFTs
- `token_transfer` - Send tokens
- `market_data` - Fetch market info

---

## Deploying Apps

### App Types & Fees

| Type | Base Fee ($OS) | Description |
|------|----------------|-------------|
| **Basic** | 200 | Single-page apps |
| **Standard** | 1,000 | Full web apps |
| **Advanced** | 2,500 | Complex applications |
| **Enterprise** | 10,000 | Custom enterprise apps |

### Deploy an App

```javascript
// Example: Deploy a DeFi dashboard
const response = await fetch('https://api.solanaos.io/api/os-token/deploy/app', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    wallet: 'YOUR_WALLET_ADDRESS',
    config: {
      name: 'DeFi Dashboard',
      description: 'Track your Solana DeFi positions',
      type: 'standard',
      framework: 'react',
      features: ['portfolio_tracking', 'yield_farming', 'analytics'],
      customDomain: 'dashboard.mysite.com' // Optional
    }
  })
});

const result = await response.json();
console.log('App URL:', result.data.deployment.deploymentUrl);
```

### App Configuration

```typescript
interface AppConfig {
  name: string;           // App name
  description: string;    // What the app does
  type: 'basic' | 'standard' | 'advanced' | 'enterprise';
  framework: 'react' | 'next' | 'vue' | 'svelte';
  features: string[];     // Enabled features
  customDomain?: string;  // Your own domain
  metadata?: object;      // Custom data
}
```

---

## API Reference

### Base URL

```
Production: https://api.solanaos.io
Development: http://localhost:8080
```

### Token Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/os-token/info` | Token metadata |
| GET | `/api/os-token/balance/:wallet` | Get $OS balance |
| GET | `/api/os-token/tier/:wallet` | Get tier info |
| GET | `/api/os-token/fees` | Get fee schedule |

### Rewards Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/os-token/rewards/estimate/:wallet` | Estimate rewards |
| POST | `/api/os-token/rewards/activity` | Calculate activity bonus |

### Deployment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/os-token/deploy/agent` | Deploy agent |
| POST | `/api/os-token/deploy/app` | Deploy app |
| GET | `/api/os-token/deployments/:wallet` | List deployments |
| GET | `/api/os-token/deployment/:id` | Get deployment |
| PATCH | `/api/os-token/deployment/:id/status` | Update status |
| GET | `/api/os-token/eligibility/:wallet` | Check eligibility |

### Discovery Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/os-token/discover` | Browse public agents/apps |
| GET | `/api/os-token/search?q=query` | Search deployments |

---

## Security Best Practices

### Environment Variables

1. **NEVER commit `.env` files** - They're in `.gitignore`
2. **Use strong secrets** - JWT_SECRET should be 32+ random characters
3. **Rotate credentials** - Change passwords and API keys regularly
4. **Use environment-specific configs** - Different keys for dev/staging/prod

### Wallet Security

1. **Never expose private keys** - Use environment variables
2. **Use user's wallet** - Don't hold user funds
3. **Validate all inputs** - Check public keys before use
4. **Implement rate limiting** - Prevent abuse

### API Security

1. **Use HTTPS** - Always in production
2. **Validate JWT tokens** - Check expiry and signatures
3. **Sanitize user inputs** - Prevent injection attacks
4. **Log security events** - Monitor for suspicious activity

---

## Support & Resources

- **Documentation**: https://docs.solanaos.io
- **Discord**: https://discord.gg/solanaos
- **Twitter**: https://twitter.com/SolanaOS
- **GitHub Issues**: https://github.com/your-org/SolanaOS/issues
- **Security Contact**: security@solanaos.io

---

## License

Apache 2.0 - See [LICENSE](LICENSE) for details.
