import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    Easing,
    Dimensions,
    Platform,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/shared/state/store';
import { clearNotification } from '@/shared/state/notification/reducer';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

const { width } = Dimensions.get('window');

/**
 * A component that displays transaction success and error notifications as an animated bottom drawer
 * with a sleek, modern design
 */
const TransactionNotification = () => {
    const dispatch = useDispatch();
    const { visible, message, type } = useSelector(
        (state: RootState) => state.notification
    );

    // Animation for sliding up/down
    const slideAnim = useRef(new Animated.Value(100)).current;
    // Animation for opacity
    const opacityAnim = useRef(new Animated.Value(0)).current;
    // Animation for scale
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    useEffect(() => {
        if (visible) {
            // Show the notification with spring-like animation
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    damping: 15,
                    mass: 1,
                    stiffness: 150,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.ease),
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    useNativeDriver: true,
                    damping: 15,
                    mass: 1,
                    stiffness: 150,
                }),
            ]).start();

            // Auto-hide after 5 seconds
            const timer = setTimeout(() => {
                hideNotification();
            }, 5000);

            return () => clearTimeout(timer);
        } else {
            // Reset animation values when hidden
            slideAnim.setValue(100);
            opacityAnim.setValue(0);
            scaleAnim.setValue(0.9);
        }
    }, [visible]);

    const hideNotification = () => {
        Animated.parallel([
            Animated.spring(slideAnim, {
                toValue: 100,
                useNativeDriver: true,
                damping: 15,
                mass: 1,
                stiffness: 150,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
                easing: Easing.in(Easing.ease),
            }),
            Animated.spring(scaleAnim, {
                toValue: 0.9,
                useNativeDriver: true,
                damping: 15,
                mass: 1,
                stiffness: 150,
            }),
        ]).start(() => {
            dispatch(clearNotification());
        });
    };

    // If not visible, don't render
    if (!visible || !message) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [
                        { translateY: slideAnim },
                        { scale: scaleAnim }
                    ],
                    opacity: opacityAnim,
                },
            ]}>
            <View style={[
                styles.notification,
                type === 'success' ? styles.successNotification : styles.errorNotification,
            ]}>
                <View style={styles.iconContainer}>
                    <Text style={[
                        styles.iconText,
                        { color: type === 'success' ? COLORS.brandGreen : COLORS.errorRed }
                    ]}>
                        {type === 'success' ? '✓' : '!'}
                    </Text>
                </View>
                <View style={styles.content}>
                    <Text style={styles.title}>{type === 'success' ? 'Success' : 'Error'}</Text>
                    <Text style={styles.message}>{message}</Text>
                </View>
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={hideNotification}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.closeButtonText}>×</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 50 : 30,
        width: width,
        zIndex: 999,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    notification: {
        flexDirection: 'row',
        width: '100%',
        padding: 16,
        alignItems: 'center',
        borderRadius: 16,
        backgroundColor: COLORS.lightBackground,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
    },
    successNotification: {
        borderLeftWidth: 4,
        borderLeftColor: COLORS.brandGreen,
    },
    errorNotification: {
        borderLeftWidth: 4,
        borderLeftColor: COLORS.errorRed,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Platform.OS === 'ios' ? 'rgba(255, 255, 255, 0.1)' : COLORS.lighterBackground,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    iconText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
    },
    title: {
        fontFamily: TYPOGRAPHY.fontFamily,
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.white,
        marginBottom: 2,
    },
    message: {
        fontFamily: TYPOGRAPHY.fontFamily,
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.accessoryDarkColor,
        lineHeight: TYPOGRAPHY.lineHeight.sm,
    },
    closeButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Platform.OS === 'ios' ? 'rgba(255, 255, 255, 0.1)' : COLORS.lighterBackground,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    closeButtonText: {
        fontSize: 20,
        color: COLORS.accessoryDarkColor,
        lineHeight: 20,
        textAlign: 'center',
    },
});

export default TransactionNotification; 