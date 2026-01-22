import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ImageSourcePropType,
  Keyboard,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  TextInput,
  Pressable,
  GestureResponderEvent,
  Dimensions,
  StyleSheet,
  StatusBar as RNStatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChatComposer, ChatMessage, AgenticChatContainer } from '@/core/chat/components';
import { MessageNFT, MessageTradeCard } from '@/core/chat/components/message';
import { MessageData, NFTData } from '@/core/chat/components/message/message.types';
import { useWallet } from '@/modules/wallet-providers/hooks/useWallet';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useReduxHooks';
import { ThreadUser } from '@/core/thread/types';
import { ThreadPost, ThreadSection } from '@/core/thread/components/thread.types';
import { DEFAULT_IMAGES } from '@/shared/config/constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { styles as baseStyles, TAB_BAR_HEIGHT } from './ChatScreen.styles';
import Icons from '@/assets/svgs';
import COLORS from '@/assets/colors';
import { fetchAllPosts } from '@/shared/state/thread/reducer';
import TokenDetailsDrawer from '@/core/shared-ui/TokenDetailsDrawer/TokenDetailsDrawer';
import { NftListingData, NftDetailsSection, buyNft, buyCollectionFloor } from '@/modules/nft';
import { TransactionService } from '@/modules/wallet-providers/services/transaction/transactionService';
import TYPOGRAPHY from '@/assets/typography';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/shared/navigation/RootNavigator';
import {
  fetchChatMessages,
  sendMessage as sendReduxMessage,
  receiveMessage,
  editMessage,
  deleteMessage,
  setSelectedChat
} from '@/shared/state/chat/slice';
import socketService from '@/shared/services/socketService';
import { TradeData } from '@/core/shared-ui/TradeCard/TradeCard';
import { useChat } from '@/modules/solana-agent-kit/hooks/useChat';
import { generateUUID } from '@/modules/solana-agent-kit/lib/utils';
import type { Message } from 'ai';
import { StatusBar } from 'expo-status-bar';
import { IPFSAwareImage, getValidImageSource } from '@/shared/utils/IPFSImage';
import { AppHeader } from '@/core/shared-ui';

// Add these styles before the component
// Create a complete styles object by extending the base styles
const styles = StyleSheet.create({
  ...baseStyles,
  // Socket status styles
  socketStatusContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginRight: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  connectedIndicator: {
    backgroundColor: COLORS.brandGreen,
  },
  errorIndicator: {
    backgroundColor: COLORS.brandBlue,
  },
  socketStatusText: {
    color: COLORS.brandGreen,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  socketErrorText: {
    color: COLORS.brandBlue,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  retryText: {
    color: COLORS.white,
    fontSize: 10,
    opacity: 0.7,
    marginLeft: 2,
  },
  offlineBanner: {
    backgroundColor: COLORS.darkerBackground,
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.brandBlue,
    alignItems: 'center' as const,
  },
  offlineBannerText: {
    color: COLORS.white,
    fontSize: 12,
    textAlign: 'center' as const,
    marginBottom: 4,
  },
  refreshButton: {
    backgroundColor: COLORS.darkerBackground,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.greyBorder,
  },
  refreshButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600' as const,
  },

  // Add styles for message actions modal
  messageActionsModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  messageActionsContainer: {
    width: '80%' as const,
    backgroundColor: COLORS.darkerBackground,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.greyBorder,
  },
  messageActionsTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600' as const,
    marginBottom: 16,
    textAlign: 'center' as const,
  },
  messageAction: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  editAction: {
    backgroundColor: COLORS.brandBlue,
  },
  deleteAction: {
    backgroundColor: '#FF3B30',
  },
  cancelAction: {
    backgroundColor: COLORS.greyBorder,
  },
  actionText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '500' as const,
    marginLeft: 8,
  },
  actionIcon: {
    width: 20,
    height: 20,
  },

  // Edit message drawer styles (Simplified)
  editDrawer: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.lighterBackground,
    borderTopLeftRadius: 20, // Larger radius for modern look
    borderTopRightRadius: 20,
    padding: 20, // Increased padding
    paddingBottom: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(50, 212, 222, 0.2)',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -6 }, // Larger shadow
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  editDrawerHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 16, // Increased margin
  },
  editDrawerTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.lg, // Larger title
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  closeButton: {
    padding: 8, // Larger padding
    borderRadius: 20,
    backgroundColor: COLORS.darkerBackground,
    width: 36,
    height: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  editInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12, // Larger radius
    color: COLORS.white,
    paddingHorizontal: 16, // Increased padding
    paddingVertical: 14, // Increased padding
    fontSize: TYPOGRAPHY.size.md, // Larger font
    fontFamily: TYPOGRAPHY.fontFamily,
    minHeight: 80, // Increased min height
    textAlignVertical: 'top' as const,
    marginBottom: 16, // Increased margin
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  editButtons: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    marginBottom: 12, // Increased margin
  },
  editCancelButton: {
    paddingVertical: 10, // Increased padding
    paddingHorizontal: 18, // Increased padding
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: COLORS.darkerBackground,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  editSaveButton: {
    paddingVertical: 10, // Increased padding
    paddingHorizontal: 20, // Increased padding
    borderRadius: 12,
    backgroundColor: COLORS.brandBlue,
    shadowColor: COLORS.brandBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md, // Larger font
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
});

// Add custom styles for NFT message components
const additionalStyles = {
  messageHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(50, 212, 222, 0.3)',
    shadowColor: COLORS.brandBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  username: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700' as const,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  nftContainer: {
    width: '90%' as any, // Use any to bypass type checking for width
    marginVertical: 8,
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 20,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: 'rgba(50, 212, 222, 0.2)',
    alignSelf: 'flex-start' as const,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  currentUserNftContainer: {
    alignSelf: 'flex-end' as const,
    borderBottomRightRadius: 6,
  },
  otherUserNftContainer: {
    alignSelf: 'flex-start' as const,
    borderBottomLeftRadius: 6,
  },
  buyButton: {
    backgroundColor: COLORS.brandBlue,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '90%' as any, // Use any to bypass type checking for width
    alignItems: 'center' as const,
    marginTop: 12,
    marginBottom: 16,
    alignSelf: 'center' as const,
    shadowColor: COLORS.brandBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  floorButton: {
    backgroundColor: COLORS.brandGreen,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '90%' as any, // Use any to bypass type checking for width
    alignItems: 'center' as const,
    marginTop: 12,
    marginBottom: 16,
    alignSelf: 'center' as const,
    shadowColor: COLORS.brandGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  disabledButton: {
    opacity: 0.6,
    shadowOpacity: 0.1,
  },
  buyButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
};

// Update Message context menu styles
const messageActionStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Darker overlay
    zIndex: 1000,
  },
  popup: {
    position: 'absolute',
    minWidth: 200, // Give it a minimum width
    maxWidth: '65%',
    backgroundColor: COLORS.lighterBackground, // Use theme color
    borderRadius: 16,
    paddingVertical: 12, // Reduce vertical padding
    paddingHorizontal: 16,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 1001,
    borderWidth: 1,
    borderColor: 'rgba(50, 212, 222, 0.2)',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12, // Adjust padding
    paddingHorizontal: 4,
  },
  actionText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md, // Use typography size
    fontFamily: TYPOGRAPHY.fontFamily,
    marginLeft: 12,
    fontWeight: '600',
  },
  actionTextDelete: {
    color: COLORS.errorRed, // Use error color for delete
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginLeft: 12,
    fontWeight: '600',
  },
  actionDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Use theme border color
    marginVertical: 6, // Reduce divider margin
    marginHorizontal: 4,
  },
  iconContainer: {
    width: 24,
    alignItems: 'center',
  }
});

// Add androidStyles after the messageActionStyles StyleSheet
const androidStyles = StyleSheet.create({
  statusBarPlaceholder: {
    height: RNStatusBar.currentHeight || 24,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    paddingTop: 8, // Additional padding for Android camera hole
  }
});

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'ChatScreen'>;
type ChatScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ChatScreen'>;

// AI Agent chat configuration
const AI_AGENT = {
  id: 'ai-agent',
  name: 'AI Assistant',
  avatar: DEFAULT_IMAGES.user, // Use a default user image instead of SVG
  initialMessage: "Hey! I'm your AI assistant. I can help you with various tasks like buying/selling tokens, swapping tokens, or providing information about your wallet. How can I assist you today?"
};

// Add this debugging function near the top of the component
const debugMessageStructure = (message: any) => {
  // Create a simplified version of the message to log
  const simplifiedMessage = {
    id: message.id,
    sender_id: message.sender_id,
    user: message.user ? {
      id: message.user.id,
      username: message.user.username
    } : undefined,
    sender: message.sender,
    content: message.content || message.text,
    is_deleted: message.is_deleted
  };

  // console.log('Message structure:', JSON.stringify(simplifiedMessage, null, 2));
  return message;
};

/**
 * ChatScreen component for displaying a chat interface with real post data
 */
function ChatScreen(): React.ReactElement {
  const dispatch = useAppDispatch();
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const route = useRoute<ChatScreenRouteProp>();

  // Extract chat parameters from route
  const { chatId = 'global', chatName = 'Global Community', isGroup = true } = route.params || {};

  // Set selected chat in Redux when entering
  useEffect(() => {
    // Set this chat as selected (to prevent increments of unread counts)
    dispatch(setSelectedChat(chatId));

    // Clear selected chat when leaving
    return () => {
      dispatch(setSelectedChat(null));
    };
  }, [dispatch, chatId]);

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // State for NFT drawer
  const [showNftDetailsDrawer, setShowNftDetailsDrawer] = useState(false);
  const [selectedNft, setSelectedNft] = useState<{
    mint: string;
    symbol: string;
    name: string;
    logoURI: string;
    nftData?: any;
  } | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // State for NFT buying
  const [nftLoading, setNftLoading] = useState(false);
  const [nftStatusMsg, setNftStatusMsg] = useState('');
  const [loadingFloor, setLoadingFloor] = useState(false);

  // State for message loading
  const [loading, setLoading] = useState(true);

  // Socket connection status
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Get user info and wallet 
  const { address, publicKey, sendTransaction } = useWallet();
  const auth = useAppSelector(state => state.auth);

  // Get chat messages from Redux
  const chatMessages = useAppSelector(state => state.chat.messages[chatId] || []);
  const isLoadingMessages = useAppSelector(state => state.chat.loadingMessages);
  const chatError = useAppSelector(state => state.chat.error);

  // Get posts from the thread reducer for global chat
  const allPosts = useAppSelector(state => state.thread.allPosts);
  const [globalMessages, setGlobalMessages] = useState<ThreadPost[]>([]);

  // Check if this is the AI Agent chat
  const isAIAgentChat = chatId === AI_AGENT.id;

  // Use the useChat hook for the AI agent chat
  const {
    messages: aiMessages,
    input: aiInput,
    setInput: setAiInput,
    handleSubmit: handleAiSubmit,
    sendMessage: sendAiMessage,
    isLoading: aiLoading,
    error: aiError,
    status: aiStatus,
    currentOperation: aiCurrentOperation,
  } = useChat({
    id: 'ai-agent', // Use a specific ID for the AI chat
    initialMessages: !isAIAgentChat ? [] : [{
      id: 'ai-init-msg',
      role: 'assistant',
      content: AI_AGENT.initialMessage,
      parts: [{ type: 'text', text: AI_AGENT.initialMessage }],
    }],
    // Since it's AI chat, we assume it doesn't exist in DB, so isExistingChat=false
    isExistingChat: false,
  });

  // State to manage the AI composer input (separate from the hook's internal input)
  const [composerInput, setComposerInput] = useState('');

  // Handle sending message specifically for AI chat
  const handleAiMessageSent = useCallback((content: string, imageUrl?: string) => {
    if (!address) {
      Alert.alert('Error', 'Wallet not connected. Cannot chat with AI.');
      return;
    }
    if (!content.trim() && !imageUrl) return;

    // Create a new message object in the format expected by useChat
    const newMessage: Message = {
      id: generateUUID(),
      content: content.trim(),
      role: 'user',
      parts: [{ type: 'text' as const, text: content.trim() }],
      // TODO: Handle image URLs if needed for AI chat in the future
      // experimental_attachments: imageUrl ? [{ contentType: 'image/png', url: imageUrl }] : [],
    };

    // Use the sendMessage function from the useChat hook
    sendAiMessage(newMessage);

    // Clear the composer input
    setComposerInput('');

  }, [address, sendAiMessage]);

  // Handle back button press
  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Format current user info for ChatComposer
  const currentUser: ThreadUser = {
    id: address || 'unknown-user',
    username: auth.username || 'Anonymous',
    handle: auth.username || 'anonymous',
    avatar: getValidImageSource(auth.profilePicUrl || DEFAULT_IMAGES.user),
    verified: false,
  };

  // Memoize the current user object to prevent recreation on each render
  const currentUserMemo = useMemo(() => ({
    id: address || '',
    username: auth.username || 'You',
    avatar: getValidImageSource(auth.profilePicUrl || DEFAULT_IMAGES.user)
  }), [address, auth.username, auth.profilePicUrl]);

  // Extract the avatar source for stable reference
  const currentUserAvatar = useMemo(() =>
    getValidImageSource(auth.profilePicUrl || DEFAULT_IMAGES.user),
    [auth.profilePicUrl]);

  // Connect to WebSocket with retry logic
  const connectToSocket = useCallback(async () => {
    // Skip for global chat and AI agent chat
    if (chatId === 'global' || chatId === AI_AGENT.id || !address) {
      return;
    }

    try {
      setIsRetrying(true);
      // Initialize socket for user
      const connected = await socketService.initSocket(address);

      if (connected) {
        // Join the chat room
        socketService.joinChat(chatId);
        console.log(`Successfully connected to chat ${chatId} via WebSocket`);
        setSocketConnected(true);
        setSocketError(null);
      } else {
        // Handle WebSocket connection failure
        console.warn('WebSocket connection failed, falling back to polling');
        setSocketConnected(false);
        setSocketError('Unable to establish real-time connection');
      }
    } catch (error: any) {
      console.error('WebSocket connection error:', error);
      setSocketConnected(false);
      setSocketError(error.message || 'Connection error');
    } finally {
      setIsRetrying(false);
    }
  }, [chatId, address]);

  // Connect to WebSocket
  useEffect(() => {
    // Skip for global chat since it uses posts
    if (chatId !== 'global' && chatId !== AI_AGENT.id && address) {
      // Set a flag to track initial connection
      let isInitialConnection = true;

      const connectAndJoinChat = async () => {
        try {
          // Connect to socket
          await connectToSocket();

          if (socketConnected) {
            // Explicitly leave and rejoin the chat to ensure clean state
            socketService.leaveChat(chatId);
            setTimeout(() => {
              socketService.joinChat(chatId);
              console.log(`Explicitly rejoined chat ${chatId}`);
            }, 300);
          }
        } catch (error) {
          console.error('Error connecting to socket:', error);
        } finally {
          isInitialConnection = false;
        }
      };

      connectAndJoinChat();

      // Set up a periodic check to ensure connection is maintained
      const connectionInterval = setInterval(() => {
        if (!socketConnected && address) {
          console.log('Connection check: attempting reconnect');
          connectAndJoinChat();
        }
      }, 10000); // Check every 10 seconds

      // Clean up when leaving the screen
      return () => {
        clearInterval(connectionInterval);
        // Note: We don't disconnect the socket when leaving
        // to maintain persistent connections with all chats
        if (socketConnected) {
          console.log(`Chat ${chatId} will still receive messages in the background`);
          // Don't leave the chat room as we want to keep receiving messages
          // Only explicitly leave rooms when user logs out
        }
      };
    }
  }, [chatId, address, connectToSocket, socketConnected]);

  // Fetch messages when entering the screen
  useEffect(() => {
    setLoading(true);

    if (chatId === 'global') {
      // For Global chat, fetch posts
      dispatch(fetchAllPosts())
        .then(() => setLoading(false))
        .catch(() => setLoading(false));
    } else if (chatId === AI_AGENT.id) {
      // For AI Agent chat, don't fetch messages from DB
      setLoading(false);
    } else if (address) {
      // For real chats, fetch messages
      dispatch(fetchChatMessages({
        chatId,
        resetUnread: true // Add parameter to indicate this chat should have unread count reset
      }))
        .then(() => setLoading(false))
        .catch(() => setLoading(false));
    }
  }, [dispatch, chatId, address]);

  // Process posts and convert to chat messages format for global chat
  useEffect(() => {
    if (chatId === 'global' && allPosts.length > 0) {
      // Filter out retweets and keep only original posts and comments
      const filteredPosts = allPosts.filter(post =>
        !post.retweetOf || (post.retweetOf && post.sections && post.sections.length > 0) // Keep quote retweets
      );

      // Sort by creation date for proper chat chronology
      const sortedPosts = [...filteredPosts].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      setGlobalMessages(sortedPosts);
    }
  }, [allPosts, chatId]);

  // Set up keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Conditionally choose the message sending function based on chat type
  const handleMessageSent = useCallback((content: string, imageUrl?: string) => {
    if (isAIAgentChat) {
      handleAiMessageSent(content, imageUrl);
    } else {
      // Original message sending logic for non-AI chats
      if (!address || (!content.trim() && !imageUrl)) return;

      if (chatId === 'global') {
        Alert.alert('Global Chat', 'Global chat messages are currently shown as posts. To create a post, use the Post button in the feed.');
        return;
      }

      const messagePayload = {
        chatId: chatId,
        chat_room_id: chatId,
        userId: address,
        senderId: address,
        sender_id: address,
        content: content.trim(),
        imageUrl: imageUrl,
        timestamp: new Date().toISOString(),
      };

      dispatch(sendReduxMessage({ // Use renamed Redux function
        chatId,
        userId: address,
        content: content.trim(),
        imageUrl: imageUrl,
      })).then((resultAction) => {
        if (sendReduxMessage.fulfilled.match(resultAction)) {
          console.log("Message sent successfully via API, payload:", resultAction.payload);
          if (socketConnected) {
            const socketPayload = {
              ...resultAction.payload,
              senderId: address,
              sender_id: address,
              chatId: chatId,
              chat_room_id: chatId
            };
            socketService.sendMessage(chatId, socketPayload);
          } else {
            dispatch(receiveMessage(resultAction.payload));
          }
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        } else if (sendReduxMessage.rejected.match(resultAction)) {
          console.error('Failed to send message:', resultAction.payload);
          Alert.alert('Error', 'Failed to send message. Please try again.');
        }
      });
    }
  }, [chatId, address, dispatch, isAIAgentChat, socketConnected, handleAiMessageSent]);

  // Modify the scroll to bottom effect
  useEffect(() => {
    if ((chatId === 'global' && globalMessages.length > 0) ||
      (chatId !== 'global' && !isAIAgentChat && chatMessages.length > 0) ||
      (isAIAgentChat && aiMessages.length > 0)) {
      // Use a longer timeout to ensure the list has fully rendered
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 500);
    }
  }, [globalMessages, chatMessages, aiMessages, chatId, isAIAgentChat]);

  // Handle retry for socket connection
  const handleRetryConnection = useCallback(() => {
    if (isRetrying) return;
    connectToSocket();
  }, [connectToSocket, isRetrying]);

  // Handle opening NFT details drawer
  const handleOpenNftDetails = useCallback((nftData: NFTData & { isCollection?: boolean, collId?: string }) => {
    setDrawerLoading(true);

    // Check if this is a collection or regular NFT
    const isCollection = nftData.isCollection === true && Boolean(nftData.collId);

    console.log('Opening NFT details drawer for:', {
      name: nftData.name,
      isCollection: isCollection,
      mintAddress: nftData.mintAddress,
      collId: nftData.collId
    });

    // Create the object with properly typed properties
    const drawerData: {
      mint: string;
      symbol: string;
      name: string;
      logoURI: string;
      nftData?: any;
      isCollection?: boolean;
    } = {
      mint: isCollection ? nftData.collId || '' : nftData.mintAddress || '',
      symbol: '',
      name: nftData.name || 'NFT',
      logoURI: nftData.image || '',
      isCollection: isCollection,
      nftData: {
        name: nftData.name,
        imageUri: nftData.image,
        description: nftData.description,
        collName: nftData.collectionName,
        isCollection: isCollection,
        collId: isCollection ? nftData.collId : undefined
      }
    };

    setSelectedNft(drawerData);

    // Short timeout to ensure smoother opening experience
    setTimeout(() => {
      setDrawerLoading(false);
      setShowNftDetailsDrawer(true);
    }, 300);
  }, []);

  // Handle buying an NFT
  const handleBuyNft = useCallback(async (mintAddress: string, owner?: string, priceSol?: number) => {
    if (!mintAddress) {
      Alert.alert('Error', 'No NFT mint address available.');
      return;
    }

    if (!publicKey || !address) {
      Alert.alert('Error', 'Wallet not connected.');
      return;
    }

    try {
      setNftLoading(true);
      setNftStatusMsg('Preparing buy transaction...');

      // Use estimated price if not provided
      const price = priceSol || 0.1;
      const ownerAddress = owner || "";

      const signature = await buyNft(
        address,
        mintAddress,
        price,
        ownerAddress,
        sendTransaction,
        status => setNftStatusMsg(status)
      );

      Alert.alert('Success', 'NFT purchased successfully!');

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
  }, [address, publicKey, sendTransaction]);

  // Handle buying a collection floor NFT
  const handleBuyCollectionFloor = useCallback(async (collId: string, collectionName?: string) => {
    if (!collId) {
      Alert.alert('Error', 'No collection ID available.');
      return;
    }

    if (!publicKey || !address) {
      Alert.alert('Error', 'Wallet not connected.');
      return;
    }

    try {
      setLoadingFloor(true);
      setNftLoading(true);
      setNftStatusMsg('Fetching collection floor...');

      const signature = await buyCollectionFloor(
        address,
        collId,
        sendTransaction,
        status => setNftStatusMsg(status)
      );

      Alert.alert(
        'Success',
        `Successfully purchased floor NFT from ${collectionName || 'collection'}!`
      );

      // Show success notification
      TransactionService.showSuccess(signature, 'nft');
    } catch (err: any) {
      console.error('Error during buy floor transaction:', err);
      TransactionService.showError(err);
    } finally {
      setNftLoading(false);
      setLoadingFloor(false);
      setNftStatusMsg('');
    }
  }, [address, publicKey, sendTransaction]);

  // Function to check if a post has NFT listing section
  const hasNftListingSection = (post: ThreadPost) => {
    if (post.sections) {
      return post.sections.some(section => section.type === 'NFT_LISTING' && section.listingData);
    }
    return false;
  };

  // Function to check if a post or message has trade data
  const hasTradeData = (message: any) => {
    // Check if it's in additional_data
    if (message.additional_data && message.additional_data.tradeData) {
      return true;
    }

    // Check if it's directly in the message
    if (message.tradeData) {
      return true;
    }

    // Check if it's in the sections (for ThreadPost)
    if (message.sections) {
      return message.sections.some((section: ThreadSection) =>
        section.type === 'TEXT_TRADE' && section.tradeData);
    }

    return false;
  };

  // Function to extract trade data from a message
  const getTradeDataFromMessage = (message: any): TradeData | null => {
    // Check if it's in additional_data
    if (message.additional_data && message.additional_data.tradeData) {
      return message.additional_data.tradeData;
    }

    // Check if it's directly in the message
    if (message.tradeData) {
      return message.tradeData;
    }

    // Check if it's in the sections (for ThreadPost)
    if (message.sections) {
      const tradeSection = message.sections.find((section: ThreadSection) =>
        section.type === 'TEXT_TRADE' && section.tradeData);

      if (tradeSection?.tradeData) {
        return tradeSection.tradeData;
      }
    }

    return null;
  };

  // Function to extract NFT data from post sections
  const getNftDataFromSections = (post: ThreadPost): NFTData | null => {
    if (post.sections) {
      const nftSection = post.sections.find(section =>
        section.type === 'NFT_LISTING' && section.listingData
      );

      if (nftSection?.listingData) {
        // Get the raw listing data without type conversion
        const listingData = nftSection.listingData as any; // Use 'any' temporarily for broader access

        // Explicitly check if this is a collection
        const isCollection = listingData.isCollection === true ||
          (listingData.collId != null && listingData.collId !== '');

        // Ensure collection ID is set if this is a collection
        const collId = isCollection ? (listingData.collId || listingData.mint || '') : '';

        console.log('[getNftDataFromSections] Raw listingData:', listingData);

        // Map the raw listing data to the enhanced NFTData interface
        const nftData: NFTData = {
          id: isCollection ? collId : listingData.mint || nftSection.id || 'unknown-nft',
          name: listingData.name || 'NFT',
          description: listingData.description || listingData.collectionDescription || '',
          image: listingData.image || listingData.collectionImage || '',
          collectionName: listingData.collectionName || '',
          mintAddress: isCollection ? undefined : listingData.mint || '', // Only set mintAddress if it's not a collection
          isCollection: isCollection,
          collId: isCollection ? collId : undefined,

          // NFT specific details (extract if available)
          owner: listingData.owner,
          rarityRankTN: listingData.rarityRankTN,
          numMints: listingData.numMints,
          attributes: listingData.attributes,
          listing: listingData.listing,
          lastSale: listingData.lastSale,

          // Collection specific details (extract if available)
          slugDisplay: listingData.slugDisplay,
          slugMe: listingData.slugMe,
          stats: listingData.stats,
          tokenCount: listingData.tokenCount,
          tensorVerified: listingData.tensorVerified,
          discord: listingData.discord,
          twitter: listingData.twitter,
          website: listingData.website,
        };

        console.log('[getNftDataFromSections] Mapped NFTData:', JSON.stringify(nftData, null, 2));
        return nftData;
      }
    }
    return null;
  };

  // Function to convert thread NftListingData to the module's NftListingData type
  const convertToNftListingData = (threadListingData: any): NftListingData => {
    return {
      ...threadListingData,
      owner: threadListingData.owner || undefined,
    };
  };

  // Use the memoized current user object in the displayMessages selector
  const displayMessages = useMemo(() => {
    // For AI Agent chat, return messages from useChat hook
    if (isAIAgentChat) {
      // Map AI SDK messages to the format ChatMessage expects
      return aiMessages.map((msg: Message) => ({
        id: msg.id,
        user: {
          id: msg.role === 'user' ? currentUserMemo.id : 'ai-agent',
          username: msg.role === 'user' ? currentUserMemo.username : 'AI Assistant',
          avatar: msg.role === 'user' ? currentUserAvatar : getValidImageSource(AI_AGENT.avatar || DEFAULT_IMAGES.user),
        },
        // Extract text content - handle potential non-string content if needed
        text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        // Use createdAt if available, otherwise use current time as fallback
        createdAt: msg.createdAt?.toISOString() || new Date().toISOString(),
        // Add other fields if needed, e.g., image_url, is_deleted
        image_url: undefined,
        is_deleted: false,
        // Pass parts for potential richer rendering later
        parts: msg.parts,
      }));
    }

    if (chatId === 'global') {
      return globalMessages;
    } else {
      // Convert chat messages to a format compatible with the message renderer
      return chatMessages.map(msg => ({
        id: msg.id,
        user: {
          id: msg.sender_id,
          username: msg.sender?.username || 'User',
          avatar: getValidImageSource(msg.sender?.profile_picture_url || DEFAULT_IMAGES.user),
        },
        text: msg.content,
        image_url: msg.image_url,
        createdAt: msg.created_at,
        is_deleted: msg.is_deleted,
        additional_data: msg.additional_data,
      }));
    }
  }, [isAIAgentChat, aiMessages, chatId, globalMessages, chatMessages, currentUserMemo, currentUserAvatar, AI_AGENT.avatar]);

  // Add state for message actions (edit/delete)
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null);
  const [showMessageActions, setShowMessageActions] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isEditingMessage, setIsEditingMessage] = useState(false);

  // Replace the handleMessageLongPress function with this improved version
  const [messageContextPosition, setMessageContextPosition] = useState({ x: 0, y: 0 });

  // Handle message long press with position tracking for context menu
  const handleMessageLongPress = useCallback((message: any, event: GestureResponderEvent) => {
    console.log('Long press handler called for message:', message.id);

    if (!message) {
      console.error('No message object provided to long press handler');
      return;
    }

    // Don't show actions for global chat or AI chat
    if (chatId === 'global' || chatId === AI_AGENT.id) {
      console.log('Cannot edit/delete messages in global or AI chat');
      return;
    }

    // Determine if this is the current user's message
    const isCurrentUser =
      (message.user?.id === address) ||
      (message.sender_id === address) ||
      (message.senderId === address);

    if (!isCurrentUser) {
      console.log('Cannot edit/delete messages from other users');
      console.log('Message user ID:', message.user?.id);
      console.log('Message sender ID:', message.sender_id || message.senderId);
      console.log('Current user ID:', address);
      return;
    }

    // Don't show actions for deleted messages
    if (message.is_deleted) {
      console.log('Cannot edit/delete already deleted messages');
      return;
    }

    // Position the context menu in a good location
    if (event && event.nativeEvent) {
      const { pageX, pageY } = event.nativeEvent;
      console.log('Touch position:', pageX, pageY);

      // Adjust position to make sure menu is visible
      const adjustedX = Math.min(pageX, Dimensions.get('window').width - 200);
      const adjustedY = Math.min(pageY, Dimensions.get('window').height - 150);

      setMessageContextPosition({
        x: adjustedX,
        y: adjustedY
      });
    } else {
      // Fallback to center position if no event data
      setMessageContextPosition({
        x: Dimensions.get('window').width / 2 - 100,
        y: Dimensions.get('window').height / 2 - 75
      });
    }

    // Set the selected message and show actions
    setSelectedMessage(message);
    setShowMessageActions(true);
    console.log('Message actions should now be visible for message:', message.id);
  }, [address, chatId]);

  // Handle edit message
  const handleEditMessage = useCallback(() => {
    setShowMessageActions(false);

    if (selectedMessage) {
      setEditedContent(selectedMessage.text || selectedMessage.content || '');
      setShowEditDrawer(true);
    }
  }, [selectedMessage]);

  // Handle save edited message
  const handleSaveEditedMessage = useCallback(() => {
    if (!selectedMessage || !address || !editedContent.trim()) {
      console.log('[handleSaveEditedMessage] Aborted: Missing selectedMessage, address, or content.');
      return;
    }

    setIsEditingMessage(true);
    console.log(`[handleSaveEditedMessage] Dispatching editMessage: messageId=${selectedMessage.id}, userId=${address}`);

    dispatch(editMessage({
      messageId: selectedMessage.id,
      userId: address,
      content: editedContent.trim()
    })).then((resultAction) => {
      console.log('[handleSaveEditedMessage] Result action:', resultAction);
      if (editMessage.fulfilled.match(resultAction)) {
        // Message edited successfully
        console.log("[handleSaveEditedMessage] Message edited successfully:", resultAction.payload);

        // If socket connected, emit message update (if socketService supports this)
        if (socketConnected && chatId !== 'global' && chatId !== AI_AGENT.id) {
          // Send a message to the socket if your service supports it
          // NOTE: The following line is commented out because socketService may not have sendEvent
          // Instead, we'll let the server update other clients via the REST API
          // socketService.emit('message_edited', { ... });
        }

        // Close the drawer
        setShowEditDrawer(false);
        setSelectedMessage(null);
        setEditedContent('');
      } else {
        console.error('[handleSaveEditedMessage] Failed to edit message:', resultAction.payload || resultAction.error);
        Alert.alert('Error', `Failed to edit message: ${resultAction.payload || resultAction.error?.message || 'Unknown error'}`);
      }
      setIsEditingMessage(false);
    });
  }, [selectedMessage, address, editedContent, dispatch, socketConnected, chatId]);

  // Handle delete message
  const handleDeleteMessage = useCallback(() => {
    setShowMessageActions(false);

    if (!selectedMessage || !address) {
      console.log('[handleDeleteMessage] Aborted: Missing selectedMessage or address.');
      return;
    }

    console.log(`[handleDeleteMessage] Showing confirmation for messageId=${selectedMessage.id}`);

    // Show confirmation dialog
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => console.log('[handleDeleteMessage] Delete cancelled')
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            console.log(`[handleDeleteMessage] Dispatching deleteMessage: messageId=${selectedMessage.id}, userId=${address}`);
            dispatch(deleteMessage({
              messageId: selectedMessage.id,
              userId: address
            })).then((resultAction) => {
              console.log('[handleDeleteMessage] Result action:', resultAction);
              if (deleteMessage.fulfilled.match(resultAction)) {
                // Message deleted successfully
                console.log("[handleDeleteMessage] Message deleted successfully");

                // If socket connected, we could notify other clients, but we'll let the server handle it
                // NOTE: The following lines are commented out because socketService may not have sendEvent
                // if (socketConnected && chatId !== 'global' && chatId !== AI_AGENT.id) {
                //   socketService.emit('message_deleted', { ... });
                // }

                setSelectedMessage(null);
              } else {
                console.error('[handleDeleteMessage] Failed to delete message:', resultAction.payload || resultAction.error);
                Alert.alert('Error', `Failed to delete message: ${resultAction.payload || resultAction.error?.message || 'Unknown error'}`);
              }
            });
          }
        }
      ]
    );
  }, [selectedMessage, address, dispatch, socketConnected, chatId]);

  // Update the renderMessage function to use the debug function
  const renderMessage = ({ item }: { item: any }) => {
    // Debug logging for message structure
    if (Math.random() < 0.1) {
      // Skip debug for AI messages for now, as format is different
      if (!isAIAgentChat) {
        debugMessageStructure(item);
      }
    }

    // Adjust isCurrentUser check for AI chat
    const isCurrentUser = isAIAgentChat
      ? item.user?.id === currentUser.id
      : (item.user?.id === currentUser.id || item.sender_id === address);

    // Show header only for the first message from a user in a sequence
    const index = displayMessages.findIndex((msg: any) => msg.id === item.id);
    const previousMessage = index > 0 ? displayMessages[index - 1] : null;

    // Show header if this is the first message or if previous message is from a different user
    const showHeader = !previousMessage || previousMessage.user?.id !== item.user?.id;

    // Check if this is a reply/comment to another post (only for global chat)
    const isReply = chatId === 'global' && item.parentId != null && item.parentId !== '';

    // Check if this message has NFT data (only for global chat)
    const isNftMessage = chatId === 'global' && hasNftListingSection(item as ThreadPost);

    // Check if this is a trade message
    const isTradeMessage = hasTradeData(item);

    // Handle Trade message rendering logic
    if (isTradeMessage) {
      const tradeData = getTradeDataFromMessage(item);

      if (tradeData) {
        // Conditionally attach onLongPress to the container view
        const longPressHandler = isCurrentUser && chatId !== 'global' && chatId !== AI_AGENT.id
          ? (e: GestureResponderEvent) => handleMessageLongPress(item, e)
          : undefined;

        return (
          <TouchableOpacity
            onLongPress={longPressHandler}
            activeOpacity={0.9} // Set activeOpacity to avoid visual feedback if no handler
            disabled={!longPressHandler} // Disable touchable if no handler
          >
            <View style={[
              styles.messageWrapper,
              isReply && styles.replyMessageWrapper
            ]}>
              {isReply && <View style={styles.replyIndicator} />}
              {showHeader && (
                <View style={additionalStyles.messageHeader}>
                  <View style={additionalStyles.avatarContainer}>
                    <IPFSAwareImage
                      source={getValidImageSource(item.user?.avatar || DEFAULT_IMAGES.user)}
                      style={additionalStyles.avatar}
                      defaultSource={DEFAULT_IMAGES.user}
                      key={`trade-avatar-${item.id}`}
                    />
                  </View>
                  <Text style={additionalStyles.username}>{item.user?.username || 'User'}</Text>
                </View>
              )}

              <MessageTradeCard
                tradeData={tradeData}
                isCurrentUser={isCurrentUser}
                userAvatar={item.user?.avatar || DEFAULT_IMAGES.user}
              />
            </View>
          </TouchableOpacity>
        );
      }
    }

    // Handle NFT message rendering logic
    if (isNftMessage && chatId === 'global') {
      // Get NFT data from the message
      const nftData = getNftDataFromSections(item as ThreadPost);

      if (nftData) {
        // Debug log to verify NFT data
        console.log('NFT Data passed to MessageNFT:', {
          id: nftData.id,
          name: nftData.name,
          mintAddress: nftData.mintAddress,
          isCollection: nftData.isCollection,
          collId: nftData.collId,
          // Add a few more fields to verify they are being passed
          owner: nftData.owner,
          stats: nftData.stats
        });

        return (
          <View style={[
            styles.messageWrapper,
            isReply && styles.replyMessageWrapper
          ]}>
            {isReply && <View style={styles.replyIndicator} />}
            {showHeader && (
              <View style={additionalStyles.messageHeader}>
                <View style={additionalStyles.avatarContainer}>
                  <IPFSAwareImage
                    source={getValidImageSource(item.user.avatar || DEFAULT_IMAGES.user)}
                    style={additionalStyles.avatar}
                    defaultSource={DEFAULT_IMAGES.user}
                    key={`nft-avatar-${item.id}`}
                  />
                </View>
                <Text style={additionalStyles.username}>{item.user.username}</Text>
              </View>
            )}

            <MessageNFT
              nftData={nftData}
              isCurrentUser={isCurrentUser}
              onPress={() => {
                console.log('NFT pressed, opening details drawer');
                handleOpenNftDetails(nftData);
              }}
            />
          </View>
        );
      }
    }

    // For regular messages, render ChatMessage and pass the onLongPress handler
    return (
      <View style={[
        styles.messageWrapper,
        isReply && styles.replyMessageWrapper,
      ]}>
        {isReply && <View style={styles.replyIndicator} />}

        {/* Render ChatMessage, passing down the long press handler */}
        <ChatMessage
          message={item}
          currentUser={currentUser}
          onPressMessage={(message) => {
            // Handle NFT message press (regular press is handled inside ChatMessage now)
            if (chatId === 'global' && hasNftListingSection(message as ThreadPost)) {
              const nftData = getNftDataFromSections(message as ThreadPost);
              if (nftData) {
                handleOpenNftDetails(nftData);
              }
            } else if (isAIAgentChat) {
              // Handle potential actions specific to AI messages in the future
              console.log('AI message pressed:', message);
            }
          }}
          // Pass the long press handler only for current user's messages 
          // in non-global/AI chats
          onLongPress={
            isCurrentUser && chatId !== 'global' // Allow long press for AI messages
              ? (e) => handleMessageLongPress(item, e)
              : undefined
          }
          showHeader={showHeader}
          showFooter={true}
        />
      </View>
    );
  };

  // Dismiss keyboard when tapping on the message list
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // Calculate members count for group chats
  const getMembersCount = () => {
    // This is just a mock for now - in a real app this would come from the server
    if (chatId === 'global') return '128 members';
    if (chatId === 'solana-devs') return '43 members';
    if (chatId === 'defi-group') return '67 members';
    return isGroup ? 'Group chat' : '';
  };

  // Render socket status indicator
  const renderSocketStatus = () => {
    if (chatId === 'global' || chatId === AI_AGENT.id) {
      return null; // No socket needed for these chats
    }

    if (socketConnected) {
      return (
        <View style={styles.socketStatusContainer}>
          <View style={[styles.statusIndicator, styles.connectedIndicator]} />
          <Text style={styles.socketStatusText}>Live</Text>
        </View>
      );
    }

    if (socketError) {
      return (
        <TouchableOpacity
          style={styles.socketStatusContainer}
          onPress={handleRetryConnection}
          disabled={isRetrying}
        >
          <View style={[styles.statusIndicator, styles.errorIndicator]} />
          <Text style={styles.socketErrorText}>
            {isRetrying ? 'Connecting...' : 'Offline'}
          </Text>
          {!isRetrying && (
            <Text style={styles.retryText}>Tap to retry</Text>
          )}
        </TouchableOpacity>
      );
    }

    return null;
  };

  // Function to render different chat content based on chat type
  const renderChatContent = () => {
    // For AI Agent chat, render the AgenticChatContainer
    if (isAIAgentChat) {
      return (
        <AgenticChatContainer
          messages={aiMessages}
          isLoading={aiLoading}
          error={aiError}
          status={aiStatus}
          currentOperation={aiCurrentOperation || "Processing your request..."}
          currentUser={currentUser}
          aiUser={{
            id: AI_AGENT.id,
            name: AI_AGENT.name,
            avatar: AI_AGENT.avatar,
          }}
          onSendMessage={handleAiMessageSent}
          inputValue={composerInput}
          setInputValue={setComposerInput}
        />
      );
    }

    // For loading states in regular chats
    if (loading || (isLoadingMessages && !isAIAgentChat)) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      );
    }

    // For error states in regular chats
    if (chatError && !isAIAgentChat) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{chatError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              dispatch(fetchChatMessages({ chatId }));
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Render the main content area (list or empty state) and the composer separately
    // This ensures the composer is always visible for non-AI/loading/error states.
    return (
      <>
        {/* Message Display Area */}
        <View style={{ flex: 1 }}>
          {displayMessages.length === 0 ? (
            // Empty state
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          ) : (
            // Message List
            <FlatList
              ref={flatListRef}
              data={displayMessages}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              contentContainerStyle={[
                styles.messagesContainer,
                { paddingBottom: 10 }
              ]}
              scrollEnabled={true}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={true}
              onLayout={() => {
                // Scroll to end when layout is complete
                flatListRef.current?.scrollToEnd({ animated: false });
              }}
            />
          )}
        </View>

        {/* Offline Banner (shown below messages/empty state, above composer) */}
        {!socketConnected && chatId !== 'global' && chatId !== AI_AGENT.id && socketError && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>
              Offline mode - Messages will send but you won't see new messages until you refresh
            </Text>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={() => {
                dispatch(fetchChatMessages({ chatId }));
                handleRetryConnection();
              }}
              disabled={isRetrying}
            >
              <Text style={styles.refreshButtonText}>
                {isRetrying ? 'Connecting...' : 'Refresh'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Chat Composer */}
        <View style={styles.composerContainer}>
          <ChatComposer
            currentUser={currentUser}
            onMessageSent={handleMessageSent}
            chatContext={{ chatId: chatId }}
            disabled={false} // Ensure composer is not disabled by default
          />
          {/* Removed spacer completely to eliminate gap */}
        </View>
      </>
    );
  };

  return (
    <>
      {Platform.OS === 'android' && <View style={androidStyles.statusBarPlaceholder} />}
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        {/* Decorative background elements */}
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
        <LinearGradient
          colors={['rgba(50, 212, 222, 0.05)', 'transparent']}
          style={styles.glow1}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Replace custom header with AppHeader component */}
        <AppHeader
          title={chatName}
          onBackPress={handleBack}
          showBottomGradient={false}
          style={{
            backgroundColor: 'transparent',
            borderBottomWidth: 0,
          }}
          rightComponent={
            isGroup ? (
              <View style={styles.titleContainer}>
                <Text style={styles.subtitleText}>{getMembersCount()}</Text>
              </View>
            ) : undefined
          }
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0} // Significantly reduced offset to decrease gap
          style={styles.keyboardAvoidingContainer}>

          <View style={[styles.innerContainer, { justifyContent: undefined }]}>
            {/* Render appropriate chat content based on chat type */}
            {renderChatContent()}
          </View>

        </KeyboardAvoidingView>

        {/* Message Actions Modal */}
        {showMessageActions && (
          <>
            <TouchableWithoutFeedback onPress={() => setShowMessageActions(false)}>
              <View style={messageActionStyles.overlay} />
            </TouchableWithoutFeedback>

            <View
              style={[
                messageActionStyles.popup,
                {
                  top: messageContextPosition.y,
                  left: messageContextPosition.x,
                }
              ]}
            >
              {/* Edit Action - No Icon */}
              <TouchableOpacity
                style={messageActionStyles.actionItem}
                onPress={handleEditMessage}
              >
                <Text style={[messageActionStyles.actionText, { marginLeft: 0 }]}>Edit Message</Text>
              </TouchableOpacity>

              <View style={messageActionStyles.actionDivider} />

              {/* Delete Action - No Icon */}
              <TouchableOpacity
                style={messageActionStyles.actionItem}
                onPress={handleDeleteMessage}
              >
                <Text style={[messageActionStyles.actionTextDelete, { marginLeft: 0 }]}>Delete Message</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Edit Message Drawer */}
        {showEditDrawer && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1100
            }}
          >
            <View style={[styles.editDrawer, { paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.editDrawerHeader}>
                <Text style={styles.editDrawerTitle}>Edit Message</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowEditDrawer(false)}
                >
                  {/* Use simple 'X' text as close icon */}
                  <Text style={{ color: COLORS.greyMid, fontSize: 18, fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Only show edit controls if NOT AI Chat */}
              {!isAIAgentChat && (
                <>
                  <TextInput
                    style={styles.editInput}
                    value={editedContent}
                    onChangeText={setEditedContent}
                    multiline
                    placeholder="Edit your message..."
                    placeholderTextColor={COLORS.greyMid}
                    autoFocus
                    selectionColor={COLORS.brandBlue}
                    keyboardAppearance="dark"
                  />

                  <View style={styles.editButtons}>
                    <TouchableOpacity
                      style={styles.editCancelButton}
                      onPress={() => setShowEditDrawer(false)}
                      disabled={isEditingMessage}
                    >
                      <Text style={[styles.buttonText, { color: COLORS.greyMid }]}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.editSaveButton,
                        (!editedContent.trim() || isEditingMessage) && { opacity: 0.5 }
                      ]}
                      onPress={handleSaveEditedMessage}
                      disabled={!editedContent.trim() || isEditingMessage}
                    >
                      <Text style={styles.buttonText}>
                        {isEditingMessage ? 'Saving...' : 'Save Changes'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        )}

        {/* NFT Details Drawer */}
        {selectedNft && (
          <TokenDetailsDrawer
            visible={showNftDetailsDrawer}
            onClose={() => setShowNftDetailsDrawer(false)}
            tokenMint={selectedNft.mint || ''}
            initialData={{
              ...selectedNft,
              isCollection: selectedNft.nftData?.isCollection || false
            }}
            loading={drawerLoading}
          />
        )}
      </SafeAreaView>
    </>
  );
}

export default ChatScreen;
