import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Switch,
    Image,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import {
    TokenType,
    FeeSchedulerMode,
    ActivationType,
    CollectFeeMode,
    MigrationOption,
    MigrationFeeOption,
    BuildCurveByMarketCapParams,
} from '../types';
import { buildCurveByMarketCap, createPool, createTokenWithCurve, uploadTokenMetadata } from '../services/meteoraService';
import BondingCurveVisualizer from './BondingCurveVisualizer';
import { Connection } from '@solana/web3.js';
import { useWallet } from '@/modules/wallet-providers/hooks/useWallet';
import BN from 'bn.js';
import { HELIUS_STAKED_URL } from '@env';

interface TokenCreationFormProps {
    walletAddress: string;
    onTokenCreated?: (tokenAddress: string, txId: string) => void;
}

export default function TokenCreationForm({
    walletAddress,
    onTokenCreated,
}: TokenCreationFormProps) {
    // Basic token info
    const [tokenName, setTokenName] = useState('');
    const [tokenSymbol, setTokenSymbol] = useState('');
    const [tokenSupply, setTokenSupply] = useState('1000000000');
    const [tokenDecimals, setTokenDecimals] = useState('9');
    const [tokenWebsite, setTokenWebsite] = useState('');
    const [tokenDescription, setTokenDescription] = useState('');
    const [tokenTwitter, setTokenTwitter] = useState('');
    const [tokenTelegram, setTokenTelegram] = useState('');

    // Market cap settings
    const [initialMarketCap, setInitialMarketCap] = useState('100');
    const [migrationMarketCap, setMigrationMarketCap] = useState('3000');

    // Token type
    const [isToken2022, setIsToken2022] = useState(false);

    // Buy on creation options
    const [buyOnCreate, setBuyOnCreate] = useState(false);
    const [buyAmount, setBuyAmount] = useState('1');

    // Advanced options
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [baseFeeBps, setBaseFeeBps] = useState('100'); // 1% fee
    const [dynamicFeeEnabled, setDynamicFeeEnabled] = useState(true);
    const [collectFeeBoth, setCollectFeeBoth] = useState(false);
    const [selectedMigrationFee, setSelectedMigrationFee] = useState(MigrationFeeOption.FixedBps25);

    // LP distribution
    const [partnerLpPercentage, setPartnerLpPercentage] = useState('25');
    const [creatorLpPercentage, setCreatorLpPercentage] = useState('25');
    const [partnerLockedLpPercentage, setPartnerLockedLpPercentage] = useState('25');
    const [creatorLockedLpPercentage, setCreatorLockedLpPercentage] = useState('25');

    // Form state
    const [error, setError] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [step, setStep] = useState(1);
    const [configAddress, setConfigAddress] = useState('');
    const [statusMessage, setStatusMessage] = useState('');

    // Image and metadata handling
    const [tokenLogo, setTokenLogo] = useState('');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<any>(null);
    const [metadataUri, setMetadataUri] = useState('');
    const [isUploadingMetadata, setIsUploadingMetadata] = useState(false);
    const [showSocials, setShowSocials] = useState(false);

    // Get wallet and connection
    const wallet = useWallet();
    // Create a connection to the Solana network with better configuration
    const connection = new Connection(
        HELIUS_STAKED_URL,
        {
            commitment: 'confirmed',
            confirmTransactionInitialTimeout: 120000, // 2 minutes 
            disableRetryOnRateLimit: false
        }
    );

    // Add new state variables for parsed numeric values
    const [parsedInitialMarketCap, setParsedInitialMarketCap] = useState(100);
    const [parsedMigrationMarketCap, setParsedMigrationMarketCap] = useState(3000);
    const [parsedTokenSupply, setParsedTokenSupply] = useState(1000000000);

    // Update parsed values when inputs change
    useEffect(() => {
        const initCap = Number(initialMarketCap);
        if (!isNaN(initCap) && initCap > 0) {
            setParsedInitialMarketCap(initCap);
        }

        const migCap = Number(migrationMarketCap);
        if (!isNaN(migCap) && migCap > 0) {
            setParsedMigrationMarketCap(migCap);
        }

        const supply = Number(tokenSupply);
        if (!isNaN(supply) && supply > 0) {
            setParsedTokenSupply(supply);
        }
    }, [initialMarketCap, migrationMarketCap, tokenSupply]);

    const validateStep1 = () => {
        if (!tokenName.trim()) {
            setError('Token name is required');
            return false;
        }

        if (!tokenSymbol.trim()) {
            setError('Token symbol is required');
            return false;
        }

        if (!tokenDescription.trim()) {
            setError('Token description is required');
            return false;
        }

        if (!imageUri && !tokenLogo) {
            setError('Token image is required');
            return false;
        }

        const supplyNum = Number(tokenSupply);
        if (isNaN(supplyNum) || supplyNum <= 0) {
            setError('Token supply must be a positive number');
            return false;
        }

        const decimalsNum = Number(tokenDecimals);
        if (isNaN(decimalsNum) || decimalsNum < 6 || decimalsNum > 9) {
            setError('Token decimals must be between 6 and 9');
            return false;
        }

        return true;
    };

    const validateStep2 = () => {
        const initMarketCap = Number(initialMarketCap);
        if (isNaN(initMarketCap) || initMarketCap <= 0) {
            setError('Initial market cap must be a positive number');
            return false;
        }

        const migMarketCap = Number(migrationMarketCap);
        if (isNaN(migMarketCap) || migMarketCap <= initMarketCap) {
            setError('Migration market cap must be greater than initial market cap');
            return false;
        }

        const feeVal = Number(baseFeeBps);
        if (isNaN(feeVal) || feeVal < 0 || feeVal > 1000) {
            setError('Base fee must be between 0 and 1000 basis points (0-10%)');
            return false;
        }

        // Validate buy amount if buy on create is enabled
        if (buyOnCreate) {
            const buyAmountVal = Number(buyAmount);
            if (isNaN(buyAmountVal) || buyAmountVal <= 0) {
                setError('Buy amount must be a positive number');
                return false;
            }

            // Check if buy amount is reasonable (usually not more than 100 SOL)
            if (buyAmountVal > 100) {
                setError('Buy amount is unusually high. Please check the amount.');
                return false;
            }
        }

        // Check LP percentages add up to 100%
        const totalPercentage = Number(partnerLpPercentage) +
            Number(creatorLpPercentage) +
            Number(partnerLockedLpPercentage) +
            Number(creatorLockedLpPercentage);

        if (totalPercentage !== 100) {
            setError('LP percentages must add up to 100%');
            return false;
        }

        return true;
    };

    const handleNext = () => {
        setError('');
        if (step === 1 && validateStep1()) {
            setStep(2);
        }
    };

    const handleBack = () => {
        setError('');
        if (step === 2) {
            setStep(1);
        }
    };

    const handleCreateToken = async () => {
        if (!validateStep2()) {
            return;
        }

        setError('');
        setIsCreating(true);

        try {
            // Step 1: Upload metadata first
            setStatusMessage('Uploading token metadata...');
            let uri = metadataUri;

            if (!uri) {
                uri = await uploadMetadata();
            }

            if (!uri) {
                throw new Error('Failed to get metadata URI');
            }

            // Step 2: Create token with curve
            setStatusMessage('Creating token with bonding curve...');

            // Log parameters for debugging
            console.log('Creating token with params:', {
                tokenName,
                tokenSymbol,
                initialMarketCap: parseFloat(initialMarketCap),
                targetMarketCap: parseFloat(migrationMarketCap),
                tokenSupply: parseInt(tokenSupply),
                buyAmount: buyOnCreate ? parseFloat(buyAmount) : undefined,
                metadataUri: uri,
                baseFeeBps: parseInt(baseFeeBps),
                dynamicFeeEnabled,
                collectFeeBoth,
                migrationFeeOption: selectedMigrationFee,
                partnerLpPercentage: parseInt(partnerLpPercentage),
                creatorLpPercentage: parseInt(creatorLpPercentage),
                partnerLockedLpPercentage: parseInt(partnerLockedLpPercentage),
                creatorLockedLpPercentage: parseInt(creatorLockedLpPercentage)
            });

            // Use the improved createTokenWithCurve function with metadata URI
            const result = await createTokenWithCurve(
                {
                    tokenName,
                    tokenSymbol,
                    initialMarketCap: parseFloat(initialMarketCap),
                    targetMarketCap: parseFloat(migrationMarketCap),
                    tokenSupply: parseInt(tokenSupply),
                    buyAmount: buyOnCreate ? parseFloat(buyAmount) : undefined,
                    metadataUri: uri,
                    website: tokenWebsite,
                    logo: imageUri || tokenLogo,
                    // Pass the advanced settings
                    baseFeeBps: parseInt(baseFeeBps),
                    dynamicFeeEnabled,
                    collectFeeBoth,
                    migrationFeeOption: selectedMigrationFee,
                    partnerLpPercentage: parseInt(partnerLpPercentage),
                    creatorLpPercentage: parseInt(creatorLpPercentage),
                    partnerLockedLpPercentage: parseInt(partnerLockedLpPercentage),
                    creatorLockedLpPercentage: parseInt(creatorLockedLpPercentage)
                },
                connection,
                wallet,
                setStatusMessage
            );

            console.log('Token created successfully:', result);

            if (onTokenCreated && result.baseMintAddress) {
                onTokenCreated(result.baseMintAddress, result.txId);
            }
        } catch (err) {
            console.error('Error creating token:', err);
            setError(`Failed to create token: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setIsCreating(false);
        }
    };

    // Add a function to handle image picking
    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets.length > 0) {
                setImageUri(result.assets[0].uri);
                setImageFile(result.assets[0]);
                // If using direct URL input before, clear it
                if (tokenLogo && tokenLogo !== result.assets[0].uri) {
                    setTokenLogo('');
                }
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to select image');
        }
    };

    // Function to remove selected image
    const removeImage = () => {
        setImageUri(null);
        setImageFile(null);
        setTokenLogo('');
    };

    // Function to use image from URL
    const setImageFromUrl = () => {
        if (tokenLogo && (
            tokenLogo.startsWith('http://') ||
            tokenLogo.startsWith('https://') ||
            tokenLogo.startsWith('ipfs://')
        )) {
            setImageUri(tokenLogo);
            setImageFile(null);
        } else {
            Alert.alert('Invalid URL', 'Please enter a valid URL starting with http://, https://, or ipfs://');
        }
    };

    // Add function to upload metadata
    const uploadMetadata = async (): Promise<string> => {
        try {
            setIsUploadingMetadata(true);
            setStatusMessage('Uploading token metadata and image...');

            if (!tokenName || !tokenSymbol || !tokenDescription) {
                throw new Error('Missing required metadata fields');
            }

            if (!imageUri && !tokenLogo) {
                throw new Error('Token image is required');
            }

            // Create form data for upload
            const metadataResult = await uploadTokenMetadata({
                tokenName,
                tokenSymbol,
                description: tokenDescription,
                imageUri: imageUri || tokenLogo,
                imageFile: imageFile,
                twitter: tokenTwitter,
                telegram: tokenTelegram,
                website: tokenWebsite,
            });

            if (!metadataResult.success || !metadataResult.metadataUri) {
                throw new Error(metadataResult.error || 'Failed to upload metadata');
            }

            setMetadataUri(metadataResult.metadataUri);
            setStatusMessage('Metadata uploaded successfully!');
            return metadataResult.metadataUri;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error uploading metadata';
            console.error('Error uploading metadata:', errorMessage);
            setStatusMessage('');
            throw new Error(errorMessage);
        } finally {
            setIsUploadingMetadata(false);
        }
    };

    const renderStep1 = () => {
        return (
            <View>
                <Text style={styles.sectionTitle}>Basic Token Information</Text>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Token Name</Text>
                    <TextInput
                        style={styles.input}
                        value={tokenName}
                        onChangeText={setTokenName}
                        placeholder="e.g. My Awesome Token"
                        placeholderTextColor={COLORS.greyDark}
                        keyboardAppearance="dark"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Token Symbol</Text>
                    <TextInput
                        style={styles.input}
                        value={tokenSymbol}
                        onChangeText={setTokenSymbol}
                        placeholder="e.g. MAT"
                        placeholderTextColor={COLORS.greyDark}
                        maxLength={10}
                        keyboardAppearance="dark"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Description</Text>
                    <TextInput
                        style={[styles.input, { height: 80 }]}
                        value={tokenDescription}
                        onChangeText={setTokenDescription}
                        placeholder="Describe your token's purpose"
                        placeholderTextColor={COLORS.greyDark}
                        multiline
                        keyboardAppearance="dark"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Website (Optional)</Text>
                    <TextInput
                        style={styles.input}
                        value={tokenWebsite}
                        onChangeText={setTokenWebsite}
                        placeholder="e.g. https://example.com"
                        placeholderTextColor={COLORS.greyDark}
                        keyboardAppearance="dark"
                    />
                    <Text style={styles.helperText}>Project website for token metadata</Text>
                </View>

                {/* Token image section - improved UI */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Token Image</Text>
                    <View style={styles.imageUploadContainer}>
                        {imageUri ? (
                            <View style={styles.imagePreviewContainer}>
                                {imageUri.startsWith('http') || imageUri.startsWith('ipfs') ? (
                                    <View style={styles.imageUrlPreview}>
                                        <Text style={styles.imageUrlText}>{imageUri}</Text>
                                    </View>
                                ) : (
                                    <Image
                                        source={{ uri: imageUri }}
                                        style={styles.imagePreview}
                                    />
                                )}
                                <View style={styles.imageControlsContainer}>
                                    <TouchableOpacity
                                        style={styles.imageControlButton}
                                        onPress={pickImage}
                                        disabled={isCreating}>
                                        <Text style={styles.imageControlText}>Change</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.imageControlButton, styles.removeButton]}
                                        onPress={removeImage}
                                        disabled={isCreating}>
                                        <Text style={styles.imageControlText}>Remove</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.uploadContent}>
                                <View style={{ paddingTop: 10 }} />
                                <TouchableOpacity
                                    onPress={pickImage}
                                    style={styles.uploadImageButton}
                                    disabled={isCreating}>
                                    <LinearGradient
                                        colors={['#32D4DE', '#B591FF']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.uploadButtonGradient}
                                    >
                                        <Text style={styles.uploadButtonText}>Upload Image</Text>
                                    </LinearGradient>
                                </TouchableOpacity>

                                <Text style={styles.orText}>OR</Text>

                                <View style={styles.urlInputContainer}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter image URL (https://... or ipfs://...)"
                                        placeholderTextColor={COLORS.greyDark}
                                        value={tokenLogo}
                                        onChangeText={setTokenLogo}
                                        editable={!isCreating}
                                        keyboardAppearance="dark"
                                    />
                                    <TouchableOpacity
                                        onPress={setImageFromUrl}
                                        style={[styles.urlButton, !tokenLogo && styles.disabledButton]}
                                        disabled={isCreating || !tokenLogo}>
                                        <Text style={styles.urlButtonText}>Use URL</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.helperText}>
                                    Upload a square image (recommended 512x512px)
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Social media section */}
                <TouchableOpacity
                    style={styles.socialsToggleButton}
                    onPress={() => setShowSocials(!showSocials)}
                    disabled={isCreating}>
                    <Text style={styles.socialsToggleText}>
                        {showSocials ? 'Hide Social Links' : 'Add Social Links'} {showSocials ? '↑' : '↓'}
                    </Text>
                </TouchableOpacity>

                {showSocials && (
                    <View style={styles.socialsContainer}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Twitter (Optional)</Text>
                            <TextInput
                                style={styles.input}
                                value={tokenTwitter}
                                onChangeText={setTokenTwitter}
                                placeholder="@username"
                                placeholderTextColor={COLORS.greyDark}
                                editable={!isCreating}
                                keyboardAppearance="dark"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Telegram (Optional)</Text>
                            <TextInput
                                style={styles.input}
                                value={tokenTelegram}
                                onChangeText={setTokenTelegram}
                                placeholder="t.me/community"
                                placeholderTextColor={COLORS.greyDark}
                                editable={!isCreating}
                                keyboardAppearance="dark"
                            />
                        </View>
                    </View>
                )}

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Total Supply</Text>
                    <TextInput
                        style={styles.input}
                        value={tokenSupply}
                        onChangeText={setTokenSupply}
                        placeholder="e.g. 1000000000"
                        placeholderTextColor={COLORS.greyDark}
                        keyboardType="numeric"
                        keyboardAppearance="dark"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Decimals (6-9)</Text>
                    <TextInput
                        style={styles.input}
                        value={tokenDecimals}
                        onChangeText={setTokenDecimals}
                        placeholder="e.g. 9"
                        placeholderTextColor={COLORS.greyDark}
                        keyboardType="numeric"
                        maxLength={1}
                        keyboardAppearance="dark"
                    />
                </View>

                {/* <View style={styles.switchContainer}>
                    <Text style={styles.label}>Use Token-2022 Standard</Text>
                    <Switch
                        value={isToken2022}
                        onValueChange={setIsToken2022}
                        trackColor={{ false: COLORS.greyDark, true: COLORS.brandPrimary }}
                        thumbColor={isToken2022 ? COLORS.white : COLORS.greyLight}
                    />
                </View> */}

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity style={styles.actionButton} onPress={handleNext}>
                    <LinearGradient
                        colors={['#32D4DE', '#B591FF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.actionButtonGradient}
                    >
                        <Text style={styles.actionButtonText}>Next</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        );
    };

    const renderStep2 = () => {
        return (
            <View>
                <Text style={styles.sectionTitle}>Bonding Curve Configuration</Text>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Initial Market Cap (SOL)</Text>
                    <TextInput
                        style={styles.input}
                        value={initialMarketCap}
                        onChangeText={setInitialMarketCap}
                        placeholder="e.g. 100"
                        placeholderTextColor={COLORS.greyDark}
                        keyboardType="numeric"
                        keyboardAppearance="dark"
                    />
                    <Text style={styles.helperText}>Starting market cap for your token.</Text>
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Migration Market Cap (SOL)</Text>
                    <TextInput
                        style={styles.input}
                        value={migrationMarketCap}
                        onChangeText={setMigrationMarketCap}
                        placeholder="e.g. 3000"
                        placeholderTextColor={COLORS.greyDark}
                        keyboardType="numeric"
                        keyboardAppearance="dark"
                    />
                    <Text style={styles.helperText}>When reached, token graduates to DAMM V1.</Text>
                </View>

                {/* Buy on create option */}
                <View style={styles.switchContainer}>
                    <Text style={styles.label}>Buy tokens after creation</Text>
                    <Switch
                        value={buyOnCreate}
                        onValueChange={setBuyOnCreate}
                        trackColor={{ false: COLORS.greyDark, true: COLORS.brandPrimary }}
                        thumbColor={buyOnCreate ? COLORS.white : COLORS.greyLight}
                    />
                </View>

                {/* Buy amount input (only shown when toggle is on) */}
                {buyOnCreate && (
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Amount to buy (SOL)</Text>
                        <TextInput
                            style={styles.input}
                            value={buyAmount}
                            onChangeText={setBuyAmount}
                            placeholder="e.g. 1"
                            placeholderTextColor={COLORS.greyDark}
                            keyboardType="numeric"
                            keyboardAppearance="dark"
                        />
                        <Text style={styles.helperText}>Amount of SOL to spend buying your token after creation.</Text>
                    </View>
                )}

                {/* Add the bonding curve visualizer */}
                <BondingCurveVisualizer
                    initialMarketCap={parsedInitialMarketCap}
                    migrationMarketCap={parsedMigrationMarketCap}
                    tokenSupply={parsedTokenSupply}
                    baseFeeBps={Number(baseFeeBps)}
                    dynamicFeeEnabled={dynamicFeeEnabled}
                    collectFeeBoth={collectFeeBoth}
                    migrationFeeOption={selectedMigrationFee}
                />

                <TouchableOpacity
                    style={styles.advancedToggle}
                    onPress={() => setShowAdvanced(!showAdvanced)}
                >
                    <Text style={styles.advancedToggleText}>
                        {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
                    </Text>
                </TouchableOpacity>

                {showAdvanced && (
                    <View style={styles.advancedContainer}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Base Fee (BPS)</Text>
                            <TextInput
                                style={styles.input}
                                value={baseFeeBps}
                                onChangeText={setBaseFeeBps}
                                placeholder="e.g. 100 (1%)"
                                placeholderTextColor={COLORS.greyDark}
                                keyboardType="numeric"
                                maxLength={4}
                                keyboardAppearance="dark"
                            />
                            <Text style={styles.helperText}>100 BPS = 1% trading fee</Text>
                        </View>

                        <View style={styles.switchContainer}>
                            <Text style={styles.label}>Enable Dynamic Fee</Text>
                            <Switch
                                value={dynamicFeeEnabled}
                                onValueChange={setDynamicFeeEnabled}
                                trackColor={{ false: COLORS.greyDark, true: COLORS.brandPrimary }}
                                thumbColor={dynamicFeeEnabled ? COLORS.white : COLORS.greyLight}
                            />
                        </View>

                        <View style={styles.switchContainer}>
                            <Text style={styles.label}>Collect Fee in Both Tokens</Text>
                            <Switch
                                value={collectFeeBoth}
                                onValueChange={setCollectFeeBoth}
                                trackColor={{ false: COLORS.greyDark, true: COLORS.brandPrimary }}
                                thumbColor={collectFeeBoth ? COLORS.white : COLORS.greyLight}
                            />
                        </View>

                        <Text style={styles.label}>Migration Fee Option</Text>
                        <View style={styles.feeTiersContainer}>
                            {[
                                { label: '0.25%', value: MigrationFeeOption.FixedBps25 },
                                { label: '0.3%', value: MigrationFeeOption.FixedBps30 },
                                { label: '1%', value: MigrationFeeOption.FixedBps100 },
                                { label: '2%', value: MigrationFeeOption.FixedBps200 },
                                { label: '4%', value: MigrationFeeOption.FixedBps400 },
                                { label: '6%', value: MigrationFeeOption.FixedBps600 },
                            ].map((fee) => (
                                <TouchableOpacity
                                    key={`fee-${fee.value}`}
                                    style={[
                                        styles.feeTierButton,
                                        selectedMigrationFee === fee.value && styles.feeTierButtonSelected,
                                    ]}
                                    onPress={() => setSelectedMigrationFee(fee.value)}
                                >
                                    <Text
                                        style={[
                                            styles.feeTierText,
                                            selectedMigrationFee === fee.value && styles.feeTierTextSelected,
                                        ]}
                                    >
                                        {fee.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>LP Distribution</Text>
                        <Text style={styles.helperText}>Total must add up to 100%</Text>
                        <View style={styles.lpDistributionContainer}>
                            <View style={styles.lpInputGroup}>
                                <Text style={styles.lpLabel}>Partner</Text>
                                <TextInput
                                    style={styles.lpInput}
                                    value={partnerLpPercentage}
                                    onChangeText={setPartnerLpPercentage}
                                    keyboardType="numeric"
                                    maxLength={3}
                                    keyboardAppearance="dark"
                                />
                                <Text style={styles.lpPercent}>%</Text>
                            </View>

                            <View style={styles.lpInputGroup}>
                                <Text style={styles.lpLabel}>Creator</Text>
                                <TextInput
                                    style={styles.lpInput}
                                    value={creatorLpPercentage}
                                    onChangeText={setCreatorLpPercentage}
                                    keyboardType="numeric"
                                    maxLength={3}
                                    keyboardAppearance="dark"
                                />
                                <Text style={styles.lpPercent}>%</Text>
                            </View>

                            <View style={styles.lpInputGroup}>
                                <Text style={styles.lpLabel}>Partner Locked</Text>
                                <TextInput
                                    style={styles.lpInput}
                                    value={partnerLockedLpPercentage}
                                    onChangeText={setPartnerLockedLpPercentage}
                                    keyboardType="numeric"
                                    maxLength={3}
                                    keyboardAppearance="dark"
                                />
                                <Text style={styles.lpPercent}>%</Text>
                            </View>

                            <View style={styles.lpInputGroup}>
                                <Text style={styles.lpLabel}>Creator Locked</Text>
                                <TextInput
                                    style={styles.lpInput}
                                    value={creatorLockedLpPercentage}
                                    onChangeText={setCreatorLockedLpPercentage}
                                    keyboardType="numeric"
                                    maxLength={3}
                                    keyboardAppearance="dark"
                                />
                                <Text style={styles.lpPercent}>%</Text>
                            </View>
                        </View>
                    </View>
                )}

                {isCreating && statusMessage ? (
                    <View style={styles.statusContainer}>
                        <Text style={styles.statusText}>{statusMessage}</Text>
                    </View>
                ) : null}

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <View style={styles.buttonRow}>
                    <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                        <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>
                    <View style={{ width: 12 }} />
                    <TouchableOpacity
                        style={[styles.actionButton, styles.createButton]}
                        onPress={handleCreateToken}
                        disabled={isCreating}
                    >
                        <LinearGradient
                            colors={['#32D4DE', '#B591FF']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.actionButtonGradient}
                        >
                            {isCreating ? (
                                <ActivityIndicator color={COLORS.white} />
                            ) : (
                                <Text style={styles.actionButtonText}>
                                    {buyOnCreate ? 'Create & Buy Tokens' : 'Create Token'}
                                </Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
                <Text style={styles.title}>Create Token with Bonding Curve</Text>

                <View style={styles.stepIndicator}>
                    <View style={[styles.step, step >= 1 && styles.stepActive]}>
                        <Text style={[styles.stepText, step >= 1 && styles.stepTextActive]}>1</Text>
                    </View>
                    <View style={styles.stepConnector} />
                    <View style={[styles.step, step >= 2 && styles.stepActive]}>
                        <Text style={[styles.stepText, step >= 2 && styles.stepTextActive]}>2</Text>
                    </View>
                </View>

                {step === 1 ? renderStep1() : renderStep2()}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    card: {
        backgroundColor: COLORS.background,
        borderRadius: 16,
        padding: 10,
        margin: 16,
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
    stepIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    step: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.darkerBackground,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    stepActive: {
        backgroundColor: COLORS.brandPrimary,
        borderColor: COLORS.brandPrimary,
    },
    stepConnector: {
        width: 30,
        height: 2,
        backgroundColor: COLORS.borderDarkColor,
        marginHorizontal: 8,
    },
    stepText: {
        color: COLORS.greyDark,
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.weights.semiBold,
    },
    stepTextActive: {
        color: COLORS.white,
    },
    sectionTitle: {
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.white,
        marginBottom: 16,
    },
    inputContainer: {
        marginBottom: 16,
    },
    label: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.greyMid,
        marginBottom: 8,
    },
    input: {
        backgroundColor: COLORS.darkerBackground,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.md,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    helperText: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyDark,
        marginTop: 4,
    },
    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    errorText: {
        color: COLORS.errorRed,
        fontSize: TYPOGRAPHY.size.sm,
        marginVertical: 8,
    },
    statusContainer: {
        backgroundColor: COLORS.darkerBackground,
        padding: 12,
        borderRadius: 8,
        marginVertical: 12,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.brandPrimary,
    },
    statusText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.sm,
    },
    actionButton: {
        overflow: 'hidden',
        borderRadius: 12,
    },
    actionButtonGradient: {
        paddingVertical: 14,
        alignItems: 'center',
        borderRadius: 12,
    },
    actionButtonText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.weights.semiBold,
    },
    advancedToggle: {
        alignItems: 'center',
        marginBottom: 16,
    },
    advancedToggleText: {
        color: COLORS.brandPrimary,
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.weights.medium,
    },
    advancedContainer: {
        marginTop: 8,
    },
    feeTiersContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginVertical: 8,
    },
    feeTierButton: {
        backgroundColor: COLORS.darkerBackground,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    feeTierButtonSelected: {
        backgroundColor: COLORS.brandPrimary,
        borderColor: COLORS.brandPrimary,
    },
    feeTierText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.sm,
    },
    feeTierTextSelected: {
        fontWeight: TYPOGRAPHY.weights.semiBold,
    },
    lpDistributionContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginVertical: 8,
    },
    lpInputGroup: {
        width: '50%',
        paddingRight: 8,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    lpLabel: {
        width: '40%',
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyMid,
    },
    lpInput: {
        flex: 1,
        backgroundColor: COLORS.darkerBackground,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 6,
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.sm,
        textAlign: 'center',
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    lpPercent: {
        marginLeft: 4,
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyMid,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        paddingHorizontal: 16,
    },
    backButton: {
        padding: 0,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        backgroundColor: 'transparent',
    },
    backButtonText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.weights.medium,
    },
    createButton: {
        flex: 1,
        height: 50,
        borderRadius: 12,
        overflow: 'hidden',
    },
    imageUploadContainer: {
        backgroundColor: COLORS.lighterBackground,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
        borderStyle: 'dashed',
        height: 230,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadContent: {
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        padding: 20,
    },
    imagePreviewContainer: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    imageUrlPreview: {
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.darkerBackground,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    imageUrlText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.sm,
        fontFamily: TYPOGRAPHY.fontFamily,
        textAlign: 'center',
    },
    imageControlsContainer: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        flexDirection: 'row',
    },
    imageControlButton: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 4,
        marginLeft: 8,
    },
    removeButton: {
        backgroundColor: 'rgba(220,53,69,0.8)', // Red color with transparency
    },
    imageControlText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.xs,
        fontFamily: TYPOGRAPHY.fontFamily,
    },
    selectFileButton: {
        backgroundColor: COLORS.background,
        paddingVertical: 8,
        paddingHorizontal: 24,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
        marginBottom: 12,
    },
    selectFileText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.sm,
        fontFamily: TYPOGRAPHY.fontFamily,
    },
    orText: {
        color: COLORS.greyMid,
        fontSize: TYPOGRAPHY.size.sm,
        textAlign: 'center',
        marginVertical: 8,
        fontFamily: TYPOGRAPHY.fontFamily,
    },
    urlButton: {
        backgroundColor: COLORS.brandPrimary,
        paddingVertical: 8,
        paddingHorizontal: 24,
        borderRadius: 4,
        marginTop: 8,
        alignSelf: 'center',
    },
    urlButtonText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.sm,
        fontFamily: TYPOGRAPHY.fontFamily,
    },
    socialsToggleButton: {
        paddingVertical: 12,
        marginBottom: 8,
    },
    socialsToggleText: {
        color: COLORS.brandPrimary,
        fontSize: TYPOGRAPHY.size.md,
        fontFamily: TYPOGRAPHY.fontFamily,
    },
    socialsContainer: {
        marginBottom: 16,
    },
    uploadImageButton: {
        overflow: 'hidden',
        borderRadius: 8,
        marginBottom: 16,
    },
    uploadButtonGradient: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    uploadButtonText: {
        color: COLORS.white,
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        fontFamily: TYPOGRAPHY.fontFamily,
    },
    urlInputContainer: {
        width: '100%',
        marginBottom: 12,
    },
    disabledButton: {
        opacity: 0.5,
    },
});