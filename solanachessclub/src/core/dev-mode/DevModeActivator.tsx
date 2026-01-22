import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Alert, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * DevModeActivator - A hidden component that can be used to manually activate dev mode
 * 
 * This component is always present in the app (even in production) and allows activating 
 * dev mode with a special gesture (long pressing a specific area 5 times in succession)
 */
export const DevModeActivator = () => {
    const [pressCount, setPressCount] = useState(0);
    const [showModal, setShowModal] = useState(false);

    // Secret gesture handler - 5 long presses activates dev mode dialog
    const handleSecretPress = () => {
        const newCount = pressCount + 1;
        setPressCount(newCount);

        if (newCount >= 5) {
            // Reset counter and show the modal
            setPressCount(0);
            setShowModal(true);
        }

        // Reset the counter after 3 seconds of inactivity
        setTimeout(() => {
            setPressCount(0);
        }, 3000);
    };

    // Function to enable dev mode manually
    const enableDevMode = async () => {
        try {
            // Store in AsyncStorage
            await AsyncStorage.setItem('devMode', 'true');
            // Set global flag
            global.__DEV_MODE__ = true;

            Alert.alert(
                "Dev Mode Activated",
                "Dev mode has been activated. Please restart the app for changes to take effect.",
                [{ text: "OK", onPress: () => setShowModal(false) }]
            );
        } catch (error) {
            console.error('Error enabling dev mode:', error);
            Alert.alert("Error", "Failed to enable dev mode");
        }
    };

    // Function to disable dev mode manually
    const disableDevMode = async () => {
        try {
            // Remove from AsyncStorage
            await AsyncStorage.removeItem('devMode');
            // Clear global flag
            global.__DEV_MODE__ = false;

            Alert.alert(
                "Dev Mode Deactivated",
                "Dev mode has been turned off. Please restart the app for changes to take effect.",
                [{ text: "OK", onPress: () => setShowModal(false) }]
            );
        } catch (error) {
            console.error('Error disabling dev mode:', error);
            Alert.alert("Error", "Failed to disable dev mode");
        }
    };

    return (
        <>
            {/* Hidden activation area in top-right corner */}
            <TouchableOpacity
                style={styles.activator}
                onLongPress={handleSecretPress}
                activeOpacity={1}
            />

            {/* Dev mode configuration modal */}
            <Modal
                visible={showModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Developer Mode</Text>
                        <Text style={styles.modalText}>
                            Do you want to enable or disable developer mode?
                        </Text>

                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={[styles.button, styles.enableButton]}
                                onPress={enableDevMode}
                            >
                                <Text style={styles.buttonText}>Enable</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.button, styles.disableButton]}
                                onPress={disableDevMode}
                            >
                                <Text style={styles.buttonText}>Disable</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setShowModal(false)}
                        >
                            <Text style={styles.closeButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    activator: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 50,
        height: 50,
        zIndex: 9999,
        // Make it completely invisible
        backgroundColor: 'transparent',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '80%',
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 20,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    modalText: {
        fontSize: 16,
        marginBottom: 20,
        textAlign: 'center',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 15,
    },
    button: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 5,
        alignItems: 'center',
        width: '45%',
    },
    enableButton: {
        backgroundColor: '#00E676',
    },
    disableButton: {
        backgroundColor: '#FF3B30',
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    closeButton: {
        marginTop: 10,
    },
    closeButtonText: {
        color: '#007AFF',
    },
});

export default DevModeActivator; 