import { StyleSheet } from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

// Function to create base styles for ThreadAncestors
export function getThreadAncestorsBaseStyles(
  // Remove the theme parameter as it's no longer used
) {
  return StyleSheet.create({
    replyingContainer: {
      backgroundColor: '#F9F9F9', // Replaced theme['--thread-replying-bg']
      padding: 8, // Replaced theme['--thread-replying-padding']
      marginVertical: 8, // Replaced theme['--thread-replying-margin-vertical']
      borderRadius: 6, // Replaced theme['--thread-replying-border-radius']
    },
    replyingText: {
      fontSize: 13,
      color: '#666',
    },
    replyingHandle: {
      color: '#2B8EF0', // Replaced theme['--thread-link-color']
      fontWeight: '600',
    },
  });
}

// Styles previously defined inline in ThreadAncestors.tsx
export const ancestorStyles = StyleSheet.create({
  parentSnippetWrapper: {
    marginTop: 8,
  },
  parentSnippetTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  parentSnippetContainer: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    // Optionally add a border or small shadow
    borderWidth: 1,
    borderColor: '#EEE',
  },
}); 