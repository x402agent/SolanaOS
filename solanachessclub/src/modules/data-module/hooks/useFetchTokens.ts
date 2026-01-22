import { useState, useEffect, useMemo, useCallback } from 'react';
import { HELIUS_API_KEY } from '@env';
import { fetchUserAssets } from '../utils/fetch';
import { AssetItem, PortfolioData } from '../types/assetTypes';

/**
 * Extracts the best available image from an asset
 */
export const extractAssetImage = (asset: any): string | undefined => {
  // Check all possible image sources in order of priority
  if (asset.content?.files && asset.content.files.length > 0) {
    // Check if there are files with uri/image_url in the content
    for (const file of asset.content.files) {
      if (file.uri && file.type?.includes('image')) return file.uri;
      if (file.image_url) return file.image_url;
    }
  }
  
  // Check for image in content metadata
  if (asset.content?.metadata?.image) return asset.content.metadata.image;
  
  // Check links
  if (asset.content?.links?.image) return asset.content.links.image;
  if (asset.links?.image) return asset.links.image;
  
  // Direct image property
  if (asset.image) return asset.image;
  
  // For NFTs, check JSON URI content
  if (asset.content?.json_uri) {
    // For optimal performance, we would fetch the JSON here
    // But to avoid extra requests, we'll return the JSON URI as a backup image source
    return asset.content.json_uri;
  }
  
  return undefined;
};

/**
 * Fixes common image URI issues
 */
export const fixImageUrl = (url: string): string => {
  if (!url) return '';
  
  // Convert ipfs:// URLs to HTTPS gateway URLs
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }
  
  // Fix local arweave links
  if (url.startsWith('ar://')) {
    return url.replace('ar://', 'https://arweave.net/');
  }
  
  // Handle Solana on-chain data URLs
  if (url.startsWith('data:')) {
    return url;
  }
  
  // Add HTTPS if needed
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  
  if (!url.startsWith('http')) {
    return `https://${url}`;
  }
  
  return url;
};

/**
 * Determines the true asset type
 */
export const determineAssetType = (asset: any): 'token' | 'nft' | 'cnft' => {
  // Explicit check for compressed NFTs
  if (asset.compression?.compressed) {
    return 'cnft';
  }

  // Check for fungible tokens
  if (
    asset.interface === 'FungibleToken' || 
    (asset.token_info && 
     (!asset.content?.metadata?.attributes || asset.content?.metadata?.token_standard === 'Fungible'))
  ) {
    return 'token';
  }

  // Check for regular NFTs
  if (
    asset.interface === 'V1_NFT' || 
    asset.interface === 'ProgrammableNFT' ||
    asset.content?.metadata?.token_standard === 'NonFungible' ||
    asset.content?.metadata?.token_standard === 'ProgrammableNonFungible'
  ) {
    return 'nft';
  }

  // Default fallback - if it has token info but no attributes, treat as token
  if (asset.token_info && !asset.content?.metadata?.attributes) {
    return 'token';
  }

  // Last resort, check decimals - fungible tokens typically have 6+
  if (asset.token_info?.decimals >= 6) {
    return 'token';
  }

  // If nothing else matches, assume it's an NFT
  return 'nft';
};

/**
 * Processes asset items to enhance them with additional info like image URLs
 */
export const processAssetItems = (items: AssetItem[]): AssetItem[] => {
  return items.map((item: AssetItem) => {
    // Extract the best available image URL
    const imageUrl = extractAssetImage(item);
    
    // If no image was found through standard extraction, 
    // try other paths specific to this asset type
    let finalImageUrl = imageUrl;
    
    if (!finalImageUrl) {
      // For tokens, try to check for a known logo
      if (item.interface === 'FungibleToken' || item.token_info) {
        const symbol = (item.token_info?.symbol || item.symbol || '').toLowerCase();
        if (symbol === 'sol') {
          finalImageUrl = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png';
        } else if (symbol === 'usdc') {
          finalImageUrl = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png';
        }
      }
    }
    
    // Set the image URL on the item
    item.image = finalImageUrl;
    
    // Make sure name and symbol are set properly
    item.name = item.content?.metadata?.name || item.token_info?.symbol || item.name || 'Unknown Asset';
    item.symbol = item.token_info?.symbol || item.content?.metadata?.symbol || item.symbol || '';
    
    // Determine and store the asset type
    item.assetType = determineAssetType(item);
    
    return item;
  });
};

/**
 * Hook to fetch a user's portfolio (tokens, NFTs, and cNFTs)
 */
export function useFetchPortfolio(walletAddress?: string) {
  const [portfolio, setPortfolio] = useState<PortfolioData>({
    items: [],
    total: 0,
    limit: 0,
    page: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use useCallback to memoize the fetch function
  const fetchPortfolioData = useCallback(async () => {
    if (!walletAddress) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Use the utility function to fetch assets from Helius DAS API
      const result = await fetchUserAssets(walletAddress);
      
      // Process the data to add image URLs and improve item data
      const processedItems = processAssetItems(result.items);

      setPortfolio({
        items: processedItems,
        nativeBalance: result.nativeBalance,
        total: result.total,
        limit: result.limit,
        page: result.page,
      });
    } catch (err: any) {
      console.error('Portfolio fetch error:', err);
      setError(err.message || 'Failed to fetch portfolio');
      setPortfolio(prev => ({...prev, error: err.message}));
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  // Effect to trigger data fetch when dependencies change
  useEffect(() => {
    if (!walletAddress) {
      setPortfolio({
        items: [],
        total: 0,
        limit: 0,
        page: 1,
      });
      return;
    }

    fetchPortfolioData();
  }, [walletAddress, fetchPortfolioData]);

  // Memoize the return values to prevent unnecessary re-renders
  return useMemo(() => ({
    portfolio,
    loading,
    error,
    refetch: fetchPortfolioData
  }), [portfolio, loading, error, fetchPortfolioData]);
}

/**
 * Hook to fetch only fungible tokens from a user's wallet
 */
export function useFetchTokens(walletAddress?: string) {
  const { portfolio, loading, error, refetch } = useFetchPortfolio(walletAddress);
  
  // Memoize the tokens to prevent unnecessary re-renders
  const tokens = useMemo(() => 
    portfolio.items.filter(item => item.assetType === 'token'),
    [portfolio.items]
  );
  
  return useMemo(() => ({
    tokens,
    loading,
    error,
    refetch
  }), [tokens, loading, error, refetch]);
}
