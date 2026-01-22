// FILE: src/components/thread/sections/SectionTextVideo.tsx
import React from 'react';
import {View, Text} from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

/**
 * Props for the SectionTextVideo component
 * @interface SectionTextVideoProps
 */
interface SectionTextVideoProps {
  /** Optional text content to display above the video */
  text?: string;
  /** The URL of the video to display */
  videoUrl?: string;
}

/**
 * A component that renders text content with a video in a post section
 * 
 * @component
 * @description
 * SectionTextVideo displays a combination of text and video content in a post.
 * The text appears above the video, and the video is displayed in a placeholder
 * container with consistent styling. Currently, this component shows a placeholder
 * for the video player, which can be replaced with an actual video player implementation.
 * 
 * Features:
 * - Text and video combination
 * - Optional text content
 * - Placeholder video container
 * - Consistent styling
 * - Rounded corners for video container
 * 
 * @example
 * ```tsx
 * <SectionTextVideo
 *   text="Check out this amazing video!"
 *   videoUrl="https://example.com/video.mp4"
 * />
 * ```
 */
export default function SectionTextVideo({
  text,
  videoUrl,
}: SectionTextVideoProps) {
  return (
    <View>
      {!!text && (
        <Text style={{fontSize: 15, color: COLORS.white, marginBottom: 8, lineHeight: 20, fontFamily: TYPOGRAPHY.fontFamily}}>
          {text}
        </Text>
      )}
      {/* Placeholder for video player */}
      <View
        style={{
          padding: 10,
          backgroundColor: '#EEE',
          borderRadius: 8,
          marginTop: 4,
        }}>
        <Text style={{color: '#666', textAlign: 'center'}}>
          [Video Player Placeholder]
        </Text>
        {videoUrl ? (
          <Text style={{marginTop: 4, color: '#999'}}>URL: {videoUrl}</Text>
        ) : null}
      </View>
    </View>
  );
}
