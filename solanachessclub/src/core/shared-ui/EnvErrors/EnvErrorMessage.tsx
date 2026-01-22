import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useEnvCheck } from '@/shared/hooks/useEnvCheck';

interface EnvErrorMessageProps {
    requiredVars: string[];
    featureName: string;
    style?: object;
}

/**
 * A component that shows an error message when required environment variables
 * are missing for a specific feature.
 */
const EnvErrorMessage = ({ requiredVars, featureName, style }: EnvErrorMessageProps) => {
    const { hasMissingVars, showErrorDetails } = useEnvCheck(requiredVars, featureName);

    if (!hasMissingVars) {
        return null;
    }

    return (
        <View style={[styles.container, style]}>
            <View style={styles.warningIcon}>
                <Text style={styles.warningIconText}>⚠️</Text>
            </View>
            <View style={styles.textContainer}>
                <Text style={styles.title}>Missing Configuration</Text>
                <Text style={styles.message}>
                    Some environment variables required for {featureName} are missing.
                    Some features may not work correctly.
                </Text>
            </View>
            <TouchableOpacity
                style={styles.detailsButton}
                onPress={showErrorDetails}
            >
                <Text style={styles.detailsButtonText}>Details</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(255, 76, 76, 0.1)',
        borderRadius: 8,
        padding: 12,
        marginVertical: 10,
        marginHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderLeftWidth: 3,
        borderLeftColor: '#ff4c4c',
    },
    warningIcon: {
        marginRight: 10,
    },
    warningIconText: {
        fontSize: 24,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ff4c4c',
        marginBottom: 2,
    },
    message: {
        fontSize: 14,
        color: '#555',
        lineHeight: 18,
    },
    detailsButton: {
        backgroundColor: '#ff4c4c',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginLeft: 8,
    },
    detailsButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 12,
    },
});

export default EnvErrorMessage; 