/**
 * Browser-side gateway settings persistence via localStorage.
 *
 * On Netlify (no custom server), we store the user's gateway URL and token
 * in localStorage so the browser can connect directly to their gateway.
 */

const STORAGE_KEY = "solanaos.gateway.settings.v1";

export type BrowserGatewaySettings = {
  gatewayUrl: string;
  token: string;
  /** ISO timestamp of last successful connection */
  lastConnected?: string;
};

const DEFAULTS: BrowserGatewaySettings = {
  gatewayUrl: "",
  token: "",
};

export const loadBrowserGatewaySettings = (): BrowserGatewaySettings => {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<BrowserGatewaySettings>;
    return {
      gatewayUrl: typeof parsed.gatewayUrl === "string" ? parsed.gatewayUrl : "",
      token: typeof parsed.token === "string" ? parsed.token : "",
      lastConnected: typeof parsed.lastConnected === "string" ? parsed.lastConnected : undefined,
    };
  } catch {
    return DEFAULTS;
  }
};

export const saveBrowserGatewaySettings = (settings: BrowserGatewaySettings): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage full or unavailable — ignore
  }
};

export const clearBrowserGatewaySettings = (): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

export const markBrowserGatewayConnected = (): void => {
  const current = loadBrowserGatewaySettings();
  if (current.gatewayUrl) {
    saveBrowserGatewaySettings({
      ...current,
      lastConnected: new Date().toISOString(),
    });
  }
};
