# Wallet Providers Module

A comprehensive wallet integration module that provides a unified interface for multiple wallet providers (Privy, Dynamic, Turnkey, MWA) in React Native applications on Solana.

## Core Features

### Multi-Provider Support
- **Privy**: Social login and embedded wallets
  - OAuth authentication
  - Email/password login
  - Custodial and non-custodial options
  
- **Dynamic**: Advanced embedded wallets
  - Multi-chain support
  - Customizable UI
  - Advanced authentication flows
  
- **Turnkey**: Institutional-grade wallets
  - MPC-based security
  - Custom authentication
  - Hardware security module integration
  
- **Mobile Wallet Adapter (MWA)**
  - Native Android wallet integration
  - QR code connection support
  - Deep linking capabilities

### Transaction Management
- Transaction building and signing
- Multi-signature support
- Transaction simulation
- Error handling and recovery
- Status notifications
- Transaction history tracking

### Authentication & Security
- Unified authentication interface
- Social login integration
- Secure key management
- Session handling
- Biometric authentication support
- Deep linking support

## Components

### Wallet Authentication
```typescript
import { EmbeddedWalletAuth, TurnkeyWalletAuth } from '@/modules/wallet-providers';

// Embedded wallet with social login
function App() {
  return (
    <EmbeddedWalletAuth
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      theme={WalletTheme}
      styles={WalletStyles}
    />
  );
}

// Turnkey institutional wallet
function InstitutionalApp() {
  return (
    <TurnkeyWalletAuth
      config={{
        apiKey: 'your-api-key',
        organizationId: 'your-org-id'
      }}
      onConnect={handleConnect}
    />
  );
}
```

## Hooks

### useWallet
Core hook for wallet interactions:
```typescript
function WalletComponent() {
  const {
    wallet,
    connected,
    publicKey,
    sendTransaction,
    signMessage,
    disconnect
  } = useWallet();

  const handleTransaction = async () => {
    try {
      const signature = await sendTransaction(transaction, connection);
      console.log('Transaction sent:', signature);
    } catch (error) {
      console.error('Transaction failed:', error);
    }
  };
}
```

### useAuth
Authentication management hook:
```typescript
function AuthComponent() {
  const {
    isAuthenticated,
    login,
    logout,
    user,
    loading
  } = useAuth();

  const handleLogin = async () => {
    await login({
      provider: 'google',
      redirectUrl: 'your-redirect-url'
    });
  };
}
```

### Provider-Specific Hooks
- `useDynamicWalletLogic`: Dynamic.xyz specific features
- `useTurnkeyWalletLogic`: Turnkey-specific functionality

## Services

### TransactionService
Handles all transaction-related operations:
```typescript
import { TransactionService } from '@/modules/wallet-providers';

// Send a transaction
const result = await TransactionService.sendTransaction(
  transaction,
  connection,
  {
    simulate: true,
    commitment: 'confirmed',
    statusCallback: (status) => console.log('Status:', status)
  }
);

// Show transaction notifications
TransactionService.showSuccess(signature);
TransactionService.showError('Transaction failed');
```

### Provider Services
Initialize and configure wallet providers:
```typescript
import {
  initDynamicClient,
  initPrivyClient,
  initTurnkeyClient
} from '@/modules/wallet-providers';

// Initialize Dynamic
await initDynamicClient({
  environmentId: 'your-environment-id'
});

// Initialize Privy
await initPrivyClient({
  appId: 'your-app-id'
});

// Initialize Turnkey
await initTurnkeyClient({
  apiKey: 'your-api-key',
  organizationId: 'your-org-id'
});
```

## Error Handling

The module implements comprehensive error handling:
- Transaction simulation failures
- Network errors
- Authentication failures
- Provider-specific errors
- User-friendly error messages

## Styling

Components support customization through:
- Theme configuration
- Style overrides
- Dark/light mode support
- Responsive layouts
- Platform-specific adjustments

## Best Practices

### Security
- Never store private keys in plain text
- Use secure storage for sensitive data
- Implement proper session management
- Always validate transactions before signing
- Use appropriate commitment levels

### Performance
- Lazy loading of provider SDKs
- Connection pooling
- Caching of wallet states
- Optimized re-renders
- Efficient transaction batching

### UX Guidelines
- Clear loading states
- Informative error messages
- Transaction confirmation dialogs
- Wallet connection status indicators
- Network status monitoring
