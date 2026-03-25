import { NextResponse } from "next/server";

import { buildStandupMeeting } from "@/lib/office/standup/service";
import { saveStandupMeeting } from "@/lib/office/standup/store";
import type { StandupAgentSnapshot, StandupTriggerKind } from "@/lib/office/standup/types";
import {
  applyStudioSettingsPatch,
  loadStudioSettings,
} from "@/lib/studio/settings-store";
import { resolveStandupPreference } from "@/lib/studio/settings";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      gatewayUrl?: string;
      agents?: StandupAgentSnapshot[];
      trigger?: StandupTriggerKind;
      scheduledFor?: string | null;
    };
    const gatewayUrl =
      typeof body.gatewayUrl === "string" ? body.gatewayUrl.trim() : "";
    if (!gatewayUrl) {
      return NextResponse.json(
        { error: "gatewayUrl is required." },
        { status: 400 }
      );
    }
    const settings = loadStudioSettings();
    const config = resolveStandupPreference(settings, gatewayUrl);
    const trigger = body.trigger === "scheduled" ? "scheduled" : "manual";
    const meeting = await buildStandupMeeting({
      config,
      agents: Array.isArray(body.agents) ? body.agents : [],
      trigger,
      scheduledFor:
        typeof body.scheduledFor === "string" ? body.scheduledFor : null,
    });
    saveStandupMeeting(meeting);
    if (trigger === "scheduled") {
      applyStudioSettingsPatch({
        standup: {
          [gatewayUrl]: {
            schedule: {
              lastAutoRunAt: new Date().toISOString(),
            },
          },
        },
      });
    }
    return NextResponse.json(
      { meeting },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start standup meeting.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
