# Shared UI Components

This directory contains reusable UI components that are shared across different modules of the application. These components provide consistent styling and behavior throughout the app.

## Available Components

### App Structure
- **AppHeader**: A customizable header component with back button, title, and action buttons
- **TransactionNotification**: Animated notification component for transaction status updates

### Environment Error Components
- **EnvErrorMessage**: Displays error messages for missing environment variables for specific features
- **HomeEnvErrorBanner**: Prominent banner for the home screen showing missing environment variables

### Token Components
- **TokenDetailsDrawer**: Bottom drawer showing comprehensive token information and analytics
- **TradeCard**: Card component for displaying token trading information with a line graph
- **TrendingTokenDetails**: 
  - **TokenDetailsSheet**: Modal sheet displaying detailed token information
  - **RiskAnalysisSection**: Security analysis section showing token risk assessment

### NFT Components
- **NFTCollectionDrawer**: Bottom drawer showing NFT collection information

## Component Documentation

### AppHeader

A flexible header component that supports customization with title, navigation, and action buttons.

```jsx
import { AppHeader } from '@core/shared-ui';

<AppHeader 
  title="Dashboard"
  showBackButton={true}
  onBackPress={() => navigation.goBack()} 
  showDefaultRightIcons={true}
  onWalletPress={() => navigation.navigate('WalletScreen')}
/>
```

**Props:**
- `title`: Title to display in the center
- `showBackButton`: Whether to show back button (default: true)
- `showBottomGradient`: Whether to show bottom border gradient (default: true)
- `showDefaultRightIcons`: Whether to show default right icons (wallet) (default: true)
- `leftComponent`: Custom component to render on the left
- `rightComponent`: Custom component to render on the right
- `onBackPress`: Custom function to handle back button press
- `onWalletPress`: Custom function to handle wallet icon press
- `style`: Additional styles for the header container
- `gradientColors`: Custom gradient colors for the bottom border

### TransactionNotification

An animated notification component that displays transaction success/error messages.

```jsx
// This component connects to the Redux store automatically
// To show a notification, dispatch the showNotification action
import { showNotification } from '@/shared/state/notification/actions';

dispatch(showNotification({
  message: 'Transaction confirmed!',
  type: 'success'
}));
```

### TokenDetailsDrawer

A bottom drawer that displays comprehensive token information and analytics.

```jsx
import { TokenDetailsDrawer } from '@core/shared-ui';

<TokenDetailsDrawer 
  isVisible={showTokenDetails}
  tokenAddress="FTMVQAsLxUxCYqnBGUf8tTbXMnEMtJ4enj7Q5Er1HgZY"
  onClose={() => setShowTokenDetails(false)}
/>
```

### TradeCard

A card component for displaying token trading information with a line graph.

```jsx
import { TradeCard } from '@core/shared-ui';

<TradeCard
  token={{
    name: "SEND",
    symbol: "SEND",
    address: "FTMVQAsLxUxCYqnBGUf8tTbXMnEMtJ4enj7Q5Er1HgZY",
    logoURI: "https://example.com/token-logo.png",
    price: 1.234,
    priceChange24h: 5.67
  }}
  onPress={() => handleTokenPress(token)}
/>
```

### NFTCollectionDrawer

A bottom drawer showing NFT collection information.

```jsx
import { NFTCollectionDrawer } from '@core/shared-ui';

<NFTCollectionDrawer 
  isVisible={showNftCollection}
  collectionAddress="8tMLU5RKcKdRKzrHhCwmCvPH35n7PVS5CuJoEXJtKSWc"
  onClose={() => setShowNftCollection(false)}
/>
```

## Best Practices

1. Import components directly from the barrel file:
```jsx
import { AppHeader, TransactionNotification } from '@core/shared-ui';
```

2. For customization, use the provided props rather than wrapping components in additional views.

3. Each component follows the project's styling guidelines and color schemes from `@/assets/colors`.

4. All components are responsive and handle different screen sizes appropriately.

5. For components that need to connect to global state, use the corresponding hooks from the respective modules.

## Adding New Components

When adding new shared UI components:

1. Create a directory with the component name
2. Implement the component, styles, and types in separate files
3. Export the component from the top-level `index.ts`
4. Document the component in this README.md 