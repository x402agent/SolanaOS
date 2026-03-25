<div align="center">

# Solana TradingView Chart Example

**Tradingview Advanced Chart example with Marks, Holders Chart, Market Cap support — powered by [Solana Tracker](https://www.solanatracker.io).**

[![npm](https://img.shields.io/npm/v/@solana-tracker/data-api?label=%40solana-tracker%2Fdata-api&color=00C896)](https://www.npmjs.com/package/@solana-tracker/data-api)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Get an API Key](https://www.solanatracker.io) · [SDK Docs](https://www.npmjs.com/package/@solana-tracker/data-api) · [Solana Tracker](https://www.solanatracker.io/data-api)

</div>

---

![Screenshot](https://i.imgur.com/KhAWTk6.png)

## What This Is

A complete, open-source reference implementation showing how to build a **professional-grade trading platform chart** using the [**@solana-tracker/data-api**](https://www.npmjs.com/package/@solana-tracker/data-api) SDK and [TradingView Advanced Charts](https://www.tradingview.com/HTML5-stock-forex-bitcoin-charting-library/).

Everything here — candle data, live trades, holder counts, migrations — comes from a single SDK. Plug in your API key and go.

---

## Features

### Advanced TradingView Chart
- **OHLCV candlestick data** from 1-second to 1-day resolution
- **Price / Market Cap toggle** — switch chart mode on the fly
- **Outlier removal** and **dynamic pool selection** for clean data
- **Dark/light theme** with full color customization
- **Chart layout persistence** — drawings, indicators, and zoom level saved to localStorage

### Live Trades & Wallet Tracking
- **Real-time trade feed** — new buys and sells stream in as they happen via WebSocket
- **Interactive trades table** with time, type, price, amount, volume, market cap, and wallet
- **Click any wallet** to filter its trades and see buy/sell marks directly on the chart
- **Deployer tracking** — automatically marks the token deployer's transactions

### Chart Marks
- **Wallet trade marks** — green (buy) and red (sell) flags on the chart for any tracked wallet
- **Migration marks** — orange "M" flags when a token migrates across platforms (Raydium, Meteora, Pump.fun, Moonshot, etc.)
- **Deployer marks** — orange "D" flags highlighting the deployer's activity

### Holders Chart
- **Historical holder count** displayed as a TradingView overlay indicator
- **Live holder updates** streamed via WebSocket
- Rendered as a dedicated study on the same chart

### Real-Time Streaming
- **Aggregated price** — median/average across all pools, updated in real-time
- **Volume per token** — live trade volume and transaction count
- **Live transactions** — every buy and sell with wallet, amount, and price
- All powered by the Solana Tracker Datastream WebSocket

### Token Search
- **Instant search** — find any Solana token by name, symbol, or mint address
- Autocomplete with token images and verification badges
- Keyboard shortcut: `⌘K` / `Ctrl+K`

---

## Quick Start

```bash
git clone https://github.com/solanatracker/solana-tradingview-advanced-chart-example.git
cd solana-tradingview-advanced-chart-example
npm install
```

Create `.env.local`:

```
SOLANA_TRACKER_API_KEY=your_api_key_here
NEXT_PUBLIC_WS_URL=wss://datastream.solanatracker.io?api-key=your_api_key_here
```

> Get your API key at [www.solanatracker.io](https://www.solanatracker.io)

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000) — enter any token mint address to load its chart.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SOLANA_TRACKER_API_KEY` | Yes | API key from [www.solanatracker.io](https://www.solanatracker.io) |
| `NEXT_PUBLIC_WS_URL` | No | WebSocket URL for real-time streaming |

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── chart/          # OHLCV candle data
│   │   ├── holders-chart/  # Historical holder counts
│   │   ├── token/          # Token metadata & pool info
│   │   ├── trades/         # Wallet trade history
│   │   └── search/         # Token search
│   └── page.tsx            # Main UI — search, chart, trades table
├── components/
│   ├── TradingView/
│   │   └── TVChartContainer.tsx  # Chart widget, holders overlay, marks
│   └── TradesTable.tsx           # Live trades table with wallet filtering
└── lib/
    ├── sdk.ts              # Server-side SDK singleton
    ├── datastream.ts       # Client-side WebSocket singleton
    ├── datafeed.ts         # TradingView DataFeed implementation
    └── saveLoadAdapter.ts  # Chart layout persistence
```

**Design principles:**

- **API key stays server-side** — all SDK calls proxy through Next.js API routes; your key never reaches the browser.
- **Datastream key stays server side using next-ws ** — WebSocket connections run in the browser for zero-latency updates. 

---

## SDK Usage

All data in this example comes from the [`@solana-tracker/data-api`](https://www.npmjs.com/package/@solana-tracker/data-api) SDK.

### REST API

```typescript
import { Client } from "@solana-tracker/data-api";

const client = new Client({ apiKey: "YOUR_KEY" });

// OHLCV candle data
const chart = await client.getChartData({
  tokenAddress: "So11111111111111111111111111111111111111112",
  type: "1m",               // 1s, 5s, 15s, 1m, 5m, 15m, 1h, 4h, 1d
  marketCap: false,
  removeOutliers: true,
  dynamicPools: true,
});

// Holders chart
const holders = await client.getHoldersChart(tokenAddress, "1m");

// Token info (metadata, deployer, pools)
const token = await client.getTokenInfo(tokenAddress);

// Wallet trades
const trades = await client.getUserTokenTrades(tokenAddress, walletAddress);

// Search
const results = await client.searchTokens({ query: "SOL", limit: 10 });
```

### Real-Time Streaming

```typescript
import { Datastream } from "@solana-tracker/data-api";

const datastream = new Datastream({ wsUrl: "wss://..." });
await datastream.connect();

// Live aggregated price
datastream.subscribe.price.aggregated(tokenAddress).on((data) => {
  console.log(data.price, data.aggregated.average);
});

// Live volume
datastream.subscribe.volume.token(tokenAddress).on((data) => {
  console.log(data.volume, data.txCount);
});

// Live holder count
datastream.subscribe.holders(tokenAddress).on((data) => {
  console.log(data.total);
});
```

---

## Tech Stack

| | |
|---|---|
| **Framework** | Next.js (App Router) |
| **Language** | TypeScript |
| **Charting** | TradingView Advanced Charts |
| **Data** | Solana Tracker Data API + Datastream |
| **Styling** | Tailwind CSS |

---

## TradingView Library

This project requires the [TradingView Charting Library](https://www.tradingview.com/HTML5-stock-forex-bitcoin-charting-library/) placed in `public/static/charting_library/`. The library is not included — obtain it separately from TradingView.

---

## About Solana Tracker

[**Solana Tracker**](https://www.solanatracker.io) provides real-time Solana token data — prices, charts, trades, holders, and more — through a single, fast API. The [`@solana-tracker/data-api`](https://www.npmjs.com/package/@solana-tracker/data-api) SDK wraps both the REST API and WebSocket Datastream into one typed package.

**[Get your API key →](https://www.solanatracker.io)**

---

## License

MIT
