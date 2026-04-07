/**
 * /api/events — Server-Sent Events (SSE) stream.
 *
 * The solanaos.net dashboard and the Go daemon both subscribe here to receive
 * real-time push updates without polling the REST endpoints.
 *
 * Event types emitted:
 *   bot.status      — periodic heartbeat with BotStatus snapshot
 *   trade.executed  — every buy/sell result
 *   prediction.new  — new AI prediction (high-confidence only)
 *   scan.update     — new tokens found by MarketScanner
 *   error           — non-fatal errors
 */
import { Router, Request, Response } from 'express';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

const router = Router();

// Module-level event bus — the AITradingBot emits on this, SSE fans out.
export const botEvents = new EventEmitter();
botEvents.setMaxListeners(100); // support many concurrent web/daemon connections

// Track active SSE clients for clean shutdown
const clients = new Set<Response>();

/** Broadcast a typed SSE event to all connected clients. */
export function broadcast(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

// Forward all bot events to SSE
botEvents.on('bot.status',     (d) => broadcast('bot.status',     d));
botEvents.on('trade.executed', (d) => broadcast('trade.executed', d));
botEvents.on('prediction.new', (d) => broadcast('prediction.new', d));
botEvents.on('scan.update',    (d) => broadcast('scan.update',    d));
botEvents.on('error',          (d) => broadcast('error',          d));

// ── SSE endpoint ──────────────────────────────────────────────────────────

router.get('/', (req: Request, res: Response) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // nginx passthrough
  res.flushHeaders();

  clients.add(res);
  logger.info(`[SSE] client connected (total: ${clients.size})`);

  // Send an initial ping so the client knows the stream is live
  res.write(`event: connected\ndata: {"ts":${Date.now()}}\n\n`);

  // Heartbeat every 30 s to keep the connection open through proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch {
      cleanup();
    }
  }, 30_000);

  function cleanup() {
    clearInterval(heartbeat);
    clients.delete(res);
    logger.info(`[SSE] client disconnected (total: ${clients.size})`);
  }

  req.on('close',   cleanup);
  req.on('error',   cleanup);
  res.on('finish',  cleanup);
});

/** Close all SSE connections (called on graceful shutdown). */
export function closeAllSSE(): void {
  for (const res of clients) {
    try { res.end(); } catch { /* ignore */ }
  }
  clients.clear();
}

export { router as eventsRoutes };
