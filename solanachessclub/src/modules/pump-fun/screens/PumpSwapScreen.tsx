import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Connection } from '@solana/web3.js';
import { useWallet } from '../../wallet-providers/hooks/useWallet';
import { useAuth } from '../../wallet-providers/hooks/useAuth';
import { useAppSelector } from '@/shared/hooks/useReduxHooks';
import {
    SwapSection,
    LiquidityAddSection,
    LiquidityRemoveSection,
    PoolCreationSection
} from '../components/pump-swap';
import { ENDPOINTS } from '@/shared/config/constants';

type TabType = 'swap' | 'add' | 'remove' | 'create';

/**
 * Main screen for the PumpSwap module with tabs for different functions
 * @component
 */
const PumpSwapScreen: React.FC = () => {
    // Get wallet and connection
    const { wallet, address } = useWallet();
    const { solanaWallet } = useAuth();
    const myWallet = useAppSelector(state => state.auth.address);
    const connection = new Connection(ENDPOINTS.helius, 'confirmed');

    const [activeTab, setActiveTab] = useState<TabType>('swap');
    const [loading, setLoading] = useState(false);
    const insets = useSafeAreaInsets();

    // Get the status bar height for Android
    const STATUSBAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0;

    // Make sure we have a valid public key string
    const publicKey = (myWallet || address || solanaWallet?.wallets?.[0]?.publicKey) || '';

    // Get the most appropriate wallet to use for transactions
    const getWalletForTransactions = () => {
        // Prefer the standardized wallet if available
        if (wallet) {
            return wallet;
        }

        // Fall back to solanaWallet if available
        if (solanaWallet) {
            return solanaWallet;
        }

        // If no wallet available, show error
        Alert.alert('Error', 'No wallet is available for transactions');
        return null;
    };

    const walletForTx = getWalletForTransactions();

    // Check if wallet is connected
    if (!publicKey) {
        return (
            <View style={styles.container}>
                <Text style={styles.connectMessage}>
                    Please connect your wallet to use PumpSwap
                </Text>
            </View>
        );
    }

    // Render the tab bar
    const renderTabBar = () => {
        const tabs: { key: TabType; label: string }[] = [
            { key: 'swap', label: 'Swap' },
            { key: 'add', label: 'Add Liquidity' },
            { key: 'remove', label: 'Remove Liquidity' },
            { key: 'create', label: 'Create Pool' },
        ];

        return (
            <View style={styles.tabBar}>
                {tabs.map((tab) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[
                            styles.tab,
                            activeTab === tab.key && styles.activeTab,
                        ]}
                        onPress={() => setActiveTab(tab.key)}
                    >
                        <Text
                            style={[
                                styles.tabLabel,
                                activeTab === tab.key && styles.activeTabLabel,
                            ]}
                        >
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    // Render the active tab content with wallet and connection
    const renderTabContent = () => {
        if (!walletForTx) {
            return (
                <Text style={styles.errorText}>
                    Wallet not available for transactions
                </Text>
            );
        }

        switch (activeTab) {
            case 'swap':
                return (
                    <SwapSection
                        solanaWallet={walletForTx}
                        connection={connection}
                    />
                );
            case 'add':
                return (
                    <LiquidityAddSection
                        solanaWallet={walletForTx}
                        connection={connection}
                    />
                );
            case 'remove':
                return (
                    <LiquidityRemoveSection
                        solanaWallet={walletForTx}
                        connection={connection}
                    />
                );
            case 'create':
                return (
                    <PoolCreationSection
                        solanaWallet={walletForTx}
                        connection={connection}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <>
            {Platform.OS === 'android' && <View style={{ height: STATUSBAR_HEIGHT, backgroundColor: '#F8FAFC' }} />}
            <SafeAreaView style={[styles.container, Platform.OS === 'android' && androidStyles.container]}>
                <KeyboardAvoidingView
                    style={styles.keyboardAvoidingView}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <ScrollView
                        contentContainerStyle={[
                            styles.scrollContent,
                            { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }
                        ]}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.header}>
                            <Text style={styles.title}>PumpSwap</Text>
                            <Text style={styles.subtitle}>
                                Swap, provide liquidity, and create pools
                            </Text>
                            <Text style={styles.walletAddress}>
                                Your Wallet: {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
                            </Text>
                        </View>

                        {loading && (
                            <ActivityIndicator
                                color="#6E56CF"
                                style={styles.loader}
                                size="large"
                            />
                        )}

                        <View style={styles.card}>
                            {renderTabBar()}
                            <View style={styles.tabContent}>
                                {renderTabContent()}
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 16,
    },
    header: {
        marginBottom: 24,
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 8,
    },
    walletAddress: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    tabBar: {
        flexDirection: 'row',
        marginBottom: 20,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    tabLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#64748B',
    },
    activeTabLabel: {
        color: '#6E56CF',
        fontWeight: '600',
    },
    tabContent: {
        paddingTop: 8,
        paddingHorizontal: 4,
    },
    connectMessage: {
        textAlign: 'center',
        fontSize: 16,
        color: '#64748B',
        marginTop: 40,
    },
    errorText: {
        textAlign: 'center',
        fontSize: 16,
        color: '#E53E3E',
        marginVertical: 20,
    },
    loader: {
        marginVertical: 20,
    },
});

// Add Android-specific styles
const androidStyles = StyleSheet.create({
    container: {
        paddingTop: 0, // We're handling this with the extra View
    }
});

export default PumpSwapScreen; 