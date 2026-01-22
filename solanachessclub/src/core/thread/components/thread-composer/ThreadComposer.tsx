import React, { useCallback, useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Image,
  TextInput,
  TouchableOpacity,
  Text,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import Icons from '../../../../assets/svgs';
import {
  useAppDispatch,
  useAppSelector,
} from '../../../../shared/hooks/useReduxHooks';
import {
  createRootPostAsync,
  createReplyAsync,
  addPostLocally,
  addReplyLocally,
} from '../../../../shared/state/thread/reducer';
import { getThreadComposerBaseStyles } from './ThreadComposer.styles'; // Import new base styles function
import { mergeStyles } from '../../utils'; // Import the utility function
import {
  ThreadUser,
  ThreadSection,
  ThreadSectionType,
  ThreadPost
} from '../thread.types';
import * as ImagePicker from 'expo-image-picker';
import { TENSOR_API_KEY } from '@env';
import { useWallet } from '../../../../modules/wallet-providers/hooks/useWallet';
import TradeModal from '../trade/ShareTradeModal';
import { DEFAULT_IMAGES } from '@/shared/config/constants';
import { NftListingModal, useFetchNFTs, NftItem } from '../../../../modules/nft';
import { uploadThreadImage } from '../../services/threadImageService';
import {
  IPFSAwareImage,
  getValidImageSource,
  fixAllImageUrls,
} from '@/shared/utils/IPFSImage';
import { AutoAvatar } from '@/shared/components/AutoAvatar';
import COLORS from '@/assets/colors';
import Svg, { Path } from 'react-native-svg';
import { ShareTradeModalRef } from '../trade/ShareTradeModal.types';

/**
 * Props for the ThreadComposer component
 * @interface ThreadComposerProps
 */
interface ThreadComposerProps {
  /** Current user information - must have user.id set to wallet address */
  currentUser: ThreadUser;
  /** Optional parent post ID - if present, this composer is for a reply */
  parentId?: string;
  /** Callback fired when a new post is created */
  onPostCreated?: () => void;
  /** Theme overrides for customizing appearance */
  themeOverrides?: Partial<Record<string, any>>;
  /** Style overrides for specific components */
  styleOverrides?: { [key: string]: object };
  /** User-provided stylesheet overrides */
  userStyleSheet?: { [key: string]: object };
  /** Ref to expose the input focus method */
  ref?: React.Ref<{ focus: () => void }>;
}

/**
 * A component for composing new posts and replies in a thread
 *
 * @component
 * @description
 * ThreadComposer provides a rich text editor for creating new posts and replies in a thread.
 * It supports text input, image attachments, and NFT listings. The component handles both
 * root-level posts and nested replies, with appropriate styling and behavior for each case.
 *
 * Features:
 * - Text input with placeholder text
 * - Image attachment support
 * - NFT listing integration
 * - Reply composition
 * - Offline fallback support
 * - Customizable theming
 *
 * @example
 * ```tsx
 * <ThreadComposer
 *   currentUser={user}
 *   parentId="post-123" // Optional, for replies
 *   onPostCreated={() => refetchPosts()}
 *   themeOverrides={{ '--primary-color': '#1D9BF0' }}
 * />
 * ```
 */
export const ThreadComposer = forwardRef<{ focus: () => void }, ThreadComposerProps>(({
  currentUser,
  parentId,
  onPostCreated,
  themeOverrides,
  styleOverrides,
  userStyleSheet,
}, ref) => {
  const dispatch = useAppDispatch();
  const storedProfilePic = useAppSelector(state => state.auth.profilePicUrl);
  const inputRef = useRef<TextInput>(null);
  const tradeModalRef = useRef<ShareTradeModalRef>(null);

  // Expose focus method via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }));

  // Use wallet hook instead of useAuth directly
  const { wallet, address } = useWallet();

  // Use the wallet address from useWallet
  const userPublicKey = address || null;

  // Basic composer state
  const [textValue, setTextValue] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // NFT listing states
  const [showListingModal, setShowListingModal] = useState(false);
  const [selectedListingNft, setSelectedListingNft] = useState<NftItem | null>(
    null,
  );
  const [activeListings, setActiveListings] = useState<NftItem[]>([]);
  const [loadingActiveListings, setLoadingActiveListings] = useState(false);
  const [activeListingsError, setActiveListingsError] = useState<string | null>(null);

  // Show/hide the TradeModal
  const [showTradeModal, setShowTradeModal] = useState(false);
  const SOL_TO_LAMPORTS = 1_000_000_000;

  // 1. Get base styles (no theme needed)
  const baseComponentStyles = getThreadComposerBaseStyles();

  // 2. Merge styles using the utility function
  const styles = mergeStyles(baseComponentStyles, styleOverrides, userStyleSheet);

  // Animation for send button
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Update the animation value when content changes
  useEffect(() => {
    const hasContent = textValue.trim() || selectedImage || selectedListingNft;

    Animated.timing(fadeAnim, {
      toValue: hasContent ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [textValue, selectedImage, selectedListingNft, fadeAnim]);

  // Add this function to fetch active listings
  const fetchActiveListings = useCallback(async () => {
    if (!userPublicKey) return;
    setLoadingActiveListings(true);
    setActiveListingsError(null);

    try {
      const url = `https://api.mainnet.tensordev.io/api/v1/user/active_listings?wallets=${userPublicKey}&sortBy=PriceAsc&limit=50`;
      const options = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-tensor-api-key': TENSOR_API_KEY,
        },
      };

      const res = await fetch(url, options);
      if (!res.ok) {
        throw new Error(`Failed to fetch active listings: ${res.status}`);
      }

      const data = await res.json();
      if (data.listings && Array.isArray(data.listings)) {
        const mappedListings = data.listings.map((item: any) => {
          const mintObj = item.mint || {};
          const mintAddress = typeof item.mint === 'object' && item.mint.onchainId
            ? item.mint.onchainId
            : item.mint;
          const nftName = mintObj?.name || 'Unnamed NFT';
          const nftImage = fixAllImageUrls(mintObj?.imageUri || '');
          const nftCollection = mintObj?.collName || '';
          const lamports = parseInt(item.grossAmount || '0', 10);
          const priceSol = lamports / SOL_TO_LAMPORTS;

          return {
            mint: mintAddress,
            name: nftName,
            collection: nftCollection,
            image: nftImage,
            priceSol,
            isCompressed: item.compressed || false
          } as NftItem;
        });

        setActiveListings(mappedListings);
      } else {
        setActiveListings([]);
      }
    } catch (err: any) {
      console.error('Error fetching active listings:', err);
      setActiveListingsError(err.message || 'Failed to fetch active listings');
    } finally {
      setLoadingActiveListings(false);
    }
  }, [userPublicKey]);

  /**
   * Post creation logic
   */
  const handlePost = async () => {
    if (!textValue.trim() && !selectedImage && !selectedListingNft) return;

    // Show loading indicator
    setIsSubmitting(true);

    try {
      const sections: ThreadSection[] = [];

      // Text section
      if (textValue.trim()) {
        sections.push({
          id: 'section-' + Math.random().toString(36).substr(2, 9),
          type: 'TEXT_ONLY' as ThreadSectionType,
          text: textValue.trim(),
        });
      }

      // Image section - upload image to IPFS first
      if (selectedImage) {
        try {
          // First upload the image to IPFS
          const uploadedImageUrl = await uploadThreadImage(currentUser.id, selectedImage);

          // Once we have the IPFS URL, add it to sections
          sections.push({
            id: 'section-' + Math.random().toString(36).substr(2, 9),
            type: 'TEXT_IMAGE',
            text: '', // Can be empty or contain caption text
            imageUrl: { uri: uploadedImageUrl },
          });
        } catch (error) {
          console.error('Failed to upload image:', error);
          Alert.alert('Image Upload Error', 'Failed to upload image. Please try again.');
          setIsSubmitting(false);
          return;
        }
      }

      // NFT listing
      if (selectedListingNft) {
        sections.push({
          id: 'section-' + Math.random().toString(36).substr(2, 9),
          type: 'NFT_LISTING',
          listingData: {
            mint: selectedListingNft.mint,
            owner: currentUser.id, // wallet address
            priceSol: selectedListingNft.priceSol,
            name: selectedListingNft.name,
            image: selectedListingNft.image,
            collectionName: selectedListingNft.collection,
            // Add these critical fields for collection identification
            collId: selectedListingNft.collId,
            isCollection: selectedListingNft.isCollection,
            collectionDescription: selectedListingNft.collectionDescription
          },
        });
      }

      // Fallback post if network fails
      const fallbackPost = {
        id: 'local-' + Math.random().toString(36).substr(2, 9),
        userId: currentUser.id,
        user: currentUser,
        sections,
        createdAt: new Date().toISOString(),
        parentId: parentId ?? undefined,
        replies: [],
        reactionCount: 0,
        retweetCount: 0,
        quoteCount: 0,
      };

      if (parentId) {
        // create a reply by passing only the user id
        await dispatch(
          createReplyAsync({
            parentId,
            userId: currentUser.id,
            sections,
          }),
        ).unwrap();
      } else {
        // create a root post by passing only the user id
        await dispatch(
          createRootPostAsync({
            userId: currentUser.id,
            sections,
          }),
        ).unwrap();
      }

      // Clear composer
      setTextValue('');
      setSelectedImage(null);
      setSelectedListingNft(null);
      onPostCreated && onPostCreated();
    } catch (error: any) {
      console.warn(
        'Network request failed, adding post locally:',
        error.message,
      );

      // Create a local fallback post with the sections we have
      const fallbackPost = {
        id: 'local-' + Math.random().toString(36).substr(2, 9),
        userId: currentUser.id,
        user: currentUser,
        sections: [], // We can't add the sections here because we don't have the image URLs
        createdAt: new Date().toISOString(),
        parentId: parentId ?? undefined,
        replies: [],
        reactionCount: 0,
        retweetCount: 0,
        quoteCount: 0,
      };

      if (parentId) {
        dispatch(addReplyLocally({ parentId, reply: fallbackPost }));
      } else {
        dispatch(addPostLocally(fallbackPost));
      }

      setTextValue('');
      setSelectedImage(null);
      setSelectedListingNft(null);
      onPostCreated && onPostCreated();
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (userPublicKey) {
      fetchActiveListings();
    }
  }, [userPublicKey, fetchActiveListings]);

  /**
   * Media picking
   */
  const handleMediaPress = useCallback(async () => {
    try {
      // Request permissions first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library to attach images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1]
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pickedUri = result.assets[0].uri;
        setSelectedImage(pickedUri);
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error picking image', error.message);
    }
  }, []);

  /**
   * Listing Flow
   */
  const handleNftListingPress = () => {
    // Refresh listings when the modal is opened
    fetchActiveListings().then(() => {
      setShowListingModal(true);
    });
  };

  const handleSelectListing = (item: NftItem) => {
    setSelectedListingNft(item);
    setShowListingModal(false);
  };

  const handleTradeSharePress = async () => {
    if (tradeModalRef.current) {
      await tradeModalRef.current.forceRefresh();
    }
    setShowTradeModal(true);
  };

  // Add debug logging for Android IPFS image handling
  if (Platform.OS === 'android' && storedProfilePic) {
    console.log('Profile image source being used:', JSON.stringify(getValidImageSource(storedProfilePic)));
  }

  return (
    <View>
      <View style={styles.composerContainer}>
        <View style={[styles.composerAvatarContainer, { backgroundColor: COLORS.background }]}>
          <AutoAvatar
            userId={currentUser.id}
            profilePicUrl={
              storedProfilePic ||
              (typeof currentUser.avatar === 'string' ? currentUser.avatar : 
               (currentUser.avatar && typeof currentUser.avatar === 'object' && 'uri' in currentUser.avatar ? currentUser.avatar.uri : null))
            }
            username={currentUser.username}
            size={40}
            style={styles.composerAvatar}
            showInitials={true}
          />
        </View>

        <View style={styles.composerMiddle}>
          <Text style={styles.composerUsername}>{currentUser.username}</Text>
          <TextInput
            ref={inputRef}
            style={styles.composerInput}
            placeholder={parentId ? 'Reply...' : "Got something to say?"}
            placeholderTextColor="#999"
            value={textValue}
            onChangeText={setTextValue}
            multiline
            keyboardAppearance="dark"
          />

          {/* Selected image preview */}
          {selectedImage && (
            <View style={styles.imagePreviewContainer}>
              <Image
                source={{ uri: selectedImage }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => setSelectedImage(null)}>
                <Text style={styles.removeImageButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* NFT listing preview */}
          {selectedListingNft && (
            <View style={[styles.composerTradePreview, { backgroundColor: COLORS.lightBackground }]}>
              <IPFSAwareImage
                source={getValidImageSource(selectedListingNft.image)}
                style={styles.composerTradeImage}
                defaultSource={DEFAULT_IMAGES.user}
              />
              <View style={{ marginLeft: 8, flex: 1 }}>
                <Text style={styles.composerTradeName} numberOfLines={1}>
                  {selectedListingNft.name}
                </Text>
                {/* If price is known, display it */}
              </View>
              <TouchableOpacity
                style={[styles.composerTradeRemove, { backgroundColor: COLORS.greyDark }]}
                onPress={() => setSelectedListingNft(null)}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>X</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.iconsRow}>
            <View style={styles.leftIcons}>
              <TouchableOpacity
                onPress={handleMediaPress}
                style={styles.iconButton}>
                <Icons.ImageIcon width={22} height={22} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleNftListingPress}
                style={styles.iconButton}>
                <Icons.NFTIcon width={22} height={22} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleTradeSharePress}
                style={styles.iconButton}>
                <Icons.TradeShare width={22} height={22} />
              </TouchableOpacity>
            </View>

            {/* Right side with animated send button */}
            <Animated.View style={{
              opacity: fadeAnim,
              transform: [{
                scale: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 1]
                })
              }]
            }}>
              <TouchableOpacity
                onPress={handlePost}
                disabled={isSubmitting || !(textValue.trim() || selectedImage || selectedListingNft)}
                style={styles.sendButton}>
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  // Wider paper plane SVG with proper tilt
                  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M3 11l19-7.5-6 18.5-3.5-7L3 11zm0 0l9.5 4"
                      fill={COLORS.brandBlue}
                      stroke={COLORS.brandBlue}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </View>

      {/* Listing Modal */}
      <NftListingModal
        visible={showListingModal}
        onClose={() => setShowListingModal(false)}
        onShare={(listingData) => {
          // Convert from NftListingData to NftItem for our internal usage
          const nftItem: NftItem = {
            mint: listingData.mint || '',
            name: listingData.name || '',
            image: listingData.image || '',
            collection: listingData.collectionName,
            isCompressed: listingData.isCompressed,
            priceSol: listingData.priceSol,
            // Add these critical fields for collection identification
            collId: listingData.collId,
            isCollection: listingData.isCollection,
            collectionDescription: listingData.collectionDescription
          };
          handleSelectListing(nftItem);
        }}
        listingItems={activeListings}
        loadingListings={loadingActiveListings}
        fetchNftsError={activeListingsError}
        styles={styles} // Pass merged styles down
      />

      {/* Trade Modal */}
      <TradeModal
        ref={tradeModalRef}
        visible={showTradeModal}
        onClose={() => setShowTradeModal(false)}
        onShare={async (tradeData) => {
          try {
            console.log('[ThreadComposer] Received trade data to share:', JSON.stringify(tradeData, null, 2));

            // Create a section with the trade data
            const section: ThreadSection = {
              id: 'section-' + Math.random().toString(36).substr(2, 9),
              type: 'TEXT_TRADE',
              tradeData,
              text: tradeData.message, // Add the message as text
            };

            // Dispatch action to create post with trade data
            await dispatch(createRootPostAsync({
              userId: currentUser.id,
              sections: [section],
            })).unwrap();

            console.log('[ThreadComposer] Successfully dispatched trade post to Redux');

            // Close the modal
            setShowTradeModal(false);

            // Call onPostCreated callback to refresh the feed
            if (onPostCreated) {
              onPostCreated();
              console.log('[ThreadComposer] Called onPostCreated callback');
            }

            return true;
          } catch (error) {
            console.error('[ThreadComposer] Error sharing trade:', error);

            // Create fallback post for local display
            const fallbackPost = {
              id: 'local-' + Math.random().toString(36).substr(2, 9),
              user: currentUser,
              sections: [{
                id: 'section-' + Math.random().toString(36).substr(2, 9),
                type: 'TEXT_TRADE',
                tradeData,
                text: tradeData.message, // Add the message as text
              }],
              createdAt: new Date().toISOString(),
              parentId: undefined,
              replies: [],
              reactionCount: 0,
              retweetCount: 0,
              quoteCount: 0,
            };

            // Add locally via Redux
            dispatch(addPostLocally(fallbackPost as ThreadPost));
            console.log('[ThreadComposer] Added trade post locally');

            // Close the modal
            setShowTradeModal(false);

            // Call onPostCreated callback to refresh the feed
            if (onPostCreated) {
              onPostCreated();
              console.log('[ThreadComposer] Called onPostCreated callback');
            }

            throw error; // Rethrow for the modal to handle
          }
        }}
        currentUser={currentUser}
      />
    </View>
  );
});

// Also export as default for backward compatibility
export default ThreadComposer;
