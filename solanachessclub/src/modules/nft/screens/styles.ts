import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 12,
  },
  warnText: {
    color: 'red',
    marginTop: 40,
    textAlign: 'center',
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    justifyContent: 'space-around',
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    padding: 4,
  },
  tabButton: {
    flex: 1,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#32D4DE',
  },
  tabButtonText: {
    color: '#2a2a2a',
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#ffffff',
  },
});
