import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Image,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  RefreshControl,
  ImageBackground,
  Modal,
  TextInput
} from 'react-native';
import { styles, portfolioStyles } from './collectibles.style';

import { fixImageUrl, fetchNftMetadata } from '@/modules/nft';
import { TENSOR_API_KEY } from '@env';
import { NftItem } from '@/modules/nft/types';
import TokenDetailsDrawer from '@/core/shared-ui/TokenDetailsDrawer/TokenDetailsDrawer';
import { AssetItem } from '@/modules/data-module';
import COLORS from '@/assets/colors';
import { IPFSAwareImage, getValidImageSource, fixAllImageUrls } from '@/shared/utils/IPFSImage';
import { useWallet } from '@/modules/wallet-providers/hooks/useWallet';
import { VersionedTransaction, Connection } from '@solana/web3.js';
import bs58 from 'bs58';
import { HELIUS_STAKED_URL, SERVER_URL } from '@env';

export interface PortfolioSectionProps {
  sectionTitle: string;
  items: AssetItem[];
  onItemPress?: (item: AssetItem) => void;
  emptyMessage?: string;
  displayAsList?: boolean;
}

/**
 * Props for the Collectibles component
 */
interface CollectiblesProps {
  /**
   * The list of NFTs to display (legacy support)
   */
  nfts?: NftItem[];
  /**
   * Full portfolio data (priority over nfts if provided)
   */
  portfolioItems?: AssetItem[];
  /**
   * Native SOL balance in lamports
   */
  nativeBalance?: number;
  /**
   * An optional error message to display if there's a problem
   */
  error?: string | null;
  /**
   * Whether the list is loading
   */
  loading?: boolean;
  /**
   * Callback for refresh action
   */
  onRefresh?: () => void;
  /**
   * Whether the data is currently refreshing
   */
  refreshing?: boolean;
  /**
   * Callback when an item is pressed
   */
  onItemPress?: (item: AssetItem) => void;
}

const SOL_DECIMAL = 1000000000; // 1 SOL = 10^9 lamports

// NFT data cache to prevent redundant fetches
const nftDataCache = new Map<string, any>();

const SERVER_BASE_URL = SERVER_URL || 'http://localhost:3000';

// List renderer for token items
const TokenListItem: React.FC<{
  item: AssetItem;
  onPress?: (item: AssetItem) => void;
}> = ({ item, onPress }) => {
  const imageUrl = item.image ? fixImageUrl(item.image) : '';

  const formattedBalance = item.token_info ?
    parseFloat(
      (parseInt(item.token_info.balance) / Math.pow(10, item.token_info.decimals))
        .toFixed(item.token_info.decimals)
    ).toString() : '0';

  const tokenValue = item.token_info?.price_info?.total_price
    ? `$${item.token_info.price_info.total_price.toFixed(2)}`
    : '';

  return (
    <TouchableOpacity
      style={[portfolioStyles.tokenListItem, { backgroundColor: COLORS.background }]}
      onPress={() => {
        if (onPress) {
          console.log("TokenListItem: Pressing item with mint:", item.mint, "id:", item.id);
          onPress(item);
        }
      }}
      activeOpacity={0.7}
    >
      {/* Token Logo */}
      <View style={[portfolioStyles.tokenLogoContainer, { backgroundColor: COLORS.background }]}>
        {imageUrl ? (
          <IPFSAwareImage
            source={getValidImageSource(imageUrl)}
            style={portfolioStyles.tokenLogo}
            resizeMode="cover"
            defaultSource={
              <View style={[portfolioStyles.tokenLogoPlaceholder, { backgroundColor: COLORS.greyDark }]}>
                <Text style={portfolioStyles.tokenLogoPlaceholderText}>
                  {item.symbol?.[0] || item.name?.[0] || '?'}
                </Text>
              </View>
            }
          />
        ) : (
          <View style={[portfolioStyles.tokenLogoPlaceholder, { backgroundColor: COLORS.greyDark }]}>
            <Text style={portfolioStyles.tokenLogoPlaceholderText}>
              {item.symbol?.[0] || item.name?.[0] || '?'}
            </Text>
          </View>
        )}
      </View>

      {/* Token Details */}
      <View style={portfolioStyles.tokenDetails}>
        <Text style={portfolioStyles.tokenName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={portfolioStyles.tokenSymbol} numberOfLines={1}>
          {item.token_info?.symbol || item.symbol || ''}
        </Text>
      </View>

      {/* Token Balance & Value */}
      <View style={portfolioStyles.tokenBalanceContainer}>
        <Text style={portfolioStyles.tokenBalance}>
          {formattedBalance}
        </Text>
        {tokenValue ? (
          <Text style={portfolioStyles.tokenValue}>
            {tokenValue}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

/**
 * A component to display a group of assets of a specific type
 */
const PortfolioSection: React.FC<PortfolioSectionProps> = ({
  sectionTitle,
  items,
  onItemPress,
  emptyMessage = 'No items to display',
  displayAsList = false,
}) => {
  const { width } = Dimensions.get('window');
  const itemWidth = (width - 60) / 2; // 2 columns with some padding

  if (items.length === 0) {
    return (
      <View style={portfolioStyles.emptySection}>
        <Text style={portfolioStyles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  // Custom image renderer that handles loading and errors
  const renderAssetImage = (item: AssetItem) => {
    const imageUrl = item.image ? fixImageUrl(item.image) : '';

    if (!imageUrl) {
      // If no image is available, display a placeholder with the token symbol/name
      return (
        <View style={[portfolioStyles.placeholderImage, { backgroundColor: COLORS.background }]}>
          <Text style={portfolioStyles.placeholderText}>
            {item.symbol || item.name?.charAt(0) || '?'}
          </Text>
        </View>
      );
    }

    return (
      <View style={[portfolioStyles.imageWrapper, { backgroundColor: COLORS.background }]}>
        <Image
          source={require('../../../../assets/images/SENDlogo.png')}
          style={portfolioStyles.fallbackImage}
          resizeMode="cover"
        />
        <IPFSAwareImage
          source={getValidImageSource(imageUrl)}
          style={portfolioStyles.image}
          resizeMode="cover"
          defaultSource={require('../../../../assets/images/SENDlogo.png')}
        />
      </View>
    );
  };

  // List format for tokens
  if (displayAsList) {
    return (
      <View style={portfolioStyles.sectionContainer}>
        <Text style={portfolioStyles.sectionTitle}>{sectionTitle}</Text>
        <FlatList
          key="list"
          data={items}
          keyExtractor={item => item.id || item.mint}
          renderItem={({ item }) => (
            <TokenListItem item={item} onPress={onItemPress} />
          )}
          scrollEnabled={false}
          contentContainerStyle={portfolioStyles.listContainer}
          ItemSeparatorComponent={() => <View style={portfolioStyles.separator} />}
        />
      </View>
    );
  }

  // Grid format for NFTs
  return (
    <View style={portfolioStyles.sectionContainer}>
      <Text style={portfolioStyles.sectionTitle}>{sectionTitle}</Text>
      <FlatList
        key="grid"
        data={items}
        numColumns={2}
        keyExtractor={item => item.id || item.mint}
        columnWrapperStyle={portfolioStyles.columnWrapper}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[portfolioStyles.itemContainer, { width: itemWidth }]}
            onPress={() => {
              if (onItemPress) {
                console.log("Grid item pressed with mint:", item.mint, "id:", item.id);
                onItemPress(item);
              }
            }}
            activeOpacity={0.7}
          >
            <View style={portfolioStyles.imageContainer}>
              {renderAssetImage(item)}

              {/* Display badges for special asset types */}
              {item.compression?.compressed && (
                <View style={portfolioStyles.compressedBadge}>
                  <Text style={portfolioStyles.compressedText}>C</Text>
                </View>
              )}

              {/* Show token price if available */}
              {item.token_info?.price_info?.price_per_token && (
                <View style={portfolioStyles.priceBadge}>
                  <Text style={portfolioStyles.priceText}>
                    ${item.token_info.price_info.price_per_token.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>

            <View style={portfolioStyles.itemDetails}>
              <Text style={portfolioStyles.itemName} numberOfLines={1}>
                {item.name}
              </Text>

              {item.token_info ? (
                <Text style={portfolioStyles.itemBalance}>
                  {parseFloat(
                    (parseInt(item.token_info.balance) / Math.pow(10, item.token_info.decimals))
                      .toFixed(item.token_info.decimals)
                  ).toString()} {item.token_info.symbol || item.symbol}
                </Text>
              ) : item.collection?.name ? (
                <Text style={portfolioStyles.itemCollection} numberOfLines={1}>
                  {item.collection.name}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
        scrollEnabled={false}
        contentContainerStyle={portfolioStyles.gridContainer}
      />
    </View>
  );
};

const connection = new Connection(
  HELIUS_STAKED_URL || 'https://api.mainnet-beta.solana.com',
  'confirmed'
);

/**
 * Renders a complete portfolio view with tokens, NFTs, and compressed NFTs
 */
const Collectibles: React.FC<CollectiblesProps> = ({
  nfts,
  portfolioItems,
  nativeBalance,
  error,
  loading,
  onRefresh,
  refreshing,
  onItemPress,
}) => {
  const { publicKey, address, connected, sendBase64Transaction } = useWallet();
  const [activeTab, setActiveTab] = useState<'all' | 'tokens' | 'nfts'>('all');
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [detailedNftData, setDetailedNftData] = useState<any>(null);

  const mountedRef = useRef(true);
  const [isProcessingTransaction, setIsProcessingTransaction] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Handle asset item press
  const handleAssetPress = async (item: AssetItem) => {
    if (!item) {
      console.warn("Attempted to open details for invalid asset item");
      return;
    }

    // Use mint or id, whichever is available
    const assetId = item.mint || item.id;
    if (!assetId) {
      console.warn("Asset missing both mint and id properties", JSON.stringify(item, null, 2));
      return;
    }

    setSelectedAsset(item);

    // If it's an NFT, we should fetch more detailed data
    if (item.assetType === 'nft' || item.assetType === 'cnft') {
      // Set loading state and show drawer immediately
      setDrawerLoading(true);
      setShowDetailsDrawer(true);

      try {
        const nftData = await fetchNftData(assetId);
        setDetailedNftData(nftData);
      } catch (error) {
        console.error("Error fetching detailed NFT data:", error);
        setDetailedNftData(null);
      } finally {
        setDrawerLoading(false);
      }
    } else {
      setDetailedNftData(null);
      setShowDetailsDrawer(true);
    }

    // Call external onItemPress if provided
    if (onItemPress) {
      onItemPress(item);
    }
  };

  // Function to fetch detailed NFT data
  const fetchNftData = async (mint: string) => {
    // If we already have cached data, return it
    if (nftDataCache.has(mint)) {
      return nftDataCache.get(mint);
    }

    try {
      // Use the centralized fetch function instead of implementing it here
      const nftData = await fetchNftMetadata(mint);

      // Cache the result
      nftDataCache.set(mint, nftData);
      return nftData;
    } catch (error) {
      console.error(`Error fetching NFT data for ${mint}:`, error);
      return null;
    }
  };

  // Show loading state while fetching data
  if (loading) {
    return (
      <View style={portfolioStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#1d9bf0" />
        <Text style={portfolioStyles.loadingText}>Loading your portfolio...</Text>
      </View>
    );
  }

  // Show error state if there was a problem
  if (error) {
    return (
      <View style={portfolioStyles.errorContainer}>
        <Text style={portfolioStyles.errorText}>{error}</Text>
        {onRefresh && (
          <TouchableOpacity
            style={portfolioStyles.retryButton}
            onPress={onRefresh}
          >
            <Text style={portfolioStyles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Convert legacy nfts to AssetItems if no portfolioItems provided
  const items = portfolioItems || (nfts ? nfts.map(nft => ({
    id: nft.mint,
    mint: nft.mint,
    name: nft.name,
    image: nft.image,
    collection: { name: nft.collection },
    interface: 'V1_NFT',
  } as AssetItem)) : []);

  // Show empty state if no assets found
  if (items.length === 0 && !nativeBalance) {
    return (
      <View style={portfolioStyles.emptyContainer}>
        <Text style={portfolioStyles.emptyText}>No assets found in this wallet.</Text>
        {/* {onRefresh && (
          <TouchableOpacity
            style={portfolioStyles.retryButton}
            onPress={onRefresh}
          >
            <Text style={portfolioStyles.retryText}>Refresh</Text>
          </TouchableOpacity>
        )} */}
      </View>
    );
  }

  // Filter items by type
  const tokens = items.filter(item =>
    item.assetType === 'token'
  );

  // Merge regular and compressed NFTs into one array
  const allNfts = items.filter(item =>
    item.assetType === 'nft' || item.assetType === 'cnft'
  );

  const solBalance = nativeBalance ? (nativeBalance / SOL_DECIMAL).toFixed(4) : '0';

  // Filter based on active tab
  const renderItems = () => {
    switch (activeTab) {
      case 'tokens':
        return tokens.length > 0 ? (
          <PortfolioSection
            sectionTitle="Tokens"
            items={tokens}
            onItemPress={handleAssetPress}
            emptyMessage="No tokens found"
            displayAsList={true}
          />
        ) : (
          <View style={portfolioStyles.emptyTabContent}>
            <Text style={portfolioStyles.emptyTabText}>No tokens found in this wallet</Text>
          </View>
        );

      case 'nfts':
        return allNfts.length > 0 ? (
          <PortfolioSection
            sectionTitle="NFTs"
            items={allNfts}
            onItemPress={handleAssetPress}
            emptyMessage="No NFTs found"
            displayAsList={false}
          />
        ) : (
          <View style={portfolioStyles.emptyTabContent}>
            <Text style={portfolioStyles.emptyTabText}>No NFTs found in this wallet</Text>
          </View>
        );

      case 'all':
      default:
        return (
          <>
            {/* SOL Balance Card */}
            <View style={portfolioStyles.solBalanceContainer}>
              <View style={portfolioStyles.solLogoContainer}>
                <Image
                  source={require('../../../../assets/images/SOL_logo.png')}
                  style={portfolioStyles.solLogo}
                  resizeMode="cover"
                />
              </View>
              <View style={portfolioStyles.solTextContainer}>
                <Text style={portfolioStyles.solBalanceLabel}>SOL Balance</Text>
                <Text style={portfolioStyles.solBalanceValue}>{solBalance} SOL</Text>
              </View>
            </View>

            {/* Tokens Section */}
            {tokens.length > 0 && (
              <PortfolioSection
                sectionTitle="Tokens"
                items={tokens.slice(0, 6)}
                onItemPress={handleAssetPress}
                displayAsList={true}
              />
            )}

            {/* NFTs Section (merged) */}
            {allNfts.length > 0 && (
              <PortfolioSection
                sectionTitle="NFTs"
                items={allNfts.slice(0, 8)}
                onItemPress={handleAssetPress}
                displayAsList={false}
              />
            )}

            {/* Show a view all button if there are more items than shown */}
            {tokens.length > 6 || allNfts.length > 8 ? (
              <TouchableOpacity
                style={portfolioStyles.viewAllButton}
                onPress={() => {
                  // Navigate to the category with the most items
                  if (tokens.length >= allNfts.length) {
                    setActiveTab('tokens');
                  } else {
                    setActiveTab('nfts');
                  }
                }}
              >
                <Text style={portfolioStyles.viewAllText}>View All Assets</Text>
              </TouchableOpacity>
            ) : null}
          </>
        );
    }
  };

  // Generate initialData for TokenDetailsDrawer
  const getInitialData = () => {
    if (!selectedAsset) return undefined;

    // Check if it's an NFT (regular or compressed)
    const isNft = selectedAsset.assetType === 'nft' || selectedAsset.assetType === 'cnft';

    // Create the initial data object with required fields
    const initialData: any = {
      symbol: selectedAsset.token_info?.symbol || selectedAsset.symbol || '',
      name: selectedAsset.name || '',
      logoURI: selectedAsset.image ? fixImageUrl(selectedAsset.image) : ''
    };

    // For NFTs, add more specific data
    if (isNft) {
      // If we have fetched detailed NFT data, use that
      if (detailedNftData) {
        initialData.nftData = {
          name: detailedNftData.name || selectedAsset.name,
          collName: detailedNftData.collName || selectedAsset.collection?.name || '',
          description: detailedNftData.description || selectedAsset.description || '',
          rarityRankTN: detailedNftData.rarityRankTN,
          numMints: detailedNftData.numMints,
          owner: detailedNftData.owner,
          attributes: detailedNftData.attributes || selectedAsset.attributes,
          listing: detailedNftData.listing,
          lastSale: detailedNftData.lastSale
        };
      } else {
        // Use the basic data we have
        initialData.nftData = {
          collName: selectedAsset.collection?.name || '',
          description: selectedAsset.description ||
            (drawerLoading ?
              'Loading NFT data...' :
              'No detailed information available for this NFT. This could be because the Tensor API is unavailable or the NFT is not indexed.')
        };

        // Add attributes if available
        if (selectedAsset.attributes && Array.isArray(selectedAsset.attributes)) {
          initialData.nftData.attributes = selectedAsset.attributes;
        }

        // Add a dummy attribute to explain the situation if we're not loading
        if (!drawerLoading && !TENSOR_API_KEY) {
          initialData.nftData.attributes = [
            {
              trait_type: 'Note',
              value: 'Tensor API key is missing. Add TENSOR_API_KEY to your environment variables for full NFT details.'
            }
          ];
        }
      }
    }

    return initialData;
  };

  return (
    <>
      <ScrollView
        style={portfolioStyles.scrollContainer}
        contentContainerStyle={portfolioStyles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || false}
            onRefresh={onRefresh}
            colors={[COLORS.brandBlue]}
            tintColor={COLORS.brandBlue}
          />
        }
      >
        {/* Tabs for filtering different asset types */}
        <View style={portfolioStyles.tabContainer}>
          <TouchableOpacity
            style={[
              portfolioStyles.tab,
              activeTab === 'all' && portfolioStyles.activeTab,
            ]}
            onPress={() => setActiveTab('all')}
          >
            <Text
              style={[
                portfolioStyles.tabText,
                activeTab === 'all' && portfolioStyles.activeTabText
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              portfolioStyles.tab,
              activeTab === 'tokens' && portfolioStyles.activeTab,
            ]}
            onPress={() => setActiveTab('tokens')}
          >
            <Text
              style={[
                portfolioStyles.tabText,
                activeTab === 'tokens' && portfolioStyles.activeTabText
              ]}
            >
              Tokens
            </Text>
            {tokens.length > 0 && (
              <View style={portfolioStyles.badgeContainer}>
                <Text style={portfolioStyles.badgeText}>{tokens.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              portfolioStyles.tab,
              activeTab === 'nfts' && portfolioStyles.activeTab,
            ]}
            onPress={() => setActiveTab('nfts')}
          >
            <Text
              style={[
                portfolioStyles.tabText,
                activeTab === 'nfts' && portfolioStyles.activeTabText
              ]}
            >
              NFTs
            </Text>
            {allNfts.length > 0 && (
              <View style={portfolioStyles.badgeContainer}>
                <Text style={portfolioStyles.badgeText}>{allNfts.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Render the appropriate content based on selected tab */}
        {renderItems()}
      </ScrollView>

      {/* TokenDetailsDrawer */}
      {selectedAsset && (
        <TokenDetailsDrawer
          visible={showDetailsDrawer}
          onClose={() => {
            setShowDetailsDrawer(false);
            setDetailedNftData(null); // Clear the detailed data when drawer closes
          }}
          tokenMint={selectedAsset.mint || selectedAsset.id || 'unknown-token'}
          initialData={getInitialData()}
          loading={drawerLoading}
        />
      )}
    </>
  );
};

export default Collectibles;
