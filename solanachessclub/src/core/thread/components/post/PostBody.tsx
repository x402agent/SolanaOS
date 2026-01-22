// FILE: src/components/thread/post/PostBody.tsx
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { createPostBodyStyles } from './PostBody.styles';
import { ThreadPost } from '../thread.types';
import SectionTextOnly from '../sections/SectionTextOnly';
import SectionTextImage from '../sections/SectionTextImage';
import SectionTextVideo from '../sections/SectionTextVideo';
import SectionPoll from '../sections/SectionPoll';
import SectionTrade from '../sections/SectionTrade';
import SectionNftListing from '../sections/SectionNftListing';
import COLORS from '@/assets/colors';

/**
 * Props for the PostBody component
 * @interface PostBodyProps
 */
interface PostBodyProps {
  /** The post data to display in the body */
  post: ThreadPost;
  /** Theme overrides for customizing appearance */
  themeOverrides?: Partial<Record<string, any>>;
  /** Style overrides for specific components */
  styleOverrides?: { [key: string]: object };
  /**
   * A numeric value used to refresh the trade chart in SectionTrade,
   * if it's included in the post's sections.
   */
  externalRefreshTrigger?: number;
  /** Indicates if this post is being displayed as a retweet */
  isRetweet?: boolean;
}

/**
 * Renders a single post section by delegating to the appropriate section component
 */
function renderSection(
  section: ThreadPost['sections'][number],
  user: ThreadPost['user'],
  createdAt: string,
  externalRefreshTrigger?: number,
) {
  const sectionKey = `${section.id}-${section.type}`;

  switch (section.type) {
    case 'TEXT_ONLY':
      return <SectionTextOnly key={sectionKey} text={section.text} />;

    case 'TEXT_IMAGE':
      return (
        <SectionTextImage
          key={sectionKey}
          text={section.text}
          imageUrl={section.imageUrl}
        />
      );

    case 'TEXT_VIDEO':
      return (
        <SectionTextVideo
          key={sectionKey}
          text={section.text}
          videoUrl={section.videoUrl}
        />
      );

    case 'TEXT_TRADE':
      return (
        <SectionTrade
          key={sectionKey}
          text={section.text}
          tradeData={section.tradeData}
          user={user}
          createdAt={createdAt}
          externalRefreshTrigger={externalRefreshTrigger}
        />
      );

    case 'POLL':
      return <SectionPoll key={sectionKey} pollData={section.pollData} />;

    case 'NFT_LISTING':
      return <SectionNftListing key={sectionKey} listingData={section.listingData} />;

    default:
      return null;
  }
}

function PostBody({
  post,
  themeOverrides,
  styleOverrides,
  externalRefreshTrigger,
  isRetweet,
}: PostBodyProps) {
  // Memoize styles (no theme needed)
  const styles = useMemo(() => createPostBodyStyles(styleOverrides), [
    styleOverrides,
  ]);

  const { user, createdAt, sections = [] } = post;

  // Memoize the sections rendering to prevent re-creation on every render
  const renderedSections = useMemo(() => {
    // Additional safety check to ensure sections is always an array
    const safeSections = Array.isArray(sections) ? sections : [];

    // Debug logging
    if (!Array.isArray(sections)) {
      console.warn('[PostBody] sections is not an array:', typeof sections, sections);
    }

    return safeSections.map(section => (
      <View key={section.id} style={styles.extraContentContainer}>
        <View style={{ width: '100%' }}>
          {renderSection(section, user, createdAt, externalRefreshTrigger)}
        </View>
      </View>
    ));
  }, [sections, user, createdAt, externalRefreshTrigger, styles.extraContentContainer]);

  return (
    <View style={{
      marginTop: 0,
      padding: 0,
      backgroundColor: isRetweet ? COLORS.lighterBackground : COLORS.background
    }}>
      {renderedSections}
    </View>
  );
}

/**
 * Memo comparison to skip re-renders unless `post` or style props actually change.
 */
function arePropsEqual(prev: PostBodyProps, next: PostBodyProps): boolean {
  // Compare post IDs
  if (prev.post.id !== next.post.id) return false;

  // Compare number of sections
  const prevSections = prev.post.sections || [];
  const nextSections = next.post.sections || [];
  if (prevSections.length !== nextSections.length) return false;

  // Compare each section by id & type
  for (let i = 0; i < prevSections.length; i++) {
    if (
      prevSections[i].id !== nextSections[i].id ||
      prevSections[i].type !== nextSections[i].type
    ) {
      return false;
    }

    // For trade sections, check tradeData
    if (prevSections[i].type === 'TEXT_TRADE') {
      const prevTrade = prevSections[i].tradeData;
      const nextTrade = nextSections[i].tradeData;

      if (!prevTrade || !nextTrade) {
        if (prevTrade !== nextTrade) return false;
        continue;
      }

      // Deep compare important trade data fields
      if (prevTrade.inputMint !== nextTrade.inputMint) return false;
      if (prevTrade.outputMint !== nextTrade.outputMint) return false;
      if (prevTrade.inputQuantity !== nextTrade.inputQuantity) return false;
      if (prevTrade.outputQuantity !== nextTrade.outputQuantity) return false;
    }
  }

  // Compare theme/style references
  if (prev.themeOverrides !== next.themeOverrides) return false;
  if (prev.styleOverrides !== next.styleOverrides) return false;
  if (prev.isRetweet !== next.isRetweet) return false;

  // Compare externalRefreshTrigger
  if (prev.externalRefreshTrigger !== next.externalRefreshTrigger) return false;

  return true;
}

export default React.memo(PostBody, arePropsEqual);
