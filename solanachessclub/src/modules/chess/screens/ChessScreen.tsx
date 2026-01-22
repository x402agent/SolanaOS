import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import COLORS from '@/assets/colors';

/**
 * Solana Chess - React Native Integration
 * 
 * Features:
 * - Real-time multiplayer chess
 * - Wallet integration (uses existing auth)
 * - Leaderboards
 * - Lobby chat
 * - AI agents with Ralph Wiggum learning loop
 */

export default function ChessScreen() {
    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>♟️ Solana Chess</Text>
                    <Text style={styles.subtitle}>
                        Real-time multiplayer with AI agents
                    </Text>
                </View>

                {/* Quick Actions */}
                <View style={styles.actionsGrid}>
                    <TouchableOpacity style={[styles.actionCard, styles.primaryAction]}>
                        <Text style={styles.actionEmoji}>⚡</Text>
                        <Text style={styles.actionTitle}>Quick Play</Text>
                        <Text style={styles.actionSubtitle}>3 min Blitz</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionCard}>
                        <Text style={styles.actionEmoji}>🎮</Text>
                        <Text style={styles.actionTitle}>New Game</Text>
                        <Text style={styles.actionSubtitle}>Custom settings</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionCard}>
                        <Text style={styles.actionEmoji}>🤖</Text>
                        <Text style={styles.actionTitle}>Play AI</Text>
                        <Text style={styles.actionSubtitle}>Ralph Wiggum Bot</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionCard}>
                        <Text style={styles.actionEmoji}>🏆</Text>
                        <Text style={styles.actionTitle}>Leaderboard</Text>
                        <Text style={styles.actionSubtitle}>Top players</Text>
                    </TouchableOpacity>
                </View>

                {/* Info Section */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>🎯 Features</Text>
                    <View style={styles.featuresList}>
                        <Text style={styles.featureItem}>• Real-time multiplayer chess</Text>
                        <Text style={styles.featureItem}>• SOL wagering with escrow</Text>
                        <Text style={styles.featureItem}>• Global leaderboards</Text>
                        <Text style={styles.featureItem}>• Live lobby chat</Text>
                        <Text style={styles.featureItem}>• AI agents powered by LangChain</Text>
                        <Text style={styles.featureItem}>• Ralph Wiggum learning loop</Text>
                    </View>
                </View>

                {/* Coming Soon Badge */}
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>🚧 Full Integration Coming Soon</Text>
                    <Text style={styles.badgeSubtext}>
                        Board UI, real-time moves, and Convex backend
                    </Text>
                </View>

                {/* Tech Stack */}
                <View style={styles.techStack}>
                    <Text style={styles.techTitle}>Powered by:</Text>
                    <View style={styles.techRow}>
                        <View style={styles.techBadge}>
                            <Text style={styles.techText}>Convex DB</Text>
                        </View>
                        <View style={styles.techBadge}>
                            <Text style={styles.techText}>LangChain</Text>
                        </View>
                        <View style={styles.techBadge}>
                            <Text style={styles.techText}>Chess.js</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    actionCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    primaryAction: {
        backgroundColor: COLORS.brandPrimary,
        borderColor: COLORS.brandPrimary,
    },
    actionEmoji: {
        fontSize: 32,
        marginBottom: 8,
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: 4,
    },
    actionSubtitle: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    infoCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    infoTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: 16,
    },
    featuresList: {
        gap: 8,
    },
    featureItem: {
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 22,
    },
    badge: {
        backgroundColor: 'rgba(255, 193, 7, 0.1)',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 193, 7, 0.3)',
    },
    badgeText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFC107',
        marginBottom: 4,
    },
    badgeSubtext: {
        fontSize: 12,
        color: 'rgba(255, 193, 7, 0.7)',
        textAlign: 'center',
    },
    techStack: {
        alignItems: 'center',
    },
    techTitle: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 12,
    },
    techRow: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    techBadge: {
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    techText: {
        fontSize: 12,
        color: '#A78BFA',
        fontWeight: '600',
    },
});
