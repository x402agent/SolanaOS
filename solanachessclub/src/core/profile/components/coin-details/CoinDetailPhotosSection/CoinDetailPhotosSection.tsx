import React from 'react';
import {View, Text, StyleProp, ViewStyle} from 'react-native';
import {defaultPhotosSectionStyles} from './CoinDetailPhotosSection.style';

export interface CoinDetailPhotosSectionCustomStyles {
  container?: StyleProp<ViewStyle>;
}

interface CoinDetailPhotosSectionProps {
  customStyles?: CoinDetailPhotosSectionCustomStyles;
}

/**
 * A modular section showing photos related to the coin or user posts
 */
export const CoinDetailPhotosSection: React.FC<
  CoinDetailPhotosSectionProps
> = ({customStyles = {}}) => {
  const styles = defaultPhotosSectionStyles;
  return (
    <View style={[styles.container, customStyles.container]}>
      <Text style={styles.text}>Photos Section</Text>
      {/* Additional content or photo grid can go here */}
    </View>
  );
};
