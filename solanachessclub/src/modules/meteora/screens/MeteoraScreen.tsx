import React, { useState, useCallback } from 'react';
import {
    SafeAreaView,
    ScrollView,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { useWallet } from '@/modules/wallet-providers/hooks/useWallet';
import { AppHeader } from '@/core/shared-ui';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import { SwapForm, LiquidityPanel, TokenCreationForm } from '../components';

// Tab enum for navigation
enum MeteoraTab {
    // SWAP = 'swap',
    // LIQUIDITY = 'liquidity',
    CREATE_TOKEN = 'create_token'
}

export default function MeteoraScreen() {
    const navigation = useNavigation();
    const wallet = useWallet();
    const [activeTab, setActiveTab] = useState<MeteoraTab>(MeteoraTab.CREATE_TOKEN);
    const [transactionHistory, setTransactionHistory] = useState<Array<{ id: string, type: string, timestamp: number }>>([]);

    // Safely extract wallet address
    const walletAddress = wallet?.publicKey?.toString() || '';

    const handleBack = useCallback(() => {
        navigation.goBack();
    }, [navigation]);

    // Commented out as we're only showing the create token tab
    /*
    const handleTabPress = (tab: MeteoraTab) => {
        setActiveTab(tab);
    };
    */

    const handleTransactionComplete = (txId: string, type?: string) => {
        // Add the transaction to history
        setTransactionHistory(prev => [
            {
                id: txId,
                type: type || 'Token Creation',
                timestamp: Date.now()
            },
            ...prev
        ]);
    };

    const handleTokenCreated = (tokenAddress: string, txId: string) => {
        handleTransactionComplete(txId, 'Token Creation');
        // Commented out as we're not switching tabs anymore
        // setActiveTab(MeteoraTab.SWAP);
    };

    // Simplified to only show token creation
    const renderTabContent = () => {
        return <TokenCreationForm walletAddress={walletAddress} onTokenCreated={handleTokenCreated} />;
    };

    return (
        <SafeAreaView
            style={[
                styles.container,
                Platform.OS === 'android' && styles.androidSafeArea,
            ]}>
            <StatusBar style="light" />

            <AppHeader
                title="Meteora"
                showBackButton={true}
                onBackPress={handleBack}
            />

            {/* Meteora Logo and Tagline */}
         
            {/* Tab Navigation - Commented out as we're only showing token creation
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        activeTab === MeteoraTab.CREATE_TOKEN && styles.activeTabButton
                    ]}
                    onPress={() => handleTabPress(MeteoraTab.CREATE_TOKEN)}
                >
                    <Text
                        style={[
                            styles.tabButtonText,
                            activeTab === MeteoraTab.CREATE_TOKEN && styles.activeTabButtonText
                        ]}
                    >
                        Create
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        activeTab === MeteoraTab.SWAP && styles.activeTabButton
                    ]}
                    onPress={() => handleTabPress(MeteoraTab.SWAP)}
                >
                    <Text
                        style={[
                            styles.tabButtonText,
                            activeTab === MeteoraTab.SWAP && styles.activeTabButtonText
                        ]}
                    >
                        Swap
                    </Text>
                </TouchableOpacity>
            </View>
            */}

            {/* Main Content Area */}
            <ScrollView
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {renderTabContent()}

                {/* Transaction History */}
                {transactionHistory.length > 0 && (
                    <View style={styles.historyContainer}>
                        <Text style={styles.historyTitle}>Recent Transactions</Text>
                        {transactionHistory.map((tx) => (
                            <View key={tx.id} style={styles.historyItem}>
                                <View style={styles.historyItemLeft}>
                                    <Text style={styles.historyItemType}>{tx.type}</Text>
                                    <Text style={styles.historyItemTime}>
                                        {new Date(tx.timestamp).toLocaleTimeString()}
                                    </Text>
                                </View>
                                <Text style={styles.historyItemStatus}>Completed</Text>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    androidSafeArea: {
        paddingTop: 50,
    },
    headerContainer: {
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    tagline: {
        fontSize: TYPOGRAPHY.size.md,
        color: COLORS.greyMid,
        textAlign: 'center',
    },
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: COLORS.lighterBackground,
        borderRadius: 12,
        padding: 4,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeTabButton: {
        backgroundColor: COLORS.brandPrimary,
    },
    tabButtonText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.weights.medium,
    },
    activeTabButtonText: {
        color: COLORS.black,
        fontWeight: TYPOGRAPHY.weights.semiBold,
    },
    contentContainer: {
        paddingBottom: 40,
    },
    historyContainer: {
        marginHorizontal: 16,
        marginTop: 32,
        padding: 16,
        backgroundColor: COLORS.lighterBackground,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    historyTitle: {
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.white,
        marginBottom: 16,
    },
    historyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderDarkColor,
    },
    historyItemLeft: {
        flex: 1,
    },
    historyItemType: {
        fontSize: TYPOGRAPHY.size.md,
        color: COLORS.white,
        fontWeight: TYPOGRAPHY.weights.medium,
    },
    historyItemTime: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyMid,
        marginTop: 4,
    },
    historyItemStatus: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.brandGreen,
    },
}); 