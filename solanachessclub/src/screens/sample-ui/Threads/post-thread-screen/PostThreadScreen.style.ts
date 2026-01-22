import {StyleSheet} from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderDarkColor,
    backgroundColor: COLORS.background,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.lighterBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 18,
    color: COLORS.brandBlue,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  
  // Main thread container
  threadContainer: {
    backgroundColor: COLORS.background,
  },
  
  // Thread post item (Twitter-like layout)
  threadPostContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderDarkColor,
    backgroundColor: COLORS.background,
  },
  
  // Main post (the one being viewed) gets special treatment
  mainPostContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: COLORS.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderDarkColor,
  },
  
  // Avatar column
  avatarColumn: {
    width: 40,
    alignItems: 'flex-start',
    marginRight: 12,
    paddingTop: 2,
  },
  
  // For main post, larger avatar
  mainAvatarColumn: {
    width: 48,
    alignItems: 'flex-start',
    marginRight: 12,
    paddingTop: 2,
  },
  
  // Thread line for main posts and replies - simplified approach
  threadLine: {
    position: 'absolute',
    left: 36, // 16px padding + 20px (center of 40px avatar)
    top: 42, // Start below avatar (2px paddingTop + 40px avatar height)
    bottom: 0,
    width: 2,
    backgroundColor: COLORS.borderDarkColor,
  },
  
  // Thread line that starts from avatar center (for connecting posts)
  threadLineFromCenter: {
    position: 'absolute',
    left: 36, // 16px padding + 20px (center of 40px avatar)
    top: 22, // Start from center of avatar (2px paddingTop + 20px half avatar)
    bottom: 0,
    width: 2,
    backgroundColor: COLORS.borderDarkColor,
  },
  
  // Hide thread line for last item
  threadLineHidden: {
    opacity: 0,
  },
  
  // Content column
  contentColumn: {
    flex: 1,
    minWidth: 0,
  },
  
  // Main post content gets special treatment
  mainContentColumn: {
    flex: 1,
    minWidth: 0,
  },
  
  // Avatar styling
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  
  // Main post avatar is larger
  mainAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  
  // Reply section
  repliesSection: {
    marginTop: 12,
  },
  
  repliesHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderDarkColor,
  },
  
  repliesLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    color: COLORS.greyMid,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  
  repliesCount: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.greyMid,
    marginLeft: 8,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  
  // Reply item styling
  replyContainer: {
    backgroundColor: COLORS.background,
  },
  
  // Show more replies button
  showMoreReplies: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderDarkColor,
  },
  
  showMoreText: {
    color: COLORS.brandBlue,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  
  // Composer container
  composerContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.borderDarkColor,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
  },
  
  // Loading and error states
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  
  notFoundText: {
    fontSize: TYPOGRAPHY.size.lg,
    color: COLORS.greyMid,
    fontFamily: TYPOGRAPHY.fontFamily,
    textAlign: 'center',
    lineHeight: 24,
  },
  
  // Retweet styling
  retweetIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  
  retweetText: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.greyMid,
    marginLeft: 6,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  
  // Quote retweet styling
  quoteContent: {
    marginBottom: 12,
  },
  
  quoteText: {
    fontSize: 15,
    color: COLORS.white,
    lineHeight: 20,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  
  originalPostContainer: {
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    borderRadius: 12,
    backgroundColor: COLORS.lighterBackground,
    padding: 12,
    marginTop: 8,
  },
  
  // Animation styles
  dimOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 1,
  },
  
  composerElevated: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  
  // Main post stats (for important posts)
  mainPostStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.borderDarkColor,
  },
  
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  
  statNumber: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  
  statLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.greyMid,
    marginLeft: 4,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  
  // Thread hierarchy indicators
  threadDepthIndicator: {
    width: 3,
    backgroundColor: COLORS.brandBlue,
    borderRadius: 1.5,
    marginRight: 8,
  },
  
  // Connection line from parent to child
  connectionLine: {
    position: 'absolute',
    left: 20,
    top: -12,
    width: 2,
    height: 14,
    backgroundColor: COLORS.borderDarkColor,
  },
});

