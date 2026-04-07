export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  price: number;
  volume24h: number;
  liquidity: number;
  timestamp: number;
}

export interface AIPrediction {
  tokenAddress: string;
  confidenceScore: number;
  predictedPrice: number;
  predictedDirection: 'up' | 'down' | 'neutral';
  timeframe: number;
  timestamp: number;
}

export interface TradeResult {
  success: boolean;
  txHash?: string;
  tokenAddress: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  profit?: number;
  timestamp: number;
  error?: string;
}

export interface BotStatus {
  isRunning: boolean;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalProfit: number;
  winRate: number;
  startTime: number;
  openPositions: number;
}

