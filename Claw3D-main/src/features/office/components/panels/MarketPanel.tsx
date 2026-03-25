"use client";

import { useState, useEffect, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TokenPrice {
  mint: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number; // percentage
  logoURI?: string;
}

interface TrendingToken {
  mint: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
  liquidity: number;
  logoURI?: string;
}

interface PricesResponse {
  tokens: TokenPrice[];
}

interface TrendingResponse {
  tokens: TrendingToken[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const WATCHLIST_MINTS: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  POPCAT: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
};

const POLL_INTERVAL_MS = 30_000;

/* ------------------------------------------------------------------ */
/*  Formatters                                                         */
/* ------------------------------------------------------------------ */

function formatPrice(value: number): string {
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value === 0) return "$0.00";
  // For values < $1, show up to 6 significant digits
  const str = value.toPrecision(6);
  return `$${parseFloat(str)}`;
}

function formatMarketCap(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function formatChange(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function changeColor(value: number): string {
  if (value > 0) return "text-[#14F195]";
  if (value < 0) return "text-red-400";
  return "text-white/50";
}

/* ------------------------------------------------------------------ */
/*  Skeleton loaders                                                   */
/* ------------------------------------------------------------------ */

function TickerSkeleton() {
  return (
    <div className="flex items-center gap-4 overflow-x-auto px-4 py-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex shrink-0 animate-pulse items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-white/10" />
          <div className="flex flex-col gap-1">
            <div className="h-3 w-10 rounded bg-white/10" />
            <div className="h-3 w-16 rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 px-4 py-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 rounded border border-white/5 bg-white/[0.02] px-3 py-2.5">
          <div className="h-7 w-7 rounded-full bg-white/10" />
          <div className="flex flex-1 flex-col gap-1">
            <div className="h-3 w-20 rounded bg-white/10" />
            <div className="h-2.5 w-32 rounded bg-white/8" />
          </div>
          <div className="h-3 w-14 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function TickerBar({ tokens }: { tokens: TokenPrice[] }) {
  return (
    <div className="flex items-center gap-5 overflow-x-auto border-b border-[#9945FF]/20 bg-[#0a0a14] px-4 py-2.5 scrollbar-none">
      {tokens.map((t) => (
        <div key={t.mint} className="flex shrink-0 items-center gap-2">
          {t.logoURI ? (
            <img
              src={t.logoURI}
              alt={t.symbol}
              className="h-6 w-6 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#9945FF]/30 font-mono text-[9px] font-bold text-[#9945FF]">
              {t.symbol.charAt(0)}
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-mono text-[11px] font-semibold text-white/90">
              {t.symbol}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-white/60">
                {formatPrice(t.price)}
              </span>
              <span className={`font-mono text-[10px] font-medium ${changeColor(t.priceChange24h)}`}>
                {formatChange(t.priceChange24h)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TrendingTable({ tokens }: { tokens: TrendingToken[] }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#9945FF]">
        Trending Tokens
      </div>

      {/* Header */}
      <div className="mb-1.5 grid grid-cols-[28px_1fr_90px_70px_80px_80px] items-center gap-2 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-white/30">
        <span />
        <span>Token</span>
        <span className="text-right">Price</span>
        <span className="text-right">24h</span>
        <span className="text-right">MCap</span>
        <span className="text-right">Liq</span>
      </div>

      <div className="space-y-1">
        {tokens.map((t, idx) => (
          <div
            key={t.mint}
            className="grid grid-cols-[28px_1fr_90px_70px_80px_80px] items-center gap-2 rounded border border-white/5 bg-white/[0.02] px-3 py-2 transition-colors hover:border-[#9945FF]/25 hover:bg-[#9945FF]/[0.04]"
          >
            {/* Logo */}
            <div className="flex items-center justify-center">
              {t.logoURI ? (
                <img
                  src={t.logoURI}
                  alt={t.symbol}
                  className="h-6 w-6 rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#9945FF]/20 font-mono text-[9px] font-bold text-[#9945FF]">
                  {idx + 1}
                </div>
              )}
            </div>

            {/* Symbol + Name */}
            <div className="min-w-0">
              <div className="truncate font-mono text-[11px] font-semibold text-white/90">
                {t.symbol}
              </div>
              <div className="truncate font-mono text-[9px] text-white/35">
                {t.name}
              </div>
            </div>

            {/* Price */}
            <div className="text-right font-mono text-[11px] text-white/80">
              {formatPrice(t.price)}
            </div>

            {/* 24h Change */}
            <div className={`text-right font-mono text-[11px] font-medium ${changeColor(t.priceChange24h)}`}>
              {formatChange(t.priceChange24h)}
            </div>

            {/* Market Cap */}
            <div className="text-right font-mono text-[10px] text-white/50">
              {formatMarketCap(t.marketCap)}
            </div>

            {/* Liquidity */}
            <div className="text-right font-mono text-[10px] text-white/50">
              {formatMarketCap(t.liquidity)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function MarketPanel() {
  const [prices, setPrices] = useState<TokenPrice[]>([]);
  const [trending, setTrending] = useState<TrendingToken[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [errorPrices, setErrorPrices] = useState<string | null>(null);
  const [errorTrending, setErrorTrending] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  /* ---- Fetch prices ---- */
  const fetchPrices = useCallback(async () => {
    try {
      setErrorPrices(null);
      const res = await fetch("/api/market?type=prices");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: PricesResponse = await res.json();

      // Re-order to match watchlist order and filter to watchlist only
      const mintOrder = Object.values(WATCHLIST_MINTS);
      const byMint = new Map(data.tokens.map((t) => [t.mint, t]));
      const ordered: TokenPrice[] = [];
      for (const mint of mintOrder) {
        const token = byMint.get(mint);
        if (token) ordered.push(token);
      }
      // If API returned them differently keyed, fall back to whatever we got
      setPrices(ordered.length > 0 ? ordered : data.tokens.slice(0, 5));
      setLastUpdated(new Date());
    } catch (err) {
      setErrorPrices(err instanceof Error ? err.message : "Failed to fetch prices");
    } finally {
      setLoadingPrices(false);
    }
  }, []);

  /* ---- Fetch trending ---- */
  const fetchTrending = useCallback(async () => {
    try {
      setErrorTrending(null);
      const res = await fetch("/api/market?type=trending");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: TrendingResponse = await res.json();
      setTrending(data.tokens.slice(0, 10));
    } catch (err) {
      setErrorTrending(err instanceof Error ? err.message : "Failed to fetch trending");
    } finally {
      setLoadingTrending(false);
    }
  }, []);

  /* ---- Mount + polling ---- */
  useEffect(() => {
    let active = true;
    const run = () => {
      if (!active) return;
      void fetchPrices();
      void fetchTrending();
    };
    run();
    const interval = setInterval(run, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Retry handler ---- */
  const handleRetry = useCallback(() => {
    setLoadingPrices(true);
    setLoadingTrending(true);
    void fetchPrices();
    void fetchTrending();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Render ---- */
  const hasError = errorPrices || errorTrending;

  return (
    <section className="flex h-full min-h-0 flex-col" style={{ backgroundColor: "#0a0a14" }}>
      {/* Header */}
      <div className="border-b border-[#9945FF]/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#9945FF]">
              Solana Market
            </div>
            <div className="mt-1 font-mono text-[10px] text-white/35">
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString()}`
                : "Loading market data\u2026"}
            </div>
          </div>
          <div className="flex h-5 w-5 items-center justify-center">
            <div
              className={`h-2 w-2 rounded-full ${
                hasError
                  ? "bg-red-400"
                  : loadingPrices || loadingTrending
                    ? "animate-pulse bg-amber-400"
                    : "bg-[#14F195]"
              }`}
              title={hasError ? "Error" : loadingPrices || loadingTrending ? "Loading" : "Live"}
            />
          </div>
        </div>
      </div>

      {/* Error banner */}
      {hasError && (
        <div className="mx-4 mt-3 flex items-center justify-between rounded border border-red-500/30 bg-red-500/10 px-3 py-2">
          <span className="font-mono text-[11px] text-red-200">
            {errorPrices ?? errorTrending}
          </span>
          <button
            type="button"
            onClick={handleRetry}
            className="ml-3 shrink-0 rounded border border-[#9945FF]/40 bg-[#9945FF]/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#9945FF] transition-colors hover:border-[#9945FF]/60 hover:bg-[#9945FF]/25"
          >
            Retry
          </button>
        </div>
      )}

      {/* Ticker bar */}
      {loadingPrices && prices.length === 0 ? (
        <TickerSkeleton />
      ) : prices.length > 0 ? (
        <TickerBar tokens={prices} />
      ) : null}

      {/* Trending table */}
      {loadingTrending && trending.length === 0 ? (
        <TableSkeleton />
      ) : trending.length > 0 ? (
        <TrendingTable tokens={trending} />
      ) : !hasError ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="font-mono text-[11px] text-white/30">No trending data available.</span>
        </div>
      ) : null}
    </section>
  );
}
