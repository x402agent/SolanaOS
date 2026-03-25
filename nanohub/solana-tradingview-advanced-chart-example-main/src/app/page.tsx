"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TVChartContainer } from "@/components/TradingView/TVChartContainer";
import type { TVChartHandle } from "@/components/TradingView/TVChartContainer";
import { TradesTable } from "@/components/TradesTable";
import type { TokenTransaction } from "@/lib/datafeed";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { useIsDark } from "@/lib/hooks";

const DEFAULT_TOKEN = "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn";
const MAX_TRADES = 200;

interface SearchResult {
  name: string;
  symbol: string;
  mint: string;
  image?: string;
  verified?: boolean;
  token?: {
    name?: string;
    symbol?: string;
    mint?: string;
    image?: string;
  };
}

function mapTrades(data: any): TokenTransaction[] {
  const items: TokenTransaction[] = Array.isArray(data) ? data : data?.trades ?? data?.data ?? [];
  return items.slice(-MAX_TRADES).map((t: any) => ({
    tx: t.tx ?? t.signature ?? "",
    amount: t.amount ?? 0,
    priceUsd: t.priceUsd ?? t.price ?? 0,
    volume: t.volume ?? 0,
    solVolume: t.solVolume ?? 0,
    type: t.type === "sell" ? "sell" as const : "buy" as const,
    wallet: t.wallet ?? t.owner ?? "",
    time: (t.time ?? t.timestamp ?? 0) > 1e12 ? (t.time ?? t.timestamp) : (t.time ?? t.timestamp ?? 0) * 1000,
    program: t.program ?? "",
    token: t.token ?? { from: { name: "", symbol: "", decimals: 0, amount: 0, address: "" }, to: { name: "", symbol: "", decimals: 0, amount: 0, address: "" } },
  })).sort((a: TokenTransaction, b: TokenTransaction) => a.time - b.time);
}

export default function Home() {
  const [tokenAddress, setTokenAddress] = useState(DEFAULT_TOKEN);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chartRef = useRef<TVChartHandle>(null);
  const [activeWallet, setActiveWallet] = useState<string | null>(null);
  const dark = useIsDark();
  const queryClient = useQueryClient();

  // ─── Token supply via TanStack Query (replaces useEffect fetch) ────
  const { data: tokenSupply = 0 } = useQuery({
    queryKey: ["tokenSupply", tokenAddress],
    queryFn: async () => {
      const r = await fetch(`/api/token?address=${tokenAddress}`);
      if (!r.ok) return 0;
      const data = await r.json();
      return data?.pools?.[0]?.tokenSupply ?? 0;
    },
    staleTime: 60_000,
  });

  // ─── Trades via TanStack Query (query cache = single source of truth) ──
  const { data: trades = [] } = useQuery({
    queryKey: ["trades", tokenAddress],
    queryFn: async () => {
      const r = await fetch(`/api/trades?token=${tokenAddress}`);
      if (!r.ok) return [];
      const data = await r.json();
      return mapTrades(data);
    },
    staleTime: Infinity,
  });

  // ─── Outside click (DOM listener — useEffect still appropriate) ────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Keyboard shortcut (DOM listener — useEffect still appropriate) ─
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (value.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    setSearchLoading(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?query=${encodeURIComponent(value.trim())}&limit=8`);
        if (!res.ok) { setSearchResults([]); setSearchOpen(false); return; }
        const json = await res.json();
        const items: SearchResult[] = (json?.data ?? json ?? []).slice(0, 8);
        setSearchResults(items);
        setSearchOpen(items.length > 0);
      } catch {
        setSearchResults([]);
        setSearchOpen(false);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, []);

  const handleSelectToken = useCallback((result: SearchResult) => {
    const mint = result.mint ?? result.token?.mint ?? "";
    if (!mint) return;
    setTokenAddress(mint);
    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);
    setActiveWallet(null);
    // Clear stale cache for the new token so it fetches fresh
    queryClient.removeQueries({ queryKey: ["tokenSupply", mint] });
    queryClient.removeQueries({ queryKey: ["trades", mint] });
  }, [queryClient]);

  const handleTransaction = useCallback((tx: TokenTransaction) => {
    queryClient.setQueryData<TokenTransaction[]>(["trades", tokenAddress], (old = []) => {
      const next = [...old, tx];
      return next.length > MAX_TRADES ? next.slice(next.length - MAX_TRADES) : next;
    });
  }, [queryClient, tokenAddress]);

  // ─── Wallet filter via useMutation (replaces ad-hoc async callback) ─
  const walletFilterMutation = useMutation({
    mutationFn: async (wallet: string) => {
      const res = await fetch(`/api/trades?token=${tokenAddress}&wallet=${wallet}`);
      if (!res.ok) throw new Error("Failed to fetch wallet trades");
      const json = await res.json();
      return { wallet, trades: json?.trades ?? json?.data ?? (Array.isArray(json) ? json : []) };
    },
    onSuccess: ({ wallet, trades: walletTrades }) => {
      const marks = walletTrades.map((t: any) => {
        const vol = (t.volume ?? 0);
        const price = t.priceUsd ?? t.price ?? 0;
        const isBuy = t.type === "buy";
        return {
          id: `wallet-${t.tx ?? t.signature}`,
          time: Math.floor((t.time ?? t.timestamp ?? 0) / (t.time > 1e12 ? 1000 : 1)),
          color: isBuy ? "green" : "red",
          text: `${isBuy ? "Buy" : "Sell"} · $${vol.toLocaleString(undefined, { maximumFractionDigits: 2 })}\nPrice: $${price.toFixed(price < 0.01 ? 8 : 4)}\n${wallet.slice(0, 4)}…${wallet.slice(-4)}`,
          label: isBuy ? "B" : "S",
          labelFontColor: "white",
          minSize: 30,
        };
      });
      chartRef.current?.setWalletMarks(marks, wallet);
      chartRef.current?.refreshMarks();
    },
  });

  const handleWalletFilter = useCallback((wallet: string | null) => {
    setActiveWallet(wallet);

    if (!wallet) {
      chartRef.current?.setWalletMarks([], null);
      chartRef.current?.refreshMarks();
      return;
    }

    walletFilterMutation.mutate(wallet);
  }, [walletFilterMutation]);

  return (
    <div
      className="min-h-screen overflow-y-auto flex justify-center"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="w-full flex flex-col"
        style={{ maxWidth: 1280, padding: "24px 20px 32px", gap: 16 }}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <header
            className="flex items-center gap-4"
            style={{
              padding: "12px 20px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <a
              href="https://www.solanatracker.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 mr-1 no-underline hover:opacity-80 transition-opacity"
            >
              <span
                className="text-[15px] font-semibold tracking-tight"
                style={{ color: "var(--text)" }}
              >
                Solana Tracker
              </span>
            </a>

            <div className="flex-1" />

            <div ref={searchContainerRef} className="relative" style={{ width: 320 }}>
              <div
                className="search-bar flex items-center gap-2.5 rounded-xl"
                style={{
                  height: 38,
                  padding: "0 14px",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="search-icon" style={{ flexShrink: 0 }}>
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.2" />
                  <path d="m16 16 5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
                  placeholder="Search tokens…"
                  className="search-input flex-1 bg-transparent text-[13px] outline-none"
                  style={{ color: "var(--text)" }}
                />
                {searchLoading && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="search-spinner" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round" />
                  </svg>
                )}
                <kbd className="search-kbd">⌘K</kbd>
              </div>

              {searchOpen && searchResults.length > 0 && (
                <div className="search-dropdown absolute right-0 left-0 z-50 mt-1.5 rounded-xl overflow-hidden">
                  {searchResults.map((result, i) => {
                    const name = result.name ?? result.token?.name ?? "";
                    const symbol = result.symbol ?? result.token?.symbol ?? "";
                    const mint = result.mint ?? result.token?.mint ?? "";
                    const image = result.image ?? result.token?.image;
                    return (
                      <button
                        key={mint || i}
                        type="button"
                        onClick={() => handleSelectToken(result)}
                        className="search-result flex items-center gap-3 w-full text-left cursor-pointer"
                        style={{
                          padding: "10px 14px",
                          borderBottom: i < searchResults.length - 1 ? "1px solid var(--search-divider)" : "none",
                        }}
                      >
                        {image && (
                          <img
                            src={image}
                            alt=""
                            width={28}
                            height={28}
                            className="rounded-full"
                            style={{ flexShrink: 0, border: "1px solid var(--search-divider)" }}
                          />
                        )}
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-[13px] font-semibold truncate flex items-center gap-1.5" style={{ color: "var(--text)", letterSpacing: "-0.01em" }}>
                            {name}
                            {result.verified && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                                <circle cx="12" cy="12" r="10" fill="var(--green)" opacity="0.15" />
                                <path d="M9 12l2 2 4-4" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <circle cx="12" cy="12" r="10" stroke="var(--green)" strokeWidth="1.5" />
                              </svg>
                            )}
                          </span>
                          <span className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                            {symbol} · {mint.slice(0, 6)}…{mint.slice(-4)}
                          </span>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="search-result-arrow">
                          <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <AnimatedThemeToggler
              className="flex items-center justify-center cursor-pointer rounded-lg"
              style={{
                width: 36,
                height: 36,
                background: "var(--badge-bg)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            />
          </header>

          <div style={{ height: 560, background: "var(--chart-bg)" }}>
            <TVChartContainer
              ref={chartRef}
              tokenAddress={tokenAddress}
              onTransaction={handleTransaction}
              theme={dark ? "Dark" : "Light"}
            />
          </div>
        </div>

        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-lg)",
            maxHeight: 340,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <TradesTable trades={trades} tokenSupply={tokenSupply} onWalletFilter={handleWalletFilter} activeWallet={activeWallet} />
        </div>
      </div>
    </div>
  );
}
