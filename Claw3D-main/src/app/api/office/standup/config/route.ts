import { NextResponse } from "next/server";

import {
  applyStudioSettingsPatch,
  loadStudioSettings,
} from "@/lib/studio/settings-store";
import {
  resolveStandupPreference,
  sanitizeStandupPreference,
  type StudioStandupPreferencePatch,
} from "@/lib/studio/settings";
import { validateJiraBaseUrl } from "@/lib/security/urlSafety";

export const runtime = "nodejs";

const readGatewayUrl = (request: Request) => {
  const url = new URL(request.url);
  return (url.searchParams.get("gatewayUrl") ?? "").trim();
};

export async function GET(request: Request) {
  try {
    const gatewayUrl = readGatewayUrl(request);
    if (!gatewayUrl) {
      return NextResponse.json(
        { error: "gatewayUrl is required." },
        { status: 400 }
      );
    }
    const settings = loadStudioSettings();
    const config = resolveStandupPreference(settings, gatewayUrl);
    return NextResponse.json({ gatewayUrl, config: sanitizeStandupPreference(config) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load standup config.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      gatewayUrl?: string;
      config?: StudioStandupPreferencePatch;
    };
    const gatewayUrl = typeof body.gatewayUrl === "string" ? body.gatewayUrl.trim() : "";
    if (!gatewayUrl) {
      return NextResponse.json(
        { error: "gatewayUrl is required." },
        { status: 400 }
      );
    }
    if (!body.config || typeof body.config !== "object") {
      return NextResponse.json({ error: "config is required." }, { status: 400 });
    }
    if (body.config.jira?.baseUrl?.trim()) {
      validateJiraBaseUrl(body.config.jira.baseUrl);
    }
    const settings = applyStudioSettingsPatch({
      standup: {
        [gatewayUrl]: body.config,
      },
    });
    return NextResponse.json({
      gatewayUrl,
      config: sanitizeStandupPreference(resolveStandupPreference(settings, gatewayUrl)),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save standup config.";
    const status =
      message.includes("gatewayUrl is required") ||
      message.includes("config is required") ||
      message.includes("Jira base URL")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
