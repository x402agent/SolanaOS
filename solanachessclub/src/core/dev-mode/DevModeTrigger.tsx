import { useDevMode } from '@/shared/context/DevModeContext';
import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, Text, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect, LinearGradient, Stop, Defs } from 'react-native-svg';

const DevModeTrigger = () => {
    const { isDevMode, toggleDevDrawer } = useDevMode();
    const insets = useSafeAreaInsets();
    const screenWidth = Dimensions.get('window').width;

    useEffect(() => {
        console.log('DevModeTrigger - isDevMode:', isDevMode);
    }, [isDevMode]);

    // Only render in dev mode - return null otherwise
    if (!isDevMode) {
        console.log('DevModeTrigger - Not rendering (dev mode is OFF)');
        return null;
    }

    console.log('DevModeTrigger - Rendering dev mode indicator');

    // Position the indicator directly above the home indicator
    const bottomPadding = Platform.OS === 'ios'
        ? insets.bottom // Position it just above the home indicator on iOS
        : 8; // Close to the bottom on Android

    return (
        <TouchableOpacity
            style={[
                styles.container,
                { bottom: bottomPadding }
            ]}
            activeOpacity={0.8}
            onPress={toggleDevDrawer}
        >
            <View style={styles.button}>
                {/* Background Gradient */}
                <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
                    <Defs>
                        <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor="#34C759" stopOpacity="0.9" />
                            <Stop offset="1" stopColor="#30B350" stopOpacity="0.9" />
                        </LinearGradient>
                    </Defs>
                    <Rect width="100%" height="100%" rx={16} ry={16} fill="url(#grad)" />
                </Svg>

                {/* Button Content */}
                <View style={styles.buttonContent}>
                    <View style={styles.indicator} />
                    <Text style={styles.text}>DEV MODE</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        alignSelf: 'center',
        width: 120,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        elevation: 9999,
    },
    button: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 3,
        },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 8,
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    indicator: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FFFFFF',
        marginRight: 6,
    },
    text: {
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: '600',
        letterSpacing: 0.5,
    }
});

export default DevModeTrigger; 