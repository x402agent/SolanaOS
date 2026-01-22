import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import BN from 'bn.js';
import { BondingCurveCardProps } from '../types';
import BondingCurveConfigurator from './BondingCurveConfigurator';
import { setBondingCurve } from '../services/tokenMillService';
import { Dimensions } from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

const { width } = Dimensions.get('window');
const CHART_WIDTH = Math.min(width * 0.85, 350);
const CHART_HEIGHT = 220; // Increased height for better visualization

const BondingCurveCard = React.memo(({
  marketAddress,
  connection,
  publicKey,
  solanaWallet,
  setLoading,
  styleOverrides = {},
  onCurveChange
}: BondingCurveCardProps) => {
  // Local states for curve values
  const [pricePoints, setPricePoints] = useState<BN[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error'>('info');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Curve parameters for display
  const [curveType, setCurveType] = useState<string>('linear');
  const [basePrice, setBasePrice] = useState<number>(0);
  const [topPrice, setTopPrice] = useState<number>(0);
  const [pointCount, setPointCount] = useState<number>(0);
  const [feePercent, setFeePercent] = useState<number>(2.0);

  // Safely convert BN to number to prevent Infinity/NaN errors
  const safeConvertBnToNumber = useCallback((bn: BN) => {
    try {
      const num = bn.toNumber();
      return Number.isFinite(num) ? num : 0;
    } catch (e) {
      return 0; // Fallback to 0 if conversion fails
    }
  }, []);

  // Chart data derived from pricePoints with safety checks
  const chartData = useMemo(() => {
    if (pricePoints.length === 0) {
      // Default empty data if no prices yet
      return {
        labels: ['0', '5', '10'],
        datasets: [
          { data: [0, 0, 0], color: () => '#5078FF', strokeWidth: 3 },
          { data: [0, 0, 0], color: () => '#FF4F78', strokeWidth: 2, strokeDashArray: [4, 2] },
        ],
        legend: ['Ask Price', 'After Fee (Bid)'],
      };
    }

    // Create safe arrays of numbers from BN values
    const askPrices = pricePoints.map(safeConvertBnToNumber);

    // Calculate prices after fee (bid prices)
    const bidPrices = askPrices.map(price => {
      const bidPrice = price * (1 - feePercent / 100);
      return Number.isFinite(bidPrice) ? bidPrice : 0;
    });

    return {
      labels: pricePoints.map((_, idx) => String(idx + 1)),
      datasets: [
        {
          data: askPrices.length > 0 ? askPrices : [0, 0, 0],
          color: () => '#5078FF',
          strokeWidth: 3
        },
        {
          data: bidPrices.length > 0 ? bidPrices : [0, 0, 0],
          color: () => '#FF4F78',
          strokeWidth: 2,
          strokeDashArray: [4, 2] // Dashed line for bid prices
        }
      ],
      legend: ['Ask Price', 'After Fee (Bid)'],
    };
  }, [pricePoints, feePercent, safeConvertBnToNumber]);

  /**
   * Handles curve changes from the configurator
   */
  const handleCurveChange = useCallback((newPrices: BN[], parameters: any) => {
    setPricePoints(newPrices);

    // Update display parameters
    if (parameters) {
      setCurveType(parameters.curveType || 'linear');
      setBasePrice(parameters.basePrice || 0);
      setTopPrice(parameters.topPrice || 0);
      setPointCount(parameters.points || 0);
      setFeePercent(parameters.feePercent || 0);
    }

    // Call the external callback if provided
    if (onCurveChange) {
      onCurveChange(newPrices, {
        curveType,
        basePrice,
        topPrice,
        points: pointCount,
        feePercent,
        ...parameters
      });
    }
  }, [onCurveChange, curveType, basePrice, topPrice, pointCount, feePercent]);

  /**
   * Derives bid prices from ask prices based on fee percentage
   */
  const deriveBidPricesFromAsk = useCallback((askPrices: number[]): number[] => {
    return askPrices.map(price => {
      const bidPrice = price * (1 - feePercent / 100);
      return Number.isFinite(bidPrice) ? bidPrice : 0;
    });
  }, [feePercent]);

  /**
   * Handles the process of setting the bonding curve on-chain
   * @returns {Promise<void>}
   */
  const onPressSetCurve = useCallback(async () => {
    if (!marketAddress) {
      Alert.alert(
        'No Market Address',
        'Please enter or create a market first before setting the bonding curve.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    if (pricePoints.length === 0) {
      Alert.alert(
        'Configure Curve First',
        'Please configure the bonding curve parameters before submitting.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    try {
      setLoading(true);
      setIsSubmitting(true);
      setStatus('Preparing bonding curve transaction...');
      setStatusType('info');

      // Convert BN => number before passing
      const askNumbers = pricePoints.map(p => {
        try {
          const num = p.toNumber();
          return Number.isFinite(num) ? num : 0;
        } catch (e) {
          return 0;
        }
      });

      // Derive bid prices from ask prices
      const bidNumbers = deriveBidPricesFromAsk(askNumbers);

      const txSig = await setBondingCurve({
        marketAddress,
        askPrices: askNumbers,
        bidPrices: bidNumbers,
        userPublicKey: publicKey,
        connection,
        solanaWallet,
        onStatusUpdate: (newStatus) => {
          console.log('Bonding curve status:', newStatus);
          setStatus(newStatus);
          // Keep type as info during transaction processing
          setStatusType('info');
        }
      });

      setStatus('Bonding curve set successfully!');
      setStatusType('success');
    } catch (err: any) {
      console.error('Bonding curve error:', err);
      setStatus('Transaction failed. Please try again.');
      setStatusType('error');
    } finally {
      setTimeout(() => {
        setLoading(false);
        setIsSubmitting(false);
      }, 1000);

      // Keep success/error message visible a bit longer
      setTimeout(() => {
        setStatus(null);
      }, 5000);
    }
  }, [marketAddress, pricePoints, connection, publicKey, solanaWallet, setLoading, deriveBidPricesFromAsk]);

  return (
    <View style={styles.section}>
      <View style={styles.mainContainer}>
        {/* Visual preview */}
        <View style={styles.chartContainer}>
          <LineChart
            data={chartData}
            width={CHART_WIDTH}
            height={CHART_HEIGHT}
            chartConfig={{
              backgroundColor: COLORS.background,
              backgroundGradientFrom: COLORS.background,
              backgroundGradientTo: COLORS.background,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              style: {
                borderRadius: 16,
              },
              propsForDots: {
                r: '4',
                strokeWidth: '1',
                stroke: COLORS.darkerBackground,
              },
              propsForBackgroundLines: {
                stroke: COLORS.borderDarkColor,
                strokeWidth: 1,
              },
            }}
            bezier={false} // Use straight lines instead of curved
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
            fromZero
            yAxisLabel=""
            yAxisSuffix=""
            formatYLabel={(value) => {
              const num = parseFloat(value);
              if (!Number.isFinite(num)) return '0';
              if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
              if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
              return value;
            }}
            withInnerLines
            withOuterLines
            withVerticalLines
          />

          {/* Legend */}
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.askDot]} />
              <Text style={styles.legendText}>Ask Curve</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.bidDot]} />
              <Text style={styles.legendText}>Bid Curve</Text>
            </View>
          </View>
        </View>

        {/* Configuration controls */}
        <View style={styles.configuratorContainer}>
          <BondingCurveConfigurator
            onCurveChange={handleCurveChange}
            disabled={!!isSubmitting}
          />
        </View>
      </View>

      {status && (
        <View style={getStatusContainerStyle()}>
          {isSubmitting && (
            <ActivityIndicator
              size="small"
              color={statusType === 'error' ? '#e12d39' : statusType === 'success' ? '#03a66d' : COLORS.brandBlue}
            />
          )}
          <Text style={getStatusTextStyle()}>{status}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, isSubmitting ? styles.disabledButton : {}]}
        onPress={onPressSetCurve}
        disabled={isSubmitting}>
        <Text style={styles.buttonText}>
          {isSubmitting ? 'Setting Curve...' : 'Set Curve On-Chain'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Determine which status container style to use based on status type
  function getStatusContainerStyle() {
    if (statusType === 'success') return [styles.statusContainer, styles.successStatusContainer];
    if (statusType === 'error') return [styles.statusContainer, styles.errorStatusContainer];
    return styles.statusContainer;
  }

  // Determine which status text style to use based on status type
  function getStatusTextStyle() {
    if (statusType === 'success') return [styles.statusText, styles.successStatusText];
    if (statusType === 'error') return [styles.statusText, styles.errorStatusText];
    return styles.statusText;
  }
});

const styles = StyleSheet.create({
  section: {
    width: '100%',
    backgroundColor: COLORS.background,
    padding: 16,
    borderRadius: 16,
  },
  mainContainer: {
    width: '100%',
    flexDirection: 'column',
  },
  chartContainer: {
    padding: 10,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  configuratorContainer: {
    width: '100%',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 10,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  askDot: {
    backgroundColor: '#5078FF',
  },
  bidDot: {
    backgroundColor: '#FF4F78',
  },
  legendText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
  },
  statusContainer: {
    backgroundColor: COLORS.lighterBackground,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderDarkColor,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successStatusContainer: {
    backgroundColor: 'rgba(3, 166, 109, 0.15)',
    borderColor: 'rgba(3, 166, 109, 0.3)',
  },
  errorStatusContainer: {
    backgroundColor: 'rgba(225, 45, 57, 0.15)',
    borderColor: 'rgba(225, 45, 57, 0.3)',
  },
  statusText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
    marginLeft: 8,
  },
  successStatusText: {
    color: '#03a66d',
  },
  errorStatusText: {
    color: '#e12d39',
  },
  button: {
    backgroundColor: COLORS.brandBlue,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.semiBold),
  },
  disabledButton: {
    opacity: 0.6,
  }
});

export default BondingCurveCard;
