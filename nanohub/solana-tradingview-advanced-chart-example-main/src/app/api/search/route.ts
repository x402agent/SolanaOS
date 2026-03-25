import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/sdk";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query") ?? "";
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 10);

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const client = getClient();
    const results = await client.searchTokens({ query, limit });
    return NextResponse.json(results);
  } catch (err: unknown) {
    console.error("[api/search]", err);
    return NextResponse.json([]);
  }
}
