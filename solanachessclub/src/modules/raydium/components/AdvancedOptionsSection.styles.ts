import { StyleSheet, Dimensions, Platform } from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

const { height, width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  sectionContainer: {
    marginBottom: 20,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  fixedWidthContainer: {
    marginBottom: 20,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  feeSharingTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
    marginBottom: 8,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  sectionDescription: {
    fontSize: 12,
    color: COLORS.greyMid,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  vestingOptions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDarkColor,
  },
  disabledButton: {
    opacity: 0.6,
  },
  formField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.greyMid,
    marginBottom: 8,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  graphContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    height: 200,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  dropdownContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  dropdownText: {
    color: COLORS.white,
    fontSize: 16,
    padding: 4,
    flex: 1,
  },
  tokenSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: 4,
  },
  tokenIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  tokenIconSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  tokenIconSmallContainer: {
    marginLeft: 8,
    marginRight: 8,
  },
  tokenInfo: {
    flex: 1,
  },
  tokenName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  tokenAddress: {
    fontSize: 12,
    color: COLORS.greyMid,
    marginTop: 2,
  },
  dropdownInputContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  inputContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  input: {
    flex: 1,
    color: COLORS.white,
    padding: 12,
    fontSize: 16,
  },
  dropdownButton: {
    padding: 12,
  },
  dropdownOptions: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    zIndex: 10,
  },
  dropdownOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDarkColor,
  },
  dropdownOptionText: {
    color: COLORS.white,
    fontSize: 16,
  },
  dropdownOptionDescription: {
    color: COLORS.greyMid,
    fontSize: 12,
    marginTop: 4,
  },
  percentSign: {
    color: COLORS.white,
    fontSize: 16,
    marginRight: 12,
  },
  bpsText: {
    color: COLORS.white,
    position: 'absolute',
    right: 12,
    fontSize: 14,
  },
  helperText: {
    color: COLORS.greyMid,
    fontSize: 12,
    marginTop: 4,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  twoColumnContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  columnItem: {
    flex: 1,
    marginRight: 8,
  },
  createButton: {
    backgroundColor: COLORS.brandBlue,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 36,
  },
  createButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 4,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  calculatedContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    alignItems: 'center',
  },
  calculatedValue: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  calculatedDescription: {
    color: COLORS.greyMid,
    fontSize: 12,
    textAlign: 'center',
  },
  graphLegendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    marginTop: 15,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  legendText: {
    color: COLORS.white,
    fontSize: 10,
    marginRight: 5,
  },
  legendValue: {
    color: COLORS.white,
    fontSize: 10,
    opacity: 0.8,
  },
  tokenAmountText: {
    color: COLORS.brandPurple,
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionSubtitle: {
    color: COLORS.greyMid,
    fontSize: 12,
    marginTop: 2,
  },
});

// Separate styles for the modal
export const modalStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 24,
    maxHeight: height * 0.8,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    borderBottomWidth: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: String(TYPOGRAPHY.bold) as any,
    color: COLORS.white,
  },
  modalCloseButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.black,
    marginHorizontal: 24,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.white,
    padding: 0,
  },
  listContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  tokenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDarkColor,
  },
  tokenItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.darkerBackground,
  },
  tokenTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  tokenSymbol: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: String(TYPOGRAPHY.bold) as any,
    color: COLORS.white,
  },
  tokenName: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.greyMid,
    marginTop: 2,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.greyMid,
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.greyMid,
    textAlign: 'center',
  },
  closeButton: {
    marginHorizontal: 24,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.darkerBackground,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
  },
  closeButtonText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: String(TYPOGRAPHY.medium) as any,
    color: COLORS.white,
  },
});