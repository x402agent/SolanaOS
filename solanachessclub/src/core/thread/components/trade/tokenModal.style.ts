import {StyleSheet, Platform, Dimensions} from 'react-native';
import COLORS from '../../../../assets/colors';
import TYPOGRAPHY from '../../../../assets/typography';

const {width, height} = Dimensions.get('window');

export default StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxHeight: height * 0.75,
    backgroundColor: COLORS.lightBackground,
    borderRadius: 20,
    padding: 20,
    paddingBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
      },
    }),
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
    textAlign: 'center',
    marginBottom: 0,
    color: COLORS.white,
  },
  modalCloseButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 4,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: COLORS.lighterBackground,
  },
  modalCloseText: {
    fontSize: TYPOGRAPHY.size.lg,
    color: COLORS.accessoryDarkColor,
    lineHeight: 18,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.white,
    paddingVertical: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
  },
  loadingText: {
    marginTop: 12,
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.accessoryDarkColor,
  },
  listContentContainer: {
    paddingBottom: 20,
    paddingHorizontal: 4,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.accessoryDarkColor,
    textAlign: 'center',
  },
  tokenItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDarkColor,
  },
  tokenItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  tokenSymbol: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    color: COLORS.white,
  },
  tokenName: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.accessoryDarkColor,
  },
  closeButton: {
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: COLORS.brandBlue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0, 171, 228, 0.5)',
        shadowOffset: {width: 0, height: 3},
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  closeButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
  },
});
