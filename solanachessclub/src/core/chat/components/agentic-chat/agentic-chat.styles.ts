import { StyleSheet, Dimensions } from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

const { width } = Dimensions.get('window');

export const agenticChatStyles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  
  // Message list container
  messageListContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100, // Increase padding to ensure no content is hidden behind composer
    minHeight: '100%', 
    flexGrow: 1,
  },
  
  // Loading indicator styles
  loadingContainer: {
    alignSelf: 'flex-start',
    maxWidth: '90%',
    marginVertical: 8,
    marginHorizontal: 6,
  },
  typingMessageBubble: {
    backgroundColor: '#2A2A2A',
    padding: 16,
    borderRadius: 18,
    maxWidth: '100%',
    shadowColor: COLORS.brandBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(50, 212, 222, 0.3)',
  },
  typingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    opacity: 0.9,
  },
  typingHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.brandBlue,
    marginLeft: 6,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  typingIcon: {
    marginRight: 4,
  },
  typingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingMessage: {
    color: COLORS.white,
    fontSize: 16,
    lineHeight: 22,
    marginRight: 10,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  typingDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  typingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.brandBlue,
    marginHorizontal: 2,
  },
  
  // Message container styles
  messageContainer: {
    marginVertical: 6,
    maxWidth: '90%',
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  systemMessage: {
    alignSelf: 'flex-start',
  },
  
  // Message bubble styles
  messageBubble: {
    padding: 16,
    borderRadius: 18,
    minHeight: 40,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  aiMessageBubble: {
    backgroundColor: '#2A2A2A',
    borderBottomLeftRadius: 4,
  },
  userMessageBubble: {
    borderBottomRightRadius: 4,
  },
  lastUserMessage: {
    borderBottomRightRadius: 4, // Pointy edge on last user message
  },
  
  // Message text styles
  messageText: {
    color: COLORS.white,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  
  // Timestamp styles
  timestampText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  
  // Avatar styles
  aiAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  
  // Error message styles
  errorContainer: {
    alignSelf: 'flex-start',
    maxWidth: '80%',
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1,
    borderColor: COLORS.errorRed,
  },
  errorText: {
    color: COLORS.errorRed,
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  
  // Empty container styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    height: 400,
  },
  emptyText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  emptySubtext: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  
  // Text formatting
  boldText: {
    fontWeight: 'bold',
  },
  italicText: {
    fontStyle: 'italic',
  },
  
  // Input container
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.background, // Use solid background color instead of semi-transparent
    marginBottom: 0,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10, // Higher z-index to ensure it's above all content
    elevation: 5, // Add elevation for Android
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: 'rgba(45, 45, 45, 0.6)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    marginRight: 10,
    color: COLORS.white,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  sendButton: {
    height: 40,
    width: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.brandBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  
  // Special data display
  structuredMessageContainer: {
    maxWidth: '95%',
    width: width * 0.95,
  },
  structuredMessageBubble: {
    width: '100%',
    padding: 16,
  },
}); 