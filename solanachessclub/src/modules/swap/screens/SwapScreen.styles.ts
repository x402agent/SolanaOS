import { StyleSheet, Dimensions, Platform } from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

const { width, height } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    flex: 1,
    paddingBottom: 80, // Safe area for bottom navigation
    marginTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: String(TYPOGRAPHY.bold) as any,
    flex: 1,
    textAlign: 'center',
  },
  providerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  providerButton: {
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flex: 1,
    marginHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  providerButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: String(TYPOGRAPHY.medium) as any,
  },
  poolAddressContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: COLORS.lightBackground,
    borderRadius: 12,
    padding: 12,
  },
  poolAddressLabel: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: String(TYPOGRAPHY.medium) as any,
    marginBottom: 8,
  },
  poolAddressInput: {
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 8,
    padding: 12,
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md,
  },
  swapContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: COLORS.lightBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    position: 'relative', // For proper positioning of the swap button
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: COLORS.lighterBackground,
    padding: 12,
  },
  tokenIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  tokenInfo: {
    flex: 1,
    marginRight: 8,
  },
  tokenSymbol: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: String(TYPOGRAPHY.bold) as any,
  },
  tokenBalance: {
    color: COLORS.greyMid,
    fontSize: TYPOGRAPHY.size.xs,
    marginTop: 2,
  },
  valueContainer: {
    alignItems: 'flex-end',
    maxWidth: width * 0.35, // Prevent overflow by limiting width
  },
  valueLabel: {
    color: COLORS.greyMid,
    fontSize: TYPOGRAPHY.size.xs,
    marginBottom: 2,
  },
  tokenValue: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.xxl, // Reduced from xxxl
    fontWeight: String(TYPOGRAPHY.bold) as any,
  },
  fiatValue: {
    color: COLORS.greyMid,
    fontSize: TYPOGRAPHY.size.xs,
  },
  swapButton: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: COLORS.lightBackground,
    elevation: 5,
    top: '50%',
    marginTop: -16, // Half of height to center
  },
  receiveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiveLabel: {
    color: COLORS.greyMid,
    fontSize: TYPOGRAPHY.size.xs,
    marginBottom: 4,
  },
  receiveValue: {
    color: COLORS.brandPrimary,
    fontSize: TYPOGRAPHY.size.lg, // Reduced from xl
    fontWeight: String(TYPOGRAPHY.bold) as any,
  },
  keypadContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderColor: COLORS.borderDarkColor,
    position: 'absolute',
    bottom: 130, // Position above swap button with gap
    left: 0,
    right: 0,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10, // Reduced from 20
  },
  keypadButton: {
    width: (width - 80) / 3, // Smaller buttons
    height: 50, // Reduced from 60
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
  },
  keypadButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.xxl, // Reduced from xxl
    fontWeight: String(TYPOGRAPHY.medium) as any,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  swapActionButton: {
    backgroundColor: COLORS.white,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 70,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  swapActionButtonText: {
    color: COLORS.background,
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: String(TYPOGRAPHY.bold) as any,
  },
  maxButtonContainer: {
    alignSelf: 'flex-end',
    marginTop: 4,
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  maxButtonText: {
    color: COLORS.background,
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: String(TYPOGRAPHY.bold) as any,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    paddingHorizontal: 20,
  },
  statusText: {
    color: COLORS.brandPrimary,
    marginLeft: 8,
    fontSize: TYPOGRAPHY.size.sm,
  },
  errorContainer: {
    marginVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: `${COLORS.errorRed}20`,
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 20,
  },
  errorText: {
    color: COLORS.errorRed,
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
  },
  swapInfoContainer: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 200, // Added extra space for keypad
    backgroundColor: COLORS.lightBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  swapInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  swapInfoLabel: {
    color: COLORS.greyMid,
    fontSize: TYPOGRAPHY.size.sm,
  },
  swapInfoValue: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: String(TYPOGRAPHY.medium) as any,
    flexShrink: 1,
    textAlign: 'right',
  },
  slippageButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  slippageButton: {
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: (width - 80) / 4, // 4 buttons per row with spacing
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  slippageButtonActive: {
    backgroundColor: COLORS.brandPrimary + '20', // 20% opacity
    borderColor: COLORS.brandPrimary,
  },
  slippageButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: String(TYPOGRAPHY.medium) as any,
  },
  slippageButtonTextActive: {
    color: COLORS.brandPrimary,
    fontWeight: String(TYPOGRAPHY.bold) as any,
  },
  pumpSwapWarningContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: COLORS.errorRed + '15', // Slight red tint with low opacity
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.errorRed,
  },
  pumpSwapWarningText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.xs,
    lineHeight: 16,
  },
  fullWidthScroll: {
    width: '100%',
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    backgroundColor: COLORS.background,
    borderBottomWidth: 0, // Remove border since we're using gradient
    position: 'relative', // For proper positioning of the gradient
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leftPlaceholder: {
    width: 36, // Same width as profileContainer in Thread.tsx for balance
  },
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: -1,
  },
  titleText: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    color: COLORS.white,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    paddingHorizontal: 4,
    marginLeft: 8,
  },
  headerBottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 50,
    zIndex: -2,
  },
  percentageButtonsContainer: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    marginTop: 4,
    justifyContent: 'space-between',
    width: '100%',
  },
  percentageButton: {
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageButtonText: {
    color: COLORS.background,
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: String(TYPOGRAPHY.bold) as any,
  },
  clearButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.errorRed,
  },
  clearButtonText: {
    color: COLORS.errorRed,
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: String(TYPOGRAPHY.bold) as any,
  },
}); 