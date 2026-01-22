import { StyleSheet } from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import { LinearGradient } from 'expo-linear-gradient';

// Renamed function to reflect it only provides base styles
export function getThreadBaseStyles() {
  return StyleSheet.create({
    // Root styles
    threadRootContainer: {
      backgroundColor: COLORS.background,
      flex: 1,
    },
    
    // Header styles
    header: {
      width: '100%',
      backgroundColor: COLORS.background,
      alignItems: 'center',
    },
    
    // Thread list container
    threadListContainer: {
      paddingBottom: 100, // Space for composer at bottom
    },
  });
  // Merging logic removed, will be handled by the utility function
}

// Header styles
export const headerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    position: 'relative',
  },
  profileContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  absoluteLogoContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: -1,
  },
  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    paddingHorizontal: 4,
  },
});

// Tab styles
export const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 48,
    borderBottomWidth: 0,
    backgroundColor: COLORS.background,
    position: 'relative',
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  activeTab: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    color: COLORS.greyMid,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  activeTabText: {
    color: COLORS.brandBlue,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    width: '80%',
    backgroundColor: COLORS.brandBlue,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    alignSelf: 'center',
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 50,
    zIndex: -2,
  },
}); 