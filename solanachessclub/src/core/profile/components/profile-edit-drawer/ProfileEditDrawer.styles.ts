import { StyleSheet, Dimensions, Platform } from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

const { width, height } = Dimensions.get('window');

// Define explicit colors without checking COLORS
const SUCCESS_GREEN = '#27AE60';
const ERROR_RED = '#EB5757';

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Slightly darker overlay
  },
  drawerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.lighterBackground, // Use dark theme color
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: height * 0.85, // Use height instead of maxHeight for consistency
    paddingBottom: Platform.OS === 'ios' ? 34 : 24, // Adjust padding for safe areas if needed
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: -5, // Increase shadow offset slightly
    },
    shadowOpacity: 0.15, // Adjust shadow opacity
    shadowRadius: 5,
    elevation: 10,
    overflow: 'hidden', // Ensure content respects border radius
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDarkColor, // Dark border
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold), // Use helper
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontFamily,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10, // Add margin to prevent text collision with buttons
  },
  backButton: {
    padding: 8, // Increase touch area
    minWidth: 40, // Ensure minimum touch target size
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium), // Adjust weight
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  saveButton: {
    padding: 8, // Increase touch area
    minWidth: 50, // Ensure minimum touch target size
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: COLORS.brandPrimary, // Use primary brand color
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  scrollContent: {
    flex: 1, // Allow scrollview to take available space
  },
  imageSection: {
    alignItems: 'center',
    marginVertical: 24, // Adjusted margin
  },
  imageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: COLORS.lightBackground, // Placeholder background
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  profileImage: {
    width: '100%', // Use 100% to fill container
    height: '100%',
  },
  editPictureText: {
    color: COLORS.brandPrimary,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    fontFamily: TYPOGRAPHY.fontFamily,
    marginTop: 8,
  },
  // --- Inline Avatar Options ---
  avatarOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 10,
    width: '100%',
    paddingHorizontal: 20,
  },
  avatarOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.darkerBackground,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    minWidth: 130,
    elevation: 1,
    shadowColor: COLORS.lightBackground,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarOptionButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  avatarOptionText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  // --- Input Sections ---
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.size.sm, // Slightly smaller label
    color: COLORS.accessoryDarkColor,
    marginBottom: 8,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.regular),
    fontFamily: TYPOGRAPHY.fontFamily,
    textTransform: 'uppercase', // Uppercase label
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: COLORS.lightBackground, // Dark input background
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor, // Subtle border
  },
  disabledInput: {
    opacity: 0.6,
    color: COLORS.accessoryDarkColor,
  },
  bioInput: {
    minHeight: 100, // Use minHeight
    textAlignVertical: 'top',
    paddingTop: 14, // Match paddingVertical
  },

  // --- NFT List / Confirm Views Container ---
  viewContainer: {
    flex: 1,
    backgroundColor: COLORS.lighterBackground, // Match drawer background
  },
  viewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10, // Reduced horizontal padding for header
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDarkColor,
  },
  viewHeaderButton: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewHeaderButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  viewHeaderTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontFamily,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 5,
  },

  // --- NFT List Specific Styles ---
  nftListContainer: {
    flex: 1, // Take full height within the drawer when active
  },
  centeredMessageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.accessoryDarkColor,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily,
    textAlign: 'center',
  },
  errorText: {
    textAlign: 'center',
    color: COLORS.errorRed,
    marginBottom: 20,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center',
    minWidth: 120,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyListText: {
    textAlign: 'center',
    color: COLORS.accessoryDarkColor,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  nftListItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDarkColor,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)', // Very subtle highlight
  },
  nftListImageContainer: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.lightBackground,
    marginRight: 16,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  nftListSelectIconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nftListSelectIcon: {
    fontSize: 16,
    color: COLORS.accessoryDarkColor,
  },
  nftListImage: {
    width: '100%',
    height: '100%',
  },
  nftListPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.darkerBackground,
  },
  nftListPlaceholderText: {
    color: COLORS.accessoryDarkColor,
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  nftListInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nftListName: {
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginBottom: 2,
  },
  nftListCollection: {
    color: COLORS.accessoryDarkColor,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginBottom: 2,
  },
  nftListMint: {
    color: COLORS.greyMid,
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily,
  },

  // --- NFT Confirm Specific Styles ---
  nftConfirmContainer: {
     flex: 1,
  },
  nftConfirmContent: {
    flex: 1, // Allow content to take space
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  nftConfirmImage: {
    width: 160,
    height: 160,
    borderRadius: 80,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: COLORS.borderDarkColor,
  },
  nftConfirmName: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontFamily,
    textAlign: 'center',
    marginBottom: 6,
  },
  nftConfirmCollection: {
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.accessoryDarkColor,
    fontFamily: TYPOGRAPHY.fontFamily,
    textAlign: 'center',
    marginBottom: 30,
  },
  centeredMessageText: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: COLORS.accessoryDarkColor,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  nftConfirmActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDarkColor,
    backgroundColor: COLORS.lighterBackground, // Match container bg
  },
  actionButton: {
    flex: 1, // Make buttons fill space
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginHorizontal: 8,
  },
  cancelButton: {
     backgroundColor: 'rgba(255, 255, 255, 0.1)', // Subtle cancel
  },
  confirmButton: {
      backgroundColor: COLORS.brandPrimary, // Primary confirm
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    fontFamily: TYPOGRAPHY.fontFamily,
    textAlign: 'center',
  },

  // --- General Helper Styles (if needed) ---
  // Example: remove duplicated updateButton styles if not used elsewhere
  // updateButton: { ... },
  // updateButtonText: { ... },

  profileImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  profileImageEditIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.lightBackground,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  profileImageEditIcon: {
    fontSize: 20,
  },
  editPictureButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginTop: 8,
  },
  inputLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  characterCount: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.accessoryDarkColor,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  characterCountWarning: {
    color: COLORS.brandPink,
  },
  textInputAtLimit: {
    borderColor: COLORS.brandPink,
  },
  inputHelperText: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.accessoryDarkColor,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginTop: 6,
    marginLeft: 4,
  },

  // Add these new styles for improved NFT selection UX

  nftInstructionsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDarkColor,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  nftInstructionsText: {
    color: COLORS.accessoryDarkColor,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily,
    textAlign: 'center',
  },
  nftConfirmImageContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.borderDarkColor,
    marginBottom: 20,
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
  },
  nftConfirmInstructions: {
    color: COLORS.accessoryDarkColor,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily,
    textAlign: 'center',
    marginTop: 20,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    overflow: 'hidden',
  },

  // Add these new styles for header improvements and upload progress

  saveButtonActive: {
    opacity: 1,
  },
  saveButtonInactive: {
    opacity: 0.5,
  },
  saveButtonTextActive: {
    color: COLORS.brandPrimary,
  },
  saveButtonTextInactive: {
    color: COLORS.greyMid, // Or a lighter shade for inactive state
  },
  
  // Upload progress overlay - enhanced styles
  uploadProgressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  uploadProgressContainer: {
    width: '85%',
    backgroundColor: COLORS.darkerBackground,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 15,
    maxWidth: 400,
  },
  uploadProgressHeader: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  uploadProgressTitle: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  uploadProgressPercentage: {
    color: COLORS.brandPrimary,
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  uploadProgressBarContainer: {
    width: '100%',
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 18,
    position: 'relative',
  },
  uploadProgressBar: {
    height: '100%',
    backgroundColor: COLORS.brandPrimary,
    borderRadius: 5,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  uploadProgressBarShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  uploadProgressText: {
    color: COLORS.accessoryDarkColor,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily,
    textAlign: 'center',
  },
  uploadSuccessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    width: '100%',
  },
  uploadSuccessText: {
    color: SUCCESS_GREEN,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    fontFamily: TYPOGRAPHY.fontFamily,
    marginLeft: 8,
  },
  uploadErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(235, 87, 87, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    width: '100%',
  },
  uploadErrorText: {
    color: ERROR_RED,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    fontFamily: TYPOGRAPHY.fontFamily,
    marginLeft: 8,
    flexShrink: 1,
  },
  
  // New styles for previously inline styles
  avatarOptionButtonWithMargin: {
    marginRight: 10,
  },
  progressBarWidth: {
    // The width will be set dynamically
  },
  activityIndicatorMargin: {
    marginRight: 5,
  },
  
  // Additional styles from inline
  flatListStyle: {
    flex: 1,
  },
  flatListContentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  bottomSpacerView: {
    height: 60, // Add some space at the very bottom of the scroll view
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 10, // Reduce top padding slightly
    paddingBottom: 40, // Add padding to the bottom to ensure last input can scroll up
  },
  keyboardAvoidingContainer: {
    flex: 1,
    width: '100%', // Ensure it takes full width
  },
}); 