import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { useDevMode } from '@/shared/context/DevModeContext';
import { useEnvError } from '@/shared/context/EnvErrorContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigationRef } from '@/shared/hooks/useAppNavigation';
import { useDispatch } from 'react-redux';
import { useSelector } from 'react-redux';
import { RootState } from '@/shared/state/store';
import COLORS from '@/assets/colors';
import TYPOGRAPHY from '@/assets/typography';
import NotificationTestPanel from './NotificationTestPanel';
// Import specific environment variables needed for the frontend
import {
    PRIVY_APP_ID,
    PRIVY_CLIENT_ID,
    CLUSTER,
    TURNKEY_BASE_URL,
    TURNKEY_RP_ID,
    TURNKEY_RP_NAME,
    TURNKEY_ORGANIZATION_ID,
    DYNAMIC_ENVIRONMENT_ID,
    HELIUS_API_KEY,
    HELIUS_RPC_CLUSTER,
    SERVER_URL,
    TENSOR_API_KEY,
    COINGECKO_API_KEY,
    BIRDEYE_API_KEY,
    HELIUS_STAKED_URL,
    HELIUS_STAKED_API_KEY
} from '@env';

// Sample dummy data for profile and posts
const DUMMY_USER = {
    userId: 'demo-user-123',
    username: 'satoshi_nakamoto',
    displayName: 'Satoshi Nakamoto',
    bio: 'Creator of a decentralized digital currency that operates without a central authority.',
    profileImageUrl: 'https://pbs.twimg.com/profile_images/1429234352611897345/HJ-TzEE3_400x400.jpg',
    coverImageUrl: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d',
    followerCount: 1287000,
    followingCount: 42,
    isVerified: true,
    walletAddress: '8ZUdizNr7cjWcEPAfSB7pHfwRfCJ4iR23yMrpuVXaJLD'
};

const DUMMY_POST = {
    postId: 'post-456-abc',
    content: 'Just deployed a new contract on Solana! Check out the blazing fast speeds at just $0.0001 per transaction!',
    imageUrl: 'https://images.unsplash.com/photo-1639762681057-408e52192e55',
    timestamp: new Date().getTime() - 3600000, // 1 hour ago
    likeCount: 2431,
    commentCount: 248,
    user: DUMMY_USER,
    isLiked: false,
    hashtags: ['#solana', '#blockchain', '#crypto'],
    transactionHash: '4vJ6p8onCZeUQBPJqrXXGJRSkLTdYvPTL9zGwDdvwSbEeKJdf6C4MQhTccCrxP8ZbpWJkzhGQhFVmUG3Qgpj8j7y'
};

// Screen nodes for the visual tree map
const SCREEN_NODES = [
    // Main nav - this is the root node
    {
        id: 'bottomNav',
        label: 'Bottom Navigation',
        type: 'root',
        route: null,
        params: {},
        children: ['modules', 'feed', 'swap', 'chat', 'profile']
    },

    // Main level nodes
    {
        id: 'modules',
        label: 'Modules',
        type: 'category',
        route: 'MainTabs',
        params: { screen: 'Modules' },
        children: ['tokenMill', 'pumpFun', 'launchLab', 'meteora']
    },
    {
        id: 'feed',
        label: 'Feed',
        type: 'screen',
        route: 'MainTabs',
        params: { screen: 'Feed' },
        children: []
    },
    {
        id: 'swap',
        label: 'Swap',
        type: 'screen',
        route: 'MainTabs',
        params: { screen: 'Swap' },
        children: []
    },
    {
        id: 'chat',
        label: 'Chat',
        type: 'screen',
        route: 'ChatListScreen',
        params: {},
        children: []
    },
    {
        id: 'profile',
        label: 'Profile',
        type: 'screen',
        route: 'ProfileScreen',
        params: {},
        children: []
    },

    // Modules' children
    {
        id: 'pumpFun',
        label: 'Pump Fun',
        type: 'screen',
        route: 'Pumpfun',
        params: {},
        children: []
    },
    {
        id: 'tokenMill',
        label: 'Token Mill',
        type: 'screen',
        route: 'TokenMill',
        params: {},
        children: []
    },
    {
        id: 'launchLab',
        label: 'Launch Lab',
        type: 'screen',
        route: 'LaunchlabsScreen',
        params: {},
        children: []
    },
    {
        id: 'meteora',
        label: 'Meteora',
        type: 'screen',
        route: 'MeteoraScreen',
        params: {},
        children: []
    }
];

type RouteNames = string;

// Navigation Map Component - Redesigned to be more modern and sleek
const AppNavigationMap = ({ onScreenSelect }: { onScreenSelect: (route: RouteNames, params: Record<string, unknown>) => void }) => {
    // Track which sections are expanded
    const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
        bottomNav: true,
        modules: false
    });

    // Toggle a section's expanded state
    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionId]: !prev[sectionId]
        }));
    };

    // Modern node component for the navigation map
    const NavNode = ({
        id,
        indentLevel = 0,
        isChild = false
    }: {
        id: string,
        indentLevel?: number,
        isChild?: boolean
    }) => {
        const node = SCREEN_NODES.find(n => n.id === id);
        if (!node) return null;

        const nodeType = node.type;
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedSections[id];

        // Icons for different types of nodes
        const getNodeIcon = () => {
            if (nodeType === 'root') return '•••';
            if (nodeType === 'category') return '•';
            return '→';
        };

        return (
            <View style={{ marginBottom: isChild ? 6 : 4 }}>
                <TouchableOpacity
                    style={[
                        styles.navMapNode,
                        { marginLeft: indentLevel * 16 },
                        nodeType === 'root' ? styles.rootNode :
                            nodeType === 'category' ? styles.categoryNode :
                                styles.screenNode
                    ]}
                    onPress={() => {
                        if (hasChildren) {
                            toggleSection(id);
                        } else if (node.route) {
                            onScreenSelect(node.route, node.params);
                        }
                    }}
                >
                    <View style={styles.nodeContent}>
                        {hasChildren && (
                            <Text style={[
                                styles.nodeArrow,
                                nodeType === 'root' ? styles.rootText :
                                    nodeType === 'category' ? styles.categoryText :
                                        styles.screenText
                            ]}>
                                {isExpanded ? '−' : '+'}
                            </Text>
                        )}

                        <Text style={[
                            styles.nodeLabel,
                            nodeType === 'root' ? styles.rootText :
                                nodeType === 'category' ? styles.categoryText :
                                    styles.screenText
                        ]}>
                            {node.label}
                        </Text>
                    </View>

                    {node.route && (
                        <TouchableOpacity
                            style={styles.navButton}
                            onPress={() => onScreenSelect(node.route, node.params)}
                        >
                            <Text style={styles.navButtonText}>Open</Text>
                        </TouchableOpacity>
                    )}
                </TouchableOpacity>

                {/* Render children when section is expanded with connecting lines */}
                {hasChildren && isExpanded && (
                    <View style={styles.childrenContainer}>
                        {node.children.map(childId => (
                            <NavNode
                                key={childId}
                                id={childId}
                                indentLevel={indentLevel + 1}
                                isChild={true}
                            />
                        ))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.navigationMapContainer}>
            <NavNode id="bottomNav" />
        </View>
    );
};

// Component to display missing environment variables
const MissingEnvVars = () => {
    const { hasMissingEnvVars, missingEnvVars, toggleErrorModal } = useEnvError();

    if (!hasMissingEnvVars) {
        return (
            <View style={styles.envContainer}>
                <Text style={styles.envTitle}>Environment Variables</Text>
                <Text style={styles.envComplete}>All environment variables are set correctly.</Text>
            </View>
        );
    }

    return (
        <View style={styles.envContainer}>
            <Text style={styles.envTitle}>Environment Variables</Text>
            <Text style={styles.envDescription}>
                The following environment variables are missing. The app can continue in dev mode,
                but certain features may not work correctly.
            </Text>
            {missingEnvVars.slice(0, 5).map((varName) => (
                <View key={varName} style={styles.envVarItem}>
                    <Text style={styles.envVarName}>{varName}</Text>
                </View>
            ))}

            {missingEnvVars.length > 5 && (
                <Text style={styles.moreVarsText}>
                    + {missingEnvVars.length - 5} more...
                </Text>
            )}

            <Text style={styles.envHelper}>
                To fix this, add these variables to your .env.local file.
            </Text>
        </View>
    );
};

// Log the server URL for debugging
console.log('SERVER_URL', SERVER_URL);

// Custom fetch with timeout function since AbortSignal.timeout is not supported
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 5000): Promise<Response> => {
    // Create a promise that rejects after the specified timeout
    const timeoutPromise = new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), timeout)
    );

    // Create the fetch promise
    const fetchPromise = fetch(url, options);

    // Race the fetch against the timeout
    return Promise.race([fetchPromise, timeoutPromise]);
};

// Component to display server connection status
const ServerStatus = () => {
    const { setServerStatus } = useDevMode();
    const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    const [lastChecked, setLastChecked] = useState<Date | null>(null);
    const [serverUrl, setServerUrl] = useState<string>(SERVER_URL || 'http://localhost:8080');

    // Check server connection status
    const checkServerStatus = async () => {
        setStatus('checking');
        try {
            console.log(`Checking server status at: ${serverUrl}`);

            // Use the ws-health endpoint which should be lightweight and fast
            const response = await fetchWithTimeout(`${serverUrl}/ws-health`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                }
            }, 5000);

            if (response.ok) {
                console.log('Server response OK:', await response.text());
                setStatus('online');
                setServerStatus('online');
            } else {
                console.log('Server response NOT OK:', response.status);
                setStatus('offline');
                setServerStatus('offline');
            }
        } catch (error) {
            console.error('Server connection check failed:', error);
            setStatus('offline');
            setServerStatus('offline');
        }
        setLastChecked(new Date());
    };

    // Check status when component mounts
    useEffect(() => {
        checkServerStatus();
    }, []);

    // Format the last checked time
    const getLastCheckedTime = () => {
        if (!lastChecked) return '';
        return lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <View style={styles.serverStatusContainer}>
            <Text style={styles.serverStatusTitle}>Server Status</Text>

            <View style={styles.serverStatusContent}>
                <View style={styles.serverStatusIndicatorContainer}>
                    {status === 'checking' ? (
                        <ActivityIndicator size="small" color={COLORS.greyMid} />
                    ) : (
                        <View
                            style={[
                                styles.serverStatusIndicator,
                                status === 'online' ? styles.serverStatusOnline : styles.serverStatusOffline
                            ]}
                        />
                    )}
                    <Text style={[
                        styles.serverStatusText,
                        status === 'online' ? styles.statusOnlineText :
                            status === 'offline' ? styles.statusOfflineText :
                                styles.statusCheckingText
                    ]}>
                        {status === 'checking' ? 'Checking...' :
                            status === 'online' ? 'Server Online' : 'Server Offline'}
                    </Text>
                </View>

                {/* <Text style={styles.serverUrlText}>
                    {serverUrl}
                </Text> */}

                {lastChecked && (
                    <Text style={styles.lastCheckedText}>
                        Last checked: {getLastCheckedTime()}
                    </Text>
                )}
            </View>

            <TouchableOpacity
                style={styles.refreshButton}
                onPress={checkServerStatus}
            >
                <Text style={styles.refreshButtonText}>Check Again</Text>
            </TouchableOpacity>
        </View>
    );
};

const DevDrawer = () => {
    const { isDevDrawerOpen, toggleDevDrawer, setServerStatus } = useDevMode();
    const dispatch = useDispatch();
    const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
    const [serverConnectionStatus, setServerConnectionStatus] = useState<'checking' | 'online' | 'offline'>('checking');

    // Check server connection
    const checkServerConnection = async () => {
        try {
            setServerConnectionStatus('checking');
            console.log(`Checking server status in DevDrawer at: ${SERVER_URL || 'http://localhost:8080'}`);

            // Use the ws-health endpoint which should be lightweight and fast
            const response = await fetchWithTimeout(`${SERVER_URL || 'http://localhost:8080'}/ws-health`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                }
            }, 5000);

            if (response.ok) {
                console.log('Server connection successful');
                setServerConnectionStatus('online');
                setServerStatus('online');
            } else {
                console.log('Server returned error status:', response.status);
                setServerConnectionStatus('offline');
                setServerStatus('offline');
            }
        } catch (error) {
            console.error('Server connection check failed:', error);
            setServerConnectionStatus('offline');
            setServerStatus('offline');
        }
    };

    // Check server connection when drawer opens
    useEffect(() => {
        if (isDevDrawerOpen) {
            checkServerConnection();
        }
    }, [isDevDrawerOpen]);

    // Bypass authentication for dev mode
    const bypassAuth = () => {
        if (!isLoggedIn) {
            // Force login with dummy data
            dispatch({
                type: 'auth/loginSuccess',
                payload: {
                    provider: 'mwa',
                    address: DUMMY_USER.walletAddress,
                    profilePicUrl: DUMMY_USER.profileImageUrl,
                    username: DUMMY_USER.username,
                    description: DUMMY_USER.bio
                }
            });
            console.log('Dev mode: Authentication bypassed');
            return true;
        }
        return false;
    };

    const navigateToScreen = (route: RouteNames, params: Record<string, unknown> = {}) => {
        try {
            if (!route) return; // Skip navigation for category nodes

            // First close the drawer
            toggleDevDrawer();

            // Bypass authentication in dev mode
            const didBypass = bypassAuth();

            // Then navigate to the selected screen
            // We use a small timeout to ensure the drawer closing animation completes
            // and auth state updates if needed
            setTimeout(() => {
                if (navigationRef.isReady()) {
                    const nav = navigationRef.current;

                    // If we bypassed auth, we need more time for the auth state to update
                    // before attempting navigation
                    const navigationDelay = didBypass ? 500 : 100;

                    setTimeout(() => {
                        try {
                            if (nav) {
                                // Handle nested navigation
                                if (typeof params.screen === 'string') {
                                    nav.navigate(route as any, params as any);
                                } else {
                                    nav.navigate(route as any, params as any);
                                }
                                console.log(`Navigated to ${route} with params`, params);
                            }
                        } catch (navError) {
                            console.error('Inner navigation error:', navError);
                            alert(`Failed to navigate to ${route}`);
                        }
                    }, navigationDelay);
                } else {
                    console.error('Navigation is not ready');
                    alert('Navigation is not ready. Try again in a moment.');
                }
            }, 100);
        } catch (error: unknown) {
            console.error('Navigation error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Failed to navigate to ${route}. Error: ${errorMessage}`);
        }
    };

    if (!isDevDrawerOpen) return null;

    return (
        <View style={styles.overlay}>
            <TouchableOpacity
                style={styles.backdrop}
                onPress={toggleDevDrawer}
                activeOpacity={1}
            />
            <SafeAreaView style={styles.drawerContainer} edges={['bottom', 'left', 'right']}>
                <View style={styles.header}>
                    <Text style={styles.title}>Developer Tools</Text>
                    <TouchableOpacity
                        style={styles.closeButtonContainer}
                        onPress={toggleDevDrawer}
                    >
                        <Text style={styles.closeButton}>Close</Text>
                    </TouchableOpacity>
                </View>
                <ScrollView style={styles.content}>
                    {/* Show server status */}
                    <ServerStatus />

                    {/* Show missing environment variables */}
                    <MissingEnvVars />

                    <View style={styles.navigationMapContainer}>
                        <Text style={styles.mapTitle}>App Navigation</Text>
                        <Text style={styles.mapDescription}>
                            Use this map to navigate directly to different screens in the app
                            without having to go through the normal flow.
                        </Text>
                        <AppNavigationMap onScreenSelect={navigateToScreen} />
                    </View>

                    <View style={styles.divider} />

                    {/* Notification Test Panel */}
                    <View style={styles.notificationPanelContainer}>
                        <NotificationTestPanel />
                    </View>

                    <View style={styles.divider} />

                    <Text style={styles.sectionTitle}>Developer Info</Text>

                    <View style={styles.infoCard}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Environment:</Text>
                            <Text style={styles.infoValue}>Development</Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>App Version:</Text>
                            <Text style={styles.infoValue}>
                                {(process.env as any).npm_package_version || '0.1.0'}
                            </Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Login Status:</Text>
                            <Text style={[styles.infoValue, { color: isLoggedIn ? COLORS.brandGreen : COLORS.brandPrimary }]}>
                                {isLoggedIn ? 'Logged In' : 'Not Logged In'}
                            </Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Server Status:</Text>
                            <Text style={[
                                styles.infoValue,
                                serverConnectionStatus === 'online' ? { color: COLORS.brandGreen } :
                                    serverConnectionStatus === 'offline' ? { color: COLORS.errorRed } :
                                        { color: COLORS.greyMid }
                            ]}>
                                {serverConnectionStatus === 'checking' ? 'Checking...' :
                                    serverConnectionStatus === 'online' ? 'Connected' : 'Disconnected'}
                            </Text>
                        </View>
                    </View>

                    {!isLoggedIn && (
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={bypassAuth}
                        >
                            <Text style={styles.actionButtonText}>Force Login (For Testing)</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    drawerContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: Dimensions.get('window').height * 0.9,
        shadowColor: COLORS.black,
        shadowOffset: {
            width: 0,
            height: -3,
        },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 14,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderDarkColor,
    },
    title: {
        fontSize: TYPOGRAPHY.size.xl,
        fontWeight: TYPOGRAPHY.weights.bold,
        color: COLORS.white,
    },
    closeButtonContainer: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    closeButton: {
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.brandPrimary,
    },
    content: {
        paddingHorizontal: 24,
        paddingTop: 16,
    },
    navigationMapContainer: {
        marginBottom: 5,
    },
    mapTitle: {
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.weights.bold,
        marginBottom: 8,
        color: COLORS.white,
    },
    mapDescription: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.greyMid,
        marginBottom: 16,
        lineHeight: TYPOGRAPHY.lineHeight.sm,
    },
    navMapNode: {
        marginVertical: 4,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    rootNode: {
        backgroundColor: COLORS.lightBackground,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.brandBlue,
    },
    categoryNode: {
        backgroundColor: COLORS.lightBackground,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.brandPrimary,
    },
    screenNode: {
        backgroundColor: COLORS.lightBackground,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.brandGreen,
    },
    rootText: {
        color: COLORS.brandBlue,
    },
    categoryText: {
        color: COLORS.brandPrimary,
    },
    screenText: {
        color: COLORS.brandGreen,
    },
    nodeContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    nodeArrow: {
        fontSize: TYPOGRAPHY.size.lg,
        marginRight: 8,
        fontWeight: TYPOGRAPHY.weights.semiBold,
    },
    nodeLabel: {
        fontWeight: TYPOGRAPHY.weights.medium,
        fontSize: TYPOGRAPHY.size.md,
    },
    navButton: {
        backgroundColor: COLORS.lighterBackground,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    navButtonText: {
        fontSize: TYPOGRAPHY.size.xs,
        fontWeight: TYPOGRAPHY.weights.medium,
        color: COLORS.white,
    },
    childrenContainer: {
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.borderDarkColor,
        marginVertical: 16,
    },
    sectionTitle: {
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.weights.bold,
        color: COLORS.white,
        marginBottom: 16,
    },
    infoCard: {
        backgroundColor: COLORS.lightBackground,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderDarkColor,
    },
    infoLabel: {
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.greyMid,
    },
    infoValue: {
        fontSize: TYPOGRAPHY.size.sm,
        fontWeight: TYPOGRAPHY.weights.medium,
        color: COLORS.white,
    },
    actionButton: {
        backgroundColor: COLORS.brandPrimary,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 30,
    },
    actionButtonText: {
        color: COLORS.background,
        fontWeight: TYPOGRAPHY.weights.semiBold,
        fontSize: TYPOGRAPHY.size.md,
    },
    envContainer: {
        backgroundColor: COLORS.lightBackground,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    envTitle: {
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.weights.bold,
        marginBottom: 8,
        color: COLORS.white,
    },
    envDescription: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.greyMid,
        marginBottom: 16,
        lineHeight: TYPOGRAPHY.lineHeight.sm,
    },
    envComplete: {
        fontSize: TYPOGRAPHY.size.sm,
        color: COLORS.brandGreen,
        fontWeight: TYPOGRAPHY.weights.medium,
    },
    envVarItem: {
        backgroundColor: 'rgba(229,77,77,0.1)',
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.errorRed,
    },
    envVarName: {
        fontWeight: TYPOGRAPHY.weights.semiBold,
        color: COLORS.errorRed,
    },
    envHelper: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyMid,
        marginTop: 8,
        fontStyle: 'italic',
    },
    moreVarsText: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyMid,
        fontStyle: 'italic',
        marginVertical: 8,
    },
    // Server status styles
    serverStatusContainer: {
        backgroundColor: COLORS.lightBackground,
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    serverStatusTitle: {
        fontSize: TYPOGRAPHY.size.lg,
        fontWeight: TYPOGRAPHY.weights.bold,
        marginBottom: 12,
        color: COLORS.white,
    },
    serverStatusContent: {
        marginBottom: 12,
    },
    serverStatusIndicatorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    serverStatusIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    serverStatusOnline: {
        backgroundColor: COLORS.brandGreen,
    },
    serverStatusOffline: {
        backgroundColor: COLORS.errorRed,
    },
    serverStatusText: {
        fontSize: TYPOGRAPHY.size.md,
        fontWeight: TYPOGRAPHY.weights.semiBold,
    },
    statusOnlineText: {
        color: COLORS.brandGreen,
    },
    statusOfflineText: {
        color: COLORS.errorRed,
    },
    statusCheckingText: {
        color: COLORS.greyMid,
    },
    serverUrlText: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyMid,
        marginLeft: 20,
        marginTop: 4,
        marginBottom: 4,
    },
    lastCheckedText: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.greyMid,
        marginLeft: 20,
    },
    refreshButton: {
        backgroundColor: COLORS.lightBackground,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: COLORS.borderDarkColor,
    },
    refreshButtonText: {
        fontSize: TYPOGRAPHY.size.xs,
        color: COLORS.white,
        fontWeight: TYPOGRAPHY.weights.medium,
    },
    notificationPanelContainer: {
        marginBottom: 24,
        minHeight: 500, // Ensure minimum height for the notification panel
    },
});

export default DevDrawer;
