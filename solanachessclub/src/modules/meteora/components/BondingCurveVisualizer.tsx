import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';

interface BondingCurveVisualizerProps {
    initialMarketCap: number;
    migrationMarketCap: number;
    tokenSupply: number;
    baseFeeBps?: number;
    dynamicFeeEnabled?: boolean;
    collectFeeBoth?: boolean;
    migrationFeeOption?: number;
}

export default function BondingCurveVisualizer({
    initialMarketCap,
    migrationMarketCap,
    tokenSupply,
    baseFeeBps = 100, // Default to 1% fee
    dynamicFeeEnabled = true,
    collectFeeBoth = false,
    migrationFeeOption = 0,
}: BondingCurveVisualizerProps) {
    const [points, setPoints] = useState<Array<{ x: number; y: number; supply: number; price: number; mcap: number }>>([]);
    const [maxY, setMaxY] = useState(0);
    const [initialPoint, setInitialPoint] = useState<{ x: number; y: number; price: number; mcap: number } | null>(null);
    const [migrationPoint, setMigrationPoint] = useState<{ x: number; y: number; price: number; mcap: number } | null>(null);
    const [halfwayPoint, setHalfwayPoint] = useState<{ x: number; y: number; price: number; mcap: number } | null>(null);

    const WIDTH = Dimensions.get('window').width - 64;
    const HEIGHT = 200;
    const PADDING = 24;

    // Calculate key points on the curve
    useEffect(() => {
        if (!initialMarketCap || !migrationMarketCap || !tokenSupply) return;

        try {
            // Ensure valid inputs
            const initialCap = Math.max(1, initialMarketCap);
            const migrationCap = Math.max(initialCap * 1.1, migrationMarketCap);
            const supply = Math.max(1, tokenSupply);

            // Calculate the initial and final prices
            const initialPrice = initialCap / supply;
            const finalPrice = migrationCap / supply;

            // Create points for the curve
            const newPoints = [];
            const numPoints = 100; // More points for smoother curve
            let highestY = 0;
            let initialPointIndex = 0;
            let migrationPointIndex = numPoints;
            let halfwayPointIndex = Math.floor(numPoints / 2);

            // Define curve shape based on parameters
            // Higher fee = more aggressive curve
            const feeMultiplier = baseFeeBps / 100; // Convert BPS to percentage
            const ratio = migrationCap / initialCap;

            // Adjust exponent based on fee and migration target
            let exponent = ratio > 10 ? 2.5 : (ratio > 5 ? 2.0 : 1.8);

            // Modify curve shape based on fee settings
            if (baseFeeBps > 100) {
                // Higher fees make curve steeper
                exponent += (baseFeeBps - 100) / 300;
            }

            // Dynamic fee enabled makes curve slightly more aggressive
            if (dynamicFeeEnabled) {
                exponent *= 1.05;
            }

            // Collect fee in both tokens makes curve slightly less aggressive
            if (collectFeeBoth) {
                exponent *= 0.95;
            }

            // Migration fee option affects curve near migration point
            const migrationFeeImpact = migrationFeeOption / 10;

            for (let i = 0; i <= numPoints; i++) {
                // Progress along the curve (0 to 1)
                const t = i / numPoints;
                const supplyAtPoint = t * supply;

                // Use a power curve formula with adjustments for parameters
                let price;
                if (t > 0.9 && migrationFeeOption > 0) {
                    // Add a small bump near migration point if migration fee is higher
                    const migrationBoost = (migrationFeeOption / 10) * (t - 0.9) / 0.1;
                    price = initialPrice + (finalPrice - initialPrice) * (Math.pow(t, exponent) + migrationBoost * 0.1);
                } else {
                    price = initialPrice + (finalPrice - initialPrice) * Math.pow(t, exponent);
                }

                // Calculate market cap at this point
                const mcap = price * supplyAtPoint;

                // Map to screen coordinates
                const x = (t * (WIDTH - 2 * PADDING)) + PADDING;
                const y = HEIGHT - PADDING - (price / finalPrice) * (HEIGHT - 2 * PADDING);

                if (price > highestY) highestY = price;

                newPoints.push({
                    x,
                    y,
                    supply: supplyAtPoint,
                    price,
                    mcap
                });

                // Find the point closest to migration supply (100%)
                if (t === 1.0) {
                    migrationPointIndex = i;
                }

                // Find the point closest to initial supply (0%)
                if (t === 0.0) {
                    initialPointIndex = i;
                }

                // Find a point around halfway through the curve
                if (Math.abs(t - 0.5) < 0.01) {
                    halfwayPointIndex = i;
                }
            }

            // Set the key points
            setInitialPoint({
                x: newPoints[initialPointIndex].x,
                y: newPoints[initialPointIndex].y,
                price: initialPrice,
                mcap: initialCap
            });

            setMigrationPoint({
                x: newPoints[migrationPointIndex].x,
                y: newPoints[migrationPointIndex].y,
                price: finalPrice,
                mcap: migrationCap
            });

            setHalfwayPoint({
                x: newPoints[halfwayPointIndex].x,
                y: newPoints[halfwayPointIndex].y,
                price: newPoints[halfwayPointIndex].price,
                mcap: newPoints[halfwayPointIndex].mcap
            });

            setMaxY(highestY);
            setPoints(newPoints);
        } catch (error) {
            console.error('Error calculating curve points:', error);
        }
    }, [initialMarketCap, migrationMarketCap, tokenSupply, baseFeeBps, dynamicFeeEnabled, collectFeeBoth, migrationFeeOption]);

    // Format numbers with k/m suffix
    const formatNumber = (num: number): string => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toFixed(2);
    };

    if (points.length === 0) {
        return (
            <View style={styles.placeholderContainer}>
                <Text style={styles.placeholderText}>
                    Fill in all parameters to view bonding curve preview
                </Text>
            </View>
        );
    }

    // Create the path string from points
    const pathData = points.reduce((acc, point, i) => {
        if (i === 0) {
            return `M ${point.x} ${point.y}`;
        }
        return `${acc} L ${point.x} ${point.y}`;
    }, '');

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Bonding Curve Preview</Text>
            <Text style={styles.subtitle}>
                Visualizes how token price increases as the supply is purchased
            </Text>

            <Svg width={WIDTH} height={HEIGHT} style={styles.svgContainer}>
                {/* X and Y axes */}
                <Line
                    x1={PADDING}
                    y1={HEIGHT - PADDING}
                    x2={WIDTH - PADDING}
                    y2={HEIGHT - PADDING}
                    stroke={COLORS.greyMid}
                    strokeWidth={1}
                />
                <Line
                    x1={PADDING}
                    y1={PADDING}
                    x2={PADDING}
                    y2={HEIGHT - PADDING}
                    stroke={COLORS.greyMid}
                    strokeWidth={1}
                />

                {/* Background grid */}
                {[0.25, 0.5, 0.75].map((pos) => (
                    <Line
                        key={`grid-x-${pos}`}
                        x1={PADDING + (WIDTH - 2 * PADDING) * pos}
                        y1={PADDING}
                        x2={PADDING + (WIDTH - 2 * PADDING) * pos}
                        y2={HEIGHT - PADDING}
                        stroke={COLORS.greyMid}
                        strokeWidth={0.5}
                        strokeDasharray="3,3"
                    />
                ))}

                {[0.25, 0.5, 0.75].map((pos) => (
                    <Line
                        key={`grid-y-${pos}`}
                        x1={PADDING}
                        y1={PADDING + (HEIGHT - 2 * PADDING) * pos}
                        x2={WIDTH - PADDING}
                        y2={PADDING + (HEIGHT - 2 * PADDING) * pos}
                        stroke={COLORS.greyMid}
                        strokeWidth={0.5}
                        strokeDasharray="3,3"
                    />
                ))}

                {/* Curve */}
                <Path
                    d={pathData}
                    stroke={COLORS.brandPrimary}
                    strokeWidth={2.5}
                    fill="none"
                />

                {/* X axis labels */}
                <SvgText
                    x={PADDING}
                    y={HEIGHT - 8}
                    fontSize={10}
                    fill={COLORS.greyMid}
                    textAnchor="middle"
                >
                    0
                </SvgText>
                <SvgText
                    x={WIDTH / 2}
                    y={HEIGHT - 8}
                    fontSize={10}
                    fill={COLORS.greyMid}
                    textAnchor="middle"
                >
                    {formatNumber(tokenSupply / 2)}
                </SvgText>
                <SvgText
                    x={WIDTH - PADDING}
                    y={HEIGHT - 8}
                    fontSize={10}
                    fill={COLORS.greyMid}
                    textAnchor="middle"
                >
                    {formatNumber(tokenSupply)}
                </SvgText>

                {/* Y axis labels */}
                <SvgText
                    x={8}
                    y={HEIGHT - PADDING}
                    fontSize={10}
                    fill={COLORS.greyMid}
                    textAnchor="start"
                >
                    0
                </SvgText>
                <SvgText
                    x={8}
                    y={HEIGHT / 2}
                    fontSize={10}
                    fill={COLORS.greyMid}
                    textAnchor="start"
                >
                    {formatNumber(maxY / 2)}
                </SvgText>
                <SvgText
                    x={8}
                    y={PADDING + 4}
                    fontSize={10}
                    fill={COLORS.greyMid}
                    textAnchor="start"
                >
                    {formatNumber(maxY)}
                </SvgText>

                {/* Key Points with annotations */}
                {initialPoint && (
                    <>
                        <Circle cx={initialPoint.x} cy={initialPoint.y} r={5} fill={COLORS.brandPrimary} />
                        <SvgText
                            x={initialPoint.x + 10}
                            y={initialPoint.y - 10}
                            fontSize={9}
                            fill={COLORS.brandPrimary}
                            textAnchor="start"
                        >
                            {formatNumber(initialPoint.price)} SOL
                        </SvgText>
                    </>
                )}

                {halfwayPoint && (
                    <>
                        <Circle cx={halfwayPoint.x} cy={halfwayPoint.y} r={4} fill={COLORS.brandPurple || '#B591FF'} />
                        <SvgText
                            x={halfwayPoint.x + 10}
                            y={halfwayPoint.y - 10}
                            fontSize={9}
                            fill={COLORS.brandPurple || '#B591FF'}
                            textAnchor="start"
                        >
                            {formatNumber(halfwayPoint.price)} SOL
                        </SvgText>
                    </>
                )}

                {migrationPoint && (
                    <>
                        <Circle cx={migrationPoint.x} cy={migrationPoint.y} r={5} fill={COLORS.brandPrimary} />
                        <SvgText
                            x={migrationPoint.x - 10}
                            y={migrationPoint.y - 10}
                            fontSize={9}
                            fill={COLORS.brandPrimary}
                            textAnchor="end"
                        >
                            {formatNumber(migrationPoint.price)} SOL
                        </SvgText>
                    </>
                )}
            </Svg>

            <View style={styles.labelContainer}>
                <Text style={styles.xAxisLabel}>Token Supply (Circulating)</Text>
                <Text style={styles.yAxisLabel}>Price per Token (SOL)</Text>
            </View>

            <View style={styles.infoContainer}>
                <Text style={styles.infoTitle}>Key Metrics</Text>
                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Initial Price:</Text>
                    <Text style={styles.infoValue}>
                        {formatNumber(initialMarketCap / tokenSupply)} SOL
                    </Text>
                </View>
                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Migration Price:</Text>
                    <Text style={styles.infoValue}>
                        {formatNumber(migrationMarketCap / tokenSupply)} SOL
                    </Text>
                </View>
                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Price Growth:</Text>
                    <Text style={styles.infoValue}>
                        {formatNumber((migrationMarketCap / initialMarketCap - 1) * 100)}%
                    </Text>
                </View>
                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Initial Market Cap:</Text>
                    <Text style={styles.infoValue}>
                        {formatNumber(initialMarketCap)} SOL
                    </Text>
                </View>
                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Final Market Cap:</Text>
                    <Text style={styles.infoValue}>
                        {formatNumber(migrationMarketCap)} SOL
                    </Text>
                </View>
                {halfwayPoint && (
                    <View style={styles.infoItem}>
                        <Text style={styles.infoLabel}>Mid-point Price:</Text>
                        <Text style={styles.infoValue}>
                            {formatNumber(halfwayPoint.price)} SOL
                        </Text>
                    </View>
                )}
                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Trade Fee:</Text>
                    <Text style={styles.infoValue}>
                        {(baseFeeBps / 100).toFixed(2)}% {dynamicFeeEnabled ? '(Dynamic)' : '(Fixed)'}
                    </Text>
                </View>
                <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Fee Collection:</Text>
                    <Text style={styles.infoValue}>
                        {collectFeeBoth ? 'Both Tokens' : 'Quote Only'}
                    </Text>
                </View>
            </View>

            <View style={styles.axisExplanationContainer}>
                <Text style={styles.axisExplanationTitle}>Understanding This Chart</Text>
                <Text style={styles.axisExplanationText}>
                    • X-axis shows token supply in circulation as tokens are bought{'\n'}
                    • Y-axis shows price per token in SOL{'\n'}
                    • Curve shows how price increases as more tokens are bought{'\n'}
                    • Higher fees and dynamic pricing create steeper curves{'\n'}
                    • Token graduates to DAMM V1 when migration market cap is reached
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.darkerBackground,
        padding: 16,
        borderRadius: 16,
        marginVertical: 24,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    svgContainer: {
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 8,
        marginVertical: 10,
    },
    title: {
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.white,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyMid,
        marginBottom: 16,
    },
    labelContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    xAxisLabel: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyMid,
        textAlign: 'center',
    },
    yAxisLabel: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyMid,
        textAlign: 'center',
    },
    infoContainer: {
        marginTop: 24,
        padding: 12,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 8,
    },
    infoTitle: {
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.white,
        marginBottom: 8,
    },
    infoItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 4,
    },
    infoLabel: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.greyMid,
    },
    infoValue: {
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.white,
    },
    placeholderContainer: {
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.darkerBackground,
        padding: 16,
        borderRadius: 16,
        marginVertical: 24,
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    placeholderText: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.greyMid,
        textAlign: 'center',
    },
    axisExplanationContainer: {
        marginTop: 16,
        padding: 12,
        backgroundColor: 'rgba(0,0,0,0.15)',
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.brandPrimary,
    },
    axisExplanationTitle: {
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.white,
        marginBottom: 8,
    },
    axisExplanationText: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyMid,
        lineHeight: 18,
    },
}); 