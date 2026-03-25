export const DEVICE_AUTH_PAYLOAD_VERSION = "v3";

export type GatewayRole = "operator" | "node" | (string & {});

export interface GatewayClientIdentity {
  id: string;
  displayName?: string;
  version: string;
  platform: string;
  mode: string;
  instanceId?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
}

export interface SignedDeviceDescriptor {
  id: string;
  publicKey: string;
  signature: string;
  signedAt: number;
  nonce: string;
}

export interface GatewayConnectCredentials {
  token?: string;
  password?: string;
}

export interface DeviceAuthPayloadV3Fields {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: GatewayRole;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce: string;
  platform?: string | null;
  deviceFamily?: string | null;
}

export interface GatewayConnectDescriptor {
  minProtocol?: number;
  maxProtocol?: number;
  role: GatewayRole;
  scopes: string[];
  caps?: string[];
  commands?: string[];
  permissions?: Record<string, boolean>;
  client: GatewayClientIdentity;
  auth?: GatewayConnectCredentials;
  device?: SignedDeviceDescriptor;
  locale?: string;
  userAgent?: string;
}

export function normalizeDeviceAuthMetadataField(value: string | null | undefined): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/[A-Z]/g, (char) => char.toLowerCase());
}

export function buildDeviceAuthPayloadV3(fields: DeviceAuthPayloadV3Fields): string {
  return [
    DEVICE_AUTH_PAYLOAD_VERSION,
    fields.deviceId.trim(),
    fields.clientId.trim(),
    fields.clientMode.trim(),
    String(fields.role).trim(),
    fields.scopes.map((scope) => scope.trim()).filter(Boolean).join(","),
    String(Math.trunc(fields.signedAtMs)),
    String(fields.token ?? "").trim(),
    fields.nonce.trim(),
    normalizeDeviceAuthMetadataField(fields.platform),
    normalizeDeviceAuthMetadataField(fields.deviceFamily),
  ].join("|");
}

export function buildDeviceAuthStoreKey(deviceId: string, role: string): string {
  const normalizedDevice = deviceId.trim().toLowerCase();
  const normalizedRole = role.trim().toLowerCase();
  return `gateway.deviceToken.${normalizedDevice}.${normalizedRole}`;
}
