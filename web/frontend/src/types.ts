export interface AppStatus {
  status: string;
  daemon: string;
  oodaMode: string;
  uptime: string;
  version: string;
  wallet: string;
  balance: number;
}

export interface Portfolio {
  sol: { balance: number; usd: number };
  tokens: Array<{ symbol: string; balance: number; usd: number }>;
}

export interface StrategyParams {
  rsi_period: number;
  rsi_overbought: number;
  rsi_oversold: number;
  ema_fast: number;
  ema_slow: number;
  stop_loss: number;
  take_profit: number;
  position_size: number;
}

export type CompanionStage = 'Egg' | 'Larva' | 'Juvenile' | 'Adult' | 'Alpha' | 'Ghost';

export interface CompanionState {
  stage: CompanionStage;
  level: number;
  xp: number;
  mood: string;
  energy: number;
  hunger: number;
}
