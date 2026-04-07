import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port:    parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  solana: {
    rpcUrl:     process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    privateKey: process.env.SOLANA_PRIVATE_KEY || '',
    publicKey:  process.env.SOLANA_PUBLIC_KEY  || '',
  },

  solanaTracker: {
    apiKey:         process.env.SOLANA_TRACKER_API_KEY || process.env.SOLANATRACKER_API_KEY || '',
    rpcUrl:         process.env.SOLANA_TRACKER_RPC_URL || '',
    scanIntervalMs: parseInt(process.env.SCAN_INTERVAL_MS || '30000', 10),
  },

  /** Telegram Bot API — mirrors the parent SolanaOS daemon's Telegram config */
  telegram: {
    botToken:          process.env.TELEGRAM_BOT_TOKEN || '',
    chatId:            process.env.TELEGRAM_CHAT_ID   || process.env.TELEGRAM_ID || '',
    alertMinConfidence: parseFloat(process.env.TG_ALERT_MIN_CONFIDENCE || '0.8'),
    alertOnErrors:     process.env.TG_ALERT_ON_ERRORS !== 'false',
    heartbeatMs:       parseInt(process.env.TG_HEARTBEAT_MS || '3600000', 10),
  },

  ai: {
    enabled:              process.env.AI_ENABLED === 'true',
    modelPath:            process.env.AI_MODEL_PATH           || 'models/trading_model.pkl',
    minConfidenceScore:   parseFloat(process.env.MIN_CONFIDENCE_SCORE   || '0.7'),
    maxPositionSize:      parseFloat(process.env.MAX_POSITION_SIZE      || '0.2'),
    stopLossPercentage:   parseFloat(process.env.STOP_LOSS_PERCENTAGE   || '10'),
    takeProfitPercentage: parseFloat(process.env.TAKE_PROFIT_PERCENTAGE || '50'),
    tradingStrategy:      process.env.TRADING_STRATEGY        || 'momentum',
    scalpingEnabled:      process.env.SCALPING_ENABLED         === 'true',
    swingTradingEnabled:  process.env.SWING_TRADING_ENABLED    === 'true',
    maxDailyLoss:         parseFloat(process.env.MAX_DAILY_LOSS         || '1.0'),
    maxOpenPositions:     parseInt(process.env.MAX_OPEN_POSITIONS       || '5', 10),
    riskPerTrade:         parseFloat(process.env.RISK_PER_TRADE         || '2'),
    featureWindow:        parseInt(process.env.FEATURE_WINDOW           || '60', 10),
    predictionHorizon:    parseInt(process.env.PREDICTION_HORIZON       || '5', 10),
    learningRate:         parseFloat(process.env.LEARNING_RATE          || '0.001'),
    loopIntervalMs:       parseInt(process.env.AI_LOOP_INTERVAL_MS      || '5000', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file:  process.env.LOG_FILE  || 'logs/ai-trading.log',
  },
};
