# Types

This directory contains TypeScript type definitions that are shared across the application. These types ensure type safety and provide documentation for data structures.

## Directory Structure

```
types/
├── env.d.ts           # Environment variable type definitions
└── custom.d.ts       # Custom type definitions for the application
```

## Type Categories

### Environment Types (env.d.ts)

Contains type definitions for environment variables and configuration settings. These types ensure that environment variables are used consistently and correctly throughout the application.

### Custom Types (custom.d.ts)

Contains custom type definitions including module declarations, global augmentations, and other application-specific types. This can include:

- Module declarations for libraries without type definitions
- Extended types for React components
- Global type augmentations
- Utility type helpers

## Best Practices

1. **Type Organization**:
   - Group related types together
   - Use namespaces for organization when appropriate
   - Document complex types with comments
   - Use descriptive names for all types

2. **Type Design**:
   - Prefer interfaces over types for object shapes
   - Use union types for finite sets of values
   - Use generics for flexible, reusable types
   - Make types as specific as possible

3. **Code Quality**:
   - Enforce strict null checks
   - Use readonly properties when appropriate
   - Avoid any except in edge cases
   - Use proper return types for functions

4. **Documentation**:
   - Add JSDoc comments to complex types
   - Document non-obvious type parameters
   - Note when types mirror API responses
   - Explain unusual type constraints

## Example Type Patterns

### Interface Definitions

```typescript
/**
 * Represents a user profile in the application
 */
export interface User {
  /** Unique identifier for the user */
  id: string;
  /** Username for display and mentions */
  username: string;
  /** Optional display name */
  displayName?: string;
  /** URL to the user's avatar image */
  avatarUrl: string;
  /** Cryptocurrency wallet address */
  walletAddress: string;
  /** User biography text */
  bio?: string;
  /** Number of followers */
  followers: number;
  /** Number of accounts this user follows */
  following: number;
  /** ISO timestamp of when the user joined */
  joinedDate: string;
}
```

### Union Types

```typescript
/**
 * Supported wallet connection methods
 */
export type WalletConnectionMethod = 
  | 'direct'   // Connect using direct wallet integration
  | 'privy'    // Connect via Privy service
  | 'dynamic'  // Connect via Dynamic wallet service
  | 'turnkey'; // Connect via Turnkey service
```

### Utility Types

```typescript
/**
 * Makes all properties of T optional except for those in K
 */
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

/**
 * Example usage:
 */
type UpdateUserRequest = PartialExcept<User, 'id'>;
// Result: All User properties are optional except for 'id'
```

## Type Extensions and Declarations

### Module Declarations

Add type definitions for modules that don't have their own type definitions:

```typescript
// Declare types for an untyped module
declare module 'untyped-module' {
  export function someFunction(param: string): number;
  export const someValue: string;
}
```

### Global Augmentations

Extend global types:

```typescript
// Extend the Window interface
declare global {
  interface Window {
    walletProvider: WalletProvider;
  }
}
```

## Maintaining Types

1. Keep types in sync with API responses
2. Update types when data structures change
3. Review types for accuracy during code reviews
4. Consider generating types from API specifications
5. Test type correctness with TypeScript's compiler
6. Document breaking changes to type definitions 