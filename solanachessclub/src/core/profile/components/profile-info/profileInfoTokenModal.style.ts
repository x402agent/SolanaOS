// File: src/components/Profile/ProfileInfo/profileInfoTokenModal.style.ts
import {StyleSheet} from 'react-native';
import COLORS from '../../../../assets/colors';
import TYPOGRAPHY from '../../../../assets/typography';

export const tokenModalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '80%',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  closeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.darkerBackground,
  },
  closeButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  loadingText: {
    marginTop: 8,
    color: COLORS.greyMid,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.sm,
  },
  errorText: {
    marginTop: 8,
    color: COLORS.errorRed,
    textAlign: 'center',
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.size.sm,
  },
  descriptionLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginBottom: 4,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    color: COLORS.white,
    backgroundColor: COLORS.lighterBackground,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily,
    textAlignVertical: 'top',
    minHeight: 60,
  },
  listContainer: {
    marginTop: 6,
  },
  tokenItem: {
    borderRadius: 8,
    backgroundColor: COLORS.lighterBackground,
    padding: 10,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  tokenItemImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 8,
    backgroundColor: COLORS.darkerBackground,
  },
  tokenInfo: {
    flex: 1,
    marginLeft: 8,
  },
  tokenName: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    marginBottom: 2,
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  tokenMint: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.greyMid,
    marginBottom: 2,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  tokenBalance: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.greyDark,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  emptyText: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.greyDark,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  // Styles for action buttons at the bottom
  actionButtonContainer: {
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'flex-end', // Align buttons to the right
  },
  actionButton: {
    paddingHorizontal: 20, // More horizontal padding
    paddingVertical: 10,  // Slightly more vertical padding
    borderRadius: 8,
    marginLeft: 8, // Space between buttons
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80, // Ensure buttons have a minimum width
  },
  cancelButton: {
    backgroundColor: COLORS.lighterBackground, // Less prominent background
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  saveButton: {
    backgroundColor: COLORS.brandPrimary, // Primary action color
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
});
