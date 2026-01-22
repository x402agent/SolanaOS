import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  ActivityIndicator,
  ScrollView,
  Linking,
  Dimensions,
  ImageStyle,
  StyleProp,
  Animated,
  PanResponder,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { styles } from './TokenDetailsDrawer.styles';
import { fetchUserAssets } from '@/modules/data-module/utils/fetch';
import { Timeframe, useCoingecko } from '@/modules/data-module/hooks/useCoingecko';
import { fetchJupiterTokenData } from '@/modules/data-module/utils/tokenUtils';
import { getTokenRiskReport, TokenRiskReport, getRiskScoreColor, getRiskLevel, getRiskLevelColor, RiskLevel } from '@/shared/services/rugCheckService';
import LineGraph from '@/core/shared-ui/TradeCard/LineGraph';
import COLORS from '@/assets/colors';
import { RootStackParamList } from '@/shared/navigation/RootNavigator';
import { TokenInfo } from '@/modules/data-module';

const { width, height } = Dimensions.get('window');

// Navigation type
type TokenDetailsDrawerNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SwapScreen'>;

// Navigation type
// type TokenDetailsDrawerNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SwapScreen'>;

interface TokenDetailsDrawerProps {
  visible: boolean;
  onClose: () => void;
  tokenMint: string;
  loading?: boolean;
  initialData?: {
    symbol?: string;
    name?: string;
    logoURI?: string;
    isCollection?: boolean;
    collectionData?: any;
    nftData?: any;
  };
}

const formatLargeNumber = (num: number): string => {
  if (num === null || num === undefined || isNaN(num)) return 'N/A';
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
};

const formatTokenAmount = (amount: number, decimals: number): string => {
  if (isNaN(amount) || isNaN(decimals)) return '0';
  const tokenAmount = amount / Math.pow(10, decimals);
  if (tokenAmount < 0.001 && tokenAmount > 0)
    return tokenAmount.toExponential(4);
  if (tokenAmount >= 1000) return tokenAmount.toFixed(2);
  if (tokenAmount >= 1) return tokenAmount.toFixed(4);
  return tokenAmount.toFixed(6);
};

const TokenDetailsDrawer: React.FC<TokenDetailsDrawerProps> = ({
  visible,
  onClose,
  tokenMint,
  loading,
  initialData,
}) => {
  const navigation = useNavigation<TokenDetailsDrawerNavigationProp>();
  
  const [tokenData, setTokenData] = useState<any>(null);
  const [heliusTokenData, setHeliusTokenData] = useState<any>(null);
  const [loadingTokenData, setLoadingTokenData] = useState(false);
  const [loadingHelius, setLoadingHelius] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'market'>('overview');

  // Risk analysis state
  const [riskReport, setRiskReport] = useState<TokenRiskReport | null>(null);
  const [loadingRiskReport, setLoadingRiskReport] = useState(false);
  const [riskReportError, setRiskReportError] = useState<string | null>(null);

  const {
    timeframe,
    setTimeframe,
    graphData,
    timestamps,
    timeframePrice,
    coinError,
    refreshCoinData,
    loadingOHLC,
    setSelectedCoinId,
    marketCap,
    fdv,
    liquidityScore,
    timeframeChangePercent,
  } = useCoingecko();

  const isLoading = loading || loadingTokenData;

  // --- DRAG LOGIC ---
  const panY = useRef(new Animated.Value(height)).current;
  const lastPanY = useRef(0);

  useEffect(() => {
    if (visible) {
      // Instantly show the drawer at position 0
      panY.setValue(0);
    } else {
      // Instantly hide the drawer off-screen
      panY.setValue(height);
    }
  }, [visible, panY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, { dy }) => {
        // Only allow dragging down
        if (dy > 0) {
          panY.setValue(dy);
        }
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 150 || vy > 0.5) {
          // Animate out (close)
          Animated.timing(panY, {
            toValue: height,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onClose();
            panY.setValue(height);
          });
        } else {
          // Snap back to open
          Animated.timing(panY, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    if (visible && tokenMint) {
      if (!initialData?.isCollection && !initialData?.nftData) {
        fetchTokenDetails();
      }
      fetchHeliusData();
      fetchRiskReport();
    }
  }, [visible, tokenMint, initialData]);

  const fetchTokenDetails = async () => {
    setLoadingTokenData(true);
    setError(null);
    try {
      const data = await fetchJupiterTokenData(tokenMint);
      if (data) {
        setTokenData(data);
        if (data.extensions?.coingeckoId) {
          setSelectedCoinId(data.extensions.coingeckoId.toLowerCase());
        }
      } else {
        setError('Token data not found');
      }
    } catch (err) {
      setError('Failed to load token details');
    } finally {
      setLoadingTokenData(false);
    }
  };

  const fetchHeliusData = async () => {
    if (!tokenMint) return;
    setLoadingHelius(true);
    try {
      const dummyWallet = '11111111111111111111111111111111';
      const result = await fetchUserAssets(dummyWallet);
      const tokenInfo = result.items.find(
        (item: any) => item.id === tokenMint || item.mint === tokenMint,
      );
      if (tokenInfo) {
        setHeliusTokenData(tokenInfo);
      }
    } catch (err) {
      // handle error if needed
    } finally {
      setLoadingHelius(false);
    }
  };

  const fetchRiskReport = async () => {
    // Skip risk check for NFTs and collections
    if (initialData?.isCollection || initialData?.nftData) {
      return;
    }

    setLoadingRiskReport(true);
    setRiskReportError(null);

    try {
      console.log('[TokenDetailsDrawer] Fetching risk report for token:', tokenMint);
      const report = await getTokenRiskReport(tokenMint);

      if (report) {
        console.log('[TokenDetailsDrawer] Successfully fetched risk report');
        setRiskReport(report);
      } else {
        console.log('[TokenDetailsDrawer] No risk report data available');
        setRiskReportError('Unable to retrieve risk data');
      }
    } catch (error) {
      console.error('[TokenDetailsDrawer] Error fetching risk report:', error);
      setRiskReportError('Error loading security data');
    } finally {
      setLoadingRiskReport(false);
    }
  };

  const openExplorer = () => {
    Linking.openURL(`https://solscan.io/token/${tokenMint}`);
  };

  const openTensor = () => {
    const base = 'https://www.tensor.trade';
    if (initialData?.isCollection) {
      const slug = initialData.collectionData?.slugDisplay || tokenMint;
      Linking.openURL(`${base}/trade/${slug}`);
    } else {
      Linking.openURL(`${base}/item/${tokenMint}`);
    }
  };

  const openMagicEden = () => {
    const base = 'https://magiceden.io';
    if (initialData?.isCollection) {
      const slug = initialData.collectionData?.slugMe || tokenMint;
      Linking.openURL(`${base}/marketplace/${slug}`);
    } else {
      Linking.openURL(`${base}/item-details/${tokenMint}`);
    }
  };

  const handleNavigateToSwap = () => {
    // Don't navigate for NFTs or collections as they can't be swapped
    if (initialData?.isCollection || initialData?.nftData) {
      return;
    }

    // Prepare token data for swap
    const inputTokenData: Partial<TokenInfo> = {
      address: tokenMint,
      symbol: tokenData?.symbol || initialData?.symbol || 'Unknown',
      name: tokenData?.name || initialData?.name || 'Unknown Token',
      decimals: tokenData?.decimals || 9,
      logoURI: tokenData?.logoURI || initialData?.logoURI || '',
    };

    // Close the current drawer
    onClose();

    // Navigate to SwapScreen with the token pre-selected as input
    navigation.navigate('SwapScreen', {
      inputToken: inputTokenData,
      shouldInitialize: true,
      showBackButton: true,
    });
  };

  const renderTabButtons = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[
          styles.tabButton,
          activeTab === 'overview' && styles.activeTabButton,
        ]}
        onPress={() => setActiveTab('overview')}>
        <Text
          style={[
            styles.tabText,
            activeTab === 'overview' && styles.activeTabText,
          ]}>
          Overview
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.tabButton,
          activeTab === 'market' && styles.activeTabButton,
        ]}
        onPress={() => setActiveTab('market')}>
        <Text
          style={[
            styles.tabText,
            activeTab === 'market' && styles.activeTabText,
          ]}>
          Market
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderTimeframeSelector = () => (
    <View style={styles.timeframeContainer}>
      {(['1H', '1D', '1W', '1M', 'All'] as Timeframe[]).map(tf => (
        <TouchableOpacity
          key={tf}
          style={[
            styles.timeframeButton,
            timeframe === tf && styles.activeTimeframeButton,
          ]}
          onPress={() => setTimeframe(tf)}>
          <Text
            style={[
              styles.timeframeText,
              timeframe === tf && styles.activeTimeframeText,
            ]}>
            {tf}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderOverviewTab = () => {
    const isNftOrCollection = initialData?.isCollection || initialData?.nftData;
    if (isNftOrCollection) {
      return (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.sectionText}>
              {initialData?.isCollection
                ? initialData?.collectionData?.description ||
                'No description available.'
                : initialData?.nftData?.description ||
                'No description available.'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {initialData?.isCollection ? 'Collection Details' : 'NFT Details'}
            </Text>

            {initialData?.isCollection && initialData?.collectionData && (
              <>
                {initialData.collectionData.stats && (
                  <View style={styles.collectionStatsContainer}>
                    <View style={styles.statBox}>
                      <Text style={styles.collectionStatLabel}>Floor</Text>
                      <Text style={styles.collectionStatValue}>
                        {initialData.collectionData.floorPrice ? initialData.collectionData.floorPrice.toFixed(2) : '0'} SOL
                      </Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.collectionStatLabel}>Listed</Text>
                      <Text style={styles.collectionStatValue}>
                        {initialData.collectionData.stats.numListed ?
                          initialData.collectionData.stats.numListed.toString() : '0'}
                      </Text>
                      <Text style={styles.statSubValue}>
                        {initialData.collectionData.stats.pctListed ?
                          initialData.collectionData.stats.pctListed.toFixed(1) : '0'}
                        %
                      </Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.collectionStatLabel}>24h Vol</Text>
                      <Text style={styles.collectionStatValue}>
                        {initialData.collectionData.stats.volume24h ?
                          (parseFloat(initialData.collectionData.stats.volume24h) / 1_000_000_000).toFixed(1) : '0'}{' '}
                        <Text>SOL</Text>
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Address</Text>
                  <Text
                    style={styles.detailValue}
                    numberOfLines={1}
                    ellipsizeMode="middle">
                    {tokenMint}
                  </Text>
                </View>

                {initialData.collectionData.tokenCount && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Items</Text>
                    <Text style={styles.detailValue}>
                      {initialData.collectionData.numMints ||
                        initialData.collectionData.tokenCount}
                    </Text>
                  </View>
                )}

                {initialData.collectionData.floorPrice !== undefined && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Floor Price</Text>
                    <Text style={styles.detailValue}>
                      {initialData.collectionData.floorPrice ?
                        initialData.collectionData.floorPrice.toFixed(2) : '0'} SOL
                    </Text>
                  </View>
                )}

                {initialData.collectionData.stats?.volume24h && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>24h Volume</Text>
                    <Text style={styles.detailValue}>
                      {(parseFloat(initialData.collectionData.stats.volume24h) / 1_000_000_000).toFixed(2)}{' '}
                      <Text>SOL</Text>
                    </Text>
                  </View>
                )}

                {initialData.collectionData.stats?.volume7d && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>7d Volume</Text>
                    <Text style={styles.detailValue}>
                      {(parseFloat(initialData.collectionData.stats.volume7d) / 1_000_000_000).toFixed(2)}{' '}
                      <Text>SOL</Text>
                    </Text>
                  </View>
                )}

                {initialData.collectionData.stats?.volumeAll && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Volume</Text>
                    <Text style={styles.detailValue}>
                      {(parseFloat(initialData.collectionData.stats.volumeAll) / 1_000_000_000).toFixed(2)}{' '}
                      <Text>SOL</Text>
                    </Text>
                  </View>
                )}

                {initialData.collectionData.stats?.numListed !== undefined && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Listed</Text>
                    <Text style={styles.detailValue}>
                      {initialData.collectionData.stats.numListed ?
                        initialData.collectionData.stats.numListed.toString() : '0'} (
                      {initialData.collectionData.stats.pctListed ?
                        initialData.collectionData.stats.pctListed.toFixed(2) : '0'}%)
                    </Text>
                  </View>
                )}

                {initialData.collectionData.stats?.salesAll !== undefined && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Sales</Text>
                    <Text style={styles.detailValue}>
                      {initialData.collectionData.stats.salesAll ?
                        initialData.collectionData.stats.salesAll.toString() : '0'}
                    </Text>
                  </View>
                )}

                {initialData.collectionData.tensorVerified && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Verified</Text>
                    <Text style={styles.detailValue}>✅ Tensor Verified</Text>
                  </View>
                )}

                {initialData.collectionData.discord && (
                  <View style={[styles.detailRow, { height: 44, alignItems: 'center' }]}>
                    <Text style={styles.detailLabel}>Discord</Text>
                    <TouchableOpacity
                      onPress={() =>
                        Linking.openURL(initialData.collectionData.discord)
                      }
                      style={{ flexShrink: 0, alignSelf: 'center' }}>
                      <Text style={[styles.detailValue, { color: '#5865F2', minWidth: 100, textAlign: 'right' }, styles.noWrap]}>
                        Join Discord
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {initialData.collectionData.twitter && (
                  <View style={[styles.detailRow, { height: 44, alignItems: 'center' }]}>
                    <Text style={styles.detailLabel}>Twitter</Text>
                    <TouchableOpacity
                      onPress={() =>
                        Linking.openURL(initialData.collectionData.twitter)
                      }
                      style={{ flexShrink: 0, alignSelf: 'center' }}>
                      <Text
                        style={[
                          styles.detailValue,
                          { color: '#1DA1F2', minWidth: 100, textAlign: 'right' },
                          styles.noWrap
                        ]}>
                        @
                        {initialData.collectionData.twitter
                          .replace('https://www.twitter.com/', '')
                          .replace('https://twitter.com/', '')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {initialData.collectionData.website && (
                  <View style={[styles.detailRow, { height: 44, alignItems: 'center' }]}>
                    <Text style={styles.detailLabel}>Website</Text>
                    <TouchableOpacity
                      onPress={() =>
                        Linking.openURL(initialData.collectionData.website)
                      }
                      style={{ flexShrink: 0, alignSelf: 'center' }}>
                      <Text
                        style={[
                          styles.detailValue,
                          { color: '#007AFF', minWidth: 100, textAlign: 'right' },
                          styles.noWrap
                        ]}>
                        Visit Website
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {initialData?.nftData && (
              <>
                {initialData.nftData.collName && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Collection</Text>
                    <Text style={styles.detailValue}>
                      {initialData.nftData.collName}
                    </Text>
                  </View>
                )}

                {initialData.nftData.rarityRankTN && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Rarity Rank</Text>
                    <Text style={styles.detailValue}>
                      #{initialData.nftData.rarityRankTN} of{' '}
                      {initialData.nftData.numMints || '?'}
                    </Text>
                  </View>
                )}

                {initialData.nftData.owner && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Owner</Text>
                    <Text
                      style={styles.detailValue}
                      numberOfLines={1}
                      ellipsizeMode="middle">
                      {initialData.nftData.owner}
                    </Text>
                  </View>
                )}

                {initialData.nftData.listing?.price && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Listed Price</Text>
                    <Text style={[styles.detailValue, { color: '#00C851' }]}>
                      {(parseFloat(initialData.nftData.listing.price) / 1_000_000_000).toFixed(2)}{' '}
                      <Text>SOL</Text>
                    </Text>
                  </View>
                )}

                {initialData.nftData.lastSale?.price && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Last Sale</Text>
                    <Text style={styles.detailValue}>
                      {(parseFloat(initialData.nftData.lastSale.price) / 1_000_000_000).toFixed(2)}{' '}
                      <Text>SOL</Text>
                    </Text>
                  </View>
                )}

                {initialData.nftData.attributes &&
                  initialData.nftData.attributes.length > 0 && (
                    <View style={styles.attributesContainer}>
                      <Text
                        style={[
                          styles.sectionTitle,
                          { marginTop: 16, marginBottom: 8 },
                        ]}>
                        Attributes
                      </Text>
                      {initialData.nftData.attributes.map(
                        (attr: any, idx: number) => (
                          <View key={idx} style={styles.attributeItem}>
                            <Text style={styles.attributeLabel}>
                              {attr.trait_type}
                            </Text>
                            <Text style={styles.attributeValue}>
                              {attr.value}
                            </Text>
                          </View>
                        ),
                      )}
                    </View>
                  )}
              </>
            )}

            {(initialData?.isCollection || initialData?.nftData) && (
              <View style={styles.marketplacesContainer}>
                <TouchableOpacity
                  style={[
                    styles.marketplaceButton,
                    { backgroundColor: '#E6F9FA', width: '48%', minWidth: 160 },
                  ]}
                  onPress={openTensor}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                      style={[
                        styles.marketplaceButtonText,
                        { color: '#32D4DE' },
                        styles.noWrap
                      ]}>
                      View on Tensor
                    </Text>
                    <FontAwesome5
                      name="external-link-alt"
                      size={12}
                      color="#32D4DE"
                      style={{ marginLeft: 4 }}
                    />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.marketplaceButton,
                    { backgroundColor: '#FCEDF4', width: '48%', minWidth: 160 },
                  ]}
                  onPress={openMagicEden}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                      style={[
                        styles.marketplaceButtonText,
                        { color: '#E42575' },
                        styles.noWrap
                      ]}>
                      View on Magic Eden
                    </Text>
                    <FontAwesome5
                      name="external-link-alt"
                      size={12}
                      color="#E42575"
                      style={{ marginLeft: 4 }}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.sectionText}>
            {tokenData?.extensions?.description || 'No description available.'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Token Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Token Address</Text>
            <Text
              style={styles.detailValue}
              numberOfLines={1}
              ellipsizeMode="middle">
              {tokenMint}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Decimals</Text>
            <Text style={styles.detailValue}>{tokenData?.decimals ?? '-'}</Text>
          </View>

          {heliusTokenData?.token_info && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Token Standard</Text>
              <Text style={styles.detailValue}>
                {heliusTokenData.token_info.token_program ===
                  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
                  ? 'SPL Token'
                  : heliusTokenData.token_info.token_program}
              </Text>
            </View>
          )}

          {tokenData?.tags && tokenData.tags.length > 0 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tags</Text>
              <View style={styles.tagsContainer}>
                {tokenData.tags.map((tag: string, idx: number) => (
                  <View key={idx} style={styles.tagPill}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {tokenData?.extensions?.website && (
            <View style={[styles.detailRow, { height: 44, alignItems: 'center' }]}>
              <Text style={styles.detailLabel}>Website</Text>
              <TouchableOpacity
                style={{ flexShrink: 0, alignSelf: 'center' }}
                onPress={() => Linking.openURL(tokenData.extensions.website)}>
                <Text
                  style={[styles.detailValue, styles.linkText, styles.noWrap, { minWidth: 100, textAlign: 'right' }]}
                  numberOfLines={1}>
                  {tokenData.extensions.website}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Security Analysis Section */}
        {renderRiskAnalysisSection()}

        {timeframePrice > 0 && (
          <View style={styles.statsSummaryContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Price</Text>
              <Text style={styles.statValue}>
                {timeframePrice > 0 ? `$${timeframePrice.toFixed(4)}` : 'N/A'}
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statLabel}>24h Change</Text>
              <Text
                style={[
                  styles.statValue,
                  timeframeChangePercent > 0
                    ? styles.positiveChange
                    : timeframeChangePercent < 0
                      ? styles.negativeChange
                      : {},
                ]}>
                {timeframeChangePercent > 0 ? '+' : ''}
                {timeframeChangePercent.toFixed(2)}%
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Market Cap</Text>
              <Text style={[styles.statValue, styles.statValueText]}>
                {formatLargeNumber(marketCap)}
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.explorerButton, { minWidth: 150 }]} 
          onPress={openExplorer}
        >
          <Text style={[styles.explorerButtonText, styles.noWrap]}>View on Solscan</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderMarketTab = () => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>
      {tokenData?.extensions?.coingeckoId && (
        <>
          {renderTimeframeSelector()}
          <View style={styles.chartContainer}>
            {loadingOHLC ? (
              <ActivityIndicator size="large" color={COLORS.brandPrimary} />
            ) : graphData.length > 0 ? (
              <LineGraph
                data={graphData}
                width={width - 80}
                timestamps={timestamps}
              />
            ) : (
              <Text style={styles.chartEmptyText}>No chart data available</Text>
            )}
          </View>
        </>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Market Data</Text>

        <View style={styles.marketMetricsContainer}>
          <View style={styles.marketMetricItem}>
            <Text style={styles.marketMetricLabel}>Market Cap</Text>
            <Text style={styles.marketMetricValue}>
              {formatLargeNumber(marketCap)}
            </Text>
          </View>

          <View style={styles.marketMetricItem}>
            <Text style={styles.marketMetricLabel}>FDV</Text>
            <Text style={styles.marketMetricValue}>
              {formatLargeNumber(fdv)}
            </Text>
          </View>

          <View style={styles.marketMetricItem}>
            <Text style={styles.marketMetricLabel}>Liquidity</Text>
            <Text style={styles.marketMetricValue}>
              {liquidityScore ? liquidityScore.toFixed(2) : '0'}%
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Current Price</Text>
          <Text style={styles.detailValue}>
            {timeframePrice ? `$${timeframePrice.toFixed(6)}` : 'N/A'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>24h Change</Text>
          <Text
            style={[
              styles.detailValue,
              timeframeChangePercent > 0
                ? styles.positiveChange
                : timeframeChangePercent < 0
                  ? styles.negativeChange
                  : {},
            ]}>
            {timeframeChangePercent > 0 ? '+' : ''}
            {timeframeChangePercent.toFixed(2)}%
          </Text>
        </View>

        {heliusTokenData?.token_info?.price_info && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Recent Price</Text>
            <Text style={styles.detailValue}>
              $
              {heliusTokenData.token_info.price_info.price_per_token
                ? heliusTokenData.token_info.price_info.price_per_token.toFixed(6)
                : 'N/A'}
            </Text>
          </View>
        )}

        {tokenData?.extensions?.coingeckoId && (
          <>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Coingecko ID</Text>
              <Text style={styles.detailValue}>
                {tokenData.extensions.coingeckoId}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.coingeckoButton, { minWidth: 150 }]}
              onPress={() =>
                Linking.openURL(
                  `https://www.coingecko.com/en/coins/${tokenData.extensions.coingeckoId}`,
                )
              }>
              <Text style={[styles.coingeckoButtonText, styles.noWrap]}>View on Coingecko</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );

  const renderRiskAnalysisSection = () => {
    // Don't show risk analysis for NFTs and collections
    if (initialData?.isCollection || initialData?.nftData) {
      return null;
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security Analysis</Text>

        {loadingRiskReport ? (
          <View style={styles.riskLoadingContainer}>
            <ActivityIndicator size="small" color="#32D4DE" />
            <Text style={styles.riskLoadingText}>Loading security data...</Text>
          </View>
        ) : riskReportError ? (
          <View style={styles.riskErrorContainer}>
            <Text style={styles.riskErrorText}>{riskReportError}</Text>
          </View>
        ) : !riskReport ? (
          <Text style={styles.sectionText}>No security data available.</Text>
        ) : (
          <View style={styles.riskContainer}>
            {/* Risk Score */}
            <View style={styles.riskScoreContainer}>
              <View style={[
                styles.riskScoreBadge,
                { backgroundColor: getRiskScoreColor(riskReport.score_normalised) }
              ]}>
                <Text style={styles.riskScoreValue}>
                  {Math.round(riskReport.score_normalised)}
                </Text>
              </View>

              <View style={styles.riskLabelContainer}>
                <Text style={[
                  styles.riskLabel,
                  { color: getRiskScoreColor(riskReport.score_normalised) }
                ]}>
                  {riskReport.rugged ? 'RUGGED' : getRiskLevelText(riskReport.score_normalised)}
                </Text>
                {riskReport.rugged && (
                  <Text style={styles.ruggedDescription}>
                    This token has been identified as rugged. Trading is not recommended.
                  </Text>
                )}
              </View>
            </View>

            {/* Risk description */}
            {!riskReport.rugged && (
              <Text style={styles.riskDescription}>
                {getRiskDescription(riskReport.score_normalised)}
              </Text>
            )}

            {/* Risk Factors */}
            {riskReport.risks && riskReport.risks.length > 0 && (
              <>
                <Text style={styles.riskFactorsTitle}>Risk Factors</Text>
                {riskReport.risks.slice(0, 3).map((risk, index) => (
                  <View key={index} style={styles.riskFactorItem}>
                    <View style={styles.riskFactorHeader}>
                      <Text style={styles.riskFactorName}>{risk.name}</Text>
                      <View style={[
                        styles.riskLevelBadge,
                        { backgroundColor: getRiskLevelColor(risk.level.toLowerCase() as RiskLevel) }
                      ]}>
                        <Text style={styles.riskLevelText}>
                          {risk.level.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.riskFactorDescription}>{risk.description}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  // Helper function to get human-readable risk level
  const getRiskLevelText = (score: number): string => {
    if (score < 30) return 'Low Risk';
    if (score < 60) return 'Medium Risk';
    if (score < 80) return 'High Risk';
    return 'Critical Risk';
  };

  // Helper function to get risk description
  const getRiskDescription = (score: number): string => {
    if (score < 30) {
      return 'This token has a low risk score. It shows strong security indicators and appears to have legitimate tokenomics.';
    } else if (score < 60) {
      return 'This token has a medium risk score. While it shows some positive signs, there are potential concerns that should be evaluated.';
    } else if (score < 80) {
      return 'This token has a high risk score. Multiple risk factors have been identified that could indicate potential issues.';
    } else {
      return 'This token has a critical risk score. Significant red flags have been detected that suggest high risk of loss.';
    }
  };

  return (
    <Modal
      animationType="none"
      transparent
      visible={visible}
      onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.drawerContainer, { transform: [{ translateY: panY }] }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <View style={styles.dragHandleContainer} {...panResponder.panHandlers}>
          <View style={styles.dragHandle} />
        </View>

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#32D4DE" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}

        <View style={styles.tokenInfoContainer}>
          <Image
            source={
              initialData?.logoURI
                ? { uri: initialData.logoURI }
                : tokenData?.logoURI
                  ? { uri: tokenData.logoURI }
                  : require('@/assets/images/SENDlogo.png')
            }
            style={
              (initialData?.isCollection || initialData?.nftData
                ? styles.nftImage
                : styles.tokenImage) as StyleProp<ImageStyle>
            }
            resizeMode="cover"
          />
          <View style={styles.tokenNameContainer}>
            <Text style={styles.tokenName} numberOfLines={2}>
              {initialData?.name ||
                tokenData?.name ||
                initialData?.symbol ||
                tokenData?.symbol ||
                'Unknown Token'}
            </Text>
            {!initialData?.isCollection && !initialData?.nftData && (
              <Text style={styles.tokenSymbol}>
                {tokenData?.symbol || initialData?.symbol || ''}
              </Text>
            )}
            {timeframePrice > 0 &&
              !initialData?.isCollection &&
              !initialData?.nftData && (
                <View style={styles.priceContainer}>
                  <Text style={styles.tokenPrice}>
                    {timeframePrice ? `$${timeframePrice.toFixed(4)}` : '$0.00'}
                  </Text>
                  <Text
                    style={[
                      styles.priceChange,
                      {
                        color:
                          timeframeChangePercent > 0
                            ? '#00C851'
                            : timeframeChangePercent < 0
                              ? '#FF5252'
                              : '#666666',
                      },
                    ]}>
                    {timeframeChangePercent > 0 ? '+' : ''}
                    {timeframeChangePercent.toFixed(2)}%
                  </Text>
                </View>
              )}
          </View>
        </View>

        {/* Elegant Swap Button - Only for tokens, not NFTs/collections */}
        {!initialData?.isCollection && !initialData?.nftData && (
          <TouchableOpacity 
            style={styles.elegantSwapButton} 
            onPress={handleNavigateToSwap}
            activeOpacity={0.8}
          >
            <View style={styles.swapButtonContent}>
              <View style={styles.swapIconContainer}>
                <FontAwesome5 name="exchange-alt" size={18} color="#FFFFFF" />
              </View>
              <View style={styles.swapButtonTextContainer}>
                <Text style={styles.swapButtonTitle}>Swap Token</Text>
                <Text style={styles.swapButtonSubtitle}>Trade instantly</Text>
              </View>
              <FontAwesome5 name="chevron-right" size={14} color="#FFFFFF" style={styles.swapButtonArrow} />
            </View>
          </TouchableOpacity>
        )}

        {!initialData?.isCollection && !initialData?.nftData ? (
          <>
            {renderTabButtons()}
            {activeTab === 'overview' ? renderOverviewTab() : renderMarketTab()}
          </>
        ) : (
          renderOverviewTab()
        )}
      </Animated.View>
    </Modal>
  );
};

export default TokenDetailsDrawer;