# Mocks

This directory contains mock data used for development, testing, and demonstration purposes. These mocks simulate the data structures and responses that would typically come from an API or blockchain.

## Directory Structure

```
mocks/
├── portfolio.ts         # Portfolio and asset data mocks
├── tweets.ts           # Social media tweet mocks
├── users.ts            # User profile mocks
├── profileInfoData.ts  # Extended profile information mocks
└── posts.ts           # Social media post mocks
```

## Purpose

The mock data serves several important purposes:

1. **Development**: Allows frontend development to proceed without waiting for backend APIs
2. **Testing**: Provides consistent test data for unit and integration tests
3. **Demonstrations**: Enables feature showcases and demos without requiring live data
4. **Documentation**: Illustrates expected data structures for integration

## Best Practices

1. **Data Structure**:
   - Mock data should match the expected API response format
   - Include all relevant fields, even if some contain placeholder values
   - Use TypeScript interfaces to ensure type safety
   - Document any assumptions about the data structure

2. **Usage**:
   - Import mock data only in development and testing environments
   - Consider using environment variables to control mock data usage
   - Document how to switch between mock and real data
   - Keep mock data reasonably sized to avoid performance issues

3. **Maintenance**:
   - Update mock data when API contracts change
   - Keep mock data realistic but not sensitive
   - Use factories or generators for creating large datasets
   - Consider moving complex mock data to JSON files

## Example Mock Implementation

```typescript
// users.ts
import { User } from '../types';

export const mockUsers: User[] = [
  {
    id: 'user-1',
    username: 'alice_web3',
    displayName: 'Alice',
    avatarUrl: 'https://example.com/avatar1.png',
    walletAddress: '0x1234...5678',
    bio: 'Blockchain enthusiast and developer',
    followers: 1250,
    following: 350,
    joinedDate: '2021-03-15T14:30:00Z',
  },
  {
    id: 'user-2',
    username: 'bob_crypto',
    displayName: 'Bob',
    avatarUrl: 'https://example.com/avatar2.png',
    walletAddress: '0x8765...4321',
    bio: 'DeFi trader and NFT collector',
    followers: 3500,
    following: 1200,
    joinedDate: '2020-11-08T09:45:00Z',
  },
  // More mock users...
];

// Helper function to get a user by ID
export function getMockUser(id: string): User | undefined {
  return mockUsers.find(user => user.id === id);
}
```

## Current Mock Data

### Portfolio

Mock portfolio data for demonstrating asset holdings, values, and performance metrics.

### Tweets

Simulated social media posts in tweet format for the social feed feature.

### Users

Mock user profiles with usernames, avatars, wallet addresses, and social metrics.

### Profile Info Data

Extended profile information including personal details and preferences.

### Posts

Comprehensive social media posts with comments, likes, and other engagement metrics.

## Using Mock Data in Development

```typescript
import { mockUsers } from '../shared/mocks/users';

// In a component
const DemoUserList = () => {
  // In a real implementation, this would fetch from an API
  const users = process.env.NODE_ENV === 'development' 
    ? mockUsers 
    : fetchUsersFromApi();
  
  return (
    <UserList users={users} />
  );
};
``` 