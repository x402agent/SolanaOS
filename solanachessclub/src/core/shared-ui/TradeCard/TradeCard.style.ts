import {StyleSheet} from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

// Define the theme object
const theme = {
  '--thread-bg-secondary': '#F5F5F5',
  '--thread-text-primary': '#333333',
};

export const styles = StyleSheet.create({
  /* TradeCard */
  tradeCardContainer: {
    width: '100%',
    backgroundColor: COLORS.lightBackground,
    borderRadius: 16,
    padding: 12,
    overflow: 'hidden',
  },

  tradeCardCombinedSides: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
  },

  tradeCardLeftSide: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  tradeCardTokenImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
  },

  tradeCardNamePriceContainer: {
    flexDirection: 'column',
  },

  tradeCardTokenName: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
    marginBottom: 2,
    color: COLORS.white,
  },

  tradeCardTokenPrice: {
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.accessoryDarkColor,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
  },

  tradeCardRightSide: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  tradeCardSolPrice: {
    color: '#00C851', // Keep green for positive values
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
  },

  tradeCardUsdPrice: {
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    marginTop: 2,
  },

  tradeCardSwapIcon: {
    backgroundColor: COLORS.background,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: '50%',
    top: '50%',
    borderWidth: 8,
    borderColor: COLORS.background,
    zIndex: 10,
    transform: [{ translateX: -15 }, { translateY: -15 }],
  },

  // Chart and time controls
  chartContainer: {
    width: '100%',
    height: 130,
    marginVertical: 6,
    marginTop: 30,
    overflow: 'visible',
  },
  
  timeframeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
  },
  
  timeframeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  
  timeframeButtonActive: {
    backgroundColor: COLORS.brandBlue,
  },
  
  timeframeButtonText: {
    color: COLORS.accessoryDarkColor,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    fontSize: TYPOGRAPHY.size.md,
  },
  
  timeframeButtonTextActive: {
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
  },
  
  refreshButton: {
    marginLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  refreshText: {
    color: COLORS.brandPrimary,
    marginLeft: 4,
    fontSize: TYPOGRAPHY.size.xs,
  },
  
  priceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  
  priceLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.accessoryDarkColor,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
  },
  
  priceValue: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
  },
  
  priceDifference: {
    marginLeft: 4,
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
  },
  
  priceDifferencePositive: {
    color: '#00C851', // Keep green for positive values
  },
  
  priceDifferenceNegative: {
    color: COLORS.errorRed,
  },
  
  priceDifferenceTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  
  priceDifferenceTagPositive: {
    backgroundColor: 'rgba(0, 200, 81, 0.1)',
  },
  
  priceDifferenceTagNegative: {
    backgroundColor: 'rgba(224, 36, 94, 0.1)',
  },
  
  noChartData: {
    width: '100%',
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  
  noChartDataText: {
    color: COLORS.accessoryDarkColor,
    marginTop: 6,
    fontSize: TYPOGRAPHY.size.sm,
  },
  
  errorText: {
    color: COLORS.errorRed,
    marginTop: 6,
    fontSize: TYPOGRAPHY.size.sm,
  },

  // Token stats
  tokenStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },

  positiveValue: {
    color: COLORS.brandGreen, // Keep green for positive values
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
  },

  tokenSubtitle: {
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.accessoryDarkColor,
  }
});

export default styles;
