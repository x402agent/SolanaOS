// FILE: src/components/thread/post/PostFooter.tsx

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Dimensions,
} from 'react-native';
import Icons from '../../../../assets/svgs';
import { createPostFooterStyles } from './PostFooter.styles';
import { ThreadPost, ThreadUser, ThreadSection } from '../thread.types';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useReduxHooks';
import {
  addReactionAsync,
  createRetweetAsync,
  deletePostAsync,
  undoRetweetLocally,
  addRetweetLocally,
  updatePostAsync,
  setActiveReactionTray,
  closeReactionTray,
} from '@/shared/state/thread/reducer';
import { nanoid } from '@reduxjs/toolkit';
import { DEFAULT_IMAGES } from '@/shared/config/constants';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

// Get window dimensions for animation
const { height } = Dimensions.get('window');

interface PostFooterProps {
  post: ThreadPost;
  onPressComment?: (post: ThreadPost) => void;
  themeOverrides?: Partial<Record<string, any>>;
  styleOverrides?: { [key: string]: object };
}

// Add typing interface for the SimpleRetweetDrawer component
interface SimpleRetweetDrawerProps {
  visible: boolean;
  onClose: () => void;
  retweetOf: string;
  currentUser: ThreadUser;
  hasAlreadyRetweeted: boolean;
  onDirectRepost: () => Promise<void>;
  onUndoRepost: () => Promise<void>;
}

// Add interface for reaction data
interface ReactionData {
  count: number;
  timestamp?: number;
}

// Simplified inline RetweetDrawer component
function SimpleRetweetDrawer({
  visible,
  onClose,
  retweetOf,
  currentUser,
  hasAlreadyRetweeted,
  onDirectRepost,
  onUndoRepost,
}: SimpleRetweetDrawerProps) {
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);
  const [retweetText, setRetweetText] = useState('');
  const [showQuoteInput, setShowQuoteInput] = useState(false);

  // Get the target post from Redux state
  const targetPost = useAppSelector(state =>
    state.thread.allPosts.find(p => p.id === retweetOf)
  );

  // Determine if the post is a retweet
  const isRetweet = targetPost?.retweetOf !== undefined;

  // If quoting a retweet, we need to quote the original post, not the retweet
  const originalPostId = isRetweet
    ? targetPost?.retweetOf?.id
    : retweetOf;

  // Check if user has already retweeted this post
  const existingRetweet = useAppSelector(state =>
    state.thread.allPosts.find(p =>
      p.retweetOf?.id === (originalPostId || retweetOf) &&
      p.user.id === currentUser.id
    )
  );

  // Reset state when drawer opens/closes
  useEffect(() => {
    if (visible) {
      setRetweetText('');
      setShowQuoteInput(false);
    }
  }, [visible]);

  // Handle quote retweet
  const handleQuoteRetweet = async () => {
    if (!retweetText.trim()) return;

    // Use the original post ID for the retweet
    const targetRetweetId = originalPostId || retweetOf;

    let sections: ThreadSection[] = [{
      id: `section-${nanoid()}`,
      type: 'TEXT_ONLY',
      text: retweetText.trim(),
    } as ThreadSection];

    try {
      setLoading(true);

      // If the user already has retweeted this post, update the existing retweet
      if (existingRetweet) {
        await dispatch(updatePostAsync({
          postId: existingRetweet.id,
          sections: sections
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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={drawerStyles.overlay}>
        <TouchableOpacity
          style={drawerStyles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={drawerStyles.drawer}>
          {!showQuoteInput ? (
            // Options drawer
            <View style={drawerStyles.optionsContainer}>
              <Text style={drawerStyles.drawerTitle}>
                {hasAlreadyRetweeted ? 'Already Reposted' : 'Repost'}
              </Text>

              {hasAlreadyRetweeted ? (
                // Already retweeted options
                <>
                  <TouchableOpacity
                    style={drawerStyles.option}
                    onPress={() => setShowQuoteInput(true)}
                    disabled={loading}
                  >
                    <Text style={drawerStyles.optionText}>Quote</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[drawerStyles.option, drawerStyles.undoOption]}
                    onPress={onUndoRepost}
                    disabled={loading}
                  >
                    <Text style={[drawerStyles.optionText, drawerStyles.undoText]}>
                      Undo Repost
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                // Not yet retweeted options
                <>
                  <TouchableOpacity
                    style={drawerStyles.option}
                    onPress={onDirectRepost}
                    disabled={loading}
                  >
                    <Text style={drawerStyles.optionText}>Repost</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={drawerStyles.option}
                    onPress={() => setShowQuoteInput(true)}
                    disabled={loading}
                  >
                    <Text style={drawerStyles.optionText}>Quote</Text>
                  </TouchableOpacity>
                </>
              )}

              {loading && (
                <View style={drawerStyles.loader} />
              )}
            </View>
          ) : (
            // Quote input form
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={drawerStyles.quoteContainer}
            >
              <Text style={drawerStyles.quoteTitle}>Add a comment</Text>

              <TextInput
                style={drawerStyles.textInput}
                placeholder="What's on your mind?"
                multiline
                value={retweetText}
                onChangeText={setRetweetText}
                autoFocus
                keyboardAppearance="dark"
              />

              <View style={drawerStyles.quoteButtons}>
                <TouchableOpacity
                  style={drawerStyles.cancelButton}
                  onPress={() => setShowQuoteInput(false)}
                  disabled={loading}
                >
                  <Text style={drawerStyles.cancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    drawerStyles.quoteButton,
                    !retweetText.trim() && drawerStyles.disabledButton,
                  ]}
                  onPress={handleQuoteRetweet}
                  disabled={!retweetText.trim() || loading}
                >
                  <Text
                    style={[
                      drawerStyles.quoteButtonText,
                      !retweetText.trim() && drawerStyles.disabledText,
                    ]}
                  >
                    Quote
                  </Text>
                </TouchableOpacity>
              </View>

              {loading && (
                <View style={drawerStyles.loader} />
              )}
            </KeyboardAvoidingView>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function PostFooter({
  post,
  onPressComment,
  themeOverrides,
  styleOverrides,
}: PostFooterProps) {
  // Use state for managing the counts locally for optimistic updates
  const currentUser = useAppSelector(state => state.auth);
  const [localReactionCount, setLocalReactionCount] = useState(post.reactionCount);
  const [localRetweetCount, setLocalRetweetCount] = useState(post.retweetCount);
  const [localQuoteCount, setLocalQuoteCount] = useState(post.quoteCount);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [showRetweetDrawer, setShowRetweetDrawer] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const [commentPressed, setCommentPressed] = useState(false);
  const [isReactionProcessing, setIsReactionProcessing] = useState(false);

  // Get global reaction tray state from Redux
  const activeReactionTrayPostId = useAppSelector(state => state.thread.activeReactionTrayPostId);
  const showReactions = activeReactionTrayPostId === post.id;

  // Animation refs for reactions
  const reactionButtonScale = useRef(new Animated.Value(1)).current;
  const reactionCountScale = useRef(new Animated.Value(1)).current;
  const newReactionScale = useRef(new Animated.Value(0)).current;
  const reactionPillsOpacity = useRef(new Animated.Value(1)).current;

  // Memoize styles (no theme needed)
  const styles = useMemo(() => createPostFooterStyles(styleOverrides), [
    styleOverrides,
  ]);

  // Grab user info from Redux
  const address = useAppSelector(state => state.auth.address);
  const username = useAppSelector(state => state.auth.username);
  const profilePicUrl = useAppSelector(state => state.auth.profilePicUrl);

  // Build a proper ThreadUser object for retweet
  const retweeterUser: ThreadUser = {
    id: address || 'anonymous-wallet',
    username: username || 'Anonymous',
    handle: address
      ? '@' + address.slice(0, 6) + '...' + address.slice(-4)
      : '@unknown',
    verified: false,
    avatar: profilePicUrl
      ? { uri: profilePicUrl }
      : DEFAULT_IMAGES.user,
  };

  const dispatch = useAppDispatch();

  // Check if the user has already retweeted this post, and get the retweet post if exists
  const hasRetweeted = useAppSelector(state => {
    if (!address) return false;

    // Case 1: Check if this post is already a retweet by the current user
    if (post.retweetOf && post.user.id === address) {
      return true;
    }

    // Case 2: Check if any post in the state is a retweet of this post by the current user
    return state.thread.allPosts.some(p =>
      p.retweetOf?.id === post.id && p.user.id === address
    );
  });

  // Find the user's retweet post object (if it exists)
  const myRetweet = useAppSelector(state => {
    if (!address) return null;

    // Case 1: If this post is already a retweet by the current user
    if (post.retweetOf && post.user.id === address) {
      return post; // The current post is the retweet
    }

    // Case 2: Check for explicit retweets of this post
    return state.thread.allPosts.find(p =>
      p.retweetOf?.id === post.id && p.user.id === address
    );
  });

  // Instead of relying solely on the passed prop, subscribe to the updated post from Redux.
  const updatedPost =
    useAppSelector(state =>
      state.thread.allPosts.find(p => p.id === post.id),
    ) || post;

  // Animate when reactions change
  useEffect(() => {
    if (updatedPost.reactionCount !== post.reactionCount) {
      // Trigger a subtle animation when reaction count changes
      Animated.sequence([
        Animated.timing(reactionPillsOpacity, {
          toValue: 0.7,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(reactionPillsOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [updatedPost.reactionCount, updatedPost.reactions, post.reactionCount, reactionPillsOpacity]);

  // Handle animation when global reaction tray state changes
  useEffect(() => {
    if (showReactions) {
      // Animate in when this tray becomes active
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out when this tray becomes inactive
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [showReactions, scaleAnim]);

  const closeReactionBubble = () => {
    dispatch(closeReactionTray(post.id));
  };

  useEffect(() => {
    if (!showReactions) return;
    // Additional outside-click logic can go here if needed
    return () => { };
  }, [showReactions]);

  const toggleBookmark = () => {
    setIsBookmarked(prev => !prev);
  };

  const handleSelectReaction = (emoji: string) => {
    if (post.id.startsWith('local-')) {
      Alert.alert(
        'Action not allowed',
        'You cannot add reactions to unsaved posts.',
      );
      return;
    }

    if (!address) {
      Alert.alert(
        'Authentication required',
        'Please connect your wallet to react to posts.',
      );
      return;
    }

    // Prevent rapid clicking
    if (isReactionProcessing) {
      return;
    }

    setIsReactionProcessing(true);

    // Close reaction bubble immediately for better UX
    dispatch(closeReactionTray(post.id));
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();

    // Animate reaction button press
    Animated.sequence([
      Animated.timing(reactionButtonScale, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(reactionButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Animate reaction count change
    Animated.sequence([
      Animated.timing(reactionCountScale, {
        toValue: 1.2,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(reactionCountScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // Animate new reaction pill appearance
    Animated.sequence([
      Animated.timing(newReactionScale, {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(newReactionScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Dispatch the reaction update
    dispatch(addReactionAsync({
      postId: post.id,
      reactionEmoji: emoji,
      userId: address
    })).finally(() => {
      // Reset processing state after reaction is complete
      setTimeout(() => {
        setIsReactionProcessing(false);
      }, 500); // Small delay to prevent rapid clicking
    });
  };

  const handleShowReactions = () => {
    // If this post's tray is already open, close it
    if (showReactions) {
      dispatch(closeReactionTray(post.id));
      return;
    }

    // Otherwise, open this post's tray (which will close any other open tray)
    dispatch(setActiveReactionTray(post.id));
  };

  const handleOpenRetweetDrawer = () => {
    setShowRetweetDrawer(true);
  };

  // Render existing reactions
  const renderExistingReactions = () => {
    // Debug logging
    // console.log('[PostFooter] renderExistingReactions - updatedPost.reactions:', updatedPost.reactions);
    // console.log('[PostFooter] renderExistingReactions - typeof reactions:', typeof updatedPost.reactions);
    // console.log('[PostFooter] renderExistingReactions - Object.keys length:', updatedPost.reactions ? Object.keys(updatedPost.reactions).length : 'null/undefined');

    if (
      !updatedPost.reactions ||
      Object.keys(updatedPost.reactions).length === 0
    ) {
      // console.log('[PostFooter] renderExistingReactions - returning null (no reactions)');
      return null;
    }

    // Convert reactions to array and sort by timestamp (oldest first)
    const reactionEntries = Object.entries(updatedPost.reactions || {})
      .sort((a, b) => {
        const aData = typeof a[1] === 'number' ? { count: a[1] } : a[1] as ReactionData;
        const bData = typeof b[1] === 'number' ? { count: b[1] } : b[1] as ReactionData;

        // If timestamps exist, sort by them
        if (aData.timestamp && bData.timestamp) {
          return aData.timestamp - bData.timestamp;
        }
        // If no timestamps, maintain original order
        return 0;
      })
      .map(([emoji, data]): [string, number] => [String(emoji), typeof data === 'number' ? data : (data as ReactionData).count]);

    const userReaction = updatedPost.userReaction;
    const totalReactions = Object.values(updatedPost.reactions || {}).reduce((a: number, b) => {
      const count = typeof b === 'number' ? b : (b as ReactionData).count;
      return a + count;
    }, 0);

    // If there are many reactions, show a compact summary
    if (reactionEntries.length > 3) {
      return (
        <Animated.View style={[
          reactionStyles.existingReactionsContainer,
          { opacity: reactionPillsOpacity }
        ]}>
          <Animated.View style={{ transform: [{ scale: userReaction ? newReactionScale : 1 }] }}>
            <TouchableOpacity
              style={[
                reactionStyles.compactReactionPill,
                userReaction && reactionStyles.userReactionPill
              ]}
              onPress={() => handleShowReactions()}
              activeOpacity={0.7}
            >
              <View style={reactionStyles.compactEmojiContainer}>
                {reactionEntries.slice(0, 3).map(([emoji], index) => (
                  <Text
                    key={emoji}
                    style={[
                      reactionStyles.compactEmoji,
                      { marginLeft: index > 0 ? -2 : 0 }
                    ]}
                  >
                    {emoji}
                  </Text>
                ))}
                {reactionEntries.length > 3 && (
                  <Text style={reactionStyles.moreIndicator}>+</Text>
                )}
              </View>
              <Text style={[
                reactionStyles.reactionCount,
                userReaction && reactionStyles.userReactionCount
              ]}>
                {totalReactions}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      );
    }

    // For 3 or fewer reactions, show individual pills
    return (
      <View style={reactionStyles.existingReactionsContainer}>
        {reactionEntries.map(([emoji, count]) => {
          const isUserReaction = userReaction === emoji;
          return (
            <TouchableOpacity
              key={emoji}
              style={[
                reactionStyles.reactionPill,
                isUserReaction && reactionStyles.userReactionPill
              ]}
              onPress={() => handleSelectReaction(emoji)}
              activeOpacity={0.7}
            >
              <Text style={reactionStyles.reactionEmoji}>{emoji}</Text>
              <Text style={[
                reactionStyles.reactionCount,
                isUserReaction && reactionStyles.userReactionCount
              ]}>
                {count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // Handle direct repost without quote
  const handleDirectRepost = async () => {
    if (post.id.startsWith('local-')) {
      Alert.alert(
        'Action not allowed',
        'You cannot repost unsaved posts.',
      );
      return;
    }

    // Determine if we're retweeting a retweet - if so, retweet the original instead
    const isRetweetingRetweet = post.retweetOf !== undefined;
    const originalPostId = isRetweetingRetweet && post.retweetOf ? post.retweetOf.id : post.id;

    try {
      await dispatch(createRetweetAsync({
        retweetOf: originalPostId,
        userId: address || 'anonymous-wallet',
        sections: [], // Empty sections for a direct repost without quote
      })).unwrap();

      setShowRetweetDrawer(false);
    } catch (error) {
      Alert.alert('Repost Failed', 'Unable to repost. Please try again.');
    }
  };

  // Handle undo repost
  const handleUndoRepost = async () => {
    try {
      if (myRetweet) {
        const isCurrentPostTheRetweet = post.retweetOf && post.user.id === address;

        // If the current post is itself a retweet by the current user
        if (isCurrentPostTheRetweet) {
          // Remember the original post's ID in case we need to navigate
          const originalPostId = post.retweetOf?.id;

          if (!originalPostId) {
            console.warn('Original post ID is missing for retweet');
            return;
          }

          // Delete this post (which is the retweet itself)
          await dispatch(deletePostAsync(post.id)).unwrap();

          // After deleting, navigate to the original post if viewing the retweet directly
          if (onPressComment && post.retweetOf) {
            // In Twitter, when you undo a retweet while viewing the retweet,
            // it takes you to the original post
            onPressComment(post.retweetOf);
          }
        } else {
          // Normal case: delete the retweet post we found
          await dispatch(deletePostAsync(myRetweet.id)).unwrap();
        }
      } else {
        // If we can't find the retweet, use undoRetweetLocally action as fallback
        dispatch(undoRetweetLocally({
          userId: address || '',
          originalPostId: post.id
        }));
      }

      setShowRetweetDrawer(false);
    } catch (error) {
      Alert.alert('Undo Repost Failed', 'Unable to undo repost. Please try again.');
    }
  };

  // Handle comment click - navigate to appropriate post
  const handleCommentClick = () => {
    if (onPressComment) {
      // Add animation effect for comment button
      setCommentPressed(true);

      // Trigger the comment action
      onPressComment(post);

      // Reset after animation completes
      setTimeout(() => {
        setCommentPressed(false);
      }, 500);
    }
  };

  return (
    <View style={styles.footerContainer}>
      {/* Overlay to detect outside clicks on the reaction bubble */}
      {showReactions && (
        <TouchableWithoutFeedback onPress={closeReactionBubble}>
          <View style={reactionStyles.clickOutsideOverlay} />
        </TouchableWithoutFeedback>
      )}

      {/* New flex row: left icons and right reactions */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        {/* Left icons */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* Comment icon */}
          <TouchableOpacity
            style={[
              styles.itemLeftIcons,
              commentPressed && {
                backgroundColor: COLORS.darkerBackground,
                borderRadius: 16,
                padding: 4,
                transform: [{ scale: 1.1 }]
              }
            ]}
            onPress={handleCommentClick}>
            <Icons.CommentIdle
              width={20}
              height={20}
              color={commentPressed ? COLORS.brandBlue : undefined}
            />
            <Text style={[
              styles.iconText,
              commentPressed && { color: COLORS.brandBlue, fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold) }
            ]}>
              {updatedPost.quoteCount || 0}
            </Text>
          </TouchableOpacity>

          {/* Retweet */}
          <View style={styles.itemLeftIcons}>
            <TouchableOpacity
              onPress={handleOpenRetweetDrawer}
            >
              <Icons.RetweetIdle
                width={20}
                height={20}
                color={hasRetweeted ? COLORS.cyan : undefined}
              />
            </TouchableOpacity>
            <Text style={[
              styles.iconText,
              hasRetweeted && { color: COLORS.cyan }
            ]}>
              {updatedPost.retweetCount || 0}
            </Text>
          </View>

          {/* Reaction icon */}
          <View style={styles.itemLeftIcons}>
            <Animated.View style={{ transform: [{ scale: reactionButtonScale }] }}>
              <TouchableOpacity
                onPress={handleShowReactions}
                style={[
                  reactionStyles.reactionButton,
                  updatedPost.userReaction && reactionStyles.userReactionButton,
                  isReactionProcessing && reactionStyles.processingReactionButton
                ]}
                disabled={isReactionProcessing}
              >
                <Icons.ReactionIdle
                  width={20}
                  height={20}
                  color={updatedPost.userReaction ? COLORS.brandBlue : undefined}
                />
              </TouchableOpacity>
            </Animated.View>
            <Animated.Text style={[
              styles.iconText,
              updatedPost.userReaction && { color: COLORS.brandBlue },
              { transform: [{ scale: reactionCountScale }] }
            ]}>
              {updatedPost.reactionCount || 0}
            </Animated.Text>

            {/* Reaction bubble */}
            {showReactions && (
              <Animated.View
                style={[
                  reactionStyles.bubbleContainer,
                  {
                    transform: [{ scale: scaleAnim }],
                    opacity: scaleAnim,
                  },
                ]}>
                <View style={reactionStyles.emojiRow}>
                  {['🚀', '❤️', '😂'].map((emoji, index) => {
                    const isSelected = updatedPost.userReaction === emoji;
                    return (
                      <TouchableOpacity
                        key={emoji}
                        style={[
                          reactionStyles.emojiButton,
                          isSelected && reactionStyles.selectedEmojiButton
                        ]}
                        onPress={() => handleSelectReaction(emoji)}>
                        <Animated.Text style={[
                          reactionStyles.emojiText,
                          isSelected && reactionStyles.selectedEmojiText,
                          {
                            transform: [{
                              translateY: scaleAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [10, 0],
                              })
                            }],
                            opacity: scaleAnim.interpolate({
                              inputRange: [0, 0.5, 1],
                              outputRange: [0, 0.8, 1],
                            })
                          }
                        ]}>
                          {emoji}
                        </Animated.Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={reactionStyles.bubbleArrow} />
              </Animated.View>
            )}
          </View>
        </View>

        {/* Right: Reacted emoji pill */}
        <View style={{ flexShrink: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', minWidth: 0 }}>
          {renderExistingReactions()}
        </View>
      </View>

      {/* Use our inline SimpleRetweetDrawer component */}
      <SimpleRetweetDrawer
        visible={showRetweetDrawer}
        onClose={() => setShowRetweetDrawer(false)}
        retweetOf={post.id}
        currentUser={retweeterUser}
        hasAlreadyRetweeted={hasRetweeted}
        onDirectRepost={handleDirectRepost}
        onUndoRepost={handleUndoRepost}
      />
    </View>
  );
}

const reactionStyles = StyleSheet.create({
  clickOutsideOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 90,
  },
  bubbleContainer: {
    position: 'absolute',
    bottom: 25,
    left: -40,
    backgroundColor: COLORS.lighterBackground,
    borderRadius: 20,
    padding: 6,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 100,
    maxWidth: 160,
  },
  bubbleArrow: {
    position: 'absolute',
    bottom: -6,
    left: '30%',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.lighterBackground,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emojiButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedEmojiButton: {
    backgroundColor: COLORS.brandBlue,
    borderWidth: 2,
    borderColor: COLORS.white,
    shadowColor: COLORS.brandBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  emojiText: {
    fontSize: TYPOGRAPHY.size.lg,
  },
  selectedEmojiText: {
    transform: [{ scale: 1.1 }],
    color: COLORS.white,
    fontWeight: 'bold',
  },
  reactionButton: {
    padding: 4,
    borderRadius: 12,
  },
  userReactionButton: {
    backgroundColor: COLORS.darkerBackground,
  },
  userReactionIcon: {
    fontSize: 18,
  },
  processingReactionButton: {
    opacity: 0.6,
  },
  processingReactionPill: {
    opacity: 0.6,
  },
  existingReactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 3,
    flex: 1,
    justifyContent: 'flex-end',
    maxWidth: '50%',
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.darkerBackground,
    borderRadius: 12,
    height: 24,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    gap: 3,
  },
  compactReactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.darkerBackground,
    borderRadius: 12,
    height: 24,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    maxWidth: 60,
  },
  userReactionPill: {
    backgroundColor: COLORS.darkerBackground,
    borderColor: COLORS.greyMid,
    borderWidth: 2,
  },
  compactEmojiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  compactEmoji: {
    fontSize: 10,
  },
  moreIndicator: {
    fontSize: 8,
    color: COLORS.greyMid,
    marginLeft: 1,
  },
  emojiCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  userEmojiCircle: {
    backgroundColor: COLORS.brandBlue,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 10,
    color: COLORS.accessoryDarkColor,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    fontFamily: TYPOGRAPHY.fontFamily,
    minWidth: 10,
    textAlign: 'center',
  },
  userReactionCount: {
    color: COLORS.brandBlue,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
  },
  totalCount: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
});

// Styles for the retweet drawer
const drawerStyles = StyleSheet.create({
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
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    shadowColor: COLORS.black,
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
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
    textAlign: 'center',
    marginBottom: 16,
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  option: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDarkColor,
  },
  optionText: {
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  undoOption: {
    borderBottomWidth: 0,
  },
  undoText: {
    color: COLORS.errorRed,
  },
  loader: {
    marginTop: 16,
    height: 24,
    width: 24,
    alignSelf: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.brandBlue,
    borderTopColor: 'transparent',
  },
  quoteContainer: {
    padding: 16,
  },
  quoteTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    marginBottom: 12,
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  textInput: {
    borderColor: COLORS.borderDarkColor,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.white,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: COLORS.darkerBackground,
    fontFamily: TYPOGRAPHY.fontFamily,
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
    fontSize: TYPOGRAPHY.size.md,
    color: COLORS.greyMid,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  quoteButton: {
    backgroundColor: COLORS.brandBlue,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  disabledButton: {
    backgroundColor: COLORS.darkerBackground,
  },
  disabledText: {
    color: COLORS.greyMid,
  },
});
