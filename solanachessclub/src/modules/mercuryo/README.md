# Mercuryo Module

This module provides fiat-to-crypto on-ramp and crypto-to-fiat off-ramp functionality through Mercuryo's payment gateway. It offers a seamless user interface for buying and selling cryptocurrencies with multiple payment methods and real-time rates.

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Module Structure](#-module-structure)
- [Payment Methods & Fees](#-payment-methods--fees)
- [Supported Assets](#-supported-assets)
- [Usage Examples](#-usage-examples)
- [Configuration](#-configuration)

## 🔍 Overview

The Mercuryo module integrates with Mercuryo's payment infrastructure to provide fiat gateway functionality. It enables seamless conversion between fiat currencies and cryptocurrencies through an intuitive interface with real-time exchange rates.

## ✨ Features

| Category | Features |
|----------|----------|
| **On-Ramp (Buy Crypto)** | • Fiat to crypto conversion<br>• Multiple currencies (USD, EUR, GBP)<br>• Real-time rates & transparent fees<br>• Instant & bank transfer options |
| **Off-Ramp (Sell Crypto)** | • Crypto to fiat conversion<br>• Fast settlement times<br>• Competitive exchange rates |
| **Payment Methods** | • Credit/Debit Cards (Visa, Mastercard, Amex)<br>• Apple Pay (iOS)<br>• Bank transfers<br>• 3D Secure authentication |
| **User Experience** | • Tab-based interface<br>• Real-time calculations<br>• Platform-optimized design<br>• Transaction summaries |

## 📁 Module Structure

```
src/modules/mercuryo/
├── index.ts                    # Main exports
├── screens/
│   └── MercuryoScreen.tsx     # Main Mercuryo interface
└── README.md                   # This documentation
```

## 💳 Payment Methods & Fees

| Method | Platforms | Fee | Processing Time |
|--------|-----------|-----|-----------------|
| **Credit/Debit Card** | iOS, Android | 2.5% | Instant |
| **Apple Pay** | iOS only | 1.8% | Instant |
| **Bank Transfer** | iOS, Android | 1.0% | 1-3 business days |

### Platform Support
```typescript
const filteredPaymentMethods = paymentMethods.filter(method =>
  !(method.appleOnly && Platform.OS !== 'ios')
);
```

## 🪙 Supported Assets

### Fiat Currencies
- **USD** ($) - United States
- **EUR** (€) - European Union  
- **GBP** (£) - United Kingdom

### Cryptocurrencies
- **SOL** - Solana
- **USDC** - USD Coin
- **BONK** - Bonk

## 🔄 Transaction Flow

### On-Ramp (Buy)
1. Enter fiat amount → 2. Select currencies → 3. Choose payment method → 4. Review & pay

### Off-Ramp (Sell)
1. Enter crypto amount → 2. Select currencies → 3. Bank details → 4. Confirm withdrawal

## 📚 Usage Examples

### Basic Integration
```typescript
import { MercuroScreen } from '@/modules/mercuryo';

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen 
          name="Mercuryo" 
          component={MercuroScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

### Navigation
```typescript
const navigation = useNavigation();

const openMercuryo = () => {
  navigation.navigate('Mercuryo');
};
```

## ⚙️ Configuration

### Environment Variables
```bash
MERCURYO_API_KEY=your_mercuryo_api_key
MERCURYO_ENVIRONMENT=sandbox # or production
MERCURYO_WIDGET_ID=your_widget_id
```

### Custom Assets
```typescript
const cryptos = [
  { code: 'SOL', name: 'Solana', logo: require('./assets/sol.png') },
  { code: 'USDC', name: 'USD Coin', logo: require('./assets/usdc.png') },
];
```

## 🎯 Key Features

- **Dual Mode**: On-ramp and off-ramp functionality
- **Multi-Payment**: Cards, Apple Pay, bank transfers
- **Real-time Rates**: Live exchange calculations
- **Platform Optimized**: iOS/Android specific features
- **Secure**: 3D Secure, KYC/AML compliance
- **Transparent Fees**: Clear fee structure display

---

**Built with ❤️ for seamless fiat-crypto conversions - Powered by Mercuryo** 