import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { tradingRoutes } from './routes/trading.routes';
import { healthRoutes } from './routes/health.routes';
import { AITradingBot } from './services/ai-trading.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/trading', tradingRoutes);

// Error handling
app.use(errorHandler);

// Initialize AI trading bot
const aiBot = new AITradingBot();

// Start server
app.listen(PORT, () => {
  logger.info(`🤖 AI Trading Bot server running on port ${PORT}`);
  
  // Start AI bot if enabled
  if (process.env.AI_ENABLED === 'true') {
    aiBot.start().catch((error) => {
      logger.error('Failed to start AI trading bot:', error);
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  aiBot.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  aiBot.stop();
  process.exit(0);
});

export default app;

