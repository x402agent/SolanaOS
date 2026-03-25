import { OfficeBuilderPanel } from "@/features/office/components/OfficeBuilderPanel";
import { createStarterOfficeMap, normalizeOfficeMap } from "@/lib/office/schema";
import { getPublishedOfficeMap } from "@/lib/office/store";

const WORKSPACE_ID = "default";
const OFFICE_ID = "hq";

export default function OfficeBuilderPage() {
  const fallback = createStarterOfficeMap({
    workspaceId: WORKSPACE_ID,
    officeVersionId: "builder-draft",
    width: 1600,
    height: 900,
  });
  const map = normalizeOfficeMap(getPublishedOfficeMap(WORKSPACE_ID), fallback);
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-background p-3">
      <OfficeBuilderPanel initialMap={map} workspaceId={WORKSPACE_ID} officeId={OFFICE_ID} />
    </main>
  );
}
