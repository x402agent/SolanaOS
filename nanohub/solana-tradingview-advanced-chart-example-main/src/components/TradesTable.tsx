"use client";

import React, { useRef, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { TokenTransaction } from "@/lib/datafeed";

interface TradesTableProps {
  trades: TokenTransaction[];
  tokenSupply?: number;
  onWalletFilter?: (wallet: string | null) => void;
  activeWallet?: string | null;
}

const ROW_HEIGHT = 32;
const COLUMNS = ["Time", "Type", "Price", "Amount", "Vol USD", "MCap", "Wallet", "TX"] as const;
const GRID_COLS = "90px 58px minmax(80px,1fr) minmax(70px,1fr) minmax(70px,1fr) minmax(64px,1fr) minmax(110px,1.2fr) 72px";

export function TradesTable({ trades, tokenSupply = 0, onWalletFilter, activeWallet }: TradesTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const reversed = useMemo(() => [...trades].reverse(), [trades]);

  const virtualizer = useVirtualizer({
    count: reversed.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const TradeRow = useCallback(
    ({ trade, style }: { trade: TokenTransaction; style: React.CSSProperties }) => (
      <div
        role="row"
        style={{
          ...style,
          display: "grid",
          gridTemplateColumns: GRID_COLS,
          alignItems: "center",
          borderBottom: "1px solid var(--border-subtle)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--row-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ padding: "0 12px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          {formatTime(trade.time)}
        </div>
        <div style={{ padding: "0 12px" }}>
          <span
            style={{
              display: "inline-block",
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: 4,
              ...(trade.type === "buy"
                ? { background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green-border)" }
                : { background: "var(--red-bg)", color: "var(--red)", border: "1px solid var(--red-border)" }),
            }}
          >
            {trade.type === "buy" ? "BUY" : "SELL"}
          </span>
        </div>
        <div style={{ padding: "0 12px", textAlign: "right", color: "var(--text)", fontFamily: "'DM Mono', monospace" }}>
          ${formatPrice(trade.priceUsd)}
        </div>
        <div style={{ padding: "0 12px", textAlign: "right", color: "var(--text-secondary)", fontFamily: "'DM Mono', monospace" }}>
          {formatAmount(trade.amount)}
        </div>
        <div style={{ padding: "0 12px", textAlign: "right", color: "var(--text)", fontWeight: 500, fontFamily: "'DM Mono', monospace" }}>
          ${trade.volume.toFixed(2)}
        </div>
        <div style={{ padding: "0 12px", textAlign: "right", color: "var(--text-secondary)", fontFamily: "'DM Mono', monospace" }}>
          {formatMarketCap(trade, tokenSupply)}
        </div>
        <div style={{ padding: "0 12px", color: "var(--text-muted)", fontFamily: "'DM Mono', monospace", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden" }}>
          <span className="flex items-center gap-1">
            {trade.wallet.slice(0, 4)}…{trade.wallet.slice(-4)}
            <button
              onClick={() => onWalletFilter?.(activeWallet === trade.wallet ? null : trade.wallet)}
              title={activeWallet === trade.wallet ? "Clear wallet filter" : `Filter trades for ${trade.wallet.slice(0, 4)}…${trade.wallet.slice(-4)}`}
              className="cursor-pointer inline-flex items-center justify-center flex-shrink-0"
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                border: "none",
                background: activeWallet === trade.wallet ? "var(--badge-bg)" : "transparent",
                color: activeWallet === trade.wallet ? "var(--text)" : "var(--text-muted)",
                padding: 0,
                opacity: activeWallet === trade.wallet ? 1 : 0.5,
                transition: "opacity .15s, background .15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={(e) => { if (activeWallet !== trade.wallet) e.currentTarget.style.opacity = "0.5"; }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </button>
          </span>
        </div>
        <div style={{ padding: "0 12px" }}>
          <a
            href={`https://solscan.io/tx/${trade.tx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer"
            style={{ color: "var(--text-muted)", fontFamily: "'DM Mono', monospace", fontSize: 11, textDecoration: "none" }}
          >
            {trade.tx.slice(0, 6)}…
          </a>
        </div>
      </div>
    ),
    [activeWallet, onWalletFilter, tokenSupply]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid var(--border-subtle)",
          width: "100%",
        }}
      >
        <span
          className="text-[11px] font-semibold uppercase"
          style={{ color: "var(--text-muted)", letterSpacing: "0.06em" }}
        >
          Trades
        </span>
        <span
          className="text-[11px] tabular-nums flex items-center gap-2"
          style={{ color: "var(--text-muted)" }}
        >
          {activeWallet && (
            <button
              onClick={() => onWalletFilter?.(null)}
              className="flex items-center gap-1 cursor-pointer"
              title="Clear wallet filter"
              style={{
                fontSize: 10,
                fontFamily: "'DM Mono', monospace",
                padding: "2px 8px",
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: "var(--badge-bg)",
                color: "var(--badge-text)",
                lineHeight: 1.4,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {activeWallet.slice(0, 4)}…{activeWallet.slice(-4)}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2 }}>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </span>
      </div>

      {/* Column headers */}
      <div
        className="flex-shrink-0"
        style={{
          display: "grid",
          gridTemplateColumns: GRID_COLS,
          background: "var(--th-bg)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {COLUMNS.map((col, i) => (
          <div
            key={col}
            className="font-medium"
            style={{
              padding: "6px 12px",
              color: "var(--text-muted)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              textAlign: i >= 2 && i <= 5 ? "right" : "left",
            }}
          >
            {col}
          </div>
        ))}
      </div>

      {/* Virtualized rows */}
      <div ref={parentRef} className="flex-1 overflow-auto" style={{ fontSize: 12 }}>
        {reversed.length === 0 ? (
          <div
            className="text-center"
            style={{ padding: "32px 0", color: "var(--text-muted)", fontSize: 13 }}
          >
            Waiting for trades…
          </div>
        ) : (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const trade = reversed[virtualRow.index];
              return (
                <TradeRow
                  key={trade.tx + "-" + virtualRow.index}
                  trade={trade}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatPrice(price: number): string {
  if (price < 0.00001) return price.toExponential(2);
  if (price < 1) return price.toPrecision(4);
  return price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function formatAmount(amount: number): string {
  if (amount >= 1_000_000_000) return (amount / 1_000_000_000).toFixed(2) + "B";
  if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(2) + "M";
  if (amount >= 1_000) return (amount / 1_000).toFixed(2) + "K";
  return amount.toFixed(2);
}

function formatMarketCap(t: TokenTransaction, tokenSupply: number): string {
  const mc = t.priceUsd && tokenSupply ? t.priceUsd * tokenSupply : 0;
  if (!mc) return "—";
  if (mc >= 1_000_000_000) return "$" + (mc / 1_000_000_000).toFixed(2) + "B";
  if (mc >= 1_000_000) return "$" + (mc / 1_000_000).toFixed(2) + "M";
  if (mc >= 1_000) return "$" + (mc / 1_000).toFixed(2) + "K";
  return "$" + mc.toFixed(2);
}
