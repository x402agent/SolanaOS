import React from 'react';
import {View, Text, FlatList, StyleProp, ViewStyle} from 'react-native';
import Icons from '../../../../../assets/svgs';
import {defaultPeopleSectionStyles} from './CoinDetailPeopleSection.style';
import SuggestionsCard from '../suggestionsCard/suggestionsCard';
import UserListing from '../userListing/userListing';

export interface CoinDetailPeopleSectionCustomStyles {
  container?: StyleProp<ViewStyle>;
}

interface CoinDetailPeopleSectionProps {
  customStyles?: CoinDetailPeopleSectionCustomStyles;
}

/**
 * A modular section showing people who hold the token or user suggestions
 */
export const CoinDetailPeopleSection: React.FC<
  CoinDetailPeopleSectionProps
> = ({customStyles = {}}) => {
  const styles = defaultPeopleSectionStyles;
  const cardData = Array(10).fill({});
  const renderCard = () => (
    <View style={styles.cardContainer}>
      <SuggestionsCard />
    </View>
  );

  return (
    <View style={[styles.container, customStyles.container]}>
      <View style={styles.content}>
        <View style={styles.holdersHeader}>
          <Icons.infoIcon />
          <Text style={styles.holdersTitle}>Top Holders of SEND</Text>
        </View>
      </View>

      <View>
        <FlatList
          horizontal
          data={cardData}
          renderItem={renderCard}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardList}
        />
      </View>

      <View style={styles.userList}>
        <UserListing />
      </View>
    </View>
  );
};
