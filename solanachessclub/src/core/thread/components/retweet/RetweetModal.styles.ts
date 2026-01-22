import { StyleSheet } from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

export default StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    maxHeight: '70%',
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 10,
    padding: 16,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
    marginBottom: 10,
    textAlign: 'center',
    color: COLORS.white,
  },
  textInput: {
    borderColor: COLORS.borderDarkColor,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    textAlignVertical: 'top',
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.white,
    minHeight: 80,
    backgroundColor: COLORS.lightBackground,
  },
  retweetButton: {
    marginTop: 16,
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  retweetButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
  },
});
