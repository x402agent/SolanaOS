import { StyleSheet } from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

// Function to create base styles for ThreadComposer
export function getThreadComposerBaseStyles(
  // Remove the theme parameter as it's no longer used
) {
  return StyleSheet.create({
    composerContainer: {
      flexDirection: 'row',
      padding: 12,
      paddingBottom: 8,
      backgroundColor: COLORS.background,
      borderBottomColor: COLORS.borderDarkColor,
      borderBottomWidth: 1,
    },
    composerAvatarContainer: {
      marginRight: 12,
    },
    composerAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: COLORS.background,
    },
    composerMiddle: {
      flex: 1,
    },
    composerUsername: {
      fontSize: TYPOGRAPHY.size.md,
      fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
      marginBottom: 4,
      color: COLORS.white,
      fontFamily: TYPOGRAPHY.fontFamily,
    },
    composerInput: {
      fontSize: TYPOGRAPHY.size.md,
      fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.regular),
      color: COLORS.white,
      padding: 0,
      minHeight: 30,
      textAlignVertical: 'top',
      fontFamily: TYPOGRAPHY.fontFamily,
    },
    iconsRow: {
      flexDirection: 'row',
      marginTop: 0,
      marginBottom: 0,
      paddingBottom: 0,
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    leftIcons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconButton: {
      marginRight: 10,
      padding: 4,
    },
    actionButtonText: {
      fontSize: TYPOGRAPHY.size.xs,
      color: COLORS.greyMid,
      fontFamily: TYPOGRAPHY.fontFamily,
    },
    imagePreviewContainer: {
      position: 'relative',
      marginTop: 8,
      width: 150,
      height: 150,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: COLORS.background,
    },
    imagePreview: {
      width: '100%',
      height: '100%',
      borderRadius: 8,
    },
    removeImageButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeImageButtonText: {
      color: COLORS.white,
      fontSize: TYPOGRAPHY.size.sm,
    },
    composerTradePreview: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      padding: 8,
      borderRadius: 8,
      backgroundColor: COLORS.background,
      borderWidth: 1,
      borderColor: COLORS.borderDarkColor,
    },
    composerTradeImage: {
      width: 40,
      height: 40,
      borderRadius: 6,
      backgroundColor: COLORS.darkerBackground,
    },
    composerTradeName: {
      fontSize: TYPOGRAPHY.size.sm,
      fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
      color: COLORS.white,
      fontFamily: TYPOGRAPHY.fontFamily,
    },
    composerTradePrice: {
      fontSize: 12,
      color: '#666',
    },
    composerTradeRemove: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: COLORS.darkerBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Migrated modal styles from thread.styles.ts (originally from ThreadComposer)
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      width: '85%',
      maxHeight: '80%',
      backgroundColor: '#fff',
      borderRadius: 10,
      padding: 16,
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 8,
    },
    listingCard: {
      flexDirection: 'row',
      padding: 8,
      borderWidth: 1,
      borderColor: '#eee',
      borderRadius: 8,
      marginBottom: 8,
      alignItems: 'center',
    },
    listingImage: {
      width: 40,
      height: 40,
      borderRadius: 4,
      backgroundColor: '#f0f0f0',
    },
    listingName: {
      fontWeight: '600',
      fontSize: 14,
      color: '#333',
    },
    listingPrice: {
      marginTop: 2,
      fontSize: 12,
      color: '#999',
    },
    closeButton: {
      marginTop: 12,
      backgroundColor: '#1d9bf0',
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 5,
    },
    closeButtonText: {
      color: '#fff',
      fontWeight: '600',
    },
  });
} 