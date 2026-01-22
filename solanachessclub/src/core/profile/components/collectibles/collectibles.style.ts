import {StyleSheet} from 'react-native';
import COLORS from '../../../../assets/colors';
import TYPOGRAPHY from '../../../../assets/typography';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 6,
  },
  nftItem: {
    width: '48%',
    aspectRatio: 1,
    marginBottom: 14,
  },
  image: {
    width: '100%',
    height: '85%',
    borderRadius: 8,
    backgroundColor: COLORS.greyLight,
  },
  nftName: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.xs, 
    marginTop: 4,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.lg,
    color: COLORS.greyDark,
    textAlign: 'center',
    marginTop: 40,
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.accessoryDarkColor,
    textAlign: 'center',
    marginTop: 40,
  },
  errorText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.errorRed,
    textAlign: 'center',
    marginTop: 40,
  },
});

// Portfolio styles - previously in collectibles.tsx
export const portfolioStyles = StyleSheet.create({
  // Main container styles
  scrollContainer: {
    flex: 1,
    backgroundColor: COLORS.darkerBackground,
  },
  scrollContent: {
    paddingBottom: 20,
    backgroundColor: COLORS.darkerBackground,
  },

  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingHorizontal: 12,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    marginHorizontal: 12,
    marginTop: 12,
    elevation: 1,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  tabText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.accessoryDarkColor,
    fontWeight: '500',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.brandBlue,
  },
  activeTabText: {
    color: COLORS.brandBlue,
    fontWeight: '600',
  },
  badgeContainer: {
    backgroundColor: COLORS.brandBlue,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  badgeText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.white,
  },

  // Token list styles
  tokenListItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: COLORS.darkerBackground,
  },
  tokenLogoContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    backgroundColor: COLORS.greyLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenLogo: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  tokenLogoPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.greyBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenLogoPlaceholderText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: 'bold',
    color: COLORS.accessoryDarkColor,
  },
  tokenDetails: {
    flex: 1,
    marginLeft: 14,
  },
  tokenName: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: '500',
    color: COLORS.white,
    marginBottom: 2,
  },
  tokenSymbol: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.accessoryDarkColor,
  },
  tokenBalanceContainer: {
    alignItems: 'flex-end',
  },
  tokenBalance: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: '500',
    color: COLORS.greyMid,
  },
  tokenValue: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.brandBlue,
    marginTop: 2,
  },
  listContainer: {
    backgroundColor: COLORS.darkerBackground,
    borderRadius: 12,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    marginHorizontal: 12,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.lightBackground,
    marginLeft: 60,
  },

  // Section styles
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: '500',
    marginHorizontal: 16,
    marginBottom: 12,
    color: COLORS.greyMid,
  },
  gridContainer: {
    paddingHorizontal: 12,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },

  // Item styles
  itemContainer: {
    marginBottom: 16,
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 12,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    overflow: 'hidden',
    margin: 6,
  },
  imageContainer: {
    height: 150,
    width: '100%',
    position: 'relative',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.greyLight,
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  fallbackImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.2,
  },
  image: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.greyLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  placeholderText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.xxl,
    fontWeight: 'bold',
    color: COLORS.greyMid,
  },

  // Badges
  compressedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 171, 228, 0.8)', // COLORS.brandBlue with opacity
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compressedText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  priceBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priceText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: 'bold',
    color: COLORS.white,
  },

  // Item details
  itemDetails: {
    padding: 8,
    backgroundColor: COLORS.lighterBackground,
  },
  itemName: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: '600',
    color: COLORS.white,
    marginBottom: 4,
  },
  itemBalance: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.greyMid,
  },
  itemCollection: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.greyMid,
  },

  // SOL Balance
  solBalanceContainer: {
    margin: 16,
    backgroundColor: COLORS.lightBackground,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  solLogoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  solLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.lighterBackground,
  },
  solTextContainer: {
    flex: 1,
  },
  solBalanceLabel: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.greyMid,
    marginBottom: 4,
  },
  solBalanceValue: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.xxl,
    fontWeight: '600',
    color: COLORS.white,
  },

  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: COLORS.darkerBackground,
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.lg,
    marginTop: 16,
    color: COLORS.accessoryDarkColor,
    textAlign: 'center',
  },

  // Error state
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: COLORS.darkerBackground,
  },
  errorText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.lg,
    color: COLORS.errorRed,
    textAlign: 'center',
    marginBottom: 16,
  },

  // Empty states
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: COLORS.darkerBackground,
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.lg,
    color: COLORS.accessoryDarkColor,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptySection: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.darkerBackground,
  },
  emptyTabContent: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.darkerBackground,
  },
  emptyTabText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.lg,
    color: COLORS.accessoryDarkColor,
    textAlign: 'center',
  },

  // Buttons
  retryButton: {
    backgroundColor: COLORS.brandBlue,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 10,
  },
  retryText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontWeight: '600',
    color: COLORS.white,
  },
  viewAllButton: {
    backgroundColor: COLORS.lighterBackground,
    padding: 12,
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewAllText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: '600',
    color: COLORS.brandBlue,
  },
});
