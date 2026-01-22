import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Dimensions,
    StatusBar,
    Share,
    Alert,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import Icons from '@/assets/svgs';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface QRCodeModalProps {
    visible: boolean;
    onClose: () => void;
    walletAddress: string;
}

function QRCodeModal({ visible, onClose, walletAddress }: QRCodeModalProps) {
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(screenHeight)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const qrScale = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        if (visible) {
            // Animate drawer up and backdrop in
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    tension: 100,
                    friction: 8,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();

            // Delayed QR code scale animation
            setTimeout(() => {
                Animated.spring(qrScale, {
                    toValue: 1,
                    tension: 120,
                    friction: 7,
                    useNativeDriver: true,
                }).start();
            }, 200);
        } else {
            // Animate drawer down and backdrop out
            Animated.parallel([
                Animated.timing(translateY, {
                    toValue: screenHeight,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(backdropOpacity, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();

            // Reset QR scale
            qrScale.setValue(0.8);
        }
    }, [visible, translateY, backdropOpacity, qrScale]);

    const handleShare = async () => {
        try {
            await Share.share({
                message: `My Solana wallet address: ${walletAddress}`,
                title: 'Solana Wallet Address',
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to share wallet address');
        }
    };

    const handleBackdropPress = () => {
        onClose();
    };

    const onGestureEvent = Animated.event(
        [{ nativeEvent: { translationY: translateY } }],
        { useNativeDriver: true }
    );

    const onHandlerStateChange = (event: any) => {
        if (event.nativeEvent.oldState === State.ACTIVE) {
            const { translationY, velocityY } = event.nativeEvent;

            if (translationY > 100 || velocityY > 500) {
                onClose();
            } else {
                Animated.spring(translateY, {
                    toValue: 0,
                    tension: 100,
                    friction: 8,
                    useNativeDriver: true,
                }).start();
            }
        }
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <StatusBar backgroundColor="rgba(0,0,0,0.6)" barStyle="light-content" />

            {/* Backdrop */}
            <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                <TouchableOpacity
                    style={styles.backdropTouchable}
                    activeOpacity={1}
                    onPress={handleBackdropPress}
                />
            </Animated.View>

            {/* Bottom Drawer */}
            <PanGestureHandler
                onGestureEvent={onGestureEvent}
                onHandlerStateChange={onHandlerStateChange}
            >
                <Animated.View
                    style={[
                        styles.drawerContainer,
                        {
                            transform: [{ translateY }],
                            paddingBottom: Math.max(insets.bottom, 20),
                        },
                    ]}
                >
                    {/* Drag Handle */}
                    <View style={styles.dragHandle} />

                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerContent}>
                            <View style={styles.titleContainer}>
                                <Icons.QrCodeIcon width={24} height={24} color={COLORS.brandPrimary} />
                                <Text style={styles.title}>Receive Funds</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={onClose}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Icons.cross width={20} height={20} color={COLORS.greyDark} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* QR Code Section */}
                    <View style={styles.qrSection}>
                        <Animated.View style={[styles.qrContainer, { transform: [{ scale: qrScale }] }]}>
                            <View style={styles.qrWrapper}>
                                <QRCode
                                    value={walletAddress}
                                    size={240}
                                    color={COLORS.background}
                                    backgroundColor={COLORS.white}
                                    logo={require('@/assets/images/SOL_logo.png')}
                                    logoSize={50}
                                    logoBackgroundColor="transparent"
                                    logoMargin={6}
                                    logoBorderRadius={10}
                                    quietZone={15}
                                    ecl="M"
                                />
                            </View>

                            {/* Glow effect */}
                            <View style={styles.qrGlow} />
                        </Animated.View>

                        <Text style={styles.qrDescription}>
                            Scan this QR code to receive SOL and SPL tokens
                        </Text>
                    </View>

                    {/* Address Section */}
                    <View style={styles.addressSection}>
                        <Text style={styles.sectionLabel}>Wallet Address</Text>
                        <View style={styles.addressContainer}>
                            <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="middle">
                                {walletAddress}
                            </Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionsSection}>
                        <TouchableOpacity
                            style={styles.shareButton}
                            onPress={handleShare}
                            activeOpacity={0.8}
                        >
                            <View style={styles.shareButtonContent}>
                                <Icons.ShareIdle width={20} height={20} color={COLORS.white} />
                                <Text style={styles.shareButtonText}>Share Address</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Security Note */}
                    <View style={styles.securityNote}>
                        <View style={styles.securityIcon}>
                            <Icons.BlueCheck width={16} height={16} color={COLORS.brandGreen} />
                        </View>
                        <Text style={styles.securityText}>
                            Only share this address with trusted sources
                        </Text>
                    </View>
                </Animated.View>
            </PanGestureHandler>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    backdropTouchable: {
        flex: 1,
    },
    drawerContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 8,
        paddingHorizontal: 20,
        maxHeight: screenHeight * 0.85,
        shadowColor: COLORS.black,
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 20,
    },
    dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: COLORS.greyDark,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
        opacity: 0.6,
    },
    header: {
        marginBottom: 24,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    title: {
        fontSize: TYPOGRAPHY.size.xl,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.white,
        fontFamily: TYPOGRAPHY.fontFamily,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.lighterBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    qrSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    qrContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    qrWrapper: {
        padding: 20,
        backgroundColor: COLORS.white,
        borderRadius: 20,
        shadowColor: COLORS.brandPrimary,
        shadowOffset: {
            width: 0,
            height: 0,
        },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    qrGlow: {
        position: 'absolute',
        top: -10,
        left: -10,
        right: -10,
        bottom: -10,
        backgroundColor: COLORS.brandPrimary,
        borderRadius: 30,
        opacity: 0.1,
        zIndex: -1,
    },
    qrDescription: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.greyDark,
        textAlign: 'center',
        fontFamily: TYPOGRAPHY.fontFamily,
        lineHeight: TYPOGRAPHY.lineHeight.sm,
    },
    addressSection: {
        marginBottom: 24,
    },
    sectionLabel: {
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.weights.medium,
        color: COLORS.greyDark,
        marginBottom: 8,
        fontFamily: TYPOGRAPHY.fontFamily,
    },
    addressContainer: {
        backgroundColor: COLORS.lighterBackground,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    addressText: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.white,
        fontFamily: 'monospace',
        textAlign: 'center',
        lineHeight: TYPOGRAPHY.lineHeight.sm,
    },
    actionsSection: {
        marginBottom: 20,
    },
    shareButton: {
        backgroundColor: COLORS.brandBlue,
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 24,
        shadowColor: COLORS.brandBlue,
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    shareButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    shareButtonText: {
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.white,
        fontFamily: TYPOGRAPHY.fontFamily,
    },
    securityNote: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: COLORS.lightBackground,
        borderRadius: 12,
        marginBottom: 8,
    },
    securityIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: COLORS.brandGreen + '20',
        justifyContent: 'center',
        alignItems: 'center',
    },
    securityText: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyDark,
        fontFamily: TYPOGRAPHY.fontFamily,
        textAlign: 'center',
    },
});

export default QRCodeModal; 