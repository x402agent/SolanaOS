// File: src/index.ts
import express, { Request, Response } from 'express';
import {
  TokenParams,
  FreeMarketParams,
  TokenMetadata,
  SwapAmounts,
} from './types/interfaces';
import { PublicKey } from '@solana/web3.js';
import { launchRouter } from './routes/pumpfun/pumpfunLaunch';
// import { buildCompressedNftListingTx } from './utils/compressedNftListing';
import knex from './db/knex';
import jupiterSwapRouter from './routes/swap/jupiterSwapRoutes';
import jupiterUltraSwapRouter from './routes/swap/jupiterUltraSwapRoutes';
import raydiumSwapRouter from './routes/swap/raydiumSwapRoutes';
import { threadImageRouter } from './routes/feed/threadImageRoutes';
import tokenMillRouter from './routes/tokenmill/tokenMillRoutes';
import { threadRouter } from './routes/feed/threadRoutes';
import profileImageRouter from './routes/user/userRoutes';
import { pumpSwapRouter } from './routes/pumpfun/pumpSwapRoutes';
import turnkeyAuthRouter from './routes/auth/turnkeyAuthRoutes';
import adminAuthRouter from './routes/auth/adminAuthRoutes';
import auraRouter from './routes/aura';
import { chatRouter } from './routes/chat/chatRoutes';
import { setupGlobalChat } from './controllers/chatController';
import http from 'http';
import { WebSocketService } from './service/websocketService';
import cors from 'cors';
import meteoraDBCRouter from './routes/meteora/meteoraDBCRoutes';
import { setupConnection } from './utils/connection';
import raydiumLaunchpadRoutes from './routes/raydium/launchpad.routes';
import nftRoutes from './routes/nft';
import notificationRoutes from './routes/notifications/notificationRoutes';
import luloRouter from './routes/lulo';

const app = express();
app.use(express.json({ limit: '10mb' }));

// Set trust proxy for App Engine environment
// This is critical to make WebSockets work behind App Engine's proxy
app.set('trust proxy', true);

// Add CORS middleware with expanded options for WebSocket
const corsOptions = {
  origin: '*', // This should work for development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Forwarded-Proto', 'X-Requested-With', 'Accept'],
  credentials: true,
  maxAge: 86400
};
app.use(cors(corsOptions));

// Create HTTP server for Socket.IO
const server = http.createServer(app);

// Initialize WebSocket service with improved options
const webSocketService = new WebSocketService(server);

// Add Socket.IO connection debug logging
webSocketService.io.engine.on('connection', (socket: any) => {
  console.log(`Socket engine connected: ${socket.id}`);
});

webSocketService.io.engine.on('connection_error', (err: any) => {
  console.error(`Socket engine connection error: ${err.message}`);
});

// Log socket events
webSocketService.io.use((socket: any, next: any) => {
  console.log(`New socket connection attempt: ${socket.id}`);
  next();
});

// Make WebSocket service available to the request objects
// This allows controllers to use the WebSocket service
app.use((req: any, res, next) => {
  req.webSocketService = webSocketService;
  next();
});

// Add special route to check WebSocket server status
app.get('/socket.io-status', (req, res) => {
  res.json({
    status: 'active',
    engine: webSocketService.io ? 'active' : 'not initialized',
    connections: webSocketService.io?.sockets?.sockets?.size || 0,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// WebSocket health check endpoint - important for App Engine health checks
app.get('/ws-health', (req, res) => {
  res.status(200).send('WebSocket server is healthy');
});

// Test the database connection.
// Instead of exiting on error, we log the error and continue.
async function testDbConnection() {
  try {
    const result = await knex.raw('select 1+1 as result');
    console.log(
      'Database connection successful:',
      result.rows ? result.rows[0] : result
    );
  } catch (error) {
    console.error('Database connection failed:', error);
    console.warn('Proceeding without a successful DB connection.');
  }
}

// Run migrations.
// If migrations fail, log error and continue instead of exiting.
async function runMigrationsAndStartServer() {
  try {
    console.log('Running migrations...');
    const [batchNo, log] = await knex.migrate.latest();
    console.log(`Migrations ran successfully in batch ${batchNo}`);
    if (log.length > 0) {
      console.log('Migrations executed:', log);
    }
    
    // Setup global chat after migrations
    await setupGlobalChat();
  } catch (error) {
    console.error('Migration error:', error);
    console.warn('Proceeding without running migrations.');
  }
}

// Add a WebSocket status endpoint for debugging
app.get('/api/websocket-status', (req, res) => {
  const engineStats: {
    connections: number,
    activeTransports: Record<string, number>
  } = {
    connections: 0,
    activeTransports: {}
  };
  
  // Count connections and gather transport stats
  if (webSocketService.io) {
    const sockets = webSocketService.io.sockets.sockets;
    engineStats.connections = sockets.size;
    
    // Count transports
    sockets.forEach((socket: any) => {
      const transport = socket.conn.transport.name;
      if (transport in engineStats.activeTransports) {
        engineStats.activeTransports[transport]++;
      } else {
        engineStats.activeTransports[transport] = 1;
      }
    });
  }
  
  res.json({
    status: 'active',
    environment: process.env.NODE_ENV,
    engine: 'socket.io',
    connections: engineStats.connections,
    transports: engineStats.activeTransports,
    serverTime: new Date().toISOString(),
    clientInfo: {
      ip: req.headers['x-forwarded-for'] || req.ip,
      protocol: req.headers['x-forwarded-proto'] || req.protocol,
      host: req.headers.host
    }
  });
});

// Setup connection to Solana
setupConnection();

// Add App Runner specific health check endpoints
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Solana App Kit API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Add health check endpoint that App Runner expects
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    version: process.version
  });
});

// Use the routes
app.use('/api/pumpfun', launchRouter);
app.use('/api', threadRouter);
app.use('/api/jupiter', jupiterSwapRouter);
app.use('/api/jupiter/ultra', jupiterUltraSwapRouter);
app.use('/api/raydium/swap', raydiumSwapRouter);
app.use('/api/raydium/launchpad', raydiumLaunchpadRoutes);
app.use('/api/profile', profileImageRouter);
app.use('/api/thread/images', threadImageRouter);
app.use('/api/pump-swap', pumpSwapRouter);
app.use('/api', tokenMillRouter);
app.use('/api/auth', turnkeyAuthRouter);
app.use('/api/auth', adminAuthRouter);
app.use('/api/aura', auraRouter);
app.use('/api/chat', chatRouter); // Add the chat routes
app.use('/api/meteora', meteoraDBCRouter);
app.use('/api/nft', nftRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/lulo', luloRouter);

// app.post('/api/build-compressed-nft-listing-tx', async (req: any, res: any) => {
//   try {
//     const result = await buildCompressedNftListingTx(req.body);
//     return res.json(result);
//   } catch (err: any) {
//     console.error('Failed to build compressed NFT listing tx:', err);
//     return res.status(500).json({ success: false, error: err.message });
//   }
// });

// Start the Express server.
// Note: We now try connecting to the database and running migrations,
// but if these fail we log the error and continue to start the server.
const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = '0.0.0.0'; // Critical for App Runner health checks

(async function startServer() {
  // Start server immediately for health checks - critical for App Runner
  server.listen(PORT, HOST, () => {
    console.log(`Server listening on ${HOST}:${PORT}`);
    console.log(`WebSocket server initialized. Environment: ${process.env.NODE_ENV}`);
    console.log(`Server started at: ${new Date().toISOString()}`);
    console.log(`WebSocket enabled: ${process.env.WEBSOCKET_ENABLED || 'true'}`);
    console.log(`Health checks available at: http://${HOST}:${PORT}/health`);
  });

  // Run async operations after server starts to not block health checks
  try {
    await testDbConnection();
    await runMigrationsAndStartServer();
    console.log('✅ Database and migrations completed successfully');
  } catch (error) {
    console.error('⚠️ Database/migration setup failed, but server is running:', error);
    // Server continues running even if DB fails - important for App Runner
  }
})();
