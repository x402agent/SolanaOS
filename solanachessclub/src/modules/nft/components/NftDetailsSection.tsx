import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, ActivityIndicator, TouchableOpacity, Animated, Easing, Dimensions, StyleSheet } from 'react-native';
import { DEFAULT_IMAGES } from '@/shared/config/constants';
import TokenDetailsDrawer from '@/core/shared-ui/TokenDetailsDrawer/TokenDetailsDrawer';

// Import types
import { NftListingData } from '../types';

// Import services
import { fetchCollectionData, fetchNftMetadata } from '../services/nftService';

// Import utilities
import { formatSolPrice, getNftImageSource } from '../utils/imageUtils';

import COLORS from '@/assets/colors';
// Create a cache for NFT and collection data to prevent redundant fetches
const nftDataCache = new Map<string, any>();
const collectionDataCache = new Map<string, any>();

// Styles
import styles from './NftDetailsSection.style';

// For skeleton animation
const { width } = Dimensions.get('window');

// Skeleton element for shimmer effect
const SkeletonElement = ({ style }: { style: any }) => {
  const shimmerAnimatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.timing(shimmerAnimatedValue, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    shimmerAnimation.start();
    return () => shimmerAnimation.stop();
  }, [shimmerAnimatedValue]);

  const translateX = shimmerAnimatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  return (
    <View style={[skeletonStyles.skeletonElement, style]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          skeletonStyles.shimmer,
          { transform: [{ translateX }] },
        ]}
      />
    </View>
  );
};

// NFT Details Skeleton Component
const NftDetailsSkeleton = () => {
  return (
    <View style={{ flexDirection: 'row', width: '100%' }}>
      {/* Image placeholder */}
      <SkeletonElement style={skeletonStyles.imageSkeleton} />

      {/* Content skeleton */}
      <View style={skeletonStyles.contentContainer}>
        {/* Title skeleton */}
        <SkeletonElement style={skeletonStyles.titleSkeleton} />

        {/* Collection name skeleton */}
        <SkeletonElement style={[skeletonStyles.textSkeleton, { width: '60%', marginTop: 6 }]} />

        {/* Price skeleton */}
        <SkeletonElement style={[skeletonStyles.textSkeleton, { width: '70%', marginTop: 6 }]} />

        {/* Last sale skeleton */}
        <SkeletonElement style={[skeletonStyles.textSkeleton, { width: '80%', marginTop: 6 }]} />
      </View>
    </View>
  );
};

// Skeleton styles
const skeletonStyles = {
  skeletonElement: {
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 4,
    overflow: 'hidden',
  },
  shimmer: {
    backgroundColor: COLORS.darkerBackground,
    opacity: 0.6,
  },
  imageSkeleton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center' as const,
  },
  titleSkeleton: {
    height: 18,
    width: '80%',
    borderRadius: 4,
  },
  textSkeleton: {
    height: 14,
    borderRadius: 4,
  },
};

interface NftDetailsSectionProps {
  /** NFT or Collection data to display */
  listingData?: NftListingData;
  /** Optional styling overrides */
  containerStyle?: any;
  /** Optional callback when the drawer is opened */
  onDetailsOpen?: () => void;
}

/**
 * Component for displaying NFT or collection details with caching and drawer functionality
 */
export default function NftDetailsSection({
  listingData,
  containerStyle,
  onDetailsOpen
}: NftDetailsSectionProps) {
  const [loading, setLoading] = useState(false);
  const [nftData, setNftData] = useState<any>(null);
  const [collectionData, setCollectionData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNftDetailsDrawer, setShowNftDetailsDrawer] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Track what we last fetched to avoid redundant fetches
  const lastFetchedRef = useRef<{ mint?: string, collId?: string } | null>(null);
  // Track if the component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!listingData) return;

    // Check if we have cached data
    if (listingData.isCollection && listingData.collId && collectionDataCache.has(listingData.collId)) {
      const cachedData = collectionDataCache.get(listingData.collId);
      if (cachedData) {
        setCollectionData(cachedData);
        return;
      }
    } else if (listingData.mint && nftDataCache.has(listingData.mint)) {
      const cachedData = nftDataCache.get(listingData.mint);
      if (cachedData) {
        setNftData(cachedData);
        return;
      }
    }

    // If no cached data, determine if we need to fetch data
    const needsFetch =
      !lastFetchedRef.current ||
      (listingData.mint && lastFetchedRef.current.mint !== listingData.mint) ||
      (listingData.collId && lastFetchedRef.current.collId !== listingData.collId);

    if (!needsFetch) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        // Fetch collection data if this is a collection listing
        if (listingData.isCollection && listingData.collId) {
          await fetchCollectionDataWithCache(listingData.collId);
          if (cancelled) return;
        }
        // Otherwise fetch specific NFT data
        else if (listingData.mint) {
          await fetchNftDataWithCache(listingData.mint);
          if (cancelled) return;
        } else {
          setError('No mint or collection ID provided');
        }
      } catch (err: any) {
        if (!cancelled && isMountedRef.current) {
          setError(err.message || 'Failed to fetch data');
        }
      } finally {
        if (!cancelled && isMountedRef.current) {
          setLoading(false);
          // Track what we fetched
          lastFetchedRef.current = {
            mint: listingData.mint,
            collId: listingData.collId
          };
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [listingData?.mint, listingData?.collId, listingData?.isCollection]);

  // Function to fetch NFT data with caching
  const fetchNftDataWithCache = async (mint: string) => {
    // Check cache first
    if (nftDataCache.has(mint)) {
      const cachedData = nftDataCache.get(mint);
      if (isMountedRef.current) {
        setNftData(cachedData);
      }
      return;
    }

    try {
      const data = await fetchNftMetadata(mint);
      // Cache the data
      nftDataCache.set(mint, data);
      if (isMountedRef.current) {
        setNftData(data);
      }
    } catch (error) {
      throw error;
    }
  };

  // Function to fetch collection data with caching
  const fetchCollectionDataWithCache = async (collId: string) => {
    // Check cache first
    if (collectionDataCache.has(collId)) {
      const cachedData = collectionDataCache.get(collId);
      if (isMountedRef.current) {
        setCollectionData(cachedData);
      }
      return;
    }

    try {
      const data = await fetchCollectionData(collId);
      // Cache the data
      collectionDataCache.set(collId, data);
      if (isMountedRef.current) {
        setCollectionData(data);
      }
    } catch (error) {
      throw error;
    }
  };

  // Handle opening the NFT details drawer
  const handleOpenNftDetails = async () => {
    if (onDetailsOpen) {
      onDetailsOpen();
    }

    // Show loading indicator briefly
    setDrawerLoading(true);

    // If we need to fetch data, do so before showing the drawer
    if (!nftData && listingData?.mint) {
      try {
        await fetchNftDataWithCache(listingData.mint);
      } catch (err) {
        console.error('Error fetching NFT data for drawer:', err);
      }
    }

    if (!collectionData && listingData?.isCollection && listingData?.collId) {
      try {
        await fetchCollectionDataWithCache(listingData.collId);
      } catch (err) {
        console.error('Error fetching collection data for drawer:', err);
      }
    }

    // Short timeout to ensure smoother opening experience
    setTimeout(() => {
      setDrawerLoading(false);
      setShowNftDetailsDrawer(true);
    }, 300);
  };

  if (!listingData) {
    return <Text>[Missing listing data]</Text>;
  }

  // Render based on whether it's a collection or specific NFT
  const renderContent = () => {
    if (loading) {
      return <NftDetailsSkeleton />;
    }

    if (listingData.isCollection) {
      return (
        <>
          <View style={styles.imageContainer}>
            {listingData.image || (collectionData?.imageUri) ? (
              <Image
                source={getNftImageSource(listingData.image || collectionData?.imageUri, DEFAULT_IMAGES.user)}
                style={styles.image}
              />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>No Image</Text>
              </View>
            )}
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.nftTitle} numberOfLines={1}>
              {listingData.collectionName || collectionData?.name || 'Unnamed Collection'}
            </Text>

            {collectionData?.floorPrice && (
              <Text style={[styles.priceText, { color: '#32D4DE' }]}>
                Current Floor: <Text>{formatSolPrice(collectionData.floorPrice)}</Text> <Text>SOL</Text>
              </Text>
            )}

            {collectionData?.description && (
              <Text style={styles.collectionDescription} numberOfLines={2}>
                {collectionData.description}
              </Text>
            )}

            {collectionData?.tokenCount && (
              <Text style={styles.rarityInfo}>
                Items: {collectionData.tokenCount}
              </Text>
            )}
          </View>
        </>
      );
    }

    // Regular NFT listing display
    return (
      <>
        <View style={styles.imageContainer}>
          {nftData?.imageUri ? (
            <Image
              source={getNftImageSource(nftData.imageUri, DEFAULT_IMAGES.user)}
              style={styles.image}
            />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.nftTitle} numberOfLines={1}>
            {nftData?.name || listingData.name || 'Unnamed NFT'}
          </Text>

          {nftData?.collName && (
            <Text style={styles.collectionName}>
              Collection: {nftData.collName}
            </Text>
          )}

          {nftData?.listing?.price && (
            <Text style={styles.priceText}>
              Listed @ <Text>{formatSolPrice(nftData.listing.price, true)}</Text> <Text>SOL</Text>
            </Text>
          )}

          {nftData?.lastSale?.price && (
            <Text style={styles.lastSale}>
              Last sale: <Text>{formatSolPrice(nftData.lastSale.price, true)}</Text> <Text>SOL</Text>
            </Text>
          )}

          {nftData?.rarityRankTN && (
            <Text style={styles.rarityInfo}>
              Rarity Rank: #{nftData.rarityRankTN} of{' '}
              {nftData.numMints || '?'}
            </Text>
          )}
        </View>
      </>
    );
  };

  // Get the appropriate data for the drawer
  const getNftDetailsForDrawer = () => {
    if (listingData.isCollection) {
      return {
        mint: listingData.collId || '',
        symbol: '',
        name: listingData.collectionName || collectionData?.name || 'Collection',
        logoURI: listingData.image || collectionData?.imageUri || '',
        isCollection: true,
        collectionData: collectionData
      };
    } else {
      return {
        mint: listingData.mint || '',
        symbol: '',
        name: nftData?.name || listingData.name || 'NFT',
        logoURI: nftData?.imageUri || '',
        nftData: nftData
      };
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.container, containerStyle]}
        activeOpacity={0.7}
        onPress={handleOpenNftDetails}
      >
        <View style={styles.card}>
          {renderContent()}

          {error && (
            <Text style={{ color: 'red', marginTop: 8, fontSize: 12 }}>
              {error}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* NFT Details Drawer */}
      <TokenDetailsDrawer
        visible={showNftDetailsDrawer}
        onClose={() => setShowNftDetailsDrawer(false)}
        tokenMint={listingData.collId || listingData.mint || ''}
        initialData={getNftDetailsForDrawer()}
        loading={drawerLoading}
      />
    </>
  );
} 