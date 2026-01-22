import {StyleSheet} from 'react-native';

export const MarketCreationCardStyles = StyleSheet.create({
  section: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    color: '#2a2a2a',
  },
  input: {
    backgroundColor: '#fafafa',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    borderColor: '#ddd',
    borderWidth: 1,
    marginBottom: 12,
  },
  statusContainer: {
    backgroundColor: '#f8f8f8',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  statusText: {
    color: '#333',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
}); 