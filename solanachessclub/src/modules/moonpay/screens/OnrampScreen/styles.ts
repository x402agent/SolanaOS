import { StyleSheet } from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  scrollContainer: {
    paddingBottom: 24,
  },
  infoCard: {
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.weights.semiBold,
    color: COLORS.white,
    marginBottom: 12,
  },
  infoText: {
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.greyLight,
    lineHeight: TYPOGRAPHY.lineHeight.md,
    marginBottom: 16,
  },
  widgetWrapper: {
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
    marginBottom: 24,
  },
  walletInfoContainer: {
    backgroundColor: COLORS.darkerBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  walletInfoLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
    color: COLORS.greyMid,
    marginBottom: 6,
  },
  walletAddress: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weights.semiBold,
    color: COLORS.white,
  },
  walletInfoText: {
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.greyLight,
  },
  featuresList: {
    marginTop: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureIconText: {
    fontSize: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weights.semiBold,
    color: COLORS.white,
    marginBottom: 4,
  },
  featureText: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.greyLight,
    lineHeight: TYPOGRAPHY.lineHeight.sm,
  },
}); 