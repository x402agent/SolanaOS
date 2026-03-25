export interface ClientInfo {
  id: string;
  displayName?: string;
  version: string;
  platform: string;
  mode: string;
  instanceId?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
}

export type GatewayClientName =
  | "control-ui"
  | "cli"
  | "extension"
  | "api"
  | "android"
  | "seeker";
export type GatewayClientMode = "webchat" | "embedded" | "headless" | "ui" | "node";

export const GATEWAY_CLIENT_NAMES = {
  CONTROL_UI: "control-ui" as GatewayClientName,
  CLI: "cli" as GatewayClientName,
  EXTENSION: "extension" as GatewayClientName,
  API: "api" as GatewayClientName,
  ANDROID: "android" as GatewayClientName,
  SEEKER: "seeker" as GatewayClientName,
} as const;

export const GATEWAY_CLIENT_MODES = {
  WEBCHAT: "webchat" as GatewayClientMode,
  EMBEDDED: "embedded" as GatewayClientMode,
  HEADLESS: "headless" as GatewayClientMode,
  UI: "ui" as GatewayClientMode,
  NODE: "node" as GatewayClientMode,
} as const;

export function parseClientInfo(raw: unknown): ClientInfo {
  const record = isRecord(raw) ? raw : {};
  return {
    id: asString(record.id) ?? asString(record.name) ?? "solanaos-ui",
    displayName: asString(record.displayName),
    version: asString(record.version) ?? "0.0.0",
    platform: asString(record.platform) ?? "unknown",
    mode: asString(record.mode) ?? GATEWAY_CLIENT_MODES.WEBCHAT,
    instanceId: asString(record.instanceId),
    deviceFamily: asString(record.deviceFamily),
    modelIdentifier: asString(record.modelIdentifier),
  };
}

export function buildClientInfo(partial: Partial<ClientInfo> & Pick<ClientInfo, "id" | "version" | "platform" | "mode">): ClientInfo {
  return parseClientInfo(partial);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || undefined;
}
