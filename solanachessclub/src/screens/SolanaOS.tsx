import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Dimensions,
    StyleSheet,
    Animated,
    Vibration,
    Platform,
    StatusBar,
    SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ============================================
// SOLANA OS - Complete Dark Theme Edition
// Adapted for React Native
// ============================================

const { width, height } = Dimensions.get('window');

const COLORS = {
    solanaPurple: '#9945FF',
    solanaGreen: '#14F195',
    bgPrimary: '#050508',
    bgSecondary: '#0a0a0f',
    bgTertiary: '#0f0f14',
    textPrimary: '#FFFFFF',
    textSecondary: '#AAAAAA',
    textMuted: '#555555',
    border: 'rgba(255,255,255,0.08)',
    warning: '#FFC107',
    error: '#FF4444',
};

const CHESS_COLORS = {
    lightSquare: '#3d3d4a',
    darkSquare: '#262630',
    whitePiece: '#f0f0f0',
    blackPiece: '#1a1a2e',
};

const TAB_CONFIG: any = {
    terminal: { icon: '⌨', label: 'Terminal', color: COLORS.solanaGreen },
    agents: { icon: '🤖', label: 'Agents', color: '#FF6B6B' },
    beaver: { icon: '🦫', label: 'Beaver', color: '#FFA500' },
    chess: { icon: '♟️', label: 'Chess', color: '#888888' },
    x402: { icon: '⚡', label: 'X402', color: COLORS.solanaGreen },
    portfolio: { icon: '◉', label: 'Portfolio', color: '#00D4FF' },
    settings: { icon: '⚙', label: 'Settings', color: '#666666' },
};

const AGENT_CONFIGS = [
    { id: 'trading', name: 'Trading Agent', icon: '📈', color: '#14F195', description: 'Execute trades and DCA' },
    { id: 'portfolio', name: 'Portfolio Optimizer', icon: '💼', color: '#00D4FF', description: 'Analyze holdings' },
    { id: 'research', name: 'Alpha Research', icon: '🔬', color: '#FF6B6B', description: 'Token research' },
    { id: 'airdrop', name: 'Airdrop Hunter', icon: '🎁', color: '#FFD93D', description: 'Find airdrops' },
    { id: 'yield', name: 'Yield Farmer', icon: '🌾', color: '#9945FF', description: 'Optimize yields' },
];

const haptics = {
    tap: () => Vibration.vibrate(10),
    press: () => Vibration.vibrate(25),
    impact: () => Vibration.vibrate(50),
    success: () => Vibration.vibrate([10, 50, 20]),
    error: () => Vibration.vibrate([50, 100, 50]),
    selection: () => Vibration.vibrate(5),
};

// ============================================
// Terminal Component
// ============================================
const Terminal = () => {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: "SOLANA OS KERNEL v1.0.0\n\n◎ Neural interface active\n◎ All systems nominal\n\nHow can I assist?", timestamp: Date.now() }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;
        haptics.press();

        const userMsg = input.trim();
        setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: Date.now() }]);
        setInput('');
        setIsTyping(true);

        setTimeout(() => {
            const responses = [
                "Acknowledged. Processing your request through the neural network...",
                "Running analysis on Solana mainnet. Current TPS: 4,200. Network healthy.",
                "I've analyzed the data. The Solana ecosystem shows strong growth metrics.",
                "Command executed. Results available in your portfolio dashboard.",
            ];
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: responses[Math.floor(Math.random() * responses.length)],
                timestamp: Date.now()
            }]);
            setIsTyping(false);
            haptics.success();
        }, 1500);
    };

    return (
        <View style={styles.terminalContainer}>
            <ScrollView
                ref={scrollRef}
                style={styles.terminalScroll}
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            >
                {messages.map((m, i) => (
                    <View key={i} style={[styles.messageWrapper, { alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }]}>
                        <View style={[
                            styles.messageBubble,
                            {
                                backgroundColor: m.role === 'user' ? COLORS.solanaPurple : COLORS.bgSecondary,
                                borderTopRightRadius: m.role === 'user' ? 4 : 20,
                                borderTopLeftRadius: m.role === 'user' ? 20 : 4,
                            }
                        ]}>
                            <View style={[styles.messageMeta, { flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }]}>
                                <Text style={styles.messageRoleText}>{m.role === 'user' ? 'OPERATOR' : 'KERNEL_AI'}</Text>
                                <Text style={styles.messageMetaSpacer}>|</Text>
                                <Text style={styles.messageTimeText}>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                            </View>
                            <Text style={styles.messageContentText}>{m.content}</Text>
                        </View>
                    </View>
                ))}
                {isTyping && (
                    <View style={styles.typingIndicator}>
                        <Text style={styles.typingText}>Processing</Text>
                    </View>
                )}
            </ScrollView>

            <View style={styles.inputArea}>
                <View style={styles.inputWrapper}>
                    <Text style={styles.inputPrefix}>&gt;&gt;&gt;</Text>
                    <TextInput
                        value={input}
                        onChangeText={setInput}
                        onSubmitEditing={handleSend}
                        placeholder="Enter command..."
                        placeholderTextColor={COLORS.textMuted}
                        style={styles.terminalInput}
                        editable={!isTyping}
                    />
                    <TouchableOpacity
                        onPress={handleSend}
                        disabled={isTyping || !input.trim()}
                        style={[styles.execButton, { opacity: isTyping || !input.trim() ? 0.3 : 1 }]}
                    >
                        <Text style={styles.execButtonText}>EXEC</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

// ============================================
// Ralph Agents Component
// ============================================
const RalphAgents = () => {
    const [agents, setAgents] = useState<any>(() => {
        const initial: any = {};
        AGENT_CONFIGS.forEach(a => { initial[a.id] = { status: 'idle', iterations: 0, cost: 0 }; });
        return initial;
    });
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [iterations, setIterations] = useState<any[]>([]);

    const runAgent = async (agentId: string, userPrompt: string) => {
        setIsRunning(true);
        setIterations([]);
        haptics.press();
        setAgents((prev: any) => ({ ...prev, [agentId]: { ...prev[agentId], status: 'running', iterations: 0, cost: 0 } }));

        for (let i = 1; i <= 6; i++) {
            await new Promise(r => setTimeout(r, 700));
            const iteration = {
                number: i,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                output: `Iteration ${i}: Processing "${userPrompt}"...`,
                verified: i === 6,
            };
            setIterations(prev => [...prev, iteration]);
            setAgents((prev: any) => ({ ...prev, [agentId]: { ...prev[agentId], iterations: i, cost: i * 0.001 } }));
            haptics.tap();
        }

        setIsRunning(false);
        haptics.success();
        setAgents((prev: any) => ({ ...prev, [agentId]: { ...prev[agentId], status: 'completed' } }));
    };

    const runningCount = Object.values(agents).filter((a: any) => a.status === 'running').length;
    const totalCost = Object.values(agents).reduce((sum: number, a: any) => sum + (a.cost || 0), 0);
    const selectedConfig = AGENT_CONFIGS.find(a => a.id === selectedAgent);

    return (
        <View style={styles.agentsContainer}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>🤖 Ralph Agents</Text>
                <Text style={styles.headerSubtitle}>Continuous Autonomy</Text>
            </View>

            <View style={styles.statsRow}>
                <View style={styles.statBox}>
                    <Text style={styles.statValue}>{runningCount}</Text>
                    <Text style={styles.statLabel}>Running</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                    <Text style={[styles.statValue, { color: COLORS.solanaGreen }]}>${totalCost.toFixed(4)}</Text>
                    <Text style={styles.statLabel}>Cost</Text>
                </View>
            </View>

            <ScrollView style={styles.agentsList} contentContainerStyle={{ paddingBottom: 100 }}>
                {AGENT_CONFIGS.map(config => {
                    const state = agents[config.id];
                    return (
                        <TouchableOpacity
                            key={config.id}
                            onPress={() => { haptics.selection(); setSelectedAgent(config.id); setShowModal(true); }}
                            style={[styles.agentCard, { borderColor: `${config.color}40` }]}
                        >
                            <View style={styles.agentCardContent}>
                                <View style={[styles.agentIconBox, { backgroundColor: `${config.color}20` }]}>
                                    <Text style={styles.agentIcon}>{config.icon}</Text>
                                </View>
                                <View style={styles.agentInfo}>
                                    <Text style={styles.agentName}>{config.name}</Text>
                                    <Text style={styles.agentDesc}>{config.description}</Text>
                                </View>
                                <View style={[
                                    styles.statusBadge,
                                    { backgroundColor: state.status === 'running' ? COLORS.solanaGreen : state.status === 'completed' ? '#00D4FF' : COLORS.textMuted }
                                ]}>
                                    <Text style={styles.statusBadgeText}>{state.status}</Text>
                                </View>
                            </View>
                            {state.status === 'running' && (
                                <View style={styles.progressBarBg}>
                                    <View style={[styles.progressBarFill, { width: `${state.iterations * 16}%`, backgroundColor: config.color }]} />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {showModal && selectedConfig && (
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { borderColor: `${selectedConfig.color}40` }]}>
                        <View style={styles.modalHeader}>
                            <View style={[styles.agentIconBox, { backgroundColor: `${selectedConfig.color}20` }]}>
                                <Text style={styles.agentIcon}>{selectedConfig.icon}</Text>
                            </View>
                            <View style={styles.modalInfo}>
                                <Text style={styles.modalTitle}>{selectedConfig.name}</Text>
                                <Text style={styles.modalSubtitle}>{selectedConfig.description}</Text>
                            </View>
                            <TouchableOpacity onPress={() => { setShowModal(false); setIterations([]); setPrompt(''); }} style={styles.closeBtn}>
                                <Text style={styles.closeBtnText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {isRunning ? (
                            <ScrollView style={styles.iterationList}>
                                {iterations.map((it, i) => (
                                    <View key={i} style={styles.iterationCard}>
                                        <View style={styles.iterationMeta}>
                                            <View style={[styles.iterationNumber, { backgroundColor: selectedConfig.color }]}>
                                                <Text style={styles.iterationNumberText}>#{it.number}</Text>
                                            </View>
                                            <Text style={styles.iterationTime}>{it.timestamp}</Text>
                                            {it.verified && <Text style={styles.verifiedIcon}>✓</Text>}
                                        </View>
                                        <Text style={styles.iterationOutput}>{it.output}</Text>
                                    </View>
                                ))}
                            </ScrollView>
                        ) : (
                            <View style={styles.promptArea}>
                                <Text style={styles.promptLabel}>What should this agent do?</Text>
                                <TextInput
                                    value={prompt}
                                    onChangeText={setPrompt}
                                    placeholder="Enter a task..."
                                    placeholderTextColor={COLORS.textMuted}
                                    multiline
                                    style={styles.modalInput}
                                />
                                <TouchableOpacity
                                    onPress={() => selectedAgent && prompt.trim() && runAgent(selectedAgent, prompt)}
                                    disabled={!prompt.trim()}
                                    style={[styles.startButton, { backgroundColor: prompt.trim() ? selectedConfig.color : COLORS.textMuted }]}
                                >
                                    <Text style={styles.startButtonText}>▶ Start Agent Loop</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
};

// ============================================
// Beaver Game Component
// ============================================
const BeaverGame = ({ onEarn }: { onEarn?: (amt: number) => void }) => {
    const [coins, setCoins] = useState(0);
    const [combo, setCombo] = useState(1);
    const [lastTap, setLastTap] = useState(0);
    const [pops, setPops] = useState<any[]>([]);
    const tapAnim = useRef(new Animated.Value(1)).current;

    const handleTap = (e: any) => {
        const now = Date.now();
        let newCombo = now - lastTap < 350 ? Math.min(combo + 1, 50) : 1;
        const earned = (1 + newCombo * 0.1) / 10000;

        setCoins(c => c + earned);
        setCombo(newCombo);
        setLastTap(now);
        onEarn?.(earned);
        haptics.tap();

        Animated.sequence([
            Animated.timing(tapAnim, { toValue: 0.9, duration: 50, useNativeDriver: true }),
            Animated.timing(tapAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
        ]).start();

        const pop = { id: Math.random(), value: earned };
        setPops(prev => [...prev, pop].slice(-5));
        setTimeout(() => setPops(prev => prev.filter(p => p.id !== pop.id)), 800);
    };

    return (
        <View style={styles.beaverContainer}>
            <View style={styles.beaverHeader}>
                <Text style={styles.beaverStatLabel}>Session Yield</Text>
                <Text style={styles.beaverStatValue}>{coins.toFixed(5)}</Text>
            </View>

            {combo > 1 && (
                <LinearGradient
                    colors={[COLORS.solanaPurple, COLORS.solanaGreen]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.comboBadge}
                >
                    <Text style={styles.comboText}>{combo}x COMBO</Text>
                </LinearGradient>
            )}

            <View style={styles.beaverBody}>
                <Animated.View style={{ transform: [{ scale: tapAnim }] }}>
                    <TouchableOpacity
                        onPress={handleTap}
                        activeOpacity={0.8}
                        style={styles.beaverButton}
                    >
                        <Text style={styles.beaverEmoji}>🦫</Text>
                    </TouchableOpacity>
                </Animated.View>

                {pops.map(pop => (
                    <Animated.View key={pop.id} style={styles.popText}>
                        <Text style={styles.popValue}>+{pop.value.toFixed(5)} ◎</Text>
                    </Animated.View>
                ))}
            </View>

            <Text style={styles.beaverFooter}>+{((1 + combo * 0.1) / 10000).toFixed(5)} ◎ per tap</Text>
        </View>
    );
};

// ============================================
// Chess Component
// ============================================
const PIECES: any = {
    white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
    black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
};

const initBoard = () => {
    const p = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    const board: { piece: string | null, color: string | null }[] = Array(64).fill(null).map(() => ({ piece: null, color: null }));
    for (let i = 0; i < 8; i++) {
        board[i] = { piece: p[i], color: 'white' };
        board[i + 8] = { piece: 'pawn', color: 'white' };
        board[48 + i] = { piece: 'pawn', color: 'black' };
        board[56 + i] = { piece: p[i], color: 'black' };
    }
    return board;
};

const ChessGame = ({ isX402 = false }) => {
    const [board, setBoard] = useState(initBoard);
    const [selected, setSelected] = useState<number | null>(null);
    const [turn, setTurn] = useState<string>('white');
    const [moves, setMoves] = useState(0);
    const [fees, setFees] = useState(0);
    const [processing, setProcessing] = useState(false);
    const [lastMove, setLastMove] = useState<any>(null);

    const executeMove = (from: number, to: number) => {
        const newBoard = [...board];
        newBoard[to] = newBoard[from];
        newBoard[from] = { piece: null, color: null };
        setBoard(newBoard);
        setLastMove({ from, to });
        setTurn(turn === 'white' ? 'black' : 'white');
        setMoves(m => m + 1);
        if (isX402) setFees(f => f + 0.001);
        haptics.press();
    };

    const handleClick = (index: number) => {
        if (processing) return;
        const piece = board[index];

        if (selected !== null) {
            if (selected !== index) {
                if (isX402) {
                    setProcessing(true);
                    setTimeout(() => { executeMove(selected, index); setProcessing(false); haptics.success(); }, 1200);
                } else {
                    executeMove(selected, index);
                }
            }
            setSelected(null);
        } else if (piece.piece && piece.color === turn) {
            setSelected(index);
            haptics.tap();
        }
    };

    return (
        <View style={styles.chessContainer}>
            {processing && (
                <View style={styles.settlingOverlay}>
                    <Text style={styles.settlingText}>Settling Move...</Text>
                </View>
            )}

            <View style={styles.chessHeader}>
                <Text style={[styles.chessTitle, { color: isX402 ? COLORS.solanaGreen : COLORS.textPrimary }]}>
                    {isX402 ? '⚡ X402 CHESS' : '♟️ CLASSIC MODE'}
                </Text>
                <Text style={styles.chessSubtitle}>{isX402 ? 'Pay-Per-Move' : 'Local Sandbox'}</Text>
            </View>

            <View style={styles.chessStats}>
                <View style={styles.chessStatBox}>
                    <View style={styles.turnIndicator}>
                        <View style={[styles.turnDot, { backgroundColor: turn === 'white' ? '#E0E0E0' : COLORS.bgPrimary, borderColor: turn === 'white' ? 'transparent' : COLORS.textMuted }]} />
                        <Text style={styles.turnText}>{turn}'s turn</Text>
                    </View>
                    <Text style={styles.moveCount}>{moves} Moves</Text>
                </View>
                <View style={[styles.chessStatBox, { alignItems: 'flex-end' }]}>
                    <Text style={styles.turnText}>{isX402 ? 'Fees' : 'Mode'}</Text>
                    <Text style={[styles.feeText, { color: isX402 ? COLORS.solanaGreen : COLORS.textPrimary }]}>
                        {isX402 ? fees.toFixed(4) : 'FREE'}
                    </Text>
                </View>
            </View>

            <View style={styles.boardWrapper}>
                <View style={styles.board}>
                    {Array.from({ length: 64 }).map((_, i) => {
                        const row = Math.floor(i / 8);
                        const col = i % 8;
                        const idx = (7 - row) * 8 + col;
                        const isLight = (row + col) % 2 === 0;
                        const piece = board[idx];
                        const isSelected = selected === idx;
                        const isLastMoveSquare = lastMove?.from === idx || lastMove?.to === idx;

                        return (
                            <TouchableOpacity
                                key={i}
                                onPress={() => handleClick(idx)}
                                activeOpacity={0.8}
                                style={[
                                    styles.square,
                                    {
                                        backgroundColor: isSelected ? 'rgba(153,69,255,0.6)' : isLight ? CHESS_COLORS.lightSquare : CHESS_COLORS.darkSquare,
                                        borderColor: isLastMoveSquare ? COLORS.solanaGreen : 'transparent',
                                        borderWidth: isLastMoveSquare ? 1 : 0
                                    }
                                ]}
                            >
                                {piece?.piece && piece.color && (
                                    <Text style={[
                                        styles.pieceText,
                                        { color: piece.color === 'white' ? CHESS_COLORS.whitePiece : CHESS_COLORS.blackPiece }
                                    ]}>
                                        {PIECES[piece.color][piece.piece]}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <TouchableOpacity
                onPress={() => { setBoard(initBoard()); setTurn('white'); setMoves(0); setFees(0); setSelected(null); setLastMove(null); haptics.impact(); }}
                style={styles.resetBtn}
            >
                <Text style={styles.resetBtnText}>Reset Game</Text>
            </TouchableOpacity>
        </View>
    );
};

// ============================================
// Portfolio Component
// ============================================
const Portfolio = () => {
    const tokens = [
        { symbol: 'SOL', balance: 12.345, value: 2469.00, change: 5.2 },
        { symbol: 'USDC', balance: 500.00, value: 500.00, change: 0 },
        { symbol: 'JUP', balance: 1250, value: 187.50, change: -2.1 },
        { symbol: 'BONK', balance: 50000000, value: 150.00, change: 12.5 },
    ];
    const total = tokens.reduce((sum, t) => sum + t.value, 0);

    return (
        <ScrollView style={styles.portfolioScroll}>
            <View style={styles.portfolioHeader}>
                <Text style={styles.portfolioLabel}>Portfolio Value</Text>
                <Text style={styles.portfolioValue}>${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                <View style={styles.changeBadge}>
                    <Text style={styles.changeText}>▲ +4.2% 24H</Text>
                </View>
            </View>

            <View style={styles.tokenList}>
                {tokens.map((t, i) => (
                    <View key={i} style={styles.tokenCard}>
                        <View style={styles.tokenMain}>
                            <LinearGradient colors={[COLORS.solanaPurple, COLORS.solanaGreen]} style={styles.tokenIcon}>
                                <Text style={styles.tokenIconText}>{t.symbol.slice(0, 2)}</Text>
                            </LinearGradient>
                            <View>
                                <Text style={styles.tokenSymbol}>{t.symbol}</Text>
                                <Text style={styles.tokenBalance}>{t.balance.toLocaleString()}</Text>
                            </View>
                        </View>
                        <View style={styles.tokenValues}>
                            <Text style={styles.tokenValueText}>${t.value.toLocaleString()}</Text>
                            <Text style={[styles.tokenChangeText, { color: t.change >= 0 ? COLORS.solanaGreen : COLORS.error }]}>
                                {t.change >= 0 ? '+' : ''}{t.change}%
                            </Text>
                        </View>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
};

// ============================================
// Settings Component
// ============================================
const Settings = ({ onLock }: { onLock: () => void }) => {
    return (
        <ScrollView style={styles.settingsScroll}>
            <View style={styles.settingsHeader}>
                <View style={styles.avatarBorder}>
                    <View style={styles.avatarInner}>
                        <Text style={styles.avatarIcon}>◎</Text>
                    </View>
                </View>
                <Text style={styles.profileTitle}>Demo Mode</Text>
                <Text style={styles.profileAddr}>8bit...Labs</Text>
            </View>

            <View style={styles.settingsSection}>
                <Text style={styles.sectionTitle}>Network</Text>
                <View style={styles.settingsList}>
                    <View style={styles.settingsItem}>
                        <Text style={styles.settingsItemLabel}>Cluster</Text>
                        <Text style={styles.settingsItemValue}>MAINNET-BETA</Text>
                    </View>
                    <View style={[styles.settingsItem, { borderBottomWidth: 0 }]}>
                        <Text style={styles.settingsItemLabel}>Latency</Text>
                        <Text style={styles.settingsItemValue}>24ms</Text>
                    </View>
                </View>
            </View>

            <View style={styles.settingsSection}>
                <Text style={styles.sectionTitle}>System</Text>
                <View style={styles.settingsList}>
                    <View style={styles.settingsItem}>
                        <Text style={styles.settingsItemLabel}>Version</Text>
                        <Text style={styles.settingsItemValue}>1.0.0</Text>
                    </View>
                    <View style={[styles.settingsItem, { borderBottomWidth: 0 }]}>
                        <Text style={styles.settingsItemLabel}>Build</Text>
                        <Text style={styles.settingsItemValue}>2025-01</Text>
                    </View>
                </View>
            </View>

            <TouchableOpacity onPress={onLock} style={styles.lockButton}>
                <Text style={styles.lockButtonText}>Lock Device</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

// ============================================
// Main Solana OS Component
// ============================================
export default function SolanaOS() {
    const [osState, setOsState] = useState('booting');
    const [activeTab, setActiveTab] = useState('terminal');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [balance, setBalance] = useState(12.34567);
    const [bootProgress, setBootProgress] = useState(0);

    useEffect(() => {
        const boot = setInterval(() => {
            setBootProgress(p => {
                if (p >= 100) { clearInterval(boot); setTimeout(() => setOsState('locked'), 300); return 100; }
                return p + Math.random() * 20;
            });
        }, 80);
        return () => clearInterval(boot);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const tabs = ['terminal', 'agents', 'beaver', 'chess', 'x402', 'portfolio', 'settings'];

    const renderView = () => {
        switch (activeTab) {
            case 'terminal': return <Terminal />;
            case 'agents': return <RalphAgents />;
            case 'beaver': return <BeaverGame onEarn={(amt) => setBalance(b => b + amt)} />;
            case 'chess': return <ChessGame isX402={false} />;
            case 'x402': return <ChessGame isX402={true} />;
            case 'portfolio': return <Portfolio />;
            case 'settings': return <Settings onLock={() => setOsState('locked')} />;
            default: return <Terminal />;
        }
    };

    if (osState === 'booting') {
        return (
            <View style={styles.bootContainer}>
                <View style={styles.bootContent}>
                    <Text style={styles.bootLogo}>◎</Text>
                    <View style={styles.bootBarBg}>
                        <LinearGradient
                            colors={[COLORS.solanaPurple, COLORS.solanaGreen]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.bootBarFill, { width: `${bootProgress}%` }]}
                        />
                    </View>
                    <Text style={styles.bootText}>Loading Solana OS...</Text>
                </View>
            </View>
        );
    }

    if (osState === 'locked') {
        return (
            <TouchableOpacity
                style={styles.lockScreen}
                onPress={() => { haptics.impact(); setOsState('unlocked'); }}
                activeOpacity={1}
            >
                <LinearGradient
                    colors={[`${COLORS.solanaPurple}20`, COLORS.bgPrimary]}
                    style={styles.lockGradient}
                >
                    <View style={styles.lockContent}>
                        <Text style={styles.lockTime}>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                        <Text style={styles.lockDate}>{currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
                        <View style={styles.lockIconBox}>
                            <Text style={styles.lockIconText}>◎</Text>
                        </View>
                        <Text style={styles.tapToUnlock}>Tap to Unlock</Text>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <View style={styles.appContainer}>
                {/* Status Bar Spacer */}
                <View style={styles.statusBarSpacer}>
                    <Text style={styles.statusTime}>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    <View style={styles.batteryIcon}>
                        <View style={[styles.batteryLevel, { width: '80%' }]} />
                    </View>
                </View>

                {/* Dynamic Island Look */}
                <View style={styles.dynamicIsland}>
                    <View style={styles.islandDot} />
                    <View style={styles.islandBar} />
                </View>

                {/* Header */}
                <View style={styles.appHeader}>
                    <View style={styles.headerMain}>
                        <View style={styles.logoBox}>
                            <Text style={styles.logoIcon}>◎</Text>
                        </View>
                        <View>
                            <Text style={styles.osTitle}>SOL_OS</Text>
                            <View style={styles.networkBadge}>
                                <View style={styles.networkDot} />
                                <Text style={styles.networkName}>MAINNET</Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.headerBalance}>
                        <Text style={styles.balanceLabel}>Balance</Text>
                        <Text style={styles.balanceValue}>{balance.toFixed(4)} <Text style={styles.balanceUnit}>SOL</Text></Text>
                    </View>
                </View>

                {/* Content View */}
                <View style={styles.contentView}>{renderView()}</View>

                {/* Dock Navigation */}
                <View style={styles.dock}>
                    {tabs.map((tabId) => {
                        const config = TAB_CONFIG[tabId];
                        const isActive = activeTab === tabId;
                        return (
                            <TouchableOpacity
                                key={tabId}
                                onPress={() => { haptics.selection(); setActiveTab(tabId); }}
                                style={styles.dockItem}
                            >
                                <View style={[
                                    styles.dockIconBox,
                                    isActive && styles.dockIconActive,
                                    isActive && { borderColor: `${config.color}40` }
                                ]}>
                                    <Text style={[styles.dockIcon, { color: isActive ? config.color : COLORS.textMuted }]}>{config.icon}</Text>
                                </View>
                                <Text style={[styles.dockLabel, { color: isActive ? COLORS.textPrimary : COLORS.textMuted }]}>{config.label}</Text>
                                {isActive && <View style={[styles.activeIndicator, { backgroundColor: config.color }]} />}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Home Bar */}
                <TouchableOpacity
                    style={styles.homeBar}
                    onPress={() => { haptics.press(); setOsState('locked'); }}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.bgPrimary },
    appContainer: { flex: 1, backgroundColor: COLORS.bgPrimary },

    // Boot
    bootContainer: { flex: 1, backgroundColor: COLORS.bgPrimary, alignItems: 'center', justifyContent: 'center' },
    bootContent: { alignItems: 'center', gap: 24 },
    bootLogo: { fontSize: 80, fontWeight: '900', color: COLORS.solanaPurple, textShadowColor: `${COLORS.solanaPurple}60`, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 40 },
    bootBarBg: { width: 192, height: 4, borderRadius: 2, backgroundColor: `${COLORS.textMuted}20`, overflow: 'hidden' },
    bootBarFill: { height: '100%', borderRadius: 2 },
    bootText: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 2, textTransform: 'uppercase' },

    // Lock Screen
    lockScreen: { flex: 1 },
    lockGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    lockContent: { alignItems: 'center' },
    lockTime: { fontSize: 72, fontWeight: '100', color: COLORS.textPrimary },
    lockDate: { fontSize: 16, fontWeight: '700', color: `${COLORS.solanaPurple}80`, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 96 },
    lockIconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: `${COLORS.textMuted}10`, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
    lockIconText: { fontSize: 24, fontWeight: '900', color: COLORS.solanaPurple },
    tapToUnlock: { marginTop: 24, fontSize: 10, fontWeight: '700', color: `${COLORS.textMuted}60`, letterSpacing: 1.5, textTransform: 'uppercase' },

    // Layout
    statusBarSpacer: { height: 44, paddingHorizontal: 32, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 100 },
    statusTime: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    batteryIcon: { width: 16, height: 8, borderRadius: 2, borderWidth: 1, borderColor: COLORS.textMuted, padding: 1 },
    batteryLevel: { height: '100%', borderRadius: 1, backgroundColor: COLORS.solanaGreen },

    dynamicIsland: { position: 'absolute', top: 12, alignSelf: 'center', width: 112, height: 28, borderRadius: 14, backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, zIndex: 100 },
    islandDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.solanaPurple },
    islandBar: { width: 4, height: 10, borderRadius: 2, backgroundColor: `${COLORS.solanaGreen}60` },

    appHeader: { paddingTop: 14, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: `${COLORS.bgSecondary}ee`, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    headerMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    logoBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.bgPrimary, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
    logoIcon: { fontSize: 20, color: COLORS.solanaPurple },
    osTitle: { fontSize: 12, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: 2 },
    networkBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    networkDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.solanaGreen },
    networkName: { fontSize: 8, fontWeight: '700', color: COLORS.textMuted },
    headerBalance: { alignItems: 'flex-end' },
    balanceLabel: { fontSize: 8, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase' },
    balanceValue: { fontSize: 14, fontWeight: '900', color: COLORS.solanaGreen, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    balanceUnit: { opacity: 0.5, fontSize: 10 },

    contentView: { flex: 1 },

    dock: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingBottom: 32, paddingTop: 12, paddingHorizontal: 8, backgroundColor: `${COLORS.bgSecondary}f5`, borderTopWidth: 1, borderTopColor: COLORS.border },
    dockItem: { alignItems: 'center', gap: 4 },
    dockIconBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
    dockIconActive: { backgroundColor: `${COLORS.textMuted}15` },
    dockIcon: { fontSize: 20 },
    dockLabel: { fontSize: 7, fontWeight: '700', textTransform: 'uppercase' },
    activeIndicator: { width: 4, height: 4, borderRadius: 2, position: 'absolute', bottom: -6 },
    homeBar: { position: 'absolute', bottom: 8, alignSelf: 'center', width: 128, height: 4, borderRadius: 2, backgroundColor: `${COLORS.textMuted}20` },

    // Components Styles
    terminalContainer: { flex: 1 },
    terminalScroll: { flex: 1 },
    messageWrapper: { marginBottom: 16 },
    messageBubble: { maxWidth: '90%', padding: 16, borderRadius: 20 },
    messageMeta: { gap: 8, opacity: 0.5, marginBottom: 8 },
    messageRoleText: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
    messageMetaSpacer: { opacity: 0.3 },
    messageTimeText: { fontSize: 9 },
    messageContentText: { fontSize: 13, color: COLORS.textPrimary, lineHeight: 18 },
    typingIndicator: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: `${COLORS.solanaGreen}10`, borderWidth: 1, borderColor: `${COLORS.solanaGreen}20`, alignSelf: 'flex-start' },
    typingText: { fontSize: 10, fontWeight: '700', color: COLORS.solanaGreen, textTransform: 'uppercase', letterSpacing: 2 },
    inputArea: { padding: 16, backgroundColor: `${COLORS.bgPrimary}ee`, borderTopWidth: 1, borderTopColor: COLORS.border },
    inputWrapper: { flexDirection: 'row', gap: 8, position: 'relative' },
    inputPrefix: { position: 'absolute', left: 16, top: 16, fontWeight: '700', fontSize: 12, color: `${COLORS.solanaPurple}60`, zIndex: 1 },
    terminalInput: { flex: 1, borderRadius: 12, backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.border, paddingLeft: 48, paddingRight: 16, paddingVertical: 16, color: COLORS.textPrimary, fontSize: 14 },
    execButton: { paddingHorizontal: 24, justifyContent: 'center', borderRadius: 12, backgroundColor: COLORS.solanaGreen },
    execButtonText: { fontSize: 11, fontWeight: '900', color: COLORS.bgPrimary, letterSpacing: 2 },

    agentsContainer: { flex: 1, padding: 16 },
    header: { alignItems: 'center', marginBottom: 12 },
    headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.textPrimary },
    headerSubtitle: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 2 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
    statBox: { alignItems: 'center' },
    statValue: { fontSize: 18, fontWeight: '900', color: COLORS.textPrimary },
    statLabel: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase' },
    statDivider: { width: 1, backgroundColor: COLORS.border },
    agentsList: { flex: 1 },
    agentCard: { padding: 12, borderRadius: 12, backgroundColor: COLORS.bgSecondary, borderWidth: 1, marginBottom: 8 },
    agentCardContent: { flexDirection: 'row', alignItems: 'center' },
    agentIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    agentIcon: { fontSize: 24 },
    agentInfo: { flex: 1, marginLeft: 12 },
    agentName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
    agentDesc: { fontSize: 10, color: COLORS.textMuted },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    statusBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.bgPrimary, textTransform: 'uppercase' },
    progressBarBg: { height: 4, borderRadius: 2, backgroundColor: `${COLORS.textMuted}30`, marginTop: 8, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 2 },

    modalOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end', zIndex: 1000 },
    modalContent: { width: '100%', height: '80%', borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderBottomWidth: 0, padding: 20 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    modalInfo: { flex: 1, marginLeft: 12 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    modalSubtitle: { fontSize: 10, color: COLORS.textMuted },
    closeBtn: { padding: 8 },
    closeBtnText: { fontSize: 24, color: COLORS.textMuted },
    iterationList: { flex: 1 },
    iterationCard: { padding: 12, borderRadius: 12, backgroundColor: `${COLORS.bgPrimary}80`, marginBottom: 8 },
    iterationMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    iterationNumber: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    iterationNumberText: { fontSize: 10, fontWeight: '700', color: COLORS.bgPrimary },
    iterationTime: { fontSize: 9, color: COLORS.textMuted },
    verifiedIcon: { marginLeft: 'auto', fontSize: 12, color: COLORS.solanaGreen },
    iterationOutput: { fontSize: 12, color: COLORS.textPrimary },
    promptArea: { flex: 1 },
    promptLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
    modalInput: { width: '100%', height: 80, padding: 12, borderRadius: 12, backgroundColor: COLORS.bgPrimary, borderWidth: 1, borderColor: COLORS.border, color: COLORS.textPrimary, fontSize: 14, textAlignVertical: 'top' },
    startButton: { width: '100%', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 12 },
    startButtonText: { fontSize: 14, fontWeight: '700', color: COLORS.bgPrimary },

    beaverContainer: { flex: 1, alignItems: 'center', paddingTop: 24, paddingHorizontal: 16 },
    beaverHeader: { alignItems: 'center', marginBottom: 16 },
    beaverStatLabel: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 2 },
    beaverStatValue: { fontSize: 48, fontWeight: '900', color: COLORS.solanaGreen },
    comboBadge: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 16, marginBottom: 16 },
    comboText: { fontSize: 20, fontWeight: '900', color: COLORS.textPrimary },
    beaverBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    beaverButton: { width: 176, height: 176, borderRadius: 88, backgroundColor: '#FFA500', alignItems: 'center', justifyContent: 'center', borderWidth: 6, borderColor: 'rgba(255,255,255,0.1)' },
    beaverEmoji: { fontSize: 80 },
    popText: { position: 'absolute', top: -40 },
    popValue: { fontSize: 14, fontWeight: '900', color: COLORS.solanaGreen },
    beaverFooter: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, marginBottom: 44 },

    chessContainer: { flex: 1, padding: 16 },
    settlingOverlay: { position: 'absolute', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
    settlingText: { fontSize: 12, fontWeight: '900', color: COLORS.solanaGreen, textTransform: 'uppercase', letterSpacing: 2 },
    chessHeader: { alignItems: 'center', marginBottom: 12 },
    chessTitle: { fontSize: 18, fontWeight: '900' },
    chessSubtitle: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 2 },
    chessStats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    chessStatBox: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.border },
    turnIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    turnDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
    turnText: { fontSize: 9, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase' },
    moveCount: { fontSize: 18, fontWeight: '900', color: COLORS.textPrimary },
    feeText: { fontSize: 18, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    boardWrapper: { width: '100%', aspectRatio: 1, backgroundColor: COLORS.bgTertiary, borderRadius: 12, overflow: 'hidden', padding: 3 },
    board: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
    square: { width: '12.5%', height: '12.5%', alignItems: 'center', justifyContent: 'center' },
    pieceText: { fontSize: 28 },
    resetBtn: { marginTop: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
    resetBtnText: { fontSize: 10, fontWeight: '900', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 2 },

    portfolioScroll: { flex: 1 },
    portfolioHeader: { alignItems: 'center', paddingVertical: 24 },
    portfolioLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 2 },
    portfolioValue: { fontSize: 40, fontWeight: '900', color: COLORS.solanaGreen },
    changeBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: `${COLORS.solanaGreen}15`, marginTop: 8 },
    changeText: { fontSize: 11, fontWeight: '700', color: COLORS.solanaGreen },
    tokenList: { paddingHorizontal: 16 },
    tokenCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
    tokenMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    tokenIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    tokenIconText: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
    tokenSymbol: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
    tokenBalance: { fontSize: 10, color: COLORS.textMuted },
    tokenValues: { alignItems: 'flex-end' },
    tokenValueText: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
    tokenChangeText: { fontSize: 10, fontWeight: '700' },

    settingsScroll: { flex: 1 },
    settingsHeader: { alignItems: 'center', paddingVertical: 24 },
    avatarBorder: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.solanaPurple, padding: 2, marginBottom: 12 },
    avatarInner: { flex: 1, borderRadius: 38, backgroundColor: COLORS.bgPrimary, alignItems: 'center', justifyContent: 'center' },
    avatarIcon: { fontSize: 32, fontWeight: '900', color: COLORS.solanaPurple },
    profileTitle: { fontSize: 18, fontWeight: '900', color: COLORS.textPrimary },
    profileAddr: { fontSize: 12, color: COLORS.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    settingsSection: { marginBottom: 16, paddingHorizontal: 16 },
    sectionTitle: { fontSize: 10, fontWeight: '700', color: COLORS.solanaPurple, marginBottom: 8, letterSpacing: 2, textTransform: 'uppercase' },
    settingsList: { borderRadius: 12, backgroundColor: COLORS.bgSecondary, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
    settingsItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    settingsItemLabel: { fontSize: 14, color: COLORS.textSecondary },
    settingsItemValue: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
    lockButton: { margin: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: `${COLORS.error}15`, borderWidth: 1, borderColor: `${COLORS.error}30`, alignItems: 'center' },
    lockButtonText: { fontSize: 11, fontWeight: '700', color: COLORS.error, textTransform: 'uppercase', letterSpacing: 2 },
});
