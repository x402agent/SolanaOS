import { NextRequest, NextResponse } from "next/server";

const BIRDEYE_API_KEY =
  process.env.BIRDEYE_API_KEY || "20fb63431de241eeb986748fe0755004";

const BIRDEYE_BASE = "https://public-api.birdeye.so";

const HEADERS: Record<string, string> = {
  "X-API-KEY": BIRDEYE_API_KEY,
  accept: "application/json",
  "x-chain": "solana",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/* ------------------------------------------------------------------ */
/*  In-memory cache to avoid Birdeye 429 rate limits                   */
/* ------------------------------------------------------------------ */

const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 60_000; // 60 seconds

async function cachedFetch(url: string): Promise<{ data: unknown; status: number }> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return { data: cached.data, status: 200 };
  }

  const res = await fetch(url, { headers: HEADERS });
  const body = await res.json();

  if (res.ok) {
    cache.set(url, { data: body, ts: now });
  }

  return { data: body, status: res.status };
}

/* ------------------------------------------------------------------ */
/*  Watchlist tokens                                                    */
/* ------------------------------------------------------------------ */

const WATCHLIST =
  "So11111111111111111111111111111111111111112," +
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN," +
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263," +
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm," +
  "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr";

/* ------------------------------------------------------------------ */
/*  Route                                                               */
/* ------------------------------------------------------------------ */

export const revalidate = 60;

export async function OPTIONS() {
  return NextResponse.json(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");
  const address = searchParams.get("address");

  let url: string;

  switch (type) {
    /* ---- Price & OHLCV ---- */
    case "prices":
      url = `${BIRDEYE_BASE}/defi/multi_price?list_address=${WATCHLIST}`;
      break;

    case "price":
      if (!address) return missing("address");
      url = `${BIRDEYE_BASE}/defi/price?address=${address}`;
      break;

    case "history_price":
      if (!address) return missing("address");
      url = `${BIRDEYE_BASE}/defi/history_price?address=${address}&address_type=token&type=1H&time_from=${h24ago()}&time_to=${now()}`;
      break;

    case "ohlcv":
      if (!address) return missing("address");
      url = `${BIRDEYE_BASE}/defi/v3/ohlcv?address=${address}&type=1H&time_from=${h24ago()}&time_to=${now()}`;
      break;

    /* ---- Stats & Overview ---- */
    case "overview":
      if (!address) return missing("address");
      url = `${BIRDEYE_BASE}/defi/token_overview?address=${address}`;
      break;

    case "security":
      if (!address) return missing("address");
      url = `${BIRDEYE_BASE}/defi/token_security?address=${address}`;
      break;

    /* ---- Lists & Discovery ---- */
    case "trending":
      url = `${BIRDEYE_BASE}/defi/token_trending?sort_by=rank&sort_type=asc&offset=0&limit=20`;
      break;

    case "new_listings":
      url = `${BIRDEYE_BASE}/defi/v3/token/new_listing?limit=10`;
      break;

    case "meme_list":
      url = `${BIRDEYE_BASE}/defi/v3/token/meme/list?limit=20&offset=0&sort_by=marketcap&sort_type=desc`;
      break;

    case "smart_money":
      url = `${BIRDEYE_BASE}/smart-money/v1/token/list?limit=20`;
      break;

    /* ---- Transactions ---- */
    case "token_txs":
      if (!address) return missing("address");
      url = `${BIRDEYE_BASE}/defi/v3/token/txs?address=${address}&limit=20&sort_type=desc`;
      break;

    /* ---- Holder ---- */
    case "holder_distribution":
      if (!address) return missing("address");
      url = `${BIRDEYE_BASE}/holder/v1/distribution?address=${address}`;
      break;

    /* ---- Wallet ---- */
    case "wallet_networth": {
      const wallet = searchParams.get("wallet");
      if (!wallet) return missing("wallet");
      url = `${BIRDEYE_BASE}/wallet/v2/current-net-worth?wallet=${wallet}`;
      break;
    }

    case "wallet_pnl": {
      const wallet = searchParams.get("wallet");
      if (!wallet) return missing("wallet");
      url = `${BIRDEYE_BASE}/wallet/v2/pnl/summary?wallet=${wallet}`;
      break;
    }

    /* ---- Search ---- */
    case "search": {
      const q = searchParams.get("q");
      if (!q) return missing("q");
      url = `${BIRDEYE_BASE}/defi/v3/search?keyword=${encodeURIComponent(q)}&limit=10`;
      break;
    }

    /* ---- Networks ---- */
    case "networks":
      url = `${BIRDEYE_BASE}/defi/networks`;
      break;

    default:
      return NextResponse.json(
        {
          error: "Invalid type. Use: prices, price, history_price, ohlcv, overview, security, trending, new_listings, meme_list, smart_money, token_txs, holder_distribution, wallet_networth, wallet_pnl, search, networks",
        },
        { status: 400, headers: CORS_HEADERS },
      );
  }

  try {
    const { data, status } = await cachedFetch(url);
    return NextResponse.json(data, {
      status,
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch from Birdeye API" },
      { status: 502, headers: CORS_HEADERS },
    );
  }
}

/* ---- Helpers ---- */

function missing(param: string) {
  return NextResponse.json(
    { error: `Missing ${param} parameter` },
    { status: 400, headers: CORS_HEADERS },
  );
}

function now() {
  return Math.floor(Date.now() / 1000);
}

function h24ago() {
  return now() - 86400;
}
