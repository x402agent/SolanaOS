import React, { useState } from 'react';
import {
    SafeAreaView,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Platform,
    Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const MercuroScreen = () => {
    const navigation = useNavigation();
    const [selectedTab, setSelectedTab] = useState('onramp'); // 'onramp' or 'offramp'
    const [amount, setAmount] = useState('');
    const [selectedCurrency, setSelectedCurrency] = useState('USD');
    const [selectedCrypto, setSelectedCrypto] = useState('SOL');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('card');

    const currencies = [
        { code: 'USD', name: 'US Dollar', symbol: '$' },
        { code: 'EUR', name: 'Euro', symbol: '€' },
        { code: 'GBP', name: 'British Pound', symbol: '£' },
    ];

    const cryptos = [
        { code: 'SOL', name: 'Solana', logo: require('../../../assets/images/SENDlogo.png') },
        { code: 'USDC', name: 'USD Coin', logo: require('../../../assets/images/SENDlogo.png') },
        { code: 'BONK', name: 'Bonk', logo: require('../../../assets/images/SENDlogo.png') },
    ];

    const paymentMethods = [
        { id: 'card', name: 'Credit/Debit Card', icon: '💳' },
        { id: 'applepay', name: 'Apple Pay', icon: '🍎', appleOnly: true },
        { id: 'bank', name: 'Bank Transfer', icon: '🏦' },
    ];

    const filteredPaymentMethods = paymentMethods.filter(method =>
        !(method.appleOnly && Platform.OS !== 'ios')
    );

    const renderCurrencyOption = (currency: any) => (
        <TouchableOpacity
            key={currency.code}
            style={[
                styles.optionButton,
                selectedCurrency === currency.code && styles.selectedOption,
            ]}
            onPress={() => setSelectedCurrency(currency.code)}
        >
            <Text style={styles.currencySymbol}>{currency.symbol}</Text>
            <Text style={styles.optionText}>{currency.code}</Text>
        </TouchableOpacity>
    );

    const renderCryptoOption = (crypto: any) => (
        <TouchableOpacity
            key={crypto.code}
            style={[
                styles.optionButton,
                selectedCrypto === crypto.code && styles.selectedOption,
            ]}
            onPress={() => setSelectedCrypto(crypto.code)}
        >
            <Image source={crypto.logo} style={styles.cryptoLogo} />
            <Text style={styles.optionText}>{crypto.code}</Text>
        </TouchableOpacity>
    );

    const renderPaymentMethodOption = (method: any) => (
        <TouchableOpacity
            key={method.id}
            style={[
                styles.paymentMethodButton,
                selectedPaymentMethod === method.id && styles.selectedPaymentMethod,
            ]}
            onPress={() => setSelectedPaymentMethod(method.id)}
        >
            <View style={styles.paymentMethodIcon}>
                <Text style={styles.paymentMethodIconText}>{method.icon}</Text>
            </View>
            <Text style={styles.paymentMethodName}>{method.name}</Text>
            {selectedPaymentMethod === method.id && (
                <View style={styles.selectedPaymentMethodIndicator} />
            )}
        </TouchableOpacity>
    );

    const handleContinue = () => {
        // Simulate action based on payment method
        if (selectedPaymentMethod === 'card') {
            alert('Redirecting to secure card payment page...');
        } else if (selectedPaymentMethod === 'applepay') {
            alert('Launching Apple Pay...');
        } else {
            alert('Redirecting to bank transfer instructions...');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Mercuryo</Text>
                <View style={{ width: 60 }} />
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tabButton, selectedTab === 'onramp' && styles.activeTab]}
                    onPress={() => setSelectedTab('onramp')}
                >
                    <Text style={[styles.tabText, selectedTab === 'onramp' && styles.activeTabText]}>
                        On-Ramp
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabButton, selectedTab === 'offramp' && styles.activeTab]}
                    onPress={() => setSelectedTab('offramp')}
                >
                    <Text style={[styles.tabText, selectedTab === 'offramp' && styles.activeTabText]}>
                        Off-Ramp
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>
                        {selectedTab === 'onramp' ? 'Buy Crypto' : 'Sell Crypto'}
                    </Text>
                    <Text style={styles.cardDescription}>
                        {selectedTab === 'onramp'
                            ? 'Convert your fiat currency to crypto quickly and securely.'
                            : 'Convert your crypto to fiat currency quickly and securely.'}
                    </Text>

                    <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Enter amount</Text>
                        <View style={styles.amountInputContainer}>
                            <Text style={styles.currencyIndicator}>
                                {selectedTab === 'onramp'
                                    ? currencies.find(c => c.code === selectedCurrency)?.symbol || '$'
                                    : ''}
                            </Text>
                            <TextInput
                                style={styles.amountInput}
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={setAmount}
                                placeholder="0.00"
                                placeholderTextColor="#999"
                            />
                        </View>
                    </View>

                    <View style={styles.optionsContainer}>
                        <Text style={styles.optionsLabel}>
                            {selectedTab === 'onramp' ? 'Select currency' : 'Select crypto'}
                        </Text>
                        <View style={styles.optionsRow}>
                            {selectedTab === 'onramp'
                                ? currencies.map(renderCurrencyOption)
                                : cryptos.map(renderCryptoOption)}
                        </View>
                    </View>

                    <View style={styles.optionsContainer}>
                        <Text style={styles.optionsLabel}>
                            {selectedTab === 'onramp' ? 'Select crypto' : 'Select currency'}
                        </Text>
                        <View style={styles.optionsRow}>
                            {selectedTab === 'onramp'
                                ? cryptos.map(renderCryptoOption)
                                : currencies.map(renderCurrencyOption)}
                        </View>
                    </View>

                    {selectedTab === 'onramp' && (
                        <View style={styles.paymentMethodsContainer}>
                            <Text style={styles.optionsLabel}>Payment Method</Text>
                            {filteredPaymentMethods.map(renderPaymentMethodOption)}

                            {selectedPaymentMethod === 'card' && (
                                <View style={styles.paymentInfoBox}>
                                    <Text style={styles.paymentInfoTitle}>Debit/Credit Card</Text>
                                    <Text style={styles.paymentInfoText}>• Visa, Mastercard and American Express accepted</Text>
                                    <Text style={styles.paymentInfoText}>• Fast processing with 3D Secure authentication</Text>
                                    <Text style={styles.paymentInfoText}>• Transaction fee: 2.5%</Text>
                                </View>
                            )}

                            {selectedPaymentMethod === 'applepay' && Platform.OS === 'ios' && (
                                <View style={styles.paymentInfoBox}>
                                    <Text style={styles.paymentInfoTitle}>Apple Pay</Text>
                                    <Text style={styles.paymentInfoText}>• Quick and secure payments with Face ID/Touch ID</Text>
                                    <Text style={styles.paymentInfoText}>• No need to enter card details manually</Text>
                                    <Text style={styles.paymentInfoText}>• Transaction fee: 1.8%</Text>
                                </View>
                            )}

                            {selectedPaymentMethod === 'bank' && (
                                <View style={styles.paymentInfoBox}>
                                    <Text style={styles.paymentInfoTitle}>Bank Transfer</Text>
                                    <Text style={styles.paymentInfoText}>• Lower fees for larger amounts</Text>
                                    <Text style={styles.paymentInfoText}>• Processing time: 1-3 business days</Text>
                                    <Text style={styles.paymentInfoText}>• Transaction fee: 1%</Text>
                                </View>
                            )}
                        </View>
                    )}

                    <View style={styles.summaryContainer}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Rate</Text>
                            <Text style={styles.summaryValue}>
                                {selectedTab === 'onramp'
                                    ? `1 ${selectedCurrency} ≈ 0.0412 ${selectedCrypto}`
                                    : `1 ${selectedCrypto} ≈ 24.31 ${selectedCurrency}`}
                            </Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Fee</Text>
                            <Text style={styles.summaryValue}>
                                {selectedTab === 'onramp' && selectedPaymentMethod === 'card' ? '2.5%' :
                                    selectedTab === 'onramp' && selectedPaymentMethod === 'applepay' ? '1.8%' :
                                        selectedTab === 'onramp' && selectedPaymentMethod === 'bank' ? '1.0%' : '1.5%'}
                            </Text>
                        </View>
                        <View style={[styles.summaryRow, styles.totalRow]}>
                            <Text style={styles.totalLabel}>You will receive</Text>
                            <Text style={styles.totalValue}>
                                {amount
                                    ? `${selectedTab === 'onramp' ? '≈ ' + (parseFloat(amount) * 0.04).toFixed(2) + ' ' + selectedCrypto : '≈ ' + (parseFloat(amount) * 24).toFixed(2) + ' ' + selectedCurrency}`
                                    : '-'}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.actionButton, !amount && styles.disabledButton]}
                        onPress={handleContinue}
                        disabled={!amount}
                    >
                        <Text style={styles.actionButtonText}>
                            {selectedTab === 'onramp' ? 'Continue to Payment' : 'Sell Now'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
    },
    backButton: {
        width: 60,
    },
    backButtonText: {
        fontSize: 16,
        color: '#007AFF',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        padding: 4,
        marginHorizontal: 20,
        marginTop: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: '#007AFF',
    },
    tabText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
    activeTabText: {
        color: '#fff',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#000',
        marginBottom: 8,
    },
    cardDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 24,
        lineHeight: 20,
    },
    inputContainer: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#444',
        marginBottom: 8,
    },
    amountInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 12 : 4,
    },
    currencyIndicator: {
        fontSize: 18,
        color: '#333',
        marginRight: 8,
    },
    amountInput: {
        flex: 1,
        fontSize: 18,
        color: '#333',
    },
    optionsContainer: {
        marginBottom: 24,
    },
    optionsLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#444',
        marginBottom: 8,
    },
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '30%',
        paddingVertical: 12,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
    },
    selectedOption: {
        backgroundColor: 'rgba(0, 122, 255, 0.1)',
        borderWidth: 1,
        borderColor: '#007AFF',
    },
    currencySymbol: {
        fontSize: 16,
        color: '#333',
        marginRight: 4,
    },
    optionText: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
    cryptoLogo: {
        width: 20,
        height: 20,
        marginRight: 4,
        borderRadius: 10,
    },
    paymentMethodsContainer: {
        marginBottom: 24,
    },
    paymentMethodButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        marginBottom: 8,
        position: 'relative',
    },
    selectedPaymentMethod: {
        backgroundColor: 'rgba(0, 122, 255, 0.1)',
        borderWidth: 1,
        borderColor: '#007AFF',
    },
    selectedPaymentMethodIndicator: {
        position: 'absolute',
        right: 12,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#007AFF',
    },
    paymentMethodIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    paymentMethodIconText: {
        fontSize: 20,
    },
    paymentMethodName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
    },
    paymentInfoBox: {
        backgroundColor: 'rgba(0, 122, 255, 0.05)',
        borderRadius: 8,
        padding: 12,
        marginTop: 8,
    },
    paymentInfoTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#007AFF',
        marginBottom: 8,
    },
    paymentInfoText: {
        fontSize: 13,
        color: '#333',
        marginBottom: 4,
        lineHeight: 18,
    },
    summaryContainer: {
        marginTop: 8,
        marginBottom: 24,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#666',
    },
    summaryValue: {
        fontSize: 14,
        color: '#333',
        fontWeight: '500',
    },
    totalRow: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    totalValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    actionButton: {
        backgroundColor: '#007AFF',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#b0d0ff',
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default MercuroScreen; 