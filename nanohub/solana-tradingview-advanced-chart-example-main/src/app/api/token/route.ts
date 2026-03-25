import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/sdk";

export async function GET(req: NextRequest) {
  const addr = req.nextUrl.searchParams.get("address");
  if (!addr) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  try {
    const client = getClient();
    const data = await client.getTokenInfo(addr);
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("[api/token]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
