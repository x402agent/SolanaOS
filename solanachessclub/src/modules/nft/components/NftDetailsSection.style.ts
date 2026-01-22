import { StyleSheet } from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

export default StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 4,
  },
  card: {
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.darkerBackground,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.darkerBackground,
  },
  placeholderText: {
    color: COLORS.greyMid,
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  infoSection: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  nftTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    color: COLORS.white,
    marginBottom: 6,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  collectionName: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.greyMid,
    marginBottom: 4,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  priceText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    color: COLORS.brandGreen,
    marginBottom: 4,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  lastSale: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.greyMid,
    marginBottom: 4,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  rarityInfo: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.greyMid,
    marginBottom: 2,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  collectionDescription: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.greyMid,
    marginBottom: 6,
    lineHeight: TYPOGRAPHY.lineHeight.xs,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
}); 