import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { config } from '../config';
import { botEvents } from '../routes/events.routes';
import type { AIPrediction, BotStatus, TokenInfo, TradeResult } from '../types';
import { logger } from '../utils/logger';
import { MarketScanner } from './market-scanner';
import * as tg from './telegram-notifier';

// Max entries kept in memory for history / predictions
const MAX_HISTORY     = 500;
const MAX_PREDICTIONS = 100;

export class AITradingBot {
  private connection: Connection;
  private wallet: Keypair | null = null;
  private scanner: MarketScanner;

  private isRunning      = false;
  private totalTrades    = 0;
  private successfulTrades = 0;
  private failedTrades   = 0;
  private totalProfit    = 0;
  private startTime      = 0;
  private tradeHistory:  TradeResult[]   = [];
  private predictions:   AIPrediction[]  = [];
  private openPositions: Map<string, TradeResult> = new Map();

  private loopTimer:     NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, 'confirmed');
    this.scanner    = new MarketScanner();

    if (config.solana.privateKey) {
      try {
        this.wallet = Keypair.fromSecretKey(bs58.decode(config.solana.privateKey));
        logger.info(`AI Trading bot wallet: ${this.wallet.publicKey.toString()}`);
      } catch (err) {
        logger.warn('Could not decode SOLANA_PRIVATE_KEY — trading disabled', { err });
      }
    } else {
      logger.warn('SOLANA_PRIVATE_KEY not set — running in read-only / analysis mode');
    }

    // Pipe scanner events into the SSE bus
    this.scanner.on('scan', (tokens: TokenInfo[]) => {
      botEvents.emit('scan.update', { tokens, ts: Date.now() });
    });
  }

  // ── lifecycle ──────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('AI Trading bot is already running');
      return;
    }

    this.isRunning = true;
    this.startTime = Date.now();
    logger.info('🤖 AI Trading bot started');

    this.scanner.start();
    this.scheduleLoop();
    this.scheduleHeartbeat();

    tg.notifyBotStatus(this.getStatus(), 'started');
    botEvents.emit('bot.status', { ...this.getStatus(), event: 'started' });
  }

  stop(): void {
    this.isRunning = false;

    if (this.loopTimer)      { clearTimeout(this.loopTimer);      this.loopTimer = null; }
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }

    this.scanner.stop();

    tg.notifyBotStatus(this.getStatus(), 'stopped');
    botEvents.emit('bot.status', { ...this.getStatus(), event: 'stopped' });
    logger.info('⏹️ AI Trading bot stopped');
  }

  // ── public reads ───────────────────────────────────────────────────────

  getStatus(): BotStatus {
    return {
      isRunning:       this.isRunning,
      totalTrades:     this.totalTrades,
      successfulTrades: this.successfulTrades,
      failedTrades:    this.failedTrades,
      totalProfit:     this.totalProfit,
      winRate:         this.totalTrades > 0
                         ? (this.successfulTrades / this.totalTrades) * 100
                         : 0,
      startTime:       this.startTime,
      openPositions:   this.openPositions.size,
    };
  }

  getTradeHistory(limit = 50): TradeResult[] {
    return this.tradeHistory.slice(-limit).reverse();
  }

  getPredictions(limit = 20): AIPrediction[] {
    return this.predictions.slice(-limit).reverse();
  }

  getOpenPositions(): TradeResult[] {
    return Array.from(this.openPositions.values());
  }

  getScannedTokens(limit = 50): TokenInfo[] {
    return this.scanner.getTokens(limit);
  }

  // ── analysis loop ──────────────────────────────────────────────────────

  private scheduleLoop(): void {
    if (!this.isRunning) return;
    this.loopTimer = setTimeout(async () => {
      try {
        await this.analyzeAndTrade();
      } catch (err) {
        logger.error('Loop error', { err });
        tg.notifyError('analyzeAndTrade', err as Error);
      }
      this.scheduleLoop();
    }, config.ai.loopIntervalMs);
  }

  private async analyzeAndTrade(): Promise<void> {
    const tokens = this.scanner.getTokens(20);
    if (tokens.length === 0) return;

    for (const token of tokens) {
      if (!this.isRunning) break;
      if (this.openPositions.size >= config.ai.maxOpenPositions) break;

      const prediction = this.makePrediction(token);
      this.recordPrediction(prediction);

      if (
        prediction.confidenceScore >= config.ai.minConfidenceScore &&
        prediction.predictedDirection === 'up' &&
        this.wallet
      ) {
        await this.executeTrade(token, prediction);
      }
    }

    // Monitor open positions for TP / SL
    await this.monitorPositions();
  }

  // ── momentum prediction (simple heuristic, replace with ML model) ──────

  private makePrediction(token: TokenInfo): AIPrediction {
    // Momentum score: combines volume, liquidity, recency
    const ageMs    = Date.now() - token.timestamp;
    const ageFresh = Math.max(0, 1 - ageMs / (60 * 60 * 1000)); // freshness within 1h
    const volScore = Math.min(1, (token.volume24h / 10_000));    // normalise to $10k vol
    const liqScore = Math.min(1, (token.liquidity / 5_000));     // normalise to $5k liq

    const confidence = (ageFresh * 0.4 + volScore * 0.35 + liqScore * 0.25);

    // Directional bias: if liquidity is growing (proxy: high vol relative to liq)
    const ratio = token.liquidity > 0 ? token.volume24h / token.liquidity : 0;
    const direction: 'up' | 'down' | 'neutral' =
      confidence >= config.ai.minConfidenceScore && ratio > 0.5 ? 'up'
      : confidence < 0.3 ? 'down'
      : 'neutral';

    const pred: AIPrediction = {
      tokenAddress:       token.address,
      confidenceScore:    parseFloat(confidence.toFixed(4)),
      predictedPrice:     token.price * (direction === 'up' ? 1.1 : 0.9),
      predictedDirection: direction,
      timeframe:          config.ai.predictionHorizon * 60,
      timestamp:          Date.now(),
    };

    // High-confidence signal → Telegram
    if (pred.confidenceScore >= config.telegram.alertMinConfidence) {
      tg.notifyHighConfidencePrediction(pred);
      botEvents.emit('prediction.new', pred);
    }

    return pred;
  }

  private recordPrediction(pred: AIPrediction): void {
    this.predictions.push(pred);
    if (this.predictions.length > MAX_PREDICTIONS) {
      this.predictions = this.predictions.slice(-MAX_PREDICTIONS);
    }
  }

  // ── trade execution ────────────────────────────────────────────────────

  private async executeTrade(token: TokenInfo, _prediction: AIPrediction): Promise<TradeResult> {
    logger.info(`Executing buy: ${token.symbol} @ $${token.price}`);

    // Position size in SOL — capped by maxPositionSize
    const solBalance = await this.getSolBalance();
    const size = Math.min(config.ai.maxPositionSize, solBalance * (config.ai.riskPerTrade / 100));

    const result: TradeResult = {
      success:      true,
      tokenAddress: token.address,
      type:         'buy',
      amount:       size,
      price:        token.price,
      timestamp:    Date.now(),
      // txHash populated after real execution
    };

    try {
      // ── real execution would go here ──────────────────────────────────
      // const sig = await jupiterSwap(this.wallet!, token.address, size);
      // result.txHash = sig;
      // ─────────────────────────────────────────────────────────────────

      this.totalTrades++;
      this.successfulTrades++;
      this.tradeHistory.push(result);
      if (this.tradeHistory.length > MAX_HISTORY) {
        this.tradeHistory = this.tradeHistory.slice(-MAX_HISTORY);
      }

      this.openPositions.set(token.address, result);

      tg.notifyPositionOpened(result);
      botEvents.emit('trade.executed', result);

      logger.info(`Buy queued: ${token.symbol}, size ${size.toFixed(4)} SOL`);
    } catch (err: unknown) {
      this.failedTrades++;
      result.success = false;
      result.error   = (err as Error).message;
      logger.error(`Trade failed: ${token.symbol}`, { err });
      tg.notifyError(`trade:${token.symbol}`, err as Error);
      botEvents.emit('trade.executed', result);
    }

    return result;
  }

  private async monitorPositions(): Promise<void> {
    for (const [mint, entry] of this.openPositions) {
      const current = await this.scanner.enrichToken(mint);
      if (!current) continue;

      const gain = (current.price - entry.price) / entry.price * 100;

      if (gain >= config.ai.takeProfitPercentage) {
        logger.info(`TP hit: ${mint} +${gain.toFixed(2)}%`);
        tg.notifyTakeProfit(mint, (gain / 100) * entry.amount);
        await this.closePosition(mint, current.price, 'take-profit');

      } else if (gain <= -config.ai.stopLossPercentage) {
        logger.info(`SL hit: ${mint} ${gain.toFixed(2)}%`);
        tg.notifyStopLoss(mint, Math.abs(gain / 100) * entry.amount);
        await this.closePosition(mint, current.price, 'stop-loss');
      }
    }
  }

  private async closePosition(mint: string, exitPrice: number, reason: string): Promise<void> {
    const entry = this.openPositions.get(mint);
    if (!entry) return;

    const profit = (exitPrice - entry.price) / entry.price * entry.amount;
    this.totalProfit += profit;

    const closeResult: TradeResult = {
      success:      true,
      tokenAddress: mint,
      type:         'sell',
      amount:       entry.amount,
      price:        exitPrice,
      profit,
      timestamp:    Date.now(),
    };

    this.tradeHistory.push(closeResult);
    if (this.tradeHistory.length > MAX_HISTORY) {
      this.tradeHistory = this.tradeHistory.slice(-MAX_HISTORY);
    }

    this.openPositions.delete(mint);

    tg.notifyPositionClosed(closeResult);
    botEvents.emit('trade.executed', closeResult);
    logger.info(`Position closed (${reason}): ${mint}, P&L ${profit >= 0 ? '+' : ''}${profit.toFixed(4)} SOL`);
  }

  // ── heartbeat ──────────────────────────────────────────────────────────

  private scheduleHeartbeat(): void {
    if (!config.telegram.heartbeatMs || config.telegram.heartbeatMs <= 0) return;
    this.heartbeatTimer = setInterval(() => {
      const status = this.getStatus();
      tg.notifyBotStatus(status, 'heartbeat');
      botEvents.emit('bot.status', { ...status, event: 'heartbeat' });
    }, config.telegram.heartbeatMs);
  }

  // ── utilities ──────────────────────────────────────────────────────────

  private async getSolBalance(): Promise<number> {
    if (!this.wallet) return 0;
    try {
      const lamports = await this.connection.getBalance(this.wallet.publicKey);
      return lamports / LAMPORTS_PER_SOL;
    } catch {
      return 0;
    }
  }
}
