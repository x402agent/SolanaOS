export const ConnectErrorDetailCodes = {
  TOKEN_REQUIRED: "TOKEN_REQUIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  PASSWORD_REQUIRED: "PASSWORD_REQUIRED",
  PASSWORD_INVALID: "PASSWORD_INVALID",
  INCOMPATIBLE: "INCOMPATIBLE",
  DEVICE_REQUIRED: "DEVICE_REQUIRED",
  DEVICE_INVALID: "DEVICE_INVALID",
  FORBIDDEN: "FORBIDDEN",
} as const;

export type ConnectErrorDetailCode =
  (typeof ConnectErrorDetailCodes)[keyof typeof ConnectErrorDetailCodes];

export function readConnectErrorDetailCode(
  error: unknown,
): ConnectErrorDetailCode | null {
  const code = readStringField(error, "code") ?? readStringField(error, "detailCode");
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return Object.values(ConnectErrorDetailCodes).includes(normalized as ConnectErrorDetailCode)
    ? (normalized as ConnectErrorDetailCode)
    : null;
}

export function readConnectErrorRecoveryAdvice(
  error: unknown,
): string | null {
  const explicitAdvice = readStringField(error, "advice") ?? readStringField(error, "recovery");
  if (explicitAdvice) return explicitAdvice;

  switch (readConnectErrorDetailCode(error)) {
    case ConnectErrorDetailCodes.TOKEN_REQUIRED:
      return "Paste the shared setup code or provide a gateway token before connecting.";
    case ConnectErrorDetailCodes.TOKEN_INVALID:
      return "Regenerate the shared connect bundle and replace the stored gateway token.";
    case ConnectErrorDetailCodes.PASSWORD_REQUIRED:
      return "Provide the gateway password from the current SolanaOS install.";
    case ConnectErrorDetailCodes.PASSWORD_INVALID:
      return "Regenerate the bundle after updating GATEWAY_AUTH_PASSWORD, then reconnect.";
    case ConnectErrorDetailCodes.INCOMPATIBLE:
      return "Update the app or daemon so both sides speak the same gateway protocol.";
    case ConnectErrorDetailCodes.DEVICE_REQUIRED:
      return "Re-onboard the device so it can send a signed device identity during connect.";
    case ConnectErrorDetailCodes.DEVICE_INVALID:
      return "Clear stored device auth and reconnect to mint a fresh device token.";
    case ConnectErrorDetailCodes.FORBIDDEN:
      return "Check the requested role and scopes for this client surface.";
    default:
      return null;
  }
}

function readStringField(error: unknown, key: string): string | null {
  if (typeof error === "string") return key === "message" ? error : null;
  if (typeof error !== "object" || error === null || Array.isArray(error)) return null;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
