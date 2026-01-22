// FILE: src/components/thread/sections/SectionTextOnly.tsx
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import React from 'react';
import {Text} from 'react-native';

/**
 * Props for the SectionTextOnly component
 * @interface SectionTextOnlyProps
 */
interface SectionTextOnlyProps {
  /** The text content to display */
  text?: string;
}

/**
 * A component that renders plain text content in a post section
 * 
 * @component
 * @description
 * SectionTextOnly is a simple component that displays text content in a post.
 * It provides basic text styling with a consistent font size and color.
 * 
 * Features:
 * - Plain text display
 * - Consistent styling
 * - Optional text content
 * 
 * @example
 * ```tsx
 * <SectionTextOnly text="Hello, world!" />
 * ```
 */
export default function SectionTextOnly({text = ''}: SectionTextOnlyProps) {
  return (
    <Text style={{
      fontSize: 15, 
      color: COLORS.white, 
      marginBottom: 0,
      lineHeight: 20,
      fontFamily: TYPOGRAPHY.fontFamily
    }}>
      {text}
    </Text>
  );
}
