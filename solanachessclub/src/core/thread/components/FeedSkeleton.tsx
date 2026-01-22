import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import COLORS from '@/assets/colors';

const { width } = Dimensions.get('window');

const SkeletonElement = ({ style }: { style: any }) => {
    const shimmerAnimatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const shimmerAnimation = Animated.loop(
            Animated.timing(shimmerAnimatedValue, {
                toValue: 1,
                duration: 1200,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
            }),
        );
        shimmerAnimation.start();
        return () => shimmerAnimation.stop();
    }, [shimmerAnimatedValue]);

    const translateX = shimmerAnimatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [-width, width],
    });

    return (
        <View style={[styles.skeletonElement, style]}>
            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    styles.shimmer,
                    { transform: [{ translateX }] },
                ]}
            />
        </View>
    );
};

const FeedItemSkeleton = () => {
    return (
        <View style={styles.container}>
            {/* Avatar and User Info Skeleton */}
            <View style={styles.headerContainer}>
                <SkeletonElement style={styles.avatar} />
                <View style={styles.userInfoContainer}>
                    <SkeletonElement style={[styles.textLine, { width: '50%' }]} />
                    <SkeletonElement style={[styles.textLine, { width: '30%', marginTop: 6 }]} />
                </View>
            </View>

            {/* Post Content Skeleton */}
            <SkeletonElement style={[styles.contentLine, { width: '90%', marginTop: 12 }]} />
            <SkeletonElement style={[styles.contentLine, { width: '70%', marginTop: 8 }]} />
            <SkeletonElement style={[styles.contentLine, { width: '80%', marginTop: 8 }]} />

            {/* Optional: Actions or Image Placeholder Skeleton */}
            <SkeletonElement style={[styles.imagePlaceholder, { height: 150, marginTop: 12 }]} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: COLORS.background,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lighterBackground,
        marginBottom: 8,
    },
    skeletonElement: {
        backgroundColor: COLORS.lighterBackground,
        borderRadius: 4,
        overflow: 'hidden',
    },
    shimmer: {
        backgroundColor: COLORS.darkerBackground,
        opacity: 0.6,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    userInfoContainer: {
        marginLeft: 12,
        flex: 1,
    },
    textLine: {
        height: 14,
        borderRadius: 4,
    },
    contentLine: {
        height: 12,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    imagePlaceholder: {
        width: '100%',
        borderRadius: 8,
    },
});

export default FeedItemSkeleton; 