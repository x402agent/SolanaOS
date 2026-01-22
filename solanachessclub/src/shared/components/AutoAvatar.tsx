import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, ImageStyle, Animated, Easing, Platform } from 'react-native';
import { IPFSAwareImage, getValidImageSource } from '../utils/IPFSImage';
import { DEFAULT_IMAGES } from '../config/constants';
import COLORS from '@/assets/colors';

interface AutoAvatarProps {
    /** User ID/wallet address */
    userId?: string;
    /** Existing profile picture URL */
    profilePicUrl?: string | null;
    /** Avatar size */
    size?: number;
    /** Custom style for the avatar container */
    style?: ViewStyle;
    /** Custom style for the avatar image */
    imageStyle?: ImageStyle;
    /** Whether to show initials as fallback */
    showInitials?: boolean;
    /** Username for generating initials */
    username?: string;
    /** Whether to show a loading indicator */
    showLoading?: boolean;
    /** Custom loading component */
    loadingComponent?: React.ReactNode;
    /** Callback when avatar loads successfully */
    onLoad?: () => void;
    /** Callback when avatar fails to load */
    onError?: () => void;
    /** Whether to show shimmer loading animation */
    showShimmer?: boolean;
}

/**
 * Shimmer Component for loading state
 */
const ShimmerAvatar: React.FC<{ size: number; style?: ViewStyle }> = ({ size, style }) => {
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
        outputRange: [-size * 2, size * 2],
    });

    const shimmerStyle: ViewStyle = useMemo(() => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: COLORS.lighterBackground,
        overflow: 'hidden',
        ...style,
    }), [size, style]);

    return (
        <View style={shimmerStyle}>
            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    {
                        backgroundColor: COLORS.darkerBackground,
                        opacity: 0.6,
                        transform: [{ translateX }],
                    },
                ]}
            />
        </View>
    );
};

/**
 * Generate initials from username
 */
function getInitials(username?: string): string {
    if (!username || username.trim() === '') return '?';

    const cleanUsername = username.trim();

    // If username appears to be wallet-derived (6 chars), use first 2 chars
    if (cleanUsername.length === 6 && /^[a-zA-Z0-9]+$/.test(cleanUsername)) {
        return cleanUsername.substring(0, 2).toUpperCase();
    }

    // If username is very short, just use what we have
    if (cleanUsername.length <= 2) {
        return cleanUsername.toUpperCase();
    }

    // Otherwise get initials from words
    const words = cleanUsername.split(/\s+/).filter(word => word.length > 0);
    
    if (words.length === 0) {
        // If no valid words, use first 2 characters
        return cleanUsername.substring(0, 2).toUpperCase();
    } else if (words.length === 1) {
        // Single word, use first 2 characters
        return words[0].substring(0, 2).toUpperCase();
    } else {
        // Multiple words, use first letter of first and last word
        return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
}

/**
 * Generate consistent background color based on user ID
 */
function getAvatarColor(userId?: string): string {
    if (!userId) return COLORS.greyMid;

    // Simple hash function to generate consistent colors
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Get a pastel hue
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 60%, 80%)`;
}

/**
 * AutoAvatar Component
 */
export const AutoAvatar: React.FC<AutoAvatarProps> = React.memo(({
    userId,
    profilePicUrl,
    size = 40,
    style,
    imageStyle,
    showInitials = true,
    username,
    showLoading = false,
    loadingComponent,
    onLoad,
    onError,
    showShimmer = true,
}) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [imageAttempted, setImageAttempted] = useState(false);

    // Use the provided profile picture URL directly
    const finalAvatarUrl = profilePicUrl;

    // Generate initials and background color with memoization
    const initials = useMemo(() => getInitials(username), [username]);
    const backgroundColor = useMemo(() => getAvatarColor(userId), [userId]);

    // Container styles with memoization
    const containerStyle: ViewStyle = useMemo(() => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        ...style,
    }), [size, backgroundColor, style]);

    // Image styles with memoization
    const finalImageStyle: ImageStyle = useMemo(() => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        position: 'absolute',
        ...imageStyle,
    }), [size, imageStyle]);

    // Text styles for initials with memoization
    const textStyle: TextStyle = useMemo(() => ({
        fontSize: size * 0.45,
        fontWeight: '700',
        color: '#333',
        textAlign: 'center',
    }), [size]);

    // Handle image load with useCallback
    const handleImageLoad = useCallback(() => {
        setImageLoaded(true);
        setImageError(false);
        setImageAttempted(true);
        onLoad?.();
    }, [onLoad]);

    // Handle image error with useCallback
    const handleImageError = useCallback(() => {
        setImageLoaded(false);
        setImageError(true);
        setImageAttempted(true);
        onError?.();
    }, [onError]);

    // Reset image state when avatar URL changes
    useEffect(() => {
        if (finalAvatarUrl) {
            setImageLoaded(false);
            setImageError(false);
            setImageAttempted(false);
        }
    }, [finalAvatarUrl]);

    // Determine what to show based on current state
    const shouldShowShimmer = useMemo(() => {
        // Show shimmer only when loading is requested and we have a URL but haven't attempted to load
        return showShimmer && 
               finalAvatarUrl && 
               !imageAttempted && 
               !loadingComponent;
    }, [showShimmer, finalAvatarUrl, imageAttempted, loadingComponent]);

    const shouldShowCustomLoading = useMemo(() => {
        // Show custom loading if provided and we have a URL but haven't attempted to load
        return showLoading && 
               finalAvatarUrl && 
               !imageAttempted && 
               loadingComponent;
    }, [showLoading, finalAvatarUrl, imageAttempted, loadingComponent]);

    const shouldShowDefaultLoading = useMemo(() => {
        // Show default loading if requested and no custom component and shimmer is disabled
        return showLoading && 
               finalAvatarUrl && 
               !imageAttempted && 
               !loadingComponent && 
               !showShimmer;
    }, [showLoading, finalAvatarUrl, imageAttempted, loadingComponent, showShimmer]);

    const shouldShowInitials = useMemo(() => {
        // Show initials if:
        // 1. Initials are enabled AND
        // 2. We're not showing any loading state AND
        // 3. Either no image or image failed to load
        return showInitials && 
               !shouldShowShimmer && 
               !shouldShowCustomLoading && 
               !shouldShowDefaultLoading &&
               (!finalAvatarUrl || imageError || (!imageLoaded && imageAttempted));
    }, [showInitials, shouldShowShimmer, shouldShowCustomLoading, shouldShowDefaultLoading, finalAvatarUrl, imageError, imageLoaded, imageAttempted]);

    const shouldShowImage = useMemo(() => {
        // Show image if we have a URL and it's not in an error state
        return finalAvatarUrl && !imageError;
    }, [finalAvatarUrl, imageError]);

    return (
        <View style={containerStyle}>
            {/* Show shimmer loading skeleton */}
            {shouldShowShimmer && (
                <ShimmerAvatar size={size} style={style} />
            )}

            {/* Show custom loading component if provided */}
            {shouldShowCustomLoading && loadingComponent}

            {/* Show default loading indicator if requested and no custom component */}
            {shouldShowDefaultLoading && (
                <View style={[containerStyle, { backgroundColor: COLORS.greyLight }]}>
                    <Text style={[textStyle, { color: COLORS.greyDark }]}>...</Text>
                </View>
            )}

            {/* Show initials if appropriate */}
            {shouldShowInitials && (
                <Text style={textStyle}>{initials}</Text>
            )}

            {/* Show avatar image if available */}
            {shouldShowImage && (
                <IPFSAwareImage
                    source={getValidImageSource(finalAvatarUrl)}
                    defaultSource={DEFAULT_IMAGES.user}
                    style={finalImageStyle}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    // Use stable key for consistent rendering
                    key={`avatar-${userId}-${finalAvatarUrl}`}
                />
            )}
        </View>
    );
});

AutoAvatar.displayName = 'AutoAvatar';

/**
 * Simplified AutoAvatar for common use cases
 */
export const SimpleAutoAvatar: React.FC<{
    userId?: string;
    profilePicUrl?: string | null;
    username?: string;
    size?: number;
    style?: ViewStyle;
    showShimmer?: boolean;
}> = ({ userId, profilePicUrl, username, size = 40, style, showShimmer = true }) => {
    return (
        <AutoAvatar
            userId={userId}
            profilePicUrl={profilePicUrl}
            username={username}
            size={size}
            style={style}
            showInitials={true}
            showShimmer={showShimmer}
        />
    );
};

export default AutoAvatar; 