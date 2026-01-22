# Data Module

This module is responsible for fetching, processing, and managing on-chain and off-chain data related to Solana assets, including tokens, NFTs, and market information. It provides a suite of services, hooks, and utilities to interact with various data sources like Helius, Birdeye, and CoinGecko.

## Core Functionalities

- **Token Data**: Fetch token metadata, balances, prices, and historical price data.
- **NFT & Asset Data**: Retrieve user portfolio assets, including NFTs and compressed NFTs (cNFTs).
- **Market Data**: Access market information from CoinGecko, including coin lists, market details, and OHLC data.
- **Swap Transactions**: Fetch and process user swap transaction history.
- **Token Details**: Provide comprehensive details for specific tokens, including overview, security, market data, and trade data, primarily using Birdeye.

## Module Structure

```
src/modules/data-module/
├── services/               # Core logic for interacting with external APIs and processing data.
│   ├── tokenService.ts       # Handles fetching token lists, metadata, balances, prices (Birdeye, Jupiter).
│   ├── coingeckoService.ts   # Interfaces with CoinGecko API for market data.
│   ├── swapTransactions.ts   # Fetches and processes user swap transaction history (Helius).
│   └── tokenDetailsService.ts  # Fetches detailed token information (price history, overview, security - Birdeye).
├── hooks/                  # Custom React hooks for easy integration of data-fetching logic into UI components.
│   ├── useFetchTokens.ts     # Hook to fetch and manage user portfolio assets (tokens, NFTs, cNFTs).
│   ├── useCoingecko.ts       # Hook to interact with CoinGecko data (coin list, market details, OHLC).
│   ├── useTokenDetails.ts    # Hook to fetch and manage detailed information for a specific token.
│   └── useTokenSearch.ts     # Hook for searching tokens with debouncing and pagination.
├── types/                  # TypeScript type definitions for all data structures used within the module.
│   ├── tokenTypes.ts         # Basic token information (TokenInfo, TokenPriceInfo).
│   ├── assetTypes.ts         # Types for various assets (AssetItem, PortfolioData).
│   └── tokenDetails.types.ts # Detailed types for token information screens (PriceHistoryItem, TokenOverview, etc.).
├── utils/                  # Utility functions for data formatting, fetching, and other helper tasks.
│   ├── tokenUtils.ts         # Utility functions for token amount formatting, logo fetching.
│   ├── fetch.ts              # Generic fetch utilities, including Helius RPC interactions and retry logic.
│   └── tokenDetailsFormatters.ts # Formatting functions for token detail display (prices, numbers).
└── index.ts                # Main barrel file for exporting all public APIs of the module.
└── README.md               # This file.
```

## Key Services and Their APIs

- **`tokenService.ts`**
    - `DEFAULT_SOL_TOKEN`, `DEFAULT_USDC_TOKEN`: Constant definitions for SOL and USDC.
    - `fetchTokenBalance(walletPublicKey, tokenInfo)`: Fetches balance for a specific token.
    - `fetchTokenPrice(tokenInfo)`: Fetches the current price of a token (uses Birdeye, falls back to Jupiter).
    - `ensureCompleteTokenInfo(token)`: Ensures a partial `TokenInfo` object is populated with full metadata.
    - `estimateTokenUsdValue(amount, decimals, mint, symbol)`: Estimates USD value of a token amount.
    - `fetchTokenList(params)`: Fetches a list of tokens from Birdeye.
    - `searchTokens(params)`: Searches for tokens on Birdeye.
    - `fetchTokenMetadata(tokenAddress)`: Fetches metadata for a single token (Birdeye).
    - `toBaseUnits(amount, decimals)`: Converts a token amount to its base units.

- **`coingeckoService.ts`**
    - `getCoinList()`: Fetches the full list of coins from CoinGecko.
    - `getCoinMarkets(coinId)`: Fetches market data for a specific coin.
    - `getCoinOHLC(coinId, days)`: Fetches OHLC data for a coin.
    - `getBatchCoinMarkets(coinIds)`: Fetches market data for multiple coins in a batch.

- **`swapTransactions.ts`**
    - `fetchRecentSwaps(walletAddress)`: Fetches recent swap transactions for a wallet (uses Helius).
    - `enrichSwapTransactions(swaps)`: Enriches swap transactions with token metadata.

- **`tokenDetailsService.ts`** (Primarily uses Birdeye)
    - `fetchPriceHistory(tokenAddress, timeframe)`: Fetches historical price data.
    - `fetchTokenMetadata(tokenAddress)`: Fetches token metadata.
    - `fetchTokenOverview(tokenAddress)`: Fetches token overview data.
    - `fetchTokenSecurity(tokenAddress)`: Fetches token security information.
    - `fetchMarketData(tokenAddress)`: Fetches current market data for a token.
    - `fetchTradeData(tokenAddress)`: Fetches recent trade data for a token.
    - `getBirdeyeTimeParams(timeframe)`: Utility to get time parameters for Birdeye API calls.

## Key Hooks and Their Usage

- **`useFetchTokens(walletAddress?)`**: 
    - Returns: `{ tokens, loading, error, refetch }`
    - Fetches all fungible tokens in a user's wallet. Also provides underlying portfolio data via `useFetchPortfolio`.
    - Example: `const { tokens, loading } = useFetchTokens(walletAddress);`

- **`useCoingecko()`**: 
    - Returns a comprehensive object with functions and state for CoinGecko interactions (e.g., `coinList`, `searchCoins`, `fetchCoinData`, `graphData`, `marketCap`).
    - Manages caching for CoinGecko data.
    - Example: `const { searchCoins, searchResults, loadingCoinList } = useCoingecko();`

- **`useTokenDetails({ tokenAddress, visible })`**: 
    - Returns: `{ priceHistory, metadata, tokenOverview, ..., loading, selectedTimeframe, handleTimeframeChange, getTimestamps }`
    - Fetches and manages all necessary data for displaying a detailed token information sheet/page.
    - Example: `const { metadata, priceHistory, loading } = useTokenDetails({ tokenAddress: "..."; visible: true });`

- **`useTokenSearch(initialQuery?, debounceMs?)`**: 
    - Returns: `{ tokens, loading, error, searchQuery, setSearchQuery, loadMore, refresh, isRefreshing }`
    - Provides a debounced token search functionality with pagination and refresh capabilities.
    - Example: `const { tokens, searchQuery, setSearchQuery, loadMore } = useTokenSearch();`

## Utilities

- **`tokenUtils.ts`**: Contains helpers like `formatTokenAmount`, `getTokenLogo`, `formatUsdValue`.
- **`fetch.ts`**: Provides `fetchWithRetries` for robust API calls and Helius-specific fetchers like `fetchUserAssets` and `fetchSolBalance`.
- **`tokenDetailsFormatters.ts`**: Includes functions like `formatPrice`, `formatPriceChange`, `formatNumber` for UI display in token detail views.

## Re-exported Components

- **`TokenDetailsSheet`**: This UI component, originally from `core/shared-ui`, is re-exported for convenience if it's tightly coupled with the data fetched by `useTokenDetails`. This allows consumers to import it directly from the `data-module`.

## Integration Example

```typescript
import { useFetchTokens, TokenInfo } from '@/modules/data-module'; // Assuming @ is an alias for src
import { useWallet } from '@solana/wallet-adapter-react';
import React from 'react';
import { View, Text, FlatList, Image } from 'react-native';

function UserTokenList() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58();
  const { tokens, loading, error, refetch } = useFetchTokens(walletAddress);

  if (loading) return <Text>Loading tokens...</Text>;
  if (error) return <Text>Error: {error}</Text>;

  return (
    <View>
      <Button title="Refresh Tokens" onPress={refetch} />
      <FlatList
        data={tokens}
        keyExtractor={(item: TokenInfo) => item.address}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }}>
            {item.logoURI && <Image source={{ uri: item.logoURI }} style={{ width: 30, height: 30, marginRight: 10 }} />}
            <Text>{item.name} ({item.symbol})</Text>
            {/* You would typically fetch and display balance separately or enhance TokenInfo */}
          </View>
        )}
      />
    </View>
  );
}

export default UserTokenList;
```

This module aims to be a centralized and robust solution for handling various types of Solana-related data, simplifying data fetching and management for UI components.
