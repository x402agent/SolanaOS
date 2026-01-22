/**
 * Solana Chess - Full React Application
 * 
 * Features:
 * - Wallet connection
 * - Real-time lobby chat
 * - Leaderboard
 * - Game creation and matchmaking
 * - Live games spectating
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useConvex } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Chess } from 'chess.js';

// ============ Types ============

interface Player {
  _id: string;
  walletAddress: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  winStreak: number;
  bestWinStreak: number;
  totalWon: number;
  isOnline: boolean;
}

interface LeaderboardEntry extends Player {
  rank: number;
  winRate: string;
}

interface ChatMessage {
  _id: string;
  playerId: string;
  username: string;
  message: string;
  timestamp: number;
  type: 'message' | 'system' | 'challenge' | 'join' | 'leave';
}

interface Game {
  _id: string;
  code: string;
  status: 'waiting' | 'playing' | 'finished';
  white?: Player;
  black?: Player;
  fen: string;
  pgn: string;
  turn: 'w' | 'b';
  winner?: 'white' | 'black' | 'draw';
  timeControl: number;
  wagerAmount?: number;
  isRanked: boolean;
}

// ============ Pieces ============

const PIECES: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

// ============ Wallet Hook ============

function useWallet() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);

  const connect = async () => {
    // @ts-ignore
    if (window.solana?.isPhantom) {
      try {
        // @ts-ignore
        const resp = await window.solana.connect();
        setAddress(resp.publicKey.toString());
        setConnected(true);
        setBalance(Math.random() * 10 + 1);
        return resp.publicKey.toString();
      } catch (e) {
        console.error(e);
      }
    }
    // Demo mode
    const demo = 'Demo' + Math.random().toString(36).substring(2, 8);
    setAddress(demo);
    setConnected(true);
    setBalance(5.0);
    return demo;
  };

  const disconnect = () => {
    setConnected(false);
    setAddress(null);
    setBalance(0);
  };

  return { connected, address, balance, connect, disconnect };
}

// ============ Main App ============

export default function SolanaChessFullApp() {
  const wallet = useWallet();
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [view, setView] = useState<'connect' | 'lobby' | 'leaderboard' | 'game'>('connect');
  const [currentGame, setCurrentGame] = useState<Game | null>(null);

  // Convex mutations
  const createOrUpdatePlayer = useMutation(api.players.createOrUpdatePlayer);
  const setPlayerOnline = useMutation(api.players.setPlayerOnline);

  // Initialize player when wallet connects
  useEffect(() => {
    if (wallet.connected && wallet.address) {
      const initPlayer = async () => {
        const playerId = await createOrUpdatePlayer({
          walletAddress: wallet.address!,
          username: `Player_${wallet.address!.substring(0, 6)}`,
        });
        // Fetch player data
        // In real app, would use a query here
        setCurrentPlayer({
          _id: playerId as string,
          walletAddress: wallet.address!,
          username: `Player_${wallet.address!.substring(0, 6)}`,
          rating: 1200,
          wins: 0,
          losses: 0,
          draws: 0,
          gamesPlayed: 0,
          winStreak: 0,
          bestWinStreak: 0,
          totalWon: 0,
          isOnline: true,
        });
        setView('lobby');
      };
      initPlayer();
    }
  }, [wallet.connected, wallet.address]);

  // Handle disconnect
  useEffect(() => {
    return () => {
      if (currentPlayer?._id) {
        setPlayerOnline({ playerId: currentPlayer._id as any, isOnline: false });
      }
    };
  }, [currentPlayer]);

  // ============ Render ============

  if (view === 'connect') {
    return <ConnectScreen onConnect={wallet.connect} />;
  }

  if (view === 'leaderboard') {
    return (
      <LeaderboardScreen
        currentPlayer={currentPlayer!}
        wallet={wallet}
        onBack={() => setView('lobby')}
      />
    );
  }

  if (view === 'game' && currentGame) {
    return (
      <GameScreen
        game={currentGame}
        currentPlayer={currentPlayer!}
        wallet={wallet}
        onLeave={() => {
          setCurrentGame(null);
          setView('lobby');
        }}
      />
    );
  }

  return (
    <LobbyScreen
      currentPlayer={currentPlayer!}
      wallet={wallet}
      onViewLeaderboard={() => setView('leaderboard')}
      onJoinGame={(game) => {
        setCurrentGame(game);
        setView('game');
      }}
      onDisconnect={() => {
        wallet.disconnect();
        setCurrentPlayer(null);
        setView('connect');
      }}
    />
  );
}

// ============ Connect Screen ============

function ConnectScreen({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-8xl mb-6 animate-bounce">♟️</div>
        <h1 className="text-5xl font-bold text-white mb-4">
          <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
            Solana Chess
          </span>
        </h1>
        <p className="text-gray-400 text-xl mb-8 max-w-md">
          Play real-time chess with SOL wagering, leaderboards, and AI agents
        </p>
        
        <button
          onClick={onConnect}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-8 py-4 rounded-2xl text-xl font-bold transition-all transform hover:scale-105 shadow-lg shadow-purple-500/30"
        >
          Connect Wallet
        </button>

        <div className="mt-8 flex justify-center gap-6 text-gray-500">
          <div className="flex items-center gap-2">
            <span>🏆</span>
            <span>Leaderboards</span>
          </div>
          <div className="flex items-center gap-2">
            <span>💬</span>
            <span>Live Chat</span>
          </div>
          <div className="flex items-center gap-2">
            <span>🤖</span>
            <span>AI Agents</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Lobby Screen ============

function LobbyScreen({
  currentPlayer,
  wallet,
  onViewLeaderboard,
  onJoinGame,
  onDisconnect,
}: {
  currentPlayer: Player;
  wallet: ReturnType<typeof useWallet>;
  onViewLeaderboard: () => void;
  onJoinGame: (game: Game) => void;
  onDisconnect: () => void;
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'games' | 'chat' | 'online'>('games');
  
  // Convex queries
  const availableGames = useQuery(api.games.getAvailableGames) || [];
  const onlinePlayers = useQuery(api.players.getOnlinePlayers) || [];
  const globalStats = useQuery(api.games.getGlobalStats);
  const lobbyMessages = useQuery(api.chat.getLobbyMessages, { limit: 50 }) || [];

  // Convex mutations
  const createGame = useMutation(api.games.createGame);
  const sendLobbyMessage = useMutation(api.chat.sendLobbyMessage);

  const [chatInput, setChatInput] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [lobbyMessages]);

  const handleCreateGame = async (options: {
    side: 'white' | 'black' | 'random';
    timeControl: number;
    wagerAmount?: number;
  }) => {
    const result = await createGame({
      hostPlayerId: currentPlayer._id as any,
      side: options.side,
      timeControl: options.timeControl,
      wagerAmount: options.wagerAmount,
      isRanked: true,
    });
    
    // Join the created game
    // Would fetch full game here
    setShowCreateModal(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    await sendLobbyMessage({
      playerId: currentPlayer._id as any,
      message: chatInput,
    });
    setChatInput('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur border-b border-white/10 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">♟️</span>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              Solana Chess
            </h1>
          </div>
          
          {/* Stats Bar */}
          {globalStats && (
            <div className="hidden md:flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-green-400">●</span>
                <span className="text-gray-400">{globalStats.onlinePlayers} online</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-yellow-400">⚔️</span>
                <span className="text-gray-400">{globalStats.activeGames} playing</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-400">🎮</span>
                <span className="text-gray-400">{globalStats.totalGamesPlayed.toLocaleString()} games today</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              onClick={onViewLeaderboard}
              className="flex items-center gap-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-4 py-2 rounded-lg transition-colors"
            >
              🏆 Leaderboard
            </button>
            <div className="bg-white/10 rounded-xl px-4 py-2 flex items-center gap-3">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="font-medium">{currentPlayer.username}</span>
              <span className="text-purple-400 font-mono text-sm">
                {wallet.balance.toFixed(2)} SOL
              </span>
            </div>
            <button
              onClick={onDisconnect}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-2xl p-6 text-left transition-all hover:scale-[1.02]"
          >
            <div className="text-3xl mb-2">⚡</div>
            <div className="text-xl font-bold">Quick Play</div>
            <div className="text-white/70">3 min Blitz</div>
          </button>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-white/5 hover:bg-white/10 rounded-2xl p-6 text-left border border-white/10 transition-all hover:scale-[1.02]"
          >
            <div className="text-3xl mb-2">🎮</div>
            <div className="text-xl font-bold">New Game</div>
            <div className="text-gray-400">Custom settings</div>
          </button>
          
          <button
            onClick={() => alert('Coming soon!')}
            className="bg-white/5 hover:bg-white/10 rounded-2xl p-6 text-left border border-white/10 transition-all hover:scale-[1.02]"
          >
            <div className="text-3xl mb-2">🤖</div>
            <div className="text-xl font-bold">Play AI</div>
            <div className="text-gray-400">Challenge bots</div>
          </button>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Panel - Games/Players */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="flex gap-2 bg-white/5 rounded-xl p-1">
              {(['games', 'online'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors capitalize ${
                    activeTab === tab
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab === 'games' ? '🎮 Open Games' : '👥 Online Players'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="bg-white/5 rounded-2xl border border-white/10">
              {activeTab === 'games' && (
                <div className="p-4">
                  {availableGames.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <span className="text-5xl mb-4 block">🎲</span>
                      <p>No games available. Create one!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {availableGames.map((game: any) => (
                        <div
                          key={game._id}
                          className="bg-white/5 rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-all cursor-pointer"
                          onClick={() => onJoinGame(game)}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-2xl">
                              {game.wagerAmount ? '💰' : '♟️'}
                            </div>
                            <div>
                              <div className="font-bold">
                                {game.white?.username || game.black?.username}'s Game
                              </div>
                              <div className="text-sm text-gray-400 flex items-center gap-3">
                                <span>⏱️ {game.timeControl / 60}min</span>
                                <span className="font-mono text-purple-400">{game.code}</span>
                                {game.wagerAmount && (
                                  <span className="text-yellow-400">{game.wagerAmount} SOL</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button className="bg-purple-600 hover:bg-purple-500 px-6 py-2 rounded-lg font-medium transition-colors">
                            Join
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'online' && (
                <div className="p-4">
                  <div className="space-y-2">
                    {onlinePlayers.map((player: any) => (
                      <div
                        key={player._id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center font-bold">
                            {player.username[0]}
                          </div>
                          <div>
                            <div className="font-medium">{player.username}</div>
                            <div className="text-sm text-gray-400">
                              Rating: {player.rating} • {player.wins}W/{player.losses}L
                            </div>
                          </div>
                        </div>
                        {player._id !== currentPlayer._id && (
                          <button className="bg-green-600/20 hover:bg-green-600/30 text-green-400 px-4 py-2 rounded-lg text-sm transition-colors">
                            Challenge
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Lobby Chat */}
          <div className="bg-white/5 rounded-2xl border border-white/10 flex flex-col h-[600px]">
            <div className="p-4 border-b border-white/10">
              <h3 className="font-bold flex items-center gap-2">
                💬 Lobby Chat
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                  Live
                </span>
              </h3>
            </div>

            <div
              ref={chatRef}
              className="flex-1 overflow-y-auto p-4 space-y-3"
            >
              {lobbyMessages.map((msg: any) => (
                <div
                  key={msg._id}
                  className={`text-sm ${
                    msg.type === 'system' ? 'text-yellow-400 bg-yellow-400/10 p-2 rounded' :
                    msg.type === 'challenge' ? 'text-pink-400 bg-pink-400/10 p-2 rounded' :
                    msg.type === 'join' ? 'text-green-400 text-xs' :
                    msg.type === 'leave' ? 'text-gray-500 text-xs' : ''
                  }`}
                >
                  {msg.type === 'message' && (
                    <>
                      <span className={`font-bold ${
                        msg.playerId === currentPlayer._id ? 'text-purple-400' : 'text-blue-400'
                      }`}>
                        {msg.username}:
                      </span>{' '}
                      <span className="text-gray-300">{msg.message}</span>
                    </>
                  )}
                  {msg.type !== 'message' && msg.message}
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg font-medium"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Create Game Modal */}
      {showCreateModal && (
        <CreateGameModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateGame}
        />
      )}
    </div>
  );
}

// ============ Create Game Modal ============

function CreateGameModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (options: { side: 'white' | 'black' | 'random'; timeControl: number; wagerAmount?: number }) => void;
}) {
  const [side, setSide] = useState<'white' | 'black' | 'random'>('random');
  const [timeControl, setTimeControl] = useState(300);
  const [wagerAmount, setWagerAmount] = useState(0);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-white/10">
        <h3 className="text-2xl font-bold mb-6 text-white">Create Game</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Your Side</label>
            <div className="grid grid-cols-3 gap-2">
              {(['white', 'random', 'black'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={`py-3 rounded-lg font-medium capitalize transition-all ${
                    side === s ? 'bg-purple-600' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {s === 'white' && '⬜'} {s === 'black' && '⬛'} {s === 'random' && '🎲'} {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Time Control</label>
            <div className="grid grid-cols-4 gap-2">
              {[180, 300, 600, 900].map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeControl(t)}
                  className={`py-2 rounded-lg font-medium transition-all ${
                    timeControl === t ? 'bg-purple-600' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {t / 60}m
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Wager (SOL) - Optional</label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={wagerAmount}
              onChange={(e) => setWagerAmount(parseFloat(e.target.value) || 0)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 text-white"
            />
            {wagerAmount > 0 && (
              <p className="text-sm text-yellow-400 mt-2">
                💰 Winner takes {(wagerAmount * 2 * 0.975).toFixed(3)} SOL
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl font-medium text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => onCreate({ side, timeControl, wagerAmount: wagerAmount || undefined })}
            className="flex-1 bg-purple-600 hover:bg-purple-500 py-3 rounded-xl font-bold text-white"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ Leaderboard Screen ============

function LeaderboardScreen({
  currentPlayer,
  wallet,
  onBack,
}: {
  currentPlayer: Player;
  wallet: ReturnType<typeof useWallet>;
  onBack: () => void;
}) {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'allTime'>('allTime');
  const [sortBy, setSortBy] = useState<'rating' | 'wins' | 'winStreak' | 'totalWon'>('rating');
  
  const leaderboard = useQuery(api.players.getLeaderboard, { period, limit: 50 }) || [];
  const playerRank = useQuery(api.players.getPlayerRank, { playerId: currentPlayer._id as any });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur border-b border-white/10 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            ← Back to Lobby
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            🏆 Leaderboard
          </h1>
          <div className="bg-white/10 rounded-xl px-4 py-2">
            <span className="text-purple-400">{wallet.balance.toFixed(2)} SOL</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {/* Your Rank Card */}
        {playerRank && (
          <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl p-6 border border-purple-500/30 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-3xl font-bold">
                  #{playerRank.rank}
                </div>
                <div>
                  <div className="text-lg text-gray-400">Your Rank</div>
                  <div className="text-2xl font-bold">{currentPlayer.username}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-purple-400">{playerRank.rating}</div>
                <div className="text-gray-400">Rating</div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex bg-white/5 rounded-xl p-1">
            {(['allTime', 'monthly', 'weekly', 'daily'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                  period === p ? 'bg-purple-600' : 'hover:bg-white/10'
                }`}
              >
                {p === 'allTime' ? 'All Time' : p}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="rating">Sort by Rating</option>
            <option value="wins">Sort by Wins</option>
            <option value="winStreak">Sort by Win Streak</option>
            <option value="totalWon">Sort by SOL Won</option>
          </select>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="p-4 font-medium text-gray-400">Rank</th>
                <th className="p-4 font-medium text-gray-400">Player</th>
                <th className="p-4 font-medium text-gray-400 text-center">Rating</th>
                <th className="p-4 font-medium text-gray-400 text-center">W/L/D</th>
                <th className="p-4 font-medium text-gray-400 text-center">Win Rate</th>
                <th className="p-4 font-medium text-gray-400 text-center">Streak</th>
                <th className="p-4 font-medium text-gray-400 text-right">SOL Won</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry: any) => (
                <tr
                  key={entry.playerId}
                  className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                    entry.playerId === currentPlayer._id ? 'bg-purple-500/10' : ''
                  }`}
                >
                  <td className="p-4">
                    <span className={`font-bold text-lg ${
                      entry.rank === 1 ? 'text-yellow-400' :
                      entry.rank === 2 ? 'text-gray-300' :
                      entry.rank === 3 ? 'text-orange-400' : 'text-gray-500'
                    }`}>
                      {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center font-bold">
                        {entry.username[0]}
                      </div>
                      <div>
                        <div className="font-medium">{entry.username}</div>
                        <div className="text-xs text-gray-500 font-mono">
                          {entry.walletAddress.substring(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className="text-lg font-bold text-purple-400">{entry.rating}</span>
                  </td>
                  <td className="p-4 text-center">
                    <span className="text-green-400">{entry.wins}</span>
                    <span className="text-gray-500">/</span>
                    <span className="text-red-400">{entry.losses}</span>
                    <span className="text-gray-500">/</span>
                    <span className="text-gray-400">{entry.draws}</span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`font-medium ${
                      parseFloat(entry.winRate) >= 60 ? 'text-green-400' :
                      parseFloat(entry.winRate) >= 50 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {entry.winRate}%
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    {entry.bestWinStreak > 0 && (
                      <span className="text-orange-400">🔥 {entry.bestWinStreak}</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {entry.totalWon > 0 && (
                      <span className="text-green-400 font-medium">
                        +{entry.totalWon.toFixed(2)} SOL
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

// ============ Game Screen (Simplified) ============

function GameScreen({
  game,
  currentPlayer,
  wallet,
  onLeave,
}: {
  game: Game;
  currentPlayer: Player;
  wallet: ReturnType<typeof useWallet>;
  onLeave: () => void;
}) {
  const [chess] = useState(() => new Chess(game.fen));
  const [fen, setFen] = useState(game.fen);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);

  const mySide = game.white?._id === currentPlayer._id ? 'w' : 
                 game.black?._id === currentPlayer._id ? 'b' : 's';
  const isMyTurn = game.status === 'playing' && chess.turn() === mySide;
  const isFlipped = mySide === 'b';

  // Build board
  const board = useMemo(() => {
    const squares: { square: string; piece: string | null }[][] = [];
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    for (const rank of ranks) {
      const row: { square: string; piece: string | null }[] = [];
      for (const file of files) {
        const square = file + rank;
        const piece = chess.get(square as any);
        row.push({
          square,
          piece: piece ? piece.color + piece.type.toUpperCase() : null,
        });
      }
      squares.push(row);
    }

    return isFlipped ? squares.reverse().map(row => row.reverse()) : squares;
  }, [fen, isFlipped]);

  const handleSquareClick = (square: string) => {
    if (!isMyTurn) return;

    if (selectedSquare) {
      if (legalMoves.includes(square)) {
        chess.move({ from: selectedSquare, to: square, promotion: 'q' });
        setFen(chess.fen());
      }
      setSelectedSquare(null);
      setLegalMoves([]);
    } else {
      const piece = chess.get(square as any);
      if (piece && piece.color === mySide) {
        setSelectedSquare(square);
        setLegalMoves(chess.moves({ square: square as any, verbose: true }).map(m => m.to));
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <header className="bg-black/30 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button onClick={onLeave} className="text-gray-400 hover:text-white">
            ← Leave Game
          </button>
          <span className="font-mono text-purple-400">{game.code}</span>
          <span className="text-purple-400">{wallet.balance.toFixed(2)} SOL</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4">
        {/* Board */}
        <div className="relative aspect-square max-w-[600px] mx-auto">
          <div className="grid grid-cols-8 gap-0 rounded-lg overflow-hidden shadow-2xl">
            {board.flat().map(({ square, piece }) => {
              const file = square[0];
              const rank = square[1];
              const isLight = (file.charCodeAt(0) + parseInt(rank)) % 2 === 0;
              const isSelected = selectedSquare === square;
              const isLegal = legalMoves.includes(square);

              return (
                <div
                  key={square}
                  onClick={() => handleSquareClick(square)}
                  className={`
                    aspect-square flex items-center justify-center text-4xl md:text-5xl cursor-pointer relative
                    ${isLight ? 'bg-amber-100' : 'bg-amber-700'}
                    ${isSelected ? 'ring-4 ring-yellow-400 ring-inset' : ''}
                  `}
                >
                  {piece && (
                    <span className={piece.startsWith('w') ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-gray-900'}>
                      {PIECES[piece]}
                    </span>
                  )}
                  {isLegal && (
                    <div className={`absolute ${piece ? 'w-full h-full ring-4 ring-green-500/50' : 'w-3 h-3 bg-green-500/50 rounded-full'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Game Info */}
        <div className="mt-6 text-center">
          <div className={`text-xl font-bold ${isMyTurn ? 'text-green-400' : 'text-gray-400'}`}>
            {game.status === 'waiting' ? 'Waiting for opponent...' :
             game.status === 'finished' ? `Game Over - ${game.winner} wins!` :
             isMyTurn ? '🟢 Your turn!' : "⏳ Opponent's turn"}
          </div>
          {game.wagerAmount && (
            <div className="mt-2 text-yellow-400">
              💰 {game.wagerAmount} SOL wager
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
