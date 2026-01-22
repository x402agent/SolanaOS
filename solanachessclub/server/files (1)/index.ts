/**
 * Socket.IO Server for Solana Chess
 * 
 * Handles real-time game synchronization alongside Convex
 * - Game moves
 * - Lobby presence
 * - Challenge notifications
 * - Spectator updates
 */

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { Chess } from 'chess.js';
import cors from 'cors';

// ============ Types ============

interface Player {
  socketId: string;
  walletAddress: string;
  username: string;
  rating: number;
  currentGameCode?: string;
}

interface GameState {
  code: string;
  chess: Chess;
  white?: Player;
  black?: Player;
  spectators: Set<string>;
  timeControl: number;
  whiteTime: number;
  blackTime: number;
  lastMoveTime?: number;
  wagerAmount?: number;
  isRanked: boolean;
  status: 'waiting' | 'playing' | 'finished';
}

// ============ State ============

const players = new Map<string, Player>();
const games = new Map<string, GameState>();
const socketToPlayer = new Map<string, string>();

// ============ Server Setup ============

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
  },
});

// ============ Utility Functions ============

function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function broadcastLobbyUpdate() {
  const lobbyData = {
    onlinePlayers: Array.from(players.values()).map(p => ({
      walletAddress: p.walletAddress,
      username: p.username,
      rating: p.rating,
      inGame: !!p.currentGameCode,
    })),
    availableGames: Array.from(games.values())
      .filter(g => g.status === 'waiting')
      .map(g => ({
        code: g.code,
        host: g.white?.username || g.black?.username,
        hostRating: g.white?.rating || g.black?.rating,
        timeControl: g.timeControl,
        wagerAmount: g.wagerAmount,
        isRanked: g.isRanked,
      })),
    activeGames: games.size,
    playersOnline: players.size,
  };
  
  io.emit('lobbyUpdate', lobbyData);
}

function broadcastGameUpdate(game: GameState) {
  const gameData = {
    code: game.code,
    fen: game.chess.fen(),
    pgn: game.chess.pgn(),
    turn: game.chess.turn(),
    status: game.status,
    isCheck: game.chess.inCheck(),
    isCheckmate: game.chess.isCheckmate(),
    isDraw: game.chess.isDraw(),
    whiteTime: game.whiteTime,
    blackTime: game.blackTime,
    white: game.white ? {
      username: game.white.username,
      rating: game.white.rating,
      walletAddress: game.white.walletAddress,
    } : null,
    black: game.black ? {
      username: game.black.username,
      rating: game.black.rating,
      walletAddress: game.black.walletAddress,
    } : null,
    lastMove: game.chess.history({ verbose: true }).slice(-1)[0],
    moveHistory: game.chess.history({ verbose: true }),
  };

  // Send to players and spectators
  if (game.white) {
    io.to(game.white.socketId).emit('gameUpdate', gameData);
  }
  if (game.black) {
    io.to(game.black.socketId).emit('gameUpdate', gameData);
  }
  game.spectators.forEach(socketId => {
    io.to(socketId).emit('gameUpdate', gameData);
  });
}

// ============ Socket Event Handlers ============

io.on('connection', (socket: Socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // ============ Authentication ============
  
  socket.on('authenticate', (data: {
    walletAddress: string;
    username: string;
    rating?: number;
  }) => {
    const player: Player = {
      socketId: socket.id,
      walletAddress: data.walletAddress,
      username: data.username,
      rating: data.rating || 1200,
    };

    players.set(data.walletAddress, player);
    socketToPlayer.set(socket.id, data.walletAddress);

    console.log(`✅ Player authenticated: ${data.username} (${data.walletAddress})`);
    
    socket.emit('authenticated', { player });
    broadcastLobbyUpdate();
  });

  // ============ Lobby Chat ============
  
  socket.on('lobbyMessage', (data: { message: string }) => {
    const walletAddress = socketToPlayer.get(socket.id);
    if (!walletAddress) return;
    
    const player = players.get(walletAddress);
    if (!player) return;

    io.emit('lobbyChatMessage', {
      username: player.username,
      message: data.message,
      timestamp: Date.now(),
      type: 'message',
    });
  });

  // ============ Game Creation ============
  
  socket.on('createGame', (data: {
    side: 'white' | 'black' | 'random';
    timeControl: number;
    wagerAmount?: number;
    isRanked?: boolean;
  }) => {
    const walletAddress = socketToPlayer.get(socket.id);
    if (!walletAddress) return;
    
    const player = players.get(walletAddress);
    if (!player) return;

    const code = generateGameCode();
    const side = data.side === 'random' 
      ? (Math.random() > 0.5 ? 'white' : 'black')
      : data.side;

    const game: GameState = {
      code,
      chess: new Chess(),
      [side]: player,
      spectators: new Set(),
      timeControl: data.timeControl,
      whiteTime: data.timeControl,
      blackTime: data.timeControl,
      wagerAmount: data.wagerAmount,
      isRanked: data.isRanked ?? true,
      status: 'waiting',
    };

    games.set(code, game);
    player.currentGameCode = code;

    socket.join(`game:${code}`);
    socket.emit('gameCreated', { code, side });
    
    console.log(`🎮 Game created: ${code} by ${player.username}`);
    broadcastLobbyUpdate();
  });

  // ============ Game Joining ============
  
  socket.on('joinGame', (data: { code: string }) => {
    const walletAddress = socketToPlayer.get(socket.id);
    if (!walletAddress) return;
    
    const player = players.get(walletAddress);
    if (!player) return;

    const game = games.get(data.code.toUpperCase());
    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    if (game.status !== 'waiting') {
      socket.emit('error', { message: 'Game already started' });
      return;
    }

    // Determine side
    let side: 'white' | 'black';
    if (!game.white) {
      game.white = player;
      side = 'white';
    } else if (!game.black) {
      game.black = player;
      side = 'black';
    } else {
      socket.emit('error', { message: 'Game is full' });
      return;
    }

    player.currentGameCode = game.code;
    socket.join(`game:${game.code}`);

    // Start game if both players present
    if (game.white && game.black) {
      game.status = 'playing';
      game.lastMoveTime = Date.now();
      
      io.to(game.white.socketId).emit('gameStarted', {
        code: game.code,
        side: 'white',
        opponent: { username: game.black.username, rating: game.black.rating },
      });
      
      io.to(game.black.socketId).emit('gameStarted', {
        code: game.code,
        side: 'black',
        opponent: { username: game.white.username, rating: game.white.rating },
      });
      
      console.log(`🎯 Game started: ${game.code}`);
    } else {
      socket.emit('gameJoined', { code: game.code, side });
    }

    broadcastGameUpdate(game);
    broadcastLobbyUpdate();
  });

  // ============ Spectating ============
  
  socket.on('spectateGame', (data: { code: string }) => {
    const game = games.get(data.code.toUpperCase());
    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    game.spectators.add(socket.id);
    socket.join(`game:${game.code}`);
    
    broadcastGameUpdate(game);
    socket.emit('spectating', { code: game.code });
  });

  // ============ Making Moves ============
  
  socket.on('makeMove', (data: { code: string; from: string; to: string; promotion?: string }) => {
    const walletAddress = socketToPlayer.get(socket.id);
    if (!walletAddress) return;
    
    const player = players.get(walletAddress);
    if (!player) return;

    const game = games.get(data.code.toUpperCase());
    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    if (game.status !== 'playing') {
      socket.emit('error', { message: 'Game not in progress' });
      return;
    }

    // Validate turn
    const isWhite = game.white?.walletAddress === walletAddress;
    const isBlack = game.black?.walletAddress === walletAddress;
    
    if (!isWhite && !isBlack) {
      socket.emit('error', { message: 'You are not a player in this game' });
      return;
    }

    const turn = game.chess.turn();
    if ((turn === 'w' && !isWhite) || (turn === 'b' && !isBlack)) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    // Update time
    const now = Date.now();
    if (game.lastMoveTime) {
      const elapsed = (now - game.lastMoveTime) / 1000;
      if (turn === 'w') {
        game.whiteTime -= elapsed;
      } else {
        game.blackTime -= elapsed;
      }
    }
    game.lastMoveTime = now;

    // Check for time out
    if (game.whiteTime <= 0 || game.blackTime <= 0) {
      game.status = 'finished';
      const winner = game.whiteTime <= 0 ? 'black' : 'white';
      
      io.to(`game:${game.code}`).emit('gameOver', {
        winner,
        reason: 'timeout',
        finalFen: game.chess.fen(),
      });
      
      broadcastLobbyUpdate();
      return;
    }

    // Make move
    try {
      const move = game.chess.move({
        from: data.from,
        to: data.to,
        promotion: data.promotion,
      });

      if (!move) {
        socket.emit('error', { message: 'Invalid move' });
        return;
      }

      // Broadcast move
      io.to(`game:${game.code}`).emit('moveMade', {
        move: {
          from: data.from,
          to: data.to,
          san: move.san,
          piece: move.piece,
          captured: move.captured,
          promotion: move.promotion,
        },
        fen: game.chess.fen(),
        whiteTime: game.whiteTime,
        blackTime: game.blackTime,
      });

      // Check for game end
      if (game.chess.isGameOver()) {
        game.status = 'finished';
        
        let winner: 'white' | 'black' | 'draw' = 'draw';
        let reason = 'unknown';

        if (game.chess.isCheckmate()) {
          winner = game.chess.turn() === 'w' ? 'black' : 'white';
          reason = 'checkmate';
        } else if (game.chess.isStalemate()) {
          reason = 'stalemate';
        } else if (game.chess.isThreefoldRepetition()) {
          reason = 'repetition';
        } else if (game.chess.isInsufficientMaterial()) {
          reason = 'insufficient';
        } else if (game.chess.isDraw()) {
          reason = 'fifty-move';
        }

        io.to(`game:${game.code}`).emit('gameOver', {
          winner,
          reason,
          finalFen: game.chess.fen(),
          pgn: game.chess.pgn(),
        });

        console.log(`🏁 Game ended: ${game.code} - ${winner} wins by ${reason}`);
      }

      broadcastGameUpdate(game);
    } catch (error) {
      socket.emit('error', { message: 'Invalid move' });
    }
  });

  // ============ Resignation ============
  
  socket.on('resign', (data: { code: string }) => {
    const walletAddress = socketToPlayer.get(socket.id);
    if (!walletAddress) return;

    const game = games.get(data.code.toUpperCase());
    if (!game) return;

    const isWhite = game.white?.walletAddress === walletAddress;
    const isBlack = game.black?.walletAddress === walletAddress;
    
    if (!isWhite && !isBlack) return;

    game.status = 'finished';
    const winner = isWhite ? 'black' : 'white';

    io.to(`game:${game.code}`).emit('gameOver', {
      winner,
      reason: 'resignation',
      finalFen: game.chess.fen(),
    });

    console.log(`🏳️ Resignation in game: ${game.code}`);
    broadcastLobbyUpdate();
  });

  // ============ Game Chat ============
  
  socket.on('gameChat', (data: { code: string; message: string }) => {
    const walletAddress = socketToPlayer.get(socket.id);
    if (!walletAddress) return;
    
    const player = players.get(walletAddress);
    if (!player) return;

    io.to(`game:${data.code}`).emit('gameChatMessage', {
      username: player.username,
      message: data.message,
      timestamp: Date.now(),
    });
  });

  // ============ Challenge ============
  
  socket.on('challenge', (data: { targetWallet: string; timeControl: number; wagerAmount?: number }) => {
    const walletAddress = socketToPlayer.get(socket.id);
    if (!walletAddress) return;
    
    const challenger = players.get(walletAddress);
    const challenged = players.get(data.targetWallet);
    
    if (!challenger || !challenged) {
      socket.emit('error', { message: 'Player not found' });
      return;
    }

    io.to(challenged.socketId).emit('challenged', {
      challenger: {
        username: challenger.username,
        rating: challenger.rating,
        walletAddress: challenger.walletAddress,
      },
      timeControl: data.timeControl,
      wagerAmount: data.wagerAmount,
    });

    io.emit('lobbyChatMessage', {
      username: 'System',
      message: `${challenger.username} challenged ${challenged.username} to a ${data.timeControl / 60}min game!`,
      timestamp: Date.now(),
      type: 'challenge',
    });
  });

  // ============ Disconnect ============
  
  socket.on('disconnect', () => {
    const walletAddress = socketToPlayer.get(socket.id);
    
    if (walletAddress) {
      const player = players.get(walletAddress);
      
      if (player?.currentGameCode) {
        const game = games.get(player.currentGameCode);
        if (game && game.status === 'playing') {
          // Handle disconnect during game
          game.status = 'finished';
          const winner = game.white?.walletAddress === walletAddress ? 'black' : 'white';
          
          io.to(`game:${game.code}`).emit('gameOver', {
            winner,
            reason: 'abandonment',
            finalFen: game.chess.fen(),
          });
        }
      }

      players.delete(walletAddress);
      socketToPlayer.delete(socket.id);
      
      console.log(`👋 Player disconnected: ${player?.username || 'Unknown'}`);
      broadcastLobbyUpdate();
    }
  });
});

// ============ REST API ============

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    players: players.size,
    activeGames: games.size,
    uptime: process.uptime(),
  });
});

app.get('/api/games', (req, res) => {
  const gameList = Array.from(games.values()).map(g => ({
    code: g.code,
    status: g.status,
    white: g.white?.username,
    black: g.black?.username,
    timeControl: g.timeControl,
    wagerAmount: g.wagerAmount,
    fen: g.chess.fen(),
  }));
  res.json(gameList);
});

app.get('/api/game/:code', (req, res) => {
  const game = games.get(req.params.code.toUpperCase());
  if (!game) {
    res.status(404).json({ error: 'Game not found' });
    return;
  }

  res.json({
    code: game.code,
    status: game.status,
    fen: game.chess.fen(),
    pgn: game.chess.pgn(),
    white: game.white ? {
      username: game.white.username,
      rating: game.white.rating,
    } : null,
    black: game.black ? {
      username: game.black.username,
      rating: game.black.rating,
    } : null,
    timeControl: game.timeControl,
    whiteTime: game.whiteTime,
    blackTime: game.blackTime,
    wagerAmount: game.wagerAmount,
  });
});

app.get('/api/leaderboard', (req, res) => {
  const playerList = Array.from(players.values())
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 100)
    .map((p, i) => ({
      rank: i + 1,
      username: p.username,
      rating: p.rating,
      walletAddress: p.walletAddress,
    }));
  res.json(playerList);
});

// ============ Start Server ============

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ♟️  SOLANA CHESS SOCKET.IO SERVER                          ║
║                                                              ║
║   Port: ${PORT}                                               ║
║   Status: Running                                            ║
║                                                              ║
║   WebSocket: ws://localhost:${PORT}                           ║
║   REST API:  http://localhost:${PORT}/api                     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

export { io, app, httpServer };
