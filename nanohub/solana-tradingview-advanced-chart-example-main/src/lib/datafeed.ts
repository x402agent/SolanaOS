import type {
  PoolInfo,
  TokenDetailResponse,
} from "@solana-tracker/data-api";

interface AggregatedPriceUpdate {
  token: string;
  timestamp: number;
  price: number;
  pool: string;
  aggregated: {
    median: number;
    average: number;
    min: number;
    max: number;
    poolCount: number;
  };
}

interface VolumeTokenUpdate {
  token: string;
  volume: number;
  txCount: number;
  timestamp: number;
}

export interface TokenTransaction {
  tx: string;
  amount: number;
  priceUsd: number;
  volume: number;
  solVolume: number;
  type: "buy" | "sell";
  wallet: string;
  time: number;
  program: string;
  token: {
    from: {
      name: string;
      symbol: string;
      image?: string;
      decimals: number;
      amount: number;
      address: string;
      price?: { usd: number };
      marketCap?: { usd: number };
    };
    to: {
      name: string;
      symbol: string;
      image?: string;
      decimals: number;
      amount: number;
      address: string;
      price?: { usd: number };
      marketCap?: { usd: number };
    };
  };
}


export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SymbolInfo {
  ticker: string;
  name: string;
  description: string;
  type: string;
  session: string;
  timezone: string;
  minmov: number;
  pricescale: number;
  has_intraday: boolean;
  has_seconds: boolean;
  full_name: string;
  seconds_multipliers?: number[];
  intraday_multipliers?: string[];
  supported_resolutions?: string[];
  volume_precision?: number;
  data_status?: string;
  supports_marks?: boolean;
  supports_timescale_marks?: boolean;
  visible_plots_set?: string;
  base_name?: string[];
  legs?: string[];
  pro_name?: string;
  exchange?: string;
  listed_exchange?: string;
  format?: string;
}

interface PeriodParams {
  from: number;
  to: number;
  firstDataRequest: boolean;
  lastReqTime?: number;
}

interface Mark {
  id: string;
  time: number;
  color: string;
  text: string;
  label: string;
  labelFontColor: string;
  minSize: number;
}

interface Trade {
  tx: string;
  time: number;
  type: "buy" | "sell";
  volume: number;
}


const RESOLUTION_MAP: Record<string, string> = {
  "1S": "1s",
  "1s": "1s",
  "5S": "5s",
  "5s": "5s",
  "15S": "15s",
  "15s": "15s",
  "1": "1m",
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1h",
  "120": "2h",
  "180": "3h",
  "240": "4h",
  "360": "6h",
  "720": "12h",
  "1440": "1d",
};

function formatResolution(resolution: string): string {
  return RESOLUTION_MAP[resolution] ?? "1m";
}

function getResolutionInSeconds(resolution: string): number {
  if (resolution.endsWith("S") || resolution.endsWith("s")) {
    return parseInt(resolution) || 1;
  }
  const min = parseInt(resolution);
  return isNaN(min) ? 60 : min * 60;
}

const lastBars = new Map<string, Bar>();
const lastAPIBars = new Map<string, Bar>();

if (typeof window !== "undefined") {
  window.resetChartCache = () => {
    lastBars.clear();
    lastAPIBars.clear();
  };
}

export class SolanaTrackerDataFeed {
  private tokenAddress: string;
  private tokenSymbol: string;
  private tokenDetail: TokenDetailResponse | null = null;

  private isActive = true;
  private marketCapMode = false;
  private tokenSupply = 0;

  private realtimeHandler: ((data: Partial<AggregatedPriceUpdate & { volume: number; _mcAdjusted?: boolean }>) => void) | null = null;
  private priceUnsub: (() => void) | null = null;
  private volumeUnsub: (() => void) | null = null;
  private txUnsub: (() => void) | null = null;

  private walletMarks: Mark[] = [];
  private watchedWallet: string | null = null;
  private deployerMarks: Mark[] = [];
  private deployerAddress: string | null = null;

  private onTransaction: ((tx: TokenTransaction) => void) | null = null;
  private markInterval: ReturnType<typeof setInterval> | null = null;
  private prefetchPromise: Promise<Bar[]> | null = null;
  private getDatastream: (() => { subscribe: any } | null) | undefined;

  constructor(opts: {
    tokenAddress: string;
    tokenSymbol?: string;
    tokenDetail?: TokenDetailResponse;
    marketCapMode?: boolean;
    getDatastream?: () => { subscribe: any } | null;
    onTransaction?: (tx: TokenTransaction) => void;
  }) {
    this.tokenAddress = opts.tokenAddress;
    this.tokenSymbol = opts.tokenDetail?.token?.symbol ?? opts.tokenSymbol ?? "TOKEN";
    this.tokenDetail = opts.tokenDetail ?? null;
    this.marketCapMode = opts.marketCapMode ?? false;
    this.getDatastream = opts.getDatastream;
    this.onTransaction = opts.onTransaction ?? null;

    if (this.tokenDetail?.pools?.[0]?.tokenSupply) {
      this.tokenSupply = this.tokenDetail.pools[0].tokenSupply;
    }

    this.deployerAddress = this.tokenDetail?.pools?.[0]?.deployer ?? null;
    if (this.deployerAddress) {
      this.fetchDeployerMarks().catch(() => {});
    }

    this.prefetchPromise = this.fetchOHLCV("1S", { from: 0, to: Math.floor(Date.now() / 1000), firstDataRequest: true }).catch(() => []);
  }

  setMarketCapMode(enabled: boolean) {
    this.marketCapMode = enabled;
    window.marketCapMode = enabled;
    lastBars.clear();
    lastAPIBars.clear();
  }

  setWalletMarks(marks: Mark[], wallet: string | null) {
    this.walletMarks = marks;
    this.watchedWallet = wallet;
  }

  addWalletMark(mark: Mark) {
    this.walletMarks.push(mark);
  }

  getWatchedWallet(): string | null {
    return this.watchedWallet;
  }

  setTokenDetail(detail: TokenDetailResponse) {
    this.tokenDetail = detail;
    this.tokenSymbol = detail.token.symbol;
    if (detail.pools?.[0]?.tokenSupply) {
      this.tokenSupply = detail.pools[0].tokenSupply;
    }
    const newDeployer = detail.pools?.[0]?.deployer ?? null;
    if (newDeployer && newDeployer !== this.deployerAddress) {
      this.deployerAddress = newDeployer;
      this.fetchDeployerMarks().catch(() => {});
    }
  }


  private async fetchOHLCV(
    resolution: string,
    periodParams: PeriodParams
  ): Promise<Bar[]> {
    const type = formatResolution(resolution);

    const params = new URLSearchParams({
      token: this.tokenAddress,
      type,
      marketCap: String((window as any).marketCapMode === true),
    });

    if (periodParams.lastReqTime) {
      params.set("timeTo", String(periodParams.lastReqTime));
    } else if (periodParams.to) {
      params.set("timeTo", String(periodParams.to));
    }

    const res = await fetch(`/api/chart?${params}`);
    if (!res.ok) return [];

    const json = await res.json();
    const raw: any[] = json?.oclhv ?? json?.ohlcv ?? [];

    return raw
      .filter((d) => d && (d.time ?? d.t) != null)
      .map((d) => ({
        time: (d.time ?? d.t) * 1000,
        open: d.open ?? d.o ?? 0,
        high: d.high ?? d.h ?? 0,
        low: d.low ?? d.l ?? 0,
        close: d.close ?? d.c ?? 0,
        volume: d.volume ?? d.v ?? 0,
      }))
      .sort((a, b) => a.time - b.time);
  }

  private async fetchHoldersChart(
    resolution: string,
    periodParams: PeriodParams
  ): Promise<Bar[]> {
    const resStr = formatResolution(resolution);
    let type = "1d";
    if (resStr.includes("s") || resStr.includes("m") || parseInt(resolution) < 60) {
      type = "1m";
    } else if (parseInt(resolution) < 1440) {
      type = "1h";
    }

    const params = new URLSearchParams({
      token: this.tokenAddress,
      type,
      timeFrom: String(periodParams.from),
      timeTo: String(periodParams.to),
    });

    const res = await fetch(`/api/holders-chart?${params}`);
    if (!res.ok) return [];

    const json = await res.json();
    const holders: { holders: number; time: number }[] = json?.holders ?? [];

    return holders.map((pt) => ({
      time: pt.time * 1000,
      open: pt.holders,
      high: pt.holders,
      low: pt.holders,
      close: pt.holders,
      volume: 0,
    }));
  }


  private parseMigration(pools: PoolInfo[]): Mark[] {
    const launchPlatforms = [
      { market: "pumpfun", migrations: ["pumpfun-amm", "raydium"], label: "Pumpfun" },
      { market: "raydium-launchpad", migrations: ["raydium", "raydium-cpmm"], label: "Launchlab" },
      { market: "meteora-curve", migrations: ["meteora-dyn", "meteora-dyn-v2"], label: "Meteora Curve" },
      { market: "moonshot", migrations: ["meteora-dyn", "meteora-dyn-v2"], label: "Moonshot" },
    ];

    for (const lp of launchPlatforms) {
      const source = pools.find((p) => p.market === lp.market);
      if (!source) continue;

      const migration = lp.migrations
        .map((m) => pools.find((p) => p.market === m))
        .find(Boolean);

      if (migration) {
        return [
          {
            id: "migration-0",
            time: Math.floor((migration.createdAt ?? 0) / 1000),
            color: "orange",
            text: `Migrated from ${lp.label}`,
            label: "M",
            labelFontColor: "white",
            minSize: 25,
          },
        ];
      }
    }

    const heaven = pools.find((p) => p.market === "heaven");
    if (heaven?.heaven?.is_migrated && heaven.heaven.migrationTime) {
      return [
        {
          id: "migration-0",
          time: Math.floor(heaven.heaven.migrationTime / 1000),
          color: "orange",
          text: "Migrated from Heaven",
          label: "M",
          labelFontColor: "white",
          minSize: 25,
        },
      ];
    }

    return [];
  }

  private parseTrades(trades: Trade[], prefix = ""): Mark[] {
    return trades.map((t) => ({
      id: t.tx,
      time: Math.floor(t.time / 1000),
      color: t.type === "sell" ? "red" : "green",
      text: `${prefix}${t.type === "buy" ? "Bought" : "Sold"} $${t.volume.toFixed(2)} USD of ${this.tokenSymbol}`,
      label: t.type === "sell" ? "S" : "B",
      labelFontColor: "white",
      minSize: 25,
    }));
  }

  private async fetchDeployerMarks(): Promise<void> {
    if (!this.deployerAddress) return;
    try {
      const res = await fetch(
        `/api/trades?token=${encodeURIComponent(this.tokenAddress)}&wallet=${encodeURIComponent(this.deployerAddress)}`
      );
      if (!res.ok) return;
      const json = await res.json();
      const trades: any[] = json?.trades ?? json?.data ?? (Array.isArray(json) ? json : []);
      const addr = this.deployerAddress;
      this.deployerMarks = trades.map((t: any) => {
        const isBuy = t.type === "buy";
        const vol = t.volume ?? 0;
        const price = t.priceUsd ?? t.price ?? 0;
        return {
          id: `deployer-${t.tx ?? t.signature}`,
          time: Math.floor((t.time ?? t.timestamp ?? 0) / ((t.time ?? 0) > 1e12 ? 1000 : 1)),
          color: "orange",
          text: `Deployer ${isBuy ? "Buy" : "Sell"} · $${vol.toLocaleString(undefined, { maximumFractionDigits: 2 })}\nPrice: $${price.toFixed(price < 0.01 ? 8 : 4)}\n${addr.slice(0, 4)}…${addr.slice(-4)}`,
          label: "D",
          labelFontColor: "white",
          minSize: 28,
        };
      });
    } catch {
      this.deployerMarks = [];
    }
  }

  private async fetchMarks(
    _symbolInfo: SymbolInfo,
    startDate: number,
    endDate: number,
    onDataCallback: (marks: Mark[]) => void,
    _resolution: string
  ): Promise<void> {
    const migrationMarks = this.tokenDetail?.pools
      ? this.parseMigration(this.tokenDetail.pools)
      : [];

    onDataCallback([
      ...migrationMarks,
      ...this.deployerMarks,
      ...this.walletMarks,
    ]);
  }

  private createRealtimeHandler(
    symbolInfo: SymbolInfo,
    resolution: string,
    onRealtimeCallback: (bar: Bar) => void
  ): (data: Partial<AggregatedPriceUpdate & { volume: number; _mcAdjusted?: boolean }>) => void {
    return (data) => {
      if (!data?.price) return;

      let price: number;
      const isMarketCapMode = (window as any).marketCapMode === true;
      if (isMarketCapMode && this.tokenSupply && !data._mcAdjusted) {
        price = (data.aggregated?.average ?? data.price) * this.tokenSupply;
      } else {
        price = data.aggregated?.average ?? data.price;
      }

      const now = Date.now();
      let latestBar = lastBars.get(symbolInfo.full_name);
      const lastAPI = lastAPIBars.get(symbolInfo.full_name);
      if (!latestBar && !lastAPI) return;

      const currentSec = Math.floor(now / 1000);
      const resSec = getResolutionInSeconds(resolution);
      const barTs = resSec === 0 ? currentSec : Math.floor(currentSec / resSec) * resSec;

      let newBar: Bar;
      if (latestBar && barTs === Math.floor(latestBar.time / 1000)) {
        newBar = {
          ...latestBar,
          high: Math.max(latestBar.high, price),
          low: Math.min(latestBar.low, price),
          close: price,
          volume: latestBar.volume + (data.volume ?? 0),
        };
      } else {
        const openPrice = latestBar?.close ?? lastAPI?.close ?? price;
        newBar = {
          time: barTs * 1000,
          open: openPrice,
          high: price,
          low: price,
          close: price,
          volume: data.volume ?? 0,
        };
      }

      lastBars.set(symbolInfo.full_name, { ...newBar });
      onRealtimeCallback(newBar);
    };
  }

  onReady = (callback: (config: any) => void): void => {
    queueMicrotask(() =>
      callback({
        supports_search: true,
        supports_group_request: false,
        supports_marks: true,
        supports_timescale_marks: true,
        supports_time: true,
        exchanges: [],
        symbols_types: [],
        supported_resolutions: [
          "1S", "5S", "15S",
          "1", "5", "15", "30", "60",
          "120", "180", "240", "360", "720", "1440",
        ],
      })
    );
  };

  searchSymbols = async (
    userInput: string,
    _exchange: string,
    _symbolType: string,
    onResult: (results: any[]) => void
  ): Promise<void> => {
    if (!userInput || userInput.length < 2) {
      onResult([]);
      return;
    }
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(userInput)}&limit=10`);
      if (!res.ok) { onResult([]); return; }
      const json = await res.json();
      const items = json?.data ?? json ?? [];
      onResult(
        items.slice(0, 10).map((item: any) => ({
          symbol: item.symbol ?? item.token?.symbol ?? "",
          full_name: item.mint ?? item.token?.mint ?? "",
          description: item.name ?? item.token?.name ?? "",
          exchange: item.market ?? "Solana",
          ticker: item.mint ?? item.token?.mint ?? "",
          type: "crypto",
        }))
      );
    } catch {
      onResult([]);
    }
  };

  resolveSymbol = async (
    symbolName: string,
    onResolve: (info: SymbolInfo) => void,
    _onError: (err: string) => void
  ): Promise<void> => {
    const isHolders = symbolName.includes("HOLDERS");
    const isMarketCapMode = (window as any).marketCapMode === true;

    const info: SymbolInfo = {
      ticker: isHolders ? "HOLDERS" : this.tokenSymbol,
      name: isHolders ? "HOLDERS" : this.tokenSymbol,
      description: isHolders
        ? "Token Holders Count"
        : isMarketCapMode
          ? `${this.tokenSymbol} Market Cap`
          : this.tokenSymbol,
      type: isHolders ? "index" : "crypto",
      session: "24x7",
      timezone: "Etc/UTC",
      minmov: 1,
      pricescale: isHolders ? 1 : isMarketCapMode ? 1 : 100000000000000,
      has_intraday: true,
      has_seconds: !isHolders,
      seconds_multipliers: isHolders ? [] : [1, 5, 15],
      intraday_multipliers: ["1", "5", "15", "30", "60", "120", "180", "240", "360", "720", "1440"],
      supported_resolutions: isHolders
        ? ["1", "5", "15", "30", "60", "120", "180", "240", "360", "720", "1440"]
        : ["1S", "5S", "15S", "1", "5", "15", "30", "60", "120", "180", "240", "360", "720", "1440"],
      volume_precision: 8,
      data_status: "streaming",
      supports_marks: !isHolders,
      supports_timescale_marks: !isHolders,
      visible_plots_set: isHolders ? "c" : "ohlcv",
      base_name: [isHolders ? "HOLDERS" : this.tokenSymbol],
      legs: [isHolders ? "HOLDERS" : this.tokenSymbol],
      full_name: isHolders ? "HOLDERS" : this.tokenSymbol,
      pro_name: isHolders ? "HOLDERS" : this.tokenSymbol,
      exchange: "",
      listed_exchange: "",
      format: isHolders ? "volume" : isMarketCapMode ? "volume" : "price",
    };

    queueMicrotask(() => onResolve(info));
  };

  getBars = async (
    symbolInfo: SymbolInfo,
    resolution: string,
    periodParams: PeriodParams,
    onHistoryCallback: (bars: Bar[], meta: { noData: boolean }) => void,
    _onError: (err: string) => void
  ): Promise<void> => {
    if (!this.isActive) {
      onHistoryCallback([], { noData: true });
      return;
    }

    const { firstDataRequest } = periodParams;
    const isHolders = symbolInfo.name === "HOLDERS";

    try {
      let bars: Bar[];

      if (isHolders) {
        bars = await this.fetchHoldersChart(resolution, periodParams);
      } else if (firstDataRequest && this.prefetchPromise) {
        bars = await this.prefetchPromise;
        this.prefetchPromise = null;
      } else {
        bars = await this.fetchOHLCV(resolution, periodParams);
      }

      if (bars.length === 0) {
        onHistoryCallback([], { noData: true });
        return;
      }

      if (!firstDataRequest && !isHolders) {
        const fromMs = periodParams.from * 1000;
        bars = bars.filter((b) => b.time >= fromMs);
        if (bars.length === 0) {
          onHistoryCallback([], { noData: true });
          return;
        }
      }

      if (firstDataRequest && bars.length > 0 && !isHolders) {
        const last = bars[bars.length - 1];
        lastBars.set(symbolInfo.full_name, { ...last });
        lastAPIBars.set(symbolInfo.full_name, { ...last });
      }

      onHistoryCallback(bars, { noData: false });
    } catch (err) {
      console.error("[getBars]", err);
      onHistoryCallback([], { noData: true });
    }
  };

  subscribeBars = async (
    symbolInfo: SymbolInfo,
    resolution: string,
    onRealtimeCallback: (bar: Bar) => void,
    _subscriberUID: string,
    _onResetCacheNeeded: () => void
  ): Promise<void> => {
    if (!this.isActive) return;

    this.realtimeHandler = this.createRealtimeHandler(
      symbolInfo,
      resolution,
      onRealtimeCallback
    );

    const ds = this.getDatastream?.();
    if (!ds) return;

    try {
      const priceRef = ds.subscribe.price
        .aggregated(this.tokenAddress)
        .on((priceData: AggregatedPriceUpdate) => {
          if (this.isActive && this.realtimeHandler) {
            this.realtimeHandler({
              price: priceData.price,
              aggregated: priceData.aggregated,
              volume: 0,
            });
          }
        });
      this.priceUnsub = priceRef.unsubscribe;

      const volRef = ds.subscribe.volume
        .token(this.tokenAddress)
        .on((volData: VolumeTokenUpdate) => {
          if (this.isActive && this.realtimeHandler) {
            const latest = lastBars.get(symbolInfo.full_name);
            if (latest) {
              this.realtimeHandler({
                price: latest.close,
                aggregated: { average: latest.close } as any,
                volume: volData.volume ?? 0,
                _mcAdjusted: true,
              });
            }
          }
        });
      this.volumeUnsub = volRef.unsubscribe;

      const txRef = ds.subscribe.tx
        .token(this.tokenAddress)
        .on((tx: TokenTransaction) => {
          if (!this.isActive) return;

          if (this.watchedWallet && tx.wallet === this.watchedWallet) {
            const isBuy = tx.type === "buy";
            const walletMark: Mark = {
              id: `wallet-live-${tx.tx}`,
              time: Math.floor(tx.time / 1000),
              color: isBuy ? "green" : "red",
              text: `${isBuy ? "Buy" : "Sell"} · $${tx.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })}\nPrice: $${tx.priceUsd.toFixed(tx.priceUsd < 0.01 ? 8 : 4)}\n${tx.wallet.slice(0, 4)}…${tx.wallet.slice(-4)}`,
              label: isBuy ? "B" : "S",
              labelFontColor: "white",
              minSize: 30,
            };
            this.walletMarks.push(walletMark);
          }

          if (this.deployerAddress && tx.wallet === this.deployerAddress) {
            const isBuy = tx.type === "buy";
            this.deployerMarks.push({
              id: `deployer-live-${tx.tx}`,
              time: Math.floor(tx.time / 1000),
              color: "orange",
              text: `Deployer ${isBuy ? "Buy" : "Sell"} · $${tx.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })}\nPrice: $${tx.priceUsd.toFixed(tx.priceUsd < 0.01 ? 8 : 4)}\n${tx.wallet.slice(0, 4)}…${tx.wallet.slice(-4)}`,
              label: "D",
              labelFontColor: "white",
              minSize: 28,
            });
          }

          this.onTransaction?.(tx);
        });
      this.txUnsub = txRef.unsubscribe;
    } catch (err) {
      console.error("[subscribeBars] real-time setup error:", err);
    }
  };

  unsubscribeBars = (_subscriberUID: string): void => {
    this.priceUnsub?.();
    this.priceUnsub = null;
    this.volumeUnsub?.();
    this.volumeUnsub = null;
    this.txUnsub?.();
    this.txUnsub = null;
    this.realtimeHandler = null;
  };

  getMarks = (
    symbolInfo: SymbolInfo,
    startDate: number,
    endDate: number,
    onDataCallback: (marks: Mark[]) => void,
    resolution: string
  ): void => {
    this.fetchMarks(symbolInfo, startDate, endDate, onDataCallback, resolution);
  };


  destroy() {
    this.isActive = false;
    this.priceUnsub?.();
    this.volumeUnsub?.();
    this.txUnsub?.();
    if (this.markInterval) clearInterval(this.markInterval);
    this.realtimeHandler = null;
  }
}
