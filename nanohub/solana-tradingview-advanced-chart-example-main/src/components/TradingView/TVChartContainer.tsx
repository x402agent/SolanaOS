"use client";

import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { SolanaTrackerDataFeed } from "@/lib/datafeed";
import type { TokenTransaction } from "@/lib/datafeed";
import * as saveLoadAdapter from "@/lib/saveLoadAdapter";
import type { TokenDetailResponse } from "@solana-tracker/data-api";
import { getDatastream } from "@/lib/datastream";
import "./chart.css";

type IChartingLibraryWidget = any;
type ChartingLibraryWidgetOptions = any;
type ResolutionString = string;

declare global {
  interface Window {
    holdersData?: {
      holders: { holders: number; time: number }[];
      timeMap: Map<number, number>;
      lastValue: number | null;
    };
    tvWidget?: IChartingLibraryWidget;
    resetChartCache?: () => void;
    holdersCleanup?: () => void;
    marketCapMode?: boolean;
    tokenSupply?: number;
  }
}

interface TVChartContainerProps {
  tokenAddress: string;
  onTransaction?: (tx: TokenTransaction) => void;
  theme?: "Dark" | "Light";
}


const RESOLUTION_TO_TYPE: Record<string, string> = {
  "1S": "1m", "5S": "1m", "15S": "1m",
  "1": "1m", "5": "5m", "15": "15m", "30": "30m",
  "60": "1h", "240": "4h", "360": "6h", "720": "12h", "1440": "1d",
};

function flatten(
  obj: Record<string, any>,
  opts?: { restrictTo?: string[] }
): Record<string, any> {
  let restrict = opts?.restrictTo;
  if (restrict) {
    restrict = restrict.filter((k) => Object.prototype.hasOwnProperty.call(obj, k));
  }
  const result: Record<string, any> = {};
  (function recurse(o: Record<string, any>, prefix: string, keys?: string[]) {
    (keys || Object.keys(o)).forEach((key) => {
      const val = o[key];
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (val && typeof val === "object" && !Array.isArray(val)) {
        recurse(val, newKey);
      } else {
        result[newKey] = val;
      }
    });
  })(obj, "", restrict);
  return result;
}


export interface TVChartHandle {
  setWalletMarks: (marks: any[], wallet: string | null) => void;
  refreshMarks: () => void;
}

export const TVChartContainer = forwardRef<TVChartHandle, TVChartContainerProps>(function TVChartContainer({ tokenAddress, onTransaction, theme = "Dark" }, ref) {
  const widgetRef = useRef<IChartingLibraryWidget | null>(null);
  const datafeedRef = useRef<SolanaTrackerDataFeed | null>(null);
  const themeRef = useRef(theme);
  const rerenderTogglesRef = useRef<(() => void)[]>([]);
  const [widgetReady, setWidgetReady] = useState(false);

  themeRef.current = theme;

  // ─── Token detail via TanStack Query (replaces useEffect fetch) ────
  const { data: tokenDetail, isLoading: loading, error: queryError } = useQuery({
    queryKey: ["tokenDetail", tokenAddress],
    queryFn: async () => {
      const r = await fetch(`/api/token?address=${tokenAddress}`);
      if (!r.ok) throw new Error(`Token fetch failed: ${r.status}`);
      return r.json() as Promise<TokenDetailResponse>;
    },
    staleTime: 60_000,
    retry: 1,
  });
  const error = queryError ? (queryError as Error).message : null;

  useImperativeHandle(ref, () => ({
    setWalletMarks: (marks: any[], wallet: string | null) => {
      datafeedRef.current?.setWalletMarks(marks, wallet);
    },
    refreshMarks: () => {
      try {
        const chart = widgetRef.current?.activeChart();
        if (!chart) return;
        chart.clearMarks();
        chart.refreshMarks();
      } catch { /* */ }
    },
  }), []);

  useEffect(() => {
    if (!tokenDetail) return;

    const currentTheme = themeRef.current;
    const symbol = tokenDetail.token.symbol;

    if (window.marketCapMode === undefined) {
      window.marketCapMode = localStorage.getItem("chartMode") === "marketCap";
    }
    window.tokenSupply = tokenDetail.pools?.[0]?.tokenSupply ?? 0;

    const datafeed = new SolanaTrackerDataFeed({
      tokenAddress,
      tokenSymbol: symbol,
      tokenDetail,
      marketCapMode: window.marketCapMode,
      getDatastream: () => getDatastream(),
      onTransaction: (tx) => {
        onTransaction?.(tx);
        const watched = datafeed.getWatchedWallet();
        if (watched && tx.wallet === watched) {
          try {
            const chart = widgetRef.current?.activeChart();
            if (chart) { chart.clearMarks(); chart.refreshMarks(); }
          } catch { /* */ }
        }
      },
    });
    datafeedRef.current = datafeed;

    const chartProperties = JSON.parse(
      localStorage.getItem("chartproperties") || "{}"
    );
    const savedProperties = flatten(chartProperties, {
      restrictTo: ["scalesProperties", "paneProperties", "tradingProperties"],
    });

    const script = document.createElement("script");
    script.src = "/static/charting_library/charting_library.standalone.js";
    script.async = true;

    let handleRecreateWidget: (() => void) | null = null;

    script.onload = () => {
      const createWidget = () => {
        const { widget } = (window as any).TradingView ?? {};
        if (!widget) {
          console.error("TradingView widget constructor not found");
          return;
        }

        const widgetOptions: ChartingLibraryWidgetOptions = {
        symbol,
        datafeed,
        container: "TVChartContainer",
        library_path: "/static/charting_library/",
        auto_save_delay: 5,
        locale: "en",
        has_seconds: true,
        seconds_multipliers: [1, 5, 15],
        disabled_features: [],
        enabled_features: [
          "study_templates",
          "use_localstorage_for_settings",
          "seconds_resolution",
        ],
        load_last_chart: true,
        fullscreen: false,
        autosize: true,
        supports_marks: true,
        supported_resolutions: [
          "1S", "5S", "15S",
          "1", "5", "15", "30", "60",
          "240", "360", "720", "1440",
        ] as ResolutionString[],
        allow_symbol_change: false,
        interval: "1S" as ResolutionString,
        theme: currentTheme,
        custom_css_url: "/static/charting_library/custom.css",
        loading_screen: {
          backgroundColor: currentTheme === "Dark" ? "#0c0c0e" : "#ffffff",
          foregroundColor: currentTheme === "Dark" ? "#9a9aa0" : "#525252",
        },
        overrides: {
          ...savedProperties,
          "mainSeriesProperties.candleStyle.upColor": "#16a34a",
          "mainSeriesProperties.candleStyle.downColor": "#dc2626",
          "mainSeriesProperties.candleStyle.borderUpColor": "#16a34a",
          "mainSeriesProperties.candleStyle.borderDownColor": "#dc2626",
          "mainSeriesProperties.candleStyle.wickUpColor": "#16a34a",
          "mainSeriesProperties.candleStyle.wickDownColor": "#dc2626",
          "mainSeriesProperties.lineStyle.color": "#16a34a",
          "mainSeriesProperties.lineStyle.linewidth": 2,
          "mainSeriesProperties.lineStyle.priceSource": "close",
          "mainSeriesProperties.areaStyle.color1": "#16a34a",
          "mainSeriesProperties.areaStyle.color2": "#16a34a",
          "mainSeriesProperties.areaStyle.linecolor": "#16a34a",
          "mainSeriesProperties.areaStyle.linewidth": 2,
          "mainSeriesProperties.areaStyle.priceSource": "close",
          "mainSeriesProperties.areaStyle.transparency": 90,
          "mainSeriesProperties.baselineStyle.baselineColor": "#16a34a",
          "mainSeriesProperties.baselineStyle.topFillColor1": "#16a34a",
          "mainSeriesProperties.baselineStyle.topFillColor2": "#16a34a",
          "mainSeriesProperties.baselineStyle.bottomFillColor1": "#dc2626",
          "mainSeriesProperties.baselineStyle.bottomFillColor2": "#dc2626",
          "mainSeriesProperties.baselineStyle.topLineColor": "#16a34a",
          "mainSeriesProperties.baselineStyle.bottomLineColor": "#dc2626",
          "mainSeriesProperties.baselineStyle.topLineWidth": 2,
          "mainSeriesProperties.baselineStyle.bottomLineWidth": 2,
          "mainSeriesProperties.baselineStyle.priceSource": "close",
          "mainSeriesProperties.baselineStyle.transparency": 90,
          "paneProperties.backgroundType": "solid",
          "paneProperties.background": currentTheme === "Dark" ? "#0c0c0e" : "#ffffff",
          "paneProperties.backgroundGradientStartColor": currentTheme === "Dark" ? "#0c0c0e" : "#ffffff",
          "paneProperties.backgroundGradientEndColor": currentTheme === "Dark" ? "#0c0c0e" : "#ffffff",
          "paneProperties.vertGridProperties.color": currentTheme === "Dark" ? "#1a1a1e" : "#f0f0f0",
          "paneProperties.horzGridProperties.color": currentTheme === "Dark" ? "#1a1a1e" : "#f0f0f0",
          "paneProperties.separatorColor": currentTheme === "Dark" ? "#232326" : "#e0e0e0",
          "paneProperties.crossHairProperties.color": currentTheme === "Dark" ? "#333338" : "#d4d4d8",
          "scalesProperties.backgroundColor": currentTheme === "Dark" ? "#0c0c0e" : "#ffffff",
          "scalesProperties.lineColor": currentTheme === "Dark" ? "#232326" : "#e0e0e0",
          "scalesProperties.textColor": currentTheme === "Dark" ? "#9a9aa0" : "#525252",
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone as any,
        save_load_adapter: saveLoadAdapter,
        supports_timescale_marks: true,


        custom_indicators_getter: function (PineJS: any) {
          if (!window.holdersData) {
            window.holdersData = {
              holders: [],
              timeMap: new Map(),
              lastValue: null,
            };
          }

          return Promise.resolve([
            {
              name: "Token Holders",
              metainfo: {
                _metainfoVersion: 52,
                id: "TokenHolders@tv-basicstudies-1",
                description: "Token Holders Count",
                shortDescription: "Holders",
                format: { type: "volume" },
                is_price_study: false,
                is_hidden_study: false,
                linkedToSeries: false,
                plots: [{ id: "plot_0", type: "line" }],
                defaults: {
                  styles: {
                    plot_0: {
                      linestyle: 0,
                      linewidth: 2,
                      plottype: 0,
                      trackPrice: false,
                      transparency: 0,
                      visible: true,
                      color: "#3b82f6",
                    },
                  },
                  precision: 0,
                  inputs: {},
                },
                styles: {
                  plot_0: {
                    title: "Holders",
                    histogramBase: 0,
                    joinPoints: true,
                  },
                },
                inputs: [],
              },
              constructor: function (this: any) {
                this.init = function (this: any, context: any) {
                  this._context = context;
                };
                this.main = function (this: any, context: any) {
                  this._context = context;
                  const barTime = this._context.symbol.time;
                  if (!window.holdersData?.timeMap) return [NaN];

                  const exact = window.holdersData.timeMap.get(barTime);
                  if (exact !== undefined) {
                    window.holdersData.lastValue = exact;
                    return [exact];
                  }

                  let best = window.holdersData.lastValue;
                  let bestTime = 0;
                  for (const [t, count] of window.holdersData.timeMap) {
                    if (t <= barTime && t > bestTime) {
                      best = count;
                      bestTime = t;
                    }
                  }
                  if (best !== null) {
                    window.holdersData.lastValue = best;
                    return [best];
                  }
                  return [NaN];
                };
              },
            },
          ]);
        },
      };

      const tvWidget = new widget(widgetOptions);
      widgetRef.current = tvWidget;
      window.tvWidget = tvWidget;

      tvWidget.onChartReady(() => {
        const bg = currentTheme === "Dark" ? "#0c0c0e" : "#ffffff";
        const gridColor = currentTheme === "Dark" ? "#1a1a1e" : "#f0f0f0";
        const sepColor = currentTheme === "Dark" ? "#232326" : "#e0e0e0";
        try {
          tvWidget.applyOverrides({
            "paneProperties.backgroundType": "solid",
            "paneProperties.background": bg,
            "paneProperties.vertGridProperties.color": gridColor,
            "paneProperties.horzGridProperties.color": gridColor,
            "paneProperties.separatorColor": sepColor,
            "scalesProperties.backgroundColor": bg,
            "scalesProperties.lineColor": sepColor,
          });
          tvWidget.setCSSCustomProperty("--tv-color-platform-background", bg);
          tvWidget.setCSSCustomProperty("--tv-color-pane-background", bg);
          tvWidget.setCSSCustomProperty("--tv-color-toolbar-background", bg);
          tvWidget.setCSSCustomProperty("--tv-color-toolbar-divider-background", sepColor);
          tvWidget.setCSSCustomProperty("--tv-color-scroll-background", bg);
        } catch { /* */ }

        tvWidget.activeChart().setChartType(1);
        setWidgetReady(true);

        tvWidget.headerReady().then(() => {
          const rerenders: (() => void)[] = [];
          rerenders.push(createChartModeToggle(tvWidget, datafeed));
          rerenders.push(createHoldersToggle(tvWidget, tokenAddress, () => getDatastream()));
          rerenderTogglesRef.current = rerenders;
        });
      });
      };

      createWidget();

      handleRecreateWidget = () => {
        if (widgetRef.current) {
          try { widgetRef.current.remove(); } catch { /* */ }
          widgetRef.current = null;
        }
        setTimeout(() => {
          createWidget();
          setTimeout(() => {
            const savedState = sessionStorage.getItem('chartState');
            if (savedState && window.tvWidget) {
              try {
                const state = JSON.parse(savedState);
                const chart = window.tvWidget.activeChart();
                if (chart.resolution() !== state.resolution) {
                  chart.setResolution(state.resolution);
                }
                chart.setVisibleRange(state.visibleRange, { applyDefaultRightMargin: true });
                sessionStorage.removeItem('chartState');
              } catch { /* */ }
            }
          }, 1000);
        }, 100);
      };

      window.addEventListener('recreateWidget', handleRecreateWidget);
    };

    document.head.appendChild(script);

    return () => {
      if (handleRecreateWidget) {
        window.removeEventListener('recreateWidget', handleRecreateWidget);
      }
      setWidgetReady(false);
      if (window.holdersCleanup) {
        window.holdersCleanup();
        window.holdersCleanup = undefined;
      }
      if (widgetRef.current) {
        try { widgetRef.current.remove(); } catch { /* */ }
        widgetRef.current = null;
      }
      datafeedRef.current?.destroy();
      datafeedRef.current = null;
      script.remove();
    };
  }, [tokenDetail, tokenAddress]);


  useEffect(() => {
    if (!widgetReady || !widgetRef.current) return;
    const w = widgetRef.current;
    const bg = theme === "Dark" ? "#0c0c0e" : "#ffffff";

    const gridColor = theme === "Dark" ? "#1a1a1e" : "#f0f0f0";
    const sepColor = theme === "Dark" ? "#232326" : "#e0e0e0";

    const applyThemeOverrides = () => {
      try {
        w.applyOverrides({
          "paneProperties.backgroundType": "solid",
          "paneProperties.background": bg,
          "paneProperties.backgroundGradientStartColor": bg,
          "paneProperties.backgroundGradientEndColor": bg,
          "paneProperties.vertGridProperties.color": gridColor,
          "paneProperties.horzGridProperties.color": gridColor,
          "paneProperties.separatorColor": sepColor,
          "paneProperties.crossHairProperties.color": theme === "Dark" ? "#333338" : "#d4d4d8",
          "scalesProperties.backgroundColor": bg,
          "scalesProperties.lineColor": sepColor,
          "scalesProperties.textColor": theme === "Dark" ? "#9a9aa0" : "#525252",
        });
        w.setCSSCustomProperty("--tv-color-platform-background", bg);
        w.setCSSCustomProperty("--tv-color-pane-background", bg);
        w.setCSSCustomProperty("--tv-color-toolbar-background", bg);
        w.setCSSCustomProperty("--tv-color-toolbar-divider-background", sepColor);
        w.setCSSCustomProperty("--tv-color-scroll-background", bg);
      } catch { /* */ }
    };

    try {
      w.changeTheme(theme, { disableUndo: true });
    } catch { /* */ }

    applyThemeOverrides();
    const t1 = setTimeout(() => {
      applyThemeOverrides();
      rerenderTogglesRef.current.forEach((fn) => fn());
    }, 200);
    const t2 = setTimeout(applyThemeOverrides, 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [theme, widgetReady]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-full text-[13px]"
        style={{ color: "var(--text-muted)" }}
      >
        Loading token data…
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center h-full text-[13px]"
        style={{ color: "var(--red)" }}
      >
        Error: {error}
      </div>
    );
  }

  return <div id="TVChartContainer" className="w-full h-full" />;
});


function createChartModeToggle(
  tvWidget: IChartingLibraryWidget,
  datafeed: SolanaTrackerDataFeed
) {
  const button = tvWidget.createButton();
  button.setAttribute("title", "Toggle between Price and Market Cap");
  button.style.cssText = "margin-right: 8px; cursor: pointer;";

  let isMarketCap = localStorage.getItem("chartMode") === "marketCap";

  const getColors = () => {
    const isDark = document.documentElement.classList.contains("dark");
    return {
      pillBg: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
      pillBorder: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)",
      activeBg: isDark ? "rgba(255,255,255,0.12)" : "#ffffff",
      activeShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.08)",
      activeText: isDark ? "#e8e8ec" : "#0a0a0a",
      inactiveText: isDark ? "#71717a" : "#9a9a9a",
    };
  };

  const render = () => {
    const c = getColors();
    button.innerHTML = `
      <div style="display:inline-flex;background:${c.pillBg};border:1px solid ${c.pillBorder};border-radius:6px;padding:2px;gap:1px">
        <div style="padding:4px 12px;font-size:12px;font-weight:600;border-radius:4px;cursor:pointer;transition:all .15s;
          background:${!isMarketCap ? c.activeBg : "transparent"};color:${!isMarketCap ? c.activeText : c.inactiveText};box-shadow:${!isMarketCap ? c.activeShadow : "none"}">
          Price
        </div>
        <div style="padding:4px 12px;font-size:12px;font-weight:600;border-radius:4px;cursor:pointer;transition:all .15s;
          background:${isMarketCap ? c.activeBg : "transparent"};color:${isMarketCap ? c.activeText : c.inactiveText};box-shadow:${isMarketCap ? c.activeShadow : "none"}">
          Market Cap
        </div>
      </div>`;
  };

  render();

  const marketCapFormatter = {
    format: (value: number) => {
      const absValue = Math.abs(value);
      const sign = value < 0 ? '-' : '';
      if (absValue >= 1e12) return sign + (absValue / 1e12).toFixed(2) + 'T';
      if (absValue >= 1e9) return sign + (absValue / 1e9).toFixed(2) + 'B';
      if (absValue >= 1e6) return sign + (absValue / 1e6).toFixed(2) + 'M';
      if (absValue >= 1e3) return sign + (absValue / 1e3).toFixed(2) + 'k';
      return sign + absValue.toFixed(0);
    }
  };

  const priceFormatter = {
    format: (value: number) => {
      if (value === 0) return '0';
      const absValue = Math.abs(value);
      if (absValue < 0.000001) return value.toExponential(2);
      if (absValue < 0.01) return value.toFixed(8);
      if (absValue < 1) return value.toFixed(6);
      if (absValue < 100) return value.toFixed(4);
      return value.toFixed(2);
    }
  };

  button.addEventListener("click", () => {
    isMarketCap = !isMarketCap;
    localStorage.setItem("chartMode", isMarketCap ? "marketCap" : "price");
    window.marketCapMode = isMarketCap;
    datafeed.setMarketCapMode(isMarketCap);

    if (window.resetChartCache) window.resetChartCache();

    try {
      const chart = tvWidget.activeChart();
      const formatter = isMarketCap ? marketCapFormatter : priceFormatter;

      try {
        const priceScale = (chart as any).getPanes()[0].getMainSourcePriceScale();
        if (priceScale && typeof priceScale.setFormatter === 'function') {
          priceScale.setFormatter(formatter);
        } else {
          throw new Error('setFormatter not available');
        }
      } catch {
        const visibleRange = chart.getVisibleRange();
        const resolution = chart.resolution();
        sessionStorage.setItem('chartState', JSON.stringify({
          resolution,
          visibleRange,
          timestamp: Date.now(),
        }));

        window.dispatchEvent(new CustomEvent('recreateWidget'));
        render();
        return;
      }

      chart.resetData();

      setTimeout(() => {
        try {
          const visibleRange = chart.getVisibleRange();
          chart.setVisibleRange(
            { from: visibleRange.from - 0.001, to: visibleRange.to + 0.001 },
            { applyDefaultRightMargin: true }
          );
        } catch { /* */ }
      }, 100);
    } catch { /* */ }

    render();
  });

  return render;
}


function createHoldersToggle(
  tvWidget: IChartingLibraryWidget,
  tokenAddress: string,
  getDs?: () => { subscribe: any } | null
) {
  const button = tvWidget.createButton();
  button.setAttribute("title", "Toggle Holders Chart Overlay");
  button.style.cssText = "cursor: pointer;";

  let enabled = false;
  let studyId: any = null;
  let holdersUnsub: (() => void) | null = null;
  let rangeCheckInterval: ReturnType<typeof setInterval> | null = null;

  const getColors = () => {
    const isDark = document.documentElement.classList.contains("dark");
    return {
      pillBg: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
      pillBorder: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)",
      mutedText: isDark ? "#71717a" : "#9a9a9a",
      mutedDot: isDark ? "#52525b" : "#a1a1aa",
    };
  };

  const render = () => {
    const c = getColors();
    button.innerHTML = enabled
      ? `<div style="display:flex;align-items:center;gap:6px;padding:4px 12px;background:rgba(59,130,246,.12);border-radius:6px;border:1px solid rgba(59,130,246,.3)">
           <div style="width:8px;height:8px;border-radius:2px;background:#3b82f6"></div>
           <span style="color:#3b82f6;font-weight:600;font-size:12px">Holders</span>
         </div>`
      : `<div style="display:flex;align-items:center;gap:6px;padding:4px 12px;background:${c.pillBg};border-radius:6px;border:1px solid ${c.pillBorder}">
           <div style="width:8px;height:8px;border-radius:2px;background:${c.mutedDot}"></div>
           <span style="color:${c.mutedText};font-weight:600;font-size:12px">Holders</span>
         </div>`;
  };

  const cleanup = () => {
    if (holdersUnsub) {
      holdersUnsub();
      holdersUnsub = null;
    }
    if (rangeCheckInterval) {
      clearInterval(rangeCheckInterval);
      rangeCheckInterval = null;
    }
  };

  window.holdersCleanup = cleanup;
  render();

  button.addEventListener("click", async () => {
    enabled = !enabled;
    render();

    const chart = tvWidget.activeChart();

    if (enabled) {
      try {
        const currentRes = chart.resolution();
        const intervalType = RESOLUTION_TO_TYPE[currentRes] ?? "1m";

        const res = await fetch(
          `/api/holders-chart?token=${tokenAddress}&type=${intervalType}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (!data.holders?.length) throw new Error("No holders data");

        window.holdersData = {
          holders: data.holders,
          timeMap: new Map(),
          lastValue: null,
        };

        for (const pt of data.holders) {
          const timeMs = pt.time * 1000;
          window.holdersData.timeMap.set(timeMs, pt.holders);
          window.holdersData.lastValue = pt.holders;
        }

        studyId = await chart.createStudy(
          "Token Holders Count",
          false,
          false,
          [],
          null,
          { checkLimit: false }
        );


        const ds = getDs?.();
        if (ds) {
          try {
            const holdersRef = ds.subscribe.holders(tokenAddress)
              .on((update: any) => {
                if (!update || typeof update.total !== "number") return;
                const timeMs = Date.now();
                const count = update.total;

                window.holdersData!.timeMap.set(timeMs, count);
                window.holdersData!.lastValue = count;
                window.holdersData!.holders.push({
                  time: Math.floor(timeMs / 1000),
                  holders: count,
                });

                if (window.holdersData!.holders.length > 10000) {
                  const removed = window.holdersData!.holders.shift();
                  if (removed) window.holdersData!.timeMap.delete(removed.time * 1000);
                }

                try { chart.refreshMarks(); } catch { /* */ }
              });
            holdersUnsub = holdersRef.unsubscribe;
          } catch (e) {
            console.error("[holders] WS subscribe error:", e);
          }
        }


        let earliestLoadedTime = Math.min(
          ...data.holders.map((p: { time: number }) => p.time)
        );
        let isLoadingHistorical = false;
        let lastLoadTime = 0;

        const loadHistoricalData = async (fromTime: number, toTime: number) => {
          if (isLoadingHistorical) return;
          const now = Date.now();
          if (now - lastLoadTime < 2000) return;
          isLoadingHistorical = true;
          lastLoadTime = now;

          try {
            const params = new URLSearchParams({
              token: tokenAddress,
              type: intervalType,
              timeFrom: String(fromTime),
              timeTo: String(toTime),
            });
            const resp = await fetch(`/api/holders-chart?${params}`);
            if (!resp.ok) return;
            const hist = await resp.json();
            if (!hist.holders?.length) return;

            let added = 0;
            hist.holders
              .sort((a: any, b: any) => a.time - b.time)
              .forEach((pt: { time: number; holders: number }) => {
                const timeMs = pt.time * 1000;
                if (!window.holdersData!.timeMap.has(timeMs)) {
                  window.holdersData!.timeMap.set(timeMs, pt.holders);
                  window.holdersData!.holders.push(pt);
                  added++;
                  if (pt.time < earliestLoadedTime) earliestLoadedTime = pt.time;
                }
              });

            if (added > 0) {
              window.holdersData!.holders.sort((a, b) => a.time - b.time);
              lastCheckedRange = 0;
              if (studyId) {
                try {
                  await chart.removeEntity(studyId);
                  studyId = await chart.createStudy(
                    "Token Holders Count",
                    false, false, [], null, { checkLimit: false }
                  );
                } catch { /* */ }
              }
            }
          } catch (e) {
            console.error("[holders] historical load error:", e);
          } finally {
            isLoadingHistorical = false;
          }
        };

        let lastCheckedRange = 0;

        rangeCheckInterval = setInterval(() => {
          try {
            const range = chart.getVisibleRange();
            if (!range?.from) return;
            const rangeFrom = Math.floor(range.from);
            if (rangeFrom < earliestLoadedTime && rangeFrom !== lastCheckedRange) {
              lastCheckedRange = rangeFrom;
              loadHistoricalData(rangeFrom - 86400, earliestLoadedTime);
            }
          } catch { /* */ }
        }, 1000);

      } catch (e: any) {
        console.error("[holders]", e);
        enabled = false;
        render();
        cleanup();
      }
    } else {
      if (studyId) {
        try { chart.removeEntity(studyId); } catch { /* */ }
        studyId = null;
      }
      cleanup();
    }
  });

  return render;
}
