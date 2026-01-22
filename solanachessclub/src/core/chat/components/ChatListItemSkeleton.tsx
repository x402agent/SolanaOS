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

const ChatListItemSkeleton = () => {
    return (
        <View style={styles.container}>
            <SkeletonElement style={styles.avatar} />
            <View style={styles.chatInfoContainer}>
                <View style={styles.nameAndTimeContainer}>
                    <SkeletonElement style={[styles.textLine, { width: '60%' }]} />
                    <SkeletonElement style={[styles.timeDot, { width: 20, marginLeft: 'auto' }]} />
                </View>
                <SkeletonElement style={[styles.textLine, { width: '80%', marginTop: 8 }]} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: COLORS.background,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.lighterBackground, // Softer separator
    },
    skeletonElement: {
        backgroundColor: COLORS.lighterBackground, // Slightly lighter than main bg for contrast
        borderRadius: 4,
        overflow: 'hidden', // For shimmer effect
    },
    shimmer: {
        backgroundColor: COLORS.darkerBackground, // Darker for shimmer gradient
        opacity: 0.6,
    },
    avatar: {
        width: 48, // Standard avatar size
        height: 48,
        borderRadius: 24, // Circular avatar
        marginRight: 12,
    },
    chatInfoContainer: {
        flex: 1,
    },
    nameAndTimeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4, // Space between name and last message
    },
    textLine: {
        height: 14, // Standard text line height
        borderRadius: 4,
    },
    timeDot: {
        height: 10, // Smaller for timestamp
        borderRadius: 4,
    },
});

export default ChatListItemSkeleton; 