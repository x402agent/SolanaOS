# Configuration

This directory contains configuration settings, constants, and customization options for the application. It centralizes all configurable parameters to make the application more maintainable and customizable.

## Directory Structure

```
config/
├── constants.ts                # Application-wide constants
├── index.ts                   # Configuration exports and defaults
└── CustomizationProvider.tsx  # Provider for app customization
```

## Configuration Components

### Constants (constants.ts)

Contains application-wide constants and fixed values that are used throughout the application. These include:

- API endpoints
- Default values
- Feature flags
- Timeout durations
- UI constants
- Error messages

### Configuration (index.ts)

Exports configuration settings, often sourced from environment variables with fallbacks to default values. This may include:

- API URLs
- Feature toggles
- Environment-specific settings
- Connection parameters
- Default user preferences

### Customization Provider (CustomizationProvider.tsx)

A React context provider that allows for runtime customization of the application, such as:

- Theming
- Layout preferences
- Feature enablement
- Branding options
- User experience settings

## Best Practices

1. **Configuration Management**:
   - Use environment variables for deployment-specific settings
   - Provide sensible defaults for all configuration values
   - Document each configuration option
   - Validate configuration at startup
   - Group related configuration options

2. **Constants**:
   - Use uppercase for constant names
   - Group constants by feature or domain
   - Provide descriptive names for all constants
   - Document the purpose and expected values

3. **Customization**:
   - Use React Context for runtime customization
   - Provide a clear API for customization
   - Document customization options
   - Ensure performance is maintained with customization
   - Test different customization configurations

## Example Configuration Pattern

```typescript
// constants.ts
export const API_TIMEOUT = 30000; // 30 seconds
export const MAX_RECONNECT_ATTEMPTS = 5;
export const DEFAULT_AVATAR = '/assets/default-avatar.png';

// Feature flags
export const FEATURES = {
  SOCIAL_FEED: true,
  NFT_GALLERY: true,
  CHAT: process.env.NODE_ENV === 'development',
};

// index.ts
export const CONFIG = {
  // API configuration
  API_URL: process.env.REACT_APP_API_URL || 'https://api.example.com',
  SOLANA_RPC_URL: process.env.REACT_APP_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  
  // Feature toggles
  FEATURES: {
    ...FEATURES,
    // Override from environment if provided
    ...(process.env.REACT_APP_FEATURES ? JSON.parse(process.env.REACT_APP_FEATURES) : {}),
  },
  
  // Connection settings
  CONNECTION: {
    TIMEOUT: API_TIMEOUT,
    MAX_RETRIES: 3,
  },
};
```

## Using Configuration

```typescript
import { CONFIG } from '../shared/config';

// In a component or service
function apiCall() {
  return fetch(`${CONFIG.API_URL}/endpoint`, {
    timeout: CONFIG.CONNECTION.TIMEOUT,
  });
}

// Feature flag check
function renderFeature() {
  if (CONFIG.FEATURES.SOCIAL_FEED) {
    return <SocialFeed />;
  }
  return null;
}
```

## Customization Provider Usage

```typescript
// App.tsx
import { CustomizationProvider } from '../shared/config/CustomizationProvider';

function App() {
  return (
    <CustomizationProvider theme="light" branding="default">
      <AppContent />
    </CustomizationProvider>
  );
}

// Using customization in a component
function ThemedComponent() {
  const { theme, branding } = useCustomization();
  
  return (
    <div className={`themed-component ${theme}`}>
      <img src={branding.logo} alt="Logo" />
      {/* ... */}
    </div>
  );
}
```

## Maintaining Configuration

1. Document all configuration options
2. Provide examples for different environments
3. Update documentation when adding new options
4. Consider using a configuration validation library
5. Test with different configuration settings
6. Create deployment-specific configuration examples 