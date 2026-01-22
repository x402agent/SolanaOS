# Profile Collectibles Components

This directory contains components for displaying NFT and collectible items owned by a user.

## Components

### Collectibles
The main component for rendering a user's NFT collection:

**Features:**
- Grid display of NFT items
- Filtering and sorting options
- Collection grouping
- Detail view for individual items
- Support for different collectible types
- Loading states and placeholders

## Styling

Styling for these components can be found in:
- `collectibles.style.ts`: Contains all styles for the collectibles components

## Usage

```typescript
import { Collectibles } from '@core/profile';

function NFTGallery({ userId }) {
  return (
    <Collectibles 
      userId={userId}
      gridColumns={2}
      showCollectionNames={true}
      onSelectItem={(item) => {
        // Handle item selection
      }}
    />
  );
}
```

## Integration Points

The Collectibles component integrates with:
- NFT data providers (like Helius, Magic Eden, etc.)
- Wallet connections to verify ownership
- Media optimization for NFT images
- Deep linking to marketplaces 