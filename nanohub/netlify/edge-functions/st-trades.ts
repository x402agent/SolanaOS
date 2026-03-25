const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const apiKey = Deno.env.get("SOLANA_TRACKER_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), {
      status: 503,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const wallet = url.searchParams.get("wallet");

  if (!token) {
    return new Response(JSON.stringify({ error: "Missing token parameter" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    let upstream: string;
    if (wallet) {
      upstream = `https://data.solanatracker.io/trades/${encodeURIComponent(token)}/${encodeURIComponent(wallet)}?parseJupiter=true`;
    } else {
      upstream = `https://data.solanatracker.io/trades/${encodeURIComponent(token)}?parseJupiter=true`;
    }
    const resp = await fetch(upstream, {
      headers: { "x-api-key": apiKey },
    });
    const data = await resp.json();
    return new Response(JSON.stringify(data), {
      status: resp.status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Upstream request failed", detail: String(err) }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
};

export const config = { path: "/st/trades" };
