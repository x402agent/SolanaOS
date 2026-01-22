import {StyleSheet} from 'react-native';
import COLORS from '../../../../assets/colors';

export const styles = StyleSheet.create({
  tabView: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabContent: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  centered: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.greyDark,
  },
  postList: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  postCard: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,

    // iOS shadow
    shadowColor: COLORS.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 4,
    // Android elevation
    elevation: 2,
  },
  
  // Twitter-like post layout
  postItemContainer: {
    flexDirection: 'row',
  },
  
  avatarColumn: {
    width: 40,
    alignItems: 'flex-start',
    marginRight: 12,
    paddingTop: 2,
  },
  
  contentColumn: {
    flex: 1,
    minWidth: 0,
  },
  
  // Avatar styling
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  
  replyLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
    borderRadius: 6,
    backgroundColor: COLORS.darkerBackground, // Consider adding this to colors.ts
    color: '#2B8EF0', // Consider adding this to colors.ts
    fontSize: 12,
    fontWeight: '600',
  },
});

export const tabBarStyles = StyleSheet.create({
  gradientContainer: {
    // Container to hold both the TabBar and the gradient
    backgroundColor: COLORS.background,
  },
  tabBarContainer: {
    backgroundColor: 'transparent',
    height: 50,
    // Removed elevation, border, and shadow properties
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'none',
    color: COLORS.white, // Use activeColor directly here as default
  },
  indicator: {
    backgroundColor: COLORS.brandBlue,
    height: 3,
    borderRadius: 2,
    marginBottom: -1,
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 50, // Adjust height for desired gradient size
    zIndex: -1, // Ensure it's behind the TabBar content
  },
});

// Active/inactive colors remain outside StyleSheet as they are direct values used in the component
export const tabBarActiveColor = COLORS.white;
export const tabBarInactiveColor = COLORS.greyMid;

// Retweet specific styles
export const retweetStyles = StyleSheet.create({
  retweetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingLeft: 6,
    paddingTop: 4,
  },
  retweetHeaderText: {
    fontSize: 13,
    color: '#657786', // Consider adding this to colors.ts
    marginLeft: 6,
    fontWeight: '500',
  },
  retweetedContent: {
    marginTop: 4,
    width: '100%',
  },
  originalPostContainer: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: COLORS.lighterBackground,
    padding: 10,
  },
  retweetIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingLeft: 6,
  },
  retweetLabel: {
    fontSize: 12,
    color: '#657786', // Consider adding this to colors.ts
    marginLeft: 4,
    fontWeight: '500',
  },
  retweetedPostContainer: {
    marginTop: 8,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  quoteContent: {
    marginBottom: 8,
  },
  quoteText: {
    fontSize: 12,
    color: '#657786', // Consider adding this to colors.ts
  },
}); 