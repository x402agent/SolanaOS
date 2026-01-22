import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Alert,
    Image,
    Modal,
    FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import { executeTrade, fetchSwapQuote } from '../services/meteoraService';
import { MeteoraTrade } from '../types';
import { useWallet } from '@/modules/wallet-providers/hooks/useWallet';
import { SERVER_URL } from '@env';
import {
    TokenInfo,
    DEFAULT_SOL_TOKEN,
    DEFAULT_USDC_TOKEN,
    ensureCompleteTokenInfo,
    fetchTokenPrice
} from '@/modules/data-module';

// Helper function to format token amounts properly
const formatTokenAmount = (amount: string, decimals: number = 9): string => {
    try {
        // Convert to number for processing
        const numAmount = parseFloat(amount);

        // Handle zero case
        if (numAmount === 0 || isNaN(numAmount)) return '0';

        // For very small amounts (less than 0.001)
        if (numAmount < 0.001) {
            // Use scientific notation for extremely small values
            return numAmount.toExponential(4);
        }

        // For small amounts (less than 0.01)
        if (numAmount < 0.01) {
            return numAmount.toFixed(6);
        }

        // For regular amounts
        return numAmount.toFixed(4);
    } catch (error) {
        console.error('Error formatting amount:', error);
        return '0';
    }
};

interface SwapFormProps {
    defaultInputToken?: string | TokenInfo;
    defaultOutputToken?: string | TokenInfo;
    defaultAmount?: string;
    onSwapComplete?: (txId: string) => void;
}

export default function SwapForm({
    defaultInputToken = DEFAULT_SOL_TOKEN,
    defaultOutputToken = '',
    defaultAmount = '',
    onSwapComplete,
}: SwapFormProps) {
    // Input token state using address string instead of TokenInfo
    const [inputTokenAddress, setInputTokenAddress] = useState<string>(
        typeof defaultInputToken === 'string'
            ? defaultInputToken
            : defaultInputToken.address
    );

    // Output token info derived from selected pool
    const [outputToken, setOutputToken] = useState<TokenInfo | null>(null);

    const [amount, setAmount] = useState(defaultAmount);
    const [slippage, setSlippage] = useState(0.5); // 0.5% default slippage
    const [isLoading, setIsLoading] = useState(false);
    const [estimatedOutput, setEstimatedOutput] = useState('0');
    const [error, setError] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [outputUsdValue, setOutputUsdValue] = useState('$0.00');

    // Pool selection
    const [isCheckingPools, setIsCheckingPools] = useState<boolean>(false);
    const [availablePools, setAvailablePools] = useState<any[]>([]);
    const [showPoolsModal, setShowPoolsModal] = useState<boolean>(false);
    const [selectedPool, setSelectedPool] = useState<any | null>(null);

    // Get wallet
    const wallet = useWallet();

    // Fetch available pools for the input token address
    const fetchAvailablePools = async () => {
        if (!inputTokenAddress || inputTokenAddress.trim() === '') {
            setError('Please enter a valid token address');
            return;
        }

        try {
            setIsCheckingPools(true);
            setError('');
            setStatusMessage('Checking available pools...');

            const response = await fetch(`${SERVER_URL}/api/meteora/available-pools?token=${inputTokenAddress.trim()}`);
            const data = await response.json();

            if (data.success && data.pools && data.pools.length > 0) {
                setAvailablePools(data.pools);
                console.log(`Found ${data.pools.length} available pools for ${inputTokenAddress}`);
                setShowPoolsModal(true);
                setStatusMessage('');
            } else {
                setError(data.error || `No pools available for token: ${inputTokenAddress}`);
                setAvailablePools([]);
                setStatusMessage('');
            }
        } catch (error: any) {
            console.error('Error fetching available pools:', error);
            setError('Failed to fetch available pools: ' + (error.message || ''));
            setAvailablePools([]);
            setStatusMessage('');
        } finally {
            setIsCheckingPools(false);
        }
    };

    // Handle pool selection
    const handlePoolSelect = async (pool: any) => {
        try {
            setSelectedPool(pool);
            setShowPoolsModal(false);
            setStatusMessage(`Pool selected: ${pool.address.slice(0, 6)}...${pool.address.slice(-6)}`);

            // Derive quote token info from pool's quoteVault
            if (pool.quoteVault) {
                // For now, use a simplified approach since we don't have full token info
                // In a real app, you'd fetch the token metadata from the chain
                setOutputToken({
                    address: pool.quoteVault,
                    symbol: "Quote Token",
                    name: "Quote Token",
                    decimals: 9, // Default to 9 decimals
                    logoURI: ''
                });

                // If we have an amount, refresh quote with the selected pool
                if (amount && parseFloat(amount) > 0) {
                    await fetchQuote(inputTokenAddress, pool.quoteVault, amount);
                }
            } else {
                setError("Selected pool doesn't have quote token information");
            }

            // Clear status message after a while
            setTimeout(() => setStatusMessage(''), 3000);
        } catch (error: any) {
            console.error('Error selecting pool:', error);
            setError('Failed to select pool: ' + (error.message || ''));
        }
    };

    // Handle slippage change
    const handleSlippageChange = (value: number) => {
        setSlippage(value);
    };

    // Fetch quote from server
    const fetchQuote = async (fromToken: string, toToken: string, amountValue: string) => {
        if (!amountValue || parseFloat(amountValue) <= 0 || !toToken) {
            setEstimatedOutput('0');
            return;
        }

        try {
            setError(''); // Clear any previous errors
            setIsLoading(true);

            // Build the URL with the pool address if available
            let url = `${SERVER_URL}/api/meteora/quote?inputToken=${fromToken}&outputToken=${toToken}&amount=${amountValue}&slippage=${slippage}`;

            if (selectedPool) {
                url += `&poolAddress=${selectedPool.address}`;
            }

            // Use the updated URL directly to consider the selected pool
            const response = await fetch(url);
            const quote = await response.json();

            if (quote.success) {
                setEstimatedOutput(quote.estimatedOutput);

                // Update USD value if we have output token
                try {
                    // Convert to number first
                    const outputNum = parseFloat(quote.estimatedOutput);

                    // In a real app, fetch actual price here - for now using simplified approach
                    const tokenPrice = 1700; // Example price (e.g., $1700 for SOL)

                    // Calculate USD value - handle small amounts properly
                    let estimatedUsd = outputNum * tokenPrice;

                    // Use appropriate formatting for different value ranges
                    let formattedUsd;
                    if (estimatedUsd < 0.01 && estimatedUsd > 0) {
                        formattedUsd = '< $0.01'; // Show "less than 1 cent" for tiny values
                    } else {
                        formattedUsd = `$${estimatedUsd.toFixed(2)}`;
                    }

                    setOutputUsdValue(formattedUsd);
                } catch (err) {
                    console.error('Error calculating USD value:', err);
                    setOutputUsdValue('$0.00');
                }
            } else if (quote.shouldFallbackToPriceEstimate) {
                // Server has indicated we should use a price-based estimation
                console.log('Using price-based estimation as suggested by server');
                setEstimatedOutput('0.00 (estimation unavailable)');
                setError(`No liquidity pool available for this token pair. Showing price estimate only.`);
            } else {
                setEstimatedOutput('0');
                setError(quote.error || 'Failed to get quote');
            }
        } catch (error: any) {
            console.error('Error fetching quote:', error);
            setEstimatedOutput('0');
            setError(`Error fetching quote: ${error.message || 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle amount input change with quote fetch
    const handleAmountChange = async (value: string) => {
        setAmount(value);
        setEstimatedOutput('0');

        if (selectedPool && value && parseFloat(value) > 0 && outputToken) {
            await fetchQuote(inputTokenAddress, outputToken.address, value);
        }
    };

    // Update quote when input token or selected pool changes
    useEffect(() => {
        if (selectedPool && amount && parseFloat(amount) > 0 && outputToken) {
            fetchQuote(inputTokenAddress, outputToken.address, amount);
        } else {
            setEstimatedOutput('0');
            setOutputUsdValue('$0.00');
        }
    }, [inputTokenAddress, selectedPool, amount]);

    // Reset pool selection when input token changes
    useEffect(() => {
        setSelectedPool(null);
        setOutputToken(null);
        setEstimatedOutput('0');
        setOutputUsdValue('$0.00');
    }, [inputTokenAddress]);

    // Handle swap action
    const handleSwap = async () => {
        if (!wallet) {
            setError('Wallet not available. Please connect.');
            return;
        }
        if (!wallet.publicKey) {
            setError('Wallet public key not found. Please reconnect.');
            return;
        }

        if (!inputTokenAddress || inputTokenAddress.trim() === '') {
            setError('Please enter a valid token address');
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            setError('Please enter a valid amount');
            return;
        }

        if (!selectedPool) {
            setError('Please select a pool first');
            return;
        }

        if (!outputToken) {
            setError('Output token information not available');
            return;
        }

        try {
            setError('');
            setIsLoading(true);
            setStatusMessage('Fetching quote...');

            // Build the URL with the selected pool
            let url = `${SERVER_URL}/api/meteora/quote?inputToken=${inputTokenAddress}&outputToken=${outputToken.address}&amount=${amount}&slippage=${slippage}&poolAddress=${selectedPool.address}`;

            // Call the API directly with our custom URL
            const response = await fetch(url);
            const quote = await response.json();

            if (!quote.success) {
                throw new Error(quote.error || 'Failed to get quote');
            }

            // Show confirmation dialog with accurate quote
            Alert.alert(
                "Confirm Swap",
                `You are about to swap ${amount} tokens for approximately ${quote.estimatedOutput} ${outputToken.symbol || 'tokens'} with ${slippage}% slippage.`,
                [
                    {
                        text: "Cancel",
                        style: "cancel",
                        onPress: () => {
                            setIsLoading(false);
                            setStatusMessage('');
                        }
                    },
                    {
                        text: "Confirm",
                        onPress: async () => {
                            try {
                                setStatusMessage('Preparing swap...');

                                const tradeParams: MeteoraTrade = {
                                    inputToken: inputTokenAddress,
                                    outputToken: outputToken.address,
                                    amount,
                                    slippage,
                                    minimumAmountOut: quote.minimumAmountOut
                                };

                                // Execute the swap with the selected pool
                                const result = await executeTrade(
                                    tradeParams,
                                    selectedPool.address,
                                    wallet,
                                    setStatusMessage
                                );

                                console.log('Swap completed:', result);
                                if (onSwapComplete) {
                                    onSwapComplete(result.txId);
                                }

                                // Clear input amount after successful swap
                                setAmount('');
                                setEstimatedOutput('0');
                            } catch (err) {
                                console.error('Swap error:', err);
                                setError('Failed to execute swap. Please try again.');
                            } finally {
                                setIsLoading(false);
                                setStatusMessage('');
                            }
                        }
                    }
                ]
            );
        } catch (err: any) {
            console.error('Swap preparation error:', err);
            setError('Failed to prepare swap: ' + (err.message || ''));
            setIsLoading(false);
            setStatusMessage('');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.title}>Swap Tokens</Text>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Input Token Address</Text>
                    <TextInput
                        style={styles.addressInput}
                        value={inputTokenAddress}
                        onChangeText={setInputTokenAddress}
                        placeholder="Enter token address..."
                        placeholderTextColor={COLORS.greyDark}
                        keyboardAppearance="dark"
                    />

                    {/* Check Available Pools Button */}
                    <TouchableOpacity
                        style={[
                            styles.checkPoolsButton,
                            isCheckingPools && { opacity: 0.7 }
                        ]}
                        onPress={fetchAvailablePools}
                        disabled={isCheckingPools || !inputTokenAddress}
                    >
                        {isCheckingPools ? (
                            <ActivityIndicator size="small" color={COLORS.white} />
                        ) : (
                            <Text style={styles.checkPoolsText}>Check Available Pools</Text>
                        )}
                    </TouchableOpacity>

                    {/* Selected Pool Indicator */}
                    {selectedPool && (
                        <View style={styles.selectedPoolContainer}>
                            <Text style={styles.selectedPoolLabel}>Selected Pool:</Text>
                            <Text style={styles.selectedPoolAddress}>
                                {selectedPool.address.slice(0, 8)}...{selectedPool.address.slice(-8)}
                            </Text>
                            {outputToken && (
                                <Text style={styles.outputTokenLabel}>
                                    Output Token: {outputToken.address.slice(0, 8)}...{outputToken.address.slice(-8)}
                                </Text>
                            )}
                        </View>
                    )}
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Amount</Text>
                    <View style={styles.tokenInputContainer}>
                        <TextInput
                            style={styles.input}
                            value={amount}
                            onChangeText={handleAmountChange}
                            placeholder="0.0"
                            placeholderTextColor={COLORS.greyDark}
                            keyboardType="numeric"
                            editable={!!selectedPool} // Only editable if pool is selected
                            keyboardAppearance="dark"
                        />
                    </View>
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>You'll Receive (Estimated)</Text>
                    <View style={styles.estimatedContainer}>
                        <Text style={styles.estimatedOutput}>
                            {isLoading ? 'Loading...' : formatTokenAmount(estimatedOutput, outputToken?.decimals || 9)}
                        </Text>
                        {outputToken && (
                            <Text style={styles.fiatValue}>{outputUsdValue}</Text>
                        )}
                    </View>
                </View>

                <View style={styles.slippageContainer}>
                    <Text style={styles.slippageLabel}>Slippage Tolerance</Text>
                    <View style={styles.slippageButtonContainer}>
                        {[0.1, 0.5, 1, 2].map((value) => (
                            <TouchableOpacity
                                key={value}
                                style={[
                                    styles.slippageButton,
                                    slippage === value && styles.slippageButtonActive
                                ]}
                                onPress={() => handleSlippageChange(value)}
                            >
                                <Text
                                    style={[
                                        styles.slippageButtonText,
                                        slippage === value && styles.slippageButtonTextActive
                                    ]}
                                >
                                    {value}%
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {error ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                ) : null}

                {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

                <TouchableOpacity
                    style={styles.swapButtonContainer}
                    onPress={handleSwap}
                    disabled={isLoading || !selectedPool || !amount || parseFloat(amount) <= 0}
                >
                    <LinearGradient
                        colors={['#32D4DE', '#B591FF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.swapButtonGradient}
                    >
                        {isLoading ? (
                            <ActivityIndicator color={COLORS.white} />
                        ) : (
                            <Text style={styles.swapButtonText}>
                                {!wallet?.publicKey ? 'Connect Wallet' : !selectedPool ? 'Select Pool First' : 'Swap'}
                            </Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* Available Pools Modal */}
            <Modal
                visible={showPoolsModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowPoolsModal(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Available Pools for Token</Text>

                        {availablePools.length > 0 ? (
                            <FlatList
                                data={availablePools}
                                keyExtractor={(item) => item.address}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.poolItem}
                                        onPress={() => handlePoolSelect(item)}
                                    >
                                        <Text style={styles.poolItemAddress}>
                                            Pool: {item.address.slice(0, 8)}...{item.address.slice(-8)}
                                        </Text>
                                        <Text style={styles.poolItemDetail}>
                                            Base Token: {item.baseMint.slice(0, 8)}...{item.baseMint.slice(-8)}
                                        </Text>
                                        <View style={styles.poolItemLiquidity}>
                                            <Text style={styles.poolItemDetailLabel}>Quote Token:</Text>
                                            <Text style={styles.poolItemDetailValue}>
                                                {item.quoteVault ? item.quoteVault.slice(0, 8) + '...' + item.quoteVault.slice(-8) : 'N/A'}
                                            </Text>
                                        </View>
                                        <View style={styles.poolItemLiquidity}>
                                            <Text style={styles.poolItemDetailLabel}>Liquidity:</Text>
                                            <Text style={styles.poolItemDetailValue}>{item.liquidity || 'N/A'}</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                                style={styles.poolList}
                            />
                        ) : (
                            <View style={styles.noPoolsContainer}>
                                <Text style={styles.noPoolsText}>No pools available for this token</Text>
                                <Text style={styles.noPoolsSubtext}>Try another token or check back later</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setShowPoolsModal(false)}
                        >
                            <Text style={styles.modalCloseButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    card: {
        backgroundColor: COLORS.lighterBackground,
        borderRadius: 16,
        padding: 20,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    title: {
        fontSize: TYPOGRAPHY.size.xl,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.white,
        marginBottom: 24,
        textAlign: 'center',
    },
    inputContainer: {
        marginBottom: 16,
    },
    label: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.greyMid,
        marginBottom: 8,
    },
    addressInput: {
        backgroundColor: COLORS.darkerBackground,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.sm,
        height: 50,
    },
    tokenInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.darkerBackground,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 4,
        height: 56,
    },
    input: {
        flex: 1,
        height: 50,
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.weights.medium,
    },
    estimatedContainer: {
        backgroundColor: COLORS.darkerBackground,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 56,
    },
    estimatedOutput: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.weights.medium,
    },
    fiatValue: {
        color: COLORS.greyMid,
        fontSize: TYPOGRAPHY.size.xs,
        marginTop: 2,
    },
    slippageContainer: {
        marginTop: 24,
        marginBottom: 16,
    },
    slippageLabel: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.greyMid,
        marginBottom: 8,
    },
    slippageButtonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    slippageButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: COLORS.darkerBackground,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    slippageButtonActive: {
        backgroundColor: COLORS.brandPrimary,
        borderColor: COLORS.brandPrimary,
    },
    slippageButtonText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.weights.medium,
    },
    slippageButtonTextActive: {
        color: COLORS.black,
        fontWeight: TYPOGRAPHY.weights.semiBold,
    },
    errorContainer: {
        marginVertical: 8,
        padding: 10,
        backgroundColor: 'rgba(255, 59, 48, 0.1)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 59, 48, 0.3)',
    },
    errorText: {
        color: COLORS.errorRed,
        fontSize: TYPOGRAPHY.size.sm,
        textAlign: 'center',
    },
    statusText: {
        color: COLORS.greyMid,
        fontSize: TYPOGRAPHY.size.sm,
        marginVertical: 8,
        textAlign: 'center',
    },
    swapButtonContainer: {
        marginTop: 24,
        overflow: 'hidden',
        borderRadius: 12,
    },
    swapButtonGradient: {
        paddingVertical: 16,
        alignItems: 'center',
        borderRadius: 12,
    },
    swapButtonText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.weights.bold,
    },

    // Pool checking functionality styles
    checkPoolsButton: {
        backgroundColor: COLORS.brandPrimary,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    checkPoolsText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.weights.semiBold,
    },
    selectedPoolContainer: {
        marginTop: 8,
        backgroundColor: 'rgba(50, 212, 222, 0.1)',
        borderRadius: 8,
        padding: 8,
        alignItems: 'center',
    },
    selectedPoolLabel: {
        color: COLORS.greyMid,
        fontSize: TYPOGRAPHY.size.xs,
    },
    selectedPoolAddress: {
        color: COLORS.brandPrimary,
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.weights.medium,
        marginTop: 2,
    },
    outputTokenLabel: {
        color: COLORS.greyMid,
        fontSize: TYPOGRAPHY.size.xs,
        marginTop: 4,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    modalContent: {
        width: '90%',
        maxHeight: '80%',
        backgroundColor: COLORS.lighterBackground,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    modalTitle: {
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.weights.bold,
        color: COLORS.white,
        textAlign: 'center',
        marginBottom: 16,
    },
    poolList: {
        maxHeight: 400,
    },
    poolItem: {
        backgroundColor: COLORS.darkerBackground,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    poolItemAddress: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        marginBottom: 4,
    },
    poolItemDetail: {
        color: COLORS.greyMid,
        fontSize: TYPOGRAPHY.size.xs,
        marginVertical: 2,
    },
    poolItemLiquidity: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    poolItemDetailLabel: {
        color: COLORS.greyMid,
        fontSize: TYPOGRAPHY.size.xs,
        marginRight: 4,
    },
    poolItemDetailValue: {
        color: COLORS.brandPrimary,
        fontSize: TYPOGRAPHY.size.xs,
        fontWeight: TYPOGRAPHY.weights.medium,
    },
    noPoolsContainer: {
        padding: 30,
        alignItems: 'center',
    },
    noPoolsText: {
        color: COLORS.greyMid,
        fontSize: TYPOGRAPHY.size.md,
        textAlign: 'center',
    },
    noPoolsSubtext: {
        color: COLORS.greyDark,
        fontSize: TYPOGRAPHY.size.sm,
        textAlign: 'center',
        marginTop: 8,
    },
    modalCloseButton: {
        backgroundColor: COLORS.darkerBackground,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
        marginTop: 16,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    modalCloseButtonText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.weights.semiBold,
    },
});