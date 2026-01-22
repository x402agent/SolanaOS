import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MessageBubbleProps, MessageData, NFTData, NftListingData } from './message.types';
import { messageBubbleStyles } from './message.styles';
import { mergeStyles } from '@/core/thread/utils';
import { IPFSAwareImage, getValidImageSource, fixIPFSUrl } from '@/shared/utils/IPFSImage';
import MessageTradeCard from './MessageTradeCard';
import MessageNFT from './MessageNFT';
import COLORS from '@/assets/colors';
import { DEFAULT_IMAGES } from '@/shared/config/constants';
import Icons from '@/assets/svgs';
import { ThreadPost } from '@/core/thread/components/thread.types';

// Custom Retweet icon since it doesn't exist in the Icons object
const RetweetIcon = ({ width = 14, height = 14, color = COLORS.greyLight }) => (
  <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: width * 0.7, height: height * 0.7, borderWidth: 1.5, borderColor: color, borderRadius: 2 }}>
      <View style={{ position: 'absolute', top: -3, right: -3, width: width * 0.4, height: height * 0.4, borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: color, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', bottom: -3, left: -3, width: width * 0.4, height: height * 0.4, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderColor: color, transform: [{ rotate: '45deg' }] }} />
    </View>
  </View>
);

function MessageBubble({ message, isCurrentUser, themeOverrides, styleOverrides }: MessageBubbleProps) {
  // Log 1: Incoming message structure
  // console.log('[MessageBubble] Received message prop:', JSON.stringify(message, null, 2));

  // Use utility function to merge styles
  const styles = mergeStyles(
    messageBubbleStyles,
    styleOverrides,
    undefined
  );

  // Determine the actual data source, safely checking for additional_data
  const hasAdditionalData = 'additional_data' in message && message.additional_data !== null && message.additional_data !== undefined;
  const messageDataSource = hasAdditionalData ? message.additional_data : message;
  // Log 1.1: Determined data source
  // console.log('[MessageBubble] Determined messageDataSource:', messageDataSource);

  // Check if this is a retweet
  const isRetweet = 'retweetOf' in message && message.retweetOf !== undefined && message.retweetOf !== null;
  const isQuoteRetweet = isRetweet && 'sections' in message && message.sections && message.sections.length > 0;

  // Use the determined data source for display
  const postToDisplay = isRetweet && message.retweetOf ? message.retweetOf : messageDataSource;

  // Determine message style based on sender
  const bubbleStyle = [
    styles.container,
    isCurrentUser ? styles.currentUser : styles.otherUser
  ];

  // Determine text style based on sender
  const textStyle = [
    styles.text,
    isCurrentUser ? styles.currentUserText : styles.otherUserText
  ];

  // Update getContentType to check additional_data safely
  const getContentType = (msg: MessageData | ThreadPost): string => {
    const source = ('additional_data' in msg && msg.additional_data) ? msg.additional_data : msg;

    // Type guard to ensure source is not null/undefined if it came from additional_data
    if (!source) return 'text';

    if ('contentType' in source && source.contentType) return source.contentType;
    // Check specific data fields if they exist on the source
    if ('tradeData' in source && source.tradeData) return 'trade';
    if ('nftData' in source && source.nftData) return 'nft';
    if ('media' in source && source.media && source.media.length > 0) return 'media';
    if ('image_url' in source && source.image_url) return 'image';

    if ('sections' in source && source.sections) {
      const sections = source.sections as any[];
      if (sections.some(section => section.type === 'TEXT_TRADE' && section.tradeData)) return 'trade';
      if (sections.some(section => section.type === 'NFT_LISTING' && section.listingData)) return 'nft';
      if (sections.some(section => section.type === 'TEXT_IMAGE' || section.imageUrl || section.type === 'TEXT_VIDEO' || section.videoUrl)) return 'media';
    }

    return 'text';
  };

  const contentType = getContentType(message);
  // Log 2: Determined content type
  // Update getMessageText to check additional_data safely
  const getMessageText = (post: any) => {
    const source = ('additional_data' in post && post.additional_data) ? post.additional_data : post;
    if (!source) return '';
    return ('sections' in source && source.sections)
      ? source.sections.map((section: any) => section.text).join('\n')
      : ('text' in source ? source.text : '') || '';
  };

  const messageText = getMessageText(postToDisplay);

  // Update getMediaUrls to check additional_data safely
  const getMediaUrls = (post: any) => {
    const source = ('additional_data' in post && post.additional_data) ? post.additional_data : post;
    if (!source) return [];
    if ('media' in source && source.media) {
      return source.media;
    } else if ('sections' in source && source.sections) {
      return source.sections
        .filter((section: any) => section.type === 'TEXT_IMAGE' || section.imageUrl)
        .map((section: any) => section.imageUrl || '');
    }
    return [];
  };

  const mediaUrls = getMediaUrls(postToDisplay);
  const hasMedia = mediaUrls.length > 0;

  // Get trade data (check additional_data first)
  const getTradeDataFromSections = (post: any) => {
    if ('sections' in post && post.sections) {
      const tradeSection = post.sections.find((section: any) =>
        section.type === 'TEXT_TRADE' && section.tradeData
      );
      return tradeSection?.tradeData;
    }
    return null;
  };

  // Get NFT data (check additional_data first)
  const getNftDataFromSections = (post: any) => {
    if ('sections' in post && post.sections) {
      const nftSection = post.sections.find((section: any) =>
        section.type === 'NFT_LISTING' && section.listingData
      );

      if (nftSection?.listingData) {
        // Get the raw listing data without type conversion
        const listingData = nftSection.listingData;

        // Use explicit extraction to ensure we get all the fields correctly
        return {
          id: listingData.mint || nftSection.id || 'unknown-nft',
          name: listingData.name || 'NFT',
          description: listingData.collectionDescription || listingData.name || '',
          image: listingData.image || '',
          collectionName: listingData.collectionName || '',
          mintAddress: listingData.mint || '' // This is critical - ensure we get the mint address
        };
      }
    }
    return null;
  };

  // Update tradeData retrieval with null check
  const tradeData =
    (hasAdditionalData && messageDataSource && 'tradeData' in messageDataSource ? messageDataSource.tradeData :
      (postToDisplay && 'tradeData' in postToDisplay && postToDisplay.tradeData) ||
      getTradeDataFromSections(postToDisplay)) || null; // Default to null
  // Log 3.1: Extracted tradeData
  // Update nftData retrieval with null check
  const rawNftData =
    (hasAdditionalData && messageDataSource && 'nftData' in messageDataSource ? messageDataSource.nftData :
      (postToDisplay && 'nftData' in postToDisplay && postToDisplay.nftData) ||
      getNftDataFromSections(postToDisplay)) || null; // Default to null
  // Log 3.2: Extracted rawNftData
  // if (rawNftData) console.log(`[MessageBubble] Message ID ${message.id} - Extracted rawNftData:`, rawNftData);

  // Harmonize rawNftData into the NFTData structure expected by MessageNFT
  const nftData: NFTData | null = useMemo(() => {
    if (!rawNftData) {
      return null;
    }

    // Check if rawNftData is NftListingData (from additional_data or getNftDataFromSections)
    // Use presence of collId or isCollection to determine if it's collection data
    if (('collId' in rawNftData && rawNftData.collId) || ('isCollection' in rawNftData && rawNftData.isCollection)) {
      const listing = rawNftData as Partial<NftListingData> & { isCollection?: boolean; collId?: string; mint?: string; description?: string; }; // Add description to type
      return {
        id: listing.collId || listing.mint || 'unknown-id', // Prioritize collId if available
        name: listing.name || 'NFT Listing',
        description: listing.collectionDescription || listing.description || '', // Now safely accessed
        image: listing.image || listing.collectionImage || '',
        collectionName: listing.collectionName || '',
        mintAddress: listing.mint || '', // Keep mint address if present
        isCollection: listing.isCollection || false, // Preserve isCollection flag
        collId: listing.collId || '', // Preserve collection ID
      };
    }

    // Check if it's the older NFTData structure (if still used directly on message)
    else if ('id' in rawNftData && 'mintAddress' in rawNftData) {
      // It's likely the original NFTData structure
      // Ensure we return isCollection and collId if they exist, defaulting to false/empty
      return {
        ...rawNftData,
        isCollection: ('isCollection' in rawNftData && rawNftData.isCollection) || false,
        collId: ('collId' in rawNftData && rawNftData.collId) || ''
      } as NFTData;
    }

    // Fallback if structure is unexpected
    console.warn('Unexpected rawNftData structure:', rawNftData);
    // Attempt a basic mapping as a fallback
    return {
      id: ('id' in rawNftData ? rawNftData.id : null) || ('mint' in rawNftData ? rawNftData.mint : null) || 'unknown-fallback-id',
      name: ('name' in rawNftData ? rawNftData.name : null) || 'Unknown NFT',
      image: ('image' in rawNftData ? rawNftData.image : null) || '',
      mintAddress: ('mint' in rawNftData ? rawNftData.mint : null) || '',
      isCollection: ('isCollection' in rawNftData && rawNftData.isCollection) || false,
      collId: ('collId' in rawNftData ? rawNftData.collId : null) || '',
    };

  }, [rawNftData]);
  // Log 3.3: Harmonized nftData

  // Update renderPostContent to handle potential null source from additional_data
  const renderPostContent = (post: any) => {
    // Determine the source safely
    const source = ('additional_data' in post && post.additional_data) ? post.additional_data : post;

    // If source is null (e.g., from additional_data being null), render nothing or fallback
    if (!source) {
      // console.warn("RenderPostContent received null source");
      return null;
    }

    const postContentType = getContentType(post); // Get type from original message structure

    switch (postContentType) {
      case 'image':
        return (
          <View style={styles.messageContent}>
            <View style={styles.imageContainer}>
              <IPFSAwareImage
                source={getValidImageSource(source.image_url)}
                style={styles.messageImage}
                defaultSource={DEFAULT_IMAGES.placeholder}
                resizeMode="cover"
              />
            </View>
            {'text' in source && source.text && source.text.trim() !== '' && (
              <Text style={[textStyle, styles.imageCaption]}>{source.text}</Text>
            )}
          </View>
        );
      case 'trade':
        if (tradeData) {
          return <MessageTradeCard tradeData={tradeData} isCurrentUser={isCurrentUser} userAvatar={('user' in post && post.user?.avatar) || ('user' in source && source.user?.avatar)} />;
        } else {
          console.log(`[MessageBubble] Message ID ${message.id} - ContentType is 'trade' but tradeData is null/falsy.`);
        }
        break;
      case 'nft':
        if (nftData) {
          return <MessageNFT nftData={nftData} isCurrentUser={isCurrentUser} />;
        } else {
          console.log(`[MessageBubble] Message ID ${message.id} - ContentType is 'nft' but nftData is null/falsy.`);
        }
        break;
      case 'media':
        const mediaDataSource = ('sections' in source && source.sections) ? source : post;
        return (
          <View>
            {getMessageText(mediaDataSource) && <Text style={textStyle}>{getMessageText(mediaDataSource)}</Text>}
            <View style={styles.mediaContainer}>
              {getMediaUrls(mediaDataSource).map((mediaUrl: string, index: number) => (
                <IPFSAwareImage key={`media-${index}`} source={getValidImageSource(mediaUrl)} style={styles.mediaImage} resizeMode="cover" />
              ))}
            </View>
          </View>
        );
      case 'text':
      default:
        // Ensure text is accessed safely from the correct source
        const textToShow = ('text' in source) ? source.text : ('text' in post ? post.text : '');
        return <Text style={textStyle}>{textToShow}</Text>;
    }
    return null; // Add default return null
  };

  // If this is a retweet, show it with the retweet header
  if (isRetweet && message.retweetOf) {
    // For quote retweets, show the user's added content first
    const quoteContent = isQuoteRetweet && message.sections && message.sections.length > 0 ? (
      <View style={styles.quoteContent}>
        {message.sections.map((section: any, index: number) => (
          <Text key={`quote-${index}`} style={textStyle}>
            {section.text}
          </Text>
        ))}
      </View>
    ) : null;

    return (
      <View style={styles.retweetContainer}>
        {/* Retweet indicator */}
        <View style={styles.retweetHeader}>
          {/* Attempt to use RetweetIdle icon if available, otherwise use text */}
          {Icons.RetweetIdle ? (
            <Icons.RetweetIdle width={12} height={12} color={COLORS.greyMid} />
          ) : (
            <View style={styles.retweetIcon} />
          )}
          <Text style={styles.retweetHeaderText}>
            {message.user?.username || 'User'} Retweeted
          </Text>
        </View>

        {/* Quote content if this is a quote retweet */}
        {quoteContent}

        {/* Original post content */}
        <View style={styles.originalPostContainer}>
          {/* Original post user */}
          <View style={styles.originalPostHeader}>
            <IPFSAwareImage
              source={
                message.retweetOf.user?.avatar
                  ? getValidImageSource(message.retweetOf.user.avatar)
                  : DEFAULT_IMAGES.user
              }
              style={styles.originalPostAvatar}
              defaultSource={DEFAULT_IMAGES.user}
            />
            <View>
              <Text style={styles.originalPostUsername}>
                {message.retweetOf.user?.username || 'User'}
              </Text>
              <Text style={styles.originalPostHandle}>
                {message.retweetOf.user?.handle || '@user'}
              </Text>
            </View>
          </View>

          {/* Original post content */}
          {renderPostContent(message.retweetOf)}
        </View>
      </View>
    );
  }

  // For trade and NFT content, return without the bubble container
  if (contentType === 'trade' || contentType === 'nft') {
    return (
      <View style={bubbleStyle}>
        {renderPostContent(postToDisplay)}
      </View>
    );
  }

  // Render when the content type is text
  if (contentType === 'text') {
    return (
      <View style={bubbleStyle}>
        {isRetweet && (
          <View style={styles.retweetHeader}>
            <RetweetIcon />
            <Text style={styles.retweetText}>Retweet{isQuoteRetweet ? 'ed with comment' : ''}</Text>
          </View>
        )}
        <Text style={textStyle}>{messageText || ''}</Text>
      </View>
    );
  }

  // For text and media content, wrap in a bubble
  return (
    <View style={bubbleStyle}>
      {isRetweet && !isQuoteRetweet && (
        <View style={styles.retweetHeader}>
          <RetweetIcon width={14} height={14} color={COLORS.greyLight} />
          <Text style={styles.retweetText}>Reposted</Text>
        </View>
      )}
      {renderPostContent(postToDisplay)}
    </View>
  );
}

export default MessageBubble; 