import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Alert,
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  ImageSourcePropType,
  Animated,
  Easing,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/shared/navigation/RootNavigator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_IMAGES } from '@/shared/config/constants';
import Icons from '@/assets/svgs';
import COLORS from '@/assets/colors';
import { IPFSAwareImage, getValidImageSource } from '@/shared/utils/IPFSImage';
import { styles } from './ChatListScreen.styles';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useReduxHooks';
import { fetchAllPosts } from '@/shared/state/thread/reducer';
import { fetchUserChats, ChatRoom, updateUserOnlineStatus, receiveMessage, incrementUnreadCount, setSelectedChat } from '@/shared/state/chat/slice';
import socketService from '@/shared/services/socketService';
import { AutoAvatar } from '@/shared/components/AutoAvatar';
import { AppHeader } from '@/core/shared-ui';
import ChatListItemSkeleton from '@/core/chat/components/ChatListItemSkeleton';

type ChatListNavigationProp = StackNavigationProp<RootStackParamList, 'ChatListScreen'>;

// Android-specific styles
const androidStyles = StyleSheet.create({
  statusBarPlaceholder: {
    height: RNStatusBar.currentHeight || 24,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    paddingTop: 8, // Additional padding for Android camera hole
  },
  fabAdjusted: {
    bottom: 90, // Adjusted position to appear above the navigation bar
  }
});

// Function to format relative time
const formatRelativeTime = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// AI Agent chat hardcoded image and initial message
const AI_AGENT = {
  id: 'ai-agent',
  name: 'AI Assistant',
  avatar: null, // We'll handle this specially in the AutoAvatar component
  initialMessage: "Hey! I'm your AI assistant. I can help you with various tasks like buying/selling tokens, swapping tokens, or providing information about your wallet. How can I assist you today?"
};

/**
 * ChatListScreen component - Entry point for the chat feature
 * Shows available chats and allows searching for users
 */
const ChatListScreen: React.FC = () => {
  const navigation = useNavigation<ChatListNavigationProp>();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const [searchQuery, setSearchQuery] = useState('');

  // Get user data, posts, and chats from redux
  const auth = useAppSelector(state => state.auth);
  const userId = auth.address || '';
  const allPosts = useAppSelector(state => state.thread.allPosts);
  const { chats, loadingChats, error } = useAppSelector(state => state.chat);
  const { usersForChat } = useAppSelector(state => state.chat);

  // State to track online users
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  // State to store sorted chats
  const [sortedChats, setSortedChats] = useState<ChatRoom[]>([]);

  // Update the sorted chats whenever the chats array changes
  useEffect(() => {
    if (chats.length > 0) {
      // Create a sorted copy of the chats array - most recent updated_at first
      const sorted = [...chats].sort((a, b) => {
        const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return dateB - dateA;
      });
      setSortedChats(sorted);
    } else {
      setSortedChats([]);
    }
  }, [chats]);

  // Animation for content fade-in
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const [isContentLoaded, setIsContentLoaded] = useState(false);

  useEffect(() => {
    if (!loadingChats && !error) {
      setIsContentLoaded(true); // Content is ready, mount the Animated.View
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 350, // Fade-in duration
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      // Reset if loading starts again or error occurs
      contentOpacity.setValue(0);
      setIsContentLoaded(false);
    }
  }, [loadingChats, error, contentOpacity]);

  // Initialize Socket connection and listeners
  useEffect(() => {
    if (userId) {
      let isMounted = true;
      console.log('[ChatListScreen] Initializing socket and listeners...');

      // Initialize the socket connection
      socketService.initSocket(userId).catch(err => {
        console.error('Failed to initialize socket:', err);
      });

      // Set to persistent mode to keep the connection active between screens
      socketService.setPersistentMode(true);

      // Send online status when entering chat list
      sendOnlineStatus(true);

      // --- Socket Event Listeners ---
      const handleUserStatusChange = (data: { userId: string, isOnline: boolean }) => {
        if (!isMounted) return;
        console.log('User status change received:', data);
        setOnlineUsers(prev => {
          if (data.isOnline) {
            return prev.includes(data.userId) ? prev : [...prev, data.userId];
          } else {
            return prev.filter(id => id !== data.userId);
          }
        });
        dispatch(updateUserOnlineStatus({ userId: data.userId, isOnline: data.isOnline }));
      };

      const handleNewMessage = (messageData: any) => {
        if (!isMounted) return;
        console.log('New message event received in ChatListScreen:', messageData);

        // We don't need to do anything with new messages here since socketService 
        // already dispatches the necessary actions to update the Redux store
        // The UI will automatically update when the store changes
      };

      // Subscribe to events
      socketService.subscribeToEvent('user_status_change', handleUserStatusChange);
      socketService.subscribeToEvent('new_message', handleNewMessage); // Listen for new messages
      // Add listener for new chat creation if the backend emits a specific event for it
      // socketService.subscribeToEvent('new_chat_created', handleNewChatCreated);

      // --- End Socket Event Listeners ---

      // Clean up on unmount
      return () => {
        isMounted = false;
        console.log('[ChatListScreen] Cleaning up listeners...');
        // Send offline status when leaving chat list
        sendOnlineStatus(false);

        // Unsubscribe from events
        socketService.unsubscribeFromEvent('user_status_change', handleUserStatusChange);
        socketService.unsubscribeFromEvent('new_message', handleNewMessage);
        // socketService.unsubscribeFromEvent('new_chat_created', handleNewChatCreated);

        console.log('Leaving ChatListScreen, but keeping socket connected due to persistent mode.');
      };
    }
  }, [userId, dispatch]);

  // Helper function to send online status
  const sendOnlineStatus = (isOnline: boolean) => {
    if (userId) {
      console.log(`Sending user ${isOnline ? 'online' : 'offline'} status`);
      socketService.emit('user_status', {
        userId: userId,
        isOnline: isOnline
      });
      // Also update in Redux
      dispatch(updateUserOnlineStatus({ userId: userId, isOnline: isOnline }));
    }
  };

  // Initial data load (runs once on mount or when userId changes)
  useFocusEffect(
    useCallback(() => {
      const loadInitialData = async () => {
        try {
          // Fetch user's chats if user is authenticated
          if (userId) {
            console.log('[ChatListScreen] Focus: Fetching user chats...');
            const chatResponse = await dispatch(fetchUserChats(userId)).unwrap();

            // Join all chat rooms after fetching them
            if (chatResponse && Array.isArray(chatResponse)) {
              const chatIds = chatResponse.map(chat => chat.id).filter(Boolean) as string[];
              if (chatIds.length > 0) {
                console.log('[ChatListScreen] Focus: Joining chat rooms:', chatIds);
                socketService.joinChats(chatIds);
              }
            }
          }
        } catch (error) {
          console.error('Error loading chat data on focus:', error);
          // Error is handled by the error state in Redux
        }
      };

      loadInitialData();

      // Optional: Return a cleanup function if needed for specific effects,
      // but for fetching data on focus, it's often not required unless
      // you need to cancel the fetch if the screen becomes unfocused quickly.
      // return () => {};
    }, [dispatch, userId]) // Dependencies for useCallback: re-run effect if dispatch or userId changes
  );

  // Format most recent post for Global chat preview
  const getGlobalChatLastMessage = useCallback(() => {
    if (allPosts.length === 0) return "Join the community conversation";

    const latestPost = [...allPosts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    // Extract text from the first TEXT_ONLY or TEXT_IMAGE section, or any section with text
    const postText = latestPost.sections.find(s => s.text)?.text || "Shared a post";

    return latestPost.user.username + ": " +
      (postText.length > 30 ? postText.substring(0, 30) + '...' : postText);
  }, [allPosts]);

  const getGlobalChatTime = useCallback(() => {
    if (allPosts.length === 0) return "Now";

    const latestPost = [...allPosts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    return formatRelativeTime(latestPost.createdAt);
  }, [allPosts]);

  // Get total user count - in a real app this would come from the API
  const getTotalUserCount = useCallback(() => {
    // For now we'll use a hard-coded value plus the length of usersForChat
    // In a real app, you'd get this from the API
    return usersForChat.length > 0 ? usersForChat.length : 128;
  }, [usersForChat]);

  // Handle AI agent chat
  const handleAIAgentChat = useCallback(() => {
    navigation.navigate('ChatScreen', {
      chatId: AI_AGENT.id,
      chatName: AI_AGENT.name,
      isGroup: false
    });
  }, [navigation]);

  // Prepare all chats - both API chats and the special global chat
  const prepareChats = useCallback(() => {
    // Create AI Agent chat
    const aiAgentChat = {
      id: AI_AGENT.id,
      name: AI_AGENT.name,
      lastMessage: {
        content: "How can I assist you today?",
        sender: { username: 'AI' },
        created_at: new Date().toISOString(),
      },
      time: 'now',
      type: 'ai' as const,
      is_active: true,
      participants: [],
      created_at: '',
      updated_at: '',
      unreadCount: 0,
      avatar: AI_AGENT.avatar,
    };

    // Create global chat item - commented out as requested
    /*
    const globalChat = {
      id: 'global',
      name: 'Global Community',
      lastMessage: {
        content: getGlobalChatLastMessage(),
        sender: { username: '' },
        created_at: new Date().toISOString(),
      },
      time: getGlobalChatTime(),
      type: 'global' as const,
      is_active: true,
      participants: [],
      created_at: '',
      updated_at: '',
      unreadCount: Math.min(allPosts.length, 5),
      avatar: DEFAULT_IMAGES.groupChat,
      memberCount: getTotalUserCount(), // Add the total user count
    };
    */

    // Filter and format API chats
    const apiChats = sortedChats.map(chat => {
      // Get other participant for direct chats (for name and avatar)
      let chatName = chat.name || '';
      let avatar: ImageSourcePropType = DEFAULT_IMAGES.groupChat; // Explicitly type avatar

      if (chat.type === 'direct' && chat.participants) {
        const otherParticipant = chat.participants.find(p => p.id !== userId);
        if (otherParticipant) {
          chatName = otherParticipant.username;
          avatar = getValidImageSource(otherParticipant.profile_picture_url || DEFAULT_IMAGES.user);
        }
      }

      // Format the last message time
      const time = chat.lastMessage ? formatRelativeTime(chat.lastMessage.created_at) : '';

      // Format last message content
      let lastMessageContent = 'No messages yet';
      if (chat.lastMessage) {
        // Remove sender name prefix - just show the message content
        let coreMessageText = '';

        // Check for special message types first
        if (chat.lastMessage.image_url) {
          coreMessageText = 'Sent an image';
        } else if (chat.lastMessage.additional_data?.nftData) {
          coreMessageText = 'Shared an NFT';
        } else if (chat.lastMessage.additional_data?.tradeData) {
          coreMessageText = 'Shared a trade';
        } else if (chat.lastMessage.content && chat.lastMessage.content.trim() !== '') {
          // If no special type, use the text content
          coreMessageText = chat.lastMessage.content.trim();
        } else {
          // Fallback if lastMessage object exists but has no specific content type or text
          coreMessageText = 'Sent a message';
        }

        lastMessageContent = coreMessageText;

        // Truncate the final display string if it's too long
        if (lastMessageContent.length > 40) {
          lastMessageContent = lastMessageContent.substring(0, 37) + '...';
        }
      }

      return {
        ...chat,
        name: chatName,
        avatar,
        time,
        lastMessage: {
          ...chat.lastMessage,
          content: lastMessageContent,
        },
      };
    });

    return [aiAgentChat, ...apiChats];

  }, [sortedChats, userId, getGlobalChatLastMessage, getGlobalChatTime, getTotalUserCount]);

  // Filter chats based on search query
  const filteredChats = searchQuery
    ? prepareChats().filter(chat =>
      chat.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : prepareChats();

  // Handle chat item press - navigate to ChatScreen
  const handleChatPress = useCallback((chat: any) => {
    if (chat.id === AI_AGENT.id) {
      handleAIAgentChat();
      return;
    }

    // Reset the unread counter when selecting a chat
    dispatch(setSelectedChat(chat.id));

    navigation.navigate('ChatScreen', {
      chatId: chat.id,
      chatName: chat.name,
      isGroup: chat.type !== 'direct'
    });
  }, [navigation, handleAIAgentChat, dispatch]);

  // Handle new chat button press
  const handleNewChat = useCallback(() => {
    if (!userId) {
      Alert.alert('Error', 'You need to connect your wallet to create a chat');
      return;
    }

    navigation.navigate('UserSelectionScreen');
  }, [navigation, userId]);

  // Render chat list item
  const renderChatItem = ({ item }: { item: any }) => {
    // Detect if this is a direct chat
    const isDirect = item.type === 'direct';
    const isAI = item.id === AI_AGENT.id;

    // For direct chats, check online status and get participant info
    let isOnline = false;
    let participantUser = null;

    if (isDirect && item.participants) {
      const otherParticipant = item.participants.find((p: any) => p.id !== userId);
      if (otherParticipant) {
        // Combine Redux state and real-time socket state for online status
        isOnline = otherParticipant.is_active === true || onlineUsers.includes(otherParticipant.id);
        participantUser = {
          id: otherParticipant.id,
          username: otherParticipant.username,
          handle: otherParticipant.username,
          // Don't provide fallback avatar - let AutoAvatar show initials if no profile picture
          avatar: otherParticipant.profile_picture_url || null,
          verified: false,
        };
      }
    }

    if (isAI) {
      isOnline = true;
      participantUser = {
        id: AI_AGENT.id,
        username: AI_AGENT.name,
        handle: 'ai-assistant',
        avatar: null, // Special handling for AI
        verified: true,
      };
    }

    if (!participantUser && !isDirect && !isAI) {
      participantUser = {
        id: item.id,
        username: item.name,
        handle: 'group-chat',
        avatar: item.avatar || null, // Don't provide fallback - let AutoAvatar handle it
        verified: false,
      };
    }

    const displayUser = participantUser || {
      id: item.id,
      username: item.name,
      handle: 'unknown',
      avatar: null, // Don't provide fallback - let AutoAvatar handle it
      verified: false,
    };

    return (
      <TouchableOpacity
        style={styles.chatItem}
        activeOpacity={0.7}
        onPress={() => handleChatPress(item)}
      >
        <View style={styles.avatarContainer}>
          {isAI ? (
            // Special AI avatar with SVG icon
            <View style={[styles.avatar, { backgroundColor: COLORS.brandBlue, justifyContent: 'center', alignItems: 'center' }]}>
              <Icons.RocketIcon width={24} height={24} color={COLORS.white} />
            </View>
          ) : (
            <AutoAvatar
              userId={displayUser.id}
              profilePicUrl={displayUser.avatar}
              username={displayUser.username}
              size={50}
              style={styles.avatar}
              showInitials={true}
            />
          )}
          {!isDirect && !isAI ? (
            <View style={styles.groupIndicator}>
              <Icons.ProfilePlusIcon width={12} height={12} color={COLORS.white} />
            </View>
          ) : isOnline ? (
            <View style={styles.onlineIndicator} />
          ) : null}
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.chatNameRow}>
            <View style={styles.nameContainer}>
              <Text style={styles.chatName}>{item.name}</Text>
              {item.id === 'global' ? (
                <Text style={styles.memberCount}>
                  {item.memberCount} members
                </Text>
              ) : item.type !== 'direct' && item.id !== AI_AGENT.id && (
                <Text style={styles.memberCount}>
                  {item.participants ? `${item.participants.length} members` : 'Group chat'}
                </Text>
              )}
            </View>
            <Text style={styles.chatTime}>{item.time}</Text>
          </View>
          <View style={styles.lastMessageRow}>
            <Text
              style={[
                styles.lastMessage,
                item.unreadCount > 0 && styles.unreadMessage
              ]}
              numberOfLines={1}
            >
              {item.lastMessage?.content || 'No messages yet'}
            </Text>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      {Platform.OS === 'android' && <View style={androidStyles.statusBarPlaceholder} />}
      <SafeAreaView style={styles.safeArea}>
        <View style={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom, 65) } // Account for bottom tab bar
        ]}>
          <StatusBar style="light" />

          {/* Replace custom header with AppHeader component */}
          <AppHeader
            title="Messages"
            showBackButton={false}
          />

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Icons.searchIcon width={16} height={16} color={COLORS.lightGrey} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search users or messages"
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

          {/* Chat list */}
          {loadingChats ? (
            <FlatList
              data={[1, 2, 3, 4, 5, 6, 7, 8]} // User's current number of skeletons
              keyExtractor={(item) => item.toString()}
              renderItem={() => <ChatListItemSkeleton />}
              contentContainerStyle={styles.chatListContainer}
              showsVerticalScrollIndicator={false}
            />
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => dispatch(fetchUserChats(userId))}
              >
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : isContentLoaded ? (
            <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
              <FlatList
                data={filteredChats}
                renderItem={renderChatItem}
                keyExtractor={item => `${item.id}-${item.unreadCount || 0}-${item.lastMessage?.created_at || 'none'}`}
                extraData={onlineUsers} // Re-render when online status changes
                contentContainerStyle={styles.chatListContainer}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      {searchQuery ? 'No chats found' : 'No conversations yet'}
                    </Text>
                    <Text style={styles.emptySubtext}>
                      {searchQuery
                        ? 'Try a different search term'
                        : 'Start chatting with other users by tapping the button below'}
                    </Text>
                  </View>
                }
              />
            </Animated.View>
          ) : null}

          {/* Floating action button to start new chat - adjusted for bottom bar */}
          <TouchableOpacity
            style={[
              styles.fab,
              { bottom: Math.max(24, insets.bottom + 16) },
              Platform.OS === 'android' && androidStyles.fabAdjusted
            ]}
            onPress={handleNewChat}
            activeOpacity={0.8}
          >
            <Icons.MessageIcon width={24} height={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
};

export default ChatListScreen; 