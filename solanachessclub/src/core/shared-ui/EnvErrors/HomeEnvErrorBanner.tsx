import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDevMode } from '@/shared/context/DevModeContext';
import { useEnvError } from '@/shared/context/EnvErrorContext';

const BANNER_DISMISS_KEY = 'env_error_banner_dismissed';

/**
 * A prominent banner component for the home/feed screen that displays missing 
 * environment variables and their impact on functionality.
 */
const HomeEnvErrorBanner = () => {
    const { hasMissingEnvVars, missingEnvVars, toggleErrorModal } = useEnvError();
    const { isDevMode } = useDevMode();
    const [isDismissed, setIsDismissed] = useState(false);

    // Check if the banner was previously dismissed
    useEffect(() => {
        const checkDismissState = async () => {
            try {
                const value = await AsyncStorage.getItem(BANNER_DISMISS_KEY);
                if (value !== null) {
                    setIsDismissed(true);
                }
            } catch (error) {
                console.error('Error checking banner dismiss state:', error);
            }
        };

        checkDismissState();
    }, []);

    const handleDismiss = async () => {
        try {
            await AsyncStorage.setItem(BANNER_DISMISS_KEY, 'true');
            setIsDismissed(true);
        } catch (error) {
            console.error('Error saving banner dismiss state:', error);
        }
    };

    if (!isDevMode || !hasMissingEnvVars || isDismissed) {
        return null;
    }

    // Group missing variables by feature domain to make it more understandable
    const groupedVars = {
        'Wallet Connection': ['PRIVY_APP_ID', 'PRIVY_CLIENT_ID', 'TURNKEY_ORGANIZATION_ID', 'DYNAMIC_ENVIRONMENT_ID'],
        'Blockchain': ['CLUSTER', 'HELIUS_API_KEY', 'HELIUS_RPC_CLUSTER', 'HELIUS_STAKED_URL', 'HELIUS_STAKED_API_KEY'],
        'Market Data': ['PARA_API_KEY', 'TENSOR_API_KEY', 'COINGECKO_API_KEY', 'BIRDEYE_API_KEY'],
        'Other': ['SERVER_URL', 'TURNKEY_BASE_URL', 'TURNKEY_RP_ID', 'TURNKEY_RP_NAME']
    };

    // Find which features are affected
    const affectedFeatures: Record<string, string[]> = {};

    for (const [feature, vars] of Object.entries(groupedVars)) {
        const missing = vars.filter(v => missingEnvVars.includes(v));
        if (missing.length > 0) {
            affectedFeatures[feature] = missing;
        }
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>⚠️ Missing Environment Variables</Text>
            </View>

            <View style={styles.content}>
                <Text style={styles.description}>
                    Your app is missing some environment variables which may affect functionality.
                    The following features may not work correctly:
                </Text>

                <ScrollView
                    style={styles.featuresList}
                    contentContainerStyle={styles.featuresContent}
                    showsVerticalScrollIndicator={false}
                >
                    {Object.entries(affectedFeatures).map(([feature, vars]) => (
                        <View key={feature} style={styles.featureItem}>
                            <Text style={styles.featureName}>{feature}</Text>
                            <Text style={styles.featureVars}>
                                Missing: {vars.join(', ')}
                            </Text>
                        </View>
                    ))}
                </ScrollView>

                <Text style={styles.helperText}>
                    To fix this, add these variables to your .env.local file. In development mode,
                    the app will continue to work with some limitations.
                </Text>
            </View>

            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.detailsButton}
                    onPress={toggleErrorModal}
                >
                    <Text style={styles.detailsButtonText}>Show All Missing Variables</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.dismissButton}
                    onPress={handleDismiss}
                >
                    <Text style={styles.dismissButtonText}>Dismiss</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        margin: 16,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    header: {
        backgroundColor: '#ff4c4c',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    content: {
        padding: 16,
    },
    description: {
        fontSize: 16,
        color: '#333',
        marginBottom: 12,
        lineHeight: 22,
    },
    featuresList: {
        maxHeight: 150,
        marginVertical: 8,
    },
    featuresContent: {
        paddingBottom: 8,
    },
    featureItem: {
        backgroundColor: 'rgba(255, 76, 76, 0.1)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#ff4c4c',
    },
    featureName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ff4c4c',
        marginBottom: 4,
    },
    featureVars: {
        fontSize: 14,
        color: '#666',
    },
    helperText: {
        fontSize: 14,
        color: '#555',
        marginTop: 8,
        fontStyle: 'italic',
        lineHeight: 20,
    },
    actions: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    detailsButton: {
        flex: 3,
        backgroundColor: '#ff4c4c',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginRight: 8,
        alignItems: 'center',
    },
    detailsButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    },
    dismissButton: {
        flex: 2,
        backgroundColor: '#f0f0f0',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    dismissButtonText: {
        color: '#555',
        fontWeight: '600',
        fontSize: 15,
    },
});

export default HomeEnvErrorBanner; 