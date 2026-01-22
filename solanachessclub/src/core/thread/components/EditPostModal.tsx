import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    Modal,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Image,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Dimensions,
    Animated,
    Easing,
    PanResponder
} from 'react-native';
import { ThreadPost, ThreadSection } from './thread.types';
import { useAppDispatch } from '@/shared/hooks/useReduxHooks';
import { updatePostAsync } from '@/shared/state/thread/reducer';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import Icons from '@/assets/svgs';
import { IPFSAwareImage, getValidImageSource } from '@/shared/utils/IPFSImage';
import { DEFAULT_IMAGES } from '@/shared/config/constants';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface EditPostModalProps {
    isVisible: boolean;
    onClose: () => void;
    post: ThreadPost | null; // Allow null for conditional rendering
}

const EditPostModal = ({ isVisible, onClose, post }: EditPostModalProps) => {
    const dispatch = useAppDispatch();
    const [sections, setSections] = useState<ThreadSection[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Animation values
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;

    // Pan responder for swipe down to dismiss
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return gestureState.dy > 10;
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    translateY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 100 || gestureState.vy > 0.5) {
                    // User swiped down with enough velocity or distance
                    hideModal();
                } else {
                    // Reset position
                    Animated.spring(translateY, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 100,
                        friction: 8
                    }).start();
                }
            }
        })
    ).current;

    // Show/hide animations
    const showModal = () => {
        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 1,
                duration: 300,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true
            }),
            Animated.spring(translateY, {
                toValue: 0,
                tension: 90,
                friction: 13,
                useNativeDriver: true
            })
        ]).start();
    };

    const hideModal = () => {
        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true
            }),
            Animated.timing(translateY, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true
            })
        ]).start(() => {
            if (!isLoading) {
                onClose();
            }
        });
    };

    // Initialize sections from post when modal opens or post changes
    useEffect(() => {
        if (isVisible && post && post.sections) {
            // Deep copy to avoid mutating the original post
            setSections([...post.sections]);
            setError(null); // Clear previous errors
            showModal(); // Animate in
        } else if (!isVisible) {
            // Reset state when modal closes
            translateY.setValue(SCREEN_HEIGHT);
            backdropOpacity.setValue(0);
            setSections([]);
            setError(null);
        }
    }, [isVisible, post]);

    // Close modal when back button is pressed
    const handleBackPress = () => {
        if (!isLoading) {
            hideModal();
        }
        return true;
    };

    // Bail out early if no post is provided
    if (!post) {
        return null;
    }

    // Update section text 
    const updateSectionText = (uniqueIndex: number, text: string) => {
        const uniqueEditableSections = getUniqueEditableSections();
        if (uniqueIndex >= uniqueEditableSections.length) return;

        const sectionToUpdateInfo = uniqueEditableSections[uniqueIndex];
        const { type: sectionType, id: sectionId } = sectionToUpdateInfo;

        setSections(prevSections => {
            // Create a new array based on previous state
            return prevSections.map(section => {
                // For TEXT_IMAGE, update all sections of this type (usually just one)
                if (section.type === 'TEXT_IMAGE' && sectionType === 'TEXT_IMAGE') {
                    return { ...section, text };
                }
                // For other special types, update all of the same type (again, usually one)
                else if ((section.type === 'TEXT_VIDEO' || section.type === 'TEXT_TRADE') && section.type === sectionType) {
                    return { ...section, text };
                }
                // For TEXT_ONLY, only update the exact section by ID
                else if (section.type === 'TEXT_ONLY' && section.id === sectionId) {
                    return { ...section, text };
                }
                // Otherwise, return the section unchanged
                return section;
            });
        });
    };


    // Handle save
    const handleSave = async () => {
        if (!post || !post.id) return;

        setIsLoading(true);
        setError(null);

        try {
            // Filter out empty text sections before saving, unless it's the only section
            const sectionsToSave = sections.filter((s, index, arr) => {
                if (s.type === 'TEXT_ONLY') {
                    return s.text?.trim() !== '' || arr.length === 1;
                }
                // Keep non-text sections (like images, videos etc.)
                return true;
            });

            // Prevent saving if all text sections are now empty (and there were multiple originally)
            if (sectionsToSave.length === 0 && sections.length > 0) {
                Alert.alert("Cannot Save", "Post content cannot be empty.");
                setIsLoading(false);
                return;
            }


            await dispatch(updatePostAsync({
                postId: post.id,
                sections: sectionsToSave // Save the potentially filtered sections
            })).unwrap();

            hideModal(); // Animate out before closing
        } catch (err: any) {
            setError(err.message || 'Failed to update post');
            console.error("Update post error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // Get unique sections for display in the UI, removing any duplicates
    const getUniqueEditableSections = (): ThreadSection[] => {
        if (!sections || sections.length === 0) return [];

        // Create a map to identify unique sections based on type or ID
        const uniqueSectionsMap = new Map<string, ThreadSection>();

        sections.forEach(section => {
            const sectionId = section.id || `temp-${Math.random()}`; // Ensure ID

            switch (section.type) {
                // Types where we only show/edit the *first* instance encountered
                case 'TEXT_IMAGE':
                case 'TEXT_VIDEO':
                case 'TEXT_TRADE':
                case 'NFT_LISTING':
                case 'POLL':
                    if (!uniqueSectionsMap.has(section.type)) {
                        uniqueSectionsMap.set(section.type, section);
                    }
                    break;
                // Types where each instance is unique (by ID)
                case 'TEXT_ONLY':
                    if (!uniqueSectionsMap.has(sectionId)) {
                        uniqueSectionsMap.set(sectionId, section);
                    }
                    break;
                default:
                    // Handle potential unknown types gracefully
                    if (!uniqueSectionsMap.has(sectionId)) {
                        uniqueSectionsMap.set(sectionId, section);
                    }
                    break;
            }
        });

        return Array.from(uniqueSectionsMap.values());
    };

    // Renders appropriate editor based on section type
    const renderSectionEditor = (section: ThreadSection, index: number) => {
        // Common text input for all sections that have text
        const renderTextEditor = (placeholder: string) => (
            <TextInput
                value={section.text || ''}
                onChangeText={(text) => updateSectionText(index, text)}
                style={styles.textInput}
                placeholder={placeholder}
                placeholderTextColor={COLORS.greyMid}
                multiline
                autoCapitalize="sentences"
                keyboardAppearance="dark"
                maxLength={1000}
            />
        );

        switch (section.type) {
            case 'TEXT_ONLY':
                return (
                    <View style={styles.sectionContainer}>
                        {/* No title needed for simple text */}
                        {renderTextEditor("Edit your post...")}
                    </View>
                );

            case 'TEXT_IMAGE':
                return (
                    <View style={styles.sectionContainer}>
                        {/* Only show text input if original post had text */}
                        {post.sections.find(s => s.type === 'TEXT_IMAGE')?.text !== undefined &&
                            renderTextEditor("Edit image caption...")}
                        {section.imageUrl && (
                            <View style={styles.mediaPreviewContainer}>
                                <IPFSAwareImage
                                    source={getValidImageSource(section.imageUrl)}
                                    style={styles.imagePreview}
                                    defaultSource={DEFAULT_IMAGES.user}
                                    key={Platform.OS === 'android' ? `edit-image-${Date.now()}` : 'edit-image'}
                                />
                                <Text style={styles.helperText}>
                                    Image cannot be changed
                                </Text>
                            </View>
                        )}
                    </View>
                );

            case 'TEXT_VIDEO':
                // Assuming video URL is stored similarly to imageUrl
                const videoUrl = (section as any).videoUrl || 'Video Preview Unavailable';
                return (
                    <View style={styles.sectionContainer}>
                        {renderTextEditor("Edit video caption...")}
                        <View style={styles.mediaPreviewContainer}>
                            {/* Basic Video Placeholder */}
                            <View style={styles.videoPlaceholder}>
                                <Icons.BlueCheck width={24} height={24} color={COLORS.white} style={{ opacity: 0.7 }} />
                                <Text style={styles.videoPlaceholderText}>Video Preview</Text>
                            </View>
                            <Text style={styles.helperText}>
                                Video cannot be changed
                            </Text>
                        </View>
                    </View>
                );

            case 'TEXT_TRADE':
                const tradeInfo = (section as any).tradeInfo || {}; // Assuming trade data exists
                return (
                    <View style={styles.sectionContainer}>
                        {renderTextEditor("Edit trade caption...")}
                        <View style={styles.mediaPreviewContainer}>
                            <View style={styles.tradePlaceholder}>
                                <Icons.NFTIcon width={24} height={24} color={COLORS.brandPrimary} />
                                <Text style={styles.tradePlaceholderText}>Trade Details</Text>
                            </View>
                            <Text style={styles.helperText}>
                                Trade data cannot be changed
                            </Text>
                        </View>
                    </View>
                );


            case 'NFT_LISTING':
                const nftInfo = (section as any).nftInfo || {}; // Assuming NFT data exists
                return (
                    <View style={[styles.sectionContainer, styles.nonEditableSection]}>
                        <Text style={styles.sectionTitle}>NFT Listing</Text>
                        {nftInfo.imageUrl && (
                            <IPFSAwareImage
                                source={getValidImageSource(nftInfo.imageUrl)}
                                style={styles.nftPreview}
                                defaultSource={DEFAULT_IMAGES.user}
                                key={Platform.OS === 'android' ? `nft-edit-${Date.now()}` : 'nft-edit'}
                            />
                        )}
                        <Text style={styles.helperTextBold}>
                            NFT listing data cannot be edited
                        </Text>
                    </View>
                );

            case 'POLL':
                const pollOptions = (section as any).pollOptions || [];
                return (
                    <View style={[styles.sectionContainer, styles.nonEditableSection]}>
                        <Text style={styles.sectionTitle}>Poll</Text>
                        {pollOptions.map((opt: string, i: number) => (
                            <Text key={i} style={styles.pollOptionText}>{`• ${opt}`}</Text>
                        ))}
                        <Text style={styles.helperTextBold}>
                            Poll data cannot be edited
                        </Text>
                    </View>
                );


            default:
                // Render a generic non-editable state for unknown types
                return (
                    <View style={[styles.sectionContainer, styles.nonEditableSection]}>
                        <Text style={styles.sectionTitle}>Unsupported Section</Text>
                        <Text style={styles.helperTextBold}>
                            This section type cannot be edited.
                        </Text>
                    </View>
                );
        }
    };

    // Get unique sections for the UI
    const uniqueDisplaySections = getUniqueEditableSections();

    return (
        <Modal
            visible={isVisible}
            animationType="none"
            transparent={true}
            onRequestClose={handleBackPress}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardAvoidingView}
            >
                <Animated.View
                    style={[
                        styles.modalOverlay,
                        { opacity: backdropOpacity }
                    ]}
                >
                    {/* Touchable overlay to close modal */}
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={() => !isLoading && hideModal()}
                    />

                    {/* Drawer Content */}
                    <Animated.View
                        style={[
                            styles.drawerContainer,
                            { transform: [{ translateY: translateY }] }
                        ]}
                        {...panResponder.panHandlers}
                    >
                        {/* Drawer handle */}
                        <View style={styles.drawerHandleContainer}>
                            <View style={styles.drawerHandle} />
                        </View>

                        <View style={styles.modalHeader}>
                            <TouchableOpacity
                                onPress={() => !isLoading && hideModal()}
                                style={styles.closeButton}
                                disabled={isLoading}
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>

                            <Text style={styles.modalTitle}>Edit Post</Text>

                            <TouchableOpacity
                                style={[styles.saveButtonTop, isLoading && styles.buttonDisabled]}
                                onPress={handleSave}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <ActivityIndicator size="small" color={COLORS.brandBlue} />
                                ) : (
                                    <Text style={styles.saveButtonTopText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.scrollView}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.scrollViewContent}
                            keyboardShouldPersistTaps="handled"
                        >
                            {uniqueDisplaySections.length === 0 && !isLoading && (
                                <Text style={styles.helperText}>No editable content found.</Text>
                            )}
                            {uniqueDisplaySections.map((section, index) => (
                                <View key={section.id || `section-${index}`}>
                                    {renderSectionEditor(section, index)}
                                </View>
                            ))}

                            {error && (
                                <View style={styles.errorContainer}>
                                    <Icons.NotifBell width={18} height={18} color={COLORS.errorRed} />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            )}

                            {/* Add some bottom padding */}
                            <View style={{ height: 20 }} />
                        </ScrollView>

                        {/* Footer with buttons - shown only on Android */}
                        {Platform.OS === 'android' && (
                            <View style={styles.footer}>
                                <TouchableOpacity
                                    style={[styles.button, styles.cancelButton]}
                                    onPress={hideModal}
                                    disabled={isLoading}
                                >
                                    <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.button, styles.saveButton, isLoading && styles.buttonDisabled]}
                                    onPress={handleSave}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator size="small" color={COLORS.white} />
                                    ) : (
                                        <Text style={[styles.buttonText, styles.saveButtonText]}>Save</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </Animated.View>
                </Animated.View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    keyboardAvoidingView: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    drawerContainer: {
        backgroundColor: COLORS.lighterBackground,
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
        maxHeight: SCREEN_HEIGHT * 0.85,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 20,
    },
    drawerHandleContainer: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    drawerHandle: {
        width: 36,
        height: 5,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.borderDarkColor,
    },
    modalTitle: {
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.white,
        textAlign: 'center',
        flex: 1,
    },
    closeButton: {
        paddingVertical: 6,
        paddingHorizontal: 8,
        minWidth: 60,
    },
    cancelText: {
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.weights.medium,
        color: COLORS.greyMid,
    },
    saveButtonTop: {
        paddingVertical: 6,
        paddingHorizontal: 8,
        minWidth: 60,
        alignItems: 'flex-end',
    },
    saveButtonTopText: {
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.brandBlue,
    },
    scrollView: {
        maxHeight: SCREEN_HEIGHT * 0.7,
    },
    scrollViewContent: {
        paddingHorizontal: 16,
        paddingTop: 20,
    },
    sectionContainer: {
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
        borderRadius: 12,
        padding: 16,
        backgroundColor: COLORS.lightBackground,
    },
    nonEditableSection: {
        backgroundColor: COLORS.darkerBackground,
        borderColor: COLORS.borderDarkColor,
    },
    sectionTitle: {
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        marginBottom: 12,
        color: COLORS.white,
    },
    textInput: {
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
        borderRadius: 10,
        paddingVertical: 14,
        paddingHorizontal: 16,
        minHeight: 120,
        fontSize: TYPOGRAPHY.size.md,
        color: COLORS.white,
        backgroundColor: COLORS.background,
        textAlignVertical: 'top',
        lineHeight: TYPOGRAPHY.lineHeight.md,
    },
    mediaPreviewContainer: {
        marginTop: 16,
        alignItems: 'center',
        padding: 12,
        backgroundColor: COLORS.background,
        borderRadius: 10,
        overflow: 'hidden',
    },
    imagePreview: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 8,
        marginBottom: 10,
    },
    nftPreview: {
        width: 120,
        height: 120,
        borderRadius: 8,
        marginVertical: 10,
        alignSelf: 'center',
    },
    videoPlaceholder: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        flexDirection: 'row',
        gap: 8,
    },
    videoPlaceholderText: {
        color: COLORS.white,
        fontWeight: TYPOGRAPHY.weights.medium,
        opacity: 0.9,
    },
    tradePlaceholder: {
        width: '100%',
        paddingVertical: 30,
        borderRadius: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        flexDirection: 'row',
        gap: 8,
    },
    tradePlaceholderText: {
        color: COLORS.brandPrimary,
        fontWeight: TYPOGRAPHY.weights.semiBold,
    },
    pollOptionText: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.white,
        marginBottom: 6,
        paddingHorizontal: 4,
    },
    helperText: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyMid,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 4,
    },
    helperTextBold: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyMid,
        fontWeight: TYPOGRAPHY.weights.medium,
        textAlign: 'center',
        marginTop: 8,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 16,
        backgroundColor: 'rgba(224, 36, 94, 0.1)',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 8,
    },
    errorText: {
        color: COLORS.errorRed,
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.weights.medium,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.borderDarkColor,
        backgroundColor: COLORS.lighterBackground,
    },
    button: {
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 10,
        marginLeft: 12,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 120,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    cancelButton: {
        backgroundColor: COLORS.darkerBackground,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    saveButton: {
        backgroundColor: COLORS.brandBlue,
    },
    buttonText: {
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.weights.semiBold,
    },
    cancelButtonText: {
        color: COLORS.white,
    },
    saveButtonText: {
        color: COLORS.white,
    },
});

export default EditPostModal; 