import { isIP } from "node:net";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

const isPrivateIpv4 = (hostname: string): boolean => {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
};

const isPrivateIpv6 = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9")) return true;
  if (normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  return false;
};

export const isPrivateOrLoopbackHostname = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return true;
  if (LOOPBACK_HOSTNAMES.has(normalized)) return true;
  const ipVersion = isIP(normalized);
  if (ipVersion === 4) return isPrivateIpv4(normalized);
  if (ipVersion === 6) return isPrivateIpv6(normalized);
  return false;
};

export const validateBrowserPreviewTarget = (value: string): URL => {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Browser preview only supports http(s) URLs.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Browser preview does not allow embedded URL credentials.");
  }
  if (isPrivateOrLoopbackHostname(parsed.hostname)) {
    throw new Error("Browser preview does not allow loopback or private-network targets.");
  }
  return parsed;
};

export const validateJiraBaseUrl = (value: string): string => {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") {
    throw new Error("Jira base URL must use https.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Jira base URL must not include embedded credentials.");
  }
  const hostname = parsed.hostname.trim().toLowerCase();
  if (!hostname.endsWith(".atlassian.net")) {
    throw new Error("Jira base URL must be an Atlassian Cloud host.");
  }
  if (parsed.pathname !== "/" && parsed.pathname !== "") {
    throw new Error("Jira base URL must not include a path.");
  }
  if (parsed.search || parsed.hash) {
    throw new Error("Jira base URL must not include a query string or hash.");
  }
  return parsed.origin;
};
