// File: src/screens/PumpfunScreen/pumpfunScreen.style.ts

import {StyleSheet} from 'react-native';
import COLORS from '../../../assets/colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  warnText: {
    marginTop: 40,
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
  },
  listContentContainer: {
    paddingTop: 8,
    paddingBottom: 60,
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  balanceContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    marginRight: 6,
    fontSize: 16,
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.brandPrimary ?? '#666',
  },
  refreshButton: {
    backgroundColor: '#f5f5f5',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  refreshButtonText: {
    fontSize: 14,
  },
  subHeader: {
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 6,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
  },
  tokenMint: {
    fontWeight: '600',
    flex: 0.5,
  },
  tokenAmount: {
    flex: 0.3,
    fontWeight: '600',
    color: '#333',
    textAlign: 'right',
    marginRight: 8,
  },
  selectButton: {
    backgroundColor: COLORS.brandPrimary ?? '#36C',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  selectButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 16,
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 12,
  },
  tabButton: {
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginHorizontal: 4,
  },
  tabButtonActive: {
    backgroundColor: COLORS.brandPrimary ?? '#36C',
    borderColor: COLORS.brandPrimary ?? '#36C',
  },
  tabText: {
    color: '#000',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  selectedTokenContainer: {
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedTokenLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  selectedTokenText: {
    fontSize: 14,
    color: '#333',
  },
  selectedTokenPlaceholder: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
  },
});
