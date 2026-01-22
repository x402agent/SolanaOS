import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
  ViewStyle,
  StyleProp,
  ActivityIndicator,
} from 'react-native';
import {FlatList} from 'react-native-gesture-handler';
import Icons from '@/assets/svgs/index';
import {defaultTopSectionStyles} from './CoinDetailTopSection.style';
import SuggestionsCard from '../suggestionsCard/suggestionsCard';
import Tweet from '../tweet/tweet';
import {useCoingecko, Timeframe} from '@/modules/data-module/hooks/useCoingecko';
import {
  formatAmount,
  formatLiquidityAsPercentage,
} from '@/shared/utils/common/format';
import {CoinDetailSearchBar} from '../CoinDetailSearchBar/CoinDetailSearchBar';
import LineGraph from '@/core/shared-ui/TradeCard/LineGraph';

export interface CoinDetailTopSectionCustomStyles {
  container?: StyleProp<ViewStyle>;
}

interface CoinDetailTopSectionProps {
  tweetData: Array<{
    username: string;
    handle: string;
    time: string;
    tweetContent: string;
    quoteCount: number;
    retweetCount: number;
    reactionCount: number;
    avatar: any;
  }>;
  customStyles?: CoinDetailTopSectionCustomStyles;
}

/**
 * A top-level component for coin details.
 * It includes a search bar, chart, stats, etc.
 */
export const CoinDetailTopSection: React.FC<CoinDetailTopSectionProps> = ({
  tweetData,
  customStyles = {},
}) => {
  // We'll keep a local state for "selectedCoinId", e.g. 'bitcoin'
  const [selectedCoinId, setSelectedCoinId] = useState<string>('bitcoin');
  // State for coin name and image
  const [coinName, setCoinName] = useState<string>('Bitcoin');
  const [coinImage, setCoinImage] = useState<string | undefined>(undefined);
  
  // Now we consume the Coingecko hook
  const {
    setSelectedCoinId: setGlobalCoinId,
    timeframe,
    setTimeframe,
    graphData,
    timeframePrice,
    timeframeChangeUsd,
    timeframeChangePercent,
    marketCap,
    liquidityScore,
    fdv,
    loadingOHLC,
    coinError,
    coinList,
  } = useCoingecko();

  // Each time user picks a different coin => update global state
  useEffect(() => {
    // Force the hook to fetch data for this coin ID
    setGlobalCoinId(selectedCoinId.toLowerCase());
    
    // Find coin details in coinList
    const selectedCoin = coinList.find(coin => coin.id.toLowerCase() === selectedCoinId.toLowerCase());
    if (selectedCoin) {
      setCoinName(selectedCoin.name);
      // Note: coinList doesn't contain image URLs, we'd need to fetch or derive this
      // For now, we'll use a placeholder URL based on the coin ID
      setCoinImage(`https://assets.coingecko.com/coins/images/1/small/${selectedCoinId}.png`);
    }
  }, [selectedCoinId, setGlobalCoinId, coinList]);

  // For the modal with expanded chart
  const [modalVisible, setModalVisible] = useState(false);

  const styles = defaultTopSectionStyles;

  // We'll have some dummy data for "recently purchased"
  const cardData = Array(10).fill({});

  const renderCard = () => <SuggestionsCard />;

  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
  };

  // price, changes, etc
  const displayedPrice = `$${timeframePrice.toFixed(6)}`;
  const absChangeStr =
    timeframeChangeUsd >= 0
      ? `+$${timeframeChangeUsd.toFixed(6)}`
      : `-$${Math.abs(timeframeChangeUsd).toFixed(6)}`;
  const pctChangeStr =
    timeframeChangePercent >= 0
      ? `+${timeframeChangePercent.toFixed(2)}%`
      : `-${Math.abs(timeframeChangePercent).toFixed(2)}%`;

  return (
    <View style={[styles.container, customStyles.container]}>
      {/* 
        CoinDetailSearchBar => user picks a coin => setSelectedCoinId => 
        triggers hook to fetch 
      */}
      <CoinDetailSearchBar
        onSelectCoinId={(coinId: string) => setSelectedCoinId(coinId)}
      />

      {coinError && (
        <Text style={{color: 'red', paddingHorizontal: 16}}>
          Error: {coinError}
        </Text>
      )}

      <ScrollView>
        <View style={styles.content}>
          {/* Basic coin info */}
          <View style={styles.coin}>
            {coinImage ? (
              <Image source={{uri: coinImage}} style={styles.avatar} />
            ) : null}
            <Text style={styles.coinText}>
              {coinName || 'Select a coin to load...'}
            </Text>
          </View>

          {/* Price + changes */}
          <View style={styles.priceContainer}>
            <Text style={styles.mainPrice}>{displayedPrice}</Text>
            <View style={styles.statsContainer}>
              <Text
                style={
                  timeframeChangeUsd >= 0
                    ? styles.statsTextPositive
                    : styles.statsTextNegative
                }>
                {absChangeStr}
              </Text>
              <Text
                style={
                  timeframeChangePercent >= 0
                    ? styles.statsTextPercentagePositive
                    : styles.statsTextPercentageNegative
                }>
                {pctChangeStr}
              </Text>
            </View>
            {loadingOHLC && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#318EF8" />
              </View>
            )}
          </View>

          {/* Chart + timeframe */}
          <View style={styles.graphSection}>
            <LineGraph data={graphData} />
            <View style={styles.timeframeButtons}>
              {(['1H', '1D', '1W', '1M', 'All'] as Timeframe[]).map(tf => (
                <TouchableOpacity
                  key={tf}
                  style={[
                    styles.timeButton,
                    timeframe === tf && styles.activeTimeButton,
                  ]}
                  onPress={() => handleTimeframeChange(tf)}>
                  <Text
                    style={[
                      styles.timeButtonText,
                      timeframe === tf && styles.activeTimeButtonText,
                    ]}>
                    {tf}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Market Stats */}
          <View style={styles.marketStatsContainer}>
            <View style={styles.marketStatItem}>
              <Text style={styles.marketStatLabel}>Market Cap</Text>
              <Text style={styles.marketStatValue}>
                {formatAmount(marketCap)}
              </Text>
            </View>
            <View style={styles.marketStatItem}>
              <Text style={styles.marketStatLabel}>Liquidity</Text>
              <Text style={styles.marketStatValue}>
                {formatLiquidityAsPercentage(liquidityScore)}
              </Text>
            </View>
            <View style={styles.marketStatItem}>
              <Text style={styles.marketStatLabel}>FDV</Text>
              <Text style={styles.marketStatValue}>{formatAmount(fdv)}</Text>
            </View>
          </View>

          {/* Swap / Send Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.swapButton}>
              <Icons.SwapIcon width={24} height={24} />
              <Text style={styles.swapButtonText}>Swap</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sendButton}>
              <Icons.Arrow width={24} height={24} fill="transparent" />
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>

          {/* About section */}
          <View>
            <View style={styles.holdersHeader}>
              <Icons.infoIcon />
              <Text style={styles.holdersTitle}>About</Text>
            </View>
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionText}>
                {coinName
                  ? `About ${coinName} - This is example placeholder text.`
                  : 'Search & select a coin above to see details.'}
              </Text>
              <TouchableOpacity style={styles.showMoreButton}>
                <Text style={styles.showMoreText}>Show more</Text>
                <Icons.ArrowDown />
              </TouchableOpacity>
            </View>
          </View>

          {/* People who recently bought coin */}
          <View style={styles.content}>
            <View style={styles.holdersHeader}>
              <Icons.infoIcon width={24} height={24} />
              <Text style={styles.holdersTitle}>
                People who recently bought {coinName || '...'}
              </Text>
            </View>
          </View>
          <View>
            <FlatList
              horizontal
              data={cardData}
              renderItem={() => <SuggestionsCard />}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardList}
            />
          </View>
          <View style={styles.borderLine} />

          {/* Example tweets */}
          <View style={styles.tweetSection}>
            <Tweet data={tweetData} />
          </View>
        </View>
      </ScrollView>

      {/* Example modal for expanded view */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={e => e.stopPropagation()}
            style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                {coinImage && (
                  <Image source={{uri: coinImage}} style={styles.modalAvatar} />
                )}
                <View style={styles.modalHeaderTexts}>
                  <Text style={styles.modalTitle}>
                    {coinName || 'Loading...'}
                  </Text>
                  <Text style={styles.modalSubtitle}>{displayedPrice}</Text>
                </View>
              </View>
              <View style={styles.modalHeaderRight}>
                <View style={styles.modalPriceInfo}>
                  <Text style={styles.modalPriceLabel}>
                    {`${timeframe} Price`}
                  </Text>
                  <Text style={styles.modalPriceChange}>{pctChangeStr}</Text>
                </View>
              </View>
            </View>

            {/* Larger chart in modal */}
            <LineGraph
              data={graphData}
              width={Dimensions.get('window').width - 72}
            />

            <View style={styles.modalButtonsStack}>
              <TouchableOpacity style={styles.modalTopButton}>
                <View style={styles.modalTopButtonContent}>
                  <Text style={styles.modalTopButtonText}>Held by</Text>
                  <View style={styles.modalAvatarStack}>
                    {coinImage && (
                      <Image
                        source={{uri: coinImage}}
                        style={styles.modalStackAvatar1}
                      />
                    )}
                    <Image
                      source={require('@/assets/images/thread-avatar-1.png')}
                      style={styles.modalStackAvatar2}
                    />
                    <Image
                      source={require('@/assets/images/thread-avatar-2.png')}
                      style={styles.modalStackAvatar3}
                    />
                  </View>
                  <Text style={styles.modalHoldersCount}>+1.6k</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalBottomButton}>
                <Text style={styles.modalBottomButtonText}>
                  Get {coinName || '$COIN'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};
