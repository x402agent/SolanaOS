import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ImageSourcePropType,
  TextInput,
  TouchableOpacity,
  Text,
  Animated,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { agenticChatStyles as styles } from './agentic-chat.styles';
import AgenticChatMessage from './AgenticChatMessage';
import { ChatComposer } from '../chat-composer';
import { ThreadUser } from '@/core/thread/types';
import { Message } from 'ai';
import { DEFAULT_IMAGES } from '@/config/constants';
import COLORS from '@/assets/colors';

const { height } = Dimensions.get('window');

export interface AgenticChatContainerProps {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  status?: string;
  currentOperation?: string;
  currentUser: ThreadUser;
  aiUser: {
    id: string;
    name: string;
    avatar: ImageSourcePropType;
  };
  onSendMessage: (content: string, imageUrl?: string) => void;
  inputValue?: string;
  setInputValue?: (value: string) => void;
}

/**
 * Container component for agentic chat that manages the message list and loading states
 */
const AgenticChatContainer: React.FC<AgenticChatContainerProps> = ({
  messages,
  isLoading,
  error,
  status,
  currentOperation,
  currentUser,
  aiUser,
  onSendMessage,
  inputValue = '',
  setInputValue,
}) => {
  // Reference to the FlatList component for scrolling
  const flatListRef = useRef<FlatList>(null);

  // Local input state if not provided
  const [localInputValue, setLocalInputValue] = useState('');
  const inputText = setInputValue ? inputValue : localInputValue;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Memoize essential user data to prevent recreation on each render
  const memoizedAiUser = useMemo(() => ({
    avatar: aiUser.avatar,
    name: aiUser.name
  }), [aiUser.avatar, aiUser.name]);

  const memoizedCurrentUser = useMemo(() => ({
    avatar: currentUser.avatar,
    username: currentUser.username
  }), [currentUser.avatar, currentUser.username]);

  // Process messages into a format suitable for rendering with timestamps
  const processedMessages = useMemo(() => {
    return messages.map((msg, index) => ({
      id: msg.id,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      isAI: msg.role === 'assistant',
      avatar: msg.role === 'assistant' ? memoizedAiUser.avatar : memoizedCurrentUser.avatar,
      name: msg.role === 'assistant' ? memoizedAiUser.name : memoizedCurrentUser.username,
      timestamp: msg.createdAt || new Date(),
      isLastMessage: index === messages.length - 1
    }));
  }, [messages, memoizedAiUser, memoizedCurrentUser]);

  // Add typing indicator if AI is loading
  const displayMessages = useMemo(() => {
    if (isLoading && processedMessages.length > 0) {
      // Create a temporary loading message for the AI thinking state
      return [
        ...processedMessages,
        {
          id: 'loading-indicator',
          content: '',
          isAI: true,
          avatar: aiUser.avatar,
          name: aiUser.name,
          isLoading: true,
          timestamp: new Date()
        }
      ];
    }
    return processedMessages;
  }, [processedMessages, isLoading, aiUser]);

  // Animate screen appearance
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (flatListRef.current && displayMessages.length > 0) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [displayMessages]);

  // Dismiss keyboard when tapping outside the input
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // Handle sending messages
  const handleSendMessage = () => {
    if (inputText.trim().length === 0 || isLoading) return;

    onSendMessage(inputText);

    if (!setInputValue) {
      setLocalInputValue('');
    }
  };

  // Update input text
  const updateInputText = (text: string) => {
    if (setInputValue) {
      setInputValue(text);
    } else {
      setLocalInputValue(text);
    }
  };

  // Render a message item in the list
  const renderMessageItem = ({ item, index }: { item: any, index: number }) => {
    return (
      <AgenticChatMessage
        content={item.content}
        isLoading={item.isLoading}
        isAI={item.isAI}
        avatar={item.avatar}
        name={item.name}
        currentOperation={item.isLoading ? currentOperation : undefined}
        error={item.id === 'error' ? error : undefined}
        timestamp={item.timestamp}
        isLastMessage={item.isLastMessage || index === displayMessages.length - 1}
      />
    );
  };

  // Add an error message if there is one
  useEffect(() => {
    if (error && !displayMessages.some(msg => msg.id === 'error')) {
      console.error('AI Chat Error:', error);
    }
  }, [error, displayMessages]);

  // Empty list component
  const EmptyListComponent = () => (
    <Animated.View
      style={[
        styles.emptyContainer,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}
    >
      <Ionicons name="chatbubble-ellipses-outline" size={60} color="rgba(255, 255, 255, 0.5)" />
      <Text style={styles.emptyText}>
        Start a conversation with the AI Assistant
      </Text>
      <Text style={styles.emptySubtext}>
        Ask questions about Solana, create transactions, or manage your assets
      </Text>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.container}>
        {/* Message list - takes up entire container space */}
        <View style={{ flex: 1, width: '100%' }}>
          <FlatList
            ref={flatListRef}
            data={displayMessages}
            renderItem={renderMessageItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messageListContainer}
            showsVerticalScrollIndicator={true}
            initialNumToRender={10}
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={10}
            windowSize={10}
            onContentSizeChange={() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: true });
              }
            }}
            onLayout={() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: false });
              }
            }}
            ListEmptyComponent={EmptyListComponent}
            scrollEnabled={true}
          />
        </View>

        {/* Input container positioned absolutely */}
        <TouchableWithoutFeedback onPress={dismissKeyboard}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Message AI Assistant..."
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={inputText}
              onChangeText={updateInputText}
              multiline
              maxLength={1000}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (inputText.trim().length === 0 || isLoading) && styles.disabledButton
              ]}
              onPress={handleSendMessage}
              disabled={inputText.trim().length === 0 || isLoading}
            >
              <LinearGradient
                colors={[COLORS.brandBlue, '#2AABB3'] as const}
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: 20
                }}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="send" size={18} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </KeyboardAvoidingView>
  );
};

export default AgenticChatContainer; 