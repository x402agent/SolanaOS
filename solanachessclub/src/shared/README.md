# Shared

This directory contains shared code, utilities, and resources that are used across the application. It serves as a central repository for code that is not specific to any single feature or screen.

## Directory Structure

```
shared/
├── config/               # Application configuration and constants
├── context/              # React Context providers for global state
├── hooks/                # Reusable React hooks
├── mocks/                # Mock data for development and testing
├── navigation/           # Navigation configuration and components
├── services/             # Services for API calls and external integrations
├── state/                # Redux state management
├── types/                # TypeScript type definitions
└── utils/                # Utility functions and helper methods
```

## Overview of Subdirectories

### Config

Contains application-wide configuration settings, constants, and customization options. This includes API endpoints, feature flags, and environment-specific settings.

[View Config Documentation](./config/README.md)

### Context

React Context providers that manage global state outside of Redux. These contexts provide a way to share data across components without prop drilling.

[View Context Documentation](./context/README.md)

### Hooks

Reusable React hooks that encapsulate common logic and stateful operations. These hooks follow React's best practices and provide clean abstractions for common patterns.

[View Hooks Documentation](./hooks/README.md)

### Mocks

Mock data used for development, testing, and demonstration purposes. These mocks simulate the data structures and responses that would typically come from an API or blockchain.

[View Mocks Documentation](./mocks/README.md)

### Navigation

Navigation configuration and components using React Navigation. This defines the navigation structure, routes, and navigation-related utilities.

[View Navigation Documentation](./navigation/README.md)

### Services

Service integrations and business logic implementations. Services handle external API calls, blockchain interactions, and other core functionality.

[View Services Documentation](./services/README.md)

### State

Redux state management setup using Redux Toolkit. It follows a feature-based structure with each feature having its own slice of state.

[View State Documentation](./state/README.md)

### Types

TypeScript type definitions that are shared across the application. These types ensure type safety and provide documentation for data structures.

[View Types Documentation](./types/README.md)

### Utils

Utility functions and helper methods that provide common functionality used throughout the application. This includes formatting, validation, and other shared operations.

[View Utils Documentation](./utils/README.md)

## Best Practices

1. **Code Organization**:
   - Keep related code together within appropriate subdirectories
   - Avoid duplicating code across features
   - Extract common logic to shared utilities
   - Document public APIs and interfaces

2. **Importing Shared Code**:
   - Use barrel files (index.ts) for clean imports
   - Import only what is needed to minimize bundle size
   - Follow a consistent import pattern
   - Consider code splitting for large modules

3. **Maintaining Shared Code**:
   - Document breaking changes
   - Write comprehensive tests
   - Consider backward compatibility
   - Provide migration guides when necessary
   - Keep dependencies up to date

## Example Usage

```typescript
// Importing from shared directories
import { CONFIG } from '@/shared/config';
import { useAuth } from '@/shared/hooks';
import { User } from '@/shared/types';
import { formatCurrency } from '@/shared/utils';

// Using shared functionality in a component
function UserProfile({ userId }: { userId: string }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <Loading />;
  }
  
  return (
    <View>
      <Text>{user.displayName}</Text>
      <Text>{formatCurrency(user.balance)}</Text>
      {CONFIG.FEATURES.SOCIAL_FEED && <SocialFeed userId={userId} />}
    </View>
  );
}
```

## Contributing to Shared Code

When adding or modifying shared code:

1. Consider the impact on existing features
2. Document the purpose and usage
3. Write unit tests for new functionality
4. Follow established patterns and conventions
5. Consider performance implications
6. Update relevant documentation
7. Review for reusability and modularity 