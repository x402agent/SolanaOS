// FILE: src/components/thread/sections/SectionPoll.tsx
import React from 'react';
import {View, Text} from 'react-native';
import type {PollData} from '../thread.types';

/**
 * Props for the SectionPoll component
 * @interface SectionPollProps
 */
interface SectionPollProps {
  /** The poll data to display */
  pollData?: PollData;
}

/**
 * A component that renders a poll in a post section
 * 
 * @component
 * @description
 * SectionPoll displays a poll with a question and multiple options in a post.
 * Each option shows the number of votes it has received, and the entire poll
 * is displayed in a styled container with a light background.
 * 
 * Features:
 * - Question display
 * - Multiple options support
 * - Vote count display
 * - Consistent styling
 * - Missing data handling
 * 
 * @example
 * ```tsx
 * <SectionPoll
 *   pollData={{
 *     question: "What's your favorite color?",
 *     options: ["Red", "Blue", "Green"],
 *     votes: [10, 15, 8]
 *   }}
 * />
 * ```
 */
export default function SectionPoll({pollData}: SectionPollProps) {
  if (!pollData) {
    return <Text style={{color: '#666'}}>[Missing poll data]</Text>;
  }

  return (
    <View
      style={{
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        padding: 8,
        marginTop: 4,
      }}>
      <Text style={{fontWeight: '600', marginBottom: 6}}>
        {pollData.question}
      </Text>
      {pollData.options.map((option, idx) => (
        <View
          key={`${option}-${idx}`}
          style={{
            backgroundColor: '#ECECEC',
            borderRadius: 4,
            paddingVertical: 6,
            paddingHorizontal: 8,
            marginBottom: 4,
          }}>
          <Text style={{fontSize: 14}}>
            {option} • {pollData.votes[idx] ?? 0} votes
          </Text>
        </View>
      ))}
    </View>
  );
}
