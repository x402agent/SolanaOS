import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    FlatList,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    TextInput,
    Dimensions,
    Alert,
    Pressable,
    Animated,
} from 'react-native';
import Icons from '../../../assets/svgs';
import { TENSOR_API_KEY } from '@env';
import { DEFAULT_IMAGES } from '../../../config/constants';
import { useWallet } from '../../wallet-providers/hooks/useWallet';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useReduxHooks';
import { createRootPostAsync, addPostLocally } from '@/shared/state/thread/reducer';
import { ThreadSection, ThreadSectionType, ThreadUser } from '@/core/thread/components/thread.types';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { TransactionService } from '../../wallet-providers/services/transaction/transactionService';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

// Import types from our module
import { NftItem, NftListingModalProps, CollectionResult, NftListingData } from '../types';

// Import services and utils
import { searchCollections } from '../services/nftService';
import { fixImageUrl } from '../utils/imageUtils';

// Constants
const { width, height } = Dimensions.get('window');
const ITEM_WIDTH = (width * 0.9 - 30) / 3; // Added more padding
const SOL_TO_LAMPORTS = 1_000_000_000;
const DRAWER_HEIGHT = height * 0.8; // Drawer takes up 80% of screen height

// Update Props Interface
interface UpdatedNftListingModalProps extends Omit<NftListingModalProps, 'onSelectListing'> {
    // Rename onSelectListing to a more generic onShare callback
    onShare: (data: NftListingData) => void;
}

/**
 * Drawer for displaying NFT listings and allowing users to select NFTs
 */
const NftListingModal = ({
    visible,
    onClose,
    onShare, // Use the new onShare prop
    listingItems,
    loadingListings,
    fetchNftsError,
    styles,
}: UpdatedNftListingModalProps) => { // Use updated props type
    // Animation for drawer slide up
    const slideAnim = useRef(new Animated.Value(DRAWER_HEIGHT)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Use the wallet hook instead of directly using useAuth
    const { wallet, address, publicKey, sendTransaction } = useWallet();
    const userPublicKey = address || null;
    const dispatch = useAppDispatch();

    // Default to option 2 so that the current content shows up by default.
    const [selectedOption, setSelectedOption] = useState<number>(2);

    // Search functionality state
    const [collectionName, setCollectionName] = useState('');
    const [searchResults, setSearchResults] = useState<CollectionResult[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [isSendingTransaction, setIsSendingTransaction] = useState(false);

    // Share NFT state
    const [selectedCollection, setSelectedCollection] = useState<CollectionResult | null>(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const storedProfilePic = useAppSelector(state => state.auth.profilePicUrl);
    const userName = useAppSelector(state => state.auth.username);

    // Use provided styles or fallback to default styles
    const modalStyles = defaultStyles;

    // Handle slide in animation when visible changes
    useEffect(() => {
        if (visible) {
            // Slide up animation
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start();

            // Fade in animation for the overlay
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            // Reset the animation value when modal is hidden
            slideAnim.setValue(DRAWER_HEIGHT);
            fadeAnim.setValue(0);
        }
    }, [visible, slideAnim, fadeAnim]);

    // Handle closing the drawer with animation
    const handleClose = () => {
        // Slide down animation
        Animated.timing(slideAnim, {
            toValue: DRAWER_HEIGHT,
            duration: 250,
            useNativeDriver: true,
        }).start();

        // Fade out animation for the overlay
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
        }).start(() => {
            // Call the onClose prop after animation completes
            onClose();
        });
    };

    // Search collections functionality
    const handleSearchCollections = async () => {
        if (!collectionName.trim()) return;
        setLoadingSearch(true);
        setSearchResults([]);

        try {
            const results = await searchCollections(collectionName.trim());
            setSearchResults(results);
        } catch (err: any) {
            console.error('Error searching collections:', err);
            setSearchResults([]);
        } finally {
            setLoadingSearch(false);
        }
    };

    // Function to send a transaction for NFT operations (example)
    const handleNftTransaction = async (nftItem: NftItem) => {
        if (!publicKey) {
            Alert.alert('Error', 'Wallet not connected');
            return;
        }

        try {
            setIsSendingTransaction(true);

            // Example transaction - this would be replaced with actual NFT transaction logic
            // For example: transferring NFT, listing NFT for sale, etc.
            const connection = new Connection('https://api.mainnet-beta.solana.com');
            const transaction = new Transaction();

            // Here you would add the appropriate instructions for NFT operations
            // For example:
            // transaction.add(
            //   createTransferInstruction(
            //     new PublicKey(nftItem.mint),
            //     publicKey,
            //     new PublicKey(recipientAddress),
            //     publicKey,
            //     1
            //   )
            // );

            // Using the new wallet transaction method
            const signature = await sendTransaction(
                transaction,
                connection,
                {
                    confirmTransaction: true,
                    statusCallback: (status) => {
                        // Filter out error messages from status updates
                        if (!status.startsWith('Error:') && !status.includes('failed')) {
                            console.log(`Transaction status: ${status}`);
                        } else {
                            console.log(`Transaction processing...`);
                        }
                    }
                }
            );

            console.log('Transaction sent with signature:', signature);
            TransactionService.showSuccess(signature, 'nft');

        } catch (error: any) {
            console.error('Error sending transaction:', error);
            TransactionService.showError(error);
        } finally {
            setIsSendingTransaction(false);
        }
    };

    // Share NFT collection to feed
    const shareNftCollection = async (collection: CollectionResult) => {
        if (!userPublicKey) {
            Alert.alert('Error', 'Cannot share: Wallet not connected');
            return;
        }

        // Create the NFT listing data structure for a collection
        const listingData: NftListingData = {
            collId: collection.collId,
            owner: userPublicKey,
            name: collection.name,
            image: fixImageUrl(collection.imageUri),
            isCollection: true,
            collectionName: collection.name,
            collectionImage: fixImageUrl(collection.imageUri),
            collectionDescription: collection.description,
        };

        // Call the generic onShare callback
        onShare(listingData);

        // Close modals
        setShowShareModal(false);
        setSelectedCollection(null);
        handleClose(); // Close the main modal too
    };

    // Render a grid item (just the image)
    const renderGridItem = ({ item }: { item: CollectionResult }) => {
        return (
            <TouchableOpacity
                style={modalStyles.gridItem}
                onPress={() => {
                    console.log('Collection selected for sharing:', item);
                    // Call onShare directly for collections now
                    shareNftCollection(item);
                }}
            >
                <Image
                    source={{ uri: fixImageUrl(item.imageUri) }}
                    style={modalStyles.gridImage}
                    resizeMode="cover"
                />
            </TouchableOpacity>
        );
    };

    // Modified render for NFT listing items to include transaction option
    const renderNftItem = ({ item }: { item: NftItem }) => (
        <TouchableOpacity
            style={modalStyles.listingCard}
            onPress={() => {
                const listingData: NftListingData = {
                    mint: item.mint,
                    owner: address || '', // Current user is the one listing/sharing
                    priceSol: item.priceSol, // Use price if available
                    name: item.name,
                    image: item.image,
                    collectionName: item.collection,
                    isCompressed: item.isCompressed,
                    isCollection: false, // This is a single NFT, not a collection
                };
                onShare(listingData);
                handleClose(); // Close modal after selection
            }}
        >
            {/* Add a container with relative positioning to hold the image and badge */}
            <View style={modalStyles.imageContainer}>
                <Image
                    source={{ uri: item.image }}
                    style={modalStyles.listingImage}
                />
                {/* Add the compressed NFT badge if applicable */}
                {item.isCompressed && (
                    <View style={modalStyles.compressedBadge}>
                        <Text style={modalStyles.compressedBadgeText}>
                            cNFT
                        </Text>
                    </View>
                )}
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
                <Text
                    style={modalStyles.listingName}
                    numberOfLines={1}>
                    {item.name}
                </Text>
            </View>

            {/* Transaction button for NFT operations */}
            <TouchableOpacity
                style={modalStyles.actionButton}
                onPress={() => handleNftTransaction(item)}
                disabled={isSendingTransaction}>
                {isSendingTransaction ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                    <Text style={modalStyles.actionButtonText}>Transfer</Text>
                )}
            </TouchableOpacity>
        </TouchableOpacity>
    );

    return (
        <Modal
            animationType="none"
            transparent={true}
            visible={visible}
            onRequestClose={handleClose}>
            <View style={modalStyles.container}>
                {/* Backdrop/overlay with fade animation */}
                <Animated.View
                    style={[
                        modalStyles.backdrop,
                        { opacity: fadeAnim }
                    ]}
                >
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        activeOpacity={1}
                        onPress={handleClose}
                    />
                </Animated.View>

                {/* Drawer that slides up from bottom */}
                <Animated.View
                    style={[
                        modalStyles.drawerContainer,
                        { transform: [{ translateY: slideAnim }] }
                    ]}>
                    {/* Drawer handle at top */}
                    <View style={modalStyles.handleContainer}>
                        <View style={modalStyles.handle} />
                    </View>

                    {/* Content area */}
                    <View style={modalStyles.contentContainer}>
                        {selectedOption === 2 ? (
                            // Updated header for NFT Listing view with cross button
                            <View style={modalStyles.listingHeader}>
                                <Text style={modalStyles.modalTitle}>NFT Listing</Text>
                                <TouchableOpacity
                                    onPress={handleClose}
                                    style={modalStyles.listingCloseButton}>
                                    <Icons.cross width={24} height={24} color={COLORS.white} />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            // Complex header for tensor with cross, search bar, and arrow
                            <View style={modalStyles.tensorHeader}>
                                <TouchableOpacity onPress={handleClose} style={modalStyles.headerButton}>
                                    <Icons.cross width={24} height={24} color={COLORS.white} />
                                </TouchableOpacity>

                                <View style={modalStyles.searchContainer}>
                                    <TextInput
                                        style={modalStyles.searchInput}
                                        placeholder="Search collections..."
                                        placeholderTextColor={COLORS.greyMid}
                                        value={collectionName}
                                        onChangeText={setCollectionName}
                                        onSubmitEditing={handleSearchCollections}
                                    />
                                </View>

                                <TouchableOpacity
                                    style={modalStyles.headerButton}
                                    onPress={handleSearchCollections}>
                                    <Icons.arrowRIght width={20} height={20} color={COLORS.white} />
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={modalStyles.scrollContentContainer}>
                            {selectedOption === 2 ? (
                                <>
                                    {loadingListings ? (
                                        <ActivityIndicator
                                            size="large"
                                            color={COLORS.brandBlue}
                                            style={{ marginTop: 20 }}
                                        />
                                    ) : fetchNftsError ? (
                                        <Text style={modalStyles.errorText}>
                                            {fetchNftsError}
                                        </Text>
                                    ) : listingItems?.length === 0 ? (
                                        <Text style={modalStyles.emptyText}>
                                            No NFTs found.
                                        </Text>
                                    ) : (
                                        <>
                                            <FlatList
                                                data={listingItems}
                                                keyExtractor={item => item.mint}
                                                renderItem={renderNftItem}
                                                style={{ width: '100%' }}
                                            />
                                            <Text style={modalStyles.disclaimerText}>
                                                Note: Only NFTs with a valid mint ID are displayed.
                                            </Text>
                                        </>
                                    )}
                                </>
                            ) : (
                                // Tensor Search Results - maintain fixed height with contentContainer
                                <View style={modalStyles.tensorContent}>
                                    {loadingSearch ? (
                                        <View style={modalStyles.loaderContainer}>
                                            <ActivityIndicator size="small" color={COLORS.brandBlue} />
                                            <Text style={modalStyles.loaderText}>Searching collections...</Text>
                                        </View>
                                    ) : searchResults.length > 0 ? (
                                        <FlatList
                                            data={searchResults}
                                            keyExtractor={item => item.collId}
                                            renderItem={renderGridItem}
                                            numColumns={3}
                                            columnWrapperStyle={modalStyles.gridRow}
                                        />
                                    ) : (
                                        <View style={modalStyles.emptyResultsContainer}>
                                            <Text style={modalStyles.emptyText}>
                                                {collectionName.trim()
                                                    ? 'No collections found. Try a different search.'
                                                    : 'Search for collections above to see results here.'}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Fixed footer with two options */}
                    <View style={modalStyles.footer}>
                        <TouchableOpacity
                            style={[
                                modalStyles.optionButton,
                                selectedOption === 1 && modalStyles.selectedOption
                            ]}
                            onPress={() => setSelectedOption(1)}>
                            <Icons.tensor
                                width={26}
                                height={26}
                                color={selectedOption === 1 ? COLORS.white : COLORS.greyMid}
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                modalStyles.optionButton,
                                selectedOption === 2 && modalStyles.selectedOption
                            ]}
                            onPress={() => setSelectedOption(2)}>
                            <Icons.listedNft
                                width={26}
                                height={26}
                                color={selectedOption === 2 ? COLORS.white : COLORS.greyMid}
                            />
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const defaultStyles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end', // Align to bottom for drawer effect
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    drawerContainer: {
        backgroundColor: COLORS.background,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: DRAWER_HEIGHT,
        width: '100%',
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
        borderBottomWidth: 0,
        position: 'relative',
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    handle: {
        width: 40,
        height: 5,
        borderRadius: 3,
        backgroundColor: COLORS.greyMid,
    },
    contentContainer: {
        flex: 1,
        padding: 10,
        paddingBottom: 70, // Add padding to accommodate the fixed footer
    },
    scrollContentContainer: {
        flex: 1,
        width: '100%',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
        paddingVertical: 15,
        borderTopWidth: 1,
        borderTopColor: COLORS.borderDarkColor,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.background,
    },
    modalTitle: {
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
        color: COLORS.white,
        margin: 10,
        fontFamily: TYPOGRAPHY.fontFamily,
    },
    // Error and empty state text
    errorText: {
        marginTop: 16,
        color: COLORS.greyMid,
        textAlign: 'center',
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily,
    },
    emptyText: {
        marginTop: 16,
        color: COLORS.greyMid,
        textAlign: 'center',
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily,
    },
    // Added new styling for the NFT listing header with close button
    listingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderDarkColor,
    },
    listingCloseButton: {
        padding: 8,
    },
    listingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderDarkColor,
        width: '100%',
        backgroundColor: COLORS.lightBackground,
    },
    listingImage: {
        width: 50,
        height: 50,
        borderRadius: 5,
    },
    listingName: {
        fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily,
    },
    // Tensor content area with fixed height
    tensorContent: {
        width: '100%',
        flex: 1,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderText: {
        marginTop: 10,
        color: COLORS.greyMid,
        fontFamily: TYPOGRAPHY.fontFamily,
        fontSize: TYPOGRAPHY.size.sm,
    },
    emptyResultsContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    // Grid styles for search results
    gridRow: {
        justifyContent: 'space-between',
        width: '100%',
        padding: 2,
    },
    imageContainer: {
        position: 'relative', // To position the badge absolutely within
    },
    compressedBadge: {
        position: 'absolute',
        top: 2,
        left: 2,
        backgroundColor: COLORS.brandPink,
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
    },
    compressedBadgeText: {
        color: COLORS.white,
        fontSize: 8,
        fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
        fontFamily: TYPOGRAPHY.fontFamily,
    },
    disclaimerText: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyMid,
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 5,
        paddingHorizontal: 15,
        fontStyle: 'italic',
        fontFamily: TYPOGRAPHY.fontFamily,
    },
    gridItem: {
        width: ITEM_WIDTH,
        height: ITEM_WIDTH,
        margin: 1,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: COLORS.lighterBackground,
    },
    gridImage: {
        width: '100%',
        height: '100%',
    },
    optionButton: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        borderRadius: 8,
        marginHorizontal: 20, // Add horizontal margin between icons
    },
    selectedOption: {
        backgroundColor: COLORS.lighterBackground,
    },
    tensorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingVertical: 10,
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderDarkColor,
    },
    headerButton: {
        padding: 8,
    },
    searchContainer: {
        flex: 1,
        marginHorizontal: 10,
    },
    searchInput: {
        backgroundColor: COLORS.lighterBackground,
        borderRadius: 14,
        paddingHorizontal: 15,
        paddingVertical: 8,
        fontSize: TYPOGRAPHY.size.sm,
        fontFamily: TYPOGRAPHY.fontFamily,
        color: COLORS.white,
    },
    // Add styles for the new action button
    actionButton: {
        backgroundColor: COLORS.brandPrimary,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        marginLeft: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionButtonText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.xs,
        fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
        fontFamily: TYPOGRAPHY.fontFamily,
    },
});

export default NftListingModal;
