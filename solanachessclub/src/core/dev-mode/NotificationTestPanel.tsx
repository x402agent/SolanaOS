import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import notificationService from '@/shared/services/notificationService';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

const NotificationTestPanel: React.FC = () => {
    const [pushToken, setPushToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [notificationStatus, setNotificationStatus] = useState<any>(null);

    useEffect(() => {
        // Get the current push token
        const token = notificationService.getPushToken();
        setPushToken(token);
        console.log('📱 NotificationTestPanel: Current token:', token);

        // Get notification status
        loadNotificationStatus();
    }, []);

    const loadNotificationStatus = async () => {
        try {
            const status = await notificationService.getNotificationStatus();
            setNotificationStatus(status);
        } catch (error) {
            console.error('Error loading notification status:', error);
        }
    };

    const refreshToken = async () => {
        setIsRefreshing(true);
        try {
            console.log('🔄 Manually refreshing push token...');
            const newToken = await notificationService.registerForPushNotifications();
            setPushToken(newToken);
            await loadNotificationStatus();
            if (newToken) {
                Alert.alert('Success! 🎉', 'Push token generated successfully!');
            } else {
                Alert.alert('Error ❌', 'Failed to generate push token. Check console for details.');
            }
        } catch (error) {
            console.error('Error refreshing token:', error);
            Alert.alert('Error ❌', 'Failed to refresh token');
        } finally {
            setIsRefreshing(false);
        }
    };

    const testLocalNotification = async () => {
        try {
            await notificationService.scheduleLocalNotification(
                'Local Test 📱',
                'This is a local notification test',
                3
            );
            Alert.alert('Local Notification Scheduled! ⏰', 'Check your device in 3 seconds');
        } catch (error) {
            console.error('Error scheduling local notification:', error);
            Alert.alert('Error ❌', 'Failed to schedule local notification');
        }
    };

    const sendTestNotification = async (type: string) => {
        if (!pushToken) {
            Alert.alert('No Token ❌', 'Please generate a push token first by tapping "Refresh Token"');
            return;
        }

        setIsLoading(true);
        try {
            let success = false;

            switch (type) {
                case 'basic':
                    success = await notificationService.sendTestNotification(
                        'Hello from Solana App! 👋',
                        'This is a basic test notification'
                    );
                    break;

                case 'transaction':
                    success = await notificationService.sendTestNotification(
                        'Transaction Complete! ✅',
                        'Your Solana swap has been processed',
                        {
                            action: 'view_transaction',
                            transactionId: 'test-tx-123',
                            screen: 'SwapScreen'
                        }
                    );
                    break;

                case 'wallet':
                    success = await notificationService.sendTestNotification(
                        'Wallet Update 💰',
                        'Check your latest balance',
                        {
                            action: 'open_wallet',
                            screen: 'WalletScreen'
                        }
                    );
                    break;

                case 'profile':
                    success = await notificationService.sendTestNotification(
                        'Profile Notification 👤',
                        'Someone viewed your profile',
                        {
                            action: 'view_profile',
                            screen: 'ProfileScreen'
                        }
                    );
                    break;
            }

            if (success) {
                Alert.alert(
                    'Notification Sent! 🎉',
                    'Check console logs for delivery receipt in 10 seconds.\n\nIf you don\'t receive it, the issue is likely in device settings.',
                    [{ text: 'OK' }]
                );
            } else {
                Alert.alert('Error ❌', 'Failed to send notification. Check console for details.');
            }
        } catch (error) {
            console.error('Error sending test notification:', error);
            Alert.alert('Error ❌', 'Failed to send notification');
        } finally {
            setIsLoading(false);
        }
    };

    const copyTokenToClipboard = () => {
        if (pushToken) {
            Alert.alert(
                'Push Token 📋',
                `Token copied to console!\n\nToken: ${pushToken.substring(0, 50)}...`,
                [{ text: 'OK' }]
            );
            console.log('🎯 Full Push Token:', pushToken);
        }
    };

    const showNotificationStatus = () => {
        if (notificationStatus) {
            const statusText = JSON.stringify(notificationStatus, null, 2);
            Alert.alert(
                'Notification Status 📊',
                `Check console for full details`,
                [{ text: 'OK' }]
            );
            console.log('📊 Full Notification Status:', statusText);
        }
    };

    const openDeviceSettingsGuide = () => {
        Alert.alert(
            'Device Settings Guide 📱',
            'Since notifications are being sent successfully but not received:\n\n' +
            '📱 iOS Settings:\n' +
            '1. Settings → Notifications → [Your App]\n' +
            '2. Turn ON "Allow Notifications"\n' +
            '3. Turn ON "Lock Screen"\n' +
            '4. Turn ON "Notification Center"\n' +
            '5. Turn OFF "Deliver Quietly"\n' +
            '6. Check Focus/Do Not Disturb\n\n' +
            '🤖 Android Settings:\n' +
            '1. Settings → Apps → [Your App] → Notifications\n' +
            '2. Turn ON "Show notifications"\n' +
            '3. Check individual categories\n' +
            '4. Disable battery optimization for app\n\n' +
            'After checking, try another test notification.',
            [{ text: 'OK' }]
        );
    };

    const getPermissionStatusText = () => {
        if (!notificationStatus) return 'Loading...';

        const permissions = notificationStatus.permissions;
        if (!permissions) return 'Unknown';

        if (permissions.granted) return '✅ Granted';
        if (permissions.status === 'denied') return '❌ Denied';
        return `⚠️ ${permissions.status}`;
    };

    const getIssuesText = () => {
        if (!notificationStatus?.issues) return null;

        if (notificationStatus.issues.length === 0) {
            return '✅ No issues detected';
        }

        return notificationStatus.issues.map((issue: string, index: number) =>
            `${index + 1}. ❌ ${issue}`
        ).join('\n');
    };

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>🔔 Notification Test Panel</Text>

            {/* Push Token Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Push Token Status</Text>
                {pushToken ? (
                    <View>
                        <Text style={styles.successText}>✅ Token Generated</Text>
                        <TouchableOpacity style={styles.tokenButton} onPress={copyTokenToClipboard}>
                            <Text style={styles.tokenButtonText}>
                                📋 View Token (Tap to copy)
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View>
                        <Text style={styles.errorText}>❌ No token available</Text>
                        <TouchableOpacity
                            style={[styles.tokenButton, styles.refreshButton]}
                            onPress={refreshToken}
                            disabled={isRefreshing}
                        >
                            <Text style={styles.tokenButtonText}>
                                {isRefreshing ? '🔄 Generating...' : '🔄 Refresh Token'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Permission Status Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>System Status</Text>
                <Text style={styles.statusText}>
                    Permissions: {getPermissionStatusText()}
                </Text>
                <Text style={styles.statusText}>
                    Device: {notificationStatus?.isDevice ? '✅ Physical Device' : '❌ Simulator/Emulator'}
                </Text>
                <Text style={styles.statusText}>
                    Platform: {notificationStatus?.platform || 'Unknown'}
                </Text>
                <Text style={styles.statusText}>
                    Expo Servers: {notificationStatus?.serverReachable ? '✅ Reachable' : '❌ Not Reachable'}
                </Text>
                <Text style={styles.statusText}>
                    Project ID: {notificationStatus?.projectId ? '✅ Found' : '❌ Missing'}
                </Text>
                <TouchableOpacity style={styles.statusButton} onPress={showNotificationStatus}>
                    <Text style={styles.statusButtonText}>📊 View Full Status</Text>
                </TouchableOpacity>
            </View>

            {/* Issues Section */}
            {notificationStatus?.issues && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Detected Issues</Text>
                    <Text style={[styles.instructionText, notificationStatus.issues.length === 0 ? styles.successText : styles.errorText]}>
                        {getIssuesText()}
                    </Text>
                </View>
            )}

            {/* Local Notification Test */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Local Notification Test</Text>
                <Text style={styles.instructionText}>
                    Test if notifications work locally (doesn't require push token)
                </Text>
                <TouchableOpacity
                    style={[styles.testButton, styles.localButton]}
                    onPress={testLocalNotification}
                >
                    <Text style={styles.buttonText}>📱 Test Local Notification</Text>
                </TouchableOpacity>
            </View>

            {/* Push Notification Tests */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Push Notification Tests</Text>
                <Text style={styles.instructionText}>
                    These require a valid push token and internet connection.{'\n'}
                    Check console logs for detailed debugging information.
                </Text>

                <TouchableOpacity
                    style={[styles.testButton, styles.basicButton]}
                    onPress={() => sendTestNotification('basic')}
                    disabled={isLoading || !pushToken}
                >
                    <Text style={styles.buttonText}>📱 Send Basic Notification</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.testButton, styles.transactionButton]}
                    onPress={() => sendTestNotification('transaction')}
                    disabled={isLoading || !pushToken}
                >
                    <Text style={styles.buttonText}>💸 Send Transaction Notification</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.testButton, styles.walletButton]}
                    onPress={() => sendTestNotification('wallet')}
                    disabled={isLoading || !pushToken}
                >
                    <Text style={styles.buttonText}>💰 Send Wallet Notification</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.testButton, styles.profileButton]}
                    onPress={() => sendTestNotification('profile')}
                    disabled={isLoading || !pushToken}
                >
                    <Text style={styles.buttonText}>👤 Send Profile Notification</Text>
                </TouchableOpacity>
            </View>

            {/* Troubleshooting Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Push Notification Troubleshooting</Text>
                <Text style={styles.instructionText}>
                    Since local notifications work but push notifications don't:{'\n\n'}

                    <Text style={styles.boldText}>Most Common Issue: Device Settings</Text>{'\n'}
                    Push notifications may be disabled at the system level.{'\n\n'}

                    <Text style={styles.boldText}>1. Check Device Settings:</Text>{'\n'}
                    • Go to Settings → Notifications → [Your App]{'\n'}
                    • Ensure "Allow Notifications" is ON{'\n'}
                    • Check if "Deliver Quietly" is OFF{'\n'}
                    • Make sure "Lock Screen" and "Notification Center" are ON{'\n\n'}

                    <Text style={styles.boldText}>2. App Configuration:</Text>{'\n'}
                    • Must be built with EAS Build (not Expo Go){'\n'}
                    • Check if project ID matches in app.json{'\n'}
                    • Verify internet connection{'\n\n'}

                    <Text style={styles.boldText}>3. iOS Specific:</Text>{'\n'}
                    • Check if Focus/Do Not Disturb is enabled{'\n'}
                    • Try restarting the app{'\n'}
                    • Check iOS notification settings for the app{'\n\n'}

                    <Text style={styles.boldText}>4. Android Specific:</Text>{'\n'}
                    • Check notification channels in app settings{'\n'}
                    • Ensure battery optimization is disabled for the app{'\n'}
                    • Check if the app has background activity permissions
                </Text>

                <TouchableOpacity style={styles.settingsButton} onPress={openDeviceSettingsGuide}>
                    <Text style={styles.settingsButtonText}>📱 Device Settings Guide</Text>
                </TouchableOpacity>
            </View>

            {/* External Testing */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>External Testing (Expo Dashboard)</Text>
                <Text style={styles.instructionText}>
                    1. Copy your push token from above{'\n'}
                    2. Go to: https://expo.dev/notifications{'\n'}
                    3. Paste your token in "Expo push token"{'\n'}
                    4. Write your message and send!{'\n'}
                    5. Test CTAs by adding data like:{'\n'}
                    {`   {"screen": "SwapScreen", "action": "view_transaction"}`}{'\n\n'}

                    <Text style={styles.boldText}>If Expo dashboard also doesn't work:</Text>{'\n'}
                    • The issue is with device/app configuration{'\n'}
                    • Check the "Detected Issues" section above{'\n'}
                    • Review device notification settings
                </Text>
            </View>

            {isLoading && (
                <View style={styles.loadingOverlay}>
                    <Text style={styles.loadingText}>Sending notification...</Text>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: COLORS.background,
        minHeight: 600,
    },
    title: {
        fontSize: TYPOGRAPHY.size.xl,
        fontWeight: TYPOGRAPHY.weights.bold,
        color: COLORS.white,
        textAlign: 'center',
        marginBottom: 24,
    },
    section: {
        backgroundColor: COLORS.lightBackground,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    sectionTitle: {
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.white,
        marginBottom: 12,
    },
    successText: {
        color: COLORS.brandGreen,
        fontSize: TYPOGRAPHY.size.md,
        marginBottom: 8,
    },
    errorText: {
        color: COLORS.errorRed,
        fontSize: TYPOGRAPHY.size.md,
    },
    statusText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.sm,
        marginBottom: 4,
    },
    tokenButton: {
        backgroundColor: COLORS.brandPrimary,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    tokenButtonText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.weights.medium,
    },
    refreshButton: {
        backgroundColor: COLORS.brandPrimary,
        marginTop: 8,
    },
    statusButton: {
        backgroundColor: COLORS.brandPrimary,
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    statusButtonText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.weights.medium,
    },
    testButton: {
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 12,
    },
    localButton: {
        backgroundColor: '#8B5CF6',
    },
    basicButton: {
        backgroundColor: COLORS.brandPrimary,
    },
    transactionButton: {
        backgroundColor: COLORS.brandGreen,
    },
    walletButton: {
        backgroundColor: '#FF6B35',
    },
    profileButton: {
        backgroundColor: '#9B59B6',
    },
    buttonText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.weights.semiBold,
    },
    instructionText: {
        color: COLORS.accessoryDarkColor,
        fontSize: TYPOGRAPHY.size.sm,
        lineHeight: TYPOGRAPHY.lineHeight.sm,
        marginBottom: 12,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.weights.medium,
    },
    boldText: {
        fontWeight: TYPOGRAPHY.weights.bold,
        color: COLORS.white,
    },
    settingsButton: {
        backgroundColor: COLORS.brandPrimary,
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    settingsButtonText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.weights.medium,
    },
});

export default NotificationTestPanel; 