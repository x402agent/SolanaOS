import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDevMode } from '@/shared/context/DevModeContext';
import { useEnvError } from '@/shared/context/EnvErrorContext';
import Svg, { LinearGradient, Stop, Rect, Defs } from 'react-native-svg';

const DevModeStatusBar = () => {
    const { isDevMode, toggleDevDrawer } = useDevMode();
    const { hasMissingEnvVars, missingEnvVars, toggleErrorModal } = useEnvError();
    const insets = useSafeAreaInsets();

    // Only render in dev mode
    if (!isDevMode) {
        return null;
    }

    // Determine gradient based on error state
    const startColor = hasMissingEnvVars ? '#FF3B30' : '#34C759'; // Apple red vs Apple green
    const endColor = hasMissingEnvVars ? '#FF685E' : '#4CD964'; // Lighter variants

    return (
        <View
            style={[
                styles.container,
                { marginTop: insets.top + 4 } // Add a small margin to the top
            ]}
        >
            <View style={styles.bar}>
                {/* Background with gradient */}
                <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
                    <Defs>
                        <LinearGradient id="gradient" x1="0" y1="0" x2="1" y2="0">
                            <Stop offset="0" stopColor={startColor} stopOpacity="1" />
                            <Stop offset="1" stopColor={endColor} stopOpacity="1" />
                        </LinearGradient>
                    </Defs>
                    <Rect width="100%" height="100%" rx={16} ry={16} fill="url(#gradient)" />
                </Svg>

                {/* Dev mode section */}
                <TouchableOpacity
                    style={styles.devModeSection}
                    activeOpacity={0.7}
                    onPress={toggleDevDrawer}
                >
                    <View style={styles.devModeContent}>
                        <View style={styles.statusDot} />
                        <Text style={styles.statusText}>DEV MODE</Text>
                    </View>
                </TouchableOpacity>

                {/* Divider */}
                {hasMissingEnvVars && (
                    <View style={styles.divider} />
                )}

                {/* Env error section */}
                {hasMissingEnvVars && (
                    <TouchableOpacity
                        style={styles.envErrorSection}
                        activeOpacity={0.7}
                        onPress={toggleErrorModal}
                    >
                        <Text style={styles.errorText}>⚠️ {missingEnvVars.length}</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        alignSelf: 'center',
        zIndex: 9999,
    },
    bar: {
        flexDirection: 'row',
        borderRadius: 16,
        height: 32,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 5,
    },
    devModeSection: {
        paddingHorizontal: 12,
        justifyContent: 'center',
    },
    devModeContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    divider: {
        width: 1,
        height: '60%',
        alignSelf: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    envErrorSection: {
        paddingHorizontal: 10,
        justifyContent: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FFFFFF',
        marginRight: 8,
    },
    statusText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 13,
        letterSpacing: 0.5,
    },
    errorText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 13,
    }
});

export default DevModeStatusBar; 