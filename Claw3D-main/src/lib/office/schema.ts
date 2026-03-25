export type OfficeLayerId =
  | "floor"
  | "walls"
  | "furniture"
  | "decor"
  | "lighting"
  | "agents";

export type OfficeZoneType =
  | "desk_zone"
  | "meeting_room"
  | "lounge"
  | "game_room"
  | "hallway"
  | "coffee_area";

export type OfficeAgentState = "idle" | "working" | "meeting" | "error";

export type OfficeLightPreset =
  | "ceiling_lamp"
  | "desk_monitor"
  | "tv_glow"
  | "meeting_spotlight"
  | "emergency_error";

export type OfficeLightAnimationPreset =
  | "steady"
  | "soft_flicker"
  | "breathing_pulse"
  | "error_strobe_subtle";

export type OfficeAmbiencePreset =
  | "coffee_steam"
  | "window_dust"
  | "game_sparkle"
  | "plant_pollen";

export type OfficeInteractionKind =
  | "couch_sit"
  | "arcade_stand"
  | "tv_watch"
  | "desk_seat"
  | "window_stand";

export type OfficeVector = {
  x: number;
  y: number;
};

export type OfficePolygon = {
  points: OfficeVector[];
};

export type OfficeLayer = {
  id: OfficeLayerId;
  visible: boolean;
  locked: boolean;
  opacity: number;
  parallax: number;
};

export type OfficeMapObject = {
  id: string;
  assetId: string;
  layerId: OfficeLayerId;
  x: number;
  y: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  zIndex: number;
  tags: string[];
};

export type OfficeLightBinding = {
  agentId?: string;
  zoneId?: string;
  deskObjectId?: string;
  state?: OfficeAgentState;
};

export type OfficeFlickerProfile = {
  speed: number;
  amplitude: number;
};

export type OfficeLightObject = {
  id: string;
  preset: OfficeLightPreset;
  animationPreset: OfficeLightAnimationPreset;
  x: number;
  y: number;
  radius: number;
  baseIntensity: number;
  spriteAssetId?: string;
  flicker?: OfficeFlickerProfile;
  binding?: OfficeLightBinding;
  roomId?: string;
  enabled: boolean;
};

export type OfficeAmbienceEmitter = {
  id: string;
  preset: OfficeAmbiencePreset;
  zoneId: string;
  maxParticles: number;
  spawnRate: number;
  enabled: boolean;
};

export type OfficeInteractionPoint = {
  id: string;
  kind: OfficeInteractionKind;
  x: number;
  y: number;
  zoneId?: string;
  facingDegrees?: number;
  tags: string[];
};

export type OfficeZone = {
  id: string;
  type: OfficeZoneType;
  name: string;
  shape: OfficePolygon;
  capacity?: number;
  interactionPointIds?: string[];
  ambienceTags?: string[];
};

export type OfficeCollision = {
  id: string;
  shape: OfficePolygon;
  blocked: boolean;
};

export type OfficeSpawnPoint = {
  id: string;
  x: number;
  y: number;
};

export type OfficeDeskAssignment = {
  deskObjectId: string;
  seatAnchor: OfficeVector;
  facingDegrees: number;
};

export type OfficeTheme = {
  mood: "neutral" | "focus" | "cozy" | "night";
  enableThoughtBubbles: boolean;
};

export type OfficeLightingOverlay = {
  enabled: boolean;
  baseDarkness: number;
  roomDarkness: Record<string, number>;
};

export type OfficeCanvas = {
  width: number;
  height: number;
  tileSize: number;
  backgroundColor: string;
};

export type OfficeMap = {
  mapVersion: number;
  workspaceId: string;
  officeVersionId: string;
  canvas: OfficeCanvas;
  layers: OfficeLayer[];
  objects: OfficeMapObject[];
  zones: OfficeZone[];
  collisions: OfficeCollision[];
  spawnPoints: OfficeSpawnPoint[];
  deskAssignments: Record<string, OfficeDeskAssignment>;
  lightingOverlay?: OfficeLightingOverlay;
  lights?: OfficeLightObject[];
  ambienceEmitters?: OfficeAmbienceEmitter[];
  interactionPoints?: OfficeInteractionPoint[];
  theme?: OfficeTheme;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const asBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === "boolean" ? value : fallback;

const normalizeLayerId = (value: unknown): OfficeLayerId => {
  const normalized = asString(value);
  if (
    normalized === "floor" ||
    normalized === "walls" ||
    normalized === "furniture" ||
    normalized === "decor" ||
    normalized === "lighting" ||
    normalized === "agents"
  ) {
    return normalized;
  }
  return "decor";
};

const normalizeZoneType = (value: unknown): OfficeZoneType => {
  const normalized = asString(value);
  if (
    normalized === "desk_zone" ||
    normalized === "meeting_room" ||
    normalized === "lounge" ||
    normalized === "game_room" ||
    normalized === "hallway" ||
    normalized === "coffee_area"
  ) {
    return normalized;
  }
  return "hallway";
};

const normalizeLightPreset = (value: unknown): OfficeLightPreset => {
  const normalized = asString(value);
  if (
    normalized === "ceiling_lamp" ||
    normalized === "desk_monitor" ||
    normalized === "tv_glow" ||
    normalized === "meeting_spotlight" ||
    normalized === "emergency_error"
  ) {
    return normalized;
  }
  return "ceiling_lamp";
};

const normalizeLightAnimationPreset = (
  value: unknown,
): OfficeLightAnimationPreset => {
  const normalized = asString(value);
  if (
    normalized === "steady" ||
    normalized === "soft_flicker" ||
    normalized === "breathing_pulse" ||
    normalized === "error_strobe_subtle"
  ) {
    return normalized;
  }
  return "steady";
};

const normalizeAmbiencePreset = (value: unknown): OfficeAmbiencePreset => {
  const normalized = asString(value);
  if (
    normalized === "coffee_steam" ||
    normalized === "window_dust" ||
    normalized === "game_sparkle" ||
    normalized === "plant_pollen"
  ) {
    return normalized;
  }
  return "window_dust";
};

const normalizeInteractionKind = (value: unknown): OfficeInteractionKind => {
  const normalized = asString(value);
  if (
    normalized === "couch_sit" ||
    normalized === "arcade_stand" ||
    normalized === "tv_watch" ||
    normalized === "desk_seat" ||
    normalized === "window_stand"
  ) {
    return normalized;
  }
  return "window_stand";
};

const normalizeVector = (value: unknown): OfficeVector => {
  if (!isRecord(value)) {
    return { x: 0, y: 0 };
  }
  return {
    x: asNumber(value.x, 0),
    y: asNumber(value.y, 0),
  };
};

const normalizePolygon = (value: unknown): OfficePolygon => {
  if (!isRecord(value)) {
    return { points: [] };
  }
  const points = Array.isArray(value.points)
    ? value.points.map(normalizeVector)
    : [];
  return { points };
};

const defaultLayers = (): OfficeLayer[] => [
  { id: "floor", visible: true, locked: false, opacity: 1, parallax: 1 },
  { id: "walls", visible: true, locked: false, opacity: 1, parallax: 1 },
  { id: "furniture", visible: true, locked: false, opacity: 1, parallax: 1 },
  { id: "decor", visible: true, locked: false, opacity: 1, parallax: 1 },
  { id: "lighting", visible: true, locked: false, opacity: 1, parallax: 1 },
  { id: "agents", visible: true, locked: true, opacity: 1, parallax: 1 },
];

export const createEmptyOfficeMap = (params: {
  workspaceId: string;
  officeVersionId: string;
  width: number;
  height: number;
}): OfficeMap => ({
  mapVersion: 2,
  workspaceId: params.workspaceId,
  officeVersionId: params.officeVersionId,
  canvas: {
    width: params.width,
    height: params.height,
    tileSize: 32,
    backgroundColor: "#101820",
  },
  layers: defaultLayers(),
  objects: [],
  zones: [],
  collisions: [],
  spawnPoints: [{ id: "spawn-main", x: 120, y: 120 }],
  deskAssignments: {},
  lightingOverlay: {
    enabled: true,
    baseDarkness: 0.2,
    roomDarkness: {},
  },
  lights: [],
  ambienceEmitters: [],
  interactionPoints: [],
  theme: {
    mood: "neutral",
    enableThoughtBubbles: true,
  },
});

export const createStarterOfficeMap = (params: {
  workspaceId: string;
  officeVersionId: string;
  width: number;
  height: number;
}): OfficeMap => {
  const base = createEmptyOfficeMap(params);
  const hallwayZone: OfficeZone = {
    id: "zone_hallway",
    type: "hallway",
    name: "Hallway",
    shape: {
      points: [
        { x: 80, y: 120 },
        { x: 1500, y: 120 },
        { x: 1500, y: 230 },
        { x: 80, y: 230 },
      ],
    },
  };
  const deskZone: OfficeZone = {
    id: "zone_desks",
    type: "desk_zone",
    name: "Desk Area",
    shape: {
      points: [
        { x: 120, y: 270 },
        { x: 980, y: 270 },
        { x: 980, y: 780 },
        { x: 120, y: 780 },
      ],
    },
  };
  const meetingZone: OfficeZone = {
    id: "zone_meeting",
    type: "meeting_room",
    name: "Meeting Room",
    shape: {
      points: [
        { x: 1030, y: 270 },
        { x: 1480, y: 270 },
        { x: 1480, y: 540 },
        { x: 1030, y: 540 },
      ],
    },
  };
  const loungeZone: OfficeZone = {
    id: "zone_lounge",
    type: "lounge",
    name: "Lounge",
    shape: {
      points: [
        { x: 1030, y: 560 },
        { x: 1480, y: 560 },
        { x: 1480, y: 780 },
        { x: 1030, y: 780 },
      ],
    },
  };
  const coffeeZone: OfficeZone = {
    id: "zone_coffee",
    type: "coffee_area",
    name: "Coffee",
    shape: {
      points: [
        { x: 80, y: 20 },
        { x: 330, y: 20 },
        { x: 330, y: 110 },
        { x: 80, y: 110 },
      ],
    },
  };
  const gameZone: OfficeZone = {
    id: "zone_game",
    type: "game_room",
    name: "Game Room",
    shape: {
      points: [
        { x: 1340, y: 20 },
        { x: 1540, y: 20 },
        { x: 1540, y: 110 },
        { x: 1340, y: 110 },
      ],
    },
  };

  return {
    ...base,
    objects: [
      {
        id: "floor_a",
        assetId: "floor_tile",
        layerId: "floor",
        x: 420,
        y: 350,
        rotation: 0,
        flipX: false,
        flipY: false,
        zIndex: 10,
        tags: [],
      },
      {
        id: "desk_a",
        assetId: "desk_modern",
        layerId: "furniture",
        x: 260,
        y: 350,
        rotation: 0,
        flipX: false,
        flipY: false,
        zIndex: 200,
        tags: ["desk"],
      },
      {
        id: "desk_b",
        assetId: "desk_modern",
        layerId: "furniture",
        x: 480,
        y: 350,
        rotation: 0,
        flipX: false,
        flipY: false,
        zIndex: 201,
        tags: ["desk"],
      },
      {
        id: "desk_c",
        assetId: "desk_modern",
        layerId: "furniture",
        x: 700,
        y: 350,
        rotation: 0,
        flipX: false,
        flipY: false,
        zIndex: 202,
        tags: ["desk"],
      },
      {
        id: "meeting_table",
        assetId: "meeting_table",
        layerId: "furniture",
        x: 1240,
        y: 390,
        rotation: 0,
        flipX: false,
        flipY: false,
        zIndex: 240,
        tags: ["meeting"],
      },
      {
        id: "tv_lounge",
        assetId: "tv_wall",
        layerId: "decor",
        x: 1260,
        y: 610,
        rotation: 0,
        flipX: false,
        flipY: false,
        zIndex: 260,
        tags: ["tv"],
      },
      {
        id: "arcade_a",
        assetId: "arcade_machine",
        layerId: "decor",
        x: 1440,
        y: 70,
        rotation: 0,
        flipX: false,
        flipY: false,
        zIndex: 261,
        tags: ["arcade"],
      },
      {
        id: "coffee_bar",
        assetId: "coffee_station",
        layerId: "decor",
        x: 210,
        y: 70,
        rotation: 0,
        flipX: false,
        flipY: false,
        zIndex: 262,
        tags: ["coffee"],
      },
    ],
    zones: [
      hallwayZone,
      deskZone,
      meetingZone,
      loungeZone,
      coffeeZone,
      gameZone,
    ],
    lights: [
      {
        id: "light_ceiling_desks",
        preset: "ceiling_lamp",
        animationPreset: "soft_flicker",
        x: 520,
        y: 220,
        radius: 240,
        baseIntensity: 0.42,
        enabled: true,
      },
      {
        id: "light_meeting",
        preset: "meeting_spotlight",
        animationPreset: "breathing_pulse",
        x: 1240,
        y: 320,
        radius: 180,
        baseIntensity: 0.38,
        enabled: true,
        roomId: "zone_meeting",
      },
      {
        id: "light_tv",
        preset: "tv_glow",
        animationPreset: "steady",
        x: 1260,
        y: 610,
        radius: 130,
        baseIntensity: 0.3,
        enabled: true,
        binding: { zoneId: "zone_lounge", state: "idle" },
      },
      {
        id: "light_error_demo",
        preset: "emergency_error",
        animationPreset: "error_strobe_subtle",
        x: 260,
        y: 320,
        radius: 90,
        baseIntensity: 0.22,
        enabled: true,
        binding: { state: "error" },
      },
    ],
    ambienceEmitters: [
      {
        id: "emit_coffee",
        preset: "coffee_steam",
        zoneId: "zone_coffee",
        maxParticles: 16,
        spawnRate: 0.16,
        enabled: true,
      },
      {
        id: "emit_window",
        preset: "window_dust",
        zoneId: "zone_hallway",
        maxParticles: 14,
        spawnRate: 0.08,
        enabled: true,
      },
      {
        id: "emit_game",
        preset: "game_sparkle",
        zoneId: "zone_game",
        maxParticles: 12,
        spawnRate: 0.12,
        enabled: true,
      },
    ],
    interactionPoints: [
      {
        id: "point_tv_watch",
        kind: "tv_watch",
        x: 1190,
        y: 650,
        zoneId: "zone_lounge",
        tags: [],
      },
      {
        id: "point_arcade_stand",
        kind: "arcade_stand",
        x: 1390,
        y: 90,
        zoneId: "zone_game",
        tags: [],
      },
      {
        id: "point_coffee",
        kind: "window_stand",
        x: 200,
        y: 100,
        zoneId: "zone_coffee",
        tags: [],
      },
    ],
    deskAssignments: {
      main: {
        deskObjectId: "desk_a",
        seatAnchor: { x: 260, y: 375 },
        facingDegrees: 180,
      },
    },
  };
};

const normalizeDeskAssignments = (
  value: unknown,
): Record<string, OfficeDeskAssignment> => {
  if (!isRecord(value)) return {};
  const next: Record<string, OfficeDeskAssignment> = {};
  for (const [agentId, raw] of Object.entries(value)) {
    if (!isRecord(raw)) continue;
    const deskObjectId = asString(raw.deskObjectId).trim();
    if (!deskObjectId) continue;
    next[agentId] = {
      deskObjectId,
      seatAnchor: normalizeVector(raw.seatAnchor),
      facingDegrees: asNumber(raw.facingDegrees, 180),
    };
  }
  return next;
};

export const normalizeOfficeMap = (
  value: unknown,
  fallback: OfficeMap,
): OfficeMap => {
  if (!isRecord(value)) return fallback;

  const mapVersion = asNumber(value.mapVersion, fallback.mapVersion);
  const workspaceId =
    asString(value.workspaceId, fallback.workspaceId).trim() ||
    fallback.workspaceId;
  const officeVersionId =
    asString(value.officeVersionId, fallback.officeVersionId).trim() ||
    fallback.officeVersionId;
  const canvasRecord = isRecord(value.canvas) ? value.canvas : {};
  const canvas: OfficeCanvas = {
    width: asNumber(canvasRecord.width, fallback.canvas.width),
    height: asNumber(canvasRecord.height, fallback.canvas.height),
    tileSize: asNumber(canvasRecord.tileSize, fallback.canvas.tileSize),
    backgroundColor: asString(
      canvasRecord.backgroundColor,
      fallback.canvas.backgroundColor,
    ),
  };

  const layersRaw = Array.isArray(value.layers) ? value.layers : [];
  const layers: OfficeLayer[] =
    layersRaw.length === 0
      ? fallback.layers
      : layersRaw.map((entry) => {
          const raw = isRecord(entry) ? entry : {};
          return {
            id: normalizeLayerId(raw.id),
            visible: asBoolean(raw.visible, true),
            locked: asBoolean(raw.locked, false),
            opacity: asNumber(raw.opacity, 1),
            parallax: asNumber(raw.parallax, 1),
          };
        });

  const objectsRaw = Array.isArray(value.objects) ? value.objects : [];
  const objects: OfficeMapObject[] = objectsRaw
    .map((entry): OfficeMapObject | null => {
      if (!isRecord(entry)) return null;
      const id = asString(entry.id).trim();
      const assetId = asString(entry.assetId).trim();
      if (!id || !assetId) return null;
      return {
        id,
        assetId,
        layerId: normalizeLayerId(entry.layerId),
        x: asNumber(entry.x, 0),
        y: asNumber(entry.y, 0),
        rotation: asNumber(entry.rotation, 0),
        flipX: asBoolean(entry.flipX, false),
        flipY: asBoolean(entry.flipY, false),
        zIndex: asNumber(entry.zIndex, 0),
        tags: Array.isArray(entry.tags)
          ? entry.tags.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
      };
    })
    .filter((entry): entry is OfficeMapObject => Boolean(entry));

  const zonesRaw = Array.isArray(value.zones) ? value.zones : [];
  const zones: OfficeZone[] = zonesRaw
    .map((entry): OfficeZone | null => {
      if (!isRecord(entry)) return null;
      const id = asString(entry.id).trim();
      const name = asString(entry.name).trim();
      if (!id || !name) return null;
      return {
        id,
        name,
        type: normalizeZoneType(entry.type),
        shape: normalizePolygon(entry.shape),
        capacity:
          typeof entry.capacity === "number" ? entry.capacity : undefined,
        interactionPointIds: Array.isArray(entry.interactionPointIds)
          ? entry.interactionPointIds.filter(
              (item): item is string => typeof item === "string",
            )
          : undefined,
        ambienceTags: Array.isArray(entry.ambienceTags)
          ? entry.ambienceTags.filter(
              (item): item is string => typeof item === "string",
            )
          : undefined,
      };
    })
    .filter((entry): entry is OfficeZone => Boolean(entry));

  const collisionsRaw = Array.isArray(value.collisions) ? value.collisions : [];
  const collisions: OfficeCollision[] = collisionsRaw
    .map((entry): OfficeCollision | null => {
      if (!isRecord(entry)) return null;
      const id = asString(entry.id).trim();
      if (!id) return null;
      return {
        id,
        shape: normalizePolygon(entry.shape),
        blocked: asBoolean(entry.blocked, true),
      };
    })
    .filter((entry): entry is OfficeCollision => Boolean(entry));

  const spawnRaw = Array.isArray(value.spawnPoints) ? value.spawnPoints : [];
  const spawnPoints: OfficeSpawnPoint[] = spawnRaw
    .map((entry): OfficeSpawnPoint | null => {
      if (!isRecord(entry)) return null;
      const id = asString(entry.id).trim();
      if (!id) return null;
      return {
        id,
        x: asNumber(entry.x, 0),
        y: asNumber(entry.y, 0),
      };
    })
    .filter((entry): entry is OfficeSpawnPoint => Boolean(entry));

  const overlayRaw = isRecord(value.lightingOverlay)
    ? value.lightingOverlay
    : {};
  const roomDarknessRaw = isRecord(overlayRaw.roomDarkness)
    ? overlayRaw.roomDarkness
    : {};
  const roomDarkness: Record<string, number> = {};
  for (const [key, raw] of Object.entries(roomDarknessRaw)) {
    roomDarkness[key] = asNumber(raw, 0.2);
  }
  const lightingOverlay: OfficeLightingOverlay = {
    enabled: asBoolean(
      overlayRaw.enabled,
      fallback.lightingOverlay?.enabled ?? true,
    ),
    baseDarkness: asNumber(
      overlayRaw.baseDarkness,
      fallback.lightingOverlay?.baseDarkness ?? 0.2,
    ),
    roomDarkness,
  };

  const lightsRaw = Array.isArray(value.lights) ? value.lights : [];
  const lights: OfficeLightObject[] = lightsRaw
    .map((entry): OfficeLightObject | null => {
      if (!isRecord(entry)) return null;
      const id = asString(entry.id).trim();
      if (!id) return null;
      const flickerRaw = isRecord(entry.flicker) ? entry.flicker : null;
      const bindingRaw = isRecord(entry.binding) ? entry.binding : null;
      return {
        id,
        preset: normalizeLightPreset(entry.preset),
        animationPreset: normalizeLightAnimationPreset(entry.animationPreset),
        x: asNumber(entry.x, 0),
        y: asNumber(entry.y, 0),
        radius: asNumber(entry.radius, 120),
        baseIntensity: asNumber(entry.baseIntensity, 0.5),
        spriteAssetId: asString(entry.spriteAssetId).trim() || undefined,
        flicker: flickerRaw
          ? {
              speed: asNumber(flickerRaw.speed, 0.8),
              amplitude: asNumber(flickerRaw.amplitude, 0.12),
            }
          : undefined,
        binding: bindingRaw
          ? {
              agentId: asString(bindingRaw.agentId).trim() || undefined,
              zoneId: asString(bindingRaw.zoneId).trim() || undefined,
              deskObjectId:
                asString(bindingRaw.deskObjectId).trim() || undefined,
              state: (() => {
                const state = asString(bindingRaw.state).trim();
                if (
                  state === "idle" ||
                  state === "working" ||
                  state === "meeting" ||
                  state === "error"
                ) {
                  return state;
                }
                return undefined;
              })(),
            }
          : undefined,
        roomId: asString(entry.roomId).trim() || undefined,
        enabled: asBoolean(entry.enabled, true),
      };
    })
    .filter((entry): entry is OfficeLightObject => Boolean(entry));

  const ambienceRaw = Array.isArray(value.ambienceEmitters)
    ? value.ambienceEmitters
    : [];
  const ambienceEmitters: OfficeAmbienceEmitter[] = ambienceRaw
    .map((entry): OfficeAmbienceEmitter | null => {
      if (!isRecord(entry)) return null;
      const id = asString(entry.id).trim();
      const zoneId = asString(entry.zoneId).trim();
      if (!id || !zoneId) return null;
      return {
        id,
        preset: normalizeAmbiencePreset(entry.preset),
        zoneId,
        maxParticles: asNumber(entry.maxParticles, 18),
        spawnRate: asNumber(entry.spawnRate, 0.2),
        enabled: asBoolean(entry.enabled, true),
      };
    })
    .filter((entry): entry is OfficeAmbienceEmitter => Boolean(entry));

  const interactionRaw = Array.isArray(value.interactionPoints)
    ? value.interactionPoints
    : [];
  const interactionPoints: OfficeInteractionPoint[] = interactionRaw
    .map((entry): OfficeInteractionPoint | null => {
      if (!isRecord(entry)) return null;
      const id = asString(entry.id).trim();
      if (!id) return null;
      return {
        id,
        kind: normalizeInteractionKind(entry.kind),
        x: asNumber(entry.x, 0),
        y: asNumber(entry.y, 0),
        zoneId: asString(entry.zoneId).trim() || undefined,
        facingDegrees:
          typeof entry.facingDegrees === "number"
            ? asNumber(entry.facingDegrees, 0)
            : undefined,
        tags: Array.isArray(entry.tags)
          ? entry.tags.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
      };
    })
    .filter((entry): entry is OfficeInteractionPoint => Boolean(entry));

  const themeRaw = isRecord(value.theme) ? value.theme : {};
  const mood = asString(themeRaw.mood, fallback.theme?.mood ?? "neutral");
  const theme: OfficeTheme = {
    mood:
      mood === "focus" || mood === "cozy" || mood === "night"
        ? mood
        : "neutral",
    enableThoughtBubbles: asBoolean(
      themeRaw.enableThoughtBubbles,
      fallback.theme?.enableThoughtBubbles ?? true,
    ),
  };

  return {
    mapVersion,
    workspaceId,
    officeVersionId,
    canvas,
    layers,
    objects,
    zones,
    collisions,
    spawnPoints,
    deskAssignments: normalizeDeskAssignments(value.deskAssignments),
    lightingOverlay,
    lights,
    ambienceEmitters,
    interactionPoints,
    theme,
  };
};
