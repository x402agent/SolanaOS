import { NextResponse } from "next/server";

import { listOfficeVersions, publishOfficeVersion } from "@/lib/office/store";

export const runtime = "nodejs";

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const workspaceId = asString(body.workspaceId) || "default";
    const officeId = asString(body.officeId);
    const officeVersionId = asString(body.officeVersionId);
    const publishedBy = asString(body.publishedBy) || "studio";
    if (!workspaceId || !officeId) {
      return NextResponse.json({ error: "workspaceId and officeId are required." }, { status: 400 });
    }
    let selectedVersionId = officeVersionId;
    if (!selectedVersionId) {
      const versions = listOfficeVersions(workspaceId, officeId);
      selectedVersionId = versions[0]?.id ?? "";
    }
    if (!selectedVersionId) {
      return NextResponse.json({ error: "No office version available to publish." }, { status: 400 });
    }
    const published = publishOfficeVersion({
      workspaceId,
      officeId,
      officeVersionId: selectedVersionId,
      publishedBy,
    });
    return NextResponse.json({ published });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to publish office version.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
