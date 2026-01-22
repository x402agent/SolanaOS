# Developer Mode Module

The Developer Mode module provides components and utilities for enabling development and debugging features in applications. This module is intended for use during development and testing phases.

## Components

- **DevDrawer**: A comprehensive drawer component that shows development options and debugging tools including:
  - Environment variable inspection
  - Navigation map and screen navigation
  - Server status checking
  - Authentication bypass options
  - Performance monitoring

- **DevModeActivator**: Hidden component for activating/deactivating developer mode via a secret gesture (5 long presses in a specific area)

- **DevModeStatusBar**: Status bar indicating when developer mode is active and showing any environment variable errors

- **DevModeTrigger**: Interactive button overlay to open the developer drawer

- **DevModeWrapper**: Provider component that wraps the application and provides developer mode context

## Usage

```typescript
import { DevModeWrapper, DevDrawer, DevModeActivator } from '@core/dev-mode';

function App() {
  return (
    <DevModeWrapper>
      <MainApp />
      {/* DevDrawer is automatically included in DevModeWrapper */}
      <DevModeActivator />
    </DevModeWrapper>
  );
}
```

## Features

- Environment variable inspection and validation
- Interactive navigation map for quick screen navigation
- Server connection status monitoring
- Authentication bypass for testing
- Visual indicators for dev mode status
- Secure activation/deactivation mechanism
- Performance profiling
