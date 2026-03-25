import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/sdk";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token param" }, { status: 400 });
  }

  const type = searchParams.get("type") ?? "1m";
  const timeFrom = searchParams.get("timeFrom")
    ? Number(searchParams.get("timeFrom"))
    : undefined;
  const timeTo = searchParams.get("timeTo")
    ? Number(searchParams.get("timeTo"))
    : undefined;

  try {
    const client = getClient();
    const data = await client.getHoldersChart(token, type, timeFrom, timeTo);
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("[api/holders-chart]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
