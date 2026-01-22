import React, { useState } from 'react';
import {
  View,
  Text as RNText,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  TextInput as RNTextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '@/assets/colors';
import { modalStyles } from '../components/AdvancedOptionsSection.styles';
import { LaunchpadConfigData as ServiceLaunchpadConfigData } from '../services/raydiumService';

// Helper Functions
export function parseNumericString(value: string): number {
  if (!value) return 0;
  // Remove commas and handle potential non-numeric characters gracefully
  const cleanedValue = value.replace(/,/g, '');
  const number = parseFloat(cleanedValue);
  return isNaN(number) ? 0 : number;
}

export function formatNumber(num: number): string {
  if (isNaN(num) || num === 0) return '0';
  if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';

  // Improved small number formatting to handle very small values
  if (num < 0.0001) return num.toExponential(2); // Use scientific notation for very small numbers
  if (num < 0.001) return num.toFixed(6);
  if (num < 0.01) return num.toFixed(5);
  if (num < 0.1) return num.toFixed(4);
  if (Math.abs(num) < 1) return num.toFixed(4);
  if (Math.abs(num) < 100) return num.toFixed(2);
  return String(Math.round(num));
}

// Address truncation helper
export function truncateAddress(
  address: string,
  startChars: number = 6,
  endChars: number = 4,
): string {
  if (!address) return '';
  if (address.length <= startChars + endChars) return address;
  return `${address.substring(0, startChars)}...${address.substring(
    address.length - endChars,
  )}`;
}

// Validation functions
export function validateBondingCurvePercentage(value: string): {
  valid: boolean;
  message: string | null;
  value: string;
} {
  // Remove non-numeric characters
  const filtered = value.replace(/[^0-9]/g, '');
  const number = parseInt(filtered, 10);

  if (isNaN(number)) {
    return { valid: false, message: 'Must be a number', value: '51' };
  }

  // Per Raydium docs: min 51% and max 80%
  if (number < 51) {
    return {
      valid: false,
      message: 'Bonding curve percentage must be at least 51%',
      value: '51'
    };
  } else if (number > 80) {
    return {
      valid: false,
      message: 'Bonding curve percentage cannot exceed 80%',
      value: '80'
    };
  }

  return { valid: true, message: null, value: filtered };
}

export function validateVestingPercentage(value: string, bondingCurvePercentage: string): {
  valid: boolean;
  message: string | null;
  value: string;
} {
  // Remove non-numeric characters
  const filtered = value.replace(/[^0-9]/g, '');
  const vestingPercent = parseInt(filtered, 10);
  const bondingPercent = parseInt(bondingCurvePercentage, 10);

  if (isNaN(vestingPercent)) {
    return { valid: false, message: 'Must be a number', value: '0' };
  }

  // Maximum vesting is 30%
  if (vestingPercent > 30) {
    return {
      valid: false,
      message: 'Vesting percentage cannot exceed 30%',
      value: '30'
    };
  }

  // Ensure vesting + bonding curve doesn't exceed 80%
  if (vestingPercent + bondingPercent > 80) {
    const maxPossible = Math.max(0, 80 - bondingPercent);
    return {
      valid: false,
      message: `Total of tokens sold + tokens locked cannot exceed 80%. Max vesting possible: ${maxPossible}%`,
      value: String(maxPossible)
    };
  }

  return { valid: true, message: null, value: filtered };
}

export function calculatePoolMigrationPercentage(bondingCurvePercentage: string, vestingPercentage: string): string {
  const bondingPercent = parseInt(bondingCurvePercentage, 10) || 0;
  const vestingPercent = parseInt(vestingPercentage, 10) || 0;

  // Calculate remaining percentage for pool migration
  const migrationPercent = 100 - bondingPercent - vestingPercent;

  return String(Math.max(0, migrationPercent));
}

export function validateSolRaised(value: string): {
  valid: boolean;
  message: string | null;
  value: string;
} {
  // Allow only numbers and decimal point
  const filtered = value.replace(/[^0-9.]/g, '');
  const numVal = parseFloat(filtered || '0');

  // Ensure it's at least 30 SOL per Raydium docs
  if (numVal < 30) {
    return {
      valid: false,
      message: 'Minimum SOL raised must be at least 30 SOL',
      value: filtered
    };
  }

  return { valid: true, message: null, value: filtered };
}

// Type definitions
export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

// Re-export the LaunchpadConfigData from the service
export type LaunchpadConfigData = ServiceLaunchpadConfigData;

export interface AdvancedOptionsSectionProps {
  containerStyle?: any;
  onBack?: () => void;
  onCreateToken?: (configData: LaunchpadConfigData) => void;
  isLoading?: boolean;
  tokenName?: string;
  tokenSymbol?: string;
}

// Token supply options based on Raydium requirements
export const TOKEN_SUPPLY_OPTIONS = [
  '100,000,000',   // 100M
  '1,000,000,000', // 1B
  '10,000,000,000' // 10B
];

// Vesting time unit options
export enum VestingTimeUnit {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year'
}

// Time unit options for display
export const TIME_UNIT_OPTIONS = [
  { label: 'Days', value: VestingTimeUnit.DAY },
  { label: 'Weeks', value: VestingTimeUnit.WEEK },
  { label: 'Months', value: VestingTimeUnit.MONTH },
  { label: 'Years', value: VestingTimeUnit.YEAR },
];

// Convert vesting period to seconds based on time unit
export function convertVestingPeriodToSeconds(
  duration: number,
  timeUnit: VestingTimeUnit
): number {
  const SECONDS_PER_DAY = 86400;
  const SECONDS_PER_WEEK = SECONDS_PER_DAY * 7;
  const SECONDS_PER_MONTH = SECONDS_PER_DAY * 30; // Approximation
  const SECONDS_PER_YEAR = SECONDS_PER_DAY * 365; // Approximation

  switch (timeUnit) {
    case VestingTimeUnit.DAY:
      return duration * SECONDS_PER_DAY;
    case VestingTimeUnit.WEEK:
      return duration * SECONDS_PER_WEEK;
    case VestingTimeUnit.MONTH:
      return duration * SECONDS_PER_MONTH;
    case VestingTimeUnit.YEAR:
      return duration * SECONDS_PER_YEAR;
    default:
      return duration * SECONDS_PER_MONTH; // Default to months
  }
}

// Sample tokens for demonstration
export const SAMPLE_TOKENS: TokenInfo[] = [
  {
    address: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    logoURI:
      'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  },
];

// Token Selection Modal Component
interface TokenSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectToken: (token: TokenInfo) => void;
  tokens: TokenInfo[];
}

export const TokenSelectionModal: React.FC<TokenSelectionModalProps> = ({
  visible,
  onClose,
  onSelectToken,
  tokens,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Filter tokens based on search input
  const filteredTokens = tokens.filter(
    t =>
      !searchInput.trim() ||
      t.symbol.toLowerCase().includes(searchInput.toLowerCase()) ||
      t.name.toLowerCase().includes(searchInput.toLowerCase()) ||
      t.address.toLowerCase().includes(searchInput.toLowerCase()),
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={modalStyles.modalOverlay}>
        <View style={modalStyles.modalContainer}>
          <View style={modalStyles.modalHeader}>
            <RNText style={modalStyles.modalTitle}>Select Token</RNText>
            <TouchableOpacity
              style={modalStyles.modalCloseButton}
              onPress={onClose}>
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
              keyboardAppearance="dark"
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
                  onPress={() => onSelectToken(item)}>
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
            onPress={onClose}>
            <RNText style={modalStyles.closeButtonText}>Cancel</RNText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Calculate graph data from token supply, sol raised, and bonding curve
export function calculateGraphData(tokenSupply: string, solRaised: string, bondingCurve: string) {
  // Parse input values, ensuring we handle commas and convert to numbers
  const supplyNum = parseNumericString(tokenSupply);
  const solNum = parseNumericString(solRaised);
  const curvePercent = parseNumericString(bondingCurve) || 51; // Default to 51% if invalid

  // Dimensions for the chart
  const width = 300;
  const height = 200;
  const margin = { top: 30, right: 30, bottom: 40, left: 40 };
  const graphWidth = width - margin.left - margin.right;
  const graphHeight = height - margin.top - margin.bottom;

  // Validate inputs
  if (supplyNum <= 0 || solNum <= 0 || curvePercent <= 0 || curvePercent > 100) {
    // Return default/empty state for invalid inputs
    const defaultY = height - margin.bottom;
    const defaultX = margin.left;
    return {
      linePath: `M${defaultX},${defaultY}L${defaultX + graphWidth},${defaultY}`, // Flat line at bottom
      areaPath: `M${defaultX},${defaultY}L${defaultX + graphWidth},${defaultY}Z`, // No area
      xTicks: Array.from({ length: 5 }).map((_, i) => ({
        value: '0',
        x: defaultX + (i / 4) * graphWidth,
        y: defaultY + 12,
      })),
      yTicks: Array.from({ length: 5 }).map((_, i) => ({
        value: '0',
        x: defaultX - 10,
        y: defaultY - (i / 4) * graphHeight,
        textAnchor: 'end',
      })),
      startPoint: { cx: defaultX, cy: defaultY },
      endPoint: { cx: defaultX + graphWidth, cy: defaultY },
      graphWidth,
      graphHeight,
      margin,
      width,
      height,
    };
  }

  // Calculate max supply on curve (tokens to be sold on the bonding curve)
  const maxSupplyOnCurve = supplyNum * (curvePercent / 100);

  // Scale factor to handle large numbers
  const scaleFactor = Math.pow(10, Math.max(0, Math.floor(Math.log10(maxSupplyOnCurve)) - 6));
  const scaledSupply = maxSupplyOnCurve / scaleFactor;

  // We use a modified quadratic formula that better represents the Raydium curve behavior
  // This matches more closely with the curve visualization in create.tsx
  const C = (2 * solNum) / Math.pow(scaledSupply, 2);
  const maxPrice = C * Math.pow(scaledSupply, 2);

  // Generate points along the curve with more density near the beginning for better curvature
  const points: { cx: number; cy: number }[] = [];
  const numPoints = 50;

  for (let i = 0; i <= numPoints; i++) {
    // Use a square root scale for x to emphasize the beginning curve
    const supplyRatio = Math.pow(i / numPoints, 0.5);
    const s = supplyRatio * maxSupplyOnCurve;
    const scaledS = s / scaleFactor;

    // Calculate price using quadratic formula
    const p = C * Math.pow(scaledS, 2);

    // Map coordinates to SVG space
    const svgX = margin.left + supplyRatio * graphWidth;
    const svgY = height - margin.bottom - (p / maxPrice) * graphHeight;

    // Ensure y is within bounds
    const boundedY = Math.max(margin.top, Math.min(height - margin.bottom, svgY));
    points.push({ cx: svgX, cy: boundedY });
  }

  // Ensure start point is exactly on the x-axis
  if (points.length > 0) {
    points[0].cy = height - margin.bottom;
  } else {
    points.push({ cx: margin.left, cy: height - margin.bottom });
  }

  // Create path data for the curve and area
  const linePath = points
    .map((p, i) => (i === 0 ? 'M' : 'L') + `${p.cx.toFixed(1)},${p.cy.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L${points[points.length - 1].cx.toFixed(1)},${height - margin.bottom} L${margin.left},${height - margin.bottom} Z`;

  // Generate X-axis tick labels (token supply values)
  const xTicks = Array.from({ length: 5 }).map((_, i) => {
    const val = (i / 4) * maxSupplyOnCurve;
    return {
      value: formatNumber(val),
      x: margin.left + (i / 4) * graphWidth,
      y: height - margin.bottom + 12,
    };
  });

  // Generate Y-axis tick labels (price values)
  const yTicks = Array.from({ length: 5 }).map((_, i) => {
    const priceVal = i === 0 ? 0 : maxPrice * (i / 4);
    return {
      value: formatNumber(priceVal),
      x: margin.left - 10,
      y: height - margin.bottom - (i / 4) * graphHeight,
      textAnchor: 'end',
    };
  });

  return {
    linePath,
    areaPath,
    xTicks,
    yTicks,
    startPoint: points[0],
    endPoint: points[points.length - 1],
    graphWidth,
    graphHeight,
    margin,
    width,
    height,
  };
} 