import {StyleSheet} from 'react-native';

export const searchBarStyles = StyleSheet.create({
  container: {
    width: '90%',
    marginVertical: 10,
    alignItems: 'center',
    alignSelf: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
    width: 24,
    height: 24,
    tintColor: '#888',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 12,
  },
  clearButtonText: {
    fontSize: 20,
    color: '#555',
  },
  loadingText: {
    marginTop: 6,
    fontSize: 14,
    color: '#666',
  },
  /** Dropdown Styles */
  dropdown: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    zIndex: 1000,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  coinImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 12,
    backgroundColor: '#EEE',
  },
  dropdownItemTextContainer: {
    flex: 1,
  },
  dropdownItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  dropdownItemSymbol: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
});
