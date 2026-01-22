import {StyleSheet} from 'react-native';
import COLORS from '@/assets/colors'; // Adjust path if needed
import TYPOGRAPHY from '@/assets/typography'; // Adjust path if needed

export function createPostBodyStyles(
  overrideStyles?: {[key: string]: object},
  userStyleSheet?: {[key: string]: object},
): {[key: string]: any} {
  const baseStyles: {[key: string]: any} = StyleSheet.create({
    /* Body/content area - Migrated from thread.styles.ts */
    extraContentContainer: {
      marginVertical: 8,
      width: '100%',
      alignItems: 'flex-start',
      ...overrideStyles?.extraContentContainer,
    },
    threadItemText: {
      fontSize: TYPOGRAPHY.size.sm,
      color: COLORS.white,
      marginBottom: 6,
      fontFamily: TYPOGRAPHY.fontFamily,
      ...overrideStyles?.threadItemText,
    },
    threadItemImage: {
      width: '70%', // Consider making this customizable
      height: 120, // Consider making this customizable
      borderRadius: 8,
      resizeMode: 'cover',
      marginTop: 4,
      ...overrideStyles?.threadItemImage,
    },
    videoPlaceholder: {
      padding: 10,
      backgroundColor: '#EEE', // Consider theme variable
      borderRadius: 8,
      marginTop: 4,
      ...overrideStyles?.videoPlaceholder,
    },
    videoPlaceholderText: {
      color: '#666', // Consider theme variable
      textAlign: 'center',
      fontFamily: TYPOGRAPHY.fontFamily,
      ...overrideStyles?.videoPlaceholderText,
    },

    /* Poll styles - Migrated from thread.styles.ts */
    pollContainer: {
      backgroundColor: '#F5F5F5',
      borderRadius: 8,
      padding: 8,
      marginTop: 4,
      ...overrideStyles?.pollContainer,
    },
    pollQuestion: {
      fontSize: TYPOGRAPHY.size.sm,
      fontWeight: '600',
      marginBottom: 6,
      color: COLORS.white,
      fontFamily: TYPOGRAPHY.fontFamily,
      ...overrideStyles?.pollQuestion,
    },
    pollOption: {
      backgroundColor: '#ECECEC',
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 4,
      marginBottom: 4,
      ...overrideStyles?.pollOption,
    },
    pollOptionText: {
      fontSize: TYPOGRAPHY.size.sm,
      color: COLORS.white,
      fontFamily: TYPOGRAPHY.fontFamily,
      ...overrideStyles?.pollOptionText,
    },

    /* NFT Listing styles - Migrated from thread.styles.ts */
    nftListingContainer: {
      marginTop: 8,
      padding: 8,
      backgroundColor: '#F9F9F9', // Consider theme variable
      borderRadius: 8,
      ...overrideStyles?.nftListingContainer,
    },
    nftListingCard: {
      flexDirection: 'column',
      backgroundColor: '#FFFFFF', // Consider theme variable
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#EEE', // Consider theme variable
      overflow: 'hidden',
      alignItems: 'center',
      padding: 8,
      ...overrideStyles?.nftListingCard,
    },
    nftListingImageContainer: {
      width: 150,
      height: 150,
      backgroundColor: '#f0f0f0', // Consider theme variable
      ...overrideStyles?.nftListingImageContainer,
    },
    nftListingImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
      ...overrideStyles?.nftListingImage,
    },
    nftListingPlaceholder: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      ...overrideStyles?.nftListingPlaceholder,
    },
    nftListingPlaceholderText: {
      color: '#999', // Consider theme variable
      fontFamily: TYPOGRAPHY.fontFamily,
      ...overrideStyles?.nftListingPlaceholderText,
    },
    nftListingInfo: {
      marginTop: 8,
      alignItems: 'center',
      ...overrideStyles?.nftListingInfo,
    },
    nftListingName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#333', // Consider theme variable
      fontFamily: TYPOGRAPHY.fontFamily,
      ...overrideStyles?.nftListingName,
    },
    nftListingPrice: {
      fontSize: 14,
      color: '#666', // Consider theme variable
      marginTop: 4,
      fontFamily: TYPOGRAPHY.fontFamily,
      ...overrideStyles?.nftListingPrice,
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

  const merged: {[key: string]: any} = {};
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