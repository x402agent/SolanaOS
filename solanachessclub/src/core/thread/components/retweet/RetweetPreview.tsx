// FILE: src/components/thread/retweet/RetweetPreview.tsx

import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { ThreadPost } from '../thread.types';
import PostBody from '../post/PostBody';
import { createThreadStyles } from '../thread.styles';
import Icons from '../../../../assets/svgs';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

interface RetweetPreviewProps {
  retweetOf: ThreadPost;
  onPress?: (post: ThreadPost) => void;
  themeOverrides?: Partial<Record<string, any>>;
  styleOverrides?: { [key: string]: object };
}

export default function RetweetPreview({
  retweetOf,
  onPress,
  themeOverrides,
  styleOverrides,
}: RetweetPreviewProps) {
  // State for toggling between collapsed and expanded
  const hasTradeSection = retweetOf.sections.some(
    section => section.type === 'TEXT_TRADE',
  );
  const [expanded, setExpanded] = useState(hasTradeSection || false);

  // Check if this is a quote retweet (has sections with text)
  const isQuoteRetweet = retweetOf.sections && retweetOf.sections.length > 0;
  const quoteText = isQuoteRetweet
    ? retweetOf.sections.find(s => s.text)?.text
    : '';

  // Use default theme with styleOverrides
  const styles = createThreadStyles(styleOverrides);

  // If the retweeted user's avatar is a string, we treat it as a URI
  const avatarSource =
    typeof retweetOf.user.avatar === 'string'
      ? { uri: retweetOf.user.avatar }
      : retweetOf.user.avatar;

  const textSection = retweetOf.sections.find(s => s.text);
  const textLength = textSection?.text?.length ?? 0;
  const multipleSections = retweetOf.sections.length > 1;
  const isTruncatable = multipleSections || textLength > 100;

  const handlePressShowTweet = () => {
    if (onPress) {
      onPress(retweetOf);
    }
  };

  // Calculate if we're viewing text, image, video, or other content
  const hasImage = retweetOf.sections.some(s => s.type === 'TEXT_IMAGE' && s.imageUrl);
  const hasVideo = retweetOf.sections.some(s => s.type === 'TEXT_VIDEO' && s.videoUrl);
  const hasTrade = hasTradeSection;

  return (
    <View style={localStyles.container}>
      {/* Retweet indicator */}
      <View style={localStyles.retweetIndicator}>
        <Icons.RetweetIdle width={12} height={12} color={COLORS.greyMid} />
        <Text style={localStyles.retweetText}>Retweet</Text>
      </View>

      {/* Quote text if this is a quote retweet */}
      {isQuoteRetweet && quoteText && (
        <View style={localStyles.quoteContainer}>
          <Text style={localStyles.quoteText}>{quoteText}</Text>
        </View>
      )}

      {/* Header row (avatar + name/handle) */}
      <View style={localStyles.headerRow}>
        <Image source={avatarSource} style={localStyles.avatar} />
        <View style={localStyles.userInfo}>
          <Text style={localStyles.username} numberOfLines={1}>{retweetOf.user.username}</Text>
          <Text style={localStyles.handle} numberOfLines={1}>{retweetOf.user.handle}</Text>
        </View>
      </View>

      {/* The post body, collapsed or expanded */}
      <View style={localStyles.bodyContainer}>
        {expanded ? (
          // Show entire PostBody
          <PostBody
            post={retweetOf}
            themeOverrides={themeOverrides}
            styleOverrides={styleOverrides as any}
            isRetweet={true}
          />
        ) : (
          // Collapsed: wrap PostBody in a container with limited height
          <View style={[
            localStyles.collapsedContainer,
            (hasImage || hasVideo) ? localStyles.mediaContainer : {},
            hasTrade ? { maxHeight: 300 } : {}
          ]}>
            <PostBody
              post={retweetOf}
              themeOverrides={themeOverrides}
              styleOverrides={styleOverrides as any}
              isRetweet={true}
            />
          </View>
        )}
      </View>

      {/* Footer with actions */}
      <View style={localStyles.footerContainer}>
        {/* Show "See More"/"See Less" only if content is large enough */}
        {isTruncatable && (
          <TouchableOpacity
            style={localStyles.actionButton}
            onPress={() => setExpanded(!expanded)}
          >
            <Text style={localStyles.actionButtonText}>
              {expanded ? 'See Less' : 'See More'}
            </Text>
          </TouchableOpacity>
        )}

        {/* "Show Tweet" button, if onPress is provided */}
        {onPress && (
          <TouchableOpacity
            style={localStyles.actionButton}
            onPress={handlePressShowTweet}
          >
            <Text style={localStyles.actionButtonText}>View Original</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
    // borderWidth: 1,
    // borderColor: COLORS.background,
    backgroundColor: COLORS.lighterBackground,
  },
  retweetIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  retweetText: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.greyMid,
    marginLeft: 4,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.greyLight,
  },
  userInfo: {
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
  },
  username: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.bold),
    color: COLORS.white,
  },
  handle: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.greyMid,
    marginTop: 1,
  },
  bodyContainer: {
    marginBottom: 8,
  },
  collapsedContainer: {
    maxHeight: 150,
    overflow: 'hidden',
  },
  mediaContainer: {
    maxHeight: 240, // Taller for media content
  },
  footerContainer: {
    flexDirection: 'row',
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.borderDarkColor,
    paddingTop: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.lighterBackground,
    marginRight: 8,
  },
  actionButtonText: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.brandPrimary,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
  },
  quoteContainer: {
    marginBottom: 8,
  },
  quoteText: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.white,
  },
});
