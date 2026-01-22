import { StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

// Define common types to be used
type FlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse';
type FlexAlign = 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
type FlexJustify = 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
type Overflow = 'visible' | 'hidden' | 'scroll';

export function getMessageBaseStyles() {
  return StyleSheet.create({
    messageContainer: {
      marginBottom: 8,
      marginHorizontal: 12,
      maxWidth: '85%',
    },
    currentUserMessageContainer: {
      alignSelf: 'flex-end',
    },
    otherUserMessageContainer: {
      alignSelf: 'flex-start',
    },
    // Header styles
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
      paddingHorizontal: 4,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      marginRight: 10,
      borderWidth: 2,
      borderColor: 'rgba(50, 212, 222, 0.3)',
    },
    username: {
      fontSize: TYPOGRAPHY.size.md,
      fontWeight: '700',
      color: COLORS.white,
      fontFamily: TYPOGRAPHY.fontFamily,
    },
    userInfoContainer: {
      flexDirection: 'column',
    },
    headerTimestamp: {
      fontSize: 11,
      color: COLORS.greyMid,
      marginTop: 2,
      fontFamily: TYPOGRAPHY.fontFamily,
    },
    // Footer styles
    footerContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginTop: 4,
    },
    timestamp: {
      fontSize: 10,
      color: COLORS.greyMid,
      fontFamily: TYPOGRAPHY.fontFamily,
    },
    currentUserTimestamp: {
      color: 'rgba(255, 255, 255, 0.7)',
    },
    readStatus: {
      marginLeft: 4,
    },
  });
}

export const messageBubbleStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginVertical: 2,
    maxWidth: '100%',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  currentUser: {
    backgroundColor: COLORS.brandBlue,
    borderBottomRightRadius: 6,
    alignSelf: 'flex-end',
    minWidth: 80,
    shadowColor: COLORS.brandBlue,
    shadowOpacity: 0.3,
  },
  otherUser: {
    backgroundColor: COLORS.lighterBackground,
    borderBottomLeftRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  text: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily,
    lineHeight: 20,
    fontWeight: '400',
  },
  currentUserText: {
    textAlign: 'left',
    color: COLORS.white,
  },
  otherUserText: {
    color: COLORS.white,
  },
  timestamp: {
    fontSize: 10,
    color: COLORS.greyMid,
    marginTop: 4,
    alignSelf: 'flex-end',
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  sectionContainer: {
    marginTop: 8,
    width: '100%',
  },
  messageContent: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  imageContainer: {
    marginTop: 8,
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  messageImage: {
    width: 260,
    height: 200,
    borderRadius: 16,
  },
  imageCaption: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontFamily,
    lineHeight: 18,
  },
  retweetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  retweetText: {
    fontSize: 12,
    color: COLORS.greyMid,
    marginLeft: 6,
    fontWeight: '500',
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  // Media container styles
  mediaContainer: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mediaImage: {
    width: 240,
    height: 180,
    borderRadius: 12,
    marginBottom: 4,
  },
  // Retweet styles
  retweetContainer: {
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  quoteContent: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  originalPostContainer: {
    backgroundColor: COLORS.darkerBackground,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  originalPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  originalPostAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  originalPostUsername: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: '600',
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  originalPostHandle: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.greyMid,
    marginTop: 2,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
});

export const messageHeaderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 4,
    width: '100%',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'rgba(50, 212, 222, 0.2)',
    shadowColor: COLORS.brandBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  userInfoContainer: {
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  username: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: '700',
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontFamily,
    flexShrink: 1,
  },
  headerTimestamp: {
    fontSize: 11,
    color: COLORS.greyMid,
    marginTop: 2,
    fontFamily: TYPOGRAPHY.fontFamily,
    flexShrink: 1,
  },
});

export const messageFooterStyles = StyleSheet.create<{
  container: ViewStyle;
  timestamp: TextStyle;
  currentUserTimestamp: TextStyle;
  readStatus: ViewStyle;
}>({
  container: getMessageBaseStyles().footerContainer as ViewStyle,
  timestamp: getMessageBaseStyles().timestamp as TextStyle,
  currentUserTimestamp: getMessageBaseStyles().currentUserTimestamp as TextStyle,
  readStatus: getMessageBaseStyles().readStatus as ViewStyle,
}); 