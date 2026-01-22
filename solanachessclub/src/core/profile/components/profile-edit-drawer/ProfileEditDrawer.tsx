import React, { useState, useCallback, useEffect, useRef, memo, useMemo } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TextInput,
    Image,
    TouchableWithoutFeedback,
    ActivityIndicator,
    Alert,
    ScrollView,
    ImageStyle,
    FlatList,
    InteractionManager,
    StyleSheet,
    Platform,
    KeyboardAvoidingView,
    Animated,
    PanResponder,
    Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useReduxHooks';
import {
    updateProfilePic,
    updateUsername,
    updateDescription,
    fetchUserProfile,
} from '@/shared/state/auth/reducer';
import { uploadProfileAvatar } from '@/core/profile/services/profileService';
import { styles } from './ProfileEditDrawer.styles';
import Icons from '@/assets/svgs';
import { IPFSAwareImage, getValidImageSource } from '@/shared/utils/IPFSImage';
import COLORS from '@/assets/colors';
import { NftItem } from '@/modules/nft/types';
import { fetchWithRetries } from '@/modules/data-module/utils/fetch';
import { ENDPOINTS } from '@/shared/config/constants';
import { fixImageUrl } from '@/modules/nft/utils/imageUtils';
import { TENSOR_API_KEY } from '@env';
import TYPOGRAPHY from '@/assets/typography';

interface ProfileEditDrawerProps {
    visible: boolean;
    onClose: () => void;
    profileData: {
        userId: string;
        profilePicUrl: string;
        username: string;
        description: string;
    };
    onProfileUpdated?: (field: 'image' | 'username' | 'description') => void;
}

// Drawer view states
enum DrawerView {
    PROFILE_EDIT,
    NFT_LIST,
    NFT_CONFIRM,
}

const LOG_TAG = "[ProfileEditDrawer]";

// Define fallback colors if they don't exist in COLORS
const SUCCESS_GREEN = '#27AE60';
const ERROR_RED = '#EB5757';

const { height: windowHeight } = Dimensions.get('window');

const ProfileEditDrawer = ({
    visible,
    onClose,
    profileData,
    onProfileUpdated,
}: ProfileEditDrawerProps) => {
    const dispatch = useAppDispatch();
    const isMounted = useRef(true);
    const isInitialized = useRef(false);
    const prevVisibleRef = useRef(visible);

    // Log only on actual changes to visible prop
    useEffect(() => {
        if (prevVisibleRef.current !== visible) {
            console.log('[ProfileEditDrawer] visible actually changed:', visible);
            prevVisibleRef.current = visible;
        }
    }, [visible]);

    // --- State --- 
    const [tempUsername, setTempUsername] = useState(profileData.username);
    const [tempDescription, setTempDescription] = useState(profileData.description);
    const [localImageUri, setLocalImageUri] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedSource, setSelectedSource] = useState<'library' | 'nft' | null>(null);
    const [cachedNfts, setCachedNfts] = useState<NftItem[]>([]);
    const [nftsLoading, setNftsLoading] = useState(false);
    const [nftsError, setNftsError] = useState<string | null>(null);
    const [isPreparingNfts, setIsPreparingNfts] = useState(false);
    const [selectedNft, setSelectedNft] = useState<NftItem | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentView, setCurrentView] = useState<DrawerView>(DrawerView.PROFILE_EDIT);
    const [showAvatarOptions, setShowAvatarOptions] = useState(false);
    const [showUploadProgress, setShowUploadProgress] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const progressAnim = useRef(new Animated.Value(0)).current;

    // --- Drag-to-dismiss state ---
    const drawerTranslateY = useRef(new Animated.Value(windowHeight)).current;
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => currentView === DrawerView.PROFILE_EDIT,
            onPanResponderMove: (_, { dy }) => {
                if (currentView === DrawerView.PROFILE_EDIT && dy > 0) {
                    drawerTranslateY.setValue(dy);
                }
            },
            onPanResponderRelease: (_, { dy, vy }) => {
                if (currentView === DrawerView.PROFILE_EDIT && (dy > 150 || vy > 0.5)) {
                    Animated.timing(drawerTranslateY, {
                        toValue: windowHeight,
                        duration: 200,
                        useNativeDriver: true,
                    }).start(() => {
                        onClose();
                        drawerTranslateY.setValue(windowHeight);
                    });
                } else {
                    Animated.timing(drawerTranslateY, {
                        toValue: 0,
                        duration: 100,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    useEffect(() => {
        if (visible) {
            drawerTranslateY.setValue(0);
        } else {
            drawerTranslateY.setValue(windowHeight);
        }
    }, [visible, drawerTranslateY]);

    // Memoize profileData to prevent unnecessary re-renders
    const memoizedProfileData = useMemo(() => profileData, [
        profileData.userId,
        profileData.username,
        profileData.description,
        profileData.profilePicUrl
    ]);

    // --- Effects --- 
    useEffect(() => {
        console.log('[ProfileEditDrawer] Component mounted');
        isMounted.current = true;
        return () => {
            console.log('[ProfileEditDrawer] Component unmounting');
            isMounted.current = false;
            isInitialized.current = false;
        };
    }, []);

    // Initialization effect - only runs once when drawer becomes visible
    useEffect(() => {
        if (visible && !isInitialized.current) {
            console.log('[ProfileEditDrawer] Initializing component state with profileData:', memoizedProfileData);
            // Initialize component state only once
            setTempUsername(memoizedProfileData.username);
            setTempDescription(memoizedProfileData.description);
            setLocalImageUri(null);
            setSelectedSource(null);
            setCachedNfts([]);
            setNftsLoading(false);
            setNftsError(null);
            setIsPreparingNfts(false);
            setSelectedNft(null);
            setIsProcessing(false);
            setCurrentView(DrawerView.PROFILE_EDIT);

            // Do not reset showAvatarOptions here - this is what's causing the menu to close
            // if the user has clicked on avatar options

            isInitialized.current = true;
        } else if (!visible) {
            // Reset initialization flag when drawer is closed
            isInitialized.current = false;
        }
    }, [visible, memoizedProfileData]);

    // --- Callbacks --- 

    // Fetch NFTs directly
    const fetchNFTs = useCallback(async () => {
        if (!isMounted.current) {
            return [];
        }

        setNftsLoading(true);
        setNftsError(null);

        try {
            const url = `${ENDPOINTS.tensorFlowBaseUrl}/api/v1/user/portfolio?wallet=${profileData.userId}&includeUnverified=true&includeCompressed=true&includeFavouriteCount=true`;

            const resp = await fetchWithRetries(url, {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'x-tensor-api-key': TENSOR_API_KEY,
                }
            });

            if (!resp.ok) {
                throw new Error(`Fetch NFTs failed: ${resp.status}`);
            }

            const data = await resp.json();

            if (!isMounted.current) {
                return [];
            }

            const dataArray = Array.isArray(data) ? data : [];
            const parsed = dataArray
                .map((item: any) => {
                    if (!item.setterMintMe) return null;
                    return {
                        mint: item.setterMintMe,
                        name: item.name || 'Unnamed NFT',
                        image: fixImageUrl(item.imageUri || ''),
                        collection: item.slugDisplay || '',
                        isCompressed: item.isCompressed || false
                    } as NftItem;
                })
                .filter(Boolean) as NftItem[];

            if (!isMounted.current) {
                return [];
            }

            setCachedNfts(parsed);
            setNftsError(null);
            return parsed;
        } catch (error: any) {
            if (!isMounted.current) return [];
            setNftsError('Failed to load NFTs. Please try again.');
            setCachedNfts([]);
            return [];
        } finally {
            if (isMounted.current) {
                setNftsLoading(false);
            }
        }
    }, [profileData.userId]);

    // Confirm and upload selected image (from Library or NFT Confirm view)
    const handleConfirmImageUpload = useCallback(async (imageUri?: string, source?: 'library' | 'nft') => {
        const useImageUri = imageUri || localImageUri;
        const useSource = source || selectedSource;

        if (isUploading || !useImageUri) {
            setIsProcessing(false);
            return;
        }

        if (!profileData.userId) {
            Alert.alert('Missing Data', 'No valid user to upload to');
            setIsProcessing(false);
            return;
        }

        setIsUploading(true);
        setIsProcessing(true);
        setUploadError(null);

        // Show progress bar overlay
        setShowUploadProgress(true);
        setUploadProgress(0);
        progressAnim.setValue(0);

        // Create realistic animated progress
        const animateProgress = () => {
            // Animate to 90% with a natural easing, saving the last 10% for completion
            Animated.timing(progressAnim, {
                toValue: 90,
                duration: 15000, // 15 seconds to reach 90%
                useNativeDriver: false,
            }).start();
        };

        // Start the animation
        animateProgress();
        
        // Subscribe to animated value for updating state
        const progressListener = progressAnim.addListener(({value}) => {
            setUploadProgress(value);
        });

        try {
            const newUrl = await uploadProfileAvatar(profileData.userId, useImageUri);

            // Animate to 100% quickly upon success
            Animated.timing(progressAnim, {
                toValue: 100,
                duration: 500,
                useNativeDriver: false,
            }).start();

            // Wait a moment before hiding progress
            setTimeout(() => {
                if (isMounted.current) {
                    setShowUploadProgress(false);
                    progressAnim.removeListener(progressListener);
                }
            }, 1000);

            if (!isMounted.current) {
                return;
            }

            dispatch(updateProfilePic(newUrl));
            if (onProfileUpdated) onProfileUpdated('image');

   

            setSelectedNft(null);
            setLocalImageUri(null);
            setSelectedSource(null);
            setCurrentView(DrawerView.PROFILE_EDIT);
        } catch (err: any) {
            // Handle error - stop animation and hide progress
            progressAnim.removeListener(progressListener);
            progressAnim.setValue(0);
            setUploadError(err.message || 'Failed to upload image');
            setShowUploadProgress(false);
            
            Alert.alert('Upload Error', err.message || 'Failed to upload image');
            setCurrentView(DrawerView.PROFILE_EDIT);
        } finally {
            if (isMounted.current) {
                setIsUploading(false);
                setIsProcessing(false);
            }
        }
    }, [dispatch, profileData.userId, localImageUri, selectedSource, isUploading, onProfileUpdated, setCurrentView, progressAnim]);

    // Toggle Avatar Options visibility
    const handleToggleAvatarOptions = useCallback(() => {
        console.log('[ProfileEditDrawer] handleToggleAvatarOptions called');
        console.log('[ProfileEditDrawer] isProcessing:', isProcessing, 'isUploading:', isUploading);
        console.log('[ProfileEditDrawer] Current showAvatarOptions:', showAvatarOptions);

        if (isProcessing || isUploading) {
            console.log('[ProfileEditDrawer] Skipping toggle due to processing state');
            return;
        }

        // Use a direct state update with a specific timeout to ensure we don't get caught in 
        // any re-render loops or other state updates
        setTimeout(() => {
            if (isMounted.current) {
                console.log('[ProfileEditDrawer] Forcibly showing avatar options menu');
                // Force it to true instead of toggling to prevent any race conditions
                setShowAvatarOptions(true);
            }
        }, 50);
    }, [isProcessing, isUploading]);

    // Select Image from Library
    const handleSelectImageFromLibrary = useCallback(async () => {
        if (isProcessing || isUploading || isPreparingNfts) {
            return;
        }

        setIsProcessing(true);
        setShowAvatarOptions(false);

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!isMounted.current) {
                setIsProcessing(false);
                return;
            }

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setLocalImageUri(result.assets[0].uri);
                setSelectedSource('library');

                handleConfirmImageUpload(result.assets[0].uri, 'library');
            } else {
                setIsProcessing(false);
            }
        } catch (error: any) {
            Alert.alert('Error picking image', error.message);
            setIsProcessing(false);
        }
    }, [isProcessing, isUploading, isPreparingNfts, handleConfirmImageUpload]);

    // Prepare NFT Selection
    const handlePrepareAndShowNfts = useCallback(async () => {
        if (isProcessing || isPreparingNfts || isUploading) {
            return;
        }

        setIsProcessing(true);
        setIsPreparingNfts(true);
        setShowAvatarOptions(false);

        await fetchNFTs();

        if (!isMounted.current) {
            setIsPreparingNfts(false);
            setIsProcessing(false);
            return;
        }

        setCurrentView(DrawerView.NFT_LIST);
        setIsPreparingNfts(false);
        setIsProcessing(false);
    }, [fetchNFTs, isPreparingNfts, isProcessing, isUploading, setCurrentView]);

    // Handle NFT selection from list
    const handleSelectNft = useCallback((nft: NftItem) => {
        if (isProcessing || isUploading) {
            return;
        }

        if (!nft.image) {
            Alert.alert('Invalid NFT', 'This NFT does not have a valid image.');
            return;
        }

        setSelectedNft(nft);
        setLocalImageUri(nft.image);
        setSelectedSource('nft');

        setCurrentView(DrawerView.NFT_CONFIRM);
    }, [isProcessing, isUploading, setCurrentView]);

    // Cancel NFT selection (from confirm view back to list)
    const handleCancelNftSelection = useCallback(() => {
        if (isProcessing || isUploading) {
            return;
        }

        setSelectedNft(null);
        setLocalImageUri(null);
        setSelectedSource(null);

        setCurrentView(DrawerView.NFT_LIST);
    }, [isProcessing, isUploading, setCurrentView]);

    // Cancel NFT flow entirely (from list or confirm back to profile edit)
    const handleCancelNftFlow = useCallback(() => {
        if (isProcessing || isUploading) {
            return;
        }

        setSelectedNft(null);
        setLocalImageUri(null);
        setSelectedSource(null);
        setCachedNfts([]);
        setNftsError(null);
        setNftsLoading(false);

        setCurrentView(DrawerView.PROFILE_EDIT);
    }, [isProcessing, isUploading, setCurrentView]);

    // Confirm the selected NFT (Calls handleConfirmImageUpload)
    const handleConfirmNft = useCallback(() => {
        if (isProcessing || isUploading || !selectedNft || !selectedNft.image) {
            return;
        }
        handleConfirmImageUpload(selectedNft.image, 'nft');
    }, [selectedNft, isProcessing, isUploading, handleConfirmImageUpload]);

    // Retry loading NFTs
    const handleRetryNftLoad = useCallback(() => {
        if (nftsLoading || isProcessing || isUploading) {
            return;
        }
        fetchNFTs();
    }, [fetchNFTs, nftsLoading, isProcessing, isUploading]);

    // Update profile (username, description)
    const handleUpdateProfileDetails = useCallback(async () => {
        if (!profileData.userId || isProcessing || isUploading) {
            return;
        }

        const newUsername = tempUsername.trim();
        const newDescription = tempDescription.trim();
        const usernameChanged = newUsername !== profileData.username && newUsername.length > 0;
        const descriptionChanged = newDescription !== profileData.description;

        if (!usernameChanged && !descriptionChanged) {
            Alert.alert('No Changes', 'No changes were made to your profile details.');
            onClose();
            return;
        }

        setIsProcessing(true);
        let changesMade = false;

        try {
            if (usernameChanged) {
                await dispatch(
                    updateUsername({ userId: profileData.userId, newUsername })
                ).unwrap();
                if (onProfileUpdated) onProfileUpdated('username');
                changesMade = true;
            }

            if (descriptionChanged) {
                await dispatch(
                    updateDescription({ userId: profileData.userId, newDescription })
                ).unwrap();
                if (onProfileUpdated) onProfileUpdated('description');
                changesMade = true;
            }

            if (changesMade) {
                // Alert.alert('Profile Updated', 'Your profile has been updated successfully');
                onClose();
            }
        } catch (err: any) {
            const message = err?.message || err?.toString() || 'An unknown error occurred during update.';
            Alert.alert('Update Failed', message);
        } finally {
            if (isMounted.current) {
                setIsProcessing(false);
            }
        }
    }, [
        dispatch,
        tempUsername,
        tempDescription,
        profileData.userId,
        profileData.username,
        profileData.description,
        onProfileUpdated,
        onClose,
        isProcessing,
        isUploading
    ]);

    // --- Render Helpers --- 
    const EmptyNftList = useCallback(() => (
        <View style={styles.emptyListContainer}>
            <Text style={styles.emptyListText}>
                You have no NFTs in this wallet.
            </Text>
        </View>
    ), []);

    const keyExtractor = useCallback((item: NftItem) =>
        item.mint || `nft-${Math.random().toString(36).substring(2, 9)}`,
        []);

    const renderNftItem = useCallback(({ item }: { item: NftItem }) => (
        <TouchableOpacity
            style={styles.nftListItem}
            onPress={() => handleSelectNft(item)}
            disabled={isProcessing || isUploading}
            activeOpacity={0.7}>

            <View style={styles.nftListImageContainer}>
                {item.image ? (
                    <Image
                        source={{ uri: item.image }}
                        style={styles.nftListImage}
                        defaultSource={require('@/assets/images/User.png')}
                        onError={(e) => console.warn(`${LOG_TAG} Failed to load NFT image ${item.mint}: ${e.nativeEvent.error}`)}
                    />
                ) : (
                    <View style={styles.nftListPlaceholder}>
                        <Text style={styles.nftListPlaceholderText}>No Image</Text>
                    </View>
                )}
            </View>

            <View style={styles.nftListInfo}>
                <Text style={styles.nftListName} numberOfLines={1}>{item.name || 'Unnamed NFT'}</Text>
                {item.collection ? (
                    <Text style={styles.nftListCollection} numberOfLines={1}>{item.collection}</Text>
                ) : null}
                {item.mint && (
                    <Text style={styles.nftListMint} numberOfLines={1}>
                        {item.mint.slice(0, 6)}...{item.mint.slice(-4)}
                    </Text>
                )}
            </View>

            <View style={styles.nftListSelectIconContainer}>
                <Text style={styles.nftListSelectIcon}>⟩</Text>
            </View>
        </TouchableOpacity>
    ), [handleSelectNft, isProcessing, isUploading]);

    // Add isChanged() function to check if any profile data has changed
    const isChanged = useCallback(() => {
        return (
            tempUsername.trim() !== profileData.username ||
            tempDescription.trim() !== profileData.description
        );
    }, [tempUsername, tempDescription, profileData.username, profileData.description]);

    // Render content based on currentView state
    const renderContent = () => {
        switch (currentView) {
            case DrawerView.NFT_LIST:
                return (
                    <View style={styles.nftListContainer}>
                        <View style={styles.viewHeader}>
                            <TouchableOpacity
                                style={styles.viewHeaderButton}
                                onPress={handleCancelNftFlow}
                                disabled={isProcessing || isUploading || nftsLoading}>
                                <Text style={styles.viewHeaderButtonText}>{'←'}</Text>
                            </TouchableOpacity>
                            <Text style={styles.viewHeaderTitle}>Choose an NFT</Text>
                            <View style={styles.viewHeaderButton} />
                        </View>

                        <View style={styles.nftInstructionsContainer}>
                            <Text style={styles.nftInstructionsText}>
                                Select an NFT from your collection to use as your profile picture
                            </Text>
                        </View>

                        {nftsLoading ? (
                            <View style={styles.centeredMessageContainer}>
                                <ActivityIndicator size="large" color={COLORS.brandPrimary} />
                                <Text style={styles.loadingText}>Loading your NFTs...</Text>
                            </View>
                        ) : nftsError ? (
                            <View style={styles.centeredMessageContainer}>
                                <Text style={styles.errorText}>{nftsError}</Text>
                                <TouchableOpacity
                                    style={styles.retryButton}
                                    onPress={handleRetryNftLoad}
                                    disabled={nftsLoading || isProcessing || isUploading}
                                    activeOpacity={0.7}>
                                    <Text style={styles.retryButtonText}>Retry</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <>
                                {cachedNfts.length > 0 ? (
                                    <FlatList
                                        data={cachedNfts}
                                        keyExtractor={keyExtractor}
                                        renderItem={renderNftItem}
                                        style={styles.flatListStyle}
                                        ListEmptyComponent={EmptyNftList}
                                        contentContainerStyle={styles.flatListContentContainer}
                                        initialNumToRender={10}
                                        maxToRenderPerBatch={10}
                                        windowSize={11}
                                        removeClippedSubviews={true}
                                        showsVerticalScrollIndicator={false}
                                    />
                                ) : (
                                    <EmptyNftList />
                                )}
                            </>
                        )}
                    </View>
                );

            case DrawerView.NFT_CONFIRM:
                return (
                    <View style={styles.nftConfirmContainer}>
                        <View style={styles.viewHeader}>
                            <TouchableOpacity
                                style={styles.viewHeaderButton}
                                onPress={handleCancelNftSelection}
                                disabled={isProcessing || isUploading}>
                                <Text style={styles.viewHeaderButtonText}>{'←'}</Text>
                            </TouchableOpacity>
                            <Text style={styles.viewHeaderTitle}>Confirm Selection</Text>
                            <View style={styles.viewHeaderButton} />
                        </View>

                        {selectedNft && selectedNft.image ? (
                            <View style={styles.nftConfirmContent}>
                                <View style={styles.nftConfirmImageContainer}>
                                    <Image
                                        source={{ uri: selectedNft.image }}
                                        style={styles.nftConfirmImage}
                                        defaultSource={require('@/assets/images/User.png')}
                                        onError={() => {
                                            Alert.alert('Image Load Error', 'Failed to load the selected NFT image');
                                        }}
                                    />
                                </View>
                                <Text style={styles.nftConfirmName}>{selectedNft.name}</Text>
                                {selectedNft.collection && (
                                    <Text style={styles.nftConfirmCollection}>{selectedNft.collection}</Text>
                                )}

                                <Text style={styles.nftConfirmInstructions}>
                                    This NFT will be used as your profile picture
                                </Text>
                            </View>
                        ) : (
                            <Text style={styles.centeredMessageText}>No NFT selected or image missing</Text>
                        )}

                        <View style={styles.nftConfirmActions}>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.cancelButton]}
                                onPress={handleCancelNftSelection}
                                disabled={isProcessing || isUploading}
                                activeOpacity={0.7}>
                                <Text style={styles.actionButtonText}>Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.confirmButton]}
                                onPress={handleConfirmNft}
                                disabled={isProcessing || isUploading || !selectedNft?.image}
                                activeOpacity={0.7}>
                                {isUploading ? (
                                    <ActivityIndicator size="small" color={COLORS.white} />
                                ) : (
                                    <Text style={styles.actionButtonText}>Use as Profile</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                );

            case DrawerView.PROFILE_EDIT:
            default:
                return (
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={styles.keyboardAvoidingContainer}
                        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
                    >
                        <ScrollView
                            style={styles.scrollContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.scrollContentContainer}
                        >
                            <View style={styles.imageSection}>
                                <TouchableOpacity
                                    onPress={(event) => {
                                        console.log('[ProfileEditDrawer] Image container pressed');
                                        // Prevent event from reaching overlay
                                        event.stopPropagation?.();
                                        handleToggleAvatarOptions();
                                    }}
                                    style={styles.imageContainer}
                                    activeOpacity={0.8}
                                    disabled={isProcessing || isUploading}>
                                    <IPFSAwareImage
                                        style={styles.profileImage as ImageStyle}
                                        source={
                                            localImageUri
                                                ? { uri: localImageUri }
                                                : profileData.profilePicUrl
                                                    ? getValidImageSource(profileData.profilePicUrl)
                                                    : require('@/assets/images/User.png')
                                        }
                                        defaultSource={require('@/assets/images/User.png')}
                                    />

                                    <View style={styles.profileImageOverlay}>
                                        <View style={styles.profileImageEditIconContainer}>
                                            <Icons.EditIcon width={20} height={20} color={COLORS.white} />
                                        </View>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={(event) => {
                                        console.log('[ProfileEditDrawer] Edit picture button pressed');
                                        // Prevent event from reaching overlay
                                        event.stopPropagation?.();
                                        handleToggleAvatarOptions();
                                    }}
                                    activeOpacity={0.7}
                                    disabled={isProcessing || isUploading}
                                    style={styles.editPictureButton}>
                                    <Text style={styles.editPictureText}>Edit picture</Text>
                                </TouchableOpacity>

                                {showAvatarOptions && (
                                    <View
                                        style={{
                                            borderRadius: 16,
                                            padding: 12,
                                            flexDirection: 'row',
                                            justifyContent: 'space-around',
                                            alignItems: 'center',
                                            backgroundColor: 'rgba(0, 0, 0, 0.2)',
                                            marginHorizontal: 16,
                                        }}
                                    >
                                        <TouchableOpacity
                                            style={[styles.avatarOptionButton, styles.avatarOptionButtonWithMargin]}
                                            onPress={(e) => {
                                                console.log('[ProfileEditDrawer] Library button pressed');
                                                e.stopPropagation();
                                                handleSelectImageFromLibrary();
                                            }}
                                            disabled={isProcessing || isUploading || isPreparingNfts}
                                            activeOpacity={0.7}>
                                            <Icons.GalleryIcon width={20} height={20} color={COLORS.white} style={{ marginRight: 8 }} />
                                            <Text style={styles.avatarOptionText}>Library</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.avatarOptionButton}
                                            onPress={(e) => {
                                                console.log('[ProfileEditDrawer] NFT button pressed');
                                                e.stopPropagation();
                                                handlePrepareAndShowNfts();
                                            }}
                                            disabled={isProcessing || isUploading || isPreparingNfts}
                                            activeOpacity={0.7}>
                                            {isPreparingNfts ? (
                                                <ActivityIndicator size="small" color={COLORS.white} style={styles.activityIndicatorMargin} />
                                            ) : (
                                                <Icons.NftIcon width={20} height={20} color={COLORS.white} style={{ marginRight: 8 }} />
                                            )}
                                            <Text style={styles.avatarOptionText}>My NFTs</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            <View style={styles.inputSection}>
                                <View style={styles.inputLabelContainer}>
                                    <Text style={styles.inputLabel}>Display name</Text>
                                    <Text style={styles.characterCount}>{tempUsername.length}/50</Text>
                                </View>
                                <TextInput
                                    style={[
                                        styles.textInput,
                                        tempUsername.length >= 50 && styles.textInputAtLimit
                                    ]}
                                    value={tempUsername}
                                    onChangeText={setTempUsername}
                                    placeholder="Enter your display name"
                                    placeholderTextColor={COLORS.greyMid}
                                    maxLength={50}
                                    editable={!isProcessing && !isUploading}
                                />
                                <Text style={styles.inputHelperText}>This is the name that will be displayed to others</Text>
                            </View>

                            <View style={styles.inputSection}>
                                <Text style={styles.inputLabel}>Wallet address</Text>
                                <TextInput
                                    style={[styles.textInput, styles.disabledInput]}
                                    value={`@${profileData.userId.substring(0, 6)}...${profileData.userId.slice(-4)}`}
                                    editable={false}
                                />
                                <Text style={styles.inputHelperText}>Your wallet address cannot be changed</Text>
                            </View>

                            <View style={styles.inputSection}>
                                <View style={styles.inputLabelContainer}>
                                    <Text style={styles.inputLabel}>Bio</Text>
                                    <Text style={[
                                        styles.characterCount,
                                        tempDescription.length > 150 && styles.characterCountWarning
                                    ]}>
                                        {tempDescription.length}/160
                                    </Text>
                                </View>
                                <TextInput
                                    style={[
                                        styles.textInput,
                                        styles.bioInput,
                                        tempDescription.length >= 160 && styles.textInputAtLimit
                                    ]}
                                    value={tempDescription}
                                    onChangeText={setTempDescription}
                                    placeholder="Write a short bio about yourself"
                                    placeholderTextColor={COLORS.greyMid}
                                    multiline
                                    maxLength={160}
                                    editable={!isProcessing && !isUploading}
                                />
                                <Text style={styles.inputHelperText}>Tell others about yourself in a few words</Text>
                            </View>
                            <View style={styles.bottomSpacerView} />
                        </ScrollView>
                    </KeyboardAvoidingView>
                );
        }
    };

    // --- Main Render ---
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={() => {
                if (isProcessing || isUploading) return;
                if (currentView === DrawerView.NFT_LIST) {
                    handleCancelNftFlow();
                } else if (currentView === DrawerView.NFT_CONFIRM) {
                    handleCancelNftSelection();
                } else {
                    onClose();
                }
            }}
        >
            <TouchableWithoutFeedback onPress={(event) => {
                console.log('[ProfileEditDrawer] Overlay pressed');
                if (isProcessing || isUploading) {
                    console.log('[ProfileEditDrawer] Ignoring overlay press due to processing state');
                    return;
                }

                // Prevent event bubbling
                event.stopPropagation?.();
                console.log('[ProfileEditDrawer] After stopPropagation');

                // If avatar options are shown, just hide them instead of closing the drawer
                if (showAvatarOptions) {
                    console.log('[ProfileEditDrawer] Hiding avatar options instead of closing drawer');
                    setShowAvatarOptions(false);
                    return;
                }

                console.log('[ProfileEditDrawer] Closing drawer');
                onClose();
            }}>
                <View style={styles.overlay} />
            </TouchableWithoutFeedback>

            <Animated.View
                style={[
                    styles.drawerContainer,
                    currentView === DrawerView.PROFILE_EDIT && { transform: [{ translateY: drawerTranslateY }] },
                ]}
            >
                {/* Drag handle only in PROFILE_EDIT view */}
                {currentView === DrawerView.PROFILE_EDIT && (
                    <View
                        style={{
                            width: 40,
                            height: 5,
                            borderRadius: 2.5,
                            backgroundColor: COLORS.borderDarkColor,
                            alignSelf: 'center',
                            marginTop: 10,
                            marginBottom: 10,
                            opacity: 0.7,
                        }}
                        {...panResponder.panHandlers}
                    />
                )}
                {currentView === DrawerView.PROFILE_EDIT && (
                    <View style={styles.headerContainer}>
                        <TouchableOpacity
                            onPress={(e) => {
                                e.stopPropagation?.();
                                onClose();
                            }}
                            style={styles.backButton}
                            disabled={isProcessing || isUploading}>
                            <Text style={styles.backButtonText}>✕</Text>
                        </TouchableOpacity>

                        <Text style={styles.headerTitle}>Edit Profile</Text>

                        <TouchableOpacity
                            style={[
                                styles.saveButton,
                                (isChanged()) ? styles.saveButtonActive : styles.saveButtonInactive
                            ]}
                            onPress={handleUpdateProfileDetails}
                            disabled={isProcessing || isUploading || !isChanged()}>
                            <Text style={[
                                styles.saveButtonText,
                                (isChanged()) ? styles.saveButtonTextActive : styles.saveButtonTextInactive
                            ]}>
                                {isProcessing ? 'Saving...' : 'Save'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
                {currentView !== DrawerView.PROFILE_EDIT && (
                    // NFT_LIST and NFT_CONFIRM keep their header as before
                    null
                )}
                {renderContent()}
                {showUploadProgress && (
                    <View style={styles.uploadProgressOverlay}>
                        <View style={styles.uploadProgressContainer}>
                            <View style={styles.uploadProgressHeader}>
                                <Text style={styles.uploadProgressTitle}>Uploading Image</Text>
                                {uploadProgress < 100 && (
                                    <Text style={styles.uploadProgressPercentage}>
                                        {Math.round(uploadProgress)}%
                                    </Text>
                                )}
                            </View>
                            
                            <View style={styles.uploadProgressBarContainer}>
                                <Animated.View
                                    style={[
                                        styles.uploadProgressBar,
                                        { width: progressAnim.interpolate({
                                            inputRange: [0, 100],
                                            outputRange: ['0%', '100%']
                                          })
                                        }
                                    ]}
                                />
                                <View style={styles.uploadProgressBarShine} />
                            </View>
                            
                            {uploadProgress >= 100 ? (
                                <View style={styles.uploadSuccessContainer}>
                                    <Text style={{color: SUCCESS_GREEN, fontSize: 20}}>✓</Text>
                                    <Text style={styles.uploadSuccessText}>Upload complete!</Text>
                                </View>
                            ) : uploadError ? (
                                <View style={styles.uploadErrorContainer}>
                                    <Text style={{color: ERROR_RED, fontSize: 20}}>✗</Text>
                                    <Text style={styles.uploadErrorText}>{uploadError}</Text>
                                </View>
                            ) : (
                                <Text style={styles.uploadProgressText}>
                                    Please wait while we upload your image...
                                </Text>
                            )}
                        </View>
                    </View>
                )}
            </Animated.View>
        </Modal>
    );
};

// Ensure the component is properly memoized with a custom comparison function
const MemoizedProfileEditDrawer = memo(ProfileEditDrawer, (prevProps, nextProps) => {
    // Only re-render if these props actually change
    return (
        prevProps.visible === nextProps.visible &&
        prevProps.profileData.userId === nextProps.profileData.userId &&
        prevProps.profileData.profilePicUrl === nextProps.profileData.profilePicUrl &&
        prevProps.profileData.username === nextProps.profileData.username &&
        prevProps.profileData.description === nextProps.profileData.description
    );
});

export default MemoizedProfileEditDrawer; 