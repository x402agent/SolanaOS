# Transaction Service

The Transaction Service provides a centralized way to handle transaction signing and sending across different wallet providers in the application. This helps maintain consistent transaction handling and simplifies working with different providers like Privy and Dynamic.

## Features

- Provider-agnostic transaction handling
- Support for regular and versioned transactions
- Support for base64-encoded transactions
- Support for transaction instructions
- Automatic transaction confirmation
- Status callbacks for tracking transaction progress
- Retry logic for transaction confirmation

## Usage Examples

### Using the hook in a component

```typescript
import { useTransactionService } from '../../services/transaction/transactionService';
import { Connection, clusterApiUrl, SystemProgram, PublicKey } from '@solana/web3.js';

function MyComponent() {
  const { signAndSendInstructions, signAndSendBase64, currentProvider } = useTransactionService();
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

  async function handleSendSol() {
    try {
      // Create transfer instruction
      const instructions = [
        SystemProgram.transfer({
          fromPubkey: new PublicKey('your-public-key'),
          toPubkey: new PublicKey('recipient-public-key'),
          lamports: 1000000, // 0.001 SOL
        }),
      ];

      // Get wallet provider
      const provider = await getWalletProvider(); // Your function to get the current provider

      // Send transaction
      const signature = await signAndSendInstructions(
        instructions,
        new PublicKey('your-public-key'),
        provider,
        connection,
        {
          statusCallback: (status) => console.log(`Transaction status: ${status}`),
        }
      );

      console.log(`Transaction sent: ${signature}`);
    } catch (error) {
      console.error('Transaction failed:', error);
    }
  }

  return <Button title="Send SOL" onPress={handleSendSol} />;
}
```

### Sending a base64 transaction

```typescript
import { useTransactionService } from '../../services/transaction/transactionService';

function handleBase64Transaction(base64Tx: string) {
  const { signAndSendBase64 } = useTransactionService();
  const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
  const provider = await getWalletProvider(); // Your function to get the current provider

  const signature = await signAndSendBase64(
    base64Tx,
    provider,
    connection,
    {
      confirmTransaction: true,
      maxRetries: 5,
      statusCallback: (status) => console.log(status),
    }
  );

  return signature;
}
```

### Using the class directly

```typescript
import { TransactionService } from '../../services/transaction/transactionService';

async function sendTransaction(transaction, provider) {
  const connection = new Connection(clusterApiUrl('mainnet-beta'));

  return TransactionService.signAndSendTransaction(
    { type: 'transaction', transaction },
    { type: 'autodetect', provider, currentProvider: 'privy' },
    { connection }
  );
}
```

## Migrating from the old way

If you're migrating from the old transaction utilities, the compatibility layer in `src/utils/transactions/transactionCompatUtils.ts` provides backward-compatible functions that use the new service internally:

```typescript
import {
  signAndSendWithPrivy,
  signAndSendBase64Tx,
} from '../../utils/transactions/transactionCompatUtils';

// Old code continues to work
const signature = await signAndSendWithPrivy(transaction, connection, provider);
```

However, we recommend migrating to the new API for new code:

```typescript
import { TransactionService } from '../../services/transaction/transactionService';

// New approach
const signature = await TransactionService.signAndSendTransaction(
  { type: 'transaction', transaction },
  { type: 'autodetect', provider, currentProvider: provider.type || 'privy' },
  { connection }
);
```

## API Reference

### TransactionService

#### Static Methods

- `signAndSendTransaction(txFormat, walletProvider, options)`: Signs and sends a transaction with the specified wallet provider.

#### Parameters

- `txFormat`: The transaction format
  - `{ type: 'transaction', transaction }`: An in-memory transaction object
  - `{ type: 'base64', data }`: A base64-encoded transaction
  - `{ type: 'instructions', instructions, feePayer, signers? }`: Transaction instructions to build into a transaction

- `walletProvider`: The wallet provider to use
  - `{ type: 'privy', provider }`: A Privy wallet provider
  - `{ type: 'dynamic', walletAddress }`: A Dynamic wallet address
  - `{ type: 'autodetect', provider, currentProvider }`: Auto-detect based on currentProvider string

- `options`: Additional options
  - `connection`: The Solana connection
  - `confirmTransaction?`: Whether to confirm the transaction (default: true)
  - `maxRetries?`: Maximum number of confirmation retries (default: 3)
  - `statusCallback?`: Function to receive status updates

### useTransactionService (Hook)

Returns an object with the following methods:

- `signAndSendTransaction(txFormat, provider, options)`: Simplified version of the static method
- `signAndSendInstructions(instructions, feePayer, provider, connection, options?)`: Helper for sending instructions
- `signAndSendBase64(base64Tx, provider, connection, options?)`: Helper for sending base64 transactions
- `currentProvider`: The current wallet provider (from Redux state)
- `walletAddress`: The current wallet address (from Redux state) 