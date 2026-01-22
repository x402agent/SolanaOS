// File: src/components/CoinDetails/CoinDetailTopSection/CoinDetailTopSection.style.ts
import {StyleSheet} from 'react-native';

export const defaultTopSectionStyles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 16,
    width: '100%',
  },
  coin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    marginVertical: 24,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 20,
    resizeMode: 'cover',
  },
  coinText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  priceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minHeight: 80, // ensure enough space for the spinner overlay
  },
  mainPrice: {
    fontSize: 32,
    color: '#000000',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  // Add these new styles to the defaultTopSectionStyles object
  statsTextPositive: {
    color: '#00C853', // Green color for positive change
    fontSize: 16,
    fontWeight: '600',
  },
  statsTextNegative: {
    color: '#FF3B30', // Red color for negative change
    fontSize: 16,
    fontWeight: '600',
  },
  statsTextPercentagePositive: {
    color: '#00C853', // Green color for positive percentages
    fontSize: 16,
    fontWeight: '600',
    padding: 4,
    backgroundColor: '#E8F5E9', // Light green background
    borderRadius: 6,
  },
  statsTextPercentageNegative: {
    color: '#FF3B30', // Red color for negative percentages
    fontSize: 16,
    fontWeight: '600',
    padding: 4,
    backgroundColor: '#FFEBEE', // Light red background
    borderRadius: 6,
  },

  graphSection: {
    marginTop: 18,
  },
  timeframeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 50,
  },
  timeButton: {
    padding: 8,
  },
  activeTimeButton: {
    backgroundColor: '#D6FDFF',
    borderRadius: 6,
  },
  timeButtonText: {
    color: '#666666',
    fontSize: 14,
    fontWeight: '500',
  },
  activeTimeButtonText: {
    color: '#32D4DE',
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  swapButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    backgroundColor: 'black',
    padding: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  swapButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  sendButton: {
    flex: 1,
    backgroundColor: '#318EF8',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    padding: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  holdersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  holdersTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  descriptionContainer: {
    marginTop: 12,
  },
  descriptionText: {
    color: '#666666',
    fontSize: 16,
    marginBottom: 12,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  showMoreText: {
    color: 'black',
    fontWeight: '600',
    fontSize: 16,
  },
  cardList: {
    paddingHorizontal: 16,
  },
  borderLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    marginTop: 16,
    marginHorizontal: 4,
  },
  tweetSection: {
    marginTop: 16,
  },
  marketStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  marketStatItem: {
    alignItems: 'center',
  },
  marketStatLabel: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 4,
  },
  marketStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  // Modal styles below...
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 26,
    padding: 20,
    minHeight: '40%',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  modalAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    resizeMode: 'cover',
  },
  modalHeaderTexts: {
    gap: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  modalPriceInfo: {
    alignItems: 'flex-end',
  },
  modalPriceLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  modalPriceChange: {
    color: '#32D4DE',
    fontSize: 16,
    fontWeight: '600',
    padding: 4,
    backgroundColor: '#D6FDFF',
    borderRadius: 6,
  },
  modalButtonsStack: {
    gap: 12,
    paddingTop: 6,
  },
  modalTopButton: {
    width: '100%',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  modalTopButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalTopButtonText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '500',
  },
  modalAvatarStack: {
    flexDirection: 'row',
    position: 'relative',
    width: 50,
    height: 24,
  },
  modalStackAvatar1: {
    width: 24,
    height: 24,
    borderRadius: 12,
    position: 'absolute',
    zIndex: 3,
    left: 0,
  },
  modalStackAvatar2: {
    width: 24,
    height: 24,
    borderRadius: 12,
    position: 'absolute',
    zIndex: 2,
    left: 12,
  },
  modalStackAvatar3: {
    width: 24,
    height: 24,
    borderRadius: 12,
    position: 'absolute',
    zIndex: 1,
    left: 24,
  },
  modalHoldersCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  modalBottomButton: {
    width: '100%',
    padding: 16,
    backgroundColor: 'black',
    borderRadius: 30,
    alignItems: 'center',
  },
  modalBottomButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // New loading overlay style to prevent flicker
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
