import React, {
  useEffect,
  useRef,
  useMemo,
  useState,
  useCallback,
  useLayoutEffect,
} from 'react';
import {
  View,
  Dimensions,
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  Platform,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import {
  Circle,
  ClipPath,
  Defs,
  Image as SvgImage,
  Line,
  Rect,
  G,
  Text as SvgText,
  LinearGradient as SvgLinearGradient,
  Stop,
  Polygon,
} from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

interface LineGraphProps {
  data: number[];
  width?: number;
  executionPrice?: number;
  executionTimestamp?: number;
  timestamps?: number[];
  executionColor?: string;
  userAvatar?: any;
  isLoading?: boolean;
}

const LineGraphSkeleton: React.FC<{ width: number; height: number }> = React.memo(({ width, height }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const gradientWidth = width * 0.6; // Width of the shimmer gradient

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200, // Duration for one shimmer cycle
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => {
      animation.stop();
    };
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    // Move from off-screen left to off-screen right
    outputRange: [-gradientWidth, width + gradientWidth],
  });

  const baseColor = COLORS.borderDarkColor; // Base color of the skeleton
  const highlightColor = COLORS.lightBackground; // Color of the shimmer highlight

  return (
    <View
      style={{
        width,
        height,
        backgroundColor: baseColor,
        overflow: 'hidden', // Important to clip the gradient
        borderRadius: 0,
      }}
    >
      <Animated.View
        style={{
          width: gradientWidth,
          height: '100%',
          position: 'absolute',
          transform: [{ translateX }],
        }}
      >
        <LinearGradient
          colors={['transparent', highlightColor, 'transparent']}
          style={{ flex: 1 }}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
        />
      </Animated.View>
    </View>
  );
});

/**
 * A line chart that handles its own hover tooltip
 * without the chart's built-in touch events.
 */
const LineGraph: React.FC<LineGraphProps> = ({
  data,
  width,
  executionPrice,
  executionTimestamp,
  timestamps,
  userAvatar,
  executionColor = COLORS.brandGreen,
  isLoading = false,
}) => {
  // The chart height is set to 130px
  const chartHeight = 130;

  // We'll assume the caller either passes a width or we do a default
  const containerWidth = width || Dimensions.get('window').width - 64;

  // Adjusted padding to ensure rightmost points are visible
  const HORIZONTAL_PADDING = 16;
  const usableChartWidth = containerWidth - (HORIZONTAL_PADDING * 2);

  // We'll animate data changes
  const animatedData = useRef(new Animated.Value(0)).current;
  const currentData = useRef(data);
  const [displayData, setDisplayData] = useState(data);

  // Our tooltip state
  const [tooltipPos, setTooltipPos] = useState<{
    x: number;
    y: number;
    index: number;
    price: number;
  } | null>(null);

  // Keep track of old data length to see if the data truly changed
  const prevDataLengthRef = useRef(data.length);

  // Precompute min/max
  const dataRange = useMemo(() => {
    if (!data || data.length === 0) return { min: 0, max: 0, range: 0 };
    const min = Math.min(...data);
    const max = Math.max(...data);
    return { min, max, range: max - min };
  }, [data]);

  // Convert potentially second-based timestamps to ms
  const convertTimestampToMs = (timestamp: number): number => {
    const year2000 = 946684800000;
    if (timestamp < year2000 / 1000) {
      return timestamp * 1000;
    }
    const now = Date.now();
    if (timestamp > 946684800 && timestamp < now / 100) {
      return timestamp * 1000;
    }
    return timestamp;
  };

  // Calculate the Y position for a dataPoint
  const interpolateY = useCallback(
    (dataPoint: number) => {
      const availableHeight = chartHeight - 16;
      const ratio =
        (dataPoint - dataRange.min) /
        (dataRange.range === 0 ? 1 : dataRange.range);
      return availableHeight - ratio * availableHeight + 8;
    },
    [dataRange],
  );

  // Called each time the user moves or presses
  const calculateTooltipPosition = useCallback(
    (rawX: number) => {
      if (data.length === 0) {
        return;
      }

      // Adjust for the horizontal padding
      const adjustedX = rawX - HORIZONTAL_PADDING;

      // Clamp the X so it doesn't go beyond the chart
      let clampedX = Math.max(0, Math.min(adjustedX, usableChartWidth));

      const segmentWidth = usableChartWidth / (data.length - 1);
      let index = Math.round(clampedX / segmentWidth);
      index = Math.max(0, Math.min(data.length - 1, index));

      const dataPoint = displayData[index];
      const y = interpolateY(dataPoint);

      // Add back the padding for display positioning
      setTooltipPos({ x: clampedX + HORIZONTAL_PADDING, y, index, price: dataPoint });
    },
    [data, displayData, usableChartWidth, interpolateY, HORIZONTAL_PADDING],
  );

  // PanResponder to track finger movement across the overlay
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => {
        calculateTooltipPosition(evt.nativeEvent.locationX);
      },
      onPanResponderMove: evt => {
        calculateTooltipPosition(evt.nativeEvent.locationX);
      },
      onPanResponderRelease: () => {
        setTooltipPos(null);
      },
      onPanResponderTerminate: () => {
        setTooltipPos(null);
      },
    });
  }, [calculateTooltipPosition]);

  // Animate from old data to new data only if the array truly changed
  useLayoutEffect(() => {
    const dataChanged =
      data.length !== prevDataLengthRef.current ||
      JSON.stringify(data) !== JSON.stringify(currentData.current);

    if (!dataChanged) {
      return;
    }
    prevDataLengthRef.current = data.length;

    // Start animation
    animatedData.setValue(0);
    const prevData = [...currentData.current];
    currentData.current = data;

    Animated.timing(animatedData, {
      toValue: 1,
      duration: 400,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // Linear interpolation for the displayed data
    const id = animatedData.addListener(({ value }) => {
      const newData = data.map((target, i) => {
        // If prevData didn't have this point, animate from the bottom of the new data range
        const start = prevData[i] ?? dataRange.min;
        return start + (target - start) * value;
      });
      setDisplayData(newData);
    });

    return () => {
      animatedData.removeListener(id);
    };
  }, [data, animatedData]);

  // Format date/time
  const formatTimestamp = useCallback((ts: number) => {
    if (!ts) return '';
    const inMs = ts < 10000000000 ? ts * 1000 : ts;
    const d = new Date(inMs);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Format price
  const formatPrice = useCallback((price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(price);
  }, []);

  // Convert userAvatar into a string URI if possible
  const avatarUri = useMemo(() => {
    if (!userAvatar) return null;

    // For iOS, use original avatar directly without transformation
    if (Platform.OS === 'ios') {
      if (typeof userAvatar === 'string') return userAvatar;
      if (userAvatar.uri) return userAvatar.uri;
      return null;
    }

    // For Android - handle IPFS URLs to avoid 403/429 errors
    if (typeof userAvatar === 'string') {
      const avatarStr = String(userAvatar);
      // Handle IPFS URLs
      if (avatarStr.includes('ipfs.io/ipfs/')) {
        const parts = avatarStr.split('/ipfs/');
        if (parts.length > 1) {
          const ipfsHash = parts[1].split('?')[0]?.split('#')[0];
          if (ipfsHash) {
            return `https://nftstorage.link/ipfs/${ipfsHash}`;
          }
        }
      } else if (avatarStr.startsWith('ipfs://')) {
        const ipfsHash = avatarStr.slice(7).split('?')[0]?.split('#')[0];
        if (ipfsHash) {
          return `https://nftstorage.link/ipfs/${ipfsHash}`;
        }
      }
      // Not an IPFS URL or couldn't extract hash
      return avatarStr;
    }

    // Handle object with URI
    if (userAvatar.uri) {
      const uriStr = String(userAvatar.uri);
      if (uriStr.includes('ipfs.io/ipfs/')) {
        const parts = uriStr.split('/ipfs/');
        if (parts.length > 1) {
          const ipfsHash = parts[1].split('?')[0]?.split('#')[0];
          if (ipfsHash) {
            return `https://nftstorage.link/ipfs/${ipfsHash}`;
          }
        }
      }
      return uriStr;
    }

    return null;
  }, [userAvatar]);

  // Figure out where to place the "execution" marker
  const executionIndex = useMemo(() => {
    if (!executionPrice || data.length === 0) return -1;

    // If we have timestamps
    if (timestamps && timestamps.length === data.length && executionTimestamp) {
      let parsedExecTs =
        typeof executionTimestamp === 'number'
          ? executionTimestamp
          : Date.parse(String(executionTimestamp));

      if (Number.isNaN(parsedExecTs)) {
        // fallback to price-based below if parse failed
      } else {
        parsedExecTs = convertTimestampToMs(parsedExecTs);

        const timeInMs = timestamps.map(t => (t < 10000000000 ? t * 1000 : t));
        const first = timeInMs[0];
        const last = timeInMs[timeInMs.length - 1];
        if (parsedExecTs < first) return 0;
        if (parsedExecTs > last) return data.length - 1;

        let closest = 0;
        let minDiff = Math.abs(timeInMs[0] - parsedExecTs);
        for (let i = 1; i < timeInMs.length; i++) {
          const diff = Math.abs(timeInMs[i] - parsedExecTs);
          if (diff < minDiff) {
            minDiff = diff;
            closest = i;
          }
        }
        return closest;
      }
    }

    // fallback: find by price
    let idx = 0;
    let best = Math.abs(data[0] - executionPrice);
    for (let i = 1; i < data.length; i++) {
      const diff = Math.abs(data[i] - executionPrice);
      if (diff < best) {
        best = diff;
        idx = i;
      }
    }
    return idx;
  }, [data, timestamps, executionPrice, executionTimestamp]);

  // Chart config
  const chartConfig = useMemo(
    () => ({
      backgroundColor: COLORS.lightBackground,
      backgroundGradientFrom: COLORS.lightBackground,
      backgroundGradientTo: COLORS.lightBackground,
      decimalPlaces: 2,
      color: () => COLORS.brandBlue, // Use blue for the line
      labelColor: () => COLORS.accessoryDarkColor,
      formatYLabel: (v: string) => `$${v}`,
      style: { borderRadius: 0 },
      propsForDots: { r: '0' },
      propsForBackgroundLines: { strokeWidth: 0 },
      propsForLabels: { fontSize: TYPOGRAPHY.size.xs, display: 'none' }, // Hide axis labels
    }),
    [],
  );

  // Data to feed to the chart library
  const chartData = useMemo(
    () => ({
      labels: ['', '', '', '', '', ''],
      datasets: [
        {
          data: displayData.length > 0 ? displayData : [0, 0],
          strokeWidth: 3,
          color: () => COLORS.brandBlue,
        },
      ],
    }),
    [displayData],
  );

  // Keep track of each data point's (x, y)
  const pointsRef = useRef<{ x: number; y: number }[]>([]);

  // Build the tooltip's SVG elements
  const renderTooltip = useCallback(
    (x: number, y: number, idx: number, price: number) => {
      // Shift tooltip horizontally if near edges
      const tooltipWidth = 130;
      const isNearLeft = x < 100;
      const isNearRight = x > containerWidth - 100;

      let tX = x;
      let anchor: 'start' | 'middle' | 'end' = 'middle';

      if (isNearLeft) {
        tX = tooltipWidth / 2 + 8;
      } else if (isNearRight) {
        tX = containerWidth - tooltipWidth / 2 - 8;
      }

      return (
        <React.Fragment key={`tooltip-${idx}`}>
          {/* dashed line */}
          <Line
            x1={x}
            y1={8}
            x2={x}
            y2={chartHeight - 8}
            stroke={COLORS.brandBlue}
            strokeWidth={1.5}
            strokeDasharray="3,3"
            strokeOpacity={0.8}
          />
          {/* highlight circle */}
          <Circle
            cx={x}
            cy={y}
            r={4}
            fill={COLORS.brandBlue}
            stroke={COLORS.background}
            strokeWidth={2}
          />
          {/* tooltip rect + text */}
          <G>
            <Defs>
              <SvgLinearGradient id="tooltipBg" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={COLORS.lighterBackground} stopOpacity={1} />
                <Stop offset="1" stopColor={COLORS.lighterBackground} stopOpacity={1} />
              </SvgLinearGradient>
            </Defs>

            <Rect
              x={tX - tooltipWidth / 2}
              y={16}
              width={tooltipWidth}
              height={50}
              rx={10}
              fill="url(#tooltipBg)"
              stroke={COLORS.borderDarkColor}
              strokeWidth={1.5}
            />

            <SvgText
              x={tX}
              y={35}
              fill={COLORS.brandBlue}
              fontSize={TYPOGRAPHY.size.md}
              fontWeight="bold"
              textAnchor="middle">
              {formatPrice(price)}
            </SvgText>
            {timestamps && timestamps[idx] && (
              <SvgText
                x={tX}
                y={50}
                fill={COLORS.accessoryDarkColor}
                fontSize={TYPOGRAPHY.size.xs}
                textAnchor="middle">
                {formatTimestamp(timestamps[idx])}
              </SvgText>
            )}
          </G>
        </React.Fragment>
      );
    },
    [formatPrice, formatTimestamp, containerWidth, chartHeight, timestamps],
  );

  // Called by the chart for each data point
  const renderDotContent = useCallback(
    ({ x, y, index }: { x: number; y: number; index: number }) => {
      pointsRef.current[index] = { x, y };

      const elements: JSX.Element[] = [];

      // If we have an execution marker
      if (executionPrice && index === executionIndex) {
        elements.push(
          <React.Fragment key={`exec-${index}`}>
            {avatarUri ? (
              <>
                <Defs>
                  <ClipPath id={`avatar-clip-${index}`}>
                    <Circle cx={x} cy={y} r={10} />
                  </ClipPath>
                </Defs>
                <Circle
                  cx={x}
                  cy={y}
                  r={11}
                  stroke={executionColor}
                  strokeWidth={2}
                  fill={executionColor}
                />
                <SvgImage
                  x={x - 10}
                  y={y - 10}
                  width={20}
                  height={20}
                  href={{ uri: avatarUri }}
                  clipPath={`url(#avatar-clip-${index})`}
                  preserveAspectRatio="xMidYMid slice"
                />
              </>
            ) : (
              <>
                <Circle
                  cx={x}
                  cy={y}
                  r={8}
                  stroke={executionColor}
                  strokeWidth={3}
                  fill={COLORS.background}
                />
                <Circle cx={x} cy={y} r={4} fill={executionColor} />
              </>
            )}
          </React.Fragment>,
        );
      }

      // Make rightmost point visible
      if (index === data.length - 1) {
        elements.push(
          <Circle
            key={`last-point-${index}`}
            cx={x}
            cy={y}
            r={8}
            fill={COLORS.brandBlue}
            stroke={COLORS.background}
            strokeWidth={2}
          />
        );
      }

      // If user is hovering near this point
      if (tooltipPos && index === tooltipPos.index) {
        elements.push(renderTooltip(x, y, index, tooltipPos.price));
      }

      return elements;
    },
    [
      executionPrice,
      executionIndex,
      avatarUri,
      executionColor,
      tooltipPos,
      renderTooltip,
      data.length,
    ],
  );

  // Partial fill from left to hovered point
  const renderHoverFill = useCallback(() => {
    if (!tooltipPos) return null;
    const hoveredIndex = tooltipPos.index;
    if (!pointsRef.current[hoveredIndex]) {
      return null;
    }

    let fillPoints = '';
    for (let i = 0; i <= hoveredIndex; i++) {
      const { x, y } = pointsRef.current[i];
      fillPoints += `${x},${y} `;
    }

    const { x: lastX } = pointsRef.current[hoveredIndex];
    const { x: firstX } = pointsRef.current[0];

    // go down to bottom
    fillPoints += `${lastX},${chartHeight - 8} ${firstX},${chartHeight - 8}`;

    return (
      <G>
        <Defs>
          <SvgLinearGradient id="hoverFillGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={COLORS.brandBlue} stopOpacity={0.2} />
            <Stop offset="1" stopColor={COLORS.brandBlue} stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>
        <Polygon fill="url(#hoverFillGradient)" points={fillPoints.trim()} />
      </G>
    );
  }, [tooltipPos]);

  return (
    <View style={styles.container}>
      {isLoading ? (
        <LineGraphSkeleton width={containerWidth} height={chartHeight} />
      ) : !data || data.length < 2 ? (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No chart data available</Text>
        </View>
      ) : (
        <>
          <LineChart
            data={chartData}
            width={containerWidth}
            height={chartHeight}
            chartConfig={chartConfig}
            bezier
            withDots
            withHorizontalLines={false}
            withVerticalLines={false}
            withHorizontalLabels={false}
            withVerticalLabels={false}
            withShadow={false}
            style={{
              borderRadius: 0,
              paddingRight: HORIZONTAL_PADDING,
              paddingLeft: HORIZONTAL_PADDING,
              paddingTop: 0,
              paddingBottom: 0,
              margin: 0,
              backgroundColor: COLORS.lightBackground,
            }}
            renderDotContent={renderDotContent}
            decorator={renderHoverFill}
          />

          {/* Transparent overlay that captures all pointer events */}
          <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.lightBackground,
    overflow: 'hidden',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  noDataText: {
    color: COLORS.accessoryDarkColor,
    fontSize: TYPOGRAPHY.size.sm,
  },
});

export default React.memo(LineGraph, (prev, next) => {
  if (prev.data.length !== next.data.length) return false;
  if (prev.executionPrice !== next.executionPrice) return false;
  if (prev.executionTimestamp !== next.executionTimestamp) return false;
  if (prev.width !== next.width) return false;
  if (prev.isLoading !== next.isLoading) return false;
  if (JSON.stringify(prev.data) !== JSON.stringify(next.data)) return false;

  // Compare timestamps array
  if (
    prev.timestamps &&
    next.timestamps &&
    JSON.stringify(prev.timestamps) !== JSON.stringify(next.timestamps)
  ) {
    return false;
  }

  // Return true if none of the above conditions triggered a return false
  return true;
});
