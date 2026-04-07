export const CONTROL_UI_BOOTSTRAP_CONFIG_PATH = "/__solanaos/control-ui-config.json";

export const SOLANAOS_CONNECT_BUNDLE_VERSION = 1;
export const SOLANAOS_DEFAULT_CONTROL_API_URL = "http://127.0.0.1:7777";
export const SOLANAOS_DEFAULT_WEB_URL = "http://127.0.0.1:18800";
export const SOLANAOS_DEFAULT_GATEWAY_URL = "http://127.0.0.1:18790";

export interface ControlUiBootstrapConfig {
  basePath: string;
  assistantName: string;
  assistantAvatar: string;
  assistantAgentId: string;
}

export type GatewayAuthMode = "token" | "password" | "";

export interface GatewaySetupCodePayload {
  url: string;
  token?: string;
  password?: string;
}

export interface SolanaOSConnectBundle {
  version: number;
  product: string;
  generatedAt?: string;
  workspace?: string;
  installDir?: string;
  cliBinary?: string;
  compatBinary?: string;
  control: {
    apiUrl: string;
  };
  web: {
    url: string;
  };
  gateway: {
    url: string;
    authMode?: GatewayAuthMode | string;
    secret?: string;
  };
  android?: {
    setupCode?: string;
  };
  extension?: {
    apiUrl?: string;
    setupCode?: string;
    secret?: string;
  };
  macos?: {
    gatewayUrl?: string;
    secret?: string;
  };
}

export interface ResolvedConnectImport {
  apiUrl: string | null;
  gatewayUrl: string;
  authMode: GatewayAuthMode;
  secret: string;
  setupCode: string | null;
  source: "bundle" | "setup-code";
}

const LOCAL_URL_PREFIX = /^(https?|wss?):\/\//i;

export function normalizeControlApiUrl(
  raw: string | null | undefined,
  fallback: string = SOLANAOS_DEFAULT_CONTROL_API_URL,
): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/\/+$/, "");
}

export function normalizeGatewayUrl(
  raw: string | null | undefined,
  fallback: string = SOLANAOS_DEFAULT_GATEWAY_URL,
): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return fallback;
  const value = LOCAL_URL_PREFIX.test(trimmed) ? trimmed : `https://${trimmed}`;
  return value.replace(/\/+$/, "");
}

export function deriveGatewayWebSocketUrl(
  raw: string | null | undefined,
  fallback: string = SOLANAOS_DEFAULT_GATEWAY_URL,
): string {
  const httpUrl = normalizeGatewayUrl(raw, fallback);
  if (httpUrl.startsWith("https://")) return `wss://${httpUrl.slice("https://".length)}`;
  if (httpUrl.startsWith("http://")) return `ws://${httpUrl.slice("http://".length)}`;
  return httpUrl;
}

export function encodeGatewaySetupCode(payload: GatewaySetupCodePayload): string {
  const encoded = toBase64Url(JSON.stringify(compactObject(payload)));
  return encoded;
}

export function decodeGatewaySetupCode(rawInput: string | null | undefined): GatewaySetupCodePayload | null {
  const candidate = resolveSetupCodeCandidate(rawInput);
  if (!candidate) return null;
  try {
    const decoded = fromBase64Url(candidate);
    const parsed = JSON.parse(decoded);
    if (!isRecord(parsed)) return null;
    const url = asNonEmptyString(parsed.url);
    if (!url) return null;
    const token = asNonEmptyString(parsed.token);
    const password = asNonEmptyString(parsed.password);
    return compactObject({ url, token, password });
  } catch {
    return null;
  }
}

export function parseSolanaOSConnectBundle(raw: unknown): SolanaOSConnectBundle | null {
  if (!isRecord(raw)) return null;
  const control = isRecord(raw.control) ? raw.control : null;
  const web = isRecord(raw.web) ? raw.web : null;
  const gateway = isRecord(raw.gateway) ? raw.gateway : null;
  if (!control || !web || !gateway) return null;

  const apiUrl = asNonEmptyString(control.apiUrl);
  const webUrl = asNonEmptyString(web.url);
  const gatewayUrl = asNonEmptyString(gateway.url);
  if (!apiUrl || !webUrl || !gatewayUrl) return null;

  return {
    version: asFiniteNumber(raw.version) ?? SOLANAOS_CONNECT_BUNDLE_VERSION,
    product: asNonEmptyString(raw.product) ?? "SolanaOS",
    generatedAt: asNonEmptyString(raw.generatedAt),
    workspace: asNonEmptyString(raw.workspace),
    installDir: asNonEmptyString(raw.installDir),
    cliBinary: asNonEmptyString(raw.cliBinary),
    compatBinary: asNonEmptyString(raw.compatBinary),
    control: { apiUrl: normalizeControlApiUrl(apiUrl) },
    web: { url: normalizeControlApiUrl(webUrl, SOLANAOS_DEFAULT_WEB_URL) },
    gateway: {
      url: normalizeGatewayUrl(gatewayUrl),
      authMode: normalizeGatewayAuthMode(gateway.authMode),
      secret: asNonEmptyString(gateway.secret),
    },
    android: isRecord(raw.android)
      ? {
          setupCode: asNonEmptyString(raw.android.setupCode),
        }
      : undefined,
    extension: isRecord(raw.extension)
      ? {
          apiUrl: asNonEmptyString(raw.extension.apiUrl),
          setupCode: asNonEmptyString(raw.extension.setupCode),
          secret: asNonEmptyString(raw.extension.secret),
        }
      : undefined,
    macos: isRecord(raw.macos)
      ? {
          gatewayUrl: asNonEmptyString(raw.macos.gatewayUrl),
          secret: asNonEmptyString(raw.macos.secret),
        }
      : undefined,
  };
}

export function decodeConnectImport(rawInput: string | null | undefined): ResolvedConnectImport | null {
  const trimmed = String(rawInput ?? "").trim();
  if (!trimmed) return null;

  const parsedJson = tryParseJson(trimmed);
  const parsedBundle = parsedJson ? parseSolanaOSConnectBundle(parsedJson) : null;
  if (parsedBundle) {
    const embeddedSetup =
      parsedBundle.android?.setupCode ??
      parsedBundle.extension?.setupCode ??
      null;
    return {
      apiUrl: parsedBundle.extension?.apiUrl
        ? normalizeControlApiUrl(parsedBundle.extension.apiUrl)
        : normalizeControlApiUrl(parsedBundle.control.apiUrl),
      gatewayUrl: normalizeGatewayUrl(parsedBundle.gateway.url),
      authMode: normalizeGatewayAuthMode(parsedBundle.gateway.authMode),
      secret: String(parsedBundle.extension?.secret ?? parsedBundle.gateway.secret ?? "").trim(),
      setupCode: embeddedSetup,
      source: "bundle",
    };
  }

  const embeddedSetupCode =
    parsedJson && isRecord(parsedJson)
      ? asNonEmptyString(parsedJson.setupCode)
      : null;
  const setup = decodeGatewaySetupCode(embeddedSetupCode ?? trimmed);
  if (!setup) return null;
  const authMode: GatewayAuthMode =
    setup.password ? "password" : setup.token ? "token" : "";
  return {
    apiUrl: null,
    gatewayUrl: normalizeGatewayUrl(setup.url),
    authMode,
    secret: String(setup.password ?? setup.token ?? "").trim(),
    setupCode: embeddedSetupCode ?? resolveSetupCodeCandidate(trimmed),
    source: "setup-code",
  };
}

function resolveSetupCodeCandidate(rawInput: string | null | undefined): string | null {
  const trimmed = String(rawInput ?? "").trim();
  if (!trimmed) return null;
  const parsed = tryParseJson(trimmed);
  if (isRecord(parsed)) {
    const setupCode = asNonEmptyString(parsed.setupCode);
    if (setupCode) return setupCode;
  }
  return trimmed;
}

function normalizeGatewayAuthMode(raw: unknown): GatewayAuthMode {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "token" || value === "password") return value;
  return "";
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  const entries = Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== "");
  return Object.fromEntries(entries) as T;
}

function toBase64Url(input: string): string {
  return encodeBase64(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = normalized.length % 4;
  const padded = remainder === 0 ? normalized : normalized + "=".repeat(4 - remainder);
  return decodeBase64(padded);
}

function tryParseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function encodeBase64(input: string): string {
  if (typeof globalThis.btoa === "function") {
    const bytes = new TextEncoder().encode(input);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return globalThis.btoa(binary);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(input, "utf8").toString("base64");
  }
  throw new Error("base64 encoding is unavailable in this runtime");
}

function decodeBase64(input: string): string {
  if (typeof globalThis.atob === "function") {
    const binary = globalThis.atob(input);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(input, "base64").toString("utf8");
  }
  throw new Error("base64 decoding is unavailable in this runtime");
}
