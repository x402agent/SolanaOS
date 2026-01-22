import React, { useState, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleProp,
  ViewStyle,
  TextStyle,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import type { ThreadPost, ThreadUser } from '../thread.types';
import { useSelector } from 'react-redux';
import { RootState } from '@/shared/state/store';
import { Cluster, clusterApiUrl, Connection } from '@solana/web3.js';
import { CLUSTER } from '@env';
import { useWallet } from '@/modules/wallet-providers/hooks/useWallet';
import { useAppSelector } from '@/shared/hooks/useReduxHooks';
import { DEFAULT_IMAGES, ENDPOINTS } from '@/shared/config/constants';
import { TransactionService } from '@/modules/wallet-providers/services/transaction/transactionService';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Import NFT services
import { buyNft, buyCollectionFloor } from '@/modules/nft';
import { createPostCTAStyles } from './PostCTA.styles';

// Import the DEFAULT_SOL_TOKEN for trading
import { DEFAULT_SOL_TOKEN, TokenInfo } from '@/modules/data-module';

// Import the RootStackParamList for type-safe navigation
import { RootStackParamList } from '@/shared/navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SwapScreen'>;

/**
 * Determines the type of CTA to display based on the post's sections
 * @param {ThreadPost} post - The post to analyze
 * @returns {'trade' | 'nft' | 'collection' | null} The type of CTA to display
 */
function getPostSectionType(post: ThreadPost) {
  for (const section of post.sections) {
    if (section.type === 'TEXT_TRADE') return 'trade';
    if (section.type === 'NFT_LISTING') {
      return section.listingData?.isCollection ? 'collection' : 'nft';
    }
  }
  return null;
}

/**
 * Extracts trade data from a post's TEXT_TRADE section
 * @param {ThreadPost} post - The post to extract trade data from
 * @returns {TradeData | null} The trade data if found, null otherwise
 */
function getTradeData(post: ThreadPost) {
  for (const section of post.sections) {
    if (section.type === 'TEXT_TRADE' && section.tradeData) {
      return section.tradeData;
    }
  }
  return null;
}

/**
 * Props for the PostCTA component
 * @interface PostCTAProps
 */
interface PostCTAProps {
  /** The post data to display the CTA for */
  post: ThreadPost;
  /** Theme overrides for customizing appearance */
  themeOverrides?: Partial<Record<string, any>>;
  /** Style overrides for specific components */
  styleOverrides?: {
    /** Container style overrides */
    container?: StyleProp<ViewStyle>;
    /** Button style overrides */
    button?: StyleProp<ViewStyle>;
    /** Button label style overrides */
    buttonLabel?: StyleProp<TextStyle>;
  };
  /** User-provided stylesheet overrides */
  userStyleSheet?: {
    /** Container style overrides */
    container?: StyleProp<ViewStyle>;
    /** Button style overrides */
    button?: StyleProp<ViewStyle>;
    /** Button label style overrides */
    buttonLabel?: StyleProp<TextStyle>;
  };
}

/**
 * A component that displays call-to-action buttons for posts with trade or NFT content
 * 
 * @component
 * @description
 * PostCTA renders appropriate call-to-action buttons based on the post's content type.
 * For trade posts, it shows a "Copy Trade" button that opens a trade modal. For NFT
 * listing posts, it shows a "Buy NFT" button that initiates the NFT purchase process.
 * 
 * Features:
 * - Dynamic CTA based on post content
 * - Trade copying functionality
 * - NFT purchasing integration
 * - Loading states and error handling
 * - Customizable styling
 * 
 * @example
 * ```tsx
 * <PostCTA
 *   post={postData}
 *   themeOverrides={{ '--primary-color': '#1D9BF0' }}
 *   styleOverrides={{
 *     button: { backgroundColor: '#1D9BF0' },
 *     buttonLabel: { color: 'white' }
 *   }}
 * />
 * ```
 */
export default function PostCTA({
  post,
  themeOverrides,
  styleOverrides,
  userStyleSheet,
}: PostCTAProps) {
  const [loadingFloor, setLoadingFloor] = useState(false);
  const userName = useAppSelector(state => state.auth.username);

  // For NFT buying spinner
  const [nftLoading, setNftLoading] = useState(false);
  const [nftStatusMsg, setNftStatusMsg] = useState('');

  // New state for confirmation after a successful NFT buy
  const [nftConfirmationVisible, setNftConfirmationVisible] = useState(false);
  const [nftConfirmationMsg, setNftConfirmationMsg] = useState('');

  const selectedFeeTier = useSelector(
    (state: RootState) => state.transaction.selectedFeeTier,
  );

  // Use the useWallet hook instead of direct useAuth
  const { wallet, address, publicKey, sendTransaction } = useWallet();

  // Get the wallet address as a string
  const userPublicKey = address || null;

  const storedProfilePic = useAppSelector(state => state.auth.profilePicUrl);

  const currentUser: ThreadUser = {
    id: userPublicKey || 'anonymous-user',
    username: userName || 'Anonymous',
    handle: userPublicKey
      ? '@' + userPublicKey.slice(0, 6) + '...' + userPublicKey.slice(-4)
      : '@anonymous',
    verified: true,
    avatar: storedProfilePic ? { uri: storedProfilePic } : DEFAULT_IMAGES.user,
  };

  // Memoize styles (no theme needed)
  const styles = useMemo(() => createPostCTAStyles(
    styleOverrides as { [key: string]: object } | undefined,
    userStyleSheet as { [key: string]: object } | undefined,
  ), [styleOverrides, userStyleSheet]);

  // Helper to get collection data from a post
  function getCollectionData(post: ThreadPost) {
    for (const section of post.sections) {
      if (section.type === 'NFT_LISTING' && section.listingData) {
        if (section.listingData.isCollection && section.listingData.collId) {
          return {
            collId: section.listingData.collId,
            name: section.listingData.collectionName || section.listingData.name,
            image: section.listingData.image,
            description: section.listingData.collectionDescription
          };
        }
      }
    }
    return null;
  }

  // Determine section type and data
  const sectionType = getPostSectionType(post);
  const tradeData = sectionType === 'trade' ? getTradeData(post) : null;
  const collectionData = sectionType === 'collection' ? getCollectionData(post) : null;

  const navigation = useNavigation<NavigationProp>();

  /**
   * Opens the trade modal for copying a trade
   * @returns {void}
   */
  const handleOpenTradeModal = () => {
    if (!tradeData) {
      Alert.alert('Error', 'No trade data available for this post.');
      return;
    }

    // Create a more complete TokenInfo object for the input token
    const inputTokenInfo: TokenInfo = {
      address: tradeData.inputMint,
      symbol: tradeData.inputSymbol || 'SOL',
      name: tradeData.inputSymbol || 'Solana', // Use symbol as name if not provided
      decimals: 9, // Default to 9 decimals (SOL)
      logoURI: '', // Leave empty, the SwapScreen will fetch this
    };

    // Create a more complete output token object with image if available
    const outputTokenInfo = {
      address: tradeData.outputMint, // Pass the output token mint address
      symbol: tradeData.outputSymbol || 'Unknown Token', // Pass the token symbol or default
      // Include any additional details that might be available in the trade data
      mint: tradeData.outputMint, // Add explicit mint address
      logoURI: (tradeData as any).outputLogoURI || '', // Add logo URL if available using type assertion
      name: tradeData.outputSymbol || 'Unknown Token', // Add name for display purposes
    };

    console.log('[PostCTA] Copying trade with tokens:', {
      input: inputTokenInfo.symbol,
      output: outputTokenInfo.symbol,
      amount: tradeData.inputQuantity
    });

    // Navigate to the SwapScreen with the trade parameters instead of showing the modal
    navigation.navigate('SwapScreen', {
      inputToken: inputTokenInfo,
      outputToken: outputTokenInfo,
      inputAmount: tradeData.inputQuantity || '1', // Pass the original trade amount or default to 1
      shouldInitialize: true, // Flag to initialize the swap with our parameters
      showBackButton: true // 
    });
  };

  /**
   * Handles the NFT purchase process using the new wallet functionality
   * @returns {Promise<void>}
   */
  const handleBuyListedNft = async () => {
    const listingData = post.sections.find(
      s => s.type === 'NFT_LISTING',
    )?.listingData;
    if (!listingData) {
      Alert.alert('Error', 'No NFT listing data found in this post.');
      return;
    }
    if (!publicKey || !userPublicKey) {
      Alert.alert('Error', 'Wallet not connected.');
      return;
    }

    const listingPriceSol = listingData.priceSol ?? 0;
    const mint = listingData.mint;
    const owner = listingData.owner || '';

    if (!mint) {
      Alert.alert('Error', 'Invalid NFT mint address.');
      return;
    }

    try {
      setNftLoading(true);
      setNftStatusMsg('Preparing buy transaction...');

      const signature = await buyNft(
        userPublicKey,
        mint,
        listingPriceSol,
        owner,
        sendTransaction,
        status => setNftStatusMsg(status)
      );

      setNftConfirmationMsg('NFT purchased successfully!');
      setNftConfirmationVisible(true);

      // Show success notification
      TransactionService.showSuccess(signature, 'nft');
    } catch (err: any) {
      console.error('Error during buy transaction:', err);
      // Show error notification
      TransactionService.showError(err);
    } finally {
      setNftLoading(false);
      setNftStatusMsg('');
    }
  };

  /**
   * Handles buying the floor NFT from a collection
   * @returns {Promise<void>}
   */
  const handleBuyCollectionFloor = async () => {
    if (!collectionData) {
      Alert.alert('Error', 'No collection data available for this post.');
      return;
    }

    if (!publicKey || !userPublicKey) {
      Alert.alert('Error', 'Wallet not connected.');
      return;
    }

    try {
      setNftLoading(true);
      setNftStatusMsg('Fetching collection floor...');

      const signature = await buyCollectionFloor(
        userPublicKey,
        collectionData.collId,
        sendTransaction,
        status => setNftStatusMsg(status)
      );

      setNftConfirmationMsg(`Successfully purchased floor NFT from ${collectionData.name} collection!`);
      setNftConfirmationVisible(true);

      // Show success notification
      TransactionService.showSuccess(signature, 'nft');
    } catch (err: any) {
      console.error('Error during buy transaction:', err);
      TransactionService.showError(err);
    } finally {
      setNftLoading(false);
      setNftStatusMsg('');
    }
  };

  // Logic to determine CTA label, action, and disabled state
  let ctaLabel = 'Default CTA';
  let onCtaPress = () => { };
  let isDisabled = false;

  if (sectionType === 'trade') {
    ctaLabel = 'Copy Trade';
    onCtaPress = handleOpenTradeModal;
    isDisabled = !tradeData;
  } else if (sectionType === 'nft') {
    ctaLabel = 'Buy NFT';
    onCtaPress = handleBuyListedNft;
    isDisabled = nftLoading;
  } else if (sectionType === 'collection') {
    ctaLabel = loadingFloor ? 'Finding Floor...' : `Buy Floor @ ${collectionData?.name || 'Collection'}`;
    onCtaPress = handleBuyCollectionFloor;
    isDisabled = loadingFloor || !collectionData;
  }

  if (!sectionType) return null; // Return null if no relevant section type

  return (
    <View style={[styles.threadPostCTAContainer, styleOverrides?.container, userStyleSheet?.container]}>
      <TouchableOpacity
        style={[
          styles.threadPostCTAButton,
          styleOverrides?.button,
          userStyleSheet?.button,
          isDisabled && { opacity: 0.5 }
        ]}
        onPress={onCtaPress}
        disabled={isDisabled}
        activeOpacity={0.8}>
        <Text
          style={[
            styles.threadPostCTAButtonLabel,
            styleOverrides?.buttonLabel,
            userStyleSheet?.buttonLabel,
          ]}>
          {ctaLabel}
        </Text>
      </TouchableOpacity>

      {/* NFT Loading Modal */}
      <Modal
        visible={nftLoading}
        transparent
        animationType="fade"
        onRequestClose={() => { /* Prevent closing while loading */ }}>
        <View style={styles.progressOverlay}>
          <View style={styles.progressContainer}>
            <ActivityIndicator size="large" color="#1d9bf0" />
            {!!nftStatusMsg && (
              <Text style={styles.progressText}>{nftStatusMsg}</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* NFT Confirmation Modal */}
      <Modal
        visible={nftConfirmationVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNftConfirmationVisible(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmContainer}>
            <Text style={styles.confirmText}>{nftConfirmationMsg}</Text>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => setNftConfirmationVisible(false)}>
              <Text style={styles.confirmButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
