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

const ProfileSkeleton = () => {
    return (
        <View style={styles.container}>
            {/* Profile Header Skeleton */}
            <View style={styles.headerContainer}>
                <SkeletonElement style={styles.avatar} />
                <View style={styles.headerTextContainer}>
                    <SkeletonElement style={[styles.textLine, { width: '60%' }]} />
                    <SkeletonElement style={[styles.textLine, { width: '40%', marginTop: 8 }]} />
                </View>
            </View>
            <SkeletonElement style={[styles.descriptionLine, { width: '90%', marginTop: 16 }]} />
            <SkeletonElement style={[styles.descriptionLine, { width: '80%', marginTop: 8 }]} />

            {/* Stats Skeleton */}
            <View style={styles.statsContainer}>
                <SkeletonElement style={[styles.statItem, { width: '25%' }]} />
                <SkeletonElement style={[styles.statItem, { width: '25%' }]} />
            </View>

            {/* Tabs Skeleton */}
            <View style={styles.tabsContainer}>
                <SkeletonElement style={[styles.tabItem, { width: '45%' }]} />
                <SkeletonElement style={[styles.tabItem, { width: '45%' }]} />
            </View>

            {/* Content Placeholder Skeleton (e.g., for posts or NFTs) */}
            <View style={styles.contentPlaceholder}>
                <SkeletonElement style={[styles.contentBlock, { height: 100 }]} />
                <SkeletonElement style={[styles.contentBlock, { height: 150, marginTop: 16 }]} />
                <SkeletonElement style={[styles.contentBlock, { height: 120, marginTop: 16 }]} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: COLORS.background,
    },
    skeletonElement: {
        backgroundColor: COLORS.lighterBackground, // Use a valid color
        borderRadius: 4,
        overflow: 'hidden', // Important for shimmer effect
    },
    shimmer: {
        backgroundColor: COLORS.darkerBackground, // Use a valid color
        opacity: 0.6,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    headerTextContainer: {
        marginLeft: 16,
        flex: 1,
    },
    textLine: {
        height: 20,
        borderRadius: 4,
    },
    descriptionLine: {
        height: 16,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 24,
    },
    statItem: {
        height: 40,
        borderRadius: 4,
    },
    tabsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 24,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lighterBackground, // Use a valid color
        paddingBottom: 8,
    },
    tabItem: {
        height: 30,
        borderRadius: 4,
    },
    contentPlaceholder: {
        marginTop: 24,
    },
    contentBlock: {
        width: '100%',
        borderRadius: 8,
    },
});

export default ProfileSkeleton; 