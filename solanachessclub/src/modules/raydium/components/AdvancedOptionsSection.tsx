import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text as RNText,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
  TextInput as RNTextInput,
  Switch,
  Alert,
} from 'react-native';
import { TextInput } from 'react-native-gesture-handler';
import { Feather, Ionicons } from '@expo/vector-icons';

import Svg, {
  Path,
  Line,
  Circle,
  Text,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import { LaunchpadConfigData } from '../services/raydiumService';
import { styles, modalStyles } from './AdvancedOptionsSection.styles';
import {
  calculateGraphData,
  validateBondingCurvePercentage,
  validateVestingPercentage,
  validateSolRaised,
  calculatePoolMigrationPercentage,
  TOKEN_SUPPLY_OPTIONS,
  SAMPLE_TOKENS,
  TokenInfo,
  truncateAddress,
  VestingTimeUnit,
  TIME_UNIT_OPTIONS,
  formatNumber,
} from '../utils/AdvancedOptionsSectionUtils';

interface AdvancedOptionsSectionProps {
  containerStyle?: any;
  onBack?: () => void;
  onCreateToken?: (configData: LaunchpadConfigData) => void;
  isLoading?: boolean;
  tokenName?: string;
  tokenSymbol?: string;
}

export const AdvancedOptionsSection: React.FC<AdvancedOptionsSectionProps> = ({
  containerStyle,
  onBack,
  onCreateToken,
  isLoading = false,
  tokenName,
  tokenSymbol,
}) => {
  const [quoteToken, setQuoteToken] = useState<TokenInfo>(SAMPLE_TOKENS[0]);
  const [tokenSupply, setTokenSupply] = useState('1,000,000,000');
  const [solRaised, setSolRaised] = useState('85');
  const [bondingCurve, setBondingCurve] = useState('80'); // Default to maximum on bonding curve
  const [poolMigration, setPoolMigration] = useState('20'); // Calculated (100 - bondingCurve - vestingPercentage)
  const [vestingPercentage, setVestingPercentage] = useState('0'); // Default to no vesting
  const [showTokenSupplyOptions, setShowTokenSupplyOptions] = useState(false);
  const [enableFeeSharingPost, setEnableFeeSharingPost] = useState(false);
  const [slippageBps, setSlippageBps] = useState('100'); // Default to 1% slippage

  // Token selection modal state
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Vesting options
  const [vestingEnabled, setVestingEnabled] = useState(false);
  const [vestingDuration, setVestingDuration] = useState('6'); // Duration value
  const [vestingCliff, setVestingCliff] = useState('1'); // Cliff value
  const [vestingTimeUnit, setVestingTimeUnit] = useState<VestingTimeUnit>(VestingTimeUnit.MONTH); // Default to months
  const [showTimeUnitOptions, setShowTimeUnitOptions] = useState(false);

  // Fee configuration
  const [shareFeeRate, setShareFeeRate] = useState('10000'); // Default as per Raydium docs

  // Validation error messages
  const [bondingCurveError, setBondingCurveError] = useState<string | null>(null);
  const [vestingPercentageError, setVestingPercentageError] = useState<string | null>(null);
  const [solRaisedError, setSolRaisedError] = useState<string | null>(null);

  // Migration type
  const [migrateType, setMigrateType] = useState<'amm' | 'cpmm'>('amm');

  // Update pool migration when bonding curve or vesting percentage changes
  useEffect(() => {
    const migration = calculatePoolMigrationPercentage(bondingCurve, vestingEnabled ? vestingPercentage : '0');
    setPoolMigration(migration);
  }, [bondingCurve, vestingPercentage, vestingEnabled]);

  // Update migration type when fee sharing is toggled
  useEffect(() => {
    setMigrateType(enableFeeSharingPost ? 'cpmm' : 'amm');
  }, [enableFeeSharingPost]);

  // Input change handlers with validation
  const handleSolRaisedChange = (value: string) => {
    const result = validateSolRaised(value);
    setSolRaised(result.value);
    setSolRaisedError(result.valid ? null : result.message);
  };

  const handleBondingCurveChange = (value: string) => {
    // Allow any input to be entered first - just filter to numbers only
    const filtered = value.replace(/[^0-9]/g, '');
    setBondingCurve(filtered);

    // Only show validation errors if the field is not empty
    if (filtered) {
      const num = parseInt(filtered, 10);

      // Apply constraints in real-time
      if (num < 51) {
        setBondingCurveError('Bonding curve percentage must be at least 51%');
      } else if (num > 80) {
        setBondingCurveError('Bonding curve percentage cannot exceed 80%');
        setBondingCurve('80'); // Hard limit at 80
      } else {
        setBondingCurveError(null);
      }
    } else {
      // Clear error when field is empty
      setBondingCurveError(null);
    }

    // Validate vesting percentage when bonding curve changes to ensure total doesn't exceed 80%
    if (vestingEnabled && filtered) {
      const validValue = filtered ? Math.max(51, Math.min(80, parseInt(filtered, 10))) : 51;
      const vestingResult = validateVestingPercentage(vestingPercentage, String(validValue));

      if (!vestingResult.valid) {
        setVestingPercentage(vestingResult.value);
        setVestingPercentageError(vestingResult.message);
      }
    }
  };

  // Function to validate the bonding curve when focus is lost (complete editing)
  const handleBondingCurveBlur = () => {
    // If empty or less than min, set to minimum value
    if (!bondingCurve || parseInt(bondingCurve, 10) < 51) {
      setBondingCurve('51');
      setBondingCurveError(null);
    }
  };

  const handleVestingPercentageChange = (value: string) => {
    // Only allow numeric input
    const filtered = value.replace(/[^0-9]/g, '');

    if (filtered) {
      const num = parseInt(filtered, 10);

      // Apply max limit of 30%
      if (num > 30) {
        setVestingPercentage('30');
        setVestingPercentageError('Vesting percentage cannot exceed 30%');
        return;
      }

      // Validate against bonding curve to ensure total doesn't exceed 80%
      const result = validateVestingPercentage(filtered, bondingCurve);
      setVestingPercentage(result.value);
      setVestingPercentageError(result.valid ? null : result.message);
    } else {
      setVestingPercentage('0');
      setVestingPercentageError(null);
    }
  };

  const handleTokenSupplyChange = (value: string) => {
    // Allow numbers and commas
    const filtered = value.replace(/[^0-9,]/g, '');
    setTokenSupply(filtered);
  };

  // Handle vesting toggle
  const handleVestingToggle = (value: boolean) => {
    setVestingEnabled(value);

    // If disabling vesting, clear vesting percentage
    if (!value) {
      setVestingPercentage('0');
      setVestingPercentageError(null);
    }
  };

  // Select time unit
  const selectTimeUnit = (unit: VestingTimeUnit) => {
    setVestingTimeUnit(unit);
    setShowTimeUnitOptions(false);
  };

  // Graph Calculation Logic - useMemo for performance
  const graphData = useMemo(() => {
    return calculateGraphData(tokenSupply, solRaised, bondingCurve);
  }, [tokenSupply, solRaised, bondingCurve]); // Dependencies

  // Calculate token amounts based on percentages
  const tokenAmounts = useMemo(() => {
    const supply = parseInt(tokenSupply.replace(/,/g, ''), 10) || 0;
    const bondingAmount = supply * (parseInt(bondingCurve, 10) || 0) / 100;
    const vestingAmount = supply * (parseInt(vestingPercentage, 10) || 0) / 100;
    const migrationAmount = supply * (parseInt(poolMigration, 10) || 0) / 100;

    return {
      bondingAmount: formatNumber(bondingAmount),
      vestingAmount: formatNumber(vestingAmount),
      migrationAmount: formatNumber(migrationAmount)
    };
  }, [tokenSupply, bondingCurve, vestingPercentage, poolMigration]);

  const handleCreateToken = () => {
    if (onCreateToken) {
      // Validate all fields
      const bondingCurveResult = validateBondingCurvePercentage(bondingCurve);
      const solRaisedResult = validateSolRaised(solRaised);
      const vestingResult = validateVestingPercentage(
        vestingEnabled ? vestingPercentage : '0',
        bondingCurve
      );

      if (!bondingCurveResult.valid) {
        Alert.alert('Error', bondingCurveResult.message || 'Invalid bonding curve percentage');
        return;
      }

      if (!solRaisedResult.valid) {
        Alert.alert('Error', solRaisedResult.message || 'Invalid SOL raised amount');
        return;
      }

      if (vestingEnabled && !vestingResult.valid) {
        Alert.alert('Error', vestingResult.message || 'Invalid vesting percentage');
        return;
      }

      // Create the config data object from state
      const configData: LaunchpadConfigData = {
        quoteTokenMint: quoteToken.address,
        tokenSupply: tokenSupply.replace(/,/g, ''),
        solRaised: solRaised,
        bondingCurvePercentage: bondingCurve,
        poolMigration: poolMigration,
        vestingPercentage: vestingEnabled ? vestingPercentage : '0',
        vestingDuration: vestingEnabled ? vestingDuration : '0',
        vestingCliff: vestingEnabled && vestingCliff ? vestingCliff : '0',
        vestingTimeUnit: vestingTimeUnit,
        enableFeeSharingPost: enableFeeSharingPost,
        migrateType: migrateType,
        shareFeeRate: parseInt(shareFeeRate),
        slippageBps: parseInt(slippageBps),
        mode: 'launchLab', // Set mode to launchLab for advanced options
      };

      onCreateToken(configData);
    }
  };

  const selectTokenSupply = (supply: string) => {
    setTokenSupply(supply);
    setShowTokenSupplyOptions(false);
  };

  const handleTokenSelected = (token: TokenInfo) => {
    setQuoteToken(token);
    setShowTokenModal(false);
  };

  // Filter tokens based on search input
  const filteredTokens = useMemo(() => {
    if (!searchInput.trim()) return SAMPLE_TOKENS;
    return SAMPLE_TOKENS.filter(
      t =>
        t.symbol.toLowerCase().includes(searchInput.toLowerCase()) ||
        t.name.toLowerCase().includes(searchInput.toLowerCase()) ||
        t.address.toLowerCase().includes(searchInput.toLowerCase()),
    );
  }, [searchInput]);

  // Get currently selected time unit label
  const selectedTimeUnitLabel = useMemo(() => {
    const option = TIME_UNIT_OPTIONS.find(opt => opt.value === vestingTimeUnit);
    return option ? option.label : 'Months';
  }, [vestingTimeUnit]);

  return (
    <ScrollView style={[styles.container, containerStyle]}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={COLORS.white} />
          </TouchableOpacity>
        )}
        <RNText style={styles.headerTitle}>
          {tokenName && tokenSymbol
            ? `Configure ${tokenName} ($${tokenSymbol})`
            : 'Advanced Options'}
        </RNText>
      </View>

      {/* Curve Preview */}
      <View style={styles.sectionContainer}>
        <RNText style={styles.sectionTitle}>Curve Preview</RNText>
        <View style={styles.graphContainer}>
          {/* Dynamic SVG Graph */}
          <Svg
            height={graphData.height}
            width={graphData.width}
            viewBox={`0 0 ${graphData.width} ${graphData.height}`}>
            <Defs>
              <LinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0%"
                  stopColor={COLORS.brandPurple}
                  stopOpacity="0.4"
                />
                <Stop
                  offset="100%"
                  stopColor={COLORS.brandPurple}
                  stopOpacity="0.05"
                />
              </LinearGradient>
            </Defs>

            {/* Grid Lines (Subtle) */}
            {graphData.xTicks.map(
              (tick, i) =>
                i > 0 &&
                i < 4 && (
                  <Line
                    key={`vx-${i}`}
                    x1={tick.x}
                    y1={graphData.margin.top}
                    x2={tick.x}
                    y2={graphData.height - graphData.margin.bottom}
                    stroke={COLORS.borderDarkColor} // Very subtle grid
                    strokeWidth="0.5"
                    strokeDasharray="2 3"
                  />
                ),
            )}
            {graphData.yTicks.map(
              (tick, i) =>
                i > 0 &&
                i < 4 && (
                  <Line
                    key={`hy-${i}`}
                    x1={graphData.margin.left}
                    y1={tick.y}
                    x2={graphData.width - graphData.margin.right}
                    y2={tick.y}
                    stroke={COLORS.borderDarkColor} // Very subtle grid
                    strokeWidth="0.5"
                    strokeDasharray="2 3"
                  />
                ),
            )}

            {/* Area Fill Path */}
            <Path d={graphData.areaPath} fill="url(#areaGradient)" />

            {/* Curve Line Path */}
            <Path
              d={graphData.linePath}
              fill="none"
              stroke={COLORS.brandPurple} // Use brand purple
              strokeWidth="2"
            />

            {/* Start and End Point Markers - Use .cx and .cy */}
            <Circle
              cx={graphData.startPoint.cx}
              cy={graphData.startPoint.cy}
              r="4"
              fill="#FFFFFF"
              stroke={COLORS.brandPurple}
              strokeWidth="1"
            />
            <Circle
              cx={graphData.endPoint.cx}
              cy={graphData.endPoint.cy}
              r="4"
              fill="#22D1F8"
              stroke={COLORS.brandPurple}
              strokeWidth="1"
            />

            {/* Axis Tick Labels */}
            {graphData.xTicks.map((tick, i) => (
              <Text
                key={`xLabel-${i}`}
                x={tick.x}
                y={tick.y}
                fill={COLORS.greyMid}
                fontSize="10"
                fontFamily={TYPOGRAPHY.fontFamily}
                textAnchor="middle">
                {tick.value}
              </Text>
            ))}
            {graphData.yTicks.map((tick, i) => (
              <Text
                key={`yLabel-${i}`}
                x={tick.x}
                y={tick.y}
                fill={COLORS.greyMid}
                fontSize="10"
                fontFamily={TYPOGRAPHY.fontFamily}
                textAnchor={tick.textAnchor as any}
                alignmentBaseline="middle">
                {tick.value}
              </Text>
            ))}
          </Svg>
        </View>

        {/* Graph legend */}
        <View style={styles.graphLegendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: 'white' }]} />
            <RNText style={styles.legendText}>Starting MC</RNText>
            <RNText style={styles.legendValue}>$100.00</RNText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#22D1F8' }]} />
            <RNText style={styles.legendText}>Migration MC</RNText>
            <RNText style={styles.legendValue}>$100,000.00</RNText>
          </View>
        </View>
      </View>

      {/* Quote Token Selection */}
      <View style={styles.formField}>
        <RNText style={styles.fieldLabel}>Quote Token</RNText>
        <TouchableOpacity
          style={styles.dropdownContainer}
          onPress={() => setShowTokenModal(true)}
          disabled={isLoading}>
          <View style={styles.tokenSelectRow}>
            {quoteToken.logoURI ? (
              <Image
                source={{ uri: quoteToken.logoURI }}
                style={styles.tokenIcon}
              />
            ) : (
              <View
                style={[
                  styles.tokenIcon,
                  {
                    backgroundColor: COLORS.lighterBackground,
                    justifyContent: 'center',
                    alignItems: 'center',
                  },
                ]}>
                <RNText
                  style={{
                    color: COLORS.white,
                    fontWeight: 'bold',
                    fontSize: 10,
                  }}>
                  {quoteToken.symbol?.charAt(0) || '?'}
                </RNText>
              </View>
            )}
            <View style={styles.tokenInfo}>
              <RNText style={styles.tokenName}>{quoteToken.symbol}</RNText>
              <RNText style={styles.tokenAddress}>
                {truncateAddress(quoteToken.address)}
              </RNText>
            </View>
            <Feather name="chevron-down" size={20} color={COLORS.white} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Token Supply */}
      <View style={styles.formField}>
        <RNText style={styles.fieldLabel}>Token Supply</RNText>
        <View style={styles.dropdownInputContainer}>
          <View style={styles.tokenIconSmallContainer}>
            {quoteToken.logoURI ? (
              <Image
                source={{ uri: quoteToken.logoURI }}
                style={styles.tokenIconSmall}
              />
            ) : (
              <View
                style={[
                  styles.tokenIconSmall,
                  {
                    backgroundColor: COLORS.lighterBackground,
                    justifyContent: 'center',
                    alignItems: 'center',
                  },
                ]}>
                <RNText
                  style={{
                    color: COLORS.white,
                    fontWeight: 'bold',
                    fontSize: 8,
                  }}>
                  {quoteToken.symbol?.charAt(0) || '?'}
                </RNText>
              </View>
            )}
          </View>
          <TextInput
            style={styles.input}
            value={tokenSupply}
            onChangeText={handleTokenSupplyChange}
            keyboardType="numeric"
            placeholderTextColor={COLORS.greyMid}
            editable={!isLoading}
            keyboardAppearance="dark"
          />
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowTokenSupplyOptions(!showTokenSupplyOptions)}
            disabled={isLoading}>
            <Feather name="chevron-down" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {showTokenSupplyOptions && (
          <View style={styles.dropdownOptions}>
            {TOKEN_SUPPLY_OPTIONS.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={styles.dropdownOption}
                onPress={() => selectTokenSupply(option)}>
                <RNText style={styles.dropdownOptionText}>{option}</RNText>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Two column layout */}
      <View style={styles.twoColumnContainer}>
        {/* SOL Raised */}
        <View style={[styles.formField, styles.columnItem]}>
          <RNText style={styles.fieldLabel}>SOL Raised (min 30)</RNText>
          <View style={styles.inputContainer}>
            <View style={styles.tokenIconSmallContainer}>
              {SAMPLE_TOKENS[0].logoURI ? (
                <Image
                  source={{ uri: SAMPLE_TOKENS[0].logoURI }}
                  style={styles.tokenIconSmall}
                />
              ) : (
                <View
                  style={[
                    styles.tokenIconSmall,
                    {
                      backgroundColor: COLORS.lighterBackground,
                      justifyContent: 'center',
                      alignItems: 'center',
                    },
                  ]}>
                  <RNText
                    style={{
                      color: COLORS.white,
                      fontWeight: 'bold',
                      fontSize: 8,
                    }}>
                    {SAMPLE_TOKENS[0].symbol?.charAt(0) || '?'}
                  </RNText>
                </View>
              )}
            </View>
            <TextInput
              style={styles.input}
              value={solRaised}
              onChangeText={handleSolRaisedChange}
              keyboardType="numeric"
              placeholderTextColor={COLORS.greyMid}
              editable={!isLoading}
              keyboardAppearance="dark"
            />
          </View>
          {solRaisedError && (
            <RNText style={styles.errorText}>{solRaisedError}</RNText>
          )}
        </View>

        {/* Bonding Curve */}
        <View style={[styles.formField, styles.columnItem]}>
          <RNText style={styles.fieldLabel}>Bonding Curve % (51-80%)</RNText>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={bondingCurve}
              onChangeText={handleBondingCurveChange}
              onBlur={handleBondingCurveBlur}
              keyboardType="numeric"
              placeholderTextColor={COLORS.greyMid}
              editable={!isLoading}
              keyboardAppearance="dark"
            />
            <RNText style={styles.percentSign}>%</RNText>
          </View>
          {bondingCurveError && (
            <RNText style={styles.errorText}>{bondingCurveError}</RNText>
          )}
          {!bondingCurveError && (
            <RNText style={styles.tokenAmountText}>
              {tokenAmounts.bondingAmount} tokens
            </RNText>
          )}
        </View>
      </View>

      {/* Slippage Setting */}
      <View style={styles.formField}>
        <RNText style={styles.fieldLabel}>Slippage Tolerance (basis points)</RNText>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={slippageBps}
            onChangeText={setSlippageBps}
            keyboardType="numeric"
            placeholderTextColor={COLORS.greyMid}
            editable={!isLoading}
            keyboardAppearance="dark"
          />
          <RNText style={styles.bpsText}>bps</RNText>
        </View>
        <RNText style={styles.helperText}>100 bps = 1%</RNText>
      </View>

      {/* Pool Migration Display */}
      <View style={styles.formField}>
        <RNText style={styles.fieldLabel}>Pool Migration</RNText>
        <View style={styles.calculatedContainer}>
          <RNText style={styles.calculatedValue}>{poolMigration}%</RNText>
          <RNText style={styles.calculatedDescription}>
            {tokenAmounts.migrationAmount} tokens will be migrated to AMM pool
          </RNText>
        </View>
      </View>

      {/* Vesting Options */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <RNText style={styles.sectionTitle}>Vesting Options</RNText>
            <RNText style={styles.sectionSubtitle}>
              Set tokens to be locked and vested (max 30%)
            </RNText>
          </View>
          <Switch
            value={vestingEnabled}
            onValueChange={handleVestingToggle}
            trackColor={{
              false: COLORS.darkerBackground,
              true: COLORS.brandBlue,
            }}
            thumbColor={COLORS.white}
            disabled={isLoading}
          />
        </View>

        {vestingEnabled && (
          <View style={styles.vestingOptions}>
            <View style={styles.formField}>
              <RNText style={styles.fieldLabel}>Vesting Percentage (max 30%)</RNText>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={vestingPercentage}
                  onChangeText={handleVestingPercentageChange}
                  keyboardType="numeric"
                  placeholderTextColor={COLORS.greyMid}
                  editable={!isLoading}
                  keyboardAppearance="dark"
                />
                <RNText style={styles.percentSign}>%</RNText>
              </View>
              {vestingPercentageError && (
                <RNText style={styles.errorText}>{vestingPercentageError}</RNText>
              )}
              {!vestingPercentageError && parseInt(vestingPercentage, 10) > 0 && (
                <RNText style={styles.tokenAmountText}>
                  {tokenAmounts.vestingAmount} tokens
                </RNText>
              )}
            </View>

            {/* Time Unit Selection */}
            <View style={styles.formField}>
              <RNText style={styles.fieldLabel}>Time Unit</RNText>
              <TouchableOpacity
                style={styles.dropdownContainer}
                onPress={() => setShowTimeUnitOptions(!showTimeUnitOptions)}
                disabled={isLoading}>
                <RNText style={styles.dropdownText}>{selectedTimeUnitLabel}</RNText>
                <Feather name="chevron-down" size={20} color={COLORS.white} />
              </TouchableOpacity>

              {showTimeUnitOptions && (
                <View style={styles.dropdownOptions}>
                  {TIME_UNIT_OPTIONS.map((option, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.dropdownOption}
                      onPress={() => selectTimeUnit(option.value)}>
                      <RNText style={styles.dropdownOptionText}>{option.label}</RNText>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.twoColumnContainer}>
              <View style={[styles.formField, styles.columnItem]}>
                <RNText style={styles.fieldLabel}>Cliff</RNText>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={vestingCliff}
                    onChangeText={setVestingCliff}
                    keyboardType="numeric"
                    placeholderTextColor={COLORS.greyMid}
                    editable={!isLoading}
                    keyboardAppearance="dark"
                  />
                </View>
                <RNText style={styles.helperText}>
                  Period before tokens start vesting
                </RNText>
              </View>

              <View style={[styles.formField, styles.columnItem]}>
                <RNText style={styles.fieldLabel}>Duration</RNText>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={vestingDuration}
                    onChangeText={setVestingDuration}
                    keyboardType="numeric"
                    placeholderTextColor={COLORS.greyMid}
                    editable={!isLoading}
                    keyboardAppearance="dark"
                  />
                </View>
                <RNText style={styles.helperText}>
                  Total vesting period length
                </RNText>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Post-migration Fee Share */}
      <View style={styles.fixedWidthContainer}>
        <View style={styles.sectionHeader}>
          <View style={styles.feeSharingTextContainer}>
            <RNText style={styles.sectionTitle}>
              Creator LP Fee Share
            </RNText>
            <RNText style={styles.sectionDescription}>
              Claim 10% of LP trading fees after token graduates to AMM pool
            </RNText>
          </View>
          <Switch
            value={enableFeeSharingPost}
            onValueChange={setEnableFeeSharingPost}
            trackColor={{
              false: COLORS.darkerBackground,
              true: COLORS.brandBlue,
            }}
            thumbColor={COLORS.white}
            disabled={isLoading}
          />
        </View>
      </View>

      {/* Create Token Button */}
      <TouchableOpacity
        style={[styles.createButton, isLoading && styles.disabledButton]}
        onPress={handleCreateToken}
        disabled={isLoading}>
        <RNText style={styles.createButtonText}>
          {isLoading ? 'Creating Token...' : 'Create Token'}
        </RNText>
      </TouchableOpacity>

      {/* Token Selection Modal */}
      <Modal
        visible={showTokenModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTokenModal(false)}>
        <View style={modalStyles.modalOverlay}>
          <View style={modalStyles.modalContainer}>
            <View style={modalStyles.modalHeader}>
              <RNText style={modalStyles.modalTitle}>Select Token</RNText>
              <TouchableOpacity
                style={modalStyles.modalCloseButton}
                onPress={() => setShowTokenModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            <View style={modalStyles.searchContainer}>
              <Ionicons
                name="search"
                size={20}
                color={COLORS.greyMid}
                style={modalStyles.searchIcon}
              />
              <RNTextInput
                style={modalStyles.searchInput}
                placeholder="Search by name or address"
                placeholderTextColor={COLORS.greyMid}
                value={searchInput}
                onChangeText={setSearchInput}
                autoCapitalize="none"
                returnKeyType="search"
              />
            </View>

            {loading ? (
              <View style={modalStyles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.brandBlue} />
                <RNText style={modalStyles.loadingText}>
                  Loading tokens...
                </RNText>
              </View>
            ) : (
              <FlatList
                data={filteredTokens}
                keyExtractor={item => item.address}
                contentContainerStyle={modalStyles.listContentContainer}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={modalStyles.tokenItem}
                    onPress={() => handleTokenSelected(item)}>
                    <View style={modalStyles.tokenItemContent}>
                      {item.logoURI ? (
                        <Image
                          source={{ uri: item.logoURI }}
                          style={modalStyles.tokenLogo}
                        />
                      ) : (
                        <View
                          style={[
                            modalStyles.tokenLogo,
                            { justifyContent: 'center', alignItems: 'center' },
                          ]}>
                          <RNText
                            style={{ color: COLORS.white, fontWeight: 'bold' }}>
                            {item.symbol.charAt(0)}
                          </RNText>
                        </View>
                      )}
                      <View style={modalStyles.tokenTextContainer}>
                        <RNText style={modalStyles.tokenSymbol}>
                          {item.symbol}
                        </RNText>
                        <RNText style={modalStyles.tokenName}>
                          {item.name}
                        </RNText>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={modalStyles.emptyContainer}>
                    <RNText style={modalStyles.emptyText}>
                      No tokens found matching your search.
                    </RNText>
                  </View>
                }
              />
            )}

            <TouchableOpacity
              style={modalStyles.closeButton}
              onPress={() => setShowTokenModal(false)}>
              <RNText style={modalStyles.closeButtonText}>Cancel</RNText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

