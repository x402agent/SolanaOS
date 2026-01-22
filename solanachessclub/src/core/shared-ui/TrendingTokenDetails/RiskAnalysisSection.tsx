import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { getTokenRiskReport, TokenRiskReport, getRiskScoreColor, getRiskLevelColor, RiskLevel } from '../../../shared/services/rugCheckService';
import styles from './RiskAnalysisSection.styles';
import COLORS from '@/assets/colors';

interface RiskAnalysisSectionProps {
    tokenAddress: string;
}

const RiskAnalysisSection: React.FC<RiskAnalysisSectionProps> = ({ tokenAddress }) => {
    const [loading, setLoading] = useState(true);
    const [riskReport, setRiskReport] = useState<TokenRiskReport | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchRiskReport();
    }, [tokenAddress]);

    const fetchRiskReport = async () => {
        setLoading(true);
        setError(null);

        try {
            const report = await getTokenRiskReport(tokenAddress, true);

            if (report) {
                setRiskReport(report);
            } else {
                setError('Unable to retrieve risk data for this token');
            }
        } catch (err) {
            console.error('[RiskAnalysis] Error fetching risk report:', err);
            setError('Error loading risk data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.brandPrimary} />
                <Text style={styles.loadingText}>Loading security analysis...</Text>
            </View>
        );
    }

    if (error || !riskReport) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error || 'No risk data available'}</Text>
            </View>
        );
    }

    // Format the risk score as a percentage
    const normalizedScore = Math.min(100, Math.max(0, Math.round(riskReport.score_normalised)));
    const scoreColor = getRiskScoreColor(normalizedScore);

    // Get risk label based on score
    const getRiskLabel = (score: number): string => {
        if (score < 30) return 'Low Risk';
        if (score < 60) return 'Medium Risk';
        if (score < 80) return 'High Risk';
        return 'Critical Risk';
    };

    return (
        <View style={styles.container}>
            {/* Risk Score */}
            <View style={styles.scoreSection}>
                <View style={styles.scoreContainer}>
                    <View style={[styles.scoreBadge, { backgroundColor: scoreColor }]}>
                        <Text style={styles.scoreValue}>{normalizedScore}</Text>
                    </View>
                    <Text style={[styles.riskLabel, { color: scoreColor }]}>
                        {riskReport.rugged ? 'RUGGED' : getRiskLabel(normalizedScore)}
                    </Text>
                </View>

                {riskReport.rugged && (
                    <View style={styles.ruggedBadge}>
                        <Text style={styles.ruggedText}>RUGGED</Text>
                    </View>
                )}
            </View>

            {/* Risk Explanation */}
            <View style={styles.explanationContainer}>
                <Text style={styles.explanationTitle}>Security Analysis</Text>
                <Text style={styles.explanationText}>
                    {getRiskExplanation(normalizedScore, riskReport.rugged)}
                </Text>
            </View>

            {/* Risk Factors */}
            {riskReport.risks && riskReport.risks.length > 0 && (
                <View style={styles.riskFactorsContainer}>
                    <Text style={styles.factorsTitle}>Risk Factors</Text>

                    {riskReport.risks.map((risk, index) => (
                        <View key={index} style={styles.riskItem}>
                            <View style={styles.riskItemHeader}>
                                <Text style={styles.riskName}>{risk.name}</Text>
                                <View style={[
                                    styles.riskLevelBadge,
                                    { backgroundColor: getRiskLevelColor(risk.level.toLowerCase() as RiskLevel) }
                                ]}>
                                    <Text style={styles.riskLevelText}>{risk.level.toUpperCase()}</Text>
                                </View>
                            </View>
                            <Text style={styles.riskDescription}>{risk.description}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Distribution Section */}
            {riskReport.topHolders && riskReport.topHolders.length > 0 && (
                <View style={styles.holdersContainer}>
                    <Text style={styles.holdersTitle}>Top Holders</Text>
                    <Text style={styles.holdersSubtitle}>
                        Total Holders: {riskReport.totalHolders?.toLocaleString() || 'N/A'}
                    </Text>

                    {riskReport.topHolders.slice(0, 5).map((holder, index) => (
                        <View key={index} style={styles.holderItem}>
                            <Text style={styles.holderAddress} numberOfLines={1}>
                                {holder.address.substring(0, 8)}...{holder.address.substring(holder.address.length - 8)}
                            </Text>
                            <View style={styles.holderBarContainer}>
                                <View
                                    style={[
                                        styles.holderBar,
                                        { width: `${Math.min(100, holder.pct * 100)}%` },
                                        holder.insider && styles.insiderBar
                                    ]}
                                />
                            </View>
                            <Text style={styles.holderPercentage}>
                                {holder.pct.toFixed(2)}%
                            </Text>
                            {holder.insider && (
                                <View style={styles.insiderBadge}>
                                    <Text style={styles.insiderText}>INSIDER</Text>
                                </View>
                            )}
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

// Helper function to generate risk explanations
function getRiskExplanation(score: number, isRugged: boolean): string {
    if (isRugged) {
        return 'This token has been identified as rugged. This means the project has likely been abandoned or was a scam. Trading is not recommended.';
    }

    if (score < 30) {
        return 'This token has a low risk score. It shows strong security indicators and appears to have legitimate tokenomics.';
    } else if (score < 60) {
        return 'This token has a medium risk score. While it shows some positive signs, there are potential concerns that should be evaluated carefully.';
    } else if (score < 80) {
        return 'This token has a high risk score. Multiple risk factors have been identified that could indicate potential issues.';
    } else {
        return 'This token has a critical risk score. Significant red flags have been detected that suggest high risk of loss.';
    }
}

export default RiskAnalysisSection; 