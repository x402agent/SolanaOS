<div align="center">

# Solana App Kit

### Open-Source React Native Scaffold for Building iOS and Android Crypto Mobile Apps with Solana Protocols.

<p> From AI to Social, Launchpads to Wallets, and Trading — build mobile apps in under 15 minutes. </p>

![SolanaAppKit](https://github.com/user-attachments/assets/b4a6dbbd-1073-412a-a5b9-4c2e41e39964)

<p align="center">
  <a href="https://www.npmjs.com/package/start-solana-app?activeTab=readme"><img src="https://img.shields.io/npm/dm/start-solana-app?style=for-the-badge&color=4CAF50" alt="NPM Downloads" /></a>
  <a href="https://github.com/SendArcade/solana-app-kit/network/members"><img src="https://img.shields.io/github/forks/sendarcade/solana-app-kit?style=for-the-badge&color=blue" alt="GitHub Forks" /></a>
  <a href="https://github.com/SendArcade/solana-app-kit/blob/main/LICENSE"><img src="https://img.shields.io/github/license/sendarcade/solana-app-kit?style=for-the-badge&color=orange" alt="GitHub License" /></a>
</p>

<p align="center">
  <a href="https://deepwiki.com/SendArcade/solana-app-kit"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki" /></a>
  <a href="https://x.com/solanaappkit"><img src="https://img.shields.io/twitter/follow/solanaappkit?style=flat&color=1DA1F2" alt="X (formerly Twitter) Follow" /></a>
</p>

<p> Anyone — whether a seasoned React Native developer or a Solana developer — can build mobile apps faster with 19+ protocol integrations. </div>

## Key Protocol Integrations

1. **Swaps:**  
   In-App trading via [Jupiter](https://jup.ag/) for the best prices across all DEXs, and native [Pump AMM](https://swap.pump.fun/)

2. **Launchpads:**  
   The three biggest Solana launchpads with configurable bonding curves – [Pump.fun](https://pump.fun/), [Raydium](https://raydium.io/launchpad/), and [Meteora](https://app.meteora.ag/) – along with [Token Mill](https://tokenmill.xyz/)

3. **Embedded Wallets:**  
   Top wallets like [Privy](https://www.privy.io/), [Turnkey](https://turnkey.com/), and [Dynamic](https://www.dynamic.xyz/), along with Mobile Wallet Adapter support by [Solana Mobile](https://solanamobile.com/) for external wallet connections.

4. **Token Data & Prices:**  
   Live prices and token info from [Coingecko](https://www.coingecko.com/), [Birdeye](https://birdeye.so/), and [Rugcheck](https://rugcheck.xyz/)

5. **NFTs:**  
   NFT minting via [Metaplex](https://www.metaplex.com/) and trading via [Tensor](https://www.tensor.trade/)

6. **AI Integration:**  
   [SendAI](https://sendai.fun/) for AI chat integration to take Solana actions

7. **On/Off-Ramps:**  
   Buy/sell crypto using cards or Apple Pay with [MoonPay](https://www.moonpay.com/) and [Mercuryo](https://mercuryo.io/) *(work in progress)*

8. **Miscellaneous Tools:**  
   [Jito Bundles](https://www.jito.network/) and [Helius](https://www.helius.dev/) for transaction landing

---

## 📋 Detailed Table of Contents

- [📱 App Features](#-app-features)
- [📚 Documentation](#-documentation)
- [📦 Core Installation](#-core-installation)
- [🛠️ Tech Stack](#️-tech-stack)
- [✅ Prerequisites](#-prerequisites)
- [🚀 Quick Start](#-quick-start)
- [⌨️ Hotkeys](#️-hotkeys)
- [🧪 Development Mode Guide](#-development-mode-guide)
- [🏁 Getting Started](#-getting-started)
- [📂 Project Structure](#-project-structure)
- [🧩 Modules](#-modules)
- [📊 Examples](#-examples)
- [🚢 Production Deployment](#-production-deployment)
- [📚 Dependencies](#-dependencies)
- [🤝 Contributing](#-contributing)
- [👥 Contributors](#-contributors)
- [📄 License](#-license)
- [❓ Troubleshooting](#-troubleshooting)
- [🔒 Security](#-security)
- [🌐 Community](#-community)

---

## 📱 App Features

| Feature                   | Description                                                                                                                                                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 👛 **Wallet Integration** | • Multiple wallet connection methods<br>• Embedded wallet support via Privy, Dynamic, and Turnkey<br>• External wallet connections via Solana Mobile MWA<br>• Transaction signing and management<br>                                                                          |
| 👥 **Social Features**    | • User profiles and following system<br>• Social feed with posts and interactions<br>• Community engagement features<br>• NFT display and management<br>• IPFS storage for metadata                                                                                           |
| 🎨 **UI/UX**              | • Modern, responsive design<br>• Tab-based navigation<br>• Interactive charts and visualizations<br>• Elegant loading states and error handling<br>• Platform-specific optimizations                                                                                          |
| 🖥️ **Backend Features**   | • RESTful API for token operations<br>• Social data storage and retrieval<br>• Token market creation and management<br>• Token swapping via Jupiter and PumpSwap<br>• Token launching via different launchpads like Pump, Raydium, and Meteora <br>• Image upload and storage |

---

## 📚 Documentation

You can view the full documentation of the kit at: [http://docs.solanaappkit.com/](http://docs.solanaappkit.com/)

---

## 📦 Core Installation

```sh
npx start-solana-app
```

---

## 🛠️ Tech Stack

<div align="center">
  <table>
    <tr>
      <td align="center"><a href="https://reactnative.dev/" target="_blank" rel="noopener noreferrer"><img src="https://d33wubrfki0l68.cloudfront.net/554c3b0e09cf167f0281fda839a5433f2040b349/ecfc9/img/header_logo.svg" width="60" height="60" alt="React Native" /><br /><b>React Native</b></a></td>
      <td align="center"><a href="https://expo.dev/" target="_blank" rel="noopener noreferrer"><img src="https://www.vectorlogo.zone/logos/expoio/expoio-icon.svg" width="60" height="60" alt="Expo" /><br /><b>Expo</b></a></td>
      <td align="center"><a href="https://solana.com/docs/clients/javascript" target="_blank" rel="noopener noreferrer"><img src="https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/solana/info/logo.png" width="60" height="60" alt="Solana Web3.js" /><br /><b>Solana Kit</b></a></td>
      <td align="center"><a href="https://www.typescriptlang.org/" target="_blank" rel="noopener noreferrer"><img src="https://cdn.worldvectorlogo.com/logos/typescript.svg" width="60" height="60" alt="TypeScript" /><br /><b>TypeScript</b></a></td>
      <td align="center"><a href="https://www.postgresql.org/" target="_blank" rel="noopener noreferrer"><img src="https://cdn.worldvectorlogo.com/logos/postgresql.svg" width="60" height="60" alt="PostgreSQL" /><br /><b>PostgreSQL</b></a></td>
    </tr>
  </table>
</div>

---

## ✅ Prerequisites

- Node.js >= 18
- pnpm or yarn or npm
- iOS: XCode and CocoaPods
- Android: Android Studio, Android SDK, and JDK
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- PostgreSQL database (for the server)

---

## 🚀 Quick Start

1. Clone the repository:

   ```sh
   git clone https://github.com/SendArcade/solana-app-kit.git
   cd solana-app-kit
   ```

2. Install dependencies:

   ```sh
   pnpm install
   ```

3. Create a `.env.local` file with your environment variables (see Environment Variables section)

4. Run the app in development mode with dev tools enabled:

   ```sh
   # Run with development tools enabled
   pnpm dev

   # Or with the standard npm command
   npm run dev
   ```

5. Run on a specific platform:

   ```sh
   # For iOS
   npx expo run:ios

   # For Android
   npx expo run:android
   ```

To run in development mode with cache clearing:

```sh
pnpm start --dev --clear
```

### Development vs Standard Mode

Solana App Kit supports two running modes:

- **Standard Mode**: Default production-like experience
- **Development Mode**: Enhanced with developer tools, navigation helpers, and error handling

To run in development mode, use the `--dev` flag or the `dev` script:

```sh
# Using npm script
npm run dev

# Or with the start script flag
npm start --dev
```

---

## ⌨️ Hotkeys

When running the Expo development server:

| Key | Action                   |
| --- | ------------------------ |
| `i` | Open on iOS simulator    |
| `a` | Open on Android emulator |
| `r` | Reload the app           |
| `m` | Toggle the menu          |
| `d` | Open developer tools     |

---

## 🧪 Development Mode Guide

For details on running the app in development mode, including environment variable handling and troubleshooting, please refer to the [Development Mode Guide](docs/DEV_MODE.md).

---

## 🏁 Getting Started

This project consists of two main parts:

1. React Native mobile application (in the root directory)
2. Backend server (in the `server` directory)

### Mobile App Installation

1. Clone the repository:

   ```sh
   git clone https://github.com/SendArcade/solana-app-kit.git
   cd solana-app-kit
   ```

2. Install dependencies:

   ```sh
   pnpm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory with the necessary variables as shown in the example below:

   ```
   # Blockchain
   CLUSTER=mainnet-beta

   # Authentication
   PRIVY_APP_ID=your_privy_app_id
   PRIVY_CLIENT_ID=your_privy_client_id
   DYNAMIC_ENVIRONMENT_ID=your_dynamic_env_id

   # Turnkey wallet
   TURNKEY_BASE_URL=https://api.turnkey.com
   TURNKEY_RP_ID=host.exp.exponent
   TURNKEY_RP_NAME=send-fi
   TURNKEY_ORGANIZATION_ID=your_turnkey_organization_id
   TURNKEY_API_PUBLIC_KEY=your_turnkey_public_key
   TURNKEY_API_PRIVATE_KEY=your_turnkey_private_key

   # APIs
   HELIUS_API_KEY=your_helius_api_key
   HELIUS_RPC_CLUSTER=mainnet
   HELIUS_STAKED_URL=your_helius_staked_url
   HELIUS_STAKED_API_KEY=your_helius_staked_api_key
   SERVER_URL=your_server_url
   TENSOR_API_KEY=your_tensor_api_key
   COINGECKO_API_KEY=your_coingecko_api_key
   BIRDEYE_API_KEY=your_birdeye_api_key
   COIN_MARKE_CAPAPI_KEY=your_coinmarketcap_api_key
   OPENAI_API_KEY=your_openai_api_key
   COMMISSION_WALLET=your_commission_wallet_address
   ```

### Server Installation

1. Navigate to the server directory:

   ```sh
   cd server
   ```

2. Install server dependencies:

   ```sh
   pnpm install
   ```

3. Set up server environment variables:

   ```sh
   cp .env.example .env
   ```

   Required server environment variables:

   ```
   WALLET_PRIVATE_KEY=your_wallet_private_key
   RPC_URL=your_helius_rpc_url
   TOKEN_MILL_PROGRAMID=your_token_mill_program_id
   TOKEN_MILL_CONFIG_PDA=your_token_mill_config_pda
   SWAP_AUTHORITY_KEY=your_swap_authority_key
   COMMISSION_WALLET=your_commission_wallet_address

   # Pinata for IPFS
   PINATA_JWT=your_pinata_jwt
   PINATA_GATEWAY=your_pinata_gateway
   PINATA_SECRET=your_pinata_secret
   PINATA_API_KEY=your_pinata_api_key

   # Database and Storage
   DATABASE_URL=your_postgresql_url
   GCS_BUCKET_NAME=your_gcs_bucket_name
   SERVICE_ACCOUNT_EMAIL=your_service_account_email

   # Turnkey
   TURNKEY_API_URL=https://api.turnkey.com
   TURNKEY_ORGANIZATION_ID=your_turnkey_organization_id
   TURNKEY_API_PUBLIC_KEY=your_turnkey_api_public_key
   TURNKEY_API_PRIVATE_KEY=your_turnkey_api_private_key

   # Supabase
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Start the development server:
   ```sh
   pnpm dev
   # or
   yarn dev
   ```

For more details about the server, see the [Server README](server/README.md).

### Environment Variables for EAS Builds

The project is configured to use the `.env.local` file for both local development and EAS builds. When building with EAS, the environment file is automatically loaded:

```sh
# Example for a development build on Android
npx eas build --profile development --platform android
```

The configuration in `eas.json` specifies the `.env.local` file for each build profile. The babel configuration dynamically loads this file during the build process.

### Running the Mobile App

#### Standard vs Development Mode

The app can run in two modes:

1. **Standard Mode** (Default):

   - Regular production-like environment
   - Missing environment variables will show warnings but limit functionality

2. **Development Mode**:
   - Enhanced developer tools and diagnostics
   - Visual indicator showing "DEV MODE" at the bottom of the screen
   - Access to developer drawer with navigation shortcuts and environment variable status
   - Ability to bypass authentication for testing
   - Missing environment variables are clearly displayed with options to fix

#### Starting the App

To start the app:

```sh
# Standard mode
pnpm start
# or
npm start

# Development mode
pnpm dev
# or
npm run dev
# or
pnpm start --dev
```

#### Missing Environment Variables

If you're missing environment variables:

- In standard mode: A warning banner will appear on the login screen alerting you
- In dev mode: A detailed drawer will show all missing variables, and you can bypass authentication

To enable dev mode from standard mode when env vars are missing:

1. A warning will appear with an "Enable Dev Mode" button
2. After enabling, restart the app
3. You'll see a green "DEV MODE" indicator at the bottom of the screen
4. Tap it to access developer tools

#### iOS

For iOS, you need to install CocoaPods dependencies first:

```sh
# Install Ruby bundler (first time only)
bundle install

# Install CocoaPods dependencies
bundle exec pod install
```

Then run the app:

```sh
pnpm ios
# or
yarn ios
# or
npm run ios
```

#### Android

```sh
pnpm android
# or
yarn android
# or
npm run android
```

##### Android SDK Setup

If you encounter Android SDK location errors, you need to set up your Android environment variables. Add the following to your shell configuration file (`.zshrc`, `.bashrc`, or `.bash_profile`):

```sh
# Android SDK setup (macOS)
export ANDROID_HOME=~/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

For temporary setup in your current terminal session:

```sh
export ANDROID_HOME=~/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

**Note:** Make sure you have Android Studio installed and the Android SDK is located at `~/Library/Android/sdk` (macOS) or adjust the path accordingly for your system.

---

## 📂 Project Structure

```
solana-app-kit/
├── src/                # Mobile app source code
│   ├── assets/         # Images, icons, and other static assets
│   │   ├── images/     # Image assets for the app
│   │   ├── svgs/       # SVG graphic files
│   │   ├── colors.ts   # Color definitions
│   │   └── typography.ts # Typography definitions
│   ├── core/           # Core application components
│   │   ├── chat/       # Chat functionality components
│   │   ├── dev-mode/   # Development mode utilities
│   │   ├── profile/    # User profile related components
│   │   ├── shared-ui/  # Common UI components
│   │   └── thread/     # Thread-related components
│   ├── modules/        # Feature modules (core functionality)
│   │   ├── data-module/ # Data management module
│   │   ├── meteora/    # Meteora integration
│   │   ├── moonpay/    # Moonpay integration
│   │   ├── nft/        # NFT display and management
│   │   ├── pump-fun/   # Pump.fun integration
│   │   ├── raydium/    # Raydium integration
│   │   ├── solana-agent-kit/ # Solana agent kit integration
│   │   ├── swap/       # Swap functionality
│   │   ├── token-mill/ # Token creation and management
│   │   └── wallet-providers/ # Wallet connection adapters
│   ├── screens/        # App screens and UI flows
│   │   ├── common/     # Common screen components
│   │   ├── sample-ui/  # Sample UI screens
│   │   └── index.ts    # Screen exports
│   ├── server/         # Server-related functionality
│   │   └── meteora/    # Meteora server integration
│   └── shared/         # Shared utilities and components
│       ├── config/     # Configuration files
│       ├── context/    # React context providers
│       ├── hooks/      # Custom React hooks
│       ├── mocks/      # Mock data for testing
│       ├── navigation/ # Navigation configuration
│       ├── services/   # API integrations and business logic
│       ├── state/      # Redux store and slices
│       │   ├── auth/   # Authentication state management
│       │   ├── chat/   # Chat state management
│       │   ├── notification/ # Notification state management
│       │   ├── profile/ # Profile state management
│       │   ├── thread/ # Thread state management
│       │   ├── transaction/ # Transaction state management
│       │   ├── users/  # User state management
│       │   └── store.ts # Redux store configuration
│       ├── types/      # TypeScript type definitions
│       └── utils/      # Utility functions and helpers
│           └── common/ # Common utility functions
├── server/             # Backend server code
│   ├── src/            # Server source code
│   │   ├── controllers/ # Controller functions
│   │   ├── db/         # Database configuration
│   │   ├── routes/     # API endpoints
│   │   ├── service/    # Service implementations
│   │   ├── types/      # TypeScript types
│   │   └── utils/      # Utility functions
│   ├── .env.example    # Example environment variables
│   └── README.md       # Server documentation
├── App.tsx             # Main application component
├── index.js            # Entry point
├── app.config.js       # Expo configuration
├── app.json            # App configuration
├── babel.config.js     # Babel configuration
├── metro.config.js     # Metro bundler configuration
├── tsconfig.json       # TypeScript configuration
├── docs/               # Documentation files
├── CONTRIBUTING.md     # Contribution guidelines
├── LICENSE             # License information
└── package.json        # Dependencies and scripts
```

---

## 🧩 Modules

The Solana App Kit provides several modular features that can be used independently:

| Module                  | Capabilities                                                                                                                                                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔐 **embedded-wallet-providers** | • Multiple wallet connection methods (Privy, Dynamic, Mobile Wallet Adapter)<br>• Standardized wallet interface<br>• Transaction handling across providers<br>• Support for embedded wallets, social login, and external wallets                                                 |
| 📊 **data-module**      | • Fetching on-chain data with optimized RPC calls<br>• Token balance tracking<br>• Transaction history display<br>• Real-time data synchronization                                                                                                                               |
| 🖼️ **nft**              | • NFT display, management, and trading<br>• Collection viewing with floor prices<br>• Compressed NFT support<br>• Integration with threads and posts                                                                                                                             |
| 💱 **swap**             | • Token swapping using multiple DEX SDKs<br>• Liquidity pool creation with custom token pairs<br>• Liquidity management (add and remove liquidity)<br>• Pool creation with custom parameters<br>• Real-time quotes and price impact estimates<br>• Transaction status monitoring |
| 🚀 **pump-fun**         | • Integration with the Pump.fun ecosystem<br>• Meme token creation and management<br>• Community engagement tools                                                                                                                                                                |
| 💹 **raydium**          | • Raydium DEX integration<br>• Token launching and trading<br>• Pool creation and management                                                                                                                                                                                     |
| 🌊 **meteora**          | • Meteora protocol integration<br>• Token launching capabilities<br>• Pool and liquidity management                                                                                                                                                                              |
| 💸 **moonpay**          | • Fiat on-ramp integration<br>• Buy crypto with credit cards and Apple Pay<br>• Seamless payment flow                                                                                                                                                                            |
| 🏦 **mercuryo**         | • Fiat gateway integration *(work in progress)*<br>• On-ramp functionality<br>• Multiple payment methods support<br>• Real-time exchange rates                                                                                                                      |
| 🤖 **solana-agent-kit** | • AI agent integration for Solana interactions<br>• Automated workflows and actions<br>• Enhanced user assistance                                                                                                                                                                |
| 🪙 **token-mill**       | • Token creation with configurable parameters<br>• Bonding curve configuration for token pricing<br>• Token swapping (buy/sell) functionality<br>• Staking tokens for rewards<br>• Creating and releasing vesting plans                                                          |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

For detailed guidelines on how to contribute to this project, see our [Contributing Guide](CONTRIBUTING.md).

---

## 👥 Contributors

<div align="center">
  <a href="https://github.com/SendArcade/solana-app-kit/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=SendArcade/solana-app-kit" alt="Contributors" />
  </a>
</div>

---

## 🔒 Security

This toolkit handles transaction generation, signing and sending, using provided wallets. Always ensure you're using it in a secure environment and never share your private keys.

---

## ❓ Troubleshooting

Common issues and their solutions:

| Issue                        | Solution                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| **Expo build errors**        | Clear your cache with `expo start --clear`                                                  |
| **Wallet connection issues** | Ensure you're using the correct provider and have properly configured environment variables |
| **iOS simulator issues**     | Try resetting the simulator or running `pod install` in the iOS directory                   |

---

## 🌐 Community

Join our community to get help, share your projects, and contribute:

[![telegram_badge]][telegram_link]

[telegram_badge]: https://img.shields.io/badge/telegram-❤️-252850?style=plastic&logo=telegram
[telegram_link]: https://t.me/solanaappkit

[![X (formerly Twitter) Follow](https://img.shields.io/twitter/follow/solanaappkit)](https://x.com/solanaappkit)

---

## 📄 License

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with ❤️ for the Solana ecosystem by SendAI and Send Arcade.

</div>
