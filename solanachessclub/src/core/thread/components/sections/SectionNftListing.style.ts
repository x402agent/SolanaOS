import {StyleSheet} from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

export default StyleSheet.create({
  container: {
    marginTop: 8,
    padding: 10,
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 8,
  },
  collectionDescription: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.greyMid,
    marginTop: 4,
    marginBottom: 4,
  },
  card: {
    flexDirection: 'column',
    backgroundColor: COLORS.lightBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    overflow: 'hidden',
    alignItems: 'center',
    padding: 8,
  },
  imageContainer: {
    width: 200,
    height: 200,
    backgroundColor: COLORS.darkerBackground,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: COLORS.greyMid,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  infoSection: {
    marginTop: 12,
    alignItems: 'center',
    width: '90%',
  },
  nftTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    color: COLORS.white,
    marginBottom: 4,
  },
  collectionName: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.greyMid,
    marginBottom: 4,
  },
  priceText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.greyMid,
    marginTop: 2,
  },
  lastSale: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.greyDark,
    marginTop: 2,
  },
  rarityInfo: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily,
    color: COLORS.greyDark,
    marginTop: 2,
  },
});
