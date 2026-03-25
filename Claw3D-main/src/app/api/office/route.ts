import { NextResponse } from "next/server";

import { createEmptyOfficeMap, normalizeOfficeMap, type OfficeMap } from "@/lib/office/schema";
import {
  getPublishedOffice,
  getPublishedOfficeMap,
  listOfficesForWorkspace,
  listOfficeVersions,
  saveOfficeVersion,
  upsertOffice,
} from "@/lib/office/store";

export const runtime = "nodejs";

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const workspaceId = asString(url.searchParams.get("workspaceId")) || "default";
    const officeId = asString(url.searchParams.get("officeId"));
    const offices = listOfficesForWorkspace(workspaceId);
    const published = getPublishedOffice(workspaceId);
    const publishedMap = getPublishedOfficeMap(workspaceId);
    const versions = officeId ? listOfficeVersions(workspaceId, officeId) : [];
    return NextResponse.json({
      workspaceId,
      offices,
      versions,
      published,
      publishedMap,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load office data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = asString(body.action);
    if (action === "upsertOffice") {
      const workspaceId = asString(body.workspaceId) || "default";
      const officeId = asString(body.officeId);
      const name = asString(body.name);
      if (!officeId || !name) {
        return NextResponse.json({ error: "officeId and name are required." }, { status: 400 });
      }
      const office = upsertOffice({
        workspaceId,
        officeId,
        name,
      });
      return NextResponse.json({ office });
    }
    if (action === "saveVersion") {
      const workspaceId = asString(body.workspaceId) || "default";
      const officeId = asString(body.officeId);
      const versionId = asString(body.versionId);
      const createdBy = asString(body.createdBy) || "studio";
      if (!officeId || !versionId) {
        return NextResponse.json({ error: "officeId and versionId are required." }, { status: 400 });
      }
      const incomingMap = body.map as OfficeMap | undefined;
      const fallback = createEmptyOfficeMap({
        workspaceId,
        officeVersionId: versionId,
        width: 1600,
        height: 900,
      });
      const map = normalizeOfficeMap(incomingMap, fallback);
      const record = saveOfficeVersion({
        workspaceId,
        officeId,
        versionId,
        createdBy,
        notes: asString(body.notes),
        map,
      });
      return NextResponse.json({ version: record });
    }
    return NextResponse.json({ error: "Unsupported office action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save office data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
