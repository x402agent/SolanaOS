import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { mergeStyles } from '../../utils'; // Import mergeStyles from utils
import { getThreadAncestorsBaseStyles, ancestorStyles } from './ThreadAncestors.styles'; // Import new styles
import { gatherAncestorChain } from '../../utils';
import { ThreadPost } from '../../types';

// We import PostHeader, PostBody, PostFooter to display parent snippet
import PostHeader from '../post/PostHeader';
import PostBody from '../post/PostBody';
import PostFooter from '../post/PostFooter';

/**
 * Props for the ThreadAncestors component
 * @interface ThreadAncestorsProps
 */
interface ThreadAncestorsProps {
  /** The current post to find ancestors for */
  post: ThreadPost;
  /** Array of root-level or all-level posts in the thread (flattened is fine) */
  rootPosts: ThreadPost[];
  /** Theme overrides for customizing appearance */
  themeOverrides?: Partial<Record<string, any>>;
  /** Style overrides for specific components */
  styleOverrides?: { [key: string]: object };
  /** User-provided stylesheet overrides */
  userStyleSheet?: { [key: string]: object };
}

/**
 * A component that displays the chain of users (and a small parent snippet) if this post is a reply.
 *
 * Features:
 * - Displays "Replying to @xyz" text if the post is a reply.
 * - Also shows the immediate parent's post details (header/body/footer) inline, so you see context.
 *
 * @example
 * <ThreadAncestors
 *   post={currentPost}
 *   rootPosts={allPosts}
 *   themeOverrides={{ '--primary-color': '#1D9BF0' }}
 * />
 */
export const ThreadAncestors: React.FC<ThreadAncestorsProps> = ({
  post,
  rootPosts,
  themeOverrides,
  styleOverrides,
  userStyleSheet,
}) => {
  // If no parent, do nothing
  if (!post.parentId) return null;

  // 1. Get base styles (no theme needed)
  const baseComponentStyles = getThreadAncestorsBaseStyles();
  
  // 2. Merge styles using the utility function
  const styles = mergeStyles(baseComponentStyles, styleOverrides, userStyleSheet);

  // Gather chain => array from earliest ancestor to the current post
  const chain = gatherAncestorChain(post.id, rootPosts);

  // If chain length is 1, that means no parent found
  if (chain.length <= 1) return null;

  // Display "Replying to @handles" text
  const uniqueHandles = chain.map(p => p.user.handle).filter(Boolean);
  // Usually the last handle is the current post's user; we only want the earlier ones
  const allButLast = uniqueHandles.slice(0, -1);

  // The immediate parent's post is the second-to-last item in chain
  // Example: chain = [rootPost, parentPost, currentPost]
  // parentPost = chain[chain.length - 2]
  const parentPost = chain[chain.length - 2];

  return (
    <View style={styles.replyingContainer}>
      {allButLast.length > 0 && (
        <Text style={styles.replyingText}>
          Replying to{' '}
          <Text style={styles.replyingHandle}>{allButLast.join(', ')}</Text>
        </Text>
      )}

      {/* Additional snippet to show parent's entire post details */}
      {/* Use styles from the imported ancestorStyles object */}
      <View style={ancestorStyles.parentSnippetWrapper}>
        <Text style={ancestorStyles.parentSnippetTitle}>Parent Post:</Text>
        <View style={ancestorStyles.parentSnippetContainer}>
          <PostHeader
            post={parentPost}
            // For parent snippet, we typically do not allow editing/deleting
            onDeletePost={() => { }}
            onEditPost={() => { }}
            themeOverrides={themeOverrides}
            styleOverrides={styleOverrides}
            // Pass down styles if PostHeader needs merging too
          />
          <PostBody
            post={parentPost}
            themeOverrides={themeOverrides}
            styleOverrides={styleOverrides}
            // Pass down styles if PostBody needs merging too
          />
          <PostFooter
            post={parentPost}
            onPressComment={() => { }}
            themeOverrides={themeOverrides}
            styleOverrides={styleOverrides}
            // Pass down styles if PostFooter needs merging too
          />
        </View>
      </View>
    </View>
  );
};

// Removed inline localStyles definition

// Also export as default for backward compatibility
export default ThreadAncestors;
