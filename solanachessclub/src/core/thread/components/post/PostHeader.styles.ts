import {StyleSheet} from 'react-native';
import COLORS from '@/assets/colors'; // Adjust path if needed
import TYPOGRAPHY from '@/assets/typography'; // Adjust path if needed

export function createPostHeaderStyles(
  overrideStyles?: {[key: string]: object},
  userStyleSheet?: {[key: string]: object},
): {[key: string]: any} {
  const baseStyles: {[key: string]: any} = StyleSheet.create({
    /* Post Header (username, handle) - Migrated from thread.styles.ts */
    threadItemHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
      ...overrideStyles?.threadItemHeaderRow,
    },
    threadItemHeaderLeft: {
      flexDirection: 'row',
      flex: 1,
      alignItems: 'center',
      ...overrideStyles?.threadItemHeaderLeft,
    },
    threadItemUsername: {
      fontWeight: '600',
      fontSize: TYPOGRAPHY.size.sm,
      color: COLORS.white,
      fontFamily: TYPOGRAPHY.fontFamily,
      ...overrideStyles?.threadItemUsername,
    },
    threadItemHandleTime: {
      fontSize: 12,
      color: COLORS.greyMid, // Consider theme variable
      fontFamily: TYPOGRAPHY.fontFamily,
      ...overrideStyles?.threadItemHandleTime,
    },
    verifiedIcon: {
      marginLeft: 4,
      ...overrideStyles?.verifiedIcon,
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