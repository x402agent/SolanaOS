import { StyleSheet } from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

// Styles for the wallet screen
export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  balanceContainer: {
    marginBottom: 24,
    backgroundColor: COLORS.lightBackground,
    borderRadius: 12,
    padding: 16,
  },
  balanceLabel: {
    color: COLORS.greyDark,
    fontSize: 14,
    fontWeight: '500',
  },
  balanceValue: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: '700',
    marginTop: 8,
  },
  addressContainer: {
    marginBottom: 24,
  },
  addressLabel: {
    color: COLORS.greyDark,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  addressCard: {
    backgroundColor: COLORS.lightBackground,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addressValue: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  addressActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qrIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.lighterBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.lighterBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: COLORS.brandGreen,
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionsContainer: {
    marginBottom: 24,
  },
  actionsLabel: {
    color: COLORS.greyDark,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  actionButton: {
    backgroundColor: COLORS.lightBackground,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  actionSubtext: {
    color: COLORS.greyDark,
    fontSize: 14,
  },
  // New styles for enhanced MoonPay integration
  actionBadge: {
    backgroundColor: 'rgba(50, 212, 222, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  actionBadgeText: {
    color: COLORS.brandPrimary,
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  // Add Funds Icon styles
  addFundsIconWrapper: {
    position: 'relative',
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIconContainer: {
    position: 'absolute',
    top: -4,
    right: -6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIcon: {
    color: COLORS.brandBlue,
    fontSize: 12,
    fontWeight: TYPOGRAPHY.weights.bold,
    lineHeight: 14,
    textAlign: 'center',
  },
  plusOverlayContainer: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    elevation: 2,
    shadowColor: COLORS.background,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  transactionHistoryCard: {
    backgroundColor: COLORS.lightBackground,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  transactionHistoryTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weights.semiBold,
    marginBottom: 12,
  },
  transactionHistoryContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  transactionHistoryEmpty: {
    color: COLORS.greyMid,
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
  },
  
  // Loading state styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  skeletonContainer: {
    flex: 1,
    padding: 16,
  },
  loadingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.lighterBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonCopyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.lighterBackground,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.6,
  },
  loadingTextContainer: {
    marginTop: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: COLORS.greyDark,
    fontSize: 16,
    fontWeight: '500',
  },
  loadingDotsContainer: {
    flexDirection: 'row',
    marginTop: 12,
    justifyContent: 'center',
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.brandBlue,
  },
  
  // Error state styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.lighterBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  errorBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.errorRed,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  errorBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  errorTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  errorText: {
    color: COLORS.greyDark,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: COLORS.brandBlue,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  retryText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  legalLinksContainer: {
    marginTop: 24,
    backgroundColor: COLORS.lightBackground,
    borderRadius: 12,
  },
  legalLinkButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  legalLinkText: {
    fontSize: 16,
    color: COLORS.white,
    fontFamily: 'Inter-Medium',
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.borderDarkColor,
    marginHorizontal: 16,
  },
});

export default styles; 