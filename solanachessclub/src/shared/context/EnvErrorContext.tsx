import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { Alert, Modal, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import {
    PRIVY_APP_ID,
    PRIVY_CLIENT_ID,
    CLUSTER,
    TURNKEY_BASE_URL,
    TURNKEY_RP_ID,
    TURNKEY_RP_NAME,
    TURNKEY_ORGANIZATION_ID,
    DYNAMIC_ENVIRONMENT_ID,
    HELIUS_API_KEY,
    HELIUS_RPC_CLUSTER,
    SERVER_URL,
    TENSOR_API_KEY,
    COINGECKO_API_KEY,
    BIRDEYE_API_KEY,
    HELIUS_STAKED_URL,
    HELIUS_STAKED_API_KEY
} from '@env';
import { useDevMode } from './DevModeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BANNER_DISMISS_KEY = 'env_error_banner_dismissed';

interface EnvErrorContextType {
    hasMissingEnvVars: boolean;
    missingEnvVars: string[];
    showErrorModal: boolean;
    toggleErrorModal: () => void;
    resetBannerDismissState: () => Promise<void>;
}

const EnvErrorContext = createContext<EnvErrorContextType | undefined>(undefined);

interface EnvErrorProviderProps {
    children: ReactNode;
}

export function EnvErrorProvider({ children }: EnvErrorProviderProps) {
    const [missingEnvVars, setMissingEnvVars] = useState<string[]>([]);
    const [showErrorModal, setShowErrorModal] = useState<boolean>(false);
    const { isDevMode } = useDevMode();

    useEffect(() => {
        // Always check for missing env vars, regardless of dev mode
        checkMissingEnvVars();
        
        console.log('[EnvErrorContext] Provider initialized:', {
            isDevMode,
            checkingEnvVars: true
        });
    }, [isDevMode]);

    const checkMissingEnvVars = () => {
        // Manually check only environment variables used in the frontend
        const envVars: Record<string, string | undefined> = {
            PRIVY_APP_ID,
            PRIVY_CLIENT_ID,
            CLUSTER,
            TURNKEY_BASE_URL,
            TURNKEY_RP_ID,
            TURNKEY_RP_NAME,
            TURNKEY_ORGANIZATION_ID,
            DYNAMIC_ENVIRONMENT_ID,
            HELIUS_API_KEY,
            HELIUS_RPC_CLUSTER,
            SERVER_URL,
            TENSOR_API_KEY,
            COINGECKO_API_KEY,
            BIRDEYE_API_KEY,
            HELIUS_STAKED_URL,
            HELIUS_STAKED_API_KEY
        };

        // Find missing variables
        const missing: string[] = [];
        for (const key in envVars) {
            const value = envVars[key];
            if (!value || value.trim() === '') {
                missing.push(key);
            }
        }

        setMissingEnvVars(missing);
        
        console.log('[EnvErrorContext] Environment check result:', {
            missingVarsCount: missing.length,
            missingVarsList: missing.slice(0, 3),
            hasMore: missing.length > 3
        });

        // Show the modal on initial load if there are missing variables and in dev mode
        if (missing.length > 0 && isDevMode) {
            setShowErrorModal(true);
        }
    };

    const toggleErrorModal = () => {
        setShowErrorModal(!showErrorModal);
    };

    // Method to reset the banner dismiss state
    const resetBannerDismissState = async () => {
        try {
            await AsyncStorage.removeItem(BANNER_DISMISS_KEY);
            console.log('Banner dismiss state has been reset');
        } catch (error) {
            console.error('Error resetting banner dismiss state:', error);
        }
    };

    return (
        <EnvErrorContext.Provider
            value={{
                hasMissingEnvVars: missingEnvVars.length > 0,
                missingEnvVars,
                showErrorModal,
                toggleErrorModal,
                resetBannerDismissState,
            }}
        >
            {children}

            {/* Global Error Modal */}
            {isDevMode && missingEnvVars.length > 0 && showErrorModal && (
                <Modal
                    animationType="fade"
                    transparent={true}
                    visible={showErrorModal}
                    onRequestClose={toggleErrorModal}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContainer}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Environment Variables Missing</Text>
                            </View>

                            <View style={styles.modalContent}>
                                <Text style={styles.modalMessage}>
                                    Some environment variables are missing. This may affect app functionality:
                                </Text>

                                <View style={styles.envVarList}>
                                    {missingEnvVars.slice(0, 5).map((varName) => (
                                        <View key={varName} style={styles.envVarItem}>
                                            <Text style={styles.envVarName}>{varName}</Text>
                                        </View>
                                    ))}

                                    {missingEnvVars.length > 5 && (
                                        <Text style={styles.moreVarsText}>
                                            + {missingEnvVars.length - 5} more...
                                        </Text>
                                    )}
                                </View>

                                <Text style={styles.helperText}>
                                    To fix this, add these variables to your .env.local file. The app may not function correctly without them.
                                </Text>
                            </View>

                            <TouchableOpacity style={styles.dismissButton} onPress={toggleErrorModal}>
                                <Text style={styles.dismissButtonText}>Dismiss</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}
        </EnvErrorContext.Provider>
    );
}

// Hook to use the EnvError context
export function useEnvError() {
    const context = useContext(EnvErrorContext);
    if (context === undefined) {
        throw new Error('useEnvError must be used within an EnvErrorProvider');
    }
    return context;
}

// Component that can be used to manually show the error modal
export function EnvErrorButton() {
    const { hasMissingEnvVars, toggleErrorModal, resetBannerDismissState } = useEnvError();
    const { isDevMode } = useDevMode();

    if (!isDevMode || !hasMissingEnvVars) return null;

    const handlePress = async () => {
        // Reset the banner dismiss state so it becomes visible again
        await resetBannerDismissState();
        // Show the modal with details
        toggleErrorModal();
    };

    return (
        <TouchableOpacity style={styles.errorButton} onPress={handlePress}>
            <Text style={styles.errorButtonText}>⚠️ Env</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '85%',
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    modalHeader: {
        backgroundColor: '#ff4c4c',
        padding: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
    },
    modalContent: {
        padding: 20,
    },
    modalMessage: {
        fontSize: 15,
        color: '#333',
        marginBottom: 12,
        lineHeight: 22,
    },
    envVarList: {
        marginVertical: 12,
    },
    envVarItem: {
        backgroundColor: 'rgba(255, 76, 76, 0.1)',
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#ff4c4c',
    },
    envVarName: {
        fontWeight: '600',
        color: '#ff4c4c',
    },
    moreVarsText: {
        fontSize: 13,
        color: '#666',
        fontStyle: 'italic',
        marginVertical: 8,
    },
    helperText: {
        fontSize: 14,
        color: '#555',
        marginTop: 8,
        lineHeight: 20,
    },
    dismissButton: {
        backgroundColor: '#ff4c4c',
        padding: 15,
        alignItems: 'center',
    },
    dismissButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
    errorButton: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        backgroundColor: '#ff4c4c',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
    },
    errorButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
}); 