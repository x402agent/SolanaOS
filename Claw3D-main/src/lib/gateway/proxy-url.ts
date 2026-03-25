export const resolveStudioProxyGatewayUrl = (): string => {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.host;
  return `${protocol}://${host}/api/gateway/ws`;
};

/**
 * Detect whether the custom Node.js server (with WebSocket proxy) is available.
 * On Netlify/static deployments the /api/gateway/ws endpoint does not exist,
 * so the browser must connect directly to the user's upstream gateway.
 */
export const isServerProxyAvailable = (): boolean => {
  // The custom server sets this at build time / runtime.
  // On Netlify (static SSR), it is not set.
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_GATEWAY_PROXY === "true") {
    return true;
  }
  // Heuristic: localhost with the expected dev port means the custom server is running
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const port = window.location.port;
    if ((host === "localhost" || host === "127.0.0.1") && (port === "3000" || port === "18800")) {
      return true;
    }
  }
  return false;
};

