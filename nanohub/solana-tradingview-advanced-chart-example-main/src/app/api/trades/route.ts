import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/sdk";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const token = searchParams.get("token");
  const wallet = searchParams.get("wallet");

  if (!token) {
    return NextResponse.json({ error: "Missing token param" }, { status: 400 });
  }

  try {
    const client = getClient();

    let data;
    if (wallet) {
      data = await client.getUserTokenTrades(token, wallet, undefined, true);
    } else {
      data = await client.getTokenTrades(token, undefined, true);
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("[api/trades]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
