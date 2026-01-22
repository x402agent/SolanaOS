import React, { useState, useCallback, useEffect } from 'react';
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
import { createPool } from '../../services/pumpSwapService'; // <--- calls the server only
import { TokenInfo } from '@/modules/data-module';
import SelectTokenModal from '@/modules/swap/components/SelectTokenModal';

// Default index for pool creation
const DEFAULT_INDEX = 1; // Index used by the server/SDK

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

interface PoolCreationSectionProps {
    connection: Connection;
    solanaWallet: any;
}

/**
 * PoolCreationSection allows a user to create a brand new pool
 */
export function PoolCreationSection({
    connection,
    solanaWallet,
}: PoolCreationSectionProps) {
    const { address, connected } = useWallet();

    // UI States
    const [baseMint, setBaseMint] = useState(SOL_MINT);
    const [quoteMint, setQuoteMint] = useState(USDC_MINT);
    const [baseToken, setBaseToken] = useState<TokenInfo>({
        address: SOL_MINT,
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        logoURI: '',
    });
    const [quoteToken, setQuoteToken] = useState<TokenInfo>({
        address: USDC_MINT,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        logoURI: '',
    });
    const [baseAmount, setBaseAmount] = useState('');
    const [quoteAmount, setQuoteAmount] = useState('');
    const [initialPrice, setInitialPrice] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    // Token selection modal states
    const [showBaseTokenModal, setShowBaseTokenModal] = useState(false);
    const [showQuoteTokenModal, setShowQuoteTokenModal] = useState(false);

    // Recalculate initial pool price whenever amounts change
    const recalcPrice = useCallback((baseVal: string, quoteVal: string) => {
        const b = parseFloat(baseVal) || 0;
        const q = parseFloat(quoteVal) || 0;

        if (b > 0 && q > 0) {
            setInitialPrice(q / b);
        } else {
            setInitialPrice(null);
        }
    }, []);

    const handleBaseAmountChange = useCallback((val: string) => {
        setBaseAmount(val);
        recalcPrice(val, quoteAmount);
    }, [quoteAmount, recalcPrice]);

    const handleQuoteAmountChange = useCallback((val: string) => {
        setQuoteAmount(val);
        recalcPrice(baseAmount, val);
    }, [baseAmount, recalcPrice]);

    // Handle token selection from modal
    const handleBaseTokenSelected = useCallback((token: TokenInfo) => {
        setBaseToken(token);
        setBaseMint(token.address);
        setShowBaseTokenModal(false);
        setError(null);
    }, []);

    const handleQuoteTokenSelected = useCallback((token: TokenInfo) => {
        setQuoteToken(token);
        setQuoteMint(token.address);
        setShowQuoteTokenModal(false);
        setError(null);
    }, []);

    // Validate Solana public key format (simple check)
    const isValidPublicKey = useCallback((key: string): boolean => {
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(key);
    }, []);

    // Check if base/quote are the same token
    useEffect(() => {
        if (baseMint && quoteMint && baseMint === quoteMint) {
            setError('Base and quote tokens cannot be the same');
        } else if (error === 'Base and quote tokens cannot be the same') {
            setError(null);
        }
    }, [baseMint, quoteMint, error]);

    // Perform create pool transaction
    const handleCreatePool = useCallback(async () => {
        if (!connected || !solanaWallet) return;

        const userAddress = address || '';
        if (!userAddress) {
            setError('No wallet address found');
            return;
        }

        // Validate inputs
        if (!isValidPublicKey(baseMint)) {
            setError('Invalid base token mint address');
            return;
        }

        if (!isValidPublicKey(quoteMint)) {
            setError('Invalid quote token mint address');
            return;
        }

        if (baseMint === quoteMint) {
            setError('Base and quote tokens cannot be the same');
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Parse values as floating point with sufficient precision
            const b = parseFloat(baseAmount);
            const q = parseFloat(quoteAmount);
            if (isNaN(b) || isNaN(q) || b <= 0 || q <= 0) {
                throw new Error('Invalid token amounts');
            }

            // Define minimum amount thresholds
            const minBaseAmount = 0.01; // Minimum amount for any token
            const minQuoteAmount = 0.01; // Minimum amount for any token

            // Calculate final amounts, ensuring minimums
            const finalBaseAmount = Math.max(Number(b.toFixed(9)), minBaseAmount);
            const finalQuoteAmount = Math.max(Number(q.toFixed(9)), minQuoteAmount);

            // Calculate price for display
            const displayPrice = (finalQuoteAmount / finalBaseAmount).toFixed(6);

            // Check if the user likely has enough SOL balance
            let warningMessage = '';
            try {
                const solBalance = await connection.getBalance(new PublicKey(userAddress));
                const solBalanceInSol = solBalance / 1_000_000_000;

                // Creating a pool requires at least ~0.03 SOL for account rent
                if (solBalanceInSol < 0.03) {
                    warningMessage = `\n\nWARNING: Your wallet has only ${solBalanceInSol.toFixed(6)} SOL, which may not be enough to cover the network fees required to create a pool. The transaction might fail.`;
                }
            } catch (balanceError) {
                console.log('Could not check SOL balance:', balanceError);
            }

            // Confirm with user before proceeding
            Alert.alert(
                'Create Pool',
                `You are about to create a new pool with:\n\n` +
                `${finalBaseAmount} ${baseToken.symbol} and ${finalQuoteAmount} ${quoteToken.symbol}\n\n` +
                `Initial price: 1 ${baseToken.symbol} = ${displayPrice} ${quoteToken.symbol}` +
                warningMessage +
                `\n\nContinue?`,
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => {
                            setIsLoading(false);
                        }
                    },
                    {
                        text: 'Create Pool',
                        onPress: async () => {
                            try {
                                setStatusMessage('Preparing transaction...');

                                // Use exact numeric values to avoid precision issues and ensure minimums
                                const signature = await createPool({
                                    index: DEFAULT_INDEX,
                                    baseMint: baseMint,
                                    quoteMint: quoteMint,
                                    baseAmount: finalBaseAmount,
                                    quoteAmount: finalQuoteAmount,
                                    userPublicKey: new PublicKey(userAddress),
                                    connection,
                                    solanaWallet,
                                    onStatusUpdate: (msg) => setStatusMessage(msg),
                                });

                                setStatusMessage(`Pool created! Tx signature: ${signature}`);
                                // Reset amounts but keep mint addresses
                                setBaseAmount('');
                                setQuoteAmount('');
                                setInitialPrice(null);
                            } catch (err) {
                                setError(err instanceof Error ? err.message : 'Failed to create pool');
                                setStatusMessage(null);
                            } finally {
                                setIsLoading(false);
                            }
                        }
                    }
                ]
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create pool');
            setStatusMessage(null);
            setIsLoading(false);
        }
    }, [
        connected,
        solanaWallet,
        address,
        baseMint,
        quoteMint,
        baseAmount,
        quoteAmount,
        baseToken.symbol,
        quoteToken.symbol,
        isValidPublicKey,
        connection
    ]);

    if (!connected) {
        return (
            <View style={styles.container}>
                <Text style={styles.infoText}>
                    Please connect your wallet to create a pool
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>Create a New Pool</Text>

            {/* Base Token Selection */}
            <Text style={styles.inputLabel}>Base Token</Text>
            <TouchableOpacity
                style={styles.tokenSelector}
                onPress={() => setShowBaseTokenModal(true)}
                disabled={isLoading}
            >
                <View style={styles.tokenInfo}>
                    <Text style={styles.tokenSymbol}>{baseToken.symbol}</Text>
                    <Text style={styles.tokenName}>{baseToken.name}</Text>
                </View>
                <Text style={styles.tokenAddress}>{baseToken.address.slice(0, 4)}...{baseToken.address.slice(-4)}</Text>
            </TouchableOpacity>

            {/* Quote Token Selection */}
            <Text style={styles.inputLabel}>Quote Token</Text>
            <TouchableOpacity
                style={styles.tokenSelector}
                onPress={() => setShowQuoteTokenModal(true)}
                disabled={isLoading}
            >
                <View style={styles.tokenInfo}>
                    <Text style={styles.tokenSymbol}>{quoteToken.symbol}</Text>
                    <Text style={styles.tokenName}>{quoteToken.name}</Text>
                </View>
                <Text style={styles.tokenAddress}>{quoteToken.address.slice(0, 4)}...{quoteToken.address.slice(-4)}</Text>
            </TouchableOpacity>

            {/* Base Amount */}
            <Text style={styles.inputLabel}>Base Token Amount ({baseToken.symbol})</Text>
            <TextInput
                style={[styles.input, { keyboardAppearance: 'dark' }]}
                value={baseAmount}
                onChangeText={handleBaseAmountChange}
                placeholder={`Enter ${baseToken.symbol} amount`}
                keyboardType="numeric"
                editable={!isLoading}
                keyboardAppearance="dark"
            />

            {/* Quote Amount */}
            <Text style={styles.inputLabel}>Quote Token Amount ({quoteToken.symbol})</Text>
            <TextInput
                style={[styles.input, { keyboardAppearance: 'dark' }]}
                value={quoteAmount}
                onChangeText={handleQuoteAmountChange}
                placeholder={`Enter ${quoteToken.symbol} amount`}
                keyboardType="numeric"
                editable={!isLoading}
                keyboardAppearance="dark"
            />

            {/* Show initial price if both amounts > 0 */}
            {initialPrice !== null && (
                <View style={styles.priceContainer}>
                    <Text style={styles.priceLabel}>Initial Price:</Text>
                    <Text style={styles.priceValue}>
                        1 {baseToken.symbol} = {initialPrice.toFixed(6)} {quoteToken.symbol}
                    </Text>
                </View>
            )}

            {/* Pool creation info */}
            <View style={styles.infoContainer}>
                <Text style={styles.infoTextDetail}>
                    Creating a pool allows you to provide liquidity between two tokens and earn fees from trades.
                </Text>
                <Text style={styles.infoTextDetail}>
                    Note: You must have both tokens in your wallet to create a pool.
                </Text>
                <Text style={styles.infoTextDetail}>
                    <Text style={{ fontWeight: 'bold' }}>Important:</Text> The minimum
                    amount required for each token is 0.01 tokens.
                </Text>
                <Text style={[styles.infoTextDetail, { marginTop: 8, color: '#c75e16' }]}>
                    <Text style={{ fontWeight: 'bold' }}>Mainnet Notice:</Text> Creating a pool on mainnet requires enough SOL
                    to cover rent for new accounts. You need approximately 0.03-0.05 SOL (~$4-6) in your wallet to successfully
                    create a pool, in addition to the tokens you're providing as liquidity.
                </Text>
            </View>

            {/* Create pool button */}
            <TouchableOpacity
                style={[styles.button, isLoading ? styles.disabledButton : null]}
                onPress={handleCreatePool}
                disabled={isLoading}
            >
                <Text style={styles.buttonText}>
                    {isLoading ? 'Processing...' : 'Create Pool'}
                </Text>
            </TouchableOpacity>

            {/* Loading */}
            {isLoading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#6E56CF" />
                </View>
            )}

            {/* Status Message */}
            {statusMessage && (
                <View style={
                    statusMessage.includes('failed') || statusMessage.includes('Failed')
                        ? styles.errorContainer
                        : styles.statusContainer
                }>
                    <Text style={
                        statusMessage.includes('failed') || statusMessage.includes('Failed')
                            ? styles.errorText
                            : styles.statusText
                    }>
                        {statusMessage}
                    </Text>
                </View>
            )}

            {/* Error display */}
            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    {error.includes('Invalid account discriminator') && (
                        <Text style={styles.errorHint}>
                            The PumpSwap SDK couldn't find a valid pool. This can happen if the pool doesn't exist or the SDK is trying to use the wrong program ID.
                        </Text>
                    )}
                </View>
            )}

            {/* Token Selection Modals */}
            <SelectTokenModal
                visible={showBaseTokenModal}
                onClose={() => setShowBaseTokenModal(false)}
                onTokenSelected={handleBaseTokenSelected}
            />

            <SelectTokenModal
                visible={showQuoteTokenModal}
                onClose={() => setShowQuoteTokenModal(false)}
                onTokenSelected={handleQuoteTokenSelected}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16 },
    infoText: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
        textAlign: 'center',
        color: '#1E293B',
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#64748B',
        marginBottom: 4,
    },
    tokenSelector: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    tokenInfo: {
        flexDirection: 'column',
    },
    tokenSymbol: {
        fontSize: 16,
        fontWeight: '600',
        color: '#334155',
    },
    tokenName: {
        fontSize: 12,
        color: '#64748B',
    },
    tokenAddress: {
        fontSize: 12,
        color: '#94A3B8',
    },
    input: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        marginBottom: 12,
    },
    priceContainer: {
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        padding: 16,
        marginVertical: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    priceLabel: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
    },
    priceValue: {
        fontSize: 16,
        color: '#334155',
        fontWeight: '600',
    },
    button: {
        backgroundColor: '#6E56CF',
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
    },
    buttonText: {
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
        marginVertical: 12,
    },
    infoTextDetail: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 8,
    },
    errorHint: {
        marginTop: 4,
        fontSize: 12,
        color: '#64748B',
        fontStyle: 'italic',
    },
});
