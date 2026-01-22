import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Image,
    Dimensions,
    ScrollView,
    ActivityIndicator,
    Animated,
    PanResponder,
} from 'react-native';
import { styles } from './TokenDetailsSheet.styles';
import { TokenDetailsSheetProps } from '@/modules/data-module/types/tokenDetails.types';
import { useTokenDetails } from '@/modules/data-module/hooks/useTokenDetails';
import {
    formatDollarChange,
    formatNumber,
    formatPrice,
    formatPriceChange,
    getGraphData
} from '@/modules/data-module/utils/tokenDetailsFormatters';
import RiskAnalysisSection from './RiskAnalysisSection';
import LineGraph from '@/core/shared-ui/TradeCard/LineGraph';
import COLORS from '@/assets/colors';

const { width, height } = Dimensions.get('window');

const TokenDetailsSheet: React.FC<TokenDetailsSheetProps> = ({
    visible,
    onClose,
    token,
}) => {
    const {
        priceHistory,
        metadata,
        tokenOverview,
        tokenSecurity,
        marketData,
        tradeData,
        loading,
        selectedTimeframe,
        handleTimeframeChange,
        getTimestamps
    } = useTokenDetails({
        tokenAddress: token.address,
        visible
    });

    const panY = useRef(new Animated.Value(0)).current;

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (_, { dy }) => {
          panY.setValue(Math.max(0, dy));
        },
        onPanResponderRelease: (_, { dy, vy }) => {
          if (dy > 150 || vy > 0.5) {
            Animated.timing(panY, {
              toValue: height,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              onClose();
            });
          } else {
            Animated.spring(panY, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    ).current;
  
    useEffect(() => {
      if (visible) {
        panY.setValue(0);
      }
    }, [visible]);

    return (
        <Modal
            animationType="slide"
            transparent
            visible={visible}
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay} />
            </TouchableWithoutFeedback>

            <Animated.View style={[styles.container, { transform: [{ translateY: panY }] }]}>
                <View style={styles.handleContainer} {...panResponder.panHandlers}>
                    <View style={styles.handle} />
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Text style={styles.closeButtonText}>×</Text>
                </TouchableOpacity>

                <ScrollView style={styles.content}>
                    {/* Token Header */}
                    <View style={styles.header}>
                        <Image
                            source={{ uri: token.logoURI }}
                            style={styles.tokenLogo}
                            defaultSource={require('@/assets/images/SENDlogo.png')}
                        />
                        <View style={styles.tokenInfo}>
                            <Text style={styles.tokenName}>{token.name}</Text>
                            <Text style={styles.tokenSymbol}>{token.symbol}</Text>
                        </View>
                    </View>

                    {/* Price Information */}
                    <View style={styles.priceContainer}>
                        <Text style={styles.price}>${formatPrice(token.price)}</Text>
                        <View style={styles.priceChangeContainer}>
                            <Text style={[
                                styles.priceChangeAmount,
                                { color: token.priceChange24h && token.priceChange24h >= 0 ? COLORS.brandPrimary : COLORS.errorRed }
                            ]}>
                                {formatDollarChange(token.price, token.priceChange24h)}
                            </Text>
                            <View style={[
                                styles.percentageBox,
                                { backgroundColor: token.priceChange24h && token.priceChange24h >= 0 ? COLORS.brandPrimary : COLORS.errorRed }
                            ]}>
                                <Text style={styles.percentageText}>
                                    {formatPriceChange(token.priceChange24h)}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Update Chart Section */}
                    <View style={styles.chartContainer}>
                        <View style={styles.timeframeContainer}>
                            {['1H', '1D', '1W', '1M', 'YTD', 'ALL'].map((tf) => (
                                <TouchableOpacity
                                    key={tf}
                                    style={[
                                        styles.timeframeButton,
                                        selectedTimeframe === tf && styles.selectedTimeframe,
                                        loading && styles.disabledButton
                                    ]}
                                    onPress={() => !loading && handleTimeframeChange(tf as any)}
                                    disabled={loading}
                                >
                                    <Text style={[
                                        styles.timeframeText,
                                        selectedTimeframe === tf && styles.selectedTimeframeText,
                                        loading && styles.disabledText
                                    ]}>
                                        {tf}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={COLORS.brandPrimary} />
                                <Text style={styles.loadingText}>Loading price data...</Text>
                            </View>
                        ) : priceHistory.length > 0 ? (
                            <View style={styles.graphWrapper}>
                                <LineGraph
                                    data={getGraphData(priceHistory.map(item => item.value))}
                                    width={width - 72}
                                    timestamps={getTimestamps()}
                                />
                            </View>
                        ) : (
                            <View style={styles.noDataContainer}>
                                <Text style={styles.noDataText}>No price data available</Text>
                            </View>
                        )}
                    </View>

                    {/* Risk Analysis Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Security Analysis</Text>
                        <RiskAnalysisSection tokenAddress={token.address} />
                    </View>

                    {/* Info Section */}
                    <View style={styles.infoSection}>
                        <Text style={styles.sectionTitle}>Info</Text>
                        <View style={styles.infoGrid}>
                            <View style={styles.infoItem}>
                                <Text style={styles.infoLabel}>Created On</Text>
                                <Text style={styles.infoValue}>
                                    {tokenOverview?.created_on ||
                                        (tokenOverview?.created_at ? new Date(tokenOverview.created_at * 1000).toLocaleDateString() : 'N/A')}
                                </Text>
                            </View>
                            <View style={styles.infoItem}>
                                <Text style={styles.infoLabel}>Status</Text>
                                <Text style={styles.infoValue}>{metadata?.extensions?.coingecko_id ? 'Listed' : 'Unlisted'}</Text>
                            </View>
                            <View style={styles.infoItem}>
                                <Text style={styles.infoLabel}>Mint</Text>
                                <Text style={styles.infoValue} numberOfLines={1}>
                                    {token.address.substring(0, 6)}...{token.address.substring(token.address.length - 6)}
                                </Text>
                            </View>
                            <View style={styles.infoItem}>
                                <Text style={styles.infoLabel}>Market Cap</Text>
                                <Text style={styles.infoValue}>
                                    ${formatNumber(tokenOverview?.market_cap || tokenOverview?.marketCap)}
                                </Text>
                            </View>
                            <View style={styles.infoItem}>
                                <Text style={styles.infoLabel}>Circulating Supply</Text>
                                <Text style={styles.infoValue}>
                                    {formatNumber(tokenOverview?.supply?.circulating ||
                                        tokenOverview?.circulatingSupply)}
                                </Text>
                            </View>
                            <View style={styles.infoItem}>
                                <Text style={styles.infoLabel}>Holders</Text>
                                <Text style={styles.infoValue}>
                                    {(() => {
                                        const count = tokenOverview?.holder_count || tokenOverview?.holderCount;
                                        return count ? count.toLocaleString() : 'N/A';
                                    })()}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* 24h Performance Section */}
                    <View style={styles.performanceSection}>
                        <Text style={styles.sectionTitle}>24h Performance</Text>
                        <View style={styles.performanceGrid}>
                            <View style={styles.performanceItem}>
                                <Text style={styles.performanceLabel}>Volume</Text>
                                <Text style={styles.performanceValue}>
                                    ${formatNumber(tradeData?.volume_24h_usd)}
                                </Text>
                            </View>
                            <View style={styles.performanceItem}>
                                <Text style={styles.performanceLabel}>Trades</Text>
                                <Text style={styles.performanceValue}>
                                    {tradeData?.trade_24h?.toLocaleString() || 'N/A'}
                                </Text>
                            </View>
                            <View style={styles.performanceItem}>
                                <Text style={styles.performanceLabel}>Buy Volume</Text>
                                <Text style={styles.performanceValue}>
                                    ${formatNumber(tradeData?.volume_buy_24h_usd)}
                                </Text>
                            </View>
                            <View style={styles.performanceItem}>
                                <Text style={styles.performanceLabel}>Sell Volume</Text>
                                <Text style={styles.performanceValue}>
                                    ${formatNumber(tradeData?.volume_sell_24h_usd)}
                                </Text>
                            </View>
                            <View style={styles.performanceItem}>
                                <Text style={styles.performanceLabel}>Unique Wallets</Text>
                                <Text style={styles.performanceValue}>
                                    {tradeData?.unique_wallet_24h?.toLocaleString() || 'N/A'}
                                </Text>
                            </View>
                            <View style={styles.performanceItem}>
                                <Text style={styles.performanceLabel}>Wallet Change</Text>
                                <Text style={[
                                    styles.performanceValue,
                                    { color: (tradeData?.unique_wallet_24h_change_percent || 0) >= 0 ? COLORS.brandPrimary : COLORS.errorRed }
                                ]}>
                                    {tradeData?.unique_wallet_24h_change_percent
                                        ? `${tradeData.unique_wallet_24h_change_percent >= 0 ? '+' : ''}${tradeData.unique_wallet_24h_change_percent.toFixed(2)}%`
                                        : 'N/A'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </Animated.View>
        </Modal>
    );
};

export default TokenDetailsSheet; 