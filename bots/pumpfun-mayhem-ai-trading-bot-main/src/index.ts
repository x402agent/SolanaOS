import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';
import { closeAllSSE, eventsRoutes } from './routes/events.routes';
import { healthRoutes } from './routes/health.routes';
import { tradingRoutes } from './routes/trading.routes';
import { AITradingBot } from './services/ai-trading.service';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/health',  healthRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/events',  eventsRoutes);   // SSE stream for dashboard + Go daemon

// Error handling (must be last)
app.use(errorHandler);

// Initialize AI trading bot singleton (shared with trading routes)
const aiBot = new AITradingBot();
// Expose globally so routes can reach it without circular imports
(globalThis as Record<string, unknown>).aiBot = aiBot;

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🤖 AI Trading Bot server running on port ${PORT}`);

  if (process.env.AI_ENABLED === 'true') {
    aiBot.start().catch((err: unknown) => {
      logger.error('Failed to start AI trading bot', { err });
    });
  }
});

// Graceful shutdown
function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down`);
  closeAllSSE();
  aiBot.stop();
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

export default app;
