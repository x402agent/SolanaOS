import {
  buildDeviceAuthPayloadV3,
  type GatewayRole,
} from "../shared/device-auth";

export interface DeviceAuthPayload {
  deviceId: string;
  clientId?: string;
  clientMode?: string;
  role?: GatewayRole;
  scopes?: string[];
  signedAt?: number;
  token?: string;
  nonce?: string;
  platform?: string;
  deviceFamily?: string;
  publicKey?: string;
  signature?: string;
  payload?: string;
}

export function buildDeviceAuthPayload(params: DeviceAuthPayload): DeviceAuthPayload {
  const payload =
    params.payload ??
    (params.clientId && params.clientMode && params.role && params.nonce && typeof params.signedAt === "number"
      ? buildDeviceAuthPayloadV3({
          deviceId: params.deviceId,
          clientId: params.clientId,
          clientMode: params.clientMode,
          role: params.role,
          scopes: params.scopes ?? [],
          signedAtMs: params.signedAt,
          token: params.token,
          nonce: params.nonce,
          platform: params.platform,
          deviceFamily: params.deviceFamily,
        })
      : undefined);

  return {
    deviceId: params.deviceId.trim(),
    clientId: normalizeOptionalString(params.clientId),
    clientMode: normalizeOptionalString(params.clientMode),
    role: params.role,
    scopes: (params.scopes ?? []).map((scope) => scope.trim()).filter(Boolean),
    signedAt: typeof params.signedAt === "number" ? Math.trunc(params.signedAt) : undefined,
    token: normalizeOptionalString(params.token),
    nonce: normalizeOptionalString(params.nonce),
    platform: normalizeOptionalString(params.platform),
    deviceFamily: normalizeOptionalString(params.deviceFamily),
    publicKey: normalizeOptionalString(params.publicKey),
    signature: normalizeOptionalString(params.signature),
    payload,
  };
}

export function validateDeviceAuth(payload: unknown): DeviceAuthPayload | null {
  if (!isRecord(payload)) return null;
  const deviceId = normalizeOptionalString(payload.deviceId);
  if (!deviceId) return null;

  const normalized = buildDeviceAuthPayload({
    deviceId,
    clientId: normalizeOptionalString(payload.clientId),
    clientMode: normalizeOptionalString(payload.clientMode),
    role: normalizeOptionalString(payload.role) as GatewayRole | undefined,
    scopes: Array.isArray(payload.scopes) ? payload.scopes.filter((item): item is string => typeof item === "string") : undefined,
    signedAt: typeof payload.signedAt === "number" && Number.isFinite(payload.signedAt) ? payload.signedAt : undefined,
    token: normalizeOptionalString(payload.token),
    nonce: normalizeOptionalString(payload.nonce),
    platform: normalizeOptionalString(payload.platform),
    deviceFamily: normalizeOptionalString(payload.deviceFamily),
    publicKey: normalizeOptionalString(payload.publicKey),
    signature: normalizeOptionalString(payload.signature),
    payload: normalizeOptionalString(payload.payload),
  });

  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || undefined;
}
