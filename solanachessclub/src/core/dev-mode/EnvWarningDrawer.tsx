import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEnvError } from '@/shared/context/EnvErrorContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

const EnvWarningDrawer = () => {
    const { hasMissingEnvVars, missingEnvVars } = useEnvError();
    const [isVisible, setIsVisible] = useState(true);

    // Don't render if there are no missing env vars or drawer is dismissed
    if (!hasMissingEnvVars || !isVisible) {
        return null;
    }

    const handleEnableDevMode = async () => {
        // Set dev mode in storage
        await AsyncStorage.setItem('devMode', 'true');
        // Set global flag for immediate effect
        global.__DEV_MODE__ = true;
        
        // Inform the user to restart the app
        alert('Dev Mode enabled. Please restart the app for changes to take effect. After restart, you can use the DEV MODE button at the bottom of the screen.');
        setIsVisible(false);
    };

    const handleDismiss = () => {
        setIsVisible(false);
    };

    return (
        <View style={styles.overlay}>
            <TouchableOpacity
                style={styles.backdrop}
                onPress={handleDismiss}
                activeOpacity={1}
            />
            <SafeAreaView style={styles.drawerContainer} edges={['bottom', 'left', 'right']}>
                <View style={styles.header}>
                    <Text style={styles.title}>Environment Warning</Text>
                    <TouchableOpacity
                        style={styles.closeButtonContainer}
                        onPress={handleDismiss}
                    >
                        <Text style={styles.closeButton}>Close</Text>
                    </TouchableOpacity>
                </View>
                <ScrollView style={styles.content}>
                    <View style={styles.envContainer}>
                        <Text style={styles.envTitle}>Missing Environment Variables</Text>
                        <Text style={styles.envDescription}>
                            Your app is missing required environment variables which may cause certain features to fail.
                            Switch to Dev Mode to access login bypasses and navigation tools.
                        </Text>
                        {missingEnvVars.slice(0, 3).map((varName) => (
                            <View key={varName} style={styles.envVarItem}>
                                <Text style={styles.envVarName}>{varName}</Text>
                            </View>
                        ))}

                        {missingEnvVars.length > 3 && (
                            <Text style={styles.moreVarsText}>
                                + {missingEnvVars.length - 3} more...
                            </Text>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    drawerContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: Dimensions.get('window').height * 0.6, // Smaller than the dev drawer
        shadowColor: COLORS.black,
        shadowOffset: {
            width: 0,
            height: -3,
        },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 14,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderDarkColor,
    },
    title: {
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.weights.bold,
        color: COLORS.errorRed,
    },
    closeButtonContainer: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    closeButton: {
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.white,
    },
    content: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 20,
    },
    envContainer: {
        backgroundColor: COLORS.lightBackground,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    envTitle: {
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.weights.bold,
        marginBottom: 8,
        color: COLORS.errorRed,
    },
    envDescription: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.greyMid,
        marginBottom: 16,
        lineHeight: TYPOGRAPHY.lineHeight.sm,
    },
    envVarItem: {
        backgroundColor: 'rgba(229,77,77,0.1)',
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.errorRed,
    },
    envVarName: {
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.errorRed,
    },
    moreVarsText: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyMid,
        fontStyle: 'italic',
        marginVertical: 8,
    },
    actionButton: {
        backgroundColor: COLORS.brandPrimary,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
    },
    actionButtonText: {
        color: COLORS.background,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        fontSize: TYPOGRAPHY.size.md,
    },
});

export default EnvWarningDrawer; 