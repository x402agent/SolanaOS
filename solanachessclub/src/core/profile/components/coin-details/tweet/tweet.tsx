import React from 'react';
import {
  Image,
  Text,
  View,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import {createTweetStyles} from './tweet.style';
import Icons from '@/assets/svgs';

/**
 * Interface representing a single tweet's data structure
 */
interface SingleTweet {
  /** Username of the tweet author */
  username: string;
  /** Twitter handle of the author */
  handle: string;
  /** Time when the tweet was posted */
  time: string;
  /** Main content of the tweet */
  tweetContent: string;
  /** Number of quote tweets */
  quoteCount: number;
  /** Number of retweets */
  retweetCount: number;
  /** Number of reactions/likes */
  reactionCount: number;
  /** Author's avatar image source */
  avatar: any;
}

/**
 * Props for the Tweet component
 */
interface TweetProps {
  /** Array of tweet data to display */
  data: SingleTweet[];
  /** Optional callback for when the tweet is pressed */
  onPress?: () => void;
}

// Example local helper for formatting counts (could also go in a utility file)
const formatCount = (count: number): string => {
  if (count >= 1_000_000) {
    return (count / 1_000_000).toFixed(1) + 'm';
  } else if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'k';
  }
  return count.toString();
};

const reactionIcons = [
  Icons.ReactionIdle,
  Icons.RetweetIdle,
  Icons.CommentIdle,
  Icons.ShareIdle,
  Icons.BookmarkIdle,
];

/**
 * A component that displays a Twitter-like social media post
 * 
 * @component
 * @description
 * Tweet is a comprehensive component that displays social media posts in a
 * Twitter-like format. Each tweet includes:
 * - Author information (username, handle, avatar)
 * - Tweet content with special formatting for $SEND mentions
 * - Engagement metrics (quotes, retweets, reactions)
 * - Interactive elements (buy button, reaction icons)
 * - Thread avatars for conversation visualization
 * 
 * The component is responsive to screen size and supports custom styling
 * through style props. It also includes animations for user interactions
 * and proper formatting for large numbers.
 * 
 * @example
 * ```tsx
 * const tweetData = [{
 *   username: "John Doe",
 *   handle: "@johndoe",
 *   time: "2h",
 *   tweetContent: "Check out $SEND token!",
 *   quoteCount: 5,
 *   retweetCount: 10,
 *   reactionCount: 100,
 *   avatar: require('./avatar.png')
 * }];
 * 
 * <Tweet
 *   data={tweetData}
 *   onPress={() => console.log('Tweet pressed')}
 * />
 * ```
 */
const Tweet: React.FC<TweetProps> = ({data, onPress}) => {
  const {width} = useWindowDimensions();
  const isSmallScreen = width < 400;
  const styles = createTweetStyles(isSmallScreen);

  const handleBuyButtonClick = () => {
    console.log('Buy button clicked!');
    if (onPress) {
      onPress();
    }
  };

  return (
    <>
      {data.map((tweet, index) => (
        <View key={index} style={styles.container}>
          <View style={styles.avatarContainer}>
            <Image source={tweet.avatar} style={styles.avatar} />
          </View>

          <View style={styles.infoContainer}>
            <View style={styles.header}>
              <Text style={styles.username}>{tweet.username}</Text>
              <Icons.BlueCheck />
              <Text style={styles.handle}>
                {tweet.handle} • {tweet.time}
              </Text>
              <Icons.DotsThree style={styles.menuIcon} />
            </View>

            <Text style={styles.tweetText}>
              {tweet.tweetContent.split('$SEND')[0]}
              {tweet.tweetContent.includes('$SEND') && (
                <Text style={styles.sendText}>$SEND</Text>
              )}
            </Text>

            <View style={styles.reactionContainer}>
              <View style={styles.reactionIcons}>
                {reactionIcons.map((Icon, iconIndex) => (
                  <Icon key={iconIndex} />
                ))}
              </View>
              <TouchableOpacity
                style={styles.buyButton}
                accessible={true}
                accessibilityLabel="Buy Button"
                onPress={handleBuyButtonClick}>
                <Text style={styles.buyButtonText}>buy</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.metricsContainer}>
              <View style={styles.threadAvatars}>
                <Image source={tweet.avatar} style={styles.threadAvatar1} />
                <Image
                  source={require('@/assets/images/thread-avatar-1.png')}
                  style={styles.threadAvatar2}
                />
                <Image
                  source={require('@/assets/images/thread-avatar-2.png')}
                  style={styles.threadAvatar3}
                />
              </View>

              <View style={styles.metricsInfo}>
                <Text style={styles.reactionsText}>
                  +{formatCount(tweet.reactionCount)}
                </Text>
                <Text style={styles.metricsText}>
                  •{' '}
                  <Text style={styles.metricsCount}>
                    {formatCount(tweet.retweetCount)}
                  </Text>{' '}
                  Retweet
                </Text>
                <Text style={styles.metricsText}>
                  •{' '}
                  <Text style={styles.metricsCount}>
                    {formatCount(tweet.quoteCount)}
                  </Text>{' '}
                  Quote
                </Text>
              </View>
            </View>
          </View>
        </View>
      ))}
    </>
  );
};

export default Tweet;
