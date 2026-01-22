# MoonPay Module

This module integrates MoonPay services into the application, allowing users to easily purchase cryptocurrency (on-ramp) using various payment methods. It utilizes the `@moonpay/react-native-moonpay-sdk` for embedding the MoonPay widget directly within the app with comprehensive parameter support as per the [official MoonPay documentation](https://dev.moonpay.com/docs/ramps-sdk-buy-params).

**Primary Focus: Solana Ecosystem** - This module is optimized for Solana as the default blockchain, making it easy for users to purchase SOL and Solana-based tokens.

## Core Functionalities

- **Solana-First Crypto On-Ramp**: Provides a UI for users to buy Solana (SOL) and other cryptocurrencies via MoonPay, with Solana as the default.
- **Comprehensive Parameter Support**: Supports all MoonPay parameters including currency selection, amounts, payment methods, theming, and more.
- **Wallet Integration**: Automatically uses the connected Solana wallet address for transactions.
- **Customizable Widget**: The MoonPay widget can be configured for different environments (sandbox/production) and appearance.
- **Parameter Validation**: Built-in validation for MoonPay parameters to ensure correct configuration.
- **Error Handling**: Comprehensive error handling with user-friendly messages.

## Module Structure

```
src/modules/moonpay/
├── components/
│   └── MoonPayWidget/        # Component that wraps the MoonPay SDK's WebView.
│       ├── index.tsx         # Logic for the MoonPay widget with comprehensive parameter support.
│       └── styles.ts         # Styles for the widget component.
├── screens/
│   ├── OnrampScreen/         # Screen that hosts the MoonPay widget and provides additional info.
│   │   ├── index.tsx         # Main logic for the on-ramp screen.
│   │   └── styles.ts         # Styles for the on-ramp screen.
│   └── WalletScreen.tsx      # A screen displaying wallet balance and providing an entry point to the on-ramp flow.
│   └── WalletScreen.style.ts # Styles for the WalletScreen.
├── services/
│   └── moonpayService.ts     # Enhanced service utility with parameter support and validation.
├── types/
│   └── index.ts              # Comprehensive TypeScript type definitions matching MoonPay API.
├── utils/
│   └── moonpayUtils.ts       # Enhanced utility functions with parameter validation and helpers.
└── index.ts                  # Main barrel file for exporting module components and services.
└── README.md                 # This file.
```

## Key Components

### `MoonPayWidget` (`components/MoonPayWidget/index.tsx`)

The core UI component that embeds the MoonPay WebView with comprehensive parameter support:

**Props:**
- `apiKey` (required): Your MoonPay API key
- `environment`: 'sandbox' | 'production' (defaults to 'sandbox')
- `parameters`: Comprehensive MoonPay parameters object (see MoonPayParameters interface)
- `onOpen`: Callback when widget opens
- `onError`: Callback for error handling
- `onTransactionCompleted`: Callback when transaction is completed
- `onClose`: Callback when widget is closed
- `height`: Widget container height
- `onRetry`: Callback for retry actions

**Example Usage:**
```typescript
<MoonPayWidget
  apiKey="pk_test_your_api_key"
  environment="sandbox"
  parameters={{
    currencyCode: 'sol',
    baseCurrencyAmount: '100',
    baseCurrencyCode: 'usd',
    theme: 'dark',
    email: 'user@example.com',
    redirectURL: 'myapp://transaction-complete',
    showWalletAddressForm: false,
  }}
  onTransactionCompleted={(id, status) => {
    console.log('Transaction completed:', id, status);
  }}
  height={600}
/>
```

## Supported MoonPay Parameters

This module supports all official MoonPay parameters as documented in their API:

### Required Parameters
- `apiKey`: Your publishable API key

### Currency Configuration
- `currencyCode`: Specific cryptocurrency to purchase
- `defaultCurrencyCode`: Preferred cryptocurrency (user can change)
- `showAllCurrencies`: Show all enabled currencies
- `showOnlyCurrencies`: Comma-separated list of specific currencies

### Wallet Configuration
- `walletAddress`: Pre-fill wallet address
- `walletAddressTag`: Secondary address identifier (for XRP, EOS, etc.)
- `walletAddresses`: JSON object with multiple wallet addresses
- `walletAddressTags`: JSON object with multiple address tags
- `showWalletAddressForm`: Show address form even with pre-filled address

### Amount Configuration
- `baseCurrencyAmount`: Fiat amount to spend
- `quoteCurrencyAmount`: Crypto amount to buy
- `baseCurrencyCode`: Fiat currency code (usd, eur, etc.)
- `lockAmount`: Prevent amount modification

### Appearance & Theming
- `theme`: 'dark' | 'light'
- `colorCode`: Hexadecimal color for branding
- `themeId`: Custom theme ID
- `language`: ISO 639-1 language code

### User Information
- `email`: Pre-fill customer email
- `externalCustomerId`: Your customer identifier
- `externalTransactionId`: Your transaction identifier

### Payment & Flow
- `paymentMethod`: Pre-select payment method
- `redirectURL`: Post-transaction redirect URL
- `unsupportedRegionRedirectUrl`: Redirect for unsupported regions
- `skipUnsupportedRegionScreen`: Skip unsupported region screen

## Enhanced Services (`services/moonpayService.ts`)

**`createMoonPayService(config: MoonPayConfig)`**:
- Enhanced URL generation with Solana-first parameter support
- Parameter validation and currency information helpers
- Solana wallet address validation

**Methods:**
- `getWidgetUrl(customParams)`: Generate MoonPay URL with parameters (defaults to Solana)
- `validateConfig()`: Validate configuration
- `getSupportedCurrencies()`: Get supported currency list (Solana listed first)
- `validateWalletAddress(address, currency)`: Validate wallet address format (optimized for Solana)

## Enhanced Utilities (`utils/moonpayUtils.ts`)

**New Functions:**
- `validateMoonPayParameters(params)`: Comprehensive parameter validation
- `sanitizeMoonPayParameters(params)`: Convert parameters to URL-safe format
- `getDefaultParameters(useCase)`: Get preset parameters for common scenarios (defaults to Solana)
- Enhanced error message parsing with MoonPay-specific errors

**Preset Use Cases:**
- `'solana'` (default): Solana-optimized parameters
- `'ethereum'`: Ethereum-optimized parameters  
- `'basic'`: Basic USD configuration without specific currency

## Type Definitions (`types/index.ts`)

### `MoonPayParameters`
Comprehensive interface matching all MoonPay API parameters with proper TypeScript typing.

### `MoonPayWidgetProps`
Enhanced props interface for the widget component with parameter support.

### `MoonPayConfig`
Service configuration with default parameters support.

### `MoonPayTransactionStatus`
Type definition for transaction status values.

## Usage Examples

### Basic Usage (Defaults to Solana)
```typescript
import { MoonPayWidget } from '@/modules/moonpay';

function PurchaseScreen() {
  return (
    <MoonPayWidget
      apiKey="pk_test_your_api_key"
      // No parameters needed - defaults to Solana configuration
    />
  );
}
```

### Solana-Specific Configuration
```typescript
import { MoonPayWidget, getDefaultParameters } from '@/modules/moonpay';

function SolanaPurchaseScreen() {
  return (
    <MoonPayWidget
      apiKey="pk_test_your_api_key"
      environment="sandbox"
      parameters={{
        // Solana is already the default, but you can specify it explicitly
        currencyCode: 'sol',
        baseCurrencyAmount: '100',
        baseCurrencyCode: 'usd',
        email: 'user@example.com',
        lockAmount: true,
        redirectURL: 'myapp://success',
        paymentMethod: 'credit_debit_card',
      }}
      onTransactionCompleted={(id, status) => {
        console.log('SOL purchase completed:', id, status);
      }}
    />
  );
}
```

### Multi-Currency Configuration
```typescript
import { MoonPayWidget } from '@/modules/moonpay';

function MultiCurrencyScreen() {
  return (
    <MoonPayWidget
      apiKey="pk_test_your_api_key"
      parameters={{
        // Show multiple Solana ecosystem tokens
        showOnlyCurrencies: 'sol,usdc,usdt',
        defaultCurrencyCode: 'sol', // Still default to SOL
        baseCurrencyAmount: '50',
      }}
    />
  );
}
```

### Service Usage
```typescript
import { createMoonPayService } from '@/modules/moonpay';

const moonPayService = createMoonPayService({
  apiKey: 'pk_test_your_api_key',
  environment: 'sandbox',
  // No defaultParameters needed - automatically uses Solana defaults
});

// Generate URL for Solana purchase
const widgetUrl = moonPayService.getWidgetUrl({
  walletAddress: 'your_solana_wallet_address',
  baseCurrencyAmount: '100',
});

// Validate Solana wallet address
const isValid = moonPayService.validateWalletAddress(
  'your_solana_wallet_address',
  'sol'
);
```

## Environment Variables

- **`MOONPAY_API_KEY`**: Your MoonPay API key (e.g., `pk_test_xxxx` or `pk_live_xxxx`). This is crucial for the widget to function.

Make sure this variable is available in your environment (e.g., via a `.env` file).

## Best Practices

1. **Solana-First Approach**: The module defaults to Solana - no additional configuration needed for SOL purchases
2. **Parameter Validation**: Always validate parameters before passing to the widget
3. **Error Handling**: Implement proper error handling for network issues and invalid configurations
4. **User Experience**: Use loading states and retry mechanisms for better UX
5. **Security**: Use signed URLs for production environments when pre-filling sensitive data
6. **Testing**: Test thoroughly in sandbox environment before going live
7. **Responsive Design**: Ensure widget height is appropriate for different screen sizes