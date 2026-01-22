import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Slider from '@react-native-community/slider';
import BN from 'bn.js';

import { BondingCurveConfiguratorStyles as styles } from './styles/BondingCurveConfigurator.style';
import { BondingCurveConfiguratorProps, CurveType } from '../types';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

// Default initial price array
const initialPrices = [
  new BN(28),
  new BN(35),
  new BN(50),
  new BN(90),
  new BN(180),
  new BN(380),
  new BN(800),
  new BN(1700),
  new BN(3500),
  new BN(7200),
  new BN(15000),
];

/**
 * An optimized component for configuring bonding curves
 */
const BondingCurveConfigurator = memo(({
  onCurveChange,
  styleOverrides = {},
  disabled = false,
}: BondingCurveConfiguratorProps) => {
  // Store the callback in a ref to avoid unnecessary re-renders
  const onCurveChangeRef = useRef(onCurveChange);
  const computeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update the ref when the callback changes
  useEffect(() => {
    onCurveChangeRef.current = onCurveChange;
  }, [onCurveChange]);

  // State for the price curve
  const [prices, setPrices] = useState<BN[]>(initialPrices);

  // Curve configuration state
  const [curveType, setCurveType] = useState<CurveType>('linear');
  const [points, setPoints] = useState<number>(11);
  const [basePrice, setBasePrice] = useState<number>(25);
  const [topPrice, setTopPrice] = useState<number>(15000);
  const [power, setPower] = useState<number>(2.0);
  const [feePercent, setFeePercent] = useState<number>(2.0);
  const [isComputing, setIsComputing] = useState(false);

  /**
   * Debounced curve computation function
   */
  const computeCurve = useCallback((config?: {
    type?: CurveType;
    points?: number;
    basePrice?: number;
    topPrice?: number;
    power?: number;
    feePercent?: number;
  }) => {
    const type = config?.type ?? curveType;
    const numPoints = config?.points ?? points;
    const base = config?.basePrice ?? basePrice;
    const top = config?.topPrice ?? topPrice;
    const curPower = config?.power ?? power;
    const fee = config?.feePercent ?? feePercent;

    // Clear any existing timeout
    if (computeTimeoutRef.current) {
      clearTimeout(computeTimeoutRef.current);
    }

    setIsComputing(true);

    // Use a short timeout to batch updates
    computeTimeoutRef.current = setTimeout(() => {
      try {
        const newPrices: BN[] = [];

        for (let i = 0; i < numPoints; i++) {
          const t = i / Math.max(numPoints - 1, 1);
          let price: number;

          switch (type) {
            case 'linear':
              price = base + t * (top - base);
              break;
            case 'power':
              price = base + (top - base) * Math.pow(t, curPower);
              break;
            case 'exponential': {
              const safeBase = base > 0 ? base : 1;
              price = safeBase * Math.pow(top / safeBase, t);
              break;
            }
            case 'logarithmic': {
              const logInput = 1 + 9 * t;
              const safeLog = logInput > 0 ? Math.log10(logInput) : 0;
              price = base + (top - base) * safeLog;
              break;
            }
            default:
              price = base + t * (top - base);
          }

          // Ensure price is valid
          if (!Number.isFinite(price)) price = base;
          if (price < 0) price = 0;
          if (price > 1e9) price = 1e9;

          newPrices.push(new BN(Math.floor(price)));
        }

        setPrices(newPrices);

        // Notify parent component of the change
        onCurveChangeRef.current(newPrices, {
          curveType: type,
          basePrice: base,
          topPrice: top,
          points: numPoints,
          feePercent: fee,
          power: curPower
        });
      } catch (error) {
        console.error('Error computing curve:', error);
      } finally {
        setIsComputing(false);
      }
    }, 50);
  }, [curveType, points, basePrice, topPrice, power, feePercent]);

  // Compute the curve on mount and when dependencies change
  useEffect(() => {
    computeCurve();

    // Cleanup on unmount
    return () => {
      if (computeTimeoutRef.current) {
        clearTimeout(computeTimeoutRef.current);
      }
    };
  }, [computeCurve]);

  // Handle curve type selection
  const handleCurveTypePress = useCallback((type: CurveType) => {
    if (disabled || isComputing) return;

    setCurveType(type);
    computeCurve({ type });
  }, [disabled, isComputing, computeCurve]);

  // Handle slider value changes
  const handleSliderChange = useCallback((
    type: 'points' | 'basePrice' | 'topPrice' | 'power' | 'feePercent',
    value: number
  ) => {
    switch (type) {
      case 'points':
        setPoints(value);
        break;
      case 'basePrice':
        setBasePrice(value);
        break;
      case 'topPrice':
        setTopPrice(value);
        break;
      case 'power':
        setPower(value);
        break;
      case 'feePercent':
        setFeePercent(value);
        break;
    }
  }, []);

  // Handle slider completion - recompute curve
  const handleSliderComplete = useCallback((
    type: 'points' | 'basePrice' | 'topPrice' | 'power' | 'feePercent',
    value: number
  ) => {
    const config: any = {};
    config[type] = value;
    computeCurve(config);
  }, [computeCurve]);

  // Format the value for display
  const formatSliderValue = useCallback((type: string, value: number) => {
    switch (type) {
      case 'points':
        return value.toString();
      case 'basePrice':
      case 'topPrice':
        return value.toLocaleString();
      case 'power':
      case 'feePercent':
        return value.toFixed(1);
      default:
        return value.toString();
    }
  }, []);

  return (
    <View style={styles.container}>
      {/* <Text style={styles.sectionTitle}>Curve Configuration</Text> */}

      {/* Curve Type Selector */}
      <View style={tabStyles.tabContainer}>
        {(['linear', 'power', 'exponential', 'logarithmic'] as CurveType[]).map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              tabStyles.tab,
              curveType === type && tabStyles.selectedTab,
              disabled && tabStyles.disabledTab,
              isComputing && tabStyles.disabledTab,
            ]}
            onPress={() => handleCurveTypePress(type)}
            disabled={disabled || isComputing}>
            <Text
              style={[
                tabStyles.tabText,
                curveType === type && tabStyles.selectedTabText,
                (disabled || isComputing) && tabStyles.disabledText,
              ]}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Parameter Sliders */}
      <View style={styles.slidersContainer}>
        {/* Points Slider */}
        <SliderWithLabel
          label="Points"
          value={points}
          formattedValue={formatSliderValue('points', points)}
          minimumValue={5}
          maximumValue={20}
          step={1}
          disabled={disabled || isComputing}
          onValueChange={(val) => handleSliderChange('points', val)}
          onSlidingComplete={(val) => handleSliderComplete('points', val)}
        />

        {/* Base Price Slider */}
        <SliderWithLabel
          label="Base Price"
          value={basePrice}
          formattedValue={formatSliderValue('basePrice', basePrice)}
          minimumValue={5}
          maximumValue={1000}
          step={5}
          disabled={disabled || isComputing}
          onValueChange={(val) => handleSliderChange('basePrice', val)}
          onSlidingComplete={(val) => handleSliderComplete('basePrice', val)}
        />

        {/* Top Price Slider */}
        <SliderWithLabel
          label="Top Price"
          value={topPrice}
          formattedValue={formatSliderValue('topPrice', topPrice)}
          minimumValue={1000}
          maximumValue={300000}
          step={1000}
          disabled={disabled || isComputing}
          onValueChange={(val) => handleSliderChange('topPrice', val)}
          onSlidingComplete={(val) => handleSliderComplete('topPrice', val)}
        />

        {/* Power Slider (only for power curve) */}
        {curveType === 'power' && (
          <SliderWithLabel
            label="Power"
            value={power}
            formattedValue={formatSliderValue('power', power)}
            minimumValue={0.5}
            maximumValue={3.0}
            step={0.1}
            disabled={disabled || isComputing}
            onValueChange={(val) => handleSliderChange('power', val)}
            onSlidingComplete={(val) => handleSliderComplete('power', val)}
          />
        )}

        {/* Fee Percentage Slider */}
        <SliderWithLabel
          label="Fee %"
          value={feePercent}
          formattedValue={`${formatSliderValue('feePercent', feePercent)}%`}
          minimumValue={0}
          maximumValue={10}
          step={0.1}
          disabled={disabled || isComputing}
          onValueChange={(val) => handleSliderChange('feePercent', val)}
          onSlidingComplete={(val) => handleSliderComplete('feePercent', val)}
        />
      </View>

      {/* Display loading indicator when computing */}
      {isComputing && (
        <View style={localStyles.loadingOverlay}>
          <ActivityIndicator size="small" color="#0065ff" />
          <Text style={localStyles.loadingText}>Updating...</Text>
        </View>
      )}

      {/* Sample price points */}

    </View>
  );
});

// Custom tab styles using app colors and typography
const tabStyles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    width: '100%',
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30, // More circular borders
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: COLORS.darkerBackground, // Dark background for all tabs
    height: 36,
    minWidth: 70, // Ensure a minimum width
    flexShrink: 1, // Allow shrinking if needed
    flexGrow: 1, // Allow growing if space is available
  },
  selectedTab: {
    backgroundColor: COLORS.lightBackground, // Slightly lighter background for selected tab
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  disabledTab: {
    opacity: 0.5,
  },
  tabText: {
    fontSize: TYPOGRAPHY.size.xs, // Slightly smaller font for better fit
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.regular),
    color: 'rgba(255, 255, 255, 0.5)', // Dimmed text for unselected
    textAlign: 'center',
  },
  selectedTabText: {
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.fontWeightToString(TYPOGRAPHY.medium),
  },
  disabledText: {
    color: 'rgba(255, 255, 255, 0.3)',
  }
});

// Slider with label component for better UI
interface SliderWithLabelProps {
  label: string;
  value: number;
  formattedValue: string;
  minimumValue: number;
  maximumValue: number;
  step: number;
  disabled: boolean;
  onValueChange: (value: number) => void;
  onSlidingComplete: (value: number) => void;
}

const SliderWithLabel: React.FC<SliderWithLabelProps> = ({
  label,
  value,
  formattedValue,
  minimumValue,
  maximumValue,
  step,
  disabled,
  onValueChange,
  onSlidingComplete
}) => (
  <View style={localStyles.sliderContainer}>
    <View style={localStyles.sliderLabelRow}>
      <Text style={localStyles.sliderLabel}>{label}</Text>
      <Text style={localStyles.sliderValue}>{formattedValue}</Text>
    </View>
    <Slider
      style={localStyles.slider}
      minimumValue={minimumValue}
      maximumValue={maximumValue}
      step={step}
      value={value}
      disabled={disabled}
      onValueChange={onValueChange}
      onSlidingComplete={onSlidingComplete}
      minimumTrackTintColor={COLORS.brandBlue}
      maximumTrackTintColor={COLORS.darkerBackground}
      thumbTintColor={COLORS.brandBlue}
    />
  </View>
);

const localStyles = StyleSheet.create({
  loadingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 8,
    borderRadius: 8,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#444',
    fontWeight: '500',
  },
  sliderContainer: {
    marginBottom: 16,
    width: '100%',
  },
  sliderLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sliderLabel: {
    fontSize: 15,
    color: COLORS.greyMid,
    fontWeight: '500',
  },
  sliderValue: {
    fontSize: 15,
    color: COLORS.greyMid,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  readoutTable: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableBodyContainer: {
    maxHeight: 200,
    overflow: Platform.OS === 'web' ? 'hidden' : 'scroll',
  },
  indexCell: {
    flex: 0.2,
    textAlign: 'center',
  },
  priceCell: {
    flex: 0.4,
    textAlign: 'right',
    color: '#5078FF',
  },
  bidCell: {
    flex: 0.4,
    textAlign: 'right',
    color: '#FF4F78',
  },
});

export default BondingCurveConfigurator;
