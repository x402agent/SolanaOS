// FILE: src/components/thread/RetweetPreview.styles.ts
import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  handle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  previewText: {
    marginTop: 8,
    fontSize: 14,
    color: '#000',
    lineHeight: 18,
  },
  seeMoreButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  seeMoreText: {
    fontSize: 13,
    color: '#1d9bf0',
    fontWeight: '500',
  },
  showTweetButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#e2e2e2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 5,
  },
  showTweetText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
});

