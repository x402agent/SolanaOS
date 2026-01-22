import { StyleSheet, DimensionValue } from 'react-native';
import COLORS from '@/assets/colors'; // Adjust path if needed
import TYPOGRAPHY from '@/assets/typography'; // Adjust path if needed

export function createPostCTAStyles(
  overrideStyles?: { [key: string]: object },
  userStyleSheet?: { [key: string]: object },
): { [key: string]: any } {
  const baseStyles: { [key: string]: any } = StyleSheet.create({
    /* CTA (PostCTA) - Migrated from thread.styles.ts */
    threadPostCTAContainer: {
      width: '100%' as DimensionValue,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
      alignSelf: 'flex-end',
      justifyContent: 'flex-end',
      ...overrideStyles?.threadPostCTAContainer,
    },
    threadPostCTAButton: {
      backgroundColor: COLORS.white, // Consider theme variable
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 20,
      width: '100%',
      alignItems: 'center',
      ...overrideStyles?.threadPostCTAButton,
    },
    threadPostCTAButtonLabel: {
      color: COLORS.textDark, // Consider theme variable
      fontSize: 15,
      fontWeight: '600',
      fontFamily: TYPOGRAPHY.fontFamily,
      ...overrideStyles?.threadPostCTAButtonLabel,
    },

    /* Additional styles for the trade modal - Migrated from thread.styles.ts */
    tradeModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      ...overrideStyles?.tradeModalOverlay,
    },
    tradeModalContainer: {
      width: '80%',
      backgroundColor: '#fff', // Consider theme variable
      borderRadius: 10,
      padding: 20,
      alignItems: 'center',
      ...overrideStyles?.tradeModalContainer,
    },
    tradeModalTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 12,
      fontFamily: TYPOGRAPHY.fontFamily,
      color: COLORS.textDark, // Consider theme variable
      ...overrideStyles?.tradeModalTitle,
    },
    tradeModeSelectorRow: {
      flexDirection: 'row',
      marginTop: 8,
      ...overrideStyles?.tradeModeSelectorRow,
    },
    tradeModeButton: {
      flex: 1,
      marginHorizontal: 2,
      padding: 10,
      borderRadius: 8,
      alignItems: 'center',
      // Background color will be applied conditionally
      ...overrideStyles?.tradeModeButton,
    },
    tradeModeButtonText: { // Added for consistency
      fontFamily: TYPOGRAPHY.fontFamily,
      fontSize: 14,
      // Color will be applied conditionally
      ...overrideStyles?.tradeModeButtonText,
    },
    tradeConfirmButton: {
      backgroundColor: '#1d9bf0', // Consider theme variable (e.g., brandBlue)
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      marginTop: 16, // Added margin
      ...overrideStyles?.tradeConfirmButton,
    },
    tradeConfirmButtonText: { // Added for consistency
      color: COLORS.white,
      fontFamily: TYPOGRAPHY.fontFamily,
      fontWeight: '600',
      fontSize: 15,
      ...overrideStyles?.tradeConfirmButtonText,
    },

    /* Migrated from PostCTA.tsx uiStyles - Progress/Confirm Modals */
    progressOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      ...overrideStyles?.progressOverlay,
    },
    progressContainer: {
      padding: 24,
      backgroundColor: '#333', // Consider theme variable
      borderRadius: 12,
      width: '80%',
      alignItems: 'center',
      ...overrideStyles?.progressContainer,
    },
    progressText: {
      marginTop: 10,
      color: '#fff', // Consider theme variable
      fontSize: 14,
      textAlign: 'center',
      fontFamily: TYPOGRAPHY.fontFamily,
      ...overrideStyles?.progressText,
    },
    confirmOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      ...overrideStyles?.confirmOverlay,
    },
    confirmContainer: {
      padding: 24,
      backgroundColor: '#333', // Consider theme variable
      borderRadius: 12,
      width: '80%',
      alignItems: 'center',
      ...overrideStyles?.confirmContainer,
    },
    confirmText: {
      marginBottom: 20,
      color: '#fff', // Consider theme variable
      fontSize: 16,
      textAlign: 'center',
      fontFamily: TYPOGRAPHY.fontFamily,
      ...overrideStyles?.confirmText,
    },
    confirmButton: {
      backgroundColor: '#1d9bf0', // Consider theme variable
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
      ...overrideStyles?.confirmButton,
    },
    confirmButtonText: {
      color: '#fff', // Consider theme variable
      fontWeight: 'bold',
      fontSize: 15,
      fontFamily: TYPOGRAPHY.fontFamily,
      ...overrideStyles?.confirmButtonText,
    },
  });

  // Merge userStyleSheet if provided (using the utility function)
  const mergedStyles = mergeStyles(baseStyles, userStyleSheet);

  // Merge explicit overrideStyles last
  return mergeStyles(mergedStyles, overrideStyles);
}

// Utility function to merge style objects (can be moved to a shared utils file)
function mergeStyles(base: any, overrides?: any): any {
  if (!overrides) {
    return base;
  }

  const merged: { [key: string]: any } = {};
  Object.keys(base).forEach(key => {
    merged[key] = StyleSheet.flatten([base[key], overrides[key]]);
  });

  // Add any keys from overrides that are not in base
  Object.keys(overrides).forEach(key => {
    if (!merged[key]) {
      merged[key] = overrides[key];
    }
  });

  return merged;
} 