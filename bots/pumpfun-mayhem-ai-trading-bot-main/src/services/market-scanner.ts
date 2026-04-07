/**
 * MarketScanner — polls SolanaTracker for trending pump.fun tokens and
 * enriches them with price / liquidity / risk data.  Results are stored
 * in a fixed-size circular buffer so the AI service can consume them
 * without additional API calls.
 */
import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import { TokenInfo } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';

// ── Types returned by SolanaTracker ────────────────────────────────────────

interface STToken {
  token: {
    mint:     string;
    name:     string;
    symbol:   string;
    decimals: number;
  };
  pools?: Array<{
    price?:        { usd?: number };
    liquidity?:    { usd?: number };
    volume?:       { h24?: number };
    curvePercentage?: number;
    graduated?:    boolean;
  }>;
  risk?: { score?: number };
}

// ── Scanner ─────────────────────────────────────────────────────────────────

export class MarketScanner extends EventEmitter {
  private client: AxiosInstance;
  private tokens: TokenInfo[] = [];
  private readonly bufferSize = 200;
  private timer: NodeJS.Timeout | null = null;
  private scanning = false;

  constructor() {
    super();
    this.client = axios.create({
      baseURL: 'https://data.solanatracker.io',
      timeout: 12_000,
      headers: config.solanaTracker.apiKey
        ? { 'x-api-key': config.solanaTracker.apiKey }
        : {},
    });
  }

  /** Start polling on a fixed interval (default from config). */
  start(): void {
    if (this.timer) return;
    logger.info('[MarketScanner] starting');
    this.scan();
    this.timer = setInterval(() => this.scan(), config.solanaTracker.scanIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('[MarketScanner] stopped');
  }

  /** Latest buffered tokens, newest first. */
  getTokens(limit = 50): TokenInfo[] {
    return this.tokens.slice(0, limit);
  }

  /** Find a specific token by mint address. */
  getToken(mint: string): TokenInfo | undefined {
    return this.tokens.find((t) => t.address === mint);
  }

  // ── private ────────────────────────────────────────────────────────────

  private async scan(): Promise<void> {
    if (this.scanning) return;
    this.scanning = true;
    try {
      const [trending, latest] = await Promise.allSettled([
        this.fetchTrending(),
        this.fetchLatest(),
      ]);

      const combined: TokenInfo[] = [];
      if (trending.status === 'fulfilled') combined.push(...trending.value);
      if (latest.status  === 'fulfilled') combined.push(...latest.value);

      // Deduplicate by mint address, prefer the latest entry
      const seen = new Set<string>();
      const deduped = combined.filter((t) => {
        if (seen.has(t.address)) return false;
        seen.add(t.address);
        return true;
      });

      // Prepend to buffer, keep last bufferSize entries
      this.tokens = [...deduped, ...this.tokens].slice(0, this.bufferSize);

      if (deduped.length > 0) {
        logger.info(`[MarketScanner] scanned ${deduped.length} tokens`);
        this.emit('scan', deduped);
      }
    } catch (err) {
      logger.warn('[MarketScanner] scan error', { err: (err as Error).message });
    } finally {
      this.scanning = false;
    }
  }

  private async fetchTrending(): Promise<TokenInfo[]> {
    const res = await this.client.get<{ tokens?: STToken[] }>('/tokens/trending');
    return this.normaliseList(res.data?.tokens ?? []);
  }

  private async fetchLatest(): Promise<TokenInfo[]> {
    const res = await this.client.get<{ tokens?: STToken[] }>('/tokens/latest');
    return this.normaliseList(res.data?.tokens ?? []);
  }

  private normaliseList(raw: STToken[]): TokenInfo[] {
    return raw.map((item) => this.normalise(item)).filter(Boolean) as TokenInfo[];
  }

  private normalise(item: STToken): TokenInfo | null {
    try {
      const pool = item.pools?.[0];
      return {
        address:   item.token.mint,
        name:      item.token.name,
        symbol:    item.token.symbol,
        decimals:  item.token.decimals ?? 6,
        price:     pool?.price?.usd ?? 0,
        volume24h: pool?.volume?.h24 ?? 0,
        liquidity: pool?.liquidity?.usd ?? 0,
        timestamp: Date.now(),
      };
    } catch {
      return null;
    }
  }

  /** One-shot enrichment — fetches full token data for a given mint. */
  async enrichToken(mint: string): Promise<TokenInfo | null> {
    try {
      const res = await this.client.get<STToken>(`/tokens/${mint}`);
      return this.normalise(res.data);
    } catch (err) {
      logger.warn('[MarketScanner] enrich failed', { mint, err: (err as Error).message });
      return null;
    }
  }
}
