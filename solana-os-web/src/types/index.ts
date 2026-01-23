export interface WindowState {
  id: string;
  title: string;
  icon: string;
  component: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}

export interface AppConfig {
  id: string;
  name: string;
  icon: string;
  component: string;
  category: 'trading' | 'tools' | 'creative' | 'system' | 'games';
  description: string;
}

export interface Agent {
  id: string;
  name: string;
  type: 'trading' | 'privacy' | 'sniper' | 'analytics';
  status: 'active' | 'paused' | 'stopped';
  profit: number;
  trades: number;
  winRate: number;
  strategy: string;
}

export interface SparkLoop {
  id: string;
  name: string;
  token: string;
  strategy: string;
  status: 'running' | 'paused' | 'stopped' | 'ready';
  recursions: number;
  profit: number;
  infinite: boolean;
  stopLoss: number;
  takeProfit: number;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  installed: boolean;
  description?: string;
}

export interface TerminalLine {
  type: 'input' | 'output' | 'success' | 'error' | 'warning' | 'info';
  text: string;
  timestamp: string;
}

export interface Token {
  symbol: string;
  name: string;
  mint: string;
  balance: number;
  usdValue: number;
  change24h: number;
}

export type SparkPhase = 'OBSERVE' | 'DECIDE' | 'ACT' | 'MEASURE' | 'LEARN' | 'IMPROVE';

export const SPARK_PHASES: SparkPhase[] = ['OBSERVE', 'DECIDE', 'ACT', 'MEASURE', 'LEARN', 'IMPROVE'];

export const STRATEGIES = [
  'MOMENTUM',
  'MEAN_REVERSION',
  'ARBITRAGE',
  'SNIPE',
  'GRID',
  'DCA',
  'RECURSIVE_COMPOUND',
  'AI_ADAPTIVE',
  'STEALTH_ACCUMULATE',
  'PRIVACY_MIXER',
] as const;

export type Strategy = typeof STRATEGIES[number];
