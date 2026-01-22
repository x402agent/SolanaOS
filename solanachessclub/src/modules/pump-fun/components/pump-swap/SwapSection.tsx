import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    ActivityIndicator,
    TouchableOpacity,
    Alert
} from 'react-native';
import { useWallet } from '../../../wallet-providers/hooks/useWallet';
import { Connection, PublicKey } from '@solana/web3.js';
import {
    getSwapQuoteFromBase,
    getSwapQuoteFromQuote,
    swapTokens,
    Direction,
} from '../../services/pumpSwapService'; // <--- These are your server-calling helpers
import { DEFAULT_SLIPPAGE } from '../../utils/pumpSwapUtils';
import { SERVER_URL } from '@env';
import { TokenInfo } from '@/modules/data-module';

// Token address examples as placeholders
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Token metadata for common tokens
const KNOWN_TOKENS: Record<string, { symbol: string, name: string, decimals: number }> = {
    [SOL_MINT]: { symbol: 'SOL', name: 'Solana', decimals: 9 },
    [USDC_MINT]: { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { symbol: 'mSOL', name: 'Marinade Staked SOL', decimals: 9 },
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'USDT', decimals: 6 },
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', name: 'Bonk', decimals: 5 },
};

interface SwapSectionProps {
    connection: Connection;
    // The wallet object you use in your app (returned from useWallet, or whichever you prefer)
    solanaWallet: any;
}

/**
 * SwapSection allows a user to swap from Base -> Quote or Quote -> Base
 */
export function SwapSection({
    connection,
    solanaWallet,
}: SwapSectionProps) {
    // Pull out info from your custom wallet hook
    const { address, connected } = useWallet();

    // UI states
    const [direction, setDirection] = useState<Direction>(Direction.BaseToQuote);
    const [poolAddress, setPoolAddress] = useState('');
    const [poolInfo, setPoolInfo] = useState<{
        baseMint: string;
        quoteMint: string;
        baseReserve?: string;
        quoteReserve?: string;
        price?: number;
    } | null>(null);
    const [baseToken, setBaseToken] = useState<TokenInfo>({
        address: SOL_MINT,
        symbol: 'BASE',
        name: 'Base Token',
        decimals: 9,
        logoURI: '',
    });
    const [quoteToken, setQuoteToken] = useState<TokenInfo>({
        address: USDC_MINT,
        symbol: 'QUOTE',
        name: 'Quote Token',
        decimals: 6,
        logoURI: '',
    });
    const [baseAmount, setBaseAmount] = useState('');
    const [quoteAmount, setQuoteAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isPoolLoading, setIsPoolLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    // Fetch pool info when address changes
    useEffect(() => {
        if (!poolAddress || !connected) {
            setPoolInfo(null);
            return;
        }

        async function fetchPoolInfo() {
            try {
                setIsPoolLoading(true);
                setError(null);
                setStatusMessage('Fetching pool info...');

                // Validate pool address format
                try {
                    new PublicKey(poolAddress);
                } catch (e) {
                    throw new Error('Invalid pool address format');
                }

                // First attempt - try to use the quote API to get pool data
                const response = await fetch(`${SERVER_URL}/api/pump-swap/quote-swap`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        pool: poolAddress,
                        inputAmount: 0.0001,
                        direction: 0, // Base to quote
                        slippage: DEFAULT_SLIPPAGE,
                    }),
                });

                const data = await response.json();

                // If we got some data from the server
                if (data.success) {
                    // Check if the response contains the token info
                    if (data.data && (data.data.baseMint || data.data.quoteMint)) {
                        // Extract base and quote token info from the pool data
                        const pool = {
                            baseMint: data.data.baseMint || '',
                            quoteMint: data.data.quoteMint || '',
                            baseReserve: data.data.baseReserve,
                            quoteReserve: data.data.quoteReserve,
                            price: data.data.price,
                        };

                        // If we have at least one of the token mints, try to proceed
                        if (pool.baseMint || pool.quoteMint) {
                            // For this specific pool - hardcode values for Pump.fun AMM (WSOL-USDC)
                            if (poolAddress === '53W23c9mtDXgnhqpHJiRmYSKwpRf5mtwHeJM83FDxWFm') {
                                console.log('Using hardcoded values for Pump.fun AMM (WSOL-USDC) pool');
                                pool.baseMint = pool.baseMint || 'So11111111111111111111111111111111111111112'; // WSOL
                                pool.quoteMint = pool.quoteMint || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
                                // Set a reasonable price if not provided
                                pool.price = pool.price || 130;
                            }

                            setPoolInfo(pool);

                            // Set up base token info - use known tokens or derive from address
                            const baseTokenInfo = KNOWN_TOKENS[pool.baseMint] || {
                                symbol: pool.baseMint ? pool.baseMint.slice(0, 4) + '...' : 'WSOL',
                                name: pool.baseMint ? 'Unknown Token' : 'Wrapped SOL',
                                decimals: 9, // Default to 9 decimals for unknown tokens
                            };

                            setBaseToken({
                                address: pool.baseMint || SOL_MINT,
                                symbol: baseTokenInfo.symbol,
                                name: baseTokenInfo.name,
                                decimals: baseTokenInfo.decimals,
                                logoURI: '',
                            });

                            // Set up quote token info
                            const quoteTokenInfo = KNOWN_TOKENS[pool.quoteMint] || {
                                symbol: pool.quoteMint ? pool.quoteMint.slice(0, 4) + '...' : 'USDC',
                                name: pool.quoteMint ? 'Unknown Token' : 'USD Coin',
                                decimals: 6, // Default to 6 decimals for unknown tokens (like USDC)
                            };

                            setQuoteToken({
                                address: pool.quoteMint || USDC_MINT,
                                symbol: quoteTokenInfo.symbol,
                                name: quoteTokenInfo.name,
                                decimals: quoteTokenInfo.decimals,
                                logoURI: '',
                            });

                            // Reset amounts
                            setBaseAmount('');
                            setQuoteAmount('');
                            setStatusMessage(`Pool loaded: ${baseTokenInfo.symbol}/${quoteTokenInfo.symbol}`);
                            return;
                        }
                    }
                }

                // If we're here, we didn't get full data from the quote API
                // Try a second approach - for known pools like Pump.fun pools

                // Handle specific known pools by address
                if (poolAddress === '53W23c9mtDXgnhqpHJiRmYSKwpRf5mtwHeJM83FDxWFm') {
                    // This is the Pump.fun AMM (WSOL-USDC) pool
                    const pool = {
                        baseMint: 'So11111111111111111111111111111111111111112', // WSOL
                        quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
                        price: 130, // Approximate SOL price in USD
                    };

                    setPoolInfo(pool);

                    // Set tokens
                    setBaseToken({
                        address: pool.baseMint,
                        symbol: 'WSOL',
                        name: 'Wrapped SOL',
                        decimals: 9,
                        logoURI: '',
                    });

                    setQuoteToken({
                        address: pool.quoteMint,
                        symbol: 'USDC',
                        name: 'USD Coin',
                        decimals: 6,
                        logoURI: '',
                    });

                    // Reset amounts
                    setBaseAmount('');
                    setQuoteAmount('');
                    setStatusMessage('Pool loaded: WSOL/USDC (Pump.fun AMM)');
                    return;
                }

                // If we get here, we couldn't determine pool info
                throw new Error('Could not determine pool token information. Please verify the pool address is correct.');
            } catch (err) {
                console.error('Error fetching pool info:', err);
                setError(err instanceof Error ? err.message : 'Failed to fetch pool info');
                setPoolInfo(null);
                setStatusMessage(null);
            } finally {
                setIsPoolLoading(false);
            }
        }

        // Use debounce to avoid too many API calls when typing
        const timeoutId = setTimeout(fetchPoolInfo, 800);
        return () => clearTimeout(timeoutId);
    }, [poolAddress, connected]);

    // Fetch quote if user changes the base amount
    const handleBaseAmountChange = useCallback((amount: string) => {
        setBaseAmount(amount);

        // Only try to get quote if there's a valid pool address and amount
        if (!amount || !poolAddress || !poolInfo || !connected) {
            setQuoteAmount('');
            return;
        }

        const fetchQuote = async () => {
            try {
                setIsLoading(true);
                setError(null);
                setStatusMessage('Getting quote...');

                const numeric = parseFloat(amount);
                const result = await getSwapQuoteFromBase(
                    poolAddress,
                    numeric,
                    DEFAULT_SLIPPAGE
                );

                setQuoteAmount(result.toString());
                setStatusMessage(null);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to get quote');
                setQuoteAmount('');
            } finally {
                setIsLoading(false);
            }
        };

        // Use setTimeout to avoid too many API calls when typing fast
        const timeoutId = setTimeout(fetchQuote, 500);
        return () => clearTimeout(timeoutId);
    }, [poolAddress, poolInfo, connected]);

    // Fetch quote if user changes the quote amount
    const handleQuoteAmountChange = useCallback((amount: string) => {
        setQuoteAmount(amount);

        // Only try to get quote if there's a valid pool address and amount
        if (!amount || !poolAddress || !poolInfo || !connected) {
            setBaseAmount('');
            return;
        }

        const fetchQuote = async () => {
            try {
                setIsLoading(true);
                setError(null);
                setStatusMessage('Getting quote...');

                const numeric = parseFloat(amount);
                const result = await getSwapQuoteFromQuote(
                    poolAddress,
                    numeric,
                    DEFAULT_SLIPPAGE
                );

                setBaseAmount(result.toString());
                setStatusMessage(null);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to get quote');
                setBaseAmount('');
            } finally {
                setIsLoading(false);
            }
        };

        // Use setTimeout to avoid too many API calls when typing fast
        const timeoutId = setTimeout(fetchQuote, 500);
        return () => clearTimeout(timeoutId);
    }, [poolAddress, poolInfo, connected]);

    const handlePoolAddressChange = useCallback((address: string) => {
        setPoolAddress(address);
        setBaseAmount('');
        setQuoteAmount('');
        setError(null);
    }, []);

    // Toggle direction (Base->Quote or Quote->Base)
    const toggleDirection = useCallback(() => {
        // Store values before resetting
        const oldBaseAmount = baseAmount;
        const oldQuoteAmount = quoteAmount;

        // Reset amounts to prevent issues
        setBaseAmount('');
        setQuoteAmount('');

        // Flip the direction
        setDirection(prev => {
            const newDirection = prev === Direction.BaseToQuote ? Direction.QuoteToBase : Direction.BaseToQuote;

            // Schedule a state update after direction change
            setTimeout(() => {
                // If switching from Base->Quote to Quote->Base, put base amount in quote field
                if (newDirection === Direction.QuoteToBase && oldBaseAmount) {
                    setQuoteAmount(oldBaseAmount);
                }
                // If switching from Quote->Base to Base->Quote, put quote amount in base field
                else if (newDirection === Direction.BaseToQuote && oldQuoteAmount) {
                    setBaseAmount(oldQuoteAmount);
                }
            }, 0);

            return newDirection;
        });

        // Reset error/status
        setStatusMessage(null);
        setError(null);
    }, [baseAmount, quoteAmount]);

    // Perform the swap transaction
    const handleSwap = useCallback(async () => {
        if (!connected || !solanaWallet) return;

        const userAddress = address || '';
        if (!userAddress) {
            setError('No wallet address found');
            return;
        }

        if (!poolAddress) {
            setError('No pool address specified');
            return;
        }

        // Immediate feedback that something is happening
        Alert.alert(
            "Preparing Swap",
            `Swapping ${direction === Direction.BaseToQuote ?
                `${baseAmount} ${baseToken.symbol} → ${quoteAmount} ${quoteToken.symbol}` :
                `${quoteAmount} ${quoteToken.symbol} → ${baseAmount} ${baseToken.symbol}`}`,
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Proceed",
                    onPress: async () => {
                        try {
                            setIsLoading(true);
                            setError(null);
                            setStatusMessage('Building swap transaction...');

                            // Amount is based on the direction
                            const numericAmount = parseFloat(
                                direction === Direction.BaseToQuote ? baseAmount : quoteAmount
                            );

                            if (isNaN(numericAmount) || numericAmount <= 0) {
                                throw new Error('Invalid amount specified');
                            }

                            // Request server to build & return base64 transaction
                            const signature = await swapTokens({
                                pool: poolAddress,
                                amount: numericAmount,
                                direction: direction,
                                slippage: DEFAULT_SLIPPAGE,
                                userPublicKey: new PublicKey(userAddress),
                                connection,
                                solanaWallet,
                                onStatusUpdate: (msg) => setStatusMessage(msg),
                            });

                            setStatusMessage(`Swap successful! Tx: ${signature.slice(0, 8)}...${signature.slice(-8)}`);

                            // Reset amounts after successful swap
                            setBaseAmount('');
                            setQuoteAmount('');
                        } catch (err) {
                            console.error('Swap error:', err);
                            setError(err instanceof Error ? err.message : 'Swap failed');
                            setStatusMessage(null);
                        } finally {
                            setIsLoading(false);
                        }
                    }
                }
            ]
        );
    }, [
        address,
        connected,
        solanaWallet,
        baseAmount,
        quoteAmount,
        direction,
        connection,
        poolAddress,
        baseToken.symbol,
        quoteToken.symbol
    ]);

    if (!connected) {
        return (
            <View style={styles.container}>
                <Text style={styles.infoText}>
                    Please connect your wallet to perform swaps
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>
                {poolInfo
                    ? `Swap ${baseToken.symbol} ↔ ${quoteToken.symbol}`
                    : 'Swap Tokens'
                }
            </Text>

            {/* Pool Address */}
            <Text style={styles.inputLabel}>Pool Address</Text>
            <TextInput
                style={[styles.input, { keyboardAppearance: 'dark' }]}
                value={poolAddress}
                onChangeText={handlePoolAddressChange}
                placeholder="Enter pool address"
                editable={!isLoading && !isPoolLoading}
                keyboardAppearance="dark"
            />

            {isPoolLoading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#6E56CF" />
                    <Text style={styles.loadingText}>Loading pool info...</Text>
                </View>
            )}

            {poolInfo && (
                <>
                    {/* Pool Info Display */}
                    <View style={styles.poolInfoContainer}>
                        <View style={styles.tokenInfo}>
                            <Text style={styles.tokenInfoLabel}>Base Token:</Text>
                            <Text style={styles.tokenInfoValue}>{baseToken.symbol} ({baseToken.name})</Text>
                        </View>
                        <View style={styles.tokenInfo}>
                            <Text style={styles.tokenInfoLabel}>Quote Token:</Text>
                            <Text style={styles.tokenInfoValue}>{quoteToken.symbol} ({quoteToken.name})</Text>
                        </View>
                        {poolInfo.price && (
                            <View style={styles.tokenInfo}>
                                <Text style={styles.tokenInfoLabel}>Price:</Text>
                                <Text style={styles.tokenInfoValue}>
                                    1 {baseToken.symbol} = {poolInfo.price.toFixed(6)} {quoteToken.symbol}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Input for "base" token */}
                    <Text style={styles.inputLabel}>Input {baseToken.symbol} Amount</Text>
                    <TextInput
                        style={[styles.input, { keyboardAppearance: 'dark' }]}
                        value={baseAmount}
                        onChangeText={handleBaseAmountChange}
                        placeholder={`Enter ${baseToken.symbol} amount`}
                        keyboardType="numeric"
                        editable={!isLoading && direction === Direction.BaseToQuote}
                        keyboardAppearance="dark"
                    />

                    {/* Toggle direction button */}
                    <TouchableOpacity onPress={toggleDirection} style={styles.toggleButton}>
                        <Text style={styles.toggleButtonText}>⇅</Text>
                    </TouchableOpacity>

                    {/* Input for "quote" token */}
                    <Text style={styles.inputLabel}>Input {quoteToken.symbol} Amount</Text>
                    <TextInput
                        style={[styles.input, { keyboardAppearance: 'dark' }]}
                        value={quoteAmount}
                        onChangeText={handleQuoteAmountChange}
                        placeholder={`Enter ${quoteToken.symbol} amount`}
                        keyboardType="numeric"
                        editable={!isLoading && direction === Direction.QuoteToBase}
                        keyboardAppearance="dark"
                    />

                    {/* Swap button */}
                    <TouchableOpacity
                        style={[
                            styles.swapButton,
                            (!poolAddress || (!baseAmount && !quoteAmount) || isLoading) ? styles.disabledButton : null
                        ]}
                        onPress={handleSwap}
                        disabled={!poolAddress || (!baseAmount && !quoteAmount) || isLoading}
                    >
                        {isLoading ? (
                            <View style={styles.swapButtonLoading}>
                                <ActivityIndicator size="small" color="#FFFFFF" />
                                <Text style={styles.swapButtonText}>Processing...</Text>
                            </View>
                        ) : (
                            <Text style={styles.swapButtonText}>Swap</Text>
                        )}
                    </TouchableOpacity>
                </>
            )}

            {/* Loading indicator */}
            {isLoading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#6E56CF" />
                </View>
            )}

            {/* Status and error messages */}
            {statusMessage && (
                <View style={styles.statusContainer}>
                    <Text style={styles.statusText}>{statusMessage}</Text>
                </View>
            )}
            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {/* Help text */}
            <View style={styles.infoContainer}>
                <Text style={styles.infoTextDetail}>
                    <Text style={{ fontWeight: 'bold' }}>Step 1:</Text> Enter the pool address first. This should be the address of an existing liquidity pool.
                </Text>
                <Text style={styles.infoTextDetail}>
                    <Text style={{ fontWeight: 'bold' }}>Step 2:</Text> The app will automatically detect the tokens in this pool.
                </Text>
                <Text style={styles.infoTextDetail}>
                    <Text style={{ fontWeight: 'bold' }}>Step 3:</Text> Enter amount to swap and click Swap button.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16 },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
        color: '#1E293B',
    },
    infoText: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#64748B',
        marginBottom: 4,
    },
    input: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 12,
    },
    poolInfoContainer: {
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    tokenInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    tokenInfoLabel: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
    },
    tokenInfoValue: {
        fontSize: 14,
        color: '#334155',
        fontWeight: '400',
    },
    toggleButton: {
        alignSelf: 'center',
        marginVertical: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 8,
        padding: 8,
    },
    toggleButtonText: {
        fontSize: 18,
        color: '#6E56CF',
    },
    swapButton: {
        backgroundColor: '#6E56CF',
        borderRadius: 8,
        padding: 16,
        marginTop: 8,
        alignItems: 'center',
    },
    swapButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    disabledButton: {
        opacity: 0.5,
    },
    loadingContainer: {
        marginTop: 12,
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 4,
    },
    statusContainer: {
        marginTop: 10,
        backgroundColor: '#EFF6FF',
        borderRadius: 6,
        padding: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#3B82F6',
    },
    statusText: {
        fontSize: 14,
        color: '#64748B',
    },
    errorContainer: {
        marginTop: 10,
        backgroundColor: '#ffeef0',
        borderRadius: 6,
        padding: 8,
    },
    errorText: {
        color: '#d32f2f',
        fontSize: 14,
    },
    infoContainer: {
        backgroundColor: '#F1F5F9',
        borderRadius: 8,
        padding: 12,
        marginTop: 12,
    },
    infoTextDetail: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 8,
    },
    swapButtonLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
});
