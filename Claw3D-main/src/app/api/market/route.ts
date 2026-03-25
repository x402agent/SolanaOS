import { NextRequest, NextResponse } from "next/server";

const BIRDEYE_API_KEY =
  process.env.BIRDEYE_API_KEY || "20fb63431de241eeb986748fe0755004";

const BIRDEYE_BASE = "https://public-api.birdeye.so";

const HEADERS = {
  "X-API-KEY": BIRDEYE_API_KEY,
  accept: "application/json",
  "x-chain": "solana",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Revalidate cached responses every 30 seconds
export const revalidate = 30;

export async function OPTIONS() {
  return NextResponse.json(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type");
  const address = searchParams.get("address");

  let url: string;

  switch (type) {
    case "trending":
      url = `${BIRDEYE_BASE}/defi/token_trending?sort_by=rank&sort_type=asc&offset=0&limit=20`;
      break;

    case "prices":
      url = `${BIRDEYE_BASE}/defi/multi_price?list_address=So11111111111111111111111111111111111111112,JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN,DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263,EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm,7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr`;
      break;

    case "overview": {
      if (!address) {
        return NextResponse.json(
          { error: "Missing address parameter" },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      url = `${BIRDEYE_BASE}/defi/token_overview?address=${address}`;
      break;
    }

    case "ohlcv": {
      if (!address) {
        return NextResponse.json(
          { error: "Missing address parameter" },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const now = Math.floor(Date.now() / 1000);
      const dayAgo = now - 86400;
      url = `${BIRDEYE_BASE}/defi/ohlcv?address=${address}&type=1H&time_from=${dayAgo}&time_to=${now}`;
      break;
    }

    case "new_listings":
      url = `${BIRDEYE_BASE}/defi/v3/token/new_listing?limit=10`;
      break;

    default:
      return NextResponse.json(
        {
          error: "Invalid type parameter. Use: trending, prices, overview, ohlcv, new_listings",
        },
        { status: 400, headers: CORS_HEADERS }
      );
  }

  try {
    const response = await fetch(url, { headers: HEADERS });
    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch from Birdeye API" },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}
