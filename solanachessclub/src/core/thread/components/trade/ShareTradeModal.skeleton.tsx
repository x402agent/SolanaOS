import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  Easing,
} from 'react-native';
import styles from './ShareTradeModal.style';

// Simple skeleton component with shimmer effect for loading states
export const SkeletonSwapItem = ({ index = 0 }) => {
  // Create animated value for shimmer effect
  const shimmerAnim = useRef(new Animated.Value(-1)).current;

  // Start the shimmer animation when component mounts
  useEffect(() => {
    const startShimmerAnimation = () => {
      Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        })
      ).start();
    };

    startShimmerAnimation();
    return () => shimmerAnim.stopAnimation();
  }, [shimmerAnim]);

  // Interpolate the animated value for the shimmer gradient
  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-300, 300],
  });

  return (
    <View style={styles.skeletonContainer}>
      <View style={styles.skeletonSwapItem}>
        {/* Token swap info row with shimmer effect */}
        <View style={styles.skeletonRow}>
          {/* From token */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={styles.skeletonTokenBox} />
            <View style={styles.skeletonMiddleContent}>
              <View style={styles.skeletonTextLong} />
              <View style={styles.skeletonTextShort} />
            </View>
          </View>

          {/* Arrow with inner circle for better appearance */}
          <View style={styles.skeletonArrow}>
            <View style={styles.skeletonArrowInner} />
          </View>

          {/* To token */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={styles.skeletonTokenBox} />
            <View style={styles.skeletonMiddleContent}>
              <View style={styles.skeletonTextLong} />
              <View style={styles.skeletonTextShort} />
            </View>
          </View>
        </View>

        {/* Date/timestamp line */}
        <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
          <View style={styles.skeletonDateText} />
        </View>

        {/* Shimmer overlay - contained within this skeleton item */}
        <Animated.View
          style={[
            styles.shimmerOverlay,
            {
              backgroundColor: 'white',
              // Create a gradient effect using linear gradient
              // Since we can't use LinearGradient directly, simulate with a skewed view
              width: 120,
              left: -60,
              opacity: 0.15,
              transform: [
                { translateX: shimmerTranslate },
                { skewX: '-30deg' }
              ],
            }
          ]}
        />
      </View>
    </View>
  );
};

// Create a list of skeleton items
export const SkeletonSwapList = ({ count = 5 }) => {
  return (
    <View style={{ flex: 1 }}>
      {/* Skeleton header that mimics the real list header */}
      <View style={styles.listHeaderContainer}>
        <View style={[styles.skeletonTextShort, { width: 120, marginBottom: 8 }]} />
        <View style={styles.swapsListDivider} />
      </View>

      {/* Skeleton items */}
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonSwapItem key={`skeleton-${index}`} index={index} />
      ))}
    </View>
  );
}; 