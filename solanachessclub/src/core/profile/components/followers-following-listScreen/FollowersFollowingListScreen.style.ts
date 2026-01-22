import { StyleSheet, Platform } from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.2,
    borderBottomColor: COLORS.borderDarkColor,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: 600,
    color: COLORS.white,
    alignSelf: 'center',
    flex: 1,
    textAlign: 'center',
    marginRight: 40, // To center the title when back button is on the left
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: COLORS.borderDarkColor,
    borderBottomWidth: 0.5,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: COLORS.lighterBackground,
  },
  avatar: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  userInfoContainer: {
    flex: 1,
  },
  username: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: 600,
    color: COLORS.white,
  },
  handle: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.greyMid,
    marginTop: 2,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyListText: {
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.greyMid,
    textAlign: 'center',
  },
  // Android-specific styles
  androidSafeArea: {
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
}); 