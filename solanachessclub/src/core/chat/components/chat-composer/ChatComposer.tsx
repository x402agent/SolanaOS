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
import Icons from '@/assets/svgs';
import {
  useAppDispatch,
  useAppSelector,
} from '@/shared/hooks/useReduxHooks';
import {
  createRootPostAsync,
  createReplyAsync,
  addPostLocally,
  addReplyLocally,
} from '@/shared/state/thread/reducer';
import { getChatComposerBaseStyles } from './ChatComposer.styles';
import { mergeStyles } from '../../utils';
import { ThreadSection, ThreadSectionType, ThreadUser, TradeData, ThreadPost } from '../../../thread/types';
import * as ImagePicker from 'expo-image-picker';
import { TENSOR_API_KEY } from '@env';
import { useWallet } from '@/modules/wallet-providers/hooks/useWallet';
import TradeModal from '../../../thread/components/trade/ShareTradeModal';
import { DEFAULT_IMAGES } from '@/shared/config/constants';
import { NftListingModal, NftItem, NftListingData } from '@/modules/nft';
import { uploadThreadImage } from '../../../thread/services/threadImageService';
import {
  IPFSAwareImage,
  getValidImageSource,
  fixIPFSUrl,
} from '@/shared/utils/IPFSImage';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import Svg, { Path } from 'react-native-svg';
import { uploadChatImage } from '../../services/chatImageService';
import { sendMessage } from '@/shared/state/chat/slice';
import socketService from '@/shared/services/socketService';

/**
 * Props for the ChatComposer component
 * @interface ChatComposerProps
 */
interface ChatComposerProps {
  /** Current user information - must have user.id set to wallet address */
  currentUser: ThreadUser;
  /** Optional parent post ID - if present, this composer is for a reply */
  parentId?: string;
  /** Callback fired when a new message is created, with message content */
  onMessageSent?: (content: string, imageUrl?: string) => void;
  /** Theme overrides for customizing appearance */
  themeOverrides?: Partial<Record<string, any>>;
  /** Style overrides for specific components */
  styleOverrides?: { [key: string]: object };
  /** User-provided stylesheet overrides */
  userStyleSheet?: { [key: string]: object };
  /** Ref to expose the input focus method */
  ref?: React.Ref<{ focus: () => void }>;
  /** Optional chat context - if provided, shares go to this chat */
  chatContext?: { chatId: string };
  /** Optional controlled input value */
  inputValue?: string;
  /** Optional callback for input changes */
  onInputChange?: (value: string) => void;
  /** Optional flag to disable the composer */
  disabled?: boolean;
}

/**
 * A component for composing new messages in a chat
 *
 * @component
 * @description
 * ChatComposer provides a modern chat input UI with support for text, images, 
 * NFT listings, and other media. It has a chat-like UI with icons on the right.
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
 * <ChatComposer
 *   currentUser={user}
 *   parentId="chat-123" // Optional, for replies
 *   onMessageSent={(content, imageUrl) => handleMessageSent(content, imageUrl)}
 *   themeOverrides={{ '--primary-color': '#1D9BF0' }}
 * />
 * ```
 */
export const ChatComposer = forwardRef<{ focus: () => void }, ChatComposerProps>(({
  currentUser,
  parentId,
  onMessageSent,
  chatContext,
  themeOverrides,
  styleOverrides,
  userStyleSheet,
  inputValue,
  onInputChange,
  disabled = false,
}, ref) => {
  const dispatch = useAppDispatch();
  const storedProfilePic = useAppSelector(state => state.auth.profilePicUrl);
  const inputRef = useRef<TextInput>(null);

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

  // Internal state for text, unless controlled by inputValue prop
  const [textValue, setTextValue] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);

  // NFT listing states
  const [showListingModal, setShowListingModal] = useState(false);
  const [selectedListingNft, setSelectedListingNft] = useState<NftItem | null>(
    null,
  );
  const [activeListings, setActiveListings] = useState<NftItem[]>([]);
  const [loadingActiveListings, setLoadingActiveListings] = useState(false);
  const [activeListingsError, setActiveListingsError] = useState<string | null>(null);

  // Trade modal state
  const [showTradeModal, setShowTradeModal] = useState(false);
  const SOL_TO_LAMPORTS = 1_000_000_000;

  // Deconstruct the new props with defaults
  const { inputValue: propsInputValue, onInputChange: propsOnInputChange, disabled: propsDisabled = false } = {
    inputValue: inputValue,
    onInputChange: onInputChange,
    disabled: disabled
  };

  // Determine the text to display/use based on whether input is controlled
  const currentTextValue = propsInputValue !== undefined ? propsInputValue : textValue;

  // Handle text input changes
  const handleTextChange = (newText: string) => {
    if (propsOnInputChange) {
      propsOnInputChange(newText);
    } else {
      setTextValue(newText);
    }
  };

  /**
   * Get base styles for the composer
   */
  const baseStyles = getChatComposerBaseStyles();

  /**
   * Merge the original styles with user overrides
   */
  const styles = mergeStyles(baseStyles, styleOverrides, userStyleSheet);

  /**
   * Use Animated API for attach button animation
   */
  const attachButtonAnim = useRef(new Animated.Value(0)).current;

  /**
   * Fetch active listings for the NFT modal - using direct API call similar to ThreadComposer
   */
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
          const nftImage = fixIPFSUrl(mintObj?.imageUri || '');
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
   * Message sending logic
   */
  const handleSend = async () => {
    if (!currentTextValue.trim() && !selectedImage) return;

    // If called from ChatScreen (onMessageSent is provided)
    if (onMessageSent) {
      setIsSubmitting(true);
      try {
        let uploadedImageUrl = '';
        if (selectedImage) {
          try {
            uploadedImageUrl = await uploadChatImage(currentUser.id, selectedImage);
          } catch (error) {
            console.error('Failed to upload chat image:', error);
            Alert.alert('Image Upload Error', 'Failed to upload image. Please try again.');
            setIsSubmitting(false);
            return;
          }
        }
        onMessageSent(currentTextValue, uploadedImageUrl);
        setTextValue('');
        setSelectedImage(null);
      } catch (error) {
        console.error('Error sending message:', error);
        Alert.alert('Error', 'Failed to send message. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // The following is only executed for posting to threads

    // Show loading indicator
    setIsSubmitting(true);

    try {
      const sections = prepareSections(currentTextValue);
      let post: ThreadPost | null = null;

      // Ensure currentUser ID is set
      if (!currentUser.id) {
        throw new Error("Cannot create post: Current user ID is missing.");
      }

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

      // Reset internal state if not controlled
      if (propsInputValue === undefined) {
        setTextValue('');
      }
      // Always reset image and listing
      setSelectedImage(null);
      setSelectedListingNft(null);

      // Optionally, scroll to the new post or provide feedback
    } catch (error: any) {
      console.warn(
        'Network request failed, adding message locally:',
        error.message,
      );

      // Create a local fallback post with the sections we have
      const fallbackPost = {
        id: 'local-' + Math.random().toString(36).substr(2, 9),
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
    }
    setIsSubmitting(false);
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

  // Render attachment previews if any
  const renderAttachmentPreviews = () => {
    if (!selectedImage && !selectedListingNft) return null;

    return (
      <View style={styles.attachmentPreviewsContainer}>
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
          <View style={styles.composerTradePreview}>
            <IPFSAwareImage
              source={getValidImageSource(selectedListingNft.image)}
              style={styles.composerTradeImage}
              defaultSource={DEFAULT_IMAGES.user}
              key={Platform.OS === 'android' ? `nft-${Date.now()}` : 'nft'}
            />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <Text style={styles.composerTradeName} numberOfLines={1}>
                {selectedListingNft.name}
              </Text>
              {/* If price is known, display it */}
            </View>
            <TouchableOpacity
              style={styles.composerTradeRemove}
              onPress={() => setSelectedListingNft(null)}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>X</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Determine if send button should be enabled
  const canSend = currentTextValue.trim() !== '' || selectedImage !== null || selectedListingNft !== null;

  // Define the onShare handler for NFT modal
  const handleShareNft = useCallback(async (data: NftListingData) => {
    if (chatContext) {
      // Share to Chat
      console.log(`[ChatComposer] Sharing NFT to chat ${chatContext.chatId}`);
      setIsSubmitting(true);
      try {
        // Send via API
        const resultAction = await dispatch(sendMessage({
          chatId: chatContext.chatId,
          userId: currentUser.id,
          content: '', // Can be empty when sending structured data
          additionalData: { nftData: data }, // Send NFT data here
        })).unwrap();

        // If successful and we have socket connection, also send via socket for real-time updates
        if (resultAction && resultAction.id) {
          // Create a message payload for the socket that includes all necessary data
          const socketPayload = {
            ...resultAction,
            senderId: currentUser.id,
            sender_id: currentUser.id,
            chatId: chatContext.chatId,
            chat_room_id: chatContext.chatId
          };

          // Send via socket (if connected)
          socketService.sendMessage(chatContext.chatId, socketPayload);
        }
      } catch (error) {
        console.error('Failed to send NFT message:', error);
        Alert.alert('Error', 'Could not share NFT to chat.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Share to Feed (existing logic)
      console.log('[ChatComposer] Sharing NFT to feed');

      // Ensure owner is string | null for ThreadSection
      const threadListingData = {
        ...data,
        owner: data.owner || null, // Convert undefined owner to null
      };

      const sections: ThreadSection[] = [{
        id: 'section-' + Math.random().toString(36).substr(2, 9),
        type: 'NFT_LISTING' as ThreadSectionType,
        listingData: threadListingData // Use the corrected data object
      }];

      // Add default text if needed
      sections.push({
        id: 'text-' + Math.random().toString(36).substr(2, 9),
        type: 'TEXT_ONLY' as ThreadSectionType,
        text: `Sharing ${data.isCollection ? 'collection' : 'NFT'}: ${data.name}`
      });

      // Create user object for fallback
      const user: ThreadUser = {
        id: currentUser.id,
        username: currentUser.username || 'Anonymous',
        handle: currentUser.handle || '@anonymous',
        verified: currentUser.verified || false,
        avatar: currentUser.avatar || DEFAULT_IMAGES.user,
      };

      const fallbackPost: ThreadPost = {
        id: 'local-' + Math.random().toString(36).substr(2, 9),
        user: user,
        sections,
        createdAt: new Date().toISOString(),
        replies: [],
        reactionCount: 0,
        retweetCount: 0,
        quoteCount: 0,
      };
      setIsSubmitting(true);
      try {
        await dispatch(createRootPostAsync({
          userId: currentUser.id,
          sections,
          // localId if needed for optimistic updates
        })).unwrap();
      } catch (error: any) {
        console.warn('Feed post failed, adding locally', error);
        dispatch(addPostLocally(fallbackPost));
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [chatContext, currentUser, dispatch]);

  // Define the onShare handler for Trade modal
  const handleShareTrade = useCallback(async (data: TradeData) => {
    console.log(`[ChatComposer] Sharing Trade with data:`, JSON.stringify(data, null, 2));

    if (chatContext) {
      // Share to Chat
      console.log(`[ChatComposer] Sharing Trade to chat ${chatContext.chatId}`);
      setIsSubmitting(true);
      try {
        // Send via API
        const resultAction = await dispatch(sendMessage({
          chatId: chatContext.chatId,
          userId: currentUser.id,
          content: `Shared a trade: ${data.inputSymbol} → ${data.outputSymbol}`,
          additionalData: { tradeData: data }, // Send Trade data here
        })).unwrap();

        // If successful and we have socket connection, also send via socket for real-time updates
        if (resultAction && resultAction.id) {
          // Create a message payload for the socket that includes all necessary data
          const socketPayload = {
            ...resultAction,
            senderId: currentUser.id,
            sender_id: currentUser.id,
            chatId: chatContext.chatId,
            chat_room_id: chatContext.chatId
          };

          // Send via socket (if connected)
          socketService.sendMessage(chatContext.chatId, socketPayload);

          // Alert the user that the trade was shared successfully
          Alert.alert('Success', 'Trade shared to chat successfully!');
        }

        return resultAction; // Return result for the modal to handle
      } catch (error) {
        console.error('Failed to send trade message:', error);
        Alert.alert('Error', 'Could not share trade to chat. Please try again.');
        throw error; // Rethrow to let modal handle it
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Share to Feed (existing logic)
      console.log('[ChatComposer] Sharing Trade to feed');
      const sections: ThreadSection[] = [{
        id: 'section-' + Math.random().toString(36).substr(2, 9),
        type: 'TEXT_TRADE',
        tradeData: data,
        text: `Executed a trade: ${data.inputSymbol} → ${data.outputSymbol}`
      }];

      const fallbackPost = {
        id: 'local-' + Math.random().toString(36).substr(2, 9),
        user: currentUser,
        sections, // Include sections in the fallback post
        createdAt: new Date().toISOString(),
        parentId: parentId ?? undefined,
        replies: [],
        reactionCount: 0,
        retweetCount: 0,
        quoteCount: 0,
      };

      setIsSubmitting(true);
      try {
        const result = await dispatch(createRootPostAsync({
          userId: currentUser.id,
          sections,
        })).unwrap();

        console.log('[ChatComposer] Trade post created successfully:', result);

        // Alert the user that the trade was shared successfully
        Alert.alert('Success', 'Trade shared to feed successfully!');

        return result; // Return result for the modal to handle
      } catch (error: any) {
        console.warn('Feed post failed, adding locally:', error);
        dispatch(addPostLocally(fallbackPost as ThreadPost));

        // Even though we added it locally, still alert the user
        Alert.alert('Note', 'Post added locally due to network issues. It will be synced when reconnected.');
        throw error; // Rethrow to let modal handle it
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [chatContext, currentUser, dispatch, parentId]);

  /**
   * Prepare sections for Thread submission
   */
  const prepareSections = (currentText: string): ThreadSection[] => {
    const sections: ThreadSection[] = [];

    if (currentText.trim()) {
      sections.push({
        id: 'section-' + Math.random().toString(36).substr(2, 9),
        type: 'TEXT_ONLY',
        text: currentText.trim(),
      });
    }

    // Note: Image upload logic is handled within handleSend for threads

    // NFT listing
    if (selectedListingNft) {
      sections.push({
        id: 'section-' + Math.random().toString(36).substr(2, 9),
        type: 'NFT_LISTING',
        listingData: {
          mint: selectedListingNft.mint,
          owner: currentUser.id, // wallet address
          priceSol: undefined, // or logic if you have a price
          name: selectedListingNft.name,
          image: selectedListingNft.image,
        },
      });
    }

    return sections;
  };

  return (
    <View>
      {renderAttachmentPreviews()}

      <View style={styles.composerContainer}>
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.composerInput}
            placeholder={parentId ? 'Reply...' : "Type a message..."}
            placeholderTextColor="#999"
            value={currentTextValue}
            onChangeText={handleTextChange}
            multiline
            keyboardAppearance="dark"
          />

          <View style={styles.iconsContainer}>
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
              onPress={() => setShowTradeModal(true)}
              style={styles.iconButton}>
              <Icons.TradeShare width={22} height={22} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.sendButton,
            !canSend && styles.disabledSendButton,
          ]}
          onPress={handleSend}
          disabled={!canSend || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <Path
                d="M20.01 3.87L3.87 8.25C3.11 8.51 3.15 9.65 3.92 9.85L10.03 11.85L12.03 17.98C12.24 18.74 13.37 18.78 13.63 18.03L20.01 3.87Z"
                fill="#FFFFFF"
              />
            </Svg>
          )}
        </TouchableOpacity>
      </View>

      {/* Listing Modal */}
      <NftListingModal
        visible={showListingModal}
        onClose={() => setShowListingModal(false)}
        onShare={handleShareNft}
        listingItems={activeListings}
        loadingListings={loadingActiveListings}
        fetchNftsError={activeListingsError}
        styles={styles}
      />

      <TradeModal
        visible={showTradeModal}
        onClose={() => setShowTradeModal(false)}
        onShare={handleShareTrade}
        currentUser={currentUser}
      />
    </View>
  );
});

// Also export as default for backward compatibility
export default ChatComposer; 