import React, {useState} from 'react';
import {SafeAreaView, Text, TouchableOpacity, View} from 'react-native';
import {styles} from './CoinDetailPage.style';
import {CoinDetailTopSection} from '../../../../core/profile/components/coin-details/CoinDetailTopSection/CoinDetailTopSection';
import {CoinDetailLatestSection} from '../../../../core/profile/components/coin-details/CoinDetailLatestSection/CoinDetailLatestSection';
import {CoinDetailPeopleSection} from '../../../../core/profile/components/coin-details/CoinDetailPeopleSection/CoinDetailPeopleSection';
import {CoinDetailPhotosSection} from '../../../../core/profile/components/coin-details/CoinDetailPhotosSection/CoinDetailPhotosSection';
import {CoinDetailVideosSection} from '../../../../core/profile/components/coin-details/CoinDetailVideosSection/CoinDetailVideosSection';
import {DEFAULT_IMAGES} from '@/shared/config/constants';

// Import the new modular components

// Example mock data for top section
const graphData = {
  '1H': [50, 48, 52, 51, 49, 53, 52, 50, 51, 52, 51, 53],
  '1D': [45, 47, 46, 52, 50, 55, 58, 56, 60, 58, 62, 65],
  '1W': [40, 45, 43, 48, 52, 50, 55, 58, 54, 60, 58, 63],
  '1M': [30, 35, 45, 42, 55, 52, 58, 65, 75, 72, 78, 85],
  All: [10, 15, 25, 35, 32, 45, 55, 65, 75, 85, 88, 95],
};

const tweetData = [
  {
    username: 'SendAI',
    handle: '@SendAI',
    time: '2h',
    tweetContent: 'Building the future of Solana with $SEND',
    quoteCount: 123,
    retweetCount: 456,
    reactionCount: 789,
    avatar: DEFAULT_IMAGES.SENDlogo,
  },
  {
    username: 'SolanaBuilder',
    handle: '@SolanaBuilder',
    time: '4h',
    tweetContent:
      'Just bought more $SEND tokens! The ecosystem is growing fast 🚀',
    quoteCount: 245,
    retweetCount: 678,
    reactionCount: 912,
    avatar: DEFAULT_IMAGES.SENDlogo,
  },
];

const CoinDetailPage = () => {
  const [selectedItem, setSelectedItem] = useState('Top');

  const renderSection = () => {
    switch (selectedItem) {
      case 'Top':
        return (
          <CoinDetailTopSection
            tweetData={tweetData}
            // customStyles={{ container: { backgroundColor: '#f2f2f2' } }}
          />
        );
      case 'Latest':
        return <CoinDetailLatestSection />;
      case 'People':
        return <CoinDetailPeopleSection />;
      case 'Photos':
        return <CoinDetailPhotosSection />;
      case 'Videos':
        return <CoinDetailVideosSection />;
      default:
        return (
          <CoinDetailTopSection tweetData={tweetData} />
        );
    }
  };

  return (
    <View style={styles.container}>
      <View>
        <View style={styles.headerList}>
          <View style={styles.list}>
            {['Top', 'Latest', 'People', 'Photos', 'Videos'].map(item => (
              <TouchableOpacity
                key={item}
                onPress={() => setSelectedItem(item)}>
                <Text
                  style={[
                    styles.menuItem,
                    selectedItem === item && styles.menuItemSelected,
                  ]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.MainSection}>{renderSection()}</View>
    </View>
  );
};

export default CoinDetailPage;
