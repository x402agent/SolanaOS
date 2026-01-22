# Transactions Service

This module provides comprehensive transaction handling for the Solana blockchain, featuring both **Jito bundles** and **priority fee** mechanisms for optimized transaction processing. It offers modular, reusable, and easily customizable transaction services for developers.

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Module Structure](#-module-structure)
- [Priority Fee System](#-priority-fee-system)
- [Jito Bundle Integration](#-jito-bundle-integration)
- [Transaction Methods](#-transaction-methods)
- [Usage Examples](#-usage-examples)
- [Configuration](#-configuration)

## 🔍 Overview

The transactions service provides a unified interface for handling Solana blockchain transactions with support for:
- **Priority Fee Transactions**: Enhanced processing with configurable fee tiers
- **Jito Bundle Transactions**: MEV-protected transactions through Jito's block engine
- **Automated Commission System**: Built-in 0.5% commission handling
- **Mobile Wallet Adapter Support**: Native mobile wallet integration

## ✨ Features

| Category | Features |
|----------|----------|
| **Transaction Processing** | • Priority fee management (4 tiers)<br>• Jito bundle support<br>• SOL and Token transfers<br>• Mobile Wallet Adapter (MWA)<br>• Versioned transactions |
| **Priority Fee System** | • Low, Medium, High, Very-High tiers<br>• Dynamic calculation<br>• Compute unit optimization<br>• Real-time tier selection |
| **Jito Integration** | • MEV-protected transactions<br>• Bundle submission<br>• Status tracking<br>• Block engine communication |
| **Error Handling** | • Comprehensive error parsing<br>• Retry mechanisms<br>• Confirmation validation<br>• Status callbacks |

## 📁 Module Structure

```
src/shared/services/transactions/
├── index.ts                    # Main exports
├── methods/                    # Transaction execution methods
│   ├── sendSOL.ts             # SOL transfers
│   ├── sendToken.ts           # Token transfers
│   ├── priority.ts            # Priority fee transactions
│   └── jito.ts               # Jito bundle transactions
├── core/                      # Core utilities and configurations
│   ├── types.ts              # TypeScript interfaces
│   ├── constants.ts          # Configuration constants
│   ├── commission.ts         # Commission utilities
│   ├── helpers.ts            # Transaction helpers
│   └── errorParser.ts        # Error handling
└── README.md                  # This documentation
```

## ⚡ Priority Fee System

### Fee Tiers & Configuration

| Tier | MicroLamports | Use Case |
|------|---------------|----------|
| **Low** | 1,000 | Standard transactions |
| **Medium** | 10,000 | Normal priority |
| **High** | 100,000 | High priority |
| **Very-High** | 1,000,000 | Critical transactions |

```typescript
export const DEFAULT_FEE_MAPPING: FeeMapping = {
  'low': 1_000,
  'medium': 10_000,
  'high': 100_000,
  'very-high': 1_000_000,
};
```

**Auto-added Instructions:**
- Compute Unit Limit: 2,000,000 units
- Compute Unit Price: Based on selected tier
- Dynamic Selection: Retrieved from Redux state

## 🚀 Jito Bundle Integration

**Benefits:**
- Bundle Submission: Groups transactions for atomic execution
- MEV Protection: Prevents front-running and sandwich attacks
- Guaranteed Inclusion: Higher success rate for critical transactions
- Status Tracking: Real-time bundle monitoring

```typescript
export const JITO_BUNDLE_URL = ENDPOINTS.jito?.blockEngine || '';

interface JitoBundleResponse {
  jsonrpc: string;
  result: string;
  id: number;
}
```

## 🔧 Transaction Methods

### Core Functions

#### `sendSOL(params: SendSOLParams)`
Sends SOL with optional commission and priority fees.

#### `sendToken(params: SendTokenParams)`
Sends SPL tokens with automatic account creation and commission handling.

#### `sendTransactionWithPriorityFee(params: SendTransactionParams)`
Executes transactions with configurable priority fees.

#### `sendJitoBundleTransaction(params: SendJitoBundleParams)`
Executes MEV-protected transactions through Jito's block engine.

### Commission System
- **Rate**: 0.5% of transaction amount
- **Automatic**: Built into all transfer methods
- **Transparent**: Amount clearly displayed to users

```typescript
// Commission calculation utilities
calculateCommissionLamports(transactionLamports: number): number
createCommissionInstruction(fromPubkey: PublicKey, transactionLamports: number): TransactionInstruction
calculateTransferAmountAfterCommission(totalLamports: number): { transferLamports: number; commissionLamports: number }
```

### Error Handling & Retries

```typescript
export const TRANSACTION_RETRIES = {
  maxAttempts: 6,
  interval: 1500,
  confirmationAttempts: 3,
  confirmationInterval: 1000,
  blockhashAttempts: 3,
  blockhashInterval: 500,
};
```

**Error Types:** Confirmation failures, Network issues, Wallet errors, Insufficient funds

## 📚 Usage Examples

### Basic SOL Transfer
```typescript
import { sendSOL } from '@/shared/services/transactions';

const signature = await sendSOL({
  wallet: connectedWallet,
  recipientAddress: 'recipient_address',
  amountSol: 0.1,
  connection: solanaConnection,
  includeCommission: true,
  onStatusUpdate: (status) => console.log(status)
});
```

### Priority Fee Transaction
```typescript
import { sendTransactionWithPriorityFee } from '@/shared/services/transactions';

const signature = await sendTransactionWithPriorityFee({
  wallet: connectedWallet,
  instructions: transactionInstructions,
  connection: solanaConnection,
  shouldUsePriorityFee: true,
  includeCommission: true,
  onStatusUpdate: (status) => console.log(status)
});
```

### Jito Bundle Transaction
```typescript
import { sendJitoBundleTransaction } from '@/shared/services/transactions';

const signature = await sendJitoBundleTransaction({
  provider: walletProvider,
  instructions: transactionInstructions,
  walletPublicKey: userPublicKey,
  connection: solanaConnection,
  onStatusUpdate: (status) => console.log(status)
});
```

### Mobile Wallet Adapter (Android)
```typescript
import { sendPriorityTransactionMWA } from '@/shared/services/transactions';

if (Platform.OS === 'android') {
  const signature = await sendPriorityTransactionMWA(
    connection,
    recipientAddress,
    lamportsAmount,
    feeMapping,
    (status) => console.log(status)
  );
}
```

## ⚙️ Configuration

### Environment Variables
```bash
# Commission wallet address
COMMISSION_WALLET=your_commission_wallet_address

# Jito configuration
JITO_BUNDLE_URL=https://your-jito-endpoint

# Solana cluster
CLUSTER=mainnet-beta
```

### Redux Integration
```typescript
// Get current settings from Redux state
const transactionMode = getCurrentTransactionMode(); // 'jito' | 'priority'
const feeTier = getCurrentFeeTier(); // 'low' | 'medium' | 'high' | 'very-high'
const feeAmount = getCurrentFeeMicroLamports();
```

### Transaction Types
```typescript
export type TransactionType = 'swap' | 'transfer' | 'stake' | 'nft' | 'token';
export type TransactionMode = 'jito' | 'priority';
```

## 🎯 Best Practices

- **Mode Selection**: Use Jito for MEV-sensitive transactions, Priority fees for speed
- **Fee Tiers**: Match tier to transaction urgency
- **Error Handling**: Implement comprehensive error handling with status callbacks
- **Platform Support**: Check MWA compatibility for Android
- **Security**: Validate signatures and amounts before processing

---

**Built with ❤️ for the Solana ecosystem - Optimized for speed, security, and user experience** 