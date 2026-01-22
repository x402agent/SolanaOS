import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, Image, Animated, Easing, ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { agenticChatStyles as styles } from './agentic-chat.styles';
import COLORS from '@/assets/colors';

interface AgenticChatMessageProps {
  content: string;
  isLoading?: boolean;
  isAI?: boolean;
  avatar: ImageSourcePropType;
  name: string;
  currentOperation?: string;
  error?: string | null;
  timestamp?: Date | string;
  isLastMessage?: boolean;
}

/**
 * Formats text with markdown-like formatting for bold and italic
 */
const FormattedText = ({ text, style }: { text: string, style?: any }) => {
  // Format patterns like **bold** and *italic*
  const boldPattern = /\*\*(.*?)\*\*/g;
  const italicPattern = /\*(.*?)\*/g;
  
  // Process the text to find patterns
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  // Process bold patterns
  const boldMatches = [...text.matchAll(boldPattern)];
  for (const match of boldMatches) {
    if (match.index !== undefined) {
      // Add regular text before the match
      if (match.index > lastIndex) {
        parts.push(
          <Text key={`reg-${lastIndex}-${match.index}`}>
            {text.substring(lastIndex, match.index)}
          </Text>
        );
      }
      
      // Add the bold text
      parts.push(
        <Text key={`bold-${match.index}`} style={styles.boldText}>
          {match[1]}
        </Text>
      );
      
      lastIndex = match.index + match[0].length;
    }
  }
  
  // Add any remaining text
  if (lastIndex < text.length) {
    parts.push(
      <Text key={`reg-${lastIndex}-end`}>
        {text.substring(lastIndex)}
      </Text>
    );
  }
  
  // If no formatting was found, just return the text
  if (parts.length === 0) {
    return <Text style={style}>{text}</Text>;
  }
  
  return <Text style={style}>{parts}</Text>;
};

/**
 * Formats a timestamp into a readable format
 */
const formatTime = (timestamp: Date | string | undefined): string => {
  if (!timestamp) return '';
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Component for rendering AI or user messages in the agentic chat UI
 * Includes a special loading state with animated dots for AI responses
 */
const AgenticChatMessage: React.FC<AgenticChatMessageProps> = ({
  content,
  isLoading = false,
  isAI = true,
  avatar,
  name,
  currentOperation,
  error,
  timestamp,
  isLastMessage = false,
}) => {
  // Fade in animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Animation values for the loading dots
  const dot1Anim = useRef(new Animated.Value(0.4)).current;
  const dot2Anim = useRef(new Animated.Value(0.7)).current;
  const dot3Anim = useRef(new Animated.Value(1)).current;

  // Set up appearance animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Set up the typing animation
  useEffect(() => {
    if (isLoading) {
      const animateDots = () => {
        // Reset dots to starting opacity
        dot1Anim.setValue(0.4);
        dot2Anim.setValue(0.7);
        dot3Anim.setValue(1);
        
        // Sequence the dot animations
        Animated.sequence([
          // First dot animation
          Animated.timing(dot1Anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          // Second dot animation
          Animated.timing(dot2Anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          // Third dot animation
          Animated.timing(dot3Anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          // Pause at the end
          Animated.delay(200),
        ]).start(() => {
          // Loop the animation
          animateDots();
        });
      };
      
      animateDots();
      
      return () => {
        dot1Anim.stopAnimation();
        dot2Anim.stopAnimation();
        dot3Anim.stopAnimation();
      };
    }
  }, [isLoading]);

  // If there's an error, render the error message
  if (error) {
    return (
      <Animated.View 
        style={[styles.errorContainer, { opacity: fadeAnim }]}
      >
        <Text style={styles.errorText}>{error}</Text>
      </Animated.View>
    );
  }

  // If this is a loading state for AI message, show the elegant typing indicator
  if (isLoading && isAI) {
    return (
      <Animated.View 
        style={[
          styles.messageContainer,
          styles.systemMessage,
          { opacity: fadeAnim }
        ]}
      >
        <View style={styles.typingMessageBubble}>
          <View style={styles.typingHeader}>
            <Ionicons name="logo-electron" size={16} color={COLORS.brandBlue} style={styles.typingIcon} />
            <Text style={styles.typingHeaderText}>{name}</Text>
          </View>
          
          <View style={styles.typingContent}>
            <Text style={styles.typingMessage}>
              {currentOperation || "Processing your request..."}
            </Text>
            
            <View style={styles.typingDotsContainer}>
              <Animated.View style={[styles.typingDot, { opacity: dot1Anim }]} />
              <Animated.View style={[styles.typingDot, { opacity: dot2Anim }]} />
              <Animated.View style={[styles.typingDot, { opacity: dot3Anim }]} />
            </View>
          </View>
        </View>
      </Animated.View>
    );
  }

  // Determine gradient colors based on sender
  const gradientColors = isAI 
    ? ['#2A2A2A', '#303030'] as const
    : [COLORS.brandBlue, '#2AABB3'] as const;
  
  // Determine container styles
  const containerStyle = [
    styles.messageContainer,
    isAI ? styles.systemMessage : styles.userMessage,
  ];

  // Determine bubble styles
  const bubbleStyleArray = [
    styles.messageBubble,
    isAI ? styles.aiMessageBubble : styles.userMessageBubble,
    isLastMessage && !isAI && styles.lastUserMessage,
  ];

  return (
    <Animated.View style={[containerStyle, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={gradientColors}
        style={bubbleStyleArray}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {isAI && (
          <View style={styles.typingHeader}>
            <Image source={avatar} style={styles.aiAvatar} />
            <Text style={styles.typingHeaderText}>{name}</Text>
          </View>
        )}
        
        <FormattedText text={content} style={styles.messageText} />
        
        <Text style={styles.timestampText}>
          {formatTime(timestamp || new Date())}
        </Text>
      </LinearGradient>
    </Animated.View>
  );
};

export default AgenticChatMessage; 