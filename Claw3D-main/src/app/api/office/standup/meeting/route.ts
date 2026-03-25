import { NextResponse } from "next/server";

import {
  advanceStandupMeeting,
  startStandupSpeaker,
  updateStandupArrivals,
} from "@/lib/office/standup/service";
import {
  loadActiveStandupMeeting,
  updateStandupMeeting,
} from "@/lib/office/standup/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(
      { meeting: loadActiveStandupMeeting() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load standup meeting.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "arrivals" | "start" | "advance" | "complete";
      arrivedAgentIds?: string[];
      speakerAgentId?: string | null;
    };
    const action = typeof body.action === "string" ? body.action : "";
    if (!action) {
      return NextResponse.json({ error: "action is required." }, { status: 400 });
    }
    const store = updateStandupMeeting((meeting) => {
      if (!meeting) return null;
      if (action === "arrivals") {
        return updateStandupArrivals(meeting, body.arrivedAgentIds ?? []);
      }
      if (action === "start") {
        const speakerAgentId =
          typeof body.speakerAgentId === "string" ? body.speakerAgentId.trim() : null;
        return startStandupSpeaker(meeting, speakerAgentId);
      }
      if (action === "advance") {
        return advanceStandupMeeting(meeting);
      }
      if (action === "complete") {
        return startStandupSpeaker(meeting, null);
      }
      return meeting;
    });
    return NextResponse.json(
      { meeting: store.activeMeeting },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update standup meeting.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
