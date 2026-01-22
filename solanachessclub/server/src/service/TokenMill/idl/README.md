# IDL Directory

This directory contains Interface Definition Language (IDL) files for Solana programs used by the Solana Social Starter backend.

## Overview

IDL files define the interface for interacting with Solana programs using Anchor, a framework for Solana smart contract development. These files:

- Define the program's account structures
- Specify the available instructions and their parameters
- Document the errors that can be thrown by the program
- Provide the program ID and other metadata

## Files

### `token_mill.json`

The JSON representation of the TokenMill program's interface. This file:

- Is consumed by the Anchor client to generate a type-safe interface
- Contains all instruction definitions for the TokenMill program
- Includes account and type definitions

### `token_mill.ts`

TypeScript types generated from the TokenMill IDL, providing:

- Type-safe interaction with the TokenMill program
- IntelliSense/autocomplete support in development
- Runtime validation for program interactions

## Usage

The IDL files are used by the TokenMill service to interact with the TokenMill Solana program:

```typescript
import * as anchor from '@coral-xyz/anchor';
import TokenMillIDL from '../idl/token_mill.json';
import { TokenMillType } from '../idl/token_mill';

// Initialize a program instance using the IDL
const program = new anchor.Program<TokenMillType>(
  TokenMillIDL as unknown as TokenMillType,
  provider
);

// Use the program to interact with the TokenMill Solana program
const tx = await program.methods
  .createMarketWithSpl(...)
  .accountsPartial({...})
  .signers([...])
  .rpc();
```

## Updating IDL Files

When the Solana program is updated, the IDL files should be updated as well:

1. Obtain the new IDL JSON from the program's repository or by using Anchor to extract it
2. Replace `token_mill.json` with the new IDL
3. Generate updated TypeScript types using the Anchor CLI or by manually updating `token_mill.ts`

## IDL Source

The TokenMill IDL comes from the TokenMill program's repository. For reference, the program can be found at:
[https://github.com/SendArcade/Token-Mill](https://github.com/SendArcade/Token-Mill)

## Important Considerations

- The IDL version must match the deployed program version
- Changes to the program without updating the IDL may cause errors
- Custom client extensions should be added to service files, not to the IDL files
