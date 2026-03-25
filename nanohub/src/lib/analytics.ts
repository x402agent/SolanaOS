type EventPayload = Record<string, string | number | boolean | null | undefined>

export function trackHubEvent(_name: string, _payload?: EventPayload) {
  // Analytics disabled — not hosted on Vercel.
}
