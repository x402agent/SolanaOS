import React from 'react';
import {Image, Text, TouchableOpacity, View} from 'react-native';
import {styles} from './suggestionsCard.style';

/**
 * A component that displays user suggestions with follow functionality
 * 
 * @component
 * @description
 * SuggestionsCard is a component that presents user suggestions in a visually
 * appealing card format. The component includes:
 * - A background image for visual appeal
 * - User profile picture
 * - Username and handle display
 * - Follow button for user interaction
 * 
 * The component uses a layered design approach with background and profile
 * images, and maintains consistent styling through a dedicated style file.
 * 
 * @example
 * ```tsx
 * <SuggestionsCard />
 * ```
 * 
 * Note: Currently uses hardcoded values for user information.
 * Future iterations could accept props for user data.
 */
const SuggestionsCard = () => {
  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/suggestionCardBg.png')}
        style={styles.image}
      />
      <View style={styles.imgBox}>
        <Image
          source={require('@/assets/images/hands.png')}
          style={styles.profImg}
        />
      </View>

      <View style={styles.userInfoContainer}>
        <Text style={styles.usernameText}>0X5</Text>
        <Text style={styles.handleText}>@0X33</Text>
      </View>

      {/* Follow Button */}
      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Follow</Text>
      </TouchableOpacity>
    </View>
  );
};

export default SuggestionsCard;
