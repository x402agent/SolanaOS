# NFT Module

This module provides functionalities for interacting with Non-Fungible Tokens (NFTs) on the Solana blockchain. It integrates with the Tensor API for fetching NFT data, collection information, and performing buy/sell operations.

## Core Functionalities

- **Fetch NFTs**: Retrieve NFTs owned by a user.
- **Display NFT Details**: Show detailed information about a specific NFT or collection, including metadata, image, and price.
- **Buy NFTs**: Allow users to purchase NFTs, including floor NFTs from a collection.
- **Sell NFTs**: Enable users to list their NFTs for sale on Tensor.
- **Search Collections**: Search for NFT collections by name.
- **Share NFT Listings**: Allow users to share NFT listings (individual or collection-based) to a feed (e.g., integrated with a thread/post feature).

## Module Structure

```
src/modules/nft/
├── components/
│   ├── NftDetailsSection.tsx   # Displays detailed section for an NFT or collection, with caching.
│   ├── NftDetailsSection.style.ts # Styles for NftDetailsSection.
│   └── NftListingModal.tsx     # Modal for users to select NFTs or collections to share/list.
├── hooks/
│   └── useFetchNFTs.ts         # Custom hook to fetch NFTs for a given wallet address.
├── screens/
│   ├── NftScreen.tsx           # Main screen with "Buy" and "Sell" tabs.
│   ├── BuySection.tsx          # UI and logic for searching and buying NFTs/collections.
│   ├── SellSection.tsx         # UI and logic for viewing owned NFTs and listing them for sale.
│   ├── buySection.styles.ts    # Styles for BuySection.
│   ├── sellSection.styles.ts   # Styles for SellSection.
│   └── styles.ts               # Common styles for NftScreen.
├── services/
│   └── nftService.ts           # Contains functions to interact with the Tensor API (fetch, buy, sell).
├── types/
│   └── index.ts                # TypeScript type definitions (NftItem, CollectionData, NftListingData, etc.).
├── utils/
│   └── imageUtils.ts           # Utility functions for handling and formatting NFT image URLs and prices.
└── index.ts                    # Main barrel file for exporting module components, hooks, services, etc.
└── README.md                   # This file.
```

## Key Components

- **`NftScreen`**: The primary screen for NFT functionalities, featuring "Buy" and "Sell" tabs.
    - **`BuySection`**: Allows users to search for NFT collections by name. On selecting a collection, it fetches and displays the floor NFT, enabling the user to initiate a purchase via Tensor.
    - **`SellSection`**: Displays NFTs owned by the connected user. Users can select an NFT to list it for sale on Tensor by specifying a price and duration.
- **`NftDetailsSection`**: A reusable component designed to display a summary of an NFT or an NFT collection. It fetches necessary metadata and includes a drawer for more detailed information.
- **`NftListingModal`**: A modal component that allows users to browse and select NFTs or collections. This is typically used when a user wants to share an NFT listing to a social feed or attach it to a post.

## Key Hooks

- **`useFetchNFTs(walletAddress?, options?)`**: 
    - Fetches a list of `NftItem` objects for the provided `walletAddress` using the Tensor API.
    - Returns `{ nfts, loading, error }`.

## Key Services (`nftService.ts`)

This service primarily interacts with the Tensor API (`https://api.mainnet.tensordev.io`).

- **Fetching Data:**
    - `fetchNftMetadata(mint)`: Retrieves detailed metadata for a specific NFT.
    - `fetchCollectionData(collId)`: Fetches information about an NFT collection.
    - `fetchFloorNFTForCollection(collId)`: Gets the details of the floor-priced NFT in a given collection.
    - `searchCollections(query)`: Searches for NFT collections based on a query string.
    - `fetchActiveListings(walletAddress)`: Fetches NFTs currently listed for sale by the user.
- **Transactions (via Tensor API and Wallet Adapter):**
    - `buyNft(publicKey, mint, maxPriceSol, owner, sendTransaction, onStatus?)`: Initiates a transaction to buy a specific NFT.
    - `buyCollectionFloor(publicKey, collId, sendTransaction, onStatus?)`: Initiates a transaction to buy the floor NFT of a collection.
    - `listNftForSale(publicKey, mint, priceSol, userWallet, onStatus?, isCompressed?, compressedNftData?)`: Lists an NFT for sale.
    - `delistNft(publicKey, mint, userWallet, onStatus?)`: Delists an NFT.

## Types (`types/index.ts`)

- **`NftItem`**: Interface for individual NFT data, including mint, name, image, collection, price, etc.
- **`CollectionData`**: Interface for NFT collection details.
- **`NftListingData`**: A specialized type for representing NFT information when shared in a feed or post.
- **`FetchNFTsOptions`**: Options for the `useFetchNFTs` hook.
- **`CollectionResult`**: Type for results from collection searches.

## Utilities (`utils/imageUtils.ts`)

- **`fixImageUrl(url)`**: Normalizes various image URL formats (IPFS, Arweave) to a usable HTTPS URL.
- **`getNftImageSource(uri, defaultImage?)`**: Returns a React Native `ImageSourcePropType` for an NFT image.
- **`formatSolPrice(price, inLamports?)`**: Formats a SOL price with appropriate decimal precision.

## Usage Example (Displaying User's NFTs in Sell Section)

1.  `NftScreen` is active, with the "Sell" tab selected.
2.  `SellSection` mounts and uses the `useWallet` hook to get the `userPublicKey`.
3.  Inside `SellSection`, `fetchOwnedNfts` (a local utility that could leverage `useFetchNFTs` or directly call `nftService`) is called.
4.  This function fetches the user's NFTs via `nftService.ts` (Tensor API).
5.  The fetched NFTs are displayed in a list or grid.
6.  User can select an NFT to open a modal (part of `SellSection`) to input a sale price and duration.
7.  Submitting this form calls `listNftForSale` from `nftService.ts`, prompting the user to sign the transaction.

```typescript
// Simplified example within SellSection.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Button } from 'react-native';
import { useFetchNFTs } from '@/modules/nft'; // Assuming index exports this
import { NftItem } from '@/modules/nft/types';

interface SellSectionProps {
  userPublicKey: string;
  // ... other props like userWallet
}

const SellSection: React.FC<SellSectionProps> = ({ userPublicKey }) => {
  const { nfts, loading, error } = useFetchNFTs(userPublicKey);
  const [selectedNft, setSelectedNft] = useState<NftItem | null>(null);

  // ... (logic for listing modal and handleSellNftOnTensor)

  if (loading) return <Text>Loading your NFTs...</Text>;
  if (error) return <Text>Error: {error}</Text>;

  return (
    <View>
      <FlatList
        data={nfts}
        keyExtractor={(item) => item.mint}
        renderItem={({ item }) => (
          <View>
            <Text>{item.name}</Text>
            {item.image && <Image source={{ uri: item.image }} style={{ width: 50, height: 50}} />}
            <Button title="List for Sale" onPress={() => setSelectedNft(item)} />
          </View>
        )}
      />
      {/* Modal for listing selectedNft would be here */}
    </View>
  );
};
```

## Environment Variables

- **`TENSOR_API_KEY`**: Your API key for the TensorTrade API. This is essential for most functionalities within the module.
- **`HELIUS_API_KEY`** (Optional, used in some Helius-specific calls if integrated, e.g., for compressed NFTs, but primary interaction is Tensor).

Ensure these are configured in your application's environment.
