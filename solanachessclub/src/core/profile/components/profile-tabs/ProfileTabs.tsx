// FILE: src/components/Profile/ProfileTabs/ProfileTabs.tsx

import React, { memo, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';
import { LinearGradient } from 'expo-linear-gradient';

// Import from the original location instead of the NFT module
import Collectibles from '../collectibles/collectibles';
import { NftItem } from '../../../../modules/nft/types';

import { styles, tabBarStyles, retweetStyles, tabBarActiveColor, tabBarInactiveColor } from './ProfileTabs.style';
import ActionsPage from '../actions/ActionsPage';

import Icons from '../../../../assets/svgs';

import { useAppDispatch, useAppSelector } from '@/shared/hooks/useReduxHooks';
import { deletePostAsync } from '@/shared/state/thread/reducer';
import { ProfileTabsProps } from '../../types';
import { ThreadPost } from '../../../thread/types';
import PostHeader from '../../../thread/components/post/PostHeader';
import PostBody from '../../../thread/components/post/PostBody';
import PostFooter from '../../../thread/components/post/PostFooter';
import { ProfileAvatarView } from '../../../thread/components/post/PostHeader';
import EditPostModal from '../../../thread/components/EditPostModal';
import { AssetItem, PortfolioData } from '@/modules/data-module';

import COLORS from '@/assets/colors'; // Import COLORS if not already

// Loading placeholder for lazy-loaded tabs
const LoadingPlaceholder = memo(() => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" color="#1d9bf0" />
  </View>
));

/**
 * Empty state component for no posts
 */
const EmptyPostsState = memo(() => (
  <View style={styles.centered}>
    <Text style={styles.emptyText}>No posts yet!</Text>
  </View>
));

/**
 * Individual post item component
 */
const PostItem = memo(({
  post,
  onPressPost,
  onDeletePost,
  onEditPost,
  externalRefreshTrigger,
}: {
  post: ThreadPost;
  onPressPost?: (post: ThreadPost) => void;
  onDeletePost: (post: ThreadPost) => void;
  onEditPost: (post: ThreadPost) => void;
  externalRefreshTrigger?: number;
}) => {
  const isReply = !!post.parentId;
  const isRetweet = !!post.retweetOf;
  const isQuoteRetweet = isRetweet && post.sections && post.sections.length > 0;

  const handleUserPress = (user: any) => {
    // Handle user press if needed
    console.log('User pressed:', user);
  };

  return (
    <View style={styles.postCard}>
      {/* Twitter-like layout with avatar column + content column */}
      <View style={styles.postItemContainer}>
        {/* Avatar Column */}
        <View style={styles.avatarColumn}>
          <ProfileAvatarView
            user={post.user}
            style={styles.avatar}
            size={40}
          />
        </View>

        {/* Content Column */}
        <View style={styles.contentColumn}>
          {isReply && (
            <TouchableOpacity onPress={() => onPressPost?.(post)}>
              <Text style={styles.replyLabel}>Reply Post</Text>
            </TouchableOpacity>
          )}

          {/* Retweet indicator */}
          {isRetweet && (
            <View style={retweetStyles.retweetHeader}>
              <Icons.RetweetIdle width={12} height={12} />
              <Text style={retweetStyles.retweetHeaderText}>
                {post.user.username} Reposted
              </Text>
            </View>
          )}

          {/* Header without avatar (since avatar is in left column) */}
          <PostHeader
            post={post}
            onDeletePost={onDeletePost}
            onEditPost={onEditPost}
            onPressUser={handleUserPress}
          />

          {/* Retweet content */}
          {isRetweet ? (
            <View style={retweetStyles.retweetedContent}>
              {/* Quote retweet text */}
              {isQuoteRetweet && (
                <View style={retweetStyles.quoteContent}>
                  {post.sections.map(section => (
                    <Text key={section.id} style={retweetStyles.quoteText}>
                      {section.text}
                    </Text>
                  ))}
                </View>
              )}

              {/* Original post content */}
              {post.retweetOf && (
                <TouchableOpacity
                  style={retweetStyles.originalPostContainer}
                  activeOpacity={0.8}
                  onPress={() => onPressPost?.(post.retweetOf!)}>
                  <PostHeader
                    post={post.retweetOf}
                    onDeletePost={onDeletePost}
                    onEditPost={onEditPost}
                    onPressUser={handleUserPress}
                  />
                  <PostBody
                    post={post.retweetOf}
                    externalRefreshTrigger={externalRefreshTrigger}
                    isRetweet={true}
                  />
                  <PostFooter
                    post={post.retweetOf}
                    onPressComment={() => onPressPost?.(post.retweetOf!)}
                  />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onPressPost?.(post)}>
              {/* Regular post content */}
              <PostBody
                post={post}
                externalRefreshTrigger={externalRefreshTrigger}
              />
              <PostFooter post={post} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

/**
 * Posts tab content - shows user's posts or empty state
 */
const PostsTab = memo(({
  posts,
  onPressPost,
  externalRefreshTrigger,
}: {
  posts: ThreadPost[];
  onPressPost?: (post: ThreadPost) => void;
  externalRefreshTrigger?: number;
}) => {
  const dispatch = useAppDispatch();
  const userWallet = useAppSelector(state => state.auth.address);

  // Add edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [postToEdit, setPostToEdit] = useState<ThreadPost | null>(null);

  const handleDeletePost = useCallback((post: ThreadPost) => {
    if (post.user.id !== userWallet) {
      alert('You are not the owner of this post.');
      return;
    }
    dispatch(deletePostAsync(post.id));
  }, [dispatch, userWallet]);

  const handleEditPost = useCallback((post: ThreadPost) => {
    if (post.user.id !== userWallet) {
      alert('You are not the owner of this post.');
      return;
    }
    setPostToEdit(post);
    setEditModalVisible(true);
  }, [userWallet]);

  // Empty state check
  if (!posts || posts.length === 0) {
    return <EmptyPostsState />;
  }

  const renderPost = useCallback(({ item }: { item: ThreadPost }) => (
    <PostItem
      post={item}
      onPressPost={onPressPost}
      onDeletePost={handleDeletePost}
      onEditPost={handleEditPost}
      externalRefreshTrigger={externalRefreshTrigger}
    />
  ), [onPressPost, handleDeletePost, handleEditPost, externalRefreshTrigger]);

  // Using a keyExtractor to help React optimize rendering
  const keyExtractor = useCallback((post: ThreadPost) => post.id, []);

  return (
    <>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.postList}
        removeClippedSubviews={true} // Optimize memory usage
        maxToRenderPerBatch={10}     // Optimize render performance
        windowSize={5}               // Optimize render window
        initialNumToRender={7}       // Initial render batch size
      />

      {/* Edit Post Modal */}
      {postToEdit && (
        <EditPostModal
          post={postToEdit}
          isVisible={editModalVisible}
          onClose={() => {
            setEditModalVisible(false);
            setPostToEdit(null);
          }}
        />
      )}
    </>
  );
});

/**
 * Portfolio tab content - shows user's NFTs and portfolio
 */
const PortfolioTab = memo(({
  nfts,
  loading,
  fetchNftsError,
  portfolioData,
  onRefresh,
  refreshing,
  onAssetPress,
}: {
  nfts: NftItem[];
  loading?: boolean;
  fetchNftsError?: string | null;
  portfolioData?: PortfolioData;
  onRefresh?: () => void;
  refreshing?: boolean;
  onAssetPress?: (asset: AssetItem) => void;
}) => {
  // Prioritize portfolio data if available
  const hasPortfolioData = useMemo(() =>
    portfolioData?.items && portfolioData.items.length > 0,
    [portfolioData?.items]
  );

  // Memoize props for Collectibles to prevent re-renders
  const collectiblesProps = useMemo(() => ({
    nfts: hasPortfolioData ? [] : nfts,
    loading,
    error: fetchNftsError,
    portfolioItems: portfolioData?.items,
    nativeBalance: portfolioData?.nativeBalance?.lamports,
    onRefresh,
    refreshing,
    onItemPress: onAssetPress,
  }), [
    hasPortfolioData,
    nfts,
    loading,
    fetchNftsError,
    portfolioData?.items,
    portfolioData?.nativeBalance?.lamports,
    onRefresh,
    refreshing,
    onAssetPress,
  ]);

  return (
    <View style={styles.tabContent}>
      <Collectibles {...collectiblesProps} />
    </View>
  );
});

/**
 * Actions tab wrapped in memo
 */
const ActionsTabContent = memo(({
  myActions,
  loadingActions,
  fetchActionsError,
}: {
  myActions: any[];
  loadingActions?: boolean;
  fetchActionsError?: string | null;
}) => (
  <ActionsPage
    myActions={myActions}
    loadingActions={loadingActions}
    fetchActionsError={fetchActionsError}
  />
));

/**
 * ProfileTabs - The main tab container that shows Posts, Portfolio, and Actions
 * Renamed from SwipeTabs for better clarity
 */
function ProfileTabs({
  myPosts,
  myNFTs,
  loadingNfts,
  fetchNftsError,
  myActions,
  loadingActions,
  fetchActionsError,
  onPressPost,
  portfolioData,
  onRefreshPortfolio,
  refreshingPortfolio,
  onAssetPress,
}: ProfileTabsProps) {
  // Tab navigation state
  const [index, setIndex] = useState<number>(0);
  const [routes] = useState([
    { key: 'posts', title: 'Posts' },
    { key: 'portfolio', title: 'Portfolio' },
    { key: 'actions', title: 'Actions' },
  ]);

  // Refresh counter for posts tab charts
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Handle tab changes and trigger refreshes as needed
  const handleIndexChange = useCallback((newIndex: number) => {
    setIndex(newIndex);
    if (newIndex === 0) {
      setRefreshCounter(prev => prev + 1);
    }
  }, []);

  // Memoize scene components to prevent re-renders
  const postsSceneData = useMemo(() => ({
    posts: myPosts,
    onPressPost,
    externalRefreshTrigger: refreshCounter,
  }), [myPosts, onPressPost, refreshCounter]);

  const portfolioSceneData = useMemo(() => ({
    nfts: myNFTs,
    loading: loadingNfts,
    fetchNftsError,
    portfolioData,
    onRefresh: onRefreshPortfolio,
    refreshing: refreshingPortfolio,
    onAssetPress,
  }), [
    myNFTs,
    loadingNfts,
    fetchNftsError,
    portfolioData,
    onRefreshPortfolio,
    refreshingPortfolio,
    onAssetPress,
  ]);

  const actionsSceneData = useMemo(() => ({
    myActions,
    loadingActions,
    fetchActionsError,
  }), [myActions, loadingActions, fetchActionsError]);

  // Scene renderers - these components are created once and memoized
  const PostsScene = useMemo(
    () => () => <PostsTab {...postsSceneData} />,
    [postsSceneData]
  );

  const PortfolioScene = useMemo(
    () => () => <PortfolioTab {...portfolioSceneData} />,
    [portfolioSceneData]
  );

  const ActionsScene = useMemo(
    () => () => <ActionsTabContent {...actionsSceneData} />,
    [actionsSceneData]
  );

  // Scene map for the tab view - only created once
  const renderScene = useMemo(
    () => SceneMap({
      posts: PostsScene,
      portfolio: PortfolioScene,
      actions: ActionsScene,
    }),
    [PostsScene, PortfolioScene, ActionsScene]
  );

  // Custom tab bar renderer
  const renderTabBar = useCallback(
    (props: any) => (
      <View style={tabBarStyles.gradientContainer}>
        <TabBar
          {...props}
          style={tabBarStyles.tabBarContainer}
          labelStyle={tabBarStyles.label}
          activeColor={tabBarActiveColor}
          inactiveColor={tabBarInactiveColor}
          indicatorStyle={tabBarStyles.indicator}
          pressColor="transparent" // Prevent ripple effect on Android
          pressOpacity={0.8} // Subtle opacity change on iOS
        />
        <LinearGradient
          colors={['transparent', COLORS.lightBackground]}
          style={tabBarStyles.bottomGradient}
        />
      </View>
    ),
    [],
  );

  // Memoize the initial layout to prevent recalculation
  const initialLayout = useMemo(() => ({ width: 300, height: 300 }), []);

  return (
    <View style={styles.tabView}>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={handleIndexChange}
        renderTabBar={renderTabBar}
        // Disable horizontal swipe to prevent conflicts with chart gestures
        swipeEnabled={false}
        lazy
        lazyPreloadDistance={0} // Only render active tab
        renderLazyPlaceholder={() => <LoadingPlaceholder />}
        removeClippedSubviews={true}
        initialLayout={initialLayout} // Provide consistent initial layout
      />
    </View>
  );
}

// Optimize re-renders with memoization and detailed prop comparison
const MemoizedProfileTabs = memo(ProfileTabs, (prevProps, nextProps) => {
  // Compare post arrays by length and IDs
  if (prevProps.myPosts.length !== nextProps.myPosts.length) return false;

  // Only check post IDs if lengths match - to avoid unnecessary iteration
  for (let i = 0; i < prevProps.myPosts.length; i++) {
    if (prevProps.myPosts[i].id !== nextProps.myPosts[i].id) {
      return false;
    }
  }

  // Compare by reference for other array props
  if (prevProps.myNFTs !== nextProps.myNFTs) return false;
  if (prevProps.myActions !== nextProps.myActions) return false;

  // Simple equality for loading/error states
  if (prevProps.loadingNfts !== nextProps.loadingNfts) return false;
  if (prevProps.fetchNftsError !== nextProps.fetchNftsError) return false;
  if (prevProps.loadingActions !== nextProps.loadingActions) return false;
  if (prevProps.fetchActionsError !== nextProps.fetchActionsError) return false;

  // Check portfolio data
  if (prevProps.portfolioData !== nextProps.portfolioData) return false;
  if (prevProps.refreshingPortfolio !== nextProps.refreshingPortfolio) return false;

  // Compare callbacks by reference
  if (prevProps.onPressPost !== nextProps.onPressPost) return false;
  if (prevProps.onRefreshPortfolio !== nextProps.onRefreshPortfolio) return false;
  if (prevProps.onAssetPress !== nextProps.onAssetPress) return false;

  return true;
});

export default MemoizedProfileTabs; 