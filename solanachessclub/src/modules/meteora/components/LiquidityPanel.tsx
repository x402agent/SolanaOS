import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    ScrollView,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import { fetchUserLiquidityPositions, fetchMeteoraPools, addLiquidity } from '../services/meteoraService';
import { LiquidityPosition, MeteoraPool } from '../types';
import { Connection } from '@solana/web3.js';
import { useWallet } from '@/modules/wallet-providers/hooks/useWallet';

interface LiquidityPanelProps {
    walletAddress: string;
    onTransactionComplete?: (txId: string) => void;
}

export default function LiquidityPanel({
    walletAddress,
    onTransactionComplete,
}: LiquidityPanelProps) {
    const [positions, setPositions] = useState<LiquidityPosition[]>([]);
    const [pools, setPools] = useState<MeteoraPool[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddingLiquidity, setIsAddingLiquidity] = useState(false);
    const [selectedPoolIndex, setSelectedPoolIndex] = useState(-1);
    const [error, setError] = useState('');
    const [statusMessage, setStatusMessage] = useState('');

    // Get wallet and connection
    const wallet = useWallet();
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

    // Fetch user's liquidity positions and available pools
    useEffect(() => {
        async function loadData() {
            try {
                setIsLoading(true);
                setError('');

                // Load data sequentially to handle potential errors better
                let positionsData: LiquidityPosition[] = [];
                try {
                    positionsData = await fetchUserLiquidityPositions(walletAddress);
                } catch (err) {
                    console.error('Error loading positions:', err);
                }

                let poolsData: MeteoraPool[] = [];
                try {
                    poolsData = await fetchMeteoraPools();
                } catch (err) {
                    console.error('Error loading pools:', err);
                }

                // Add some mock pools if none are returned (for development testing)
                if (poolsData.length === 0) {
                    poolsData = [
                        {
                            address: 'pool1',
                            name: 'SOL/USDC',
                            volume24h: '1000000',
                            fee: '0.3',
                            baseToken: 'SOL',
                            quoteToken: 'USDC'
                        },
                        {
                            address: 'pool2',
                            name: 'BTC/USDC',
                            volume24h: '5000000',
                            fee: '0.5',
                            baseToken: 'BTC',
                            quoteToken: 'USDC'
                        }
                    ] as any;
                }

                setPositions(positionsData);
                setPools(poolsData);
            } catch (err) {
                console.error('Error loading liquidity data:', err);
                setError('Unable to connect to server. Please try again later.');
            } finally {
                setIsLoading(false);
            }
        }

        loadData();
    }, [walletAddress]);

    const handleAddLiquidity = async () => {
        if (selectedPoolIndex < 0 || selectedPoolIndex >= pools.length) {
            setError('Please select a pool first');
            return;
        }

        try {
            setIsAddingLiquidity(true);
            setError('');
            setStatusMessage('Preparing to add liquidity...');

            const pool = pools[selectedPoolIndex];

            // Show confirmation dialog with demonstration values
            Alert.alert(
                "Confirm Adding Liquidity",
                `You are about to add 1 SOL and 10.5 USDC to the ${pool.name} pool.`,
                [
                    {
                        text: "Cancel",
                        style: "cancel",
                        onPress: () => {
                            setIsAddingLiquidity(false);
                            setStatusMessage('');
                        }
                    },
                    {
                        text: "Confirm",
                        onPress: async () => {
                            try {
                                // Mock values for demo purposes
                                const tokenAAmount = '1.0'; // 1 SOL
                                const tokenBAmount = '10.5'; // 10.5 USDC
                                const slippage = 0.5; // 0.5%

                                const result = await addLiquidity(
                                    pool.address,
                                    tokenAAmount,
                                    tokenBAmount,
                                    slippage,
                                    connection,
                                    wallet,
                                    setStatusMessage
                                );

                                console.log('Liquidity added:', result);

                                if (onTransactionComplete) {
                                    onTransactionComplete(result.txId);
                                }

                                // Refresh positions after adding liquidity
                                const updatedPositions = await fetchUserLiquidityPositions(walletAddress);
                                setPositions(updatedPositions);
                            } catch (err) {
                                console.error('Error adding liquidity:', err);
                                setError('Failed to add liquidity. Please try again.');
                            } finally {
                                setIsAddingLiquidity(false);
                                setStatusMessage('');
                            }
                        }
                    }
                ]
            );
        } catch (err) {
            console.error('Error preparing to add liquidity:', err);
            setError('Failed to prepare liquidity operation. Please try again.');
            setIsAddingLiquidity(false);
            setStatusMessage('');
        }
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString();
    };

    const renderPositions = () => {
        if (isLoading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.brandPrimary} />
                    <Text style={styles.loadingText}>Loading positions...</Text>
                </View>
            );
        }

        if (positions.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>You don't have any liquidity positions yet.</Text>
                </View>
            );
        }

        return (
            <ScrollView style={styles.positionsList}>
                {positions.map((position) => (
                    <View key={position.id} style={styles.positionCard}>
                        <View style={styles.positionHeader}>
                            <Text style={styles.positionTitle}>
                                {position.tokenA.substring(0, 4)}...{position.tokenA.substring(position.tokenA.length - 4)} /
                                {position.tokenB.substring(0, 4)}...{position.tokenB.substring(position.tokenB.length - 4)}
                            </Text>
                            <Text style={styles.positionDate}>Created: {formatDate(position.createdAt)}</Text>
                        </View>

                        <View style={styles.positionDetails}>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Token A:</Text>
                                <Text style={styles.detailValue}>{position.amountA}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Token B:</Text>
                                <Text style={styles.detailValue}>{position.amountB}</Text>
                            </View>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Liquidity:</Text>
                                <Text style={styles.detailValue}>{position.liquidityAmount}</Text>
                            </View>
                        </View>

                        <View style={styles.positionActions}>
                            <TouchableOpacity style={styles.actionButton}>
                                <Text style={styles.actionButtonText}>Remove</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionButton}>
                                <Text style={styles.actionButtonText}>Add More</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>
        );
    };

    const renderPoolSelection = () => {
        return (
            <View style={styles.poolSelectionContainer}>
                <Text style={styles.sectionTitle}>Add New Liquidity</Text>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.poolsScrollView}
                    contentContainerStyle={styles.poolsScrollViewContent}
                >
                    {pools.map((pool, index) => (
                        <TouchableOpacity
                            key={pool.address}
                            style={[
                                styles.poolCard,
                                selectedPoolIndex === index && styles.poolCardSelected
                            ]}
                            onPress={() => setSelectedPoolIndex(index)}
                        >
                            <Text style={styles.poolName}>{pool.name}</Text>
                            <Text style={styles.poolStats}>
                                Vol: ${parseFloat(pool.volume24h).toLocaleString()}
                            </Text>
                            <Text style={styles.poolFee}>Fee: {pool.fee}%</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity
                    style={styles.addLiquidityButton}
                    onPress={handleAddLiquidity}
                    disabled={isAddingLiquidity || selectedPoolIndex < 0}
                >
                    <LinearGradient
                        colors={['#32D4DE', '#B591FF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.addLiquidityGradient}
                    >
                        {isAddingLiquidity ? (
                            <ActivityIndicator color={COLORS.white} />
                        ) : (
                            <Text style={styles.addLiquidityText}>
                                {selectedPoolIndex >= 0 ? `Add Liquidity to ${pools[selectedPoolIndex].name}` : 'Select a Pool'}
                            </Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>My Liquidity</Text>
            {renderPositions()}
            {renderPoolSelection()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    title: {
        fontSize: TYPOGRAPHY.size.xl,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.white,
        marginBottom: 16,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        color: COLORS.greyMid,
        fontSize: TYPOGRAPHY.size.md,
    },
    emptyContainer: {
        backgroundColor: COLORS.lighterBackground,
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    emptyText: {
        color: COLORS.greyMid,
        fontSize: TYPOGRAPHY.size.md,
        textAlign: 'center',
    },
    positionsList: {
        maxHeight: 300,
        marginBottom: 24,
    },
    positionCard: {
        backgroundColor: COLORS.lighterBackground,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    positionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    positionTitle: {
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.white,
    },
    positionDate: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyMid,
    },
    positionDetails: {
        marginBottom: 16,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    detailLabel: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.greyDark,
    },
    detailValue: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.white,
        fontWeight: TYPOGRAPHY.weights.medium,
    },
    positionActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    actionButton: {
        flex: 1,
        backgroundColor: COLORS.darkerBackground,
        borderRadius: 8,
        paddingVertical: 8,
        alignItems: 'center',
        marginHorizontal: 4,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    actionButtonText: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.white,
        fontWeight: TYPOGRAPHY.weights.medium,
    },
    sectionTitle: {
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.white,
        marginBottom: 16,
    },
    poolSelectionContainer: {
        marginTop: 8,
    },
    poolsScrollView: {
        marginBottom: 16,
    },
    poolsScrollViewContent: {
        paddingRight: 16,
    },
    poolCard: {
        backgroundColor: COLORS.lighterBackground,
        borderRadius: 12,
        padding: 16,
        marginRight: 12,
        minWidth: 140,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    poolCardSelected: {
        borderColor: COLORS.brandPrimary,
        backgroundColor: COLORS.lightBackground,
    },
    poolName: {
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.white,
        marginBottom: 8,
    },
    poolStats: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyMid,
        marginBottom: 4,
    },
    poolFee: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.brandPrimary,
    },
    errorText: {
        color: COLORS.errorRed,
        fontSize: TYPOGRAPHY.size.sm,
        marginBottom: 16,
        textAlign: 'center',
    },
    addLiquidityButton: {
        overflow: 'hidden',
        borderRadius: 12,
    },
    addLiquidityGradient: {
        paddingVertical: 16,
        alignItems: 'center',
        borderRadius: 12,
    },
    addLiquidityText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.weights.bold,
    },
}); 