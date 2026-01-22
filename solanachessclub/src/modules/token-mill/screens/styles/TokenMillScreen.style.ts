import {StyleSheet} from 'react-native';

export const tokenMillScreenStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 80,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    color: '#2a2a2a',
    textAlign: 'center',
  },
  subHeader: {
    fontSize: 14,
    color: '#555',
    marginBottom: 16,
    textAlign: 'center',
  },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  errorText: {
    fontSize: 16,
    color: '#e53935',
    textAlign: 'center',
    padding: 20,
  },
}); 