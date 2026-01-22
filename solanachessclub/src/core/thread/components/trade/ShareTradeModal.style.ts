import {StyleSheet, Platform, Dimensions} from 'react-native';
import COLORS from '../../../../assets/colors';
import TYPOGRAPHY from '../../../../assets/typography';

const {width, height} = Dimensions.get('window');

export default StyleSheet.create({
  /** Main Modal / Container styles */
  flexFill: {
    flex: 1,
  },
  darkOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  centeredWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    width: '100%',
  },
  modalContentContainer: {
    backgroundColor: COLORS.lightBackground,
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 24,
    height: Platform.OS === 'ios' ? height * 0.85 : height * 0.88,
    display: 'flex',
    flexDirection: 'column',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: -4},
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },

  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderDarkColor,
    alignSelf: 'center',
    marginBottom: 12,
  },

  /** Header styles */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
    color: COLORS.white,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  headerClose: {
    position: 'absolute',
    right: 20,
    top: 0,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: COLORS.lighterBackground,
  },
  headerCloseText: {
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.accessoryDarkColor,
    lineHeight: 18,
  },
  refreshIcon: {
    position: 'absolute',
    left: 20,
    top: 0,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: COLORS.lighterBackground,
  },
  headerBackButton: {
    position: 'absolute',
    left: 20,
    top: 0,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: COLORS.lighterBackground,
  },

  /** Tab row styles */
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: COLORS.lighterBackground,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.15,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  tabButtonText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    color: COLORS.accessoryDarkColor,
  },
  tabButtonTextActive: {
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    color: COLORS.brandBlue,
  },

  /** Tab content wrapper */
  fullWidthScroll: {
    width: '100%',
  },
  tabContentContainer: {
    paddingVertical: 8,
  },

  /** Token row and selectors */
  tokenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 16,
  },
  tokenColumn: {
    flex: 1,
  },
  arrowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.lighterBackground,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.15,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  arrowText: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
    color: COLORS.brandBlue,
  },
  tokenSelector: {
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.lighterBackground,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  tokenSelectorText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    color: COLORS.white,
  },
  tokenIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginRight: 8,
  },
  chevronDown: {
    width: 16,
    height: 16,
    opacity: 0.7,
  },
  tokenSelectorInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  /** Text inputs and labels */
  inputLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    color: COLORS.accessoryDarkColor,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 16,
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.white,
    backgroundColor: COLORS.lighterBackground,
  },

  /** Buttons & loaders */
  swapButton: {
    backgroundColor: COLORS.brandBlue,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0, 171, 228, 0.5)',
        shadowOffset: {width: 0, height: 3},
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  swapButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
  },
  activityLoader: {
    marginVertical: 16,
  },

  // Bottom Action Bar - Much cleaner than floating button
  bottomActionBar: {
    backgroundColor: COLORS.lightBackground,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDarkColor,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: -2},
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  bottomActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedSwapSummary: {
    flex: 1,
    marginRight: 16,
  },
  selectedSwapTokens: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    color: COLORS.white,
    marginBottom: 2,
  },
  selectedSwapTimestamp: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.accessoryDarkColor,
  },
  continueButton: {
    backgroundColor: COLORS.brandBlue,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0, 171, 228, 0.5)',
        shadowOffset: {width: 0, height: 3},
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  continueButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
    marginLeft: 6,
  },

  // Enhanced swap item styling for better selection feedback
  swapItemWrapper: {
    marginHorizontal: 20,
    marginVertical: 6,
  },
  swapItemSelected: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.brandBlue,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0, 171, 228, 0.3)',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  swapItemUnselected: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  swapItemCheckmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.brandBlue,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  /** Result & error messages */
  resultText: {
    color: '#10B981',
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: 12,
    textAlign: 'center',
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    paddingHorizontal: 20,
  },
  errorText: {
    color: COLORS.errorRed,
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: 12,
    textAlign: 'center',
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    paddingHorizontal: 20,
  },

  /**
   * Confirmation ("Share your trade?") Modal Styles
   */
  sharePromptBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  sharePromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sharePromptBox: {
    backgroundColor: COLORS.lightBackground,
    width: '85%',
    borderRadius: 16,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  sharePromptTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
    marginBottom: 12,
    textAlign: 'center',
    color: COLORS.white,
  },
  sharePromptDescription: {
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.accessoryDarkColor,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.lineHeight.md,
  },
  sharePromptButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  sharePromptBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  sharePromptBtnCancel: {
    backgroundColor: COLORS.darkerBackground,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  sharePromptBtnConfirm: {
    backgroundColor: COLORS.brandBlue,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0, 171, 228, 0.5)',
        shadowOffset: {width: 0, height: 3},
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  sharePromptBtnText: {
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.accessoryDarkColor,
  },
  sharePromptConfirmText: {
    color: COLORS.white,
  },

  // Past swaps tab
  pastSwapsContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  pastSwapsContent: {
    flex: 1,
    display: 'flex',
  },
  swapsListContainer: {
    flex: 1,
  },
  pastSwapsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDarkColor,
    backgroundColor: COLORS.background,
  },
  pastSwapsHeaderText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
    color: COLORS.white,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.lighterBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  refreshingOverlay: {
    position: 'absolute',
    zIndex: 10,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(12, 16, 26, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  walletNotConnected: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  walletNotConnectedText: {
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.accessoryDarkColor,
    textAlign: 'center',
    marginTop: 12,
    width: '80%',
  },
  connectWalletIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.lighterBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(12, 16, 26, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.brandBlue,
    textAlign: 'center',
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
  },
  swapItemContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptySwapsList: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptySwapsIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.brandBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0, 171, 228, 0.3)',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  emptySwapsText: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySwapsSubtext: {
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.accessoryDarkColor,
    textAlign: 'center',
    marginBottom: 24,
    width: '80%',
  },
  emptyStateRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.brandBlue,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0, 171, 228, 0.5)',
        shadowOffset: {width: 0, height: 3},
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  emptyStateRefreshText: {
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    fontSize: TYPOGRAPHY.size.sm,
    marginLeft: 8,
  },
  swapsList: {
    paddingBottom: 16,
  },
  listHeaderContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  swapsCountText: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.accessoryDarkColor,
    marginBottom: 8,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
  },
  swapsListDivider: {
    height: 1,
    backgroundColor: COLORS.borderDarkColor,
    marginBottom: 8,
  },
  
  // Input amount section
  amountInputContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    color: COLORS.white,
    paddingVertical: 8,
  },
  maxButton: {
    backgroundColor: COLORS.lighterBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  maxButtonText: {
    color: COLORS.brandBlue,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    fontSize: TYPOGRAPHY.size.sm,
  },
  amountUsdValue: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.accessoryDarkColor,
    marginTop: 6,
  },
  
  // Transaction history tab
  txHistoryHeader: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    color: COLORS.white,
    marginVertical: 12,
    paddingHorizontal: 20,
  },
  txSignatureInputContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lighterBackground,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  pasteButtonText: {
    color: COLORS.brandBlue,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    marginLeft: 6,
  },
  txDescription: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.accessoryDarkColor,
    lineHeight: TYPOGRAPHY.lineHeight.md,
    marginBottom: 12,
  },

  // Skeleton loading styles
  skeletonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  skeletonSwapItem: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  skeletonTokenBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.lighterBackground,
    marginRight: 10,
  },
  skeletonTextLong: {
    height: 18,
    borderRadius: 4,
    backgroundColor: COLORS.lighterBackground,
    width: '60%',
    marginBottom: 8,
  },
  skeletonTextShort: {
    height: 16,
    borderRadius: 4,
    backgroundColor: COLORS.lighterBackground,
    width: '30%',
  },
  skeletonArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.lighterBackground,
    marginHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonArrowInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.darkerBackground,
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.2,
    backgroundColor: 'transparent',
  },
  skeletonMiddleContent: {
    flex: 1,
    marginHorizontal: 8,
  },
  skeletonDateText: {
    height: 14,
    borderRadius: 2,
    backgroundColor: COLORS.lighterBackground,
    width: '40%',
    marginTop: 8,
  },
  
  // Message input screen styles
  messageScreenContainer: {
    flex: 1,
    backgroundColor: COLORS.lightBackground,
  },
  selectedSwapPreview: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.brandBlue,
  },
  selectedSwapHeader: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.brandBlue,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    marginBottom: 8,
  },
  messageInputContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  messageInputLabel: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    color: COLORS.white,
    marginBottom: 12,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.white,
    backgroundColor: COLORS.lighterBackground,
    textAlignVertical: 'top',
    minHeight: 120,
    maxHeight: 200,
  },
  characterCount: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.accessoryDarkColor,
    backgroundColor: COLORS.lighterBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  messageInputBottomSection: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    backgroundColor: COLORS.lightBackground,
  },
  shareButton: {
    backgroundColor: COLORS.brandBlue,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0, 171, 228, 0.5)',
        shadowOffset: {width: 0, height: 3},
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  shareButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
  },
  skipMessageButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  skipMessageButtonText: {
    color: COLORS.accessoryDarkColor,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
  },

  // Smooth transition styles
  slideInUp: {
    transform: [{ translateY: 300 }],
  },
  slideInUpActive: {
    transform: [{ translateY: 0 }],
  },
  fadeIn: {
    opacity: 0,
  },
  fadeInActive: {
    opacity: 1,
  },

  // Quick share button for immediate sharing without message
  quickShareButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.brandBlue,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  quickShareButtonText: {
    color: COLORS.brandBlue,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    marginLeft: 4,
  },

  // Loading states
  bottomActionLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  loadingSpinner: {
    marginRight: 8,
  },
});
