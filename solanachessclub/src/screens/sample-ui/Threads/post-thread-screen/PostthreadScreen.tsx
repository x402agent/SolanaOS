import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Keyboard,
  StatusBar,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PostHeader from '@/core/thread/components/post/PostHeader';
import PostBody from '@/core/thread/components/post/PostBody';
import PostFooter from '@/core/thread/components/post/PostFooter';
import PostCTA from '@/core/thread/components/post/PostCTA';
import ThreadComposer from '@/core/thread/components/thread-composer/ThreadComposer';
import { AppHeader } from '@/core/shared-ui';
import { ProfileAvatarView } from '@/core/thread/components/post/PostHeader';

import {
  ThreadPost,
  ThreadUser,
} from '@/core/thread/components/thread.types';
import { DEFAULT_IMAGES } from '@/shared/config/constants';
import { flattenPosts } from '@/core/thread/components/thread.utils';
import EditPostModal from '@/core/thread/components/EditPostModal';
import { RootStackParamList } from '@/shared/navigation/RootNavigator';
import { useAppNavigation } from '@/shared/hooks/useAppNavigation';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useReduxHooks';
import { deletePostAsync } from '@/shared/state/thread/reducer';
import styles from './PostThreadScreen.style';
import COLORS from '@/assets/colors';

/**
 * Finds a post in the array by ID.
 */
function findPostById(posts: ThreadPost[], id: string): ThreadPost | undefined {
  return posts.find(p => p.id === id);
}

/**
 * Gathers ancestors from the current post up to the root, returning them
 * in order from root -> ... -> current.
 */
function gatherAncestorChain(
  start: ThreadPost,
  allPosts: ThreadPost[],
): ThreadPost[] {
  const chain: ThreadPost[] = [];
  let current = start;
  while (true) {
    chain.push(current);
    if (!current.parentId) {
      break;
    }
    const parent = findPostById(allPosts, current.parentId);
    if (!parent) break;
    current = parent;
  }
  chain.reverse();
  return chain;
}

/**
 * Returns the direct children (one-level replies) for a given post.
 */
function getDirectChildren(posts: ThreadPost[], postId: string): ThreadPost[] {
  return posts.filter(p => p.parentId === postId);
}

export default function PostThreadScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'PostThread'>>();
  const navigation = useAppNavigation();
  const dispatch = useAppDispatch();
  const { postId } = route.params;
  const insets = useSafeAreaInsets();

  const commentInputRef = useRef<{ focus: () => void }>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [isCommentHighlighted, setIsCommentHighlighted] = useState(false);
  const backgroundOpacity = useRef(new Animated.Value(0)).current;
  const composerTranslateY = useRef(new Animated.Value(0)).current;

  const allPosts = useAppSelector((state) => state.thread.allPosts);
  const flatPosts = useMemo(() => flattenPosts(allPosts), [allPosts]);

  const [postToEdit, setPostToEdit] = useState<ThreadPost | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  const currentPost = findPostById(flatPosts, postId);

  // Build local user object
  const userWallet = useAppSelector(state => state.auth.address);
  const userName = useAppSelector(state => state.auth.username);
  const profilePicUrl = useAppSelector(state => state.auth.profilePicUrl);

  const localUser: ThreadUser = {
    id: userWallet || 'anonymous',
    username: userName || 'Anonymous',
    handle: userWallet
      ? '@' + userWallet.slice(0, 6) + '...' + userWallet.slice(-4)
      : '@anonymous',
    avatar: profilePicUrl && profilePicUrl.length > 0
      ? { uri: profilePicUrl }
      : DEFAULT_IMAGES.user,
    verified: true,
  };

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  const focusCommentInput = () => {
    if (commentInputRef.current) {
      setIsCommentHighlighted(true);

      if (scrollViewRef.current) {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }

      Animated.timing(backgroundOpacity, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }).start();

      Animated.timing(composerTranslateY, {
        toValue: -3,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }).start();

      setTimeout(() => {
        commentInputRef.current?.focus();
      }, 250);

      setTimeout(() => {
        Animated.parallel([
          Animated.timing(backgroundOpacity, {
            toValue: 0,
            duration: 200,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true
          }),
          Animated.timing(composerTranslateY, {
            toValue: 0,
            duration: 200,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true
          })
        ]).start(() => {
          setIsCommentHighlighted(false);
        });
      }, 300);
    }
  };

  const ancestorChain = currentPost
    ? gatherAncestorChain(currentPost, flatPosts)
    : [];
  const directChildren = currentPost
    ? getDirectChildren(flatPosts, currentPost.id)
    : [];

  const handleDeletePost = (post: ThreadPost) => {
    if (post.user.id !== localUser.id) {
      Alert.alert('Cannot Delete', 'You are not the owner of this post.');
      return;
    }
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          dispatch(deletePostAsync(post.id));
        },
      },
    ]);
  };

  const handleEditPost = (post: ThreadPost) => {
    if (post.user.id !== localUser.id) {
      Alert.alert('Cannot Edit', 'You are not the owner of this post.');
      return;
    }
    setPostToEdit(post);
    setEditModalVisible(true);
  };

  const handleUserPress = (user: ThreadUser) => {
    if (user.id === localUser.id) {
      navigation.navigate('ProfileScreen' as never);
    } else {
      navigation.navigate('OtherProfile', { userId: user.id });
    }
  };

  // Gather all posts in the thread chain (ancestor + current + children)
  const mainThreadPosts = ancestorChain; // This includes the current post at the end

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <SafeAreaView style={[
        styles.container,
        Platform.OS === 'android' && {
          paddingTop: insets.top,
          backgroundColor: COLORS.background,
        }
      ]}>
        <AppHeader
          title="Thread"
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
        />

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS === 'ios' && keyboardVisible && { paddingBottom: keyboardHeight }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {currentPost ? (
            <View>
              {/* Main thread (ancestor chain including current post) */}
              {mainThreadPosts.map((post, index) => {
                const isLastInMainThread = index === mainThreadPosts.length - 1;
                const hasReplies = getDirectChildren(flatPosts, post.id).length > 0;
                const isFirstPost = index === 0;
                // Show thread line if not the last post, or if last post has replies
                const showThreadLine = !isLastInMainThread || hasReplies;

                return (
                  <TouchableOpacity
                    key={post.id}
                    activeOpacity={0.95}
                    onPress={() => {
                      if (post.id !== currentPost.id) {
                        navigation.push('PostThread', { postId: post.id });
                      }
                    }}
                  >
                    <View style={[styles.threadPostContainer, { position: 'relative' }]}>
                      {/* Thread connecting line */}
                      {showThreadLine && (
                        <View style={isFirstPost && hasReplies ? styles.threadLineFromCenter : styles.threadLine} />
                      )}

                      {/* Avatar Column */}
                      <View style={styles.avatarColumn}>
                        <TouchableOpacity onPress={() => handleUserPress(post.user)}>
                          <ProfileAvatarView
                            user={post.user}
                            style={styles.avatar}
                            size={40}
                          />
                        </TouchableOpacity>
                      </View>

                      {/* Content Column */}
                      <View style={styles.contentColumn}>
                        <PostHeader
                          post={post}
                          onDeletePost={() => handleDeletePost(post)}
                          onEditPost={() => handleEditPost(post)}
                          onPressUser={handleUserPress}
                        />
                        <PostBody post={post} />
                        <PostCTA
                          post={post}
                          themeOverrides={{}}
                          styleOverrides={{}}
                        />
                        <PostFooter
                          post={post}
                          onPressComment={focusCommentInput}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Replies header (if there are replies) */}
              {directChildren.length > 0 && (
                <View style={styles.repliesHeader}>
                  <Text style={styles.repliesLabel}>
                    {directChildren.length} {directChildren.length === 1 ? 'reply' : 'replies'}
                  </Text>
                </View>
              )}

              {/* Replies */}
              {directChildren.map((reply, index) => {
                const isLastReply = index === directChildren.length - 1;

                return (
                  <TouchableOpacity
                    key={reply.id}
                    activeOpacity={0.95}
                    onPress={() => navigation.push('PostThread', { postId: reply.id })}
                  >
                    <View style={[styles.threadPostContainer, { position: 'relative' }]}>
                      {/* Thread line for replies */}
                      {!isLastReply && (
                        <View style={styles.threadLine} />
                      )}

                      {/* Avatar Column */}
                      <View style={styles.avatarColumn}>
                        <TouchableOpacity onPress={() => handleUserPress(reply.user)}>
                          <ProfileAvatarView
                            user={reply.user}
                            style={styles.avatar}
                            size={40}
                          />
                        </TouchableOpacity>
                      </View>

                      {/* Content Column */}
                      <View style={styles.contentColumn}>
                        <PostHeader
                          post={reply}
                          onDeletePost={() => handleDeletePost(reply)}
                          onEditPost={() => handleEditPost(reply)}
                          onPressUser={handleUserPress}
                        />
                        <PostBody post={reply} />
                        <PostCTA
                          post={reply}
                          themeOverrides={{}}
                          styleOverrides={{}}
                        />
                        <PostFooter
                          post={reply}
                          onPressComment={focusCommentInput}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.notFoundContainer}>
              <Text style={styles.notFoundText}>
                This thread couldn't be found.{'\n'}
                It may have been deleted or doesn't exist.
              </Text>
            </View>
          )}
        </ScrollView>

        {currentPost && (
          <>
            {isCommentHighlighted && (
              <Animated.View
                style={[
                  styles.dimOverlay,
                  { opacity: backgroundOpacity }
                ]}
              />
            )}

            <Animated.View
              style={[
                styles.composerContainer,
                {
                  transform: [{ translateY: composerTranslateY }],
                  zIndex: 2,
                },
                isCommentHighlighted && styles.composerElevated,
                Platform.OS === 'android' && keyboardVisible && {
                  position: 'absolute',
                  bottom: keyboardHeight,
                  left: 0,
                  right: 0
                }
              ]}>
              <ThreadComposer
                ref={commentInputRef}
                currentUser={localUser}
                parentId={currentPost.id}
                onPostCreated={() => {
                  console.log('Reply created successfully');
                }}
              />
            </Animated.View>
          </>
        )}

        {postToEdit && (
          <EditPostModal
            post={postToEdit}
            isVisible={editModalVisible}
            onClose={() => setEditModalVisible(false)}
          />
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
