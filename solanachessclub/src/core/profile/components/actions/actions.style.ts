import { StyleSheet, Platform } from 'react-native';
import COLORS from '../../../../assets/colors';
import TYPOGRAPHY from '../../../../assets/typography';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.darkerBackground,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.darkerBackground,
  },
  // Section header styles for transaction groups
  sectionHeader: {
    backgroundColor: COLORS.darkerBackground,
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginTop: 8,
  },
  sectionHeaderText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: '600',
    letterSpacing: TYPOGRAPHY.letterSpacing,
    color: COLORS.greyMid,
  },
  emptyStateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.brandBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.brandBlue,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  emptyText: {
    marginTop: 8,
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.lg,
    color: COLORS.greyMid,
    fontWeight: '500',
    letterSpacing: TYPOGRAPHY.letterSpacing,
    textAlign: 'center',
  },
  errorText: {
    marginTop: 12,
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.lg,
    color: COLORS.errorRed,
    fontWeight: '500',
    letterSpacing: TYPOGRAPHY.letterSpacing,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.brandBlue,
    borderRadius: 8,
  },
  retryButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: '600',
    letterSpacing: TYPOGRAPHY.letterSpacing,
    color: COLORS.white,
  },
  refreshButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.brandBlue,
    borderRadius: 8,
  },
  refreshButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: '600',
    letterSpacing: TYPOGRAPHY.letterSpacing,
    color: COLORS.white,
  },
  card: {
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 12,
    marginVertical: 6,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0,0,0,0.15)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  txInfo: {
    flex: 1,
    marginRight: 8,
  },
  description: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: '600',
    letterSpacing: TYPOGRAPHY.letterSpacing,
    color: COLORS.white,
    marginBottom: 4,
  },
  timeAgo: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.xs,
    letterSpacing: TYPOGRAPHY.letterSpacing,
    color: COLORS.accessoryDarkColor,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: '600',
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  symbol: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.xs,
    letterSpacing: TYPOGRAPHY.letterSpacing,
    color: COLORS.accessoryDarkColor,
    marginTop: 2,
  },
}); 