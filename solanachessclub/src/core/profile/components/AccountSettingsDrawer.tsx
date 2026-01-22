import React, { useEffect, useRef, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Easing,
    TouchableWithoutFeedback,
    Platform,
} from 'react-native';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import Icons from '@/assets/svgs'; // Assuming you might want icons next to options

interface AccountSettingsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    onLogout: () => void;
    onDeleteAccount: () => void;
}

const DRAWER_ANIMATION_DURATION = 250;

function AccountSettingsDrawer({
    isVisible,
    onClose,
    onLogout,
    onDeleteAccount,
}: AccountSettingsDrawerProps) {
    const slideAnim = useRef(new Animated.Value(0)).current;
    const [renderContent, setRenderContent] = useState(false);

    useEffect(() => {
        if (isVisible) {
            setRenderContent(true);
            Animated.timing(slideAnim, {
                toValue: 1,
                duration: DRAWER_ANIMATION_DURATION,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: DRAWER_ANIMATION_DURATION,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
            }).start(() => {
                setRenderContent(false);
            });
        }
    }, [isVisible, slideAnim]);

    const drawerTranslateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [300, 0], // Start off-screen (adjust 300 based on content height)
    });

    const backdropOpacity = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.6], // Fade from transparent to semi-opaque black
    });

    if (!renderContent) {
        return null;
    }

    return (
        <Modal
            transparent
            visible={isVisible} // Modal visibility is controlled by parent, animation handles the rest
            onRequestClose={onClose} // For Android back button
            animationType="none" // We handle animation manually
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
            </TouchableWithoutFeedback>

            <Animated.View
                style={[
                    styles.drawerContainer,
                    { transform: [{ translateY: drawerTranslateY }] },
                ]}
            >
                {/* Optional: Add a grabber handle if desired */}
                {/* <View style={styles.grabber} /> */}

                <TouchableOpacity style={styles.optionButton} onPress={() => { onLogout(); onClose(); }}>
                    {/* <Icons.LogoutIcon width={22} height={22} color={COLORS.white} style={styles.optionIcon} /> */}
                    <Text style={styles.optionText}>Logout</Text>
                </TouchableOpacity>

                <View style={styles.separator} />

                <TouchableOpacity style={styles.optionButton} onPress={() => { onDeleteAccount(); onClose(); }}>
                    {/* <Icons.DeleteAccountIcon width={22} height={22} color={COLORS.errorRed} style={styles.optionIcon} /> */}
                    <Text style={[styles.optionText, styles.deleteOptionText]}>Delete Account</Text>
                </TouchableOpacity>

                <View style={styles.separator} />

                <TouchableOpacity
                    style={[styles.optionButton, styles.cancelButton]}
                    onPress={onClose}
                >
                    <Text style={styles.optionText}>Cancel</Text>
                </TouchableOpacity>

            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'black',
    },
    drawerContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.lightBackground, // Themed background
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingVertical: 20,
        paddingHorizontal: 16,
        paddingBottom: Platform.OS === 'ios' ? 30 : 20, // Extra padding for home indicator on iOS
        elevation: 5, // Android shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    grabber: {
        width: 40,
        height: 5,
        backgroundColor: COLORS.greyDark,
        borderRadius: 2.5,
        alignSelf: 'center',
        marginBottom: 15,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        // paddingHorizontal: 10, // If using icons
    },
    optionIcon: {
        marginRight: 15,
    },
    optionText: {
        fontSize: TYPOGRAPHY.size.lg, // 18
        color: COLORS.white,
        fontFamily: TYPOGRAPHY.fontFamily,
        // flex: 1, // If using icons and want text to take remaining space
    },
    deleteOptionText: {
        color: COLORS.errorRed,
    },
    separator: {
        height: 1,
        backgroundColor: COLORS.borderDarkColor, // Subtle separator
        marginVertical: 8,
    },
    cancelButton: {
        marginTop: 10, // Add some space before cancel if it's grouped with others
        // backgroundColor: COLORS.darkerBackground, // Optional distinct background for cancel
        // borderRadius: 8, 
        // alignItems: 'center', // If you want cancel to look more like a contained button
    }
});

export default AccountSettingsDrawer; 