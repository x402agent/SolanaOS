/**
 * TelegramNotifier — pushes trade alerts directly to a Telegram chat via the
 * Bot API.  Designed to be fire-and-forget: every method swallows errors so it
 * never blocks the trading loop.
 */
import https from 'https';
import { TradeResult, BotStatus, AIPrediction } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';

const BOT_TOKEN = config.telegram.botToken;
const CHAT_ID   = config.telegram.chatId;

// ── low-level send ──────────────────────────────────────────────────────────

function sendMessage(text: string, parseMode: 'Markdown' | 'HTML' = 'Markdown'): void {
  if (!BOT_TOKEN || !CHAT_ID) return; // Telegram not configured — silently skip

  const body = JSON.stringify({
    chat_id:    CHAT_ID,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  });

  const options: https.RequestOptions = {
    hostname: 'api.telegram.org',
    path:     `/bot${BOT_TOKEN}/sendMessage`,
    method:   'POST',
    headers:  {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const req = https.request(options, (res) => {
    if (res.statusCode && res.statusCode >= 400) {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        logger.warn('[TelegramNotifier] API error', { status: res.statusCode, body: raw });
      });
    }
  });
  req.on('error', (err) => logger.warn('[TelegramNotifier] request failed', { err: err.message }));
  req.write(body);
  req.end();
}

// ── public notification helpers ─────────────────────────────────────────────

export function notifyTradeExecuted(trade: TradeResult): void {
  const emoji   = trade.type === 'buy' ? '🟢' : '🔴';
  const status  = trade.success ? '✅ Executed' : `❌ Failed`;
  const profit  = trade.profit !== undefined ? `\nP&L: \`${trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(4)} SOL\`` : '';
  const txLink  = trade.txHash ? `\n[View tx](https://solscan.io/tx/${trade.txHash})` : '';
  const tokenLink = `[${trade.tokenAddress.slice(0, 8)}…](https://solscan.io/token/${trade.tokenAddress})`;

  sendMessage(
    `${emoji} *AI Bot — ${trade.type.toUpperCase()}* ${status}\n` +
    `Token: ${tokenLink}\n` +
    `Amount: \`${trade.amount} SOL\`\n` +
    `Price: \`$${trade.price.toFixed(8)}\`` +
    profit +
    txLink
  );
}

export function notifyPositionOpened(trade: TradeResult): void {
  const tokenLink = `[${trade.tokenAddress.slice(0, 8)}…](https://solscan.io/token/${trade.tokenAddress})`;
  sendMessage(
    `📂 *Position Opened*\n` +
    `Token: ${tokenLink}\n` +
    `Entry: \`$${trade.price.toFixed(8)}\`\n` +
    `Size: \`${trade.amount} SOL\``
  );
}

export function notifyPositionClosed(trade: TradeResult): void {
  const pnlEmoji  = (trade.profit ?? 0) >= 0 ? '📈' : '📉';
  const profitStr = trade.profit !== undefined
    ? `${trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(4)} SOL`
    : 'N/A';
  const tokenLink = `[${trade.tokenAddress.slice(0, 8)}…](https://solscan.io/token/${trade.tokenAddress})`;
  sendMessage(
    `${pnlEmoji} *Position Closed*\n` +
    `Token: ${tokenLink}\n` +
    `Exit: \`$${trade.price.toFixed(8)}\`\n` +
    `P&L: \`${profitStr}\``
  );
}

export function notifyHighConfidencePrediction(pred: AIPrediction): void {
  if (pred.confidenceScore < config.telegram.alertMinConfidence) return;
  const dirEmoji = pred.predictedDirection === 'up' ? '⬆️' : pred.predictedDirection === 'down' ? '⬇️' : '➡️';
  const tokenLink = `[${pred.tokenAddress.slice(0, 8)}…](https://solscan.io/token/${pred.tokenAddress})`;
  sendMessage(
    `${dirEmoji} *High-Confidence Signal*\n` +
    `Token: ${tokenLink}\n` +
    `Direction: \`${pred.predictedDirection.toUpperCase()}\`\n` +
    `Confidence: \`${(pred.confidenceScore * 100).toFixed(1)}%\`\n` +
    `Horizon: \`${pred.timeframe}s\``
  );
}

export function notifyBotStatus(status: BotStatus, label: 'started' | 'stopped' | 'heartbeat'): void {
  const emoji = label === 'started' ? '🚀' : label === 'stopped' ? '⛔' : '💓';
  const winRate = status.totalTrades > 0
    ? `${((status.successfulTrades / status.totalTrades) * 100).toFixed(1)}%`
    : 'N/A';
  sendMessage(
    `${emoji} *AI Trading Bot — ${label.toUpperCase()}*\n` +
    `Trades: \`${status.totalTrades}\` (✅ ${status.successfulTrades} / ❌ ${status.failedTrades})\n` +
    `Win rate: \`${winRate}\`\n` +
    `Total P&L: \`${status.totalProfit >= 0 ? '+' : ''}${status.totalProfit.toFixed(4)} SOL\`\n` +
    `Open positions: \`${status.openPositions}\``
  );
}

export function notifyError(context: string, err: Error): void {
  if (!config.telegram.alertOnErrors) return;
  sendMessage(`⚠️ *AI Bot Error*\n\`${context}\`\n\`${err.message}\``);
}

export function notifyStopLoss(tokenAddress: string, loss: number): void {
  const tokenLink = `[${tokenAddress.slice(0, 8)}…](https://solscan.io/token/${tokenAddress})`;
  sendMessage(
    `🛑 *Stop-Loss Triggered*\n` +
    `Token: ${tokenLink}\n` +
    `Loss: \`${loss.toFixed(4)} SOL\``
  );
}

export function notifyTakeProfit(tokenAddress: string, profit: number): void {
  const tokenLink = `[${tokenAddress.slice(0, 8)}…](https://solscan.io/token/${tokenAddress})`;
  sendMessage(
    `🎯 *Take-Profit Hit!*\n` +
    `Token: ${tokenLink}\n` +
    `Profit: \`+${profit.toFixed(4)} SOL\``
  );
}
