"use client";

import { useMemo, useState } from "react";

import { OfficePhaserCanvas } from "@/features/office/components/OfficePhaserCanvas";
import { useOfficeBuilderStore } from "@/features/office/state/useOfficeBuilderStore";
import type { OfficeMap } from "@/lib/office/schema";

type OfficeBuilderPanelProps = {
  initialMap: OfficeMap;
  workspaceId: string;
  officeId: string;
};

const nextId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;

export function OfficeBuilderPanel({ initialMap, workspaceId, officeId }: OfficeBuilderPanelProps) {
  const store = useOfficeBuilderStore(initialMap);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string>("");
  const [showDebug, setShowDebug] = useState(true);
  const [lightingEnabled, setLightingEnabled] = useState(true);
  const [ambienceEnabled, setAmbienceEnabled] = useState(true);
  const [thoughtEnabled, setThoughtEnabled] = useState(true);

  const saveVersion = async () => {
    const versionId = `v${Date.now()}`;
    const response = await fetch("/api/office", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "saveVersion",
        workspaceId,
        officeId,
        versionId,
        createdBy: "studio",
        notes: "builder save",
        map: store.map,
      }),
    });
    if (!response.ok) {
      setMessage("save failed");
      return;
    }
    setMessage(`saved ${versionId}`);
  };

  const publishLatest = async () => {
    const response = await fetch("/api/office/publish", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        officeId,
        publishedBy: "studio",
      }),
    });
    if (!response.ok) {
      setMessage("publish failed");
      return;
    }
    setMessage("published");
  };

  const debug = useMemo(
    () => ({
      showZones: showDebug,
      showAnchors: showDebug,
      showEmitterBounds: showDebug,
      showLightBounds: showDebug,
      showMetrics: true,
    }),
    [showDebug]
  );

  return (
    <div className="flex h-full w-full gap-3">
      <aside className="ui-panel w-72 shrink-0 overflow-y-auto p-3">
        <div className="font-mono text-[11px] text-muted-foreground">builder controls</div>
        <div className="mt-3 flex flex-col gap-2">
          <button type="button" className="ui-btn-secondary px-2 py-1 text-left text-xs" onClick={store.undo}>
            undo
          </button>
          <button type="button" className="ui-btn-secondary px-2 py-1 text-left text-xs" onClick={store.redo}>
            redo
          </button>
          <button
            type="button"
            className="ui-btn-secondary px-2 py-1 text-left text-xs"
            onClick={() => store.rotateSelected(90)}
          >
            rotate selected
          </button>
          <button
            type="button"
            className="ui-btn-secondary px-2 py-1 text-left text-xs"
            onClick={() => store.flipSelected("x")}
          >
            flip selected x
          </button>
          <button
            type="button"
            className="ui-btn-secondary px-2 py-1 text-left text-xs"
            onClick={() => store.flipSelected("y")}
          >
            flip selected y
          </button>
          <button
            type="button"
            className="ui-btn-secondary px-2 py-1 text-left text-xs"
            onClick={() =>
              store.addLight({
                id: nextId("light"),
                preset: "ceiling_lamp",
                animationPreset: "soft_flicker",
                x: 220,
                y: 180,
                radius: 120,
                baseIntensity: 0.45,
                enabled: true,
              })
            }
          >
            add light
          </button>
          <button
            type="button"
            className="ui-btn-secondary px-2 py-1 text-left text-xs"
            onClick={() =>
              store.addEmitter({
                id: nextId("emitter"),
                preset: "coffee_steam",
                zoneId: store.map.zones[0]?.id ?? "",
                enabled: true,
                maxParticles: 12,
                spawnRate: 0.15,
              })
            }
          >
            add emitter
          </button>
          <button
            type="button"
            className="ui-btn-secondary px-2 py-1 text-left text-xs"
            onClick={() =>
              store.addInteractionPoint({
                id: nextId("interaction"),
                kind: "tv_watch",
                x: 260,
                y: 220,
                tags: [],
              })
            }
          >
            add interaction point
          </button>
          <button type="button" className="ui-btn-primary px-2 py-1 text-left text-xs" onClick={saveVersion}>
            save version
          </button>
          <button type="button" className="ui-btn-primary px-2 py-1 text-left text-xs" onClick={publishLatest}>
            publish active
          </button>
        </div>
        <div className="mt-4 border-t border-border/50 pt-3">
          <div className="font-mono text-[11px] text-muted-foreground">simulation toggles</div>
          <div className="mt-2 flex flex-col gap-2 text-xs">
            <label className="flex items-center justify-between">
              <span>debug</span>
              <input type="checkbox" checked={showDebug} onChange={(event) => setShowDebug(event.target.checked)} />
            </label>
            <label className="flex items-center justify-between">
              <span>lighting</span>
              <input
                type="checkbox"
                checked={lightingEnabled}
                onChange={(event) => setLightingEnabled(event.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between">
              <span>ambience</span>
              <input
                type="checkbox"
                checked={ambienceEnabled}
                onChange={(event) => setAmbienceEnabled(event.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between">
              <span>thought bubbles</span>
              <input
                type="checkbox"
                checked={thoughtEnabled}
                onChange={(event) => setThoughtEnabled(event.target.checked)}
              />
            </label>
          </div>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">selected {selectedIds.length}</div>
        {message ? <div className="mt-2 text-xs text-muted-foreground">{message}</div> : null}
      </aside>
      <div className="ui-panel min-h-0 flex-1 overflow-hidden p-2">
        <OfficePhaserCanvas
          mode="builder"
          map={store.map}
          presence={[]}
          debug={debug}
          runtime={{
            enableLighting: lightingEnabled,
            enableAmbience: ambienceEnabled,
            enableThoughtBubbles: thoughtEnabled,
          }}
          onObjectMoved={(id, x, y) => {
            store.moveObject(id, x, y);
          }}
          onSelectionChange={(ids) => {
            store.select(ids);
            setSelectedIds(ids);
          }}
        />
      </div>
    </div>
  );
}
