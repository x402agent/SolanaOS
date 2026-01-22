import { StyleSheet } from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

export const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  webView: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  loadingContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.darkerBackground,
    borderRadius: 12,
    padding: 20,
  },
  loadingText: {
    color: COLORS.white,
    marginTop: 16,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weights.medium,
    textAlign: 'center',
  },
  loadingSubtext: {
    color: COLORS.greyMid,
    marginTop: 8,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weights.regular,
    textAlign: 'center',
  },
  loaderWrapper: {
    height: 70,
    width: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 35,
    backgroundColor: COLORS.lightBackground,
    marginBottom: 16,
    shadowColor: COLORS.brandBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  errorContainer: {
    width: '100%',
    padding: 24,
    backgroundColor: COLORS.darkerBackground,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(224, 36, 94, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    color: COLORS.errorRed,
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weights.semiBold,
    marginBottom: 8,
  },
  errorText: {
    color: COLORS.greyLight,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.size.md,
    lineHeight: TYPOGRAPHY.lineHeight.md,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: COLORS.brandBlue,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  webViewWrapper: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
    height: '100%',
  }
}); 