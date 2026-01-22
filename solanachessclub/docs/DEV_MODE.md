# Dev Mode

This document explains how to use the development mode features in the app, which allow the application to build and run even without all environment variables set.

## Enabling Dev Mode

Dev mode can be enabled in several ways:

1. **During startup** - Use the `--dev` flag when starting the app (recommended):

   ```bash
   # For development with dev mode enabled
   yarn start --dev
   # or
   npm run dev
   ```

2. **From within the app** - If you're running in standard mode and see a warning about missing environment variables, you can enable dev mode directly from the warning banner:
   - Tap the "Enable Dev Mode" button on the warning banner
   - Restart the app when prompted
   - The app will start in dev mode with the green indicator at the bottom of the screen

### Recommended: Clear Cache When Switching Dev Mode

When switching between normal mode and dev mode, it's recommended to clear the cache (using --clear flag) to ensure all settings are properly applied:

```bash
# Start with dev mode and clear cache
yarn start --dev --clear
```

## Understanding Environment Variable Warnings

### In Standard Mode:
When running in standard mode with missing environment variables:
- A warning banner will appear on the login screen
- The banner will highlight that some functionality may be limited
- You'll have options to:
  - Enable dev mode (recommended for development)
  - Dismiss the warning (functionality will still be limited)

### In Dev Mode:
When running in dev mode with missing environment variables:
- A "DEV MODE" indicator appears at the bottom of the screen
- Tapping this indicator opens the developer drawer with:
  - A complete list of all missing environment variables
  - Navigation shortcuts to all screens
  - Developer information
  - Authentication bypass options

## Switching Between Modes

### From Standard Mode to Dev Mode:
1. Tap the "Enable Dev Mode" button on the warning banner
2. Restart the app when prompted
3. You'll see the green "DEV MODE" indicator at the bottom of the screen

### From Dev Mode to Standard Mode:
1. Stop the app
2. Restart without the `--dev` flag:
   ```bash
   yarn start
   # or
   npm start
   ```
3. The "DEV MODE" indicator will no longer be present

## Troubleshooting Dev Mode

If dev mode isn't activating properly:

1. Check that the app is truly running in development mode (`--dev` flag)
2. Verify your `.env.local` file contains `EXPO_PUBLIC_DEV_MODE=true` with no typos
3. Try restarting the Metro bundler completely (kill the process and restart)
4. Check the console logs for any errors related to environment variables
5. As a last resort, try clearing the cache manually:
   ```bash
   # Clear Expo cache
   expo start -c
   # Or clear Metro bundler cache
   yarn start --reset-cache
   ```

## What Dev Mode Does

When dev mode is enabled:

1. The app builds and runs even if required environment variables are missing
2. A green "DEV MODE" indicator appears at the bottom of the screen
3. A dev tools drawer is accessible by tapping the indicator
4. Features requiring missing environment variables will show warnings instead of crashing
5. Mock data is used when possible for features requiring missing environment variables
6. Authentication can be bypassed for testing purposes

## Dev Mode Drawer

The dev mode drawer provides several useful utilities:

1. **Server Status**: Shows if your backend server is connected and responsive
2. **Missing Environment Variables**: Shows a list of all missing environment variables that might be needed for full app functionality
3. **App Navigation**: Allows direct navigation to any screen in the app without following normal navigation flows
4. **Developer Info**: Shows environment, app version, and login status information
5. **Force Login**: Allows bypassing authentication for testing protected features

## Environment Variable Handling

In dev mode, when the app encounters a missing environment variable:

1. The user sees an alert notification that the variable is missing
2. The app continues to run with mock data where possible
3. A warning is logged to the console
4. The missing variable is displayed in the dev drawer

In standard mode:
1. A warning banner appears on the login screen
2. The app continues with limited functionality
3. Features requiring the missing variables may not work correctly

## Implementing Dev Mode in Your Code

If you're adding new features that require environment variables, use the `getEnvWithFallback` function:

```typescript
import {getEnvWithFallback} from '../utils/envValidator';

// Basic usage with default empty string fallback
const apiKey = getEnvWithFallback('API_KEY', API_KEY, 'Feature Name', '');

// With a specific mock value
const apiUrl = getEnvWithFallback(
  'API_URL',
  API_URL,
  'Feature Name',
  'https://mock-api.example.com',
);

// Handle missing values
if (!apiKey && global.__DEV_MODE__) {
  console.log('[DEV MODE] Using mock implementation for Feature Name');
  // Implement mock version of the feature
  return mockData;
}

// Continue with normal implementation when variable exists
```

## Best Practices

1. Always include meaningful feature names when calling `getEnvWithFallback` to help users understand which functionality is affected.
2. Provide appropriate mock data for development.
3. Use `global.__DEV_MODE__` to check if dev mode is active elsewhere in your code.
4. Keep error messages helpful and informative.
5. Use the `--clear` flag when switching between normal and dev modes to avoid caching issues.

## Important Note

Dev mode is strictly for development purposes and should never be enabled in production. The mock data and behavior are intended to facilitate development only.
