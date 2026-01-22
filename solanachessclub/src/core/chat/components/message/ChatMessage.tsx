import React, { useMemo } from 'react';
import { View, Pressable, GestureResponderEvent, Text, TextStyle } from 'react-native';
import { ChatMessageProps } from './message.types';
import { getMessageBaseStyles } from './message.styles';
import { mergeStyles } from '@/core/thread/utils';
import MessageBubble from './MessageBubble';
import MessageHeader from './MessageHeader';

// Update ChatMessageProps to include onLongPress
interface ExtendedChatMessageProps extends ChatMessageProps {
  onLongPress?: (event: GestureResponderEvent) => void; // Optional long press handler
}

/**
 * Formats a timestamp into a readable format
 */
const formatTime = (timestamp: Date | string | undefined): string => {
  if (!timestamp) return '';
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function ChatMessage({
  message,
  currentUser,
  onPressMessage,
  onLongPress, // Receive the onLongPress prop
  themeOverrides,
  styleOverrides,
  showHeader = true,
  showFooter = false, // Change default to false since we're showing timestamp in the bubble
}: ExtendedChatMessageProps) {
  // Determine if this message is from the current user
  const isCurrentUser = useMemo(() => {
    // Check multiple properties for sender ID consistency
    return (
      message.user.id === currentUser.id ||
      ('sender_id' in message && message.sender_id === currentUser.id) ||
      ('senderId' in message && message.senderId === currentUser.id)
    );
  }, [message, currentUser.id]);

  // Get base styles
  const baseStyles = getMessageBaseStyles();

  // Use utility function to merge styles
  const styles = mergeStyles(
    baseStyles,
    styleOverrides,
    undefined
  );

  // Determine container style based on sender
  const containerStyle = [
    styles.messageContainer,
    isCurrentUser
      ? styles.currentUserMessageContainer
      : styles.otherUserMessageContainer
  ];

  // Determine content type
  const getContentType = () => {
    // If message has explicit contentType, use it
    if ('contentType' in message && message.contentType) {
      return message.contentType;
    }

    // Determine from message data
    if ('tradeData' in message && message.tradeData) {
      return 'trade';
    } else if ('nftData' in message && message.nftData) {
      return 'nft';
    } else if ('media' in message && message.media && message.media.length > 0) {
      return 'media';
    } else if ('sections' in message) {
      // Check for images in thread post sections using any to avoid TypeScript errors
      const sections = message.sections as any[];
      const hasMedia = sections.some(section =>
        section.image ||
        (section.media && section.media.length > 0) ||
        section.mediaSrc
      );

      if (hasMedia) return 'media';
    }

    // Default to text
    return 'text';
  };

  const contentType = getContentType();

  // Determine if we should show header and footer based on content type
  const shouldShowHeader = useMemo(() => {
    // Always show header for other users' messages if showHeader is true
    if (!isCurrentUser && showHeader) {
      return true;
    }
    return false;
  }, [isCurrentUser, showHeader]);

  // For special content types like NFTs and trades, we might want to show footer
  const shouldShowFooter = useMemo(() => {
    if (!showFooter) return false;

    // For NFT and trade messages, don't show footer
    if (contentType === 'trade' || contentType === 'nft') {
      return false;
    }

    return true;
  }, [showFooter, contentType]);

  // Get timestamp from different message types
  const timestamp = 'createdAt' in message ? message.createdAt : new Date();

  // Get font family from text style if available
  const fontFamily = styleOverrides?.text && (styleOverrides.text as TextStyle).fontFamily;

  // Extend MessageBubble props to include timestamp
  const messageBubbleProps = {
    message,
    isCurrentUser,
    themeOverrides,
    styleOverrides: {
      ...styleOverrides,

      // Only add padding at the bottom for current user's messages
      container: {
        ...(isCurrentUser && { paddingBottom: 22 }),
        ...(styleOverrides?.container || {})
      }
    }
  };

  return (
    <View style={{ marginBottom: 8, marginHorizontal: 12 }}>
      {/* Header takes full width available */}
      {shouldShowHeader && (
        <View style={{ width: '100%', marginBottom: 6 }}>
          <MessageHeader
            message={message}
            showAvatar={true}
            onPressUser={user => console.log('User pressed:', user.id)}
          />
        </View>
      )}

      {/* Message bubble with width constraints */}
      <View style={[
        {
          maxWidth: '85%',
        },
        isCurrentUser
          ? { alignSelf: 'flex-end' }
          : { alignSelf: 'flex-start' }
      ]}>
        {/* Use Pressable for better touch handling */}
        <Pressable
          onPress={() => onPressMessage && onPressMessage(message)}
          onLongPress={onLongPress} // Use the passed onLongPress handler
          delayLongPress={500} // Consistent delay
          disabled={!onPressMessage && !onLongPress} // Disable if no handlers
          style={({ pressed }) => [{
            // Allow text messages to fit their content with small max width
            maxWidth: contentType === 'text' ? '75%' : contentType === 'media' ? '80%' : '100%',
            opacity: pressed ? 0.7 : 1,
            // Align the message bubble properly based on user
            alignSelf: isCurrentUser ? 'flex-end' : 'flex-start',
          }]}
        >
          <View style={{ position: 'relative' }}>
            <MessageBubble
              {...messageBubbleProps}
            />

            {/* Timestamp inside the message bubble - Only for current user */}
            {isCurrentUser && (
              <Text style={{
                position: 'absolute',
                bottom: 6,
                right: 10,
                fontSize: 10,
                color: 'rgba(255, 255, 255, 0.6)',
                fontFamily: fontFamily,
                paddingTop: 2,
                paddingRight: 2,
              }}>
                {formatTime(timestamp)}
              </Text>
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

export default ChatMessage; 