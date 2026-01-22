import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    FlatList,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList } from '@/shared/navigation/RootNavigator';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useReduxHooks';
import { fetchUsersForChat, createDirectChat } from '@/shared/state/chat/slice';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import Icons from '@/assets/svgs';
import { DEFAULT_IMAGES } from '@/shared/config/constants';

type UserSelectionScreenNavigationProp = StackNavigationProp<RootStackParamList, 'UserSelectionScreen'>;

interface UserSelectionScreenProps { }

/**
 * User Selection Screen for starting new chats
 */
const UserSelectionScreen: React.FC<UserSelectionScreenProps> = () => {
    const navigation = useNavigation<UserSelectionScreenNavigationProp>();
    const dispatch = useAppDispatch();
    const [searchQuery, setSearchQuery] = useState('');

    // Get current user ID from auth state
    const auth = useAppSelector(state => state.auth);
    const currentUserId = auth.address || '';

    // Get users from the state
    const { usersForChat, loadingUsers, error } = useAppSelector(state => state.chat);

    // Track if we're currently creating a chat
    const [creatingChat, setCreatingChat] = useState<string | null>(null);

    // Fetch users on component mount and when search query changes
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            dispatch(fetchUsersForChat({
                query: searchQuery.trim(),
                userId: currentUserId
            }));
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, dispatch, currentUserId]);

    // Handle user selection - create a new chat and navigate to it
    const handleUserSelect = useCallback(async (userId: string, username: string) => {
        if (!currentUserId || creatingChat) return;

        setCreatingChat(userId);

        try {
            const resultAction = await dispatch(createDirectChat({
                userId: currentUserId,
                otherUserId: userId
            }));

            if (createDirectChat.fulfilled.match(resultAction)) {
                const { chatId } = resultAction.payload;

                // Navigate to the new chat
                navigation.navigate('ChatScreen', {
                    chatId,
                    chatName: username,
                    isGroup: false
                });
            } else {
                console.error('Failed to create chat:', resultAction.error);
            }
        } catch (error) {
            console.error('Error creating chat:', error);
        } finally {
            setCreatingChat(null);
        }
    }, [currentUserId, creatingChat, dispatch, navigation]);

    // Handle back button
    const handleBack = useCallback(() => {
        navigation.goBack();
    }, [navigation]);

    // Render user item
    const renderUserItem = ({ item }: { item: any }) => {
        // Handle null avatar URL
        const avatarSource = item.profile_picture_url
            ? { uri: item.profile_picture_url }
            : DEFAULT_IMAGES.user;

        const isCreating = creatingChat === item.id;

        return (
            <TouchableOpacity
                style={styles.userItem}
                onPress={() => handleUserSelect(item.id, item.username)}
                disabled={isCreating}
                activeOpacity={0.7}
            >
                <Image
                    source={avatarSource}
                    style={styles.avatar}
                />
                <View style={styles.userInfo}>
                    <Text style={styles.username}>{item.username}</Text>
                    <Text style={styles.userId}>@{item.id.substring(0, 6)}...{item.id.substring(item.id.length - 4)}</Text>
                </View>

                {isCreating ? (
                    <ActivityIndicator color={COLORS.brandBlue} size="small" />
                ) : (
                    <View style={styles.arrowContainer}>
                        <Text style={styles.arrow}>›</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

            {/* Header with Gradient Border */}
            <View style={styles.headerContainer}>
                {/* Left: Back button */}
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBack}
                >
                    <Icons.ArrowLeft width={20} height={20} color={COLORS.white} />
                </TouchableOpacity>

                {/* Center: Title */}
                <View style={styles.titleContainer}>
                    <Text style={styles.titleText}>New Chat</Text>
                </View>

                {/* Right: Placeholder for symmetry */}
                <View style={styles.rightPlaceholder} />

                {/* Bottom gradient border */}
                <LinearGradient
                    colors={['transparent', COLORS.lightBackground]}
                    style={styles.headerBottomGradient}
                />
            </View>

            {/* Search bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                    <Icons.searchIcon width={16} height={16} color={COLORS.lightGrey} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search for users..."
                        placeholderTextColor={COLORS.lightGrey}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        keyboardAppearance="dark"
                    />
                    {searchQuery ? (
                        <TouchableOpacity
                            onPress={() => setSearchQuery('')}
                            style={styles.clearButton}
                        >
                            <Icons.cross width={14} height={14} color={COLORS.lightGrey} />
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            {/* User list */}
            {loadingUsers ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={COLORS.brandBlue} />
                    <Text style={styles.loaderText}>Loading users...</Text>
                </View>
            ) : (
                <FlatList
                    data={usersForChat}
                    renderItem={renderUserItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                {searchQuery ? 'No users found matching your search' : 'No users available'}
                            </Text>
                            <Text style={styles.emptySubText}>
                                {searchQuery ? 'Try a different name or search term' : 'Check back later'}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Error message if present */}
            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderDarkColor,
        backgroundColor: COLORS.background,
        position: 'relative',
    },
    backButton: {
        padding: 8,
    },
    titleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    titleText: {
        fontSize: TYPOGRAPHY.size.xl,
        fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
        color: COLORS.white,
        letterSpacing: TYPOGRAPHY.letterSpacing,
    },
    rightPlaceholder: {
        width: 36, // Match the width of the back button for symmetry
    },
    headerBottomGradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: -1,
        height: 1,
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.lightBackground,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 46,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    searchInput: {
        flex: 1,
        height: 46,
        fontSize: TYPOGRAPHY.size.md,
        color: COLORS.white,
        marginLeft: 8,
        letterSpacing: TYPOGRAPHY.letterSpacing,
    },
    clearButton: {
        padding: 6,
    },
    listContainer: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginVertical: 6,
        borderRadius: 12,
        backgroundColor: COLORS.lighterBackground,
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: COLORS.darkerBackground,
    },
    userInfo: {
        marginLeft: 16,
        flex: 1,
    },
    username: {
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
        color: COLORS.white,
        letterSpacing: TYPOGRAPHY.letterSpacing,
    },
    userId: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.accessoryDarkColor,
        marginTop: 2,
        letterSpacing: TYPOGRAPHY.letterSpacing,
    },
    arrowContainer: {
        padding: 8,
    },
    arrow: {
        fontSize: 20,
        color: COLORS.greyMid,
        fontWeight: '300',
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderText: {
        marginTop: 10,
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.greyMid,
        letterSpacing: TYPOGRAPHY.letterSpacing,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 80,
        paddingHorizontal: 30,
    },
    emptyText: {
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
        color: COLORS.white,
        textAlign: 'center',
        letterSpacing: TYPOGRAPHY.letterSpacing,
    },
    emptySubText: {
        marginTop: 8,
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.greyMid,
        textAlign: 'center',
        letterSpacing: TYPOGRAPHY.letterSpacing,
    },
    errorContainer: {
        padding: 16,
        backgroundColor: COLORS.darkerBackground,
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 8,
        borderColor: COLORS.errorRed,
        borderWidth: 1,
    },
    errorText: {
        color: COLORS.errorRed,
        fontSize: TYPOGRAPHY.size.sm,
        letterSpacing: TYPOGRAPHY.letterSpacing,
    },
});

export default UserSelectionScreen; 