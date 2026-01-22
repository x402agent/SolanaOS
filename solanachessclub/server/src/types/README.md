# Types Directory

This directory contains TypeScript type definitions and interfaces used throughout the Solana App Kit server. Proper typing ensures code quality, facilitates refactoring, and provides better development experience through improved IDE support.

## Structure

- `interfaces.ts`: Core interfaces used across multiple components
- `aura/`: Types specific to the Aura functionality
- Additional type files for specific features

## Core Types

### API Request/Response Types

These types define the shape of API requests and responses:

```typescript
// Request type example
export interface CreateThreadRequest {
  content: string;
  userId: string;
  attachments?: Attachment[];
}

// Response type example
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### Domain Models

Types representing core business entities:

```typescript
export interface Thread {
  id: string;
  content: string;
  userId: string;
  createdAt: Date;
  updatedAt?: Date;
  attachments: Attachment[];
  likes: number;
  comments: number;
}

export interface User {
  id: string;
  walletAddress: string;
  username: string;
  profileImage?: string;
  bio?: string;
  createdAt: Date;
}
```

### Integration Types

Types for third-party service integrations:

```typescript
export interface PinataMetadata {
  name: string;
  description?: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

export interface TokenMillSwapParams {
  marketIndex: number;
  amount: string;
  direction: SwapDirection;
}
```

## Enum Types

Enums used for predefined values:

```typescript
export enum SwapDirection {
  Buy = 0,
  Sell = 1,
}

export enum FileType {
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  Document = 'document',
}
```

## Utility Types

Helper types that transform other types:

```typescript
export type Nullable<T> = T | null;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type WithId<T> = T & { id: string };
```

## Special Subdirectories

### `aura/` 

Contains types specific to the Aura functionality:

- Data models
- Request/response interfaces
- Configuration types

## Best Practices

When working with types in this project:

1. **Define types in the right place:**
   - Shared types go in `interfaces.ts`
   - Feature-specific types go in dedicated files
   - Module-specific types should be in module subdirectories

2. **Use descriptive names:**
   - Use PascalCase for interfaces and types
   - Use descriptive names that indicate purpose
   - Avoid abbreviations unless widely understood

3. **Document complex types:**
   - Use JSDoc comments for complex types
   - Explain non-obvious properties
   - Document expected formats for string fields

4. **Minimize type duplication:**
   - Use inheritance for related types
   - Create base interfaces for common properties
   - Use utility types like Partial, Pick, Omit

5. **Ensure type exports:**
   - Always export types that will be used elsewhere
   - Consider a barrel export file (index.ts) for subdirectories
   - Import types from their specific files, not from index files

6. **Type vs Interface:**
   - Prefer interfaces for object shapes that may be extended
   - Use types for unions, intersections, and mapped types
   - Be consistent with your chosen approach

## Adding New Types

When adding new types:

1. Determine if the type belongs in an existing file or needs a new one
2. Create clear, descriptive names for your types
3. Add JSDoc comments to explain the purpose and structure
4. Export the type for use in other files
5. Consider creating utility functions that validate complex types

## Example Type Definition

```typescript
/**
 * Represents a staking position in a TokenMill market
 * @property marketIndex - The market index for the staked token
 * @property amount - The amount staked, in token base units
 * @property startDate - When the staking position was created
 * @property duration - Duration in seconds
 * @property owner - Wallet address of the position owner
 */
export interface StakingPosition {
  marketIndex: number;
  amount: string; // BN represented as string
  startDate: Date;
  duration: number; // in seconds
  owner: string; // wallet address
  rewardRate: number;
  positionIndex: number;
}
```
