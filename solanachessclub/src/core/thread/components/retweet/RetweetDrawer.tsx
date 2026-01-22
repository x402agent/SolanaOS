import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  Animated,
  Dimensions,
} from 'react-native';
import { ThreadUser, ThreadSection, ThreadPost } from '../thread.types';
import {
  createRetweetAsync,
  addRetweetLocally,
  updatePostAsync,
} from '@/shared/state/thread/reducer';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useReduxHooks';
import { nanoid } from '@reduxjs/toolkit';

/**
 * Props for the RetweetDrawer.
 */
interface RetweetDrawerProps {
  visible: boolean;
  onClose: () => void;
  retweetOf: string; // postId of the post we retweet
  currentUser: ThreadUser;
  hasAlreadyRetweeted?: boolean;
  onDirectRepost?: () => Promise<void>;
  onUndoRepost?: () => Promise<void>;
  styleOverrides?: {
    container?: StyleProp<ViewStyle>;
    input?: StyleProp<TextStyle>;
    button?: StyleProp<ViewStyle>;
    buttonText?: StyleProp<TextStyle>;
  };
}

const { height } = Dimensions.get('window');

/**
 * RetweetDrawer - Bottom drawer with options for reposting:
 * 1. Direct repost (no comment)
 * 2. Quote repost (with comment)
 * 3. Undo repost (if already retweeted)
 */
export default function RetweetDrawer({
  visible,
  onClose,
  retweetOf,
  currentUser,
  hasAlreadyRetweeted = false,
  onDirectRepost,
  onUndoRepost,
  styleOverrides,
}: RetweetDrawerProps) {
  const dispatch = useAppDispatch();

  // Local state
  const [loading, setLoading] = useState(false);
  const [retweetText, setRetweetText] = useState('');
  const [showQuoteInput, setShowQuoteInput] = useState(false);

  // Get all posts from state
  const allPosts = useAppSelector(state => state.thread.allPosts);

  // Get the target post - could be a retweet or original post
  const targetPost = useAppSelector(state =>
    state.thread.allPosts.find(p => p.id === retweetOf)
  );

  // Determine if the post is already a retweet
  const isRetweet = targetPost?.retweetOf !== undefined;

  // If quoting a retweet, we need to quote the original post, not the retweet
  const originalPostId = isRetweet
    ? targetPost?.retweetOf?.id
    : retweetOf;

  // Find user's existing retweet of this post, if any
  const existingRetweet = useAppSelector(state =>
    state.thread.allPosts.find(p =>
      p.retweetOf?.id === (originalPostId || retweetOf) &&
      p.user.id === currentUser.id
    )
  );

  // In case the original post is our own retweet
  const isOwnRetweet = targetPost?.retweetOf && targetPost.user.id === currentUser.id;

  // Animation
  const [slideAnim] = useState(new Animated.Value(height));

  // Reset state when drawer opens/closes
  useEffect(() => {
    if (visible) {
      // If editing an existing quote retweet, populate the text field with existing quote
      if (existingRetweet && existingRetweet.sections && existingRetweet.sections.length > 0) {
        const quoteSection = existingRetweet.sections.find((s: { type: string }) => s.type === 'TEXT_ONLY');
        if (quoteSection && quoteSection.text) {
          setRetweetText(quoteSection.text);
          setShowQuoteInput(true);
        } else {
          setRetweetText('');
          setShowQuoteInput(false);
        }
      } else {
        setRetweetText('');
        setShowQuoteInput(false);
      }

      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim, existingRetweet]);

  const handleQuoteRetweet = async () => {
    if (!retweetText.trim()) return;

    // Use the originalPostId to ensure we're quoting the original post, not a retweet
    const targetRetweetId = originalPostId || retweetOf;

    let sections: ThreadSection[] = [{
      id: `section-${nanoid()}`,
      type: 'TEXT_ONLY',
      text: retweetText.trim(),
    } as ThreadSection];

    try {
      setLoading(true);

      // If user already retweeted this post, update the existing retweet instead of creating a new one
      if (existingRetweet) {
        await dispatch(updatePostAsync({
          postId: existingRetweet.id,
          sections: sections,
        })).unwrap();
      } else {
        // Create a new retweet
        await dispatch(createRetweetAsync({
          retweetOf: targetRetweetId,
          userId: currentUser.id,
          sections,
        })).unwrap();
      }

      onClose();
    } catch (err: any) {
      console.warn('[RetweetDrawer] Error:', err.message);
      // Fallback to local retweet
      const fallbackPost: ThreadPost = {
        id: 'local-' + nanoid(),
        parentId: null,
        user: currentUser,
        sections,
        createdAt: new Date().toISOString(),
        replies: [],
        reactionCount: 0,
        retweetCount: 0,
        quoteCount: 0,
        reactions: {},
        retweetOf: {
          id: targetRetweetId,
        } as ThreadPost,
      } as ThreadPost;

      dispatch(addRetweetLocally(fallbackPost));
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      <Animated.View
        style={[
          styles.drawer,
          styleOverrides?.container,
          { transform: [{ translateY: slideAnim }] }
        ]}
      >
        {!showQuoteInput ? (
          // Options drawer
          <View style={styles.optionsContainer}>
            <Text style={styles.drawerTitle}>
              {isOwnRetweet
                ? 'This is your retweet'
                : hasAlreadyRetweeted
                  ? 'Already Reposted'
                  : 'Repost'}
            </Text>

            {hasAlreadyRetweeted || isOwnRetweet ? (
              // Already retweeted options
              <>
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => setShowQuoteInput(true)}
                  disabled={loading}
                >
                  <Text style={styles.optionText}>Quote</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.option, styles.undoOption]}
                  onPress={onUndoRepost}
                  disabled={loading}
                >
                  <Text style={[styles.optionText, styles.undoText]}>
                    Undo Repost
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              // Not yet retweeted options
              <>
                <TouchableOpacity
                  style={styles.option}
                  onPress={onDirectRepost}
                  disabled={loading}
                >
                  <Text style={styles.optionText}>Repost</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.option}
                  onPress={() => setShowQuoteInput(true)}
                  disabled={loading}
                >
                  <Text style={styles.optionText}>Quote</Text>
                </TouchableOpacity>
              </>
            )}

            {loading && (
              <ActivityIndicator
                style={styles.loader}
                color="#1d9bf0"
                size="small"
              />
            )}
          </View>
        ) : (
          // Quote input form
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.quoteContainer}
          >
            <Text style={styles.quoteTitle}>Add a comment</Text>

            <TextInput
              style={[styles.textInput, styleOverrides?.input]}
              placeholder="What's on your mind?"
              multiline
              value={retweetText}
              onChangeText={setRetweetText}
              autoFocus
              keyboardAppearance="dark"
            />

            <View style={styles.quoteButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowQuoteInput(false)}
                disabled={loading}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.quoteButton,
                  !retweetText.trim() && styles.disabledButton,
                  styleOverrides?.button,
                ]}
                onPress={handleQuoteRetweet}
                disabled={!retweetText.trim() || loading}
              >
                <Text
                  style={[
                    styles.quoteButtonText,
                    !retweetText.trim() && styles.disabledText,
                    styleOverrides?.buttonText,
                  ]}
                >
                  Quote
                </Text>
              </TouchableOpacity>
            </View>

            {loading && (
              <ActivityIndicator
                style={styles.loader}
                color="#1d9bf0"
              />
            )}
          </KeyboardAvoidingView>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  optionsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  option: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  undoOption: {
    borderBottomWidth: 0,
  },
  undoText: {
    color: '#e0245e',
  },
  loader: {
    marginTop: 16,
    alignSelf: 'center',
  },
  quoteContainer: {
    padding: 16,
  },
  quoteTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  textInput: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  quoteButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  quoteButton: {
    backgroundColor: '#1d9bf0',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#8ec5f2',
  },
  disabledText: {
    color: 'rgba(255,255,255,0.8)',
  },
}); 